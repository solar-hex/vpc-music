import { Router } from "express";
import { eq, and, desc, asc, sql, isNull, isNotNull } from "drizzle-orm";
import { db } from "../../db.js";
import { setlists, setlistSongs, songs, songUsages, songVariations, events } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requireOrgRole, requirePermission } from "../../middlewares/orgContext.js";
import { chordProToOnSong, chordProToPlainText } from "@vpc-music/shared";
import JSZip from "jszip";
import { notifyOrgMembers } from "../notifications/service.js";
import { logActivity } from "../activity/service.js";

export const setlistRoutes = Router();

function hasDirective(content, key) {
  return new RegExp(`^\\{(?:${key}):\\s*.*?\\}$`, "im").test(content);
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

// ── GET /api/setlists — list setlists ────────────────────────
// ?view=active (default) | archived | trash | all
setlistRoutes.get(
  "/",
  auth,
  orgContext,
  asyncHandler(async (req, res) => {
    const view = String(req.query.view || "active");
    if (!["active", "archived", "trash", "all"].includes(view)) {
      throw createError(400, "view must be active, archived, trash, or all");
    }

    let query = db
      .select({
        id: setlists.id,
        name: setlists.name,
        category: setlists.category,
        notes: setlists.notes,
        status: setlists.status,
        leader: setlists.leader,
        tags: setlists.tags,
        isArchived: setlists.isArchived,
        archivedAt: setlists.archivedAt,
        deletedAt: setlists.deletedAt,
        createdAt: setlists.createdAt,
        updatedAt: setlists.updatedAt,
        // Each subquery below correlates back to the outer row via an
        // explicitly qualified "setlists"."id" — NOT a ${setlists.id}
        // interpolation. Drizzle renders that interpolation as a bare "id"
        // here (since the outer query's sole top-level FROM is `setlists`,
        // so it looks unambiguous from the outer query's own perspective),
        // but each of these subqueries introduces its own setlist_songs/
        // songs tables into scope, both of which also have an "id" column.
        // With a join (averageBpm/keys) that's a real ambiguous-column SQL
        // error; without a join (songCount/totalDuration) it's worse — no
        // error, just a silent wrong-column match against the row's own id
        // instead of the intended correlation, corrupting the aggregate.
        songCount: sql`(SELECT count(*) FROM setlist_songs WHERE setlist_songs.setlist_id = "setlists"."id")::int`,
        totalDuration: sql`(SELECT coalesce(sum(duration), 0) FROM setlist_songs WHERE setlist_songs.setlist_id = "setlists"."id")::int`,
        averageBpm: sql`(SELECT round(avg(songs.tempo)) FROM setlist_songs JOIN songs ON songs.id = setlist_songs.song_id WHERE setlist_songs.setlist_id = "setlists"."id" AND songs.tempo IS NOT NULL)::int`,
        keys: sql`(SELECT string_agg(DISTINCT coalesce(setlist_songs.key, songs.key), ',') FROM setlist_songs JOIN songs ON songs.id = setlist_songs.song_id WHERE setlist_songs.setlist_id = "setlists"."id")`,
      })
      .from(setlists);

    const conditions = [];
    if (req.org) {
      conditions.push(eq(setlists.organizationId, req.org.id));
    }
    if (view === "active") {
      conditions.push(eq(setlists.isArchived, false), isNull(setlists.deletedAt));
    } else if (view === "archived") {
      conditions.push(eq(setlists.isArchived, true), isNull(setlists.deletedAt));
    } else if (view === "trash") {
      conditions.push(isNotNull(setlists.deletedAt));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const result = await query.orderBy(desc(setlists.updatedAt));

    res.json({ setlists: result });
  })
);

// ── GET /api/setlists/:id — get setlist with songs ───────────
setlistRoutes.get(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const [setlist] = await db
      .select()
      .from(setlists)
      .where(eq(setlists.id, req.params.id))
      .limit(1);

    if (!setlist) throw createError(404, "Setlist not found");

    // Get songs in order (left join: template slots have no song yet)
    const items = await db
      .select({
        id: setlistSongs.id,
        songId: setlistSongs.songId,
        slotLabel: setlistSongs.slotLabel,
        variationId: setlistSongs.variationId,
        variationName: songVariations.name,
        position: setlistSongs.position,
        key: setlistSongs.key,
        notes: setlistSongs.notes,
        duration: setlistSongs.duration,
        capo: setlistSongs.capo,
        arrangement: setlistSongs.arrangement,
        transitionCues: setlistSongs.transitionCues,
        talkSeconds: setlistSongs.talkSeconds,
        songTitle: songs.title,
        songKey: songs.key,
        songArtist: songs.artist,
        songTempo: songs.tempo,
        songDurationSeconds: songs.durationSeconds,
        songEnergy: songs.energy,
        songStatus: songs.status,
      })
      .from(setlistSongs)
      .leftJoin(songs, eq(setlistSongs.songId, songs.id))
      .leftJoin(songVariations, eq(setlistSongs.variationId, songVariations.id))
      .where(eq(setlistSongs.setlistId, req.params.id))
      .orderBy(asc(setlistSongs.position));

    res.json({ setlist, songs: items });
  })
);

