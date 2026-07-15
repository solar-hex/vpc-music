import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../../db.js";
import { organizationMembers, organizations, shareTeamMembers, shareTeams, shareTokens, songOrganizationShares, songTeamShares, songUserShares, songs, users, setlists, setlistSongs } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requireOrgRole } from "../../middlewares/orgContext.js";

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

// ── POST /api/songs/:id/share — create a share link ─────────
shareRoutes.post(
  "/songs/:id/share",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin", "musician"),
  asyncHandler(async (req, res) => {
    const songId = req.params.id;

    // Verify song exists
    const [song] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);

    if (!song) throw createError(404, "Song not found");

    const { label, expiresInDays } = req.body;

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000)
      : null;

    const token = generateToken();

    const [created] = await db
      .insert(shareTokens)
      .values({
        token,
        songId,
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
    const token = req.params.token;

    const [share] = await db
      .select()
      .from(shareTokens)
      .where(eq(shareTokens.token, token))
      .limit(1);

    if (!share || !share.songId) throw createError(404, "Invalid or expired share link");
    if (share.revoked) throw createError(410, "This share link has been revoked");
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      throw createError(410, "This share link has expired");
    }

    // Fetch the song — only fields safe for read-only view
    const [song] = await db
      .select({
        id: songs.id,
        title: songs.title,
        aka: songs.aka,
        category: songs.category,
        key: songs.key,
        tempo: songs.tempo,
        artist: songs.artist,
        shout: songs.shout,
        content: songs.content,
        tags: songs.tags,
      })
      .from(songs)
      .where(eq(songs.id, share.songId))
      .limit(1);

    if (!song) throw createError(404, "Song no longer available");

    res.json({ song, shared: true });
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
