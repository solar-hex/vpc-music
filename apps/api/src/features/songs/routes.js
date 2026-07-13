import { Router } from "express";
import { eq, ilike, or, and, asc, desc, sql, inArray, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { db } from "../../db.js";
import { songs, songFavorites, songVariations, songUsages, songEdits, songGroups, songGroupSongs, songGroupManagers, songOrganizationShares, songTeamShares, songUserShares, shareTeamMembers, organizationMembers, organizations, users, setlists, setlistSongs } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requireOrgRole, requirePermission } from "../../middlewares/orgContext.js";
import { chordProToOnSong, chordProToPlainText, convertChrdToChordPro, onSongToChordPro, parseChordPro } from "@vpc-music/shared";
import { env } from "../../config/env.js";
import multer from "multer";
import JSZip from "jszip";
import { convertPdfToChordPro } from "./pdfToChordPro.js";
import { logActivity } from "../activity/service.js";

export const songRoutes = Router();

// ── Multer config for PDF uploads (10 MB limit, PDF only) ────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

function parseImportedMetadata(chordProContent, fallbackTitle = "Untitled") {
  const parsed = parseChordPro(chordProContent);
  const title = parsed.directives.title || parsed.directives.t || fallbackTitle;
  const artist = parsed.directives.artist || parsed.directives.a || null;
  const key = parsed.directives.key || parsed.directives.k || null;
  const tempoRaw = parsed.directives.tempo || null;
  const tempo = tempoRaw && /^\d+$/.test(tempoRaw) ? Number(tempoRaw) : null;

  return {
    title,
    artist,
    key,
    tempo,
  };
}

function hasDirective(content, key) {
  return new RegExp(`^\\{(?:${key}):\\s*.*?\\}$`, "im").test(content);
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeComparableText(value) {
  return normalizeComparableText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function computeTokenOverlapScore(leftTokens, rightTokens) {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function computeTitleSimilarityScore(inputTitle, candidateTitle, candidateAka) {
  const normalizedInput = normalizeComparableText(inputTitle);
  const normalizedTitle = normalizeComparableText(candidateTitle);
  const normalizedAka = normalizeComparableText(candidateAka);

  if (!normalizedInput || (!normalizedTitle && !normalizedAka)) {
    return 0;
  }

  const titleCandidates = [normalizedTitle, normalizedAka].filter(Boolean);
  let bestScore = 0;

  for (const candidate of titleCandidates) {
    if (candidate === normalizedInput) {
      bestScore = Math.max(bestScore, 1);
      continue;
    }

    if (candidate.includes(normalizedInput) || normalizedInput.includes(candidate)) {
      bestScore = Math.max(bestScore, 0.88);
      continue;
    }

    const overlap = computeTokenOverlapScore(
      tokenizeComparableText(normalizedInput),
      tokenizeComparableText(candidate),
    );
    bestScore = Math.max(bestScore, overlap);
  }

  return Number(bestScore.toFixed(2));
}

function computeLyricSimilarityScore(inputContent, candidateContent) {
  const overlap = computeTokenOverlapScore(
    tokenizeComparableText(inputContent).slice(0, 120),
    tokenizeComparableText(candidateContent).slice(0, 120),
  );

  return Number(overlap.toFixed(2));
}

function buildDuplicateMatches(rows, { title, content, excludeSongId }) {
  return rows
    .filter((row) => row.id !== excludeSongId)
    .map((row) => {
      const titleScore = computeTitleSimilarityScore(title, row.title, row.aka);
      const lyricScore = computeLyricSimilarityScore(content, row.content);
      const matchedOn = [];

      if (titleScore >= 0.6) {
        matchedOn.push("title");
      }
      if (lyricScore >= 0.35) {
        matchedOn.push("lyrics");
      }

      return {
        id: row.id,
        title: row.title,
        aka: row.aka,
        artist: row.artist,
        key: row.key,
        updatedAt: row.updatedAt,
        titleScore,
        lyricScore,
        overallScore: Number(Math.max(titleScore, lyricScore).toFixed(2)),
        matchedOn,
      };
    })
    .filter((row) => row.matchedOn.length > 0)
    .sort((left, right) => right.overallScore - left.overallScore)
    .slice(0, 5);
}

function buildExportContent(baseSong, variation) {
  if (!variation) {
    return {
      title: baseSong.title,
      content: baseSong.content,
      key: baseSong.key,
      artist: baseSong.artist,
      tempo: baseSong.tempo,
    };
  }

  const exportTitle = `${baseSong.title} - ${variation.name}`;
  const key = variation.key || baseSong.key || null;
  let content = variation.content || baseSong.content;
  const prelude = [];

  if (!hasDirective(content, "title|t")) prelude.push(`{title: ${exportTitle}}`);
  if (baseSong.artist && !hasDirective(content, "artist|a")) prelude.push(`{artist: ${baseSong.artist}}`);
  if (key && !hasDirective(content, "key|k")) prelude.push(`{key: ${key}}`);
  if (baseSong.tempo && !hasDirective(content, "tempo")) prelude.push(`{tempo: ${baseSong.tempo}}`);

  if (prelude.length > 0) {
    content = `${prelude.join("\n")}\n\n${content}`;
  }

  return {
    title: exportTitle,
    content,
    key,
    artist: baseSong.artist,
    tempo: baseSong.tempo,
  };
}

function hasBroadSongGroupAccess(req) {
  return req.user?.role === "owner" || req.orgRole === "admin" || req.orgRole === "musician";
}

async function loadSongGroupForOrganization(groupId, organizationId) {
  const [group] = await db
    .select({
      id: songGroups.id,
      name: songGroups.name,
      organizationId: songGroups.organizationId,
    })
    .from(songGroups)
    .where(and(eq(songGroups.id, groupId), eq(songGroups.organizationId, organizationId)))
    .limit(1);

  return group || null;
}

async function userCanManageSongGroup(req, groupId) {
  if (hasBroadSongGroupAccess(req)) {
    return true;
  }

  if (!req.org || !req.user?.id || typeof db.select !== "function") {
    return false;
  }

  const [manager] = await db
    .select({ id: songGroupManagers.id })
    .from(songGroupManagers)
    .innerJoin(songGroups, eq(songGroupManagers.groupId, songGroups.id))
    .where(
      and(
        eq(songGroupManagers.groupId, groupId),
        eq(songGroupManagers.userId, req.user.id),
        eq(songGroups.organizationId, req.org.id),
      )
    )
    .limit(1);

  return !!manager;
}

async function requireManagedSongGroup(req, groupId) {
  if (!(await userCanManageSongGroup(req, groupId))) {
    throw createError(403, "You do not have permission to manage this song group");
  }

  const group = await loadSongGroupForOrganization(groupId, req.org.id);
  if (!group) {
    throw createError(404, "Song group not found");
  }

  return group;
}

async function loadSharedSongIdsForUser(userId, organizationId) {
  if (!userId || typeof db.select !== "function") {
    return [];
  }

  const directRows = await db
    .select({ songId: songUserShares.songId })
    .from(songUserShares)
    .where(eq(songUserShares.sharedWithUserId, userId));

  const teamRows = await db
    .select({ songId: songTeamShares.songId })
    .from(songTeamShares)
    .innerJoin(shareTeamMembers, eq(songTeamShares.teamId, shareTeamMembers.teamId))
    .where(eq(shareTeamMembers.userId, userId));

  const organizationRows = organizationId
    ? await db
        .select({ songId: songOrganizationShares.songId })
        .from(songOrganizationShares)
        .where(eq(songOrganizationShares.sharedWithOrganizationId, organizationId))
    : [];

  return [...new Set([...directRows, ...teamRows, ...organizationRows].map((row) => row.songId))];
}

async function loadSongById(songId) {
  const [song] = await db
    .select()
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  return song || null;
}

async function loadSharedSongForUser(songId, userId, organizationId) {
  if (!userId || typeof db.select !== "function") {
    return null;
  }

  const directRows = await db
    .select({
      id: songs.id,
      title: songs.title,
      aka: songs.aka,
      category: songs.category,
      key: songs.key,
      tempo: songs.tempo,
      artist: songs.artist,
      shout: songs.shout,
      year: songs.year,
      tags: songs.tags,
      content: songs.content,
      isDraft: songs.isDraft,
      defaultVariationId: songs.defaultVariationId,
      organizationId: songs.organizationId,
      createdBy: songs.createdBy,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
    })
    .from(songs)
    .innerJoin(songUserShares, eq(songUserShares.songId, songs.id))
    .where(and(eq(songs.id, songId), eq(songUserShares.sharedWithUserId, userId)))
    .limit(1);

  if (directRows[0]) {
    return directRows[0];
  }

  const [teamSong] = await db
    .select({
      id: songs.id,
      title: songs.title,
      aka: songs.aka,
      category: songs.category,
      key: songs.key,
      tempo: songs.tempo,
      artist: songs.artist,
      shout: songs.shout,
      year: songs.year,
      tags: songs.tags,
      content: songs.content,
      isDraft: songs.isDraft,
      defaultVariationId: songs.defaultVariationId,
      organizationId: songs.organizationId,
      createdBy: songs.createdBy,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
    })
    .from(songs)
    .innerJoin(songTeamShares, eq(songTeamShares.songId, songs.id))
    .innerJoin(shareTeamMembers, eq(songTeamShares.teamId, shareTeamMembers.teamId))
    .where(and(eq(songs.id, songId), eq(shareTeamMembers.userId, userId)))
    .limit(1);

  if (teamSong) {
    return teamSong;
  }

  if (!organizationId) {
    return null;
  }

  const [organizationSong] = await db
    .select({
      id: songs.id,
      title: songs.title,
      aka: songs.aka,
      category: songs.category,
      key: songs.key,
      tempo: songs.tempo,
      artist: songs.artist,
      shout: songs.shout,
      year: songs.year,
      tags: songs.tags,
      content: songs.content,
      isDraft: songs.isDraft,
      defaultVariationId: songs.defaultVariationId,
      organizationId: songs.organizationId,
      createdBy: songs.createdBy,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
    })
    .from(songs)
    .innerJoin(songOrganizationShares, eq(songOrganizationShares.songId, songs.id))
    .where(and(eq(songs.id, songId), eq(songOrganizationShares.sharedWithOrganizationId, organizationId)))
    .limit(1);

  return organizationSong || null;
}

function sanitizeFilename(value) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "").trim() || "untitled";
}

function convertExportContent(target, format) {
  if (format === "onsong") {
    return {
      extension: "onsong",
      content: chordProToOnSong(target.content),
    };
  }

  if (format === "text") {
    return {
      extension: "txt",
      content: chordProToPlainText(target.content),
    };
  }

  return {
    extension: "cho",
    content: target.content,
  };
}

async function getSongExportTarget(songId, variationId) {
  const [song] = await db
    .select({
      title: songs.title,
      content: songs.content,
      key: songs.key,
      artist: songs.artist,
      tempo: songs.tempo,
    })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);

  if (!song) throw createError(404, "Song not found");

  if (!variationId) {
    return buildExportContent(song, null);
  }

  const [variation] = await db
    .select({
      id: songVariations.id,
      name: songVariations.name,
      content: songVariations.content,
      key: songVariations.key,
    })
    .from(songVariations)
    .where(and(eq(songVariations.id, variationId), eq(songVariations.songId, songId)))
    .limit(1);

  if (!variation) throw createError(404, "Variation not found");

  return buildExportContent(song, variation);
}

