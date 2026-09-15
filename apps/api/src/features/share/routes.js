import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../../db.js";
import { organizationMembers, organizations, shareTeamMembers, shareTeams, shareTokens, songOrganizationShares, songTeamShares, songUserShares, songs, songVariations, users, setlists, setlistSongs } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requireOrgRole } from "../../middlewares/orgContext.js";
import { MEDIA_DIRECTIVE_KEY, redirectToSignedMedia } from "../songs/mediaRoutes.js";
import { isObjectStoreConfigured } from "../../corpus/objectStore.js";

export const shareRoutes = Router();

/**
 * Generate a URL-safe random token (32 bytes → 43 chars base64url).
 */
function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

async function loadOrgSong(songId, organizationId) {
  const [song] = await db
    .select({
      id: songs.id,
      title: songs.title,
      organizationId: songs.organizationId,
    })
    .from(songs)
    .where(and(eq(songs.id, songId), eq(songs.organizationId, organizationId)))
    .limit(1);

  return song || null;
}

/** A link that still opens: not turned off and not past its expiry. */
function isActiveShare(share, now = new Date()) {
  return Boolean(share) && !share.revoked && (!share.expiresAt || new Date(share.expiresAt) > now);
}

/**
 * The share behind a public song token, or the error its holder should see.
 */
async function loadPublicSongShare(token) {
  const [share] = await db.select().from(shareTokens).where(eq(shareTokens.token, String(token))).limit(1);
  if (!share || !share.songId) throw createError(404, "Invalid or expired share link");
  if (share.revoked) throw createError(410, "This share link has been turned off");
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    throw createError(410, "This share link has expired");
  }
  return share;
}

/**
 * The chart a share link shows: the song's curated default variation when it
 * has one, exactly as a member sees it. A song moved to the trash stops being
 * shared with it.
 */
async function loadSharedChart(share) {
  const [song] = await db
    .select({
      title: songs.title,
      artist: songs.artist,
      year: songs.year,
      key: songs.key,
      tempo: songs.tempo,
      status: songs.status,
      content: songs.content,
      deletedAt: songs.deletedAt,
      defaultVariationId: songs.defaultVariationId,
    })
    .from(songs)
    .where(eq(songs.id, share.songId))
    .limit(1);
  if (!song || song.deletedAt) throw createError(404, "Song no longer available");

  let { content, key } = song;
  if (song.defaultVariationId) {
    const [variation] = await db
      .select({ content: songVariations.content, key: songVariations.key })
      .from(songVariations)
      .where(eq(songVariations.id, song.defaultVariationId))
      .limit(1);
    if (variation) {
      content = variation.content;
      key = variation.key ?? key;
    }
  }
  return { song, content: content || "", key };
}

/**
 * The chart as someone outside the church may see it.
 *
 * A chart's directive block carries the church's own bookkeeping as `x_`
 * directives, and one of them is a link into the shared Dropbox folder, which
 * opens far more than this song. So every `x_` directive goes, except the
 * practice audio and PDFs the page plays, and those keep only their names: the
 * page plays them through the share token and never needs the storage address.
 */
export function publicChart(content) {
  return String(content || "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const directive = line.match(/^\s*\{\s*(x_[a-z0-9_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i);
      if (!directive) return [line];
      const key = directive[1].toLowerCase();
      if (!MEDIA_DIRECTIVE_KEY.test(key)) return [];
      // An empty entry stays empty, so it still draws no button.
      return [directive[2] ? `{${key}: https://media.invalid/${key}}` : `{${key}:}`];
    })
    .join("\n");
}

async function loadShareTeam(teamId, organizationId) {
  const [team] = await db
    .select({
      id: shareTeams.id,
      name: shareTeams.name,
      organizationId: shareTeams.organizationId,
    })
    .from(shareTeams)
    .where(and(eq(shareTeams.id, teamId), eq(shareTeams.organizationId, organizationId)))
    .limit(1);

  return team || null;
}

async function loadValidatedTeamMembers(userIds, organizationId) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return [];
  }

  return db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        inArray(organizationMembers.userId, uniqueUserIds),
      )
    );
}

