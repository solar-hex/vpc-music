/**
 * GET /songs/:id/media/:key — play or open one of a song's media files.
 *
 * Songs carry their media as custom ChordPro directives inside the chart text:
 * `{x_audio_soprano: https://…/soprano.mp3}`, `{x_chart_chord_chart: …pdf}`.
 * The bucket behind those URLs is private, so a browser cannot fetch them
 * directly — a plain `<audio src>` gets 403. This route checks the caller may
 * see the song, then answers 302 to a short-lived presigned URL.
 *
 * Why redirect rather than proxy: the bytes go browser-to-storage, so the
 * droplet never carries a 90 MB WAV, and range requests keep working, which
 * is what lets `<audio>` start playing before the whole file arrives.
 *
 * The media is addressed by its DIRECTIVE KEY. The server never classifies
 * parts; working out that `x_audio_speak_the_name_tenor_2` is a second tenor is
 * the browser's job, because only the browser draws buttons.
 */
import { Router } from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";
import { parseChordPro } from "@vpc-music/shared";
import { db } from "../../db.js";
import { songs } from "../../schema/index.js";
import { env } from "../../config/env.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext } from "../../middlewares/orgContext.js";
import { asyncHandler, createError } from "../../middlewares/errorHandler.js";
import { getClient, isObjectStoreConfigured } from "../../corpus/objectStore.js";

export const songMediaRoutes = Router();

/** Only media directives, and only characters a slug can contain. */
export const MEDIA_DIRECTIVE_KEY = /^x_(audio|chart)_[a-z0-9_]+$/;

/** Long enough to listen to a track and scrub it; short enough that a leaked link dies. */
export const SIGNED_URL_SECONDS = 15 * 60;

/**
 * The object key inside OUR bucket, or null when the URL points anywhere else.
 *
 * The URL comes out of song content, which people can edit, so it is untrusted
 * input. Signing whatever it names would let anyone with edit rights mint
 * signed links to any object this key pair can reach. It has to be our
 * endpoint, our bucket, and a key with no traversal.
 */
export function objectKeyFromUrl(url, config = env) {
  const endpoint = String(config.S3_ENDPOINT || "").replace(/\/+$/, "");
  const bucket = String(config.S3_BUCKET || "");
  const value = String(url || "").trim();
  if (!endpoint || !bucket) return null;
  const prefix = `${endpoint}/${bucket}/`;
  if (!value.startsWith(prefix)) return null;
  const key = value.slice(prefix.length).split(/[?#]/)[0];
  if (!key) return null;
  if (key.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  return key;
}

/**
 * Answer with a 302 to a short-lived signed URL for one media directive of a
 * chart, or throw the error the caller should see. The caller has already
 * decided the person may see the chart; this decides what may be signed.
 */
export async function redirectToSignedMedia(res, content, key) {
  const url = parseChordPro(content || "").directives?.[key];
  if (!url || !String(url).trim()) throw createError(404, "That song has no such media");

  const objectKey = objectKeyFromUrl(url);
  if (!objectKey) throw createError(400, "That media is not in the configured store");

  const signed = await getSignedUrl(getClient(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }), {
    expiresIn: SIGNED_URL_SECONDS,
  });

  // Never cache the redirect: the signed URL expires, and a cached 302 would
  // keep sending people to a dead link.
  res.set("Cache-Control", "private, no-store");
  res.redirect(302, signed);
}

songMediaRoutes.get(
  "/:id/media/:key",
  auth,
  // Resolves every membership. `<audio src>` cannot send X-Organization-Id,
  // so the org is checked against the song below rather than trusting a
  // header-selected `req.org`.
  orgContext,
  asyncHandler(async (req, res) => {
    const { id, key } = req.params;
    if (!MEDIA_DIRECTIVE_KEY.test(key)) throw createError(400, "Not a media reference");
    if (!isObjectStoreConfigured()) throw createError(503, "Media storage is not configured");

    const [song] = await db
      .select({ organizationId: songs.organizationId, content: songs.content })
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    // A song in another organization answers exactly like a missing one, so
    // the route does not confirm that an id exists.
    const canSee = song && (req.user?.role === "owner" || (req.orgs || []).some((o) => o.id === song.organizationId));
    if (!canSee) throw createError(404, "Song not found");

    await redirectToSignedMedia(res, song.content, key);
  }),
);