// ── GET /api/songs — list all songs (with optional search) ───
songRoutes.get(
  "/",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const {
      q,
      groupId,
      scope,
      category,
      tag,
      key: songKey,
      tempoMin,
      tempoMax,
      status,
      favorites,
      archived,
      sort,
      limit = "50",
      offset = "0",
    } = req.query;

    const normalizedScope = scope === "shared" ? "shared" : "organization";
    const normalizedSort = typeof sort === "string" ? sort : "lastEdited";
    const usageAggregate = normalizedSort === "mostUsed"
      ? db
          .select({
            songId: songUsages.songId,
            useCount: sql`count(*)::int`.as("use_count"),
          })
          .from(songUsages)
          .where(req.org ? eq(songUsages.organizationId, req.org.id) : undefined)
          .groupBy(songUsages.songId)
          .as("usage_agg")
      : null;

    const parsedTempoMin = typeof tempoMin === "string" && /^\d+$/.test(tempoMin)
      ? Number.parseInt(tempoMin, 10)
      : null;
    const parsedTempoMax = typeof tempoMax === "string" && /^\d+$/.test(tempoMax)
      ? Number.parseInt(tempoMax, 10)
      : null;

    const conditions = [];

    if (normalizedScope === "shared") {
      const sharedSongIds = await loadSharedSongIdsForUser(req.user?.id, req.org?.id);
      if (sharedSongIds.length === 0) {
        res.json({ songs: [], total: 0 });
        return;
      }

      conditions.push(inArray(songs.id, sharedSongIds));
    } else if (req.org) {
      // Scope to organization if context available
      conditions.push(eq(songs.organizationId, req.org.id));
    }

    if (typeof groupId === "string" && groupId.trim()) {
      const groupConditions = [eq(songGroups.id, groupId.trim())];
      if (req.org) {
        groupConditions.push(eq(songGroups.organizationId, req.org.id));
      }

      const rows = await db
        .select({ songId: songGroupSongs.songId })
        .from(songGroupSongs)
        .innerJoin(songGroups, eq(songGroupSongs.groupId, songGroups.id))
        .where(and(...groupConditions));

      const groupedSongIds = [...new Set(rows.map((row) => row.songId))];
      if (groupedSongIds.length === 0) {
        res.json({ songs: [], total: 0 });
        return;
      }

      conditions.push(inArray(songs.id, groupedSongIds));
    }

    // Trash is always excluded; archived songs only show when requested
    conditions.push(isNull(songs.deletedAt));
    conditions.push(eq(songs.isArchived, archived === "true"));

    if (typeof status === "string" && status.trim()) {
      conditions.push(eq(songs.status, status.trim()));
    }

    if (favorites === "true") {
      const favoriteRows = await db
        .select({ songId: songFavorites.songId })
        .from(songFavorites)
        .where(eq(songFavorites.userId, req.user.id));
      const favoriteIds = favoriteRows.map((row) => row.songId);
      if (favoriteIds.length === 0) {
        res.json({ songs: [], total: 0 });
        return;
      }
      conditions.push(inArray(songs.id, favoriteIds));
    }

    let query = db
      .select({
        id: songs.id,
        title: songs.title,
        aka: songs.aka,
        category: songs.category,
        key: songs.key,
        tempo: songs.tempo,
        artist: songs.artist,
        tags: songs.tags,
        isDraft: songs.isDraft,
        status: songs.status,
        isArchived: songs.isArchived,
        durationSeconds: songs.durationSeconds,
        genre: songs.genre,
        // Explicitly qualified — see features/setlists/routes.js for why
        // ${songs.id} interpolation here would silently return null instead
        // of correlating to the outer row.
        lastPlayed: sql`(SELECT max(used_at) FROM song_usages WHERE song_usages.song_id = "songs"."id")`,
        createdAt: songs.createdAt,
        updatedAt: songs.updatedAt,
        ...(normalizedScope === "shared"
          ? {
              sharedWithMe: sql`true`.as("shared_with_me"),
              organizationName: organizations.name,
            }
          : {}),
      })
      .from(songs);

    if (normalizedSort === "mostUsed" && usageAggregate) {
      query = query.leftJoin(usageAggregate, eq(songs.id, usageAggregate.songId));
    }

    if (normalizedScope === "shared") {
      query = query.leftJoin(organizations, eq(songs.organizationId, organizations.id));
    }

    if (q) {
      conditions.push(
        or(
          ilike(songs.title, `%${q}%`),
          ilike(songs.aka, `%${q}%`),
          ilike(songs.category, `%${q}%`),
          ilike(songs.artist, `%${q}%`),
          ilike(songs.tags, `%${q}%`)
        )
      );
    }
    if (category) {
      conditions.push(eq(songs.category, category));
    }
    if (tag) {
      conditions.push(ilike(songs.tags, `%${tag}%`));
    }
    if (songKey) {
      conditions.push(eq(songs.key, songKey));
    }
    if (parsedTempoMin !== null) {
      conditions.push(gte(songs.tempo, parsedTempoMin));
    }
    if (parsedTempoMax !== null) {
      conditions.push(lte(songs.tempo, parsedTempoMax));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const orderByClause = (() => {
      switch (normalizedSort) {
        case "title":
          return [asc(songs.title), desc(songs.updatedAt)];
        case "recentlyAdded":
          return [desc(songs.createdAt), desc(songs.updatedAt)];
        case "mostUsed":
          return usageAggregate
            ? [sql`coalesce(${usageAggregate.useCount}, 0) desc`, desc(songs.updatedAt)]
            : [desc(songs.updatedAt)];
        case "lastEdited":
        default:
          return [desc(songs.updatedAt)];
      }
    })();

    const result = await query
      .orderBy(...orderByClause)
      .limit(parseInt(limit, 10))
      .offset(parseInt(offset, 10));

    const [{ count }] = conditions.length > 0
      ? await db.select({ count: sql`count(*)::int` }).from(songs).where(and(...conditions))
      : await db.select({ count: sql`count(*)::int` }).from(songs);

    // Flag the caller's favorites
    let favoriteIdSet = new Set();
    if (result.length > 0) {
      const favoriteRows = await db
        .select({ songId: songFavorites.songId })
        .from(songFavorites)
        .where(and(eq(songFavorites.userId, req.user.id), inArray(songFavorites.songId, result.map((s) => s.id))));
      favoriteIdSet = new Set(favoriteRows.map((row) => row.songId));
    }

    res.json({
      songs: result.map((song) => ({ ...song, isFavorite: favoriteIdSet.has(song.id) })),
      total: count,
    });
  })
);