// ── GET /api/setlists/:id/export/zip — export whole setlist ─
setlistRoutes.get(
  "/:id/export/zip",
  auth,
  asyncHandler(async (req, res) => {
    const format = String(req.query.format || "chordpro").toLowerCase();
    if (!["chordpro", "onsong", "text"].includes(format)) {
      throw createError(400, "format must be chordpro, onsong, or text");
    }

    const [setlist] = await db
      .select({
        id: setlists.id,
        name: setlists.name,
        notes: setlists.notes,
      })
      .from(setlists)
      .where(eq(setlists.id, req.params.id))
      .limit(1);

    if (!setlist) throw createError(404, "Setlist not found");

    const items = await db
      .select({
        position: setlistSongs.position,
        itemKey: setlistSongs.key,
        songId: songs.id,
        songTitle: songs.title,
        songArtist: songs.artist,
        songTempo: songs.tempo,
        songKey: songs.key,
        songContent: songs.content,
        variationId: songVariations.id,
        variationName: songVariations.name,
        variationKey: songVariations.key,
        variationContent: songVariations.content,
      })
      .from(setlistSongs)
      .innerJoin(songs, eq(setlistSongs.songId, songs.id))
      .leftJoin(songVariations, eq(setlistSongs.variationId, songVariations.id))
      .where(eq(setlistSongs.setlistId, req.params.id))
      .orderBy(asc(setlistSongs.position));

    if (items.length === 0) {
      throw createError(400, "Setlist has no songs to export");
    }

    const zip = new JSZip();
    const manifestLines = [
      `Setlist: ${setlist.name}`,
      `Format: ${format}`,
      `Songs: ${items.length}`,
      "",
    ];

    for (const item of items) {
      const target = buildExportContent(
        {
          title: item.songTitle,
          content: item.songContent,
          key: item.itemKey || item.songKey,
          artist: item.songArtist,
          tempo: item.songTempo,
        },
        item.variationId
          ? {
              id: item.variationId,
              name: item.variationName,
              content: item.variationContent,
              key: item.itemKey || item.variationKey,
            }
          : null,
      );

      const converted = convertExportContent(target, format);
      const fileName = `${String(item.position + 1).padStart(2, "0")} - ${sanitizeFilename(target.title)}.${converted.extension}`;
      zip.file(fileName, converted.content);
      manifestLines.push(`${item.position + 1}. ${target.title}`);
    }

    if (setlist.notes) {
      manifestLines.push("", `Notes: ${setlist.notes}`);
    }

    zip.file("00 - Setlist Info.txt", manifestLines.join("\n"));

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    const safeSetlistName = sanitizeFilename(setlist.name);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeSetlistName}-${format}.zip"`);
    res.send(buffer);
  })
);