async function listShareTeamsForOrganization(organizationId) {
  const teams = await db
    .select({
      id: shareTeams.id,
      name: shareTeams.name,
      createdAt: shareTeams.createdAt,
      updatedAt: shareTeams.updatedAt,
    })
    .from(shareTeams)
    .where(eq(shareTeams.organizationId, organizationId));

  if (teams.length === 0) {
    return [];
  }

  const teamIds = teams.map((team) => team.id);
  const memberRows = await db
    .select({
      teamId: shareTeamMembers.teamId,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(shareTeamMembers)
    .innerJoin(users, eq(shareTeamMembers.userId, users.id))
    .where(inArray(shareTeamMembers.teamId, teamIds));

  return teams.map((team) => {
    const members = memberRows
      .filter((member) => member.teamId === team.id)
      .map((member) => ({
        userId: member.userId,
        email: member.email,
        displayName: member.displayName,
      }));

    return {
      ...team,
      members,
      memberUserIds: members.map((member) => member.userId),
      memberNames: members.map((member) => member.displayName || member.email),
      memberCount: members.length,
    };
  });
}

async function listSongTeamShares(songId, organizationId) {
  const song = await loadOrgSong(songId, organizationId);
  if (!song) {
    throw createError(404, "Song not found");
  }

  const rows = await db
    .select({
      id: songTeamShares.id,
      teamId: shareTeams.id,
      teamName: shareTeams.name,
      createdAt: songTeamShares.createdAt,
    })
    .from(songTeamShares)
    .innerJoin(shareTeams, eq(songTeamShares.teamId, shareTeams.id))
    .where(and(eq(songTeamShares.songId, songId), eq(shareTeams.organizationId, organizationId)));

  return rows;
}

async function loadShareTargetOrganizations(sourceOrganizationId, requestedOrganizationIds) {
  const normalizedIds = [...new Set((requestedOrganizationIds || []).filter(Boolean))]
    .filter((organizationId) => organizationId !== sourceOrganizationId);

  if (normalizedIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: organizations.id,
      name: organizations.name,
    })
    .from(organizations)
    .where(inArray(organizations.id, normalizedIds));
}

async function loadTargetOrganizationsForListing(sourceOrganizationId) {
  const availableOrganizations = await db
    .select({
      id: organizations.id,
      name: organizations.name,
    })
    .from(organizations)
    .orderBy(organizations.name);

  return availableOrganizations.filter((organization) => organization.id !== sourceOrganizationId);
}

async function loadShareableSongs(songIds, organizationId) {
  const normalizedSongIds = [...new Set((songIds || []).filter(Boolean))];
  if (normalizedSongIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: songs.id,
      title: songs.title,
    })
    .from(songs)
    .where(and(eq(songs.organizationId, organizationId), inArray(songs.id, normalizedSongIds)));
}

async function listExistingOrganizationShares(songIds, organizationIds) {
  if (songIds.length === 0) {
    return [];
  }

  const conditions = [inArray(songOrganizationShares.songId, songIds)];
  if (organizationIds?.length) {
    conditions.push(inArray(songOrganizationShares.sharedWithOrganizationId, organizationIds));
  }

  return db
    .select({
      songId: songOrganizationShares.songId,
      organizationId: songOrganizationShares.sharedWithOrganizationId,
    })
    .from(songOrganizationShares)
    .where(and(...conditions));
}

// ── GET /api/share-organizations — list target organizations ─
shareRoutes.get(
  "/share-organizations",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin"),
  asyncHandler(async (req, res) => {
    const organizations = await loadTargetOrganizationsForListing(req.org.id);
    res.json({ organizations });
  })
);