// ── GET /api/songs/tags — list all unique tags ───────────────
songRoutes.get(
  "/tags",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const conditions = [];
    if (req.org) {
      conditions.push(eq(songs.organizationId, req.org.id));
    }

    const rows = conditions.length > 0
      ? await db.select({ tags: songs.tags }).from(songs).where(and(...conditions))
      : await db.select({ tags: songs.tags }).from(songs);

    // Tags are stored comma-separated; collect unique values
    const tagSet = new Set();
    for (const row of rows) {
      if (row.tags) {
        for (const t of row.tags.split(",")) {
          const trimmed = t.trim().toLowerCase();
          if (trimmed) tagSet.add(trimmed);
        }
      }
    }
    res.json({ tags: [...tagSet].sort() });
  })
);

// ── GET /api/songs/categories — list all unique categories ───
songRoutes.get(
  "/categories",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const conditions = [];
    if (req.org) {
      conditions.push(eq(songs.organizationId, req.org.id));
    }

    const rows = conditions.length > 0
      ? await db.select({ category: songs.category }).from(songs).where(and(...conditions))
      : await db.select({ category: songs.category }).from(songs);

    const categorySet = new Set();
    for (const row of rows) {
      const trimmed = String(row.category || "").trim();
      if (trimmed) categorySet.add(trimmed);
    }

    res.json({ categories: [...categorySet].sort((a, b) => a.localeCompare(b)) });
  })
);

// ── GET /api/songs/groups — list reusable song groups ────────
songRoutes.get(
  "/groups",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    if (!req.org) {
      res.json({ groups: [] });
      return;
    }

    const groups = await db
      .select({
        id: songGroups.id,
        name: songGroups.name,
        createdAt: songGroups.createdAt,
        updatedAt: songGroups.updatedAt,
        // Explicitly qualified — see features/setlists/routes.js for why
        // ${songGroups.id} interpolation here would silently zero every
        // count instead of correlating to the outer row.
        songCount: sql`(SELECT count(*) FROM song_group_songs WHERE song_group_songs.group_id = "song_groups"."id")::int`,
      })
      .from(songGroups)
      .where(eq(songGroups.organizationId, req.org.id))
      .orderBy(asc(songGroups.name));

    const groupIds = groups.map((group) => group.id);
    const managerRows = groupIds.length === 0
      ? []
      : await db
          .select({
            groupId: songGroupManagers.groupId,
            userId: songGroupManagers.userId,
            displayName: users.displayName,
            email: users.email,
          })
          .from(songGroupManagers)
          .innerJoin(users, eq(songGroupManagers.userId, users.id))
          .where(inArray(songGroupManagers.groupId, groupIds));

    const manageableGroupIds = hasBroadSongGroupAccess(req)
      ? new Set(groupIds)
      : new Set(
          groupIds.length === 0 || typeof db.select !== "function"
            ? []
            : (await db
                .select({ groupId: songGroupManagers.groupId })
                .from(songGroupManagers)
                .innerJoin(songGroups, eq(songGroupManagers.groupId, songGroups.id))
                .where(
                  and(
                    eq(songGroupManagers.userId, req.user.id),
                    eq(songGroups.organizationId, req.org.id),
                    inArray(songGroupManagers.groupId, groupIds),
                  )
                )).map((row) => row.groupId)
        );

    const managersByGroupId = new Map();
    for (const row of managerRows) {
      const manager = {
        userId: row.userId,
        name: row.displayName || row.email,
      };
      const existing = managersByGroupId.get(row.groupId) || [];
      existing.push(manager);
      managersByGroupId.set(row.groupId, existing);
    }

    res.json({
      groups: groups.map((group) => {
        const managers = managersByGroupId.get(group.id) || [];
        return {
          ...group,
          managers,
          managerUserIds: managers.map((manager) => manager.userId),
          managerNames: managers.map((manager) => manager.name),
          canManage: manageableGroupIds.has(group.id),
        };
      }),
    });
  })
);