// ── POST /api/setlists — create setlist ──────────────────────
setlistRoutes.post(
  "/",
  auth,
  orgContext,
  requireOrg,  requirePermission("setlists:edit"),  asyncHandler(async (req, res) => {
    const { name, category, notes, leader, tags } = req.body;

    if (!name) throw createError(400, "Name is required");

    const [setlist] = await db
      .insert(setlists)
      .values({
        name,
        category: category || null,
        notes: notes || null,
        leader: leader || null,
        tags: tags || null,
        organizationId: req.org.id,
        createdBy: req.user.id,
      })
      .returning();

    await logActivity(req, "setlist.created", { type: "setlist", id: setlist.id, label: setlist.name });
    res.status(201).json({ setlist });
  })
);

// ── PUT /api/setlists/:id — update setlist ───────────────────
setlistRoutes.put(
  "/:id",
  auth,  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),  asyncHandler(async (req, res) => {
    const { name, category, notes, status, leader, tags } = req.body;

    const [existing] = await db
      .select({ id: setlists.id })
      .from(setlists)
      .where(eq(setlists.id, req.params.id))
      .limit(1);

    if (!existing) throw createError(404, "Setlist not found");

    // "approved" only via POST /:id/approve; "complete" also via /complete
    if (status !== undefined && !['draft', 'in_review', 'complete'].includes(status)) {
      throw createError(400, "Status must be 'draft', 'in_review', or 'complete'");
    }

    const [setlist] = await db
      .update(setlists)
      .set({
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
        ...(leader !== undefined && { leader }),
        ...(tags !== undefined && { tags }),
        updatedAt: new Date(),
      })
      .where(eq(setlists.id, req.params.id))
      .returning();

    res.json({ setlist });
  })
);

// ── POST /api/setlists/:id/approve — approve a reviewed setlist ─
setlistRoutes.post(
  "/:id/approve",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:approve"),
  asyncHandler(async (req, res) => {
    const [setlist] = await db
      .update(setlists)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id))
      .returning();

    if (!setlist) throw createError(404, "Setlist not found");

    await notifyOrgMembers(
      req.org.id,
      {
        type: "setlist",
        title: "Setlist approved",
        message: `"${setlist.name}" is approved and ready.`,
        linkPath: `/setlists/${req.params.id}`,
      },
      { excludeUserId: req.user.id },
    );
    await logActivity(req, "setlist.approved", { type: "setlist", id: setlist.id, label: setlist.name });

    res.json({ setlist });
  })
);

// ── POST /api/setlists/:id/archive — archive a setlist ──────
setlistRoutes.post(
  "/:id/archive",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const [setlist] = await db
      .update(setlists)
      .set({ isArchived: true, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id))
      .returning();

    if (!setlist) throw createError(404, "Setlist not found");

    res.json({ setlist });
  })
);

// ── POST /api/setlists/:id/unarchive — restore from archive ─
setlistRoutes.post(
  "/:id/unarchive",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const [setlist] = await db
      .update(setlists)
      .set({ isArchived: false, archivedAt: null, updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id))
      .returning();

    if (!setlist) throw createError(404, "Setlist not found");

    res.json({ setlist });
  })
);

// ── DELETE /api/setlists/:id — move to trash (soft delete) ──
setlistRoutes.delete(
  "/:id",
  auth,  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: setlists.id })
      .from(setlists)
      .where(eq(setlists.id, req.params.id))
      .limit(1);

    if (!existing) throw createError(404, "Setlist not found");

    await db
      .update(setlists)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id));

    res.json({ message: "Setlist moved to trash" });
  })
);

// ── POST /api/setlists/:id/restore — restore from trash ─────
setlistRoutes.post(
  "/:id/restore",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const [setlist] = await db
      .update(setlists)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id))
      .returning();

    if (!setlist) throw createError(404, "Setlist not found");

    res.json({ setlist });
  })
);