// ── GET /api/songs/batch/organization-shares — current share map ─
shareRoutes.get(
  "/songs/batch/organization-shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin"),
  asyncHandler(async (req, res) => {
    const requestedSongIds = Array.isArray(req.query.songId)
      ? req.query.songId
      : typeof req.query.songId === "string"
      ? [req.query.songId]
      : [];

    if (requestedSongIds.length === 0) {
      throw createError(400, "Select at least one song");
    }

    const normalizedSongIds = [...new Set(requestedSongIds.filter(Boolean))];
    const shareableSongs = await loadShareableSongs(normalizedSongIds, req.org.id);
    if (shareableSongs.length !== normalizedSongIds.length) {
      throw createError(404, "One or more selected songs were not found");
    }

    const shares = await listExistingOrganizationShares(normalizedSongIds);
    res.json({ shares });
  })
);

// ── POST /api/songs/batch/organization-shares — batch share ─
shareRoutes.post(
  "/songs/batch/organization-shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin"),
  asyncHandler(async (req, res) => {
    const requestedSongIds = Array.isArray(req.body?.songIds) ? req.body.songIds : [];
    const requestedOrganizationIds = Array.isArray(req.body?.organizationIds) ? req.body.organizationIds : [];

    if (requestedSongIds.length === 0) {
      throw createError(400, "Select at least one song");
    }

    if (requestedOrganizationIds.length === 0) {
      throw createError(400, "Select at least one organization");
    }

    const normalizedSongIds = [...new Set(requestedSongIds.filter(Boolean))];
    const shareableSongs = await loadShareableSongs(normalizedSongIds, req.org.id);
    if (shareableSongs.length !== normalizedSongIds.length) {
      throw createError(404, "One or more selected songs were not found");
    }

    const targetOrganizations = await loadShareTargetOrganizations(req.org.id, requestedOrganizationIds);
    if (targetOrganizations.length === 0) {
      throw createError(400, "Select at least one other organization");
    }

    const songIds = shareableSongs.map((song) => song.id);
    const organizationIds = targetOrganizations.map((organization) => organization.id);
    const existingShares = await listExistingOrganizationShares(songIds, organizationIds);
    const existingKeys = new Set(existingShares.map((share) => `${share.songId}:${share.organizationId}`));
    const rowsToCreate = [];

    for (const songId of songIds) {
      for (const organizationId of organizationIds) {
        const key = `${songId}:${organizationId}`;
        if (!existingKeys.has(key)) {
          rowsToCreate.push({
            songId,
            sharedWithOrganizationId: organizationId,
            createdBy: req.user.id,
          });
        }
      }
    }

    if (rowsToCreate.length > 0) {
      await db.insert(songOrganizationShares).values(rowsToCreate);
    }

    res.status(201).json({
      sharedSongs: songIds.length,
      targetOrganizations: organizationIds.length,
      createdShares: rowsToCreate.length,
      skippedShares: existingShares.length,
    });
  })
);