// ── POST /api/songs/groups — create a reusable song group ────
songRoutes.post(
  "/groups",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      throw createError(400, "Group name is required");
    }

    const [existing] = await db
      .select({ id: songGroups.id })
      .from(songGroups)
      .where(and(eq(songGroups.organizationId, req.org.id), eq(songGroups.name, name)))
      .limit(1);

    if (existing) {
      throw createError(400, "A song group with that name already exists");
    }

    const [group] = await db
      .insert(songGroups)
      .values({
        name,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    res.status(201).json({ group: { ...group, songCount: 0 } });
  })
);

// ── PUT /api/songs/groups/:groupId — rename a song group ─────
songRoutes.put(
  "/groups/:groupId",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      throw createError(400, "Group name is required");
    }

    await requireManagedSongGroup(req, req.params.groupId);

    const [duplicate] = await db
      .select({ id: songGroups.id })
      .from(songGroups)
      .where(and(eq(songGroups.organizationId, req.org.id), eq(songGroups.name, name)))
      .limit(1);

    if (duplicate && duplicate.id !== req.params.groupId) {
      throw createError(400, "A song group with that name already exists");
    }

    const [group] = await db
      .update(songGroups)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(songGroups.id, req.params.groupId))
      .returning();

    res.json({ group });
  })
);

// ── DELETE /api/songs/groups/:groupId — remove a group ───────
songRoutes.delete(
  "/groups/:groupId",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    await requireManagedSongGroup(req, req.params.groupId);

    await db.delete(songGroups).where(eq(songGroups.id, req.params.groupId));
    res.json({ message: "Song group deleted" });
  })
);

// ── PUT /api/songs/groups/:groupId/managers — delegate management ──
songRoutes.put(
  "/groups/:groupId/managers",
  auth,
  orgContext,
  requireOrg,
  requireOrgRole("admin"),
  asyncHandler(async (req, res) => {
    const group = await loadSongGroupForOrganization(req.params.groupId, req.org.id);
    if (!group) {
      throw createError(404, "Song group not found");
    }

    const requestedUserIds = Array.isArray(req.body?.userIds)
      ? [...new Set(req.body.userIds.map((value) => String(value).trim()).filter(Boolean))]
      : [];

    const validMembers = requestedUserIds.length === 0
      ? []
      : await db
          .select({ userId: organizationMembers.userId })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, req.org.id),
              inArray(organizationMembers.userId, requestedUserIds),
            )
          );

    const validUserIds = validMembers.map((member) => member.userId);
    if (validUserIds.length !== requestedUserIds.length) {
      throw createError(400, "All delegated managers must belong to the active organization");
    }

    await db.delete(songGroupManagers).where(eq(songGroupManagers.groupId, req.params.groupId));

    if (validUserIds.length > 0) {
      await db.insert(songGroupManagers).values(
        validUserIds.map((userId) => ({
          groupId: req.params.groupId,
          userId,
        }))
      );
    }

    const managers = validUserIds.length === 0
      ? []
      : await db
          .select({
            userId: users.id,
            name: users.displayName,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, validUserIds));

    res.json({
      groupId: req.params.groupId,
      managerUserIds: validUserIds,
      managerNames: managers.map((manager) => manager.name || manager.email),
    });
  })
);

// ── POST /api/songs/groups/:groupId/songs — bulk add songs ───
songRoutes.post(
  "/groups/:groupId/songs",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const rawSongIds = Array.isArray(req.body?.songIds) ? req.body.songIds : [];
    const songIds = [...new Set(rawSongIds.map((value) => String(value).trim()).filter(Boolean))];
    if (songIds.length === 0) {
      throw createError(400, "At least one song id is required");
    }

    await requireManagedSongGroup(req, req.params.groupId);

    const validSongs = await db
      .select({ id: songs.id })
      .from(songs)
      .where(and(eq(songs.organizationId, req.org.id), inArray(songs.id, songIds)));

    const validSongIds = validSongs.map((song) => song.id);
    if (validSongIds.length === 0) {
      throw createError(400, "No valid songs found for this group");
    }

    const existingAssignments = await db
      .select({ songId: songGroupSongs.songId })
      .from(songGroupSongs)
      .where(and(eq(songGroupSongs.groupId, req.params.groupId), inArray(songGroupSongs.songId, validSongIds)));

    const existingSet = new Set(existingAssignments.map((row) => row.songId));
    const addedSongIds = validSongIds.filter((songId) => !existingSet.has(songId));

    if (addedSongIds.length > 0) {
      await db.insert(songGroupSongs).values(
        addedSongIds.map((songId) => ({
          groupId: req.params.groupId,
          songId,
        }))
      );
    }

    res.status(201).json({
      addedSongIds,
      skippedSongIds: validSongIds.filter((songId) => existingSet.has(songId)),
    });
  })
);

// ── DELETE /api/songs/groups/:groupId/songs/:songId ──────────
songRoutes.delete(
  "/groups/:groupId/songs/:songId",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    await requireManagedSongGroup(req, req.params.groupId);

    await db
      .delete(songGroupSongs)
      .where(and(eq(songGroupSongs.groupId, req.params.groupId), eq(songGroupSongs.songId, req.params.songId)));

    res.json({ message: "Song removed from group" });
  })
);

// ── GET /api/songs/most-used — top songs by usage count ──────
songRoutes.get(
  "/most-used",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const { limit = "10" } = req.query;

    const conditions = [];
    if (req.org) {
      conditions.push(eq(songUsages.organizationId, req.org.id));
    }

    // Aggregate usage counts per song, then join with songs table
    const subquery = db
      .select({
        songId: songUsages.songId,
        useCount: sql`count(*)::int`.as("use_count"),
        lastUsed: sql`max(${songUsages.usedAt})`.as("last_used"),
      })
      .from(songUsages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(songUsages.songId)
      .orderBy(sql`count(*) desc`)
      .limit(parseInt(limit, 10))
      .as("usage_agg");

    const result = await db
      .select({
        id: songs.id,
        title: songs.title,
        category: songs.category,
        key: songs.key,
        tempo: songs.tempo,
        artist: songs.artist,
        tags: songs.tags,
        useCount: subquery.useCount,
        lastUsed: subquery.lastUsed,
      })
      .from(subquery)
      .innerJoin(songs, eq(songs.id, subquery.songId))
      .orderBy(sql`${subquery.useCount} desc`);

    res.json({ songs: result });
  })
);

