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
 *
 * POST /songs/:id/media/uploads — a signed link to upload one file for a song.
 *
 * Uploads go browser-to-storage for the same reason playback does: nginx and
 * the Vercel proxy in front of the API refuse bodies over a megabyte, and a
 * 90 MB WAV has no business passing through the droplet anyway. The server
 * decides the object key, so a person can only ever add a new file under the
 * song's own folder, never overwrite one. The browser then writes the returned
 * URL into the chart as a directive and the chart saves as usual, so the file
 * belongs to the song the same way the corpus media does.
 */
import { Router } from "express";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, isNull } from "drizzle-orm";
import { parseChordPro } from "@vpc-music/shared";
import { db } from "../../db.js";
import { songs } from "../../schema/index.js";
import { env } from "../../config/env.js";
import { auth } from "../../middlewares/auth.js";
import { orgContext, requireOrg, requirePermission } from "../../middlewares/orgContext.js";
import { asyncHandler, createError } from "../../middlewares/errorHandler.js";
import { contentTypeFor, getClient, isObjectStoreConfigured, withRoot } from "../../corpus/objectStore.js";
import { slugifyTitle } from "../../corpus/identity.js";

export const songMediaRoutes = Router();

/** Only media directives, and only characters a slug can contain. */
export const MEDIA_DIRECTIVE_KEY = /^x_(audio|chart|file)_[a-z0-9_]+$/;

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

/**
 * The files a song is asked for by name in the editor, and where each goes.
 * Anything else is an "other file" (`x_file_<name>`), listed on its own and
 * stored in the folder for its kind. Charts stay one per kind, because the
 * corpus carries piles of song-name-prefixed duplicates under `x_chart_`.
 */
export const MEDIA_SLOTS = {
  soprano: "audio",
  alto: "audio",
  tenor: "audio",
  baritone: "audio",
  bass: "audio",
  full_mix: "audio",
  instrumental: "audio",
  click: "audio",
  chord_chart: "chart",
  number_chart: "chart",
  rhythm_chart: "chart",
  vocals: "chart",
};

/** What people can attach, by extension. No HTML, SVG or scripts: nothing that runs when opened. */
export const UPLOAD_KINDS = {
  audio: [".mp3", ".m4a", ".wav", ".aac", ".ogg", ".flac", ".aif", ".aiff"],
  chart: [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
  file: [".docx", ".doc", ".txt", ".chopro", ".mp4", ".m4v", ".mov", ".mid"],
};

/** Big enough for the longest WAV in the library (94 MB), with room to spare. */
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
export const UPLOAD_URL_SECONDS = 15 * 60;

const FOLDERS = { audio: "audio", chart: "charts", file: "files" };

function extensionOf(filename) {
  const match = String(filename || "").toLowerCase().match(/\.[a-z0-9]{1,6}$/);
  return match ? match[0] : "";
}

function kindOfExtension(ext) {
  return Object.keys(UPLOAD_KINDS).find((kind) => UPLOAD_KINDS[kind].includes(ext)) ?? null;
}

/** A directive-safe name from a filename: "Alto Part (v2).mp3" -> "alto_part_v2". */
export function directiveName(filename) {
  return String(filename || "")
    .replace(/\.[a-z0-9]{1,6}$/i, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "") || "file";
}

songMediaRoutes.post(
  "/:id/media/uploads",
  auth,
  orgContext,
  requireOrg,
  requirePermission("songs:edit"),
  asyncHandler(async (req, res) => {
    if (!isObjectStoreConfigured()) throw createError(503, "Media storage is not configured");
    const { slot, filename, size } = req.body ?? {};

    const ext = extensionOf(filename);
    const kind = kindOfExtension(ext);
    if (!kind) throw createError(400, "That kind of file can't be attached. Use audio, a PDF or image, or a document.");
    if (!Number.isFinite(Number(size)) || Number(size) <= 0) throw createError(400, "The file is empty");
    if (Number(size) > MAX_UPLOAD_BYTES) throw createError(400, "That file is too big. The limit is 250 MB.");

    let directive;
    if (slot !== undefined && slot !== null && slot !== "") {
      const slotKind = Object.hasOwn(MEDIA_SLOTS, slot) ? MEDIA_SLOTS[slot] : null;
      if (!slotKind) throw createError(400, "Not a file this song can be asked for");
      if (slotKind !== kind) {
        throw createError(400, slotKind === "audio" ? "That part needs an audio file" : "That chart needs a PDF or an image");
      }
      directive = `x_${slotKind}_${slot}`;
    } else {
      directive = `x_file_${directiveName(filename)}`;
    }

    const [song] = await db
      .select({ id: songs.id, title: songs.title })
      .from(songs)
      .where(and(eq(songs.id, req.params.id), eq(songs.organizationId, req.org.id), isNull(songs.deletedAt)))
      .limit(1);
    if (!song) throw createError(404, "Song not found");

    // A new name every time: an upload never replaces a file something else
    // may still point at. Replacing a part is the chart pointing somewhere new.
    const leaf = (slot ? String(slot) : directiveName(filename)).replace(/_/g, "-");
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const key = withRoot(`media/songs/${slugifyTitle(song.title)}--${song.id.slice(0, 8)}/${FOLDERS[kind]}/${leaf}-${stamp}${ext}`);
    const contentType = contentTypeFor(`x${ext}`);

    const uploadUrl = await getSignedUrl(
      getClient(),
      new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_SECONDS },
    );

    res.set("Cache-Control", "private, no-store");
    res.json({
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": contentType },
      url: `${String(env.S3_ENDPOINT).replace(/\/+$/, "")}/${env.S3_BUCKET}/${key}`,
      directive,
      kind,
    });
  }),
);