// ── PATCH /api/songs/batch/organization-shares — edit batch shares ─
shareRoutes.patch(
  "/songs/batch/organization-shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin"),
  asyncHandler(async (req, res) => {
    const requestedSongIds = Array.isArray(req.body?.songIds) ? req.body.songIds : [];
    const addOrganizationIds = Array.isArray(req.body?.addOrganizationIds) ? req.body.addOrganizationIds : [];
    const removeOrganizationIds = Array.isArray(req.body?.removeOrganizationIds) ? req.body.removeOrganizationIds : [];

    if (requestedSongIds.length === 0) {
      throw createError(400, "Select at least one song");
    }

    if (addOrganizationIds.length === 0 && removeOrganizationIds.length === 0) {
      throw createError(400, "Choose at least one organization share change");
    }

    const normalizedSongIds = [...new Set(requestedSongIds.filter(Boolean))];
    const shareableSongs = await loadShareableSongs(normalizedSongIds, req.org.id);
    if (shareableSongs.length !== normalizedSongIds.length) {
      throw createError(404, "One or more selected songs were not found");
    }

    const requestedTargetIds = [...new Set([...addOrganizationIds, ...removeOrganizationIds].filter(Boolean))];
    const targetOrganizations = await loadShareTargetOrganizations(req.org.id, requestedTargetIds);
    if (requestedTargetIds.length > 0 && targetOrganizations.length !== requestedTargetIds.length) {
      throw createError(400, "One or more selected organizations are invalid");
    }

    const songIds = shareableSongs.map((song) => song.id);
    const organizationIdsToAdd = [...new Set(addOrganizationIds.filter(Boolean))];
    const organizationIdsToRemove = [...new Set(removeOrganizationIds.filter(Boolean))];
    let createdShares = 0;
    let skippedShares = 0;
    let removedShares = 0;

    if (organizationIdsToAdd.length > 0) {
      const existingAddShares = await listExistingOrganizationShares(songIds, organizationIdsToAdd);
      const existingKeys = new Set(existingAddShares.map((share) => `${share.songId}:${share.organizationId}`));
      const rowsToCreate = [];

      for (const songId of songIds) {
        for (const organizationId of organizationIdsToAdd) {
          const key = `${songId}:${organizationId}`;
          if (existingKeys.has(key)) {
            skippedShares += 1;
            continue;
          }

          rowsToCreate.push({
            songId,
            sharedWithOrganizationId: organizationId,
            createdBy: req.user.id,
          });
        }
      }

      if (rowsToCreate.length > 0) {
        await db.insert(songOrganizationShares).values(rowsToCreate);
        createdShares = rowsToCreate.length;
      }
    }

    if (organizationIdsToRemove.length > 0) {
      const existingRemoveShares = await listExistingOrganizationShares(songIds, organizationIdsToRemove);
      removedShares = existingRemoveShares.length;

      if (removedShares > 0) {
        await db
          .delete(songOrganizationShares)
          .where(
            and(
              inArray(songOrganizationShares.songId, songIds),
              inArray(songOrganizationShares.sharedWithOrganizationId, organizationIdsToRemove),
            )
          );
      }
    }

    res.json({
      sharedSongs: songIds.length,
      createdShares,
      removedShares,
      skippedShares,
    });
  })
);

// ── POST /api/songs/:id/share — the song's share link ───────
// One link per song. Asking again returns the link that is already out, so
// pressing Share never scatters another permanent link, and Stop sharing has
// a known set of links to turn off. `fresh: true` forces a new one.
shareRoutes.post(
  "/songs/:id/share",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    // In the caller's organization, not merely somewhere in the database.
    const song = await loadOrgSong(req.params.id, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const { label, expiresInDays, fresh } = req.body ?? {};

    if (!fresh && !expiresInDays) {
      const existing = await db.select().from(shareTokens).where(eq(shareTokens.songId, song.id));
      const [active] = existing
        .filter((share) => isActiveShare(share) && !share.expiresAt)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (active) {
        res.json({ shareToken: active, shareUrl: `/shared/${active.token}` });
        return;
      }
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000)
      : null;

    const token = generateToken();

    const [created] = await db
      .insert(shareTokens)
      .values({
        token,
        songId: song.id,
        createdBy: req.user.id,
        label: label || null,
        expiresAt,
      })
      .returning();

    res.status(201).json({
      shareToken: created,
      shareUrl: `/shared/${token}`,
    });
  })
);

// ── DELETE /api/songs/:id/shares — stop sharing the song ────
// Turns off EVERY link the song has, including the ones the old "Copy share
// link" made on each press, so stopping sharing really stops it.
shareRoutes.delete(
  "/songs/:id/shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const song = await loadOrgSong(req.params.id, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const existing = await db
      .select({ id: shareTokens.id, revoked: shareTokens.revoked })
      .from(shareTokens)
      .where(eq(shareTokens.songId, song.id));
    const live = existing.filter((share) => !share.revoked).map((share) => share.id);
    if (live.length > 0) {
      await db.update(shareTokens).set({ revoked: true }).where(inArray(shareTokens.id, live));
    }

    res.json({ revoked: live.length });
  })
);

// ── GET /api/songs/:id/shares — list share tokens for a song ─
shareRoutes.get(
  "/songs/:id/shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const songId = req.params.id;

    const song = await loadOrgSong(songId, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const tokens = await db
      .select()
      .from(shareTokens)
      .where(eq(shareTokens.songId, songId));

    res.json({ shares: tokens });
  })
);