// ── GET /api/songs/usage-report — plays per song ─────────────
// Per song: play count, last played date, and the setlists it appears in.
songRoutes.get(
  "/usage-report",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        key: songs.key,
        tempo: songs.tempo,
        // Explicitly qualified — see features/setlists/routes.js for why
        // ${songs.id} interpolation here would silently zero/null these
        // instead of correlating to the outer row.
        playCount: sql`(SELECT count(*) FROM song_usages WHERE song_usages.song_id = "songs"."id")::int`,
        lastPlayed: sql`(SELECT max(used_at) FROM song_usages WHERE song_usages.song_id = "songs"."id")`,
        setlistNames: sql`(
          SELECT string_agg(DISTINCT setlists.name, ', ')
          FROM setlist_songs
          JOIN setlists ON setlists.id = setlist_songs.setlist_id
          WHERE setlist_songs.song_id = ${songs.id} AND setlists.deleted_at IS NULL
        )`,
      })
      .from(songs)
      .where(and(eq(songs.organizationId, req.org.id), isNull(songs.deletedAt), eq(songs.isArchived, false)))
      .orderBy(asc(songs.title));

    res.json({ songs: rows });
  })
);

// ── GET /api/songs/export/zip — export selected songs as zip ─
songRoutes.get(
  "/export/zip",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const format = String(req.query.format || "chordpro").toLowerCase();
    if (!["chordpro", "onsong", "text"].includes(format)) {
      throw createError(400, "format must be chordpro, onsong, or text");
    }

    const rawIds = Array.isArray(req.query.id)
      ? req.query.id
      : req.query.id
        ? [req.query.id]
        : typeof req.query.ids === "string"
          ? req.query.ids.split(",")
          : [];

    const songIds = [...new Set(rawIds.map((value) => String(value).trim()).filter(Boolean))];

    if (songIds.length === 0) {
      throw createError(400, "At least one song id is required for zip export");
    }

    const conditions = [inArray(songs.id, songIds)];
    if (req.org) {
      conditions.push(eq(songs.organizationId, req.org.id));
    }

    const rows = await db
      .select({
        id: songs.id,
        title: songs.title,
        content: songs.content,
        key: songs.key,
        artist: songs.artist,
        tempo: songs.tempo,
      })
      .from(songs)
      .where(and(...conditions));

    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const orderedSongs = songIds.map((id) => rowsById.get(id)).filter(Boolean);

    if (orderedSongs.length === 0) {
      throw createError(404, "No songs found for export");
    }

    const zip = new JSZip();
    const manifestLines = [
      "Song Library Export",
      `Format: ${format}`,
      `Requested songs: ${songIds.length}`,
      `Exported songs: ${orderedSongs.length}`,
    ];

    if (orderedSongs.length !== songIds.length) {
      manifestLines.push(`Skipped songs: ${songIds.length - orderedSongs.length}`);
    }

    manifestLines.push("");

    for (const [index, song] of orderedSongs.entries()) {
      const target = buildExportContent(song, null);
      const converted = convertExportContent(target, format);
      const fileName = `${String(index + 1).padStart(2, "0")} - ${sanitizeFilename(target.title)}.${converted.extension}`;
      zip.file(fileName, converted.content);
      manifestLines.push(`${index + 1}. ${target.title}`);
    }

    zip.file("00 - Export Info.txt", manifestLines.join("\n"));

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="song-library-${format}.zip"`);
    res.send(buffer);
  })
);

// ── POST /api/songs/duplicates/check — duplicate suggestions ─
songRoutes.post(
  "/duplicates/check",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const content = String(req.body?.content || "").trim();
    const excludeSongId = String(req.body?.excludeSongId || "").trim() || null;

    if (!title && !content) {
      return res.json({ matches: [] });
    }

    const rows = await db
      .select({
        id: songs.id,
        title: songs.title,
        aka: songs.aka,
        artist: songs.artist,
        key: songs.key,
        updatedAt: songs.updatedAt,
        content: songs.content,
      })
      .from(songs)
      .where(eq(songs.organizationId, req.org.id));

    const matches = buildDuplicateMatches(rows, { title, content, excludeSongId });
    res.json({ matches });
  })
);

// ── GET /api/songs/:id — get single song ─────────────────────
songRoutes.get(
  "/:id",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    let song = null;

    if (req.user?.role === "owner") {
      song = await loadSongById(req.params.id);
    } else if (req.org?.id) {
      const [orgSong] = await db
        .select()
        .from(songs)
        .where(and(eq(songs.id, req.params.id), eq(songs.organizationId, req.org.id)))
        .limit(1);

      song = orgSong || null;
    }

    if (!song) {
      song = await loadSharedSongForUser(req.params.id, req.user?.id, req.org?.id);
    }

    if (!song) {
      throw createError(404, "Song not found");
    }

    // Get variations
    const variations = await db
      .select()
      .from(songVariations)
      .where(eq(songVariations.songId, song.id));

    res.json({ song, variations });
  })
);

// ── POST /api/songs — create song ────────────────────────────
songRoutes.post(
  "/",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { title, aka, category, key, tempo, artist, shout, year, tags, content, abcNotation, isDraft, timeSignature, durationSeconds, genre, albumId, energy } = req.body;

    if (!title || !content) {
      throw createError(400, "Title and content are required");
    }

    const [song] = await db
      .insert(songs)
      .values({
        title,
        aka: aka || null,
        category: category || null,
        key: key || null,
        tempo: tempo ? parseInt(tempo, 10) : null,
        artist: artist || null,
        shout: shout || null,
        year: year || null,
        tags: tags || null,
        content,
        abcNotation: abcNotation || null,
        timeSignature: timeSignature || null,
        durationSeconds: Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0 ? Math.round(Number(durationSeconds)) : null,
        genre: genre || null,
        albumId: albumId || null,
        energy: Number.isInteger(energy) && energy >= 1 && energy <= 5 ? energy : null,
        isDraft: isDraft ?? false,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    await logActivity(req, "song.created", { type: "song", id: song.id, label: song.title });
    res.status(201).json({ song });
  })
);

// ── PUT /api/songs/:id — update song ─────────────────────────
songRoutes.put(
  "/:id",
  auth,  orgContext,
  requireOrg,
  requirePermission("songs:edit"),  asyncHandler(async (req, res) => {
    const {
      title,
      aka,
      category,
      key,
      tempo,
      artist,
      shout,
      year,
      tags,
      content,
      abcNotation,
      isDraft,
      timeSignature,
      durationSeconds,
      genre,
      albumId,
      energy,
      lastKnownUpdatedAt,
      forceOverwrite,
    } = req.body;

    const [existing] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, req.params.id))
      .limit(1);

    if (!existing) {
      throw createError(404, "Song not found");
    }

    if (!forceOverwrite && lastKnownUpdatedAt && existing.updatedAt) {
      const existingUpdatedAt = new Date(existing.updatedAt).toISOString();
      const providedUpdatedAt = new Date(lastKnownUpdatedAt).toISOString();

      if (existingUpdatedAt !== providedUpdatedAt) {
        return res.status(409).json({
          error: { message: "This song was updated by someone else. Review the latest version before saving." },
          currentSong: existing,
        });
      }
    }

    // Track field-level changes for edit history
    const trackedFields = { title, aka, category, key, tempo, artist, shout, year, tags, content, abcNotation, isDraft };
    const edits = [];
    for (const [field, newVal] of Object.entries(trackedFields)) {
      if (newVal === undefined) continue;
      const oldVal = existing[field];
      const oldStr = oldVal == null ? null : String(oldVal);
      const newStr = newVal == null ? null : String(newVal);
      if (oldStr !== newStr) {
        edits.push({
          songId: req.params.id,
          editedBy: req.user.id,
          field,
          oldValue: oldStr,
          newValue: newStr,
        });
      }
    }

    const [song] = await db
      .update(songs)
      .set({
        ...(title !== undefined && { title }),
        ...(aka !== undefined && { aka }),
        ...(category !== undefined && { category }),
        ...(key !== undefined && { key }),
        ...(tempo !== undefined && { tempo: tempo ? parseInt(tempo, 10) : null }),
        ...(artist !== undefined && { artist }),
        ...(shout !== undefined && { shout }),
        ...(year !== undefined && { year }),
        ...(tags !== undefined && { tags }),
        ...(content !== undefined && { content }),
        ...(abcNotation !== undefined && { abcNotation: abcNotation || null }),
        ...(isDraft !== undefined && { isDraft }),
        ...(timeSignature !== undefined && { timeSignature: timeSignature || null }),
        ...(durationSeconds !== undefined && {
          durationSeconds: Number.isFinite(Number(durationSeconds)) && Number(durationSeconds) > 0 ? Math.round(Number(durationSeconds)) : null,
        }),
        ...(genre !== undefined && { genre: genre || null }),
        ...(albumId !== undefined && { albumId: albumId || null }),
        ...(energy !== undefined && {
          energy: Number.isInteger(energy) && energy >= 1 && energy <= 5 ? energy : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(songs.id, req.params.id))
      .returning();

    // Record edit history
    if (edits.length > 0) {
      await db.insert(songEdits).values(edits);
    }

    res.json({ song });
  })
);

// ── DELETE /api/songs/:id — move song to trash (soft delete) ─
songRoutes.delete(
  "/:id",
  auth,  orgContext,
  requireOrg,
  requirePermission("songs:edit"),  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, req.params.id))
      .limit(1);

    if (!existing) {
      throw createError(404, "Song not found");
    }

    await db
      .update(songs)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(songs.id, req.params.id));

    await logActivity(req, "song.trashed", { type: "song", id: req.params.id });
    res.json({ message: "Song moved to trash" });
  })
);

// ── DELETE /api/songs/:id/permanent — hard delete (admin) ────
songRoutes.delete(
  "/:id/permanent",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:delete_permanent"),
  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, req.params.id))
      .limit(1);

    if (!existing) {
      throw createError(404, "Song not found");
    }

    await db
      .update(songs)
      .set({ defaultVariationId: null, updatedAt: new Date() })
      .where(eq(songs.id, req.params.id));

    // Delete variations first
    await db
      .delete(songVariations)
      .where(eq(songVariations.songId, req.params.id));

    await db.delete(songs).where(eq(songs.id, req.params.id));

    res.json({ message: "Song permanently deleted" });
  })
);

// ── POST /api/songs/:id/restore — restore from trash ─────────
songRoutes.post(
  "/:id/restore",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const [song] = await db
      .update(songs)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(songs.id, req.params.id))
      .returning();

    if (!song) throw createError(404, "Song not found");

    res.json({ song });
  })
);

// ── POST /api/songs/:id/archive — archive song ───────────────
songRoutes.post(
  "/:id/archive",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const [song] = await db
      .update(songs)
      .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(songs.id, req.params.id))
      .returning();

    if (!song) throw createError(404, "Song not found");

    res.json({ song });
  })
);

// ── POST /api/songs/:id/unarchive — restore from archive ─────
songRoutes.post(
  "/:id/unarchive",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const [song] = await db
      .update(songs)
      .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
      .where(eq(songs.id, req.params.id))
      .returning();

    if (!song) throw createError(404, "Song not found");

    res.json({ song });
  })
);

// ── PATCH /api/songs/:id/status — set rehearsal status ───────
const SONG_STATUSES = ["ready", "needs_review", "in_rehearsal", "updated", "missing_chords"];

songRoutes.patch(
  "/:id/status",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (status !== null && !SONG_STATUSES.includes(status)) {
      throw createError(400, `status must be null or one of: ${SONG_STATUSES.join(", ")}`);
    }

    const [song] = await db
      .update(songs)
      .set({ status, updatedAt: new Date() })
      .where(eq(songs.id, req.params.id))
      .returning();

    if (!song) throw createError(404, "Song not found");

    res.json({ song });
  })
);

// ── POST /api/songs/:id/favorite — favorite (personal, any role) ─
songRoutes.post(
  "/:id/favorite",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    const [song] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, req.params.id))
      .limit(1);

    if (!song) throw createError(404, "Song not found");

    await db
      .insert(songFavorites)
      .values({ songId: req.params.id, userId: req.user.id })
      .onConflictDoNothing();

    res.status(201).json({ message: "Song favorited" });
  })
);

// ── DELETE /api/songs/:id/favorite — unfavorite ──────────────
songRoutes.delete(
  "/:id/favorite",
  auth,
  orgContext,
  requireOrg,
  asyncHandler(async (req, res) => {
    await db
      .delete(songFavorites)
      .where(and(eq(songFavorites.songId, req.params.id), eq(songFavorites.userId, req.user.id)));

    res.json({ message: "Song unfavorited" });
  })
);

// ── GET /api/songs/:id/setlists — setlists containing the song ─
songRoutes.get(
  "/:id/setlists",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({
        id: setlists.id,
        name: setlists.name,
        status: setlists.status,
        updatedAt: setlists.updatedAt,
      })
      .from(setlistSongs)
      .innerJoin(setlists, eq(setlistSongs.setlistId, setlists.id))
      .where(and(eq(setlistSongs.songId, req.params.id), isNull(setlists.deletedAt)))
      .orderBy(desc(setlists.updatedAt));

    // A song can appear multiple times in one setlist — dedupe
    const seen = new Set();
    const unique = rows.filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));

    res.json({ setlists: unique });
  })
);

// ── GET /api/songs/:id/history — get edit history ────────────
songRoutes.get(
  "/:id/history",
  auth,
  asyncHandler(async (req, res) => {
    const [song] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, req.params.id))
      .limit(1);

    if (!song) {
      throw createError(404, "Song not found");
    }

    const history = await db
      .select()
      .from(songEdits)
      .where(eq(songEdits.songId, req.params.id))
      .orderBy(desc(songEdits.createdAt))
      .limit(100);

    res.json({ history });
  })
);

// ── POST /api/songs/import/chrd — import from .chrd format ──
songRoutes.post(
  "/import/chrd/preview",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { filename, content: rawContent } = req.body;

    if (!rawContent) {
      throw createError(400, "Content is required");
    }

    const { chordProContent, metadata } = convertChrdToChordPro(filename, rawContent);
    res.status(200).json({ chordPro: chordProContent, metadata });
  })
);

songRoutes.post(
  "/import/chrd",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { filename, content: rawContent } = req.body;

    if (!rawContent) {
      throw createError(400, "Content is required");
    }

    const { title, chordProContent, metadata } = convertChrdToChordPro(filename, rawContent);

    const [song] = await db
      .insert(songs)
      .values({
        title,
        key: metadata.key || null,
        tempo: metadata.tempo || null,
        artist: metadata.artist || null,
        year: metadata.year || null,
        content: chordProContent,
        isDraft: metadata.isDraft ?? false,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    res.status(201).json({ song });
  })
);

// ── POST /api/songs/import/onsong — import from OnSong ───────
songRoutes.post(
  "/import/onsong/preview",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { filename, content: rawContent } = req.body;

    if (!rawContent) {
      throw createError(400, "Content is required");
    }

    const chordProContent = onSongToChordPro(rawContent);
    if (!chordProContent.trim()) {
      throw createError(400, "Imported OnSong/OpenSong content was empty");
    }

    const fallbackTitle = filename
      ? filename.replace(/\.(onsong|xml)$/i, "")
      : "Untitled";
    const metadata = parseImportedMetadata(chordProContent, fallbackTitle);

    res.status(200).json({ chordPro: chordProContent, metadata });
  })
);

songRoutes.post(
  "/import/onsong",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { filename, content: rawContent } = req.body;

    if (!rawContent) {
      throw createError(400, "Content is required");
    }

    const chordProContent = onSongToChordPro(rawContent);
    if (!chordProContent.trim()) {
      throw createError(400, "Imported OnSong/OpenSong content was empty");
    }

    const fallbackTitle = filename
      ? filename.replace(/\.(onsong|xml)$/i, "")
      : "Untitled";
    const { title, artist, key, tempo } = parseImportedMetadata(chordProContent, fallbackTitle);

    const [song] = await db
      .insert(songs)
      .values({
        title,
        artist,
        key,
        tempo,
        content: chordProContent,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    res.status(201).json({ song, chordPro: chordProContent });
  })
);

// ── POST /api/songs/import/pdf — import from PDF via PDF.co ──
songRoutes.post(
  "/import/pdf/preview",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createError(400, "A PDF file is required");
    }

    if (!env.PDF_CO_API_KEY) {
      throw createError(
        503,
        "PDF import is not available — PDF.co API key is not configured",
      );
    }

    const { chordPro, metadata: extractedMetadata } = await convertPdfToChordPro(req.file.buffer);

    if (!chordPro || !chordPro.trim()) {
      throw createError(
        422,
        "Could not extract usable content from the PDF. It may be scanned or image-based.",
      );
    }

    const fallbackTitle = extractedMetadata.title || req.file.originalname?.replace(/\.pdf$/i, "") || "Untitled (PDF Import)";
    const metadata = {
      ...parseImportedMetadata(chordPro, fallbackTitle),
      title: extractedMetadata.title || parseImportedMetadata(chordPro, fallbackTitle).title,
      artist: extractedMetadata.artist || parseImportedMetadata(chordPro, fallbackTitle).artist,
      key: extractedMetadata.key || parseImportedMetadata(chordPro, fallbackTitle).key,
      tempo: extractedMetadata.tempo || parseImportedMetadata(chordPro, fallbackTitle).tempo,
    };

    res.status(200).json({ chordPro, metadata });
  })
);

songRoutes.post(
  "/import/pdf",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw createError(400, "A PDF file is required");
    }

    if (!env.PDF_CO_API_KEY) {
      throw createError(
        503,
        "PDF import is not available — PDF.co API key is not configured",
      );
    }

    const pdfBuffer = req.file.buffer;

    // Run the 8-step conversion pipeline
    const { chordPro, metadata } = await convertPdfToChordPro(pdfBuffer);

    if (!chordPro || !chordPro.trim()) {
      throw createError(
        422,
        "Could not extract usable content from the PDF. It may be scanned or image-based.",
      );
    }

    // Save to database
    const [song] = await db
      .insert(songs)
      .values({
        title: metadata.title || "Untitled (PDF Import)",
        content: chordPro,
        key: metadata.key || null,
        tempo: metadata.tempo || null,
        artist: metadata.artist || null,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    res.status(201).json({ song, chordPro });
  })
);

// ── GET /api/songs/:id/export/chordpro — export as ChordPro ─
songRoutes.get(
  "/:id/export/chordpro",
  auth,
  asyncHandler(async (req, res) => {
    const target = await getSongExportTarget(req.params.id, req.query.variationId);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${target.title.replace(/[^a-zA-Z0-9 ]/g, "")}.chopro"`
    );
    res.send(target.content);
  })
);

