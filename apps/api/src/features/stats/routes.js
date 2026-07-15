/**
 * Analytics endpoints (org-scoped).
 *
 *   GET /api/stats/overview   — plays over time, top songs, key/tempo
 *                               distribution, per-member logging counts
 *   GET /api/stats/songs/:id  — one song's plays-over-time + the events/
 *                               setlists it was actually played in (reads the
 *                               historical eventId/setlistId links)
 */
import { Router } from "express";
import { eq, and, or, ne, desc, sql, gte, isNull, isNotNull } from "drizzle-orm";
import { db } from "../../db.js";
import { songs, songUsages, users, events, setlists } from "../../schema/index.js";
import { createError, asyncHandler } from "../../middlewares/errorHandler.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg } from "../../middlewares/orgContext.js";

export const statsRoutes = Router();

statsRoutes.use(auth);
statsRoutes.use(orgContext);
statsRoutes.use(requireOrg);

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

// ── GET /stats/overview ──────────────────────────────────────
statsRoutes.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const since = monthsAgo(11); // current month + 11 back = 12 buckets

    const playsByMonth = await db
      .select({
        month: sql`to_char(date_trunc('month', ${songUsages.usedAt}), 'YYYY-MM')`.as("month"),
        plays: sql`count(*)::int`.as("plays"),
      })
      .from(songUsages)
      .where(and(eq(songUsages.organizationId, req.org.id), gte(songUsages.usedAt, since)))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const topSongs = await db
      .select({
        id: songs.id,
        title: songs.title,
        plays: sql`count(*)::int`.as("plays"),
        lastPlayed: sql`max(${songUsages.usedAt})`.as("last_played"),
      })
      .from(songUsages)
      .innerJoin(songs, eq(songUsages.songId, songs.id))
      .where(eq(songUsages.organizationId, req.org.id))
      .groupBy(songs.id, songs.title)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const liveSongFilter = and(
      eq(songs.organizationId, req.org.id),
      isNull(songs.deletedAt),
      eq(songs.isArchived, false),
    );

    const keyDistribution = await db
      .select({
        key: songs.key,
        count: sql`count(*)::int`.as("count"),
      })
      .from(songs)
      .where(and(liveSongFilter, isNotNull(songs.key)))
      .groupBy(songs.key)
      .orderBy(desc(sql`count(*)`));

    // Named tempo bands beat raw BPM buckets for a quick library read.
    const tempoDistribution = await db
      .select({
        band: sql`CASE
          WHEN ${songs.tempo} < 70 THEN 'Slow (<70)'
          WHEN ${songs.tempo} < 100 THEN 'Moderate (70-99)'
          WHEN ${songs.tempo} < 130 THEN 'Upbeat (100-129)'
          ELSE 'Fast (130+)' END`.as("band"),
        count: sql`count(*)::int`.as("count"),
      })
      .from(songs)
      .where(and(liveSongFilter, isNotNull(songs.tempo)))
      .groupBy(sql`1`)
      .orderBy(sql`min(${songs.tempo})`);

    const memberActivity = await db
      .select({
        userId: songUsages.recordedBy,
        name: users.displayName,
        plays: sql`count(*)::int`.as("plays"),
      })
      .from(songUsages)
      .leftJoin(users, eq(songUsages.recordedBy, users.id))
      .where(and(eq(songUsages.organizationId, req.org.id), isNotNull(songUsages.recordedBy)))
      .groupBy(songUsages.recordedBy, users.displayName)
      .orderBy(desc(sql`count(*)`))
      .limit(8);

    const [totals] = await db
      .select({
        totalPlays: sql`count(*)::int`.as("total_plays"),
        songsPlayed: sql`count(distinct ${songUsages.songId})::int`.as("songs_played"),
      })
      .from(songUsages)
      .where(eq(songUsages.organizationId, req.org.id));

    res.json({
      playsByMonth,
      topSongs,
      keyDistribution,
      tempoDistribution,
      memberActivity,
      totals: totals ?? { totalPlays: 0, songsPlayed: 0 },
    });
  }),
);

// ── GET /stats/songs/:id ─────────────────────────────────────
statsRoutes.get(
  "/songs/:id",
  asyncHandler(async (req, res) => {
    // Own-org songs (personal ones only for their creator) or global songs.
    const [song] = await db
      .select({ id: songs.id, title: songs.title })
      .from(songs)
      .where(
        and(
          eq(songs.id, req.params.id),
          or(
            eq(songs.tier, "global"),
            and(
              eq(songs.organizationId, req.org.id),
              or(ne(songs.tier, "personal"), eq(songs.createdBy, req.user.id)),
            ),
          ),
        ),
      )
      .limit(1);

    if (!song) throw createError(404, "Song not found");

    const since = monthsAgo(11);
    const playsByMonth = await db
      .select({
        month: sql`to_char(date_trunc('month', ${songUsages.usedAt}), 'YYYY-MM')`.as("month"),
        plays: sql`count(*)::int`.as("plays"),
      })
      .from(songUsages)
      .where(
        and(
          eq(songUsages.songId, req.params.id),
          eq(songUsages.organizationId, req.org.id),
          gte(songUsages.usedAt, since),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    // The historical record: where this song was ACTUALLY played, surviving
    // setlist/event deletion (links null out; the play row remains).
    const performances = await db
      .select({
        id: songUsages.id,
        usedAt: songUsages.usedAt,
        source: songUsages.source,
        notes: songUsages.notes,
        eventTitle: events.title,
        eventId: songUsages.eventId,
        setlistName: setlists.name,
        setlistId: songUsages.setlistId,
      })
      .from(songUsages)
      .leftJoin(events, eq(songUsages.eventId, events.id))
      .leftJoin(setlists, eq(songUsages.setlistId, setlists.id))
      .where(and(eq(songUsages.songId, req.params.id), eq(songUsages.organizationId, req.org.id)))
      .orderBy(desc(songUsages.usedAt))
      .limit(100);

    res.json({ song, playsByMonth, performances });
  }),
);