// ── GET /api/songs/:id/direct-shares — list direct user shares ─
shareRoutes.get(
  "/songs/:id/direct-shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const songId = req.params.id;
    const song = await loadOrgSong(songId, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const directShares = await db
      .select({
        id: songUserShares.id,
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: songUserShares.createdAt,
      })
      .from(songUserShares)
      .innerJoin(users, eq(songUserShares.sharedWithUserId, users.id))
      .where(eq(songUserShares.songId, songId));

    res.json({ directShares });
  })
);

// ── GET /api/share-teams — list reusable sharing teams ─────
shareRoutes.get(
  "/share-teams",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const teams = await listShareTeamsForOrganization(req.org.id);
    res.json({ teams });
  })
);

// ── POST /api/share-teams — create a reusable sharing team ──
shareRoutes.post(
  "/share-teams",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const requestedUserIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];

    if (!name) {
      throw createError(400, "Team name is required");
    }

    const memberRows = await loadValidatedTeamMembers(requestedUserIds, req.org.id);
    if (memberRows.length === 0) {
      throw createError(400, "Select at least one organization member");
    }

    const [createdTeam] = await db
      .insert(shareTeams)
      .values({
        name,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning({
        id: shareTeams.id,
        name: shareTeams.name,
        createdAt: shareTeams.createdAt,
        updatedAt: shareTeams.updatedAt,
      });

    await db
      .insert(shareTeamMembers)
      .values(memberRows.map((member) => ({ teamId: createdTeam.id, userId: member.userId })));

    res.status(201).json({
      team: {
        ...createdTeam,
        members: memberRows.map((member) => ({
          userId: member.userId,
          email: member.email,
          displayName: member.displayName,
        })),
        memberUserIds: memberRows.map((member) => member.userId),
        memberNames: memberRows.map((member) => member.displayName || member.email),
        memberCount: memberRows.length,
      },
    });
  })
);

// ── DELETE /api/share-teams/:teamId — delete a sharing team ─
shareRoutes.delete(
  "/share-teams/:teamId",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const team = await loadShareTeam(req.params.teamId, req.org.id);
    if (!team) {
      throw createError(404, "Share team not found");
    }

    await db.delete(shareTeams).where(eq(shareTeams.id, team.id));
    res.json({ message: "Share team deleted" });
  })
);

// ── POST /api/songs/:id/direct-shares — share with a specific user ─
shareRoutes.post(
  "/songs/:id/direct-shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const songId = req.params.id;
    const song = await loadOrgSong(songId, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      throw createError(400, "Email is required");
    }

    const [targetUser] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!targetUser) {
      throw createError(404, "User not found");
    }

    const [existingShare] = await db
      .select({ id: songUserShares.id, createdAt: songUserShares.createdAt })
      .from(songUserShares)
      .where(
        and(
          eq(songUserShares.songId, songId),
          eq(songUserShares.sharedWithUserId, targetUser.id)
        )
      )
      .limit(1);

    if (existingShare) {
      res.json({
        directShare: {
          id: existingShare.id,
          userId: targetUser.id,
          email: targetUser.email,
          displayName: targetUser.displayName,
          createdAt: existingShare.createdAt,
        },
      });
      return;
    }

    const [createdShare] = await db
      .insert(songUserShares)
      .values({
        songId,
        sharedWithUserId: targetUser.id,
        createdBy: req.user.id,
      })
      .returning({
        id: songUserShares.id,
        createdAt: songUserShares.createdAt,
      });

    res.status(201).json({
      directShare: {
        id: createdShare.id,
        userId: targetUser.id,
        email: targetUser.email,
        displayName: targetUser.displayName,
        createdAt: createdShare.createdAt,
      },
    });
  })
);

// ── GET /api/songs/:id/team-shares — list team shares for a song ─
shareRoutes.get(
  "/songs/:id/team-shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const teamShares = await listSongTeamShares(req.params.id, req.org.id);
    res.json({ teamShares });
  })
);