// ── GET /api/songs/:id/export/onsong ─────────────────────────
songRoutes.get(
  "/:id/export/onsong",
  auth,
  asyncHandler(async (req, res) => {
    const target = await getSongExportTarget(req.params.id, req.query.variationId);

    const onsongText = chordProToOnSong(target.content);
    const safeName = target.title.replace(/[^a-zA-Z0-9 ]/g, "");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.onsong"`);
    res.send(onsongText);
  })
);

// ── GET /api/songs/:id/export/text ───────────────────────────
songRoutes.get(
  "/:id/export/text",
  auth,
  asyncHandler(async (req, res) => {
    const target = await getSongExportTarget(req.params.id, req.query.variationId);
    const lyricsOnly = req.query.lyricsOnly === "true";
    const text = chordProToPlainText(target.content, { lyricsOnly });
    const safeName = target.title.replace(/[^a-zA-Z0-9 ]/g, "");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}${lyricsOnly ? "-lyrics" : ""}.txt"`
    );
    res.send(text);
  })
);

// ── GET /api/songs/:id/export/pdf ────────────────────────────
songRoutes.get(
  "/:id/export/pdf",
  auth,
  asyncHandler(async (req, res) => {
    const target = await getSongExportTarget(req.params.id, req.query.variationId);

    const doc = parseChordPro(target.content);
    const metaHtml = [
      target.key ? `<span>Key: ${target.key}</span>` : "",
      target.artist ? `<span>Artist: ${target.artist}</span>` : "",
      target.tempo ? `<span>Tempo: ${target.tempo} BPM</span>` : "",
    ]
      .filter(Boolean)
      .join(" &middot; ");

    let bodyHtml = "";
    for (const section of doc.sections) {
      if (section.name) {
        bodyHtml += `<h3 style="font-weight:700;margin:16px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(section.name)}</h3>`;
      }
      for (const line of section.lines) {
        if (line.chords.length > 0) {
          // Build chord line and lyric line
          let chordLine = "";
          let lyricLine = "";
          let lyricPos = 0;
          const sorted = [...line.chords].sort((a, b) => a.position - b.position);
          for (const { chord, position } of sorted) {
            const gap = position - lyricPos;
            if (gap > 0) {
              chordLine += "\u00A0".repeat(gap);
              lyricLine += escapeHtml(line.lyrics.slice(lyricPos, position));
            }
            chordLine += `<b>${escapeHtml(chord)}</b>`;
            lyricPos = position;
          }
          lyricLine += escapeHtml(line.lyrics.slice(lyricPos));
          bodyHtml += `<div style="font-family:monospace;line-height:1.2"><div style="color:#ca9762">${chordLine || "&nbsp;"}</div><div>${lyricLine || "&nbsp;"}</div></div>`;
        } else {
          bodyHtml += `<div style="font-family:monospace;line-height:1.6">${escapeHtml(line.lyrics) || "&nbsp;"}</div>`;
        }
      }
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(target.title)}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  body { font-family: 'Inter','Segoe UI',sans-serif; font-size: 12px; color: #1a1a1a; }
  h1 { font-family: 'Vidaloka',Georgia,serif; font-size: 22px; margin:0 0 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head><body>
<h1>${escapeHtml(target.title)}</h1>
${metaHtml ? `<div class="meta">${metaHtml}</div>` : ""}
${bodyHtml}
<script>window.onload=function(){window.print()}</script>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  })
);

// ── POST /api/songs/:id/usage — log that a song was used ────
songRoutes.post(
  "/:id/usage",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { usedAt, notes } = req.body;

    if (!usedAt) throw createError(400, "usedAt date is required (YYYY-MM-DD)");

    // Verify song exists
    const [song] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, req.params.id))
      .limit(1);

    if (!song) throw createError(404, "Song not found");

    const [usage] = await db
      .insert(songUsages)
      .values({
        songId: req.params.id,
        usedAt,
        notes: notes || null,
        organizationId: req.org?.id || null,
        recordedBy: req.user.id,
      })
      .returning();

    res.status(201).json({ usage });
  })
);