// ── DELETE /api/setlists/:id/permanent — hard delete (admin) ─
setlistRoutes.delete(
  "/:id/permanent",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:delete_permanent"),
  asyncHandler(async (req, res) => {
    const [existing] = await db
      .select({ id: setlists.id })
      .from(setlists)
      .where(eq(setlists.id, req.params.id))
      .limit(1);

    if (!existing) throw createError(404, "Setlist not found");

    // Unlink events referencing this setlist before deleting (FK)
    await db.update(events).set({ setlistId: null }).where(eq(events.setlistId, req.params.id));
    await db.delete(setlistSongs).where(eq(setlistSongs.setlistId, req.params.id));
    await db.delete(setlists).where(eq(setlists.id, req.params.id));

    res.json({ message: "Setlist permanently deleted" });
  })
);

// ── POST /api/setlists/:id/songs — add song to setlist ──────
setlistRoutes.post(
  "/:id/songs",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const { songId, variationId, key, notes } = req.body;

    if (!songId) throw createError(400, "songId is required");

    let selectedVariation = null;
    if (variationId) {
      [selectedVariation] = await db
        .select({
          id: songVariations.id,
          songId: songVariations.songId,
          name: songVariations.name,
          key: songVariations.key,
        })
        .from(songVariations)
        .where(eq(songVariations.id, variationId))
        .limit(1);

      if (!selectedVariation || selectedVariation.songId !== songId) {
        throw createError(400, "Variation does not belong to the selected song");
      }
    }

    // Get next position
    const [{ maxPos }] = await db
      .select({ maxPos: sql`coalesce(max(${setlistSongs.position}), 0)::int` })
      .from(setlistSongs)
      .where(eq(setlistSongs.setlistId, req.params.id));

    const [item] = await db
      .insert(setlistSongs)
      .values({
        setlistId: req.params.id,
        songId,
        variationId: selectedVariation?.id || null,
        position: maxPos + 1,
        key: key || selectedVariation?.key || null,
        notes: notes || (selectedVariation ? `Variation: ${selectedVariation.name}` : null),
      })
      .returning();

    res.status(201).json({ item });
  })
);

// ── PUT /api/setlists/:id/songs — reorder songs ─────────────
setlistRoutes.put(
  "/:id/songs",
  auth,  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),  asyncHandler(async (req, res) => {
    const { order } = req.body; // Array of { id, position }

    if (!Array.isArray(order)) {
      throw createError(400, "order must be an array of { id, position }");
    }

    for (const { id, position } of order) {
      await db
        .update(setlistSongs)
        .set({ position })
        .where(eq(setlistSongs.id, id));
    }

    await db
      .update(setlists)
      .set({ updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id));

    res.json({ message: "Order updated" });
  })
);

// ── PATCH /api/setlists/:id/songs/:songItemId — update one item ─
// Per-item performance metadata: key override, notes, duration, capo,
// arrangement, and transition cues.
const ARRANGEMENTS = ["ACOUSTIC", "ELECTRIC", "FULL_BAND", "STRIPPED_DOWN"];
const CUE_TYPES = ["SPEAKING", "PRAYER", "INSTRUMENTAL", "COUNTDOWN", "SPONTANEOUS", "NOTE"];

function sanitizeTransitionCues(cues) {
  if (cues === null) return null;
  if (!Array.isArray(cues)) return undefined;
  return cues
    .filter((cue) => cue && typeof cue === "object" && CUE_TYPES.includes(cue.type))
    .map((cue) => ({
      type: cue.type,
      ...(typeof cue.text === "string" && cue.text.trim() ? { text: cue.text.trim() } : {}),
      ...(Number.isFinite(Number(cue.durationSec)) && Number(cue.durationSec) > 0
        ? { durationSec: Math.round(Number(cue.durationSec)) }
        : {}),
    }));
}