// ── POST /api/songs/:id/team-shares — share with a team ─────
shareRoutes.post(
  "/songs/:id/team-shares",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const songId = req.params.id;
    const teamId = typeof req.body?.teamId === "string" ? req.body.teamId.trim() : "";

    if (!teamId) {
      throw createError(400, "Team is required");
    }

    const song = await loadOrgSong(songId, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const team = await loadShareTeam(teamId, req.org.id);
    if (!team) throw createError(404, "Share team not found");

    const [existingShare] = await db
      .select({ id: songTeamShares.id, createdAt: songTeamShares.createdAt })
      .from(songTeamShares)
      .where(and(eq(songTeamShares.songId, songId), eq(songTeamShares.teamId, teamId)))
      .limit(1);

    if (existingShare) {
      res.json({
        teamShare: {
          id: existingShare.id,
          teamId: team.id,
          teamName: team.name,
          createdAt: existingShare.createdAt,
        },
      });
      return;
    }

    const [createdShare] = await db
      .insert(songTeamShares)
      .values({
        songId,
        teamId,
        createdBy: req.user.id,
      })
      .returning({
        id: songTeamShares.id,
        createdAt: songTeamShares.createdAt,
      });

    res.status(201).json({
      teamShare: {
        id: createdShare.id,
        teamId: team.id,
        teamName: team.name,
        createdAt: createdShare.createdAt,
      },
    });
  })
);

// ── DELETE /api/songs/:id/team-shares/:shareId — revoke team share ─
shareRoutes.delete(
  "/songs/:id/team-shares/:shareId",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const song = await loadOrgSong(req.params.id, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const [existing] = await db
      .select({ id: songTeamShares.id })
      .from(songTeamShares)
      .innerJoin(shareTeams, eq(songTeamShares.teamId, shareTeams.id))
      .where(
        and(
          eq(songTeamShares.id, req.params.shareId),
          eq(songTeamShares.songId, req.params.id),
          eq(shareTeams.organizationId, req.org.id)
        )
      )
      .limit(1);

    if (!existing) throw createError(404, "Team share not found");

    await db.delete(songTeamShares).where(eq(songTeamShares.id, req.params.shareId));
    res.json({ message: "Team share removed" });
  })
);

// ── DELETE /api/songs/:id/direct-shares/:shareId — revoke direct share ─
shareRoutes.delete(
  "/songs/:id/direct-shares/:shareId",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const { id: songId, shareId } = req.params;
    const song = await loadOrgSong(songId, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const [existing] = await db
      .select({ id: songUserShares.id })
      .from(songUserShares)
      .where(and(eq(songUserShares.id, shareId), eq(songUserShares.songId, songId)))
      .limit(1);

    if (!existing) throw createError(404, "Direct share not found");

    await db
      .delete(songUserShares)
      .where(eq(songUserShares.id, shareId));

    res.json({ message: "Direct share removed" });
  })
);

// ── DELETE /api/songs/:id/shares/:tokenId — revoke a token ───
shareRoutes.delete(
  "/songs/:id/shares/:tokenId",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const { id: songId, tokenId } = req.params;

    const song = await loadOrgSong(songId, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const [existing] = await db
      .select({ id: shareTokens.id })
      .from(shareTokens)
      .where(
        and(eq(shareTokens.id, tokenId), eq(shareTokens.songId, songId))
      )
      .limit(1);

    if (!existing) throw createError(404, "Share token not found");

    await db
      .update(shareTokens)
      .set({ revoked: true })
      .where(eq(shareTokens.id, tokenId));

    res.json({ message: "Share token revoked" });
  })
);

// ── PATCH /api/songs/:id/shares/:tokenId — update label ─────
shareRoutes.patch(
  "/songs/:id/shares/:tokenId",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const { id: songId, tokenId } = req.params;
    const { label } = req.body;

    const song = await loadOrgSong(songId, req.org.id);
    if (!song) throw createError(404, "Song not found");

    const [existing] = await db
      .select({ id: shareTokens.id })
      .from(shareTokens)
      .where(
        and(eq(shareTokens.id, tokenId), eq(shareTokens.songId, songId))
      )
      .limit(1);

    if (!existing) throw createError(404, "Share token not found");

    const [updated] = await db
      .update(shareTokens)
      .set({ label: label ?? null })
      .where(eq(shareTokens.id, tokenId))
      .returning();

    res.json({ shareToken: updated });
  })
);