// ── GET /api/songs/:id/usage — get usage history for a song ─
songRoutes.get(
  "/:id/usage",
  auth,
  asyncHandler(async (req, res) => {
    const usages = await db
      .select()
      .from(songUsages)
      .where(eq(songUsages.songId, req.params.id))
      .orderBy(desc(songUsages.usedAt));

    res.json({ usages });
  })
);

// ── DELETE /api/songs/:id/usage/:usageId — remove a usage entry
songRoutes.delete(
  "/:id/usage/:usageId",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: songUsages.id })
      .from(songUsages)
      .where(
        and(
          eq(songUsages.id, req.params.usageId),
          eq(songUsages.songId, req.params.id)
        )
      )
      .limit(1);

    if (!existing) throw createError(404, "Usage record not found");

    await db.delete(songUsages).where(eq(songUsages.id, req.params.usageId));

    res.json({ message: "Usage record deleted" });
  })
);

// ── Song Variations ──────────────────────────────────────────

// ── PATCH /api/songs/:id/default-variation — set default ────
songRoutes.patch(
  "/:id/default-variation",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { variationId = null } = req.body ?? {};

    const [song] = await db
      .select({
        id: songs.id,
        organizationId: songs.organizationId,
      })
      .from(songs)
      .where(eq(songs.id, req.params.id))
      .limit(1);

    if (!song) throw createError(404, "Song not found");
    if (song.organizationId && req.org.id !== song.organizationId) {
      throw createError(403, "You do not have access to this song");
    }

    if (variationId !== null) {
      const [variation] = await db
        .select({ id: songVariations.id })
        .from(songVariations)
        .where(
          and(
            eq(songVariations.id, variationId),
            eq(songVariations.songId, req.params.id)
          )
        )
        .limit(1);

      if (!variation) {
        throw createError(400, "Variation does not belong to this song");
      }
    }

    const [updatedSong] = await db
      .update(songs)
      .set({
        defaultVariationId: variationId,
        updatedAt: new Date(),
      })
      .where(eq(songs.id, req.params.id))
      .returning();

    res.json({ song: updatedSong });
  })
);