setlistRoutes.patch(
  "/:id/songs/:songItemId",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const { key, notes, duration, capo, arrangement, transitionCues, songId, talkSeconds } = req.body;

    if (arrangement !== undefined && arrangement !== null && !ARRANGEMENTS.includes(arrangement)) {
      throw createError(400, `arrangement must be one of: ${ARRANGEMENTS.join(", ")}`);
    }
    if (capo !== undefined && capo !== null && (!Number.isInteger(capo) || capo < 0 || capo > 12)) {
      throw createError(400, "capo must be an integer between 0 and 12");
    }
    const sanitizedCues = sanitizeTransitionCues(transitionCues);

    const [item] = await db
      .update(setlistSongs)
      .set({
        ...(key !== undefined && { key: key || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(duration !== undefined && { duration: duration || null }),
        ...(capo !== undefined && { capo }),
        ...(arrangement !== undefined && { arrangement }),
        ...(sanitizedCues !== undefined && { transitionCues: sanitizedCues }),
        // Fill (or clear) a template slot's song
        ...(songId !== undefined && { songId: songId || null }),
        ...(talkSeconds !== undefined && {
          talkSeconds: Number.isFinite(Number(talkSeconds)) && Number(talkSeconds) >= 0 ? Math.round(Number(talkSeconds)) : 0,
        }),
      })
      .where(and(eq(setlistSongs.id, req.params.songItemId), eq(setlistSongs.setlistId, req.params.id)))
      .returning();

    if (!item) throw createError(404, "Setlist song not found");

    await db
      .update(setlists)
      .set({ updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id));

    res.json({ item });
  })
);

// ── DELETE /api/setlists/:id/songs/:songItemId — remove song ─
setlistRoutes.delete(
  "/:id/songs/:songItemId",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    await db
      .delete(setlistSongs)
      .where(eq(setlistSongs.id, req.params.songItemId));

    res.json({ message: "Song removed from setlist" });
  })
);

// ── POST /api/setlists/:id/complete — mark setlist complete & log song usages
setlistRoutes.post(
  "/:id/complete",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const { usedAt } = req.body; // optional date string (defaults to today)
    const usedDate = usedAt || new Date().toISOString().split("T")[0];

    const [existing] = await db
      .select()
      .from(setlists)
      .where(eq(setlists.id, req.params.id))
      .limit(1);

    if (!existing) throw createError(404, "Setlist not found");

    // Mark setlist as complete
    const [setlist] = await db
      .update(setlists)
      .set({ status: "complete", updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id))
      .returning();

    // Log usage for every song in the setlist
    const setlistItems = await db
      .select({ songId: setlistSongs.songId })
      .from(setlistSongs)
      .where(eq(setlistSongs.setlistId, req.params.id));

    if (setlistItems.length > 0) {
      await db.insert(songUsages).values(
        setlistItems.map((item) => ({
          songId: item.songId,
          usedAt: usedDate,
          notes: `Setlist: ${existing.name}`,
          organizationId: req.org?.id || existing.organizationId,
          recordedBy: req.user.id,
        }))
      );
    }

    await notifyOrgMembers(
      req.org.id,
      {
        type: "setlist",
        title: "Setlist completed",
        message: `"${existing.name}" was marked complete.`,
        linkPath: `/setlists/${req.params.id}`,
      },
      { excludeUserId: req.user.id },
    );

    res.json({ setlist, usagesLogged: setlistItems.length });
  })
);

// ── POST /api/setlists/:id/reopen — revert setlist to draft ─
setlistRoutes.post(
  "/:id/reopen",
  auth,
  orgContext,
  requireOrg,
  requirePermission("setlists:edit"),
  asyncHandler(async (req, res) => {
    const [setlist] = await db
      .update(setlists)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(setlists.id, req.params.id))
      .returning();

    if (!setlist) throw createError(404, "Setlist not found");

    res.json({ setlist });
  })
);