// ── GET /api/shared/:token — PUBLIC: view a shared song ──────
// No auth required — the token IS the credential.
shareRoutes.get(
  "/shared/:token",
  asyncHandler(async (req, res) => {
    const share = await loadPublicSongShare(req.params.token);
    const { song, content, key } = await loadSharedChart(share);

    // A link can be turned off at any moment, so no copy may outlive it.
    res.set("Cache-Control", "private, no-store");
    // Only what the chart shows: no id, organization, tags or draft state.
    res.json({
      song: {
        title: song.title,
        artist: song.artist,
        year: song.year,
        key,
        tempo: song.tempo,
        status: song.status,
        content: publicChart(content),
      },
      shared: true,
    });
  })
);

// ── GET /api/shared/:token/media/:key — PUBLIC: that song's audio and PDFs ─
// The same signing rules as a member's, with the token standing in for the
// membership check: only this song's media, only from our bucket.
shareRoutes.get(
  "/shared/:token/media/:key",
  asyncHandler(async (req, res) => {
    const { token, key } = req.params;
    if (!MEDIA_DIRECTIVE_KEY.test(key)) throw createError(400, "Not a media reference");
    if (!isObjectStoreConfigured()) throw createError(503, "Media storage is not configured");

    const share = await loadPublicSongShare(token);
    const { content } = await loadSharedChart(share);
    await redirectToSignedMedia(res, content, key);
  })
);

// ── POST /api/setlists/:id/share — create a setlist share link ─
shareRoutes.post(
  "/setlists/:id/share",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const [setlist] = await db
      .select({ id: setlists.id })
      .from(setlists)
      .where(and(eq(setlists.id, req.params.id), eq(setlists.organizationId, req.org.id)))
      .limit(1);

    if (!setlist) throw createError(404, "Setlist not found");

    const { label, expiresInDays } = req.body ?? {};
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null;
    const token = generateToken();

    const [created] = await db
      .insert(shareTokens)
      .values({
        token,
        setlistId: req.params.id,
        createdBy: req.user.id,
        label: label || null,
        expiresAt,
      })
      .returning();

    res.status(201).json({
      shareToken: created,
      shareUrl: `/shared/setlist/${token}`,
    });
  })
);

// ── GET /api/shared/setlist/:token — PUBLIC: view a shared setlist ─
// No auth required — the token IS the credential. Returns the setlist plus
// each filled song's read-only chart so a guest musician can play the set.
shareRoutes.get(
  "/shared/setlist/:token",
  asyncHandler(async (req, res) => {
    const [share] = await db
      .select()
      .from(shareTokens)
      .where(eq(shareTokens.token, req.params.token))
      .limit(1);

    if (!share || !share.setlistId) throw createError(404, "Invalid or expired share link");
    if (share.revoked) throw createError(410, "This share link has been revoked");
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      throw createError(410, "This share link has expired");
    }

    const [setlist] = await db
      .select({ id: setlists.id, name: setlists.name, category: setlists.category })
      .from(setlists)
      .where(eq(setlists.id, share.setlistId))
      .limit(1);

    if (!setlist) throw createError(404, "Setlist no longer available");

    const items = await db
      .select({
        id: setlistSongs.id,
        position: setlistSongs.position,
        keyOverride: setlistSongs.key,
        capo: setlistSongs.capo,
        notes: setlistSongs.notes,
        songId: songs.id,
        title: songs.title,
        artist: songs.artist,
        songKey: songs.key,
        tempo: songs.tempo,
        content: songs.content,
      })
      .from(setlistSongs)
      .innerJoin(songs, eq(setlistSongs.songId, songs.id))
      .where(eq(setlistSongs.setlistId, share.setlistId))
      .orderBy(setlistSongs.position);

    res.json({ setlist, songs: items, shared: true });
  })
);