// ── POST /api/songs/:id/variations — create a variation ──────
songRoutes.post(
  "/:id/variations",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { name, content, key } = req.body;

    if (!name || !content) {
      throw createError(400, "Name and content are required");
    }

    // Verify parent song exists
    const [song] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, req.params.id))
      .limit(1);

    if (!song) throw createError(404, "Song not found");

    const [variation] = await db
      .insert(songVariations)
      .values({
        songId: req.params.id,
        name,
        content,
        key: key || null,
        createdBy: req.user.id,
      })
      .returning();

    res.status(201).json({ variation });
  })
);

// ── PUT /api/songs/:id/variations/:varId — update variation ──
songRoutes.put(
  "/:id/variations/:varId",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const { name, content, key } = req.body;

    const [existing] = await db
      .select({ id: songVariations.id })
      .from(songVariations)
      .where(
        and(
          eq(songVariations.id, req.params.varId),
          eq(songVariations.songId, req.params.id)
        )
      )
      .limit(1);

    if (!existing) throw createError(404, "Variation not found");

    const [variation] = await db
      .update(songVariations)
      .set({
        ...(name !== undefined && { name }),
        ...(content !== undefined && { content }),
        ...(key !== undefined && { key: key || null }),
        updatedAt: new Date(),
      })
      .where(eq(songVariations.id, req.params.varId))
      .returning();

    res.json({ variation });
  })
);

// ── DELETE /api/songs/:id/variations/:varId — delete variation
songRoutes.delete(
  "/:id/variations/:varId",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: songVariations.id })
      .from(songVariations)
      .where(
        and(
          eq(songVariations.id, req.params.varId),
          eq(songVariations.songId, req.params.id)
        )
      )
      .limit(1);

    if (!existing) throw createError(404, "Variation not found");

    await db
      .update(songs)
      .set({
        defaultVariationId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(songs.id, req.params.id),
          eq(songs.defaultVariationId, req.params.varId)
        )
      );

    await db.delete(songVariations).where(eq(songVariations.id, req.params.varId));

    res.json({ message: "Variation deleted" });
  })
);

/** Minimal HTML entity escaper for PDF template. */
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
