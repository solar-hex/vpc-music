/**
 * AI assistant service — Anthropic tool-use loop over the org's real data.
 *
 * The tool list is filtered server-side by org role: observers only get
 * read-only tools; admins/musicians can also create songs, setlists, and
 * events. Every tool executes with the caller's user/org context.
 */
import { eq, and, ilike, gte, asc, desc, sql } from "drizzle-orm";
import { db } from "../../db.js";
import { songs, setlists, setlistSongs, events } from "../../schema/index.js";
import { env } from "../../config/env.js";

const MODEL = "claude-opus-4-8";
const MAX_ITERATIONS = 6;
const MAX_HISTORY_MESSAGES = 30;

// ── Tool definitions ─────────────────────────────────────────

const READ_TOOLS = [
  {
    name: "search_songs",
    description: "Search the organization's song library by title, artist, or tags. Returns up to 10 matches with id, title, artist, key, and tempo.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text (title, artist, or tag)" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_upcoming_events",
    description: "List the organization's upcoming events (services and rehearsals) with dates, locations, and linked setlists.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_setlists",
    description: "List the organization's active setlists with song counts.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

const WRITE_TOOLS = [
  {
    name: "create_song",
    description: "Create a new song in the library. Content is ChordPro format; a minimal placeholder is used when omitted.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        artist: { type: "string" },
        key: { type: "string", description: "Musical key, e.g. G or Bb" },
        tempo: { type: "integer", description: "BPM" },
        content: { type: "string", description: "ChordPro source" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "create_setlist",
    description: "Create a new setlist, optionally adding existing songs by title (fuzzy matched against the library).",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        category: { type: "string" },
        songTitles: { type: "array", items: { type: "string" }, description: "Titles of existing songs to add, in order" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "create_event",
    description: "Schedule an event (service or rehearsal). Date must be ISO 8601.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "ISO 8601 date/time" },
        location: { type: "string" },
        theme: { type: "string" },
      },
      required: ["title", "date"],
      additionalProperties: false,
    },
  },
];

export function toolsForRole(orgRole, globalRole) {
  const canWrite = globalRole === "owner" || orgRole === "admin" || orgRole === "musician";
  return canWrite ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
}

// ── Tool execution ───────────────────────────────────────────

async function executeTool(name, input, ctx) {
  switch (name) {
    case "search_songs": {
      const query = String(input.query || "").trim();
      const rows = await db
        .select({ id: songs.id, title: songs.title, artist: songs.artist, key: songs.key, tempo: songs.tempo })
        .from(songs)
        .where(
          and(
            eq(songs.organizationId, ctx.orgId),
            sql`${songs.deletedAt} IS NULL`,
            query
              ? sql`(${ilike(songs.title, `%${query}%`)} OR ${ilike(songs.artist, `%${query}%`)} OR ${ilike(songs.tags, `%${query}%`)})`
              : sql`true`,
          ),
        )
        .orderBy(asc(songs.title))
        .limit(10);
      return { songs: rows };
    }

    case "list_upcoming_events": {
      const rows = await db
        .select({ id: events.id, title: events.title, date: events.date, location: events.location, theme: events.theme, setlistId: events.setlistId })
        .from(events)
        .where(and(eq(events.organizationId, ctx.orgId), gte(events.date, new Date())))
        .orderBy(asc(events.date))
        .limit(20);
      return { events: rows };
    }

    case "list_setlists": {
      const rows = await db
        .select({
          id: setlists.id,
          name: setlists.name,
          category: setlists.category,
          status: setlists.status,
          // Explicitly qualified — see features/setlists/routes.js for why
          // ${setlists.id} interpolation here would silently zero every
          // count instead of correlating to the outer row.
          songCount: sql`(SELECT count(*) FROM setlist_songs WHERE setlist_songs.setlist_id = "setlists"."id")::int`,
        })
        .from(setlists)
        .where(and(eq(setlists.organizationId, ctx.orgId), eq(setlists.isArchived, false), sql`${setlists.deletedAt} IS NULL`))
        .orderBy(desc(setlists.updatedAt))
        .limit(20);
      return { setlists: rows };
    }

    case "create_song": {
      const title = String(input.title || "").trim();
      if (!title) return { error: "Title is required" };
      const [song] = await db
        .insert(songs)
        .values({
          title,
          artist: input.artist || null,
          key: input.key || null,
          tempo: Number.isInteger(input.tempo) ? input.tempo : null,
          content: input.content || `{title: ${title}}\n\n[Verse 1]\n`,
          organizationId: ctx.orgId,
          createdBy: ctx.userId,
        })
        .returning();
      return { created: true, song: { id: song.id, title: song.title }, linkPath: `/songs/${song.id}` };
    }

    case "create_setlist": {
      const name = String(input.name || "").trim();
      if (!name) return { error: "Name is required" };
      const [setlist] = await db
        .insert(setlists)
        .values({ name, category: input.category || null, organizationId: ctx.orgId, createdBy: ctx.userId })
        .returning();

      const added = [];
      const notFound = [];
      const titles = Array.isArray(input.songTitles) ? input.songTitles.slice(0, 30) : [];
      for (const [index, rawTitle] of titles.entries()) {
        const title = String(rawTitle).trim();
        if (!title) continue;
        const [match] = await db
          .select({ id: songs.id, title: songs.title })
          .from(songs)
          .where(and(eq(songs.organizationId, ctx.orgId), ilike(songs.title, `%${title}%`)))
          .limit(1);
        if (match) {
          await db.insert(setlistSongs).values({ setlistId: setlist.id, songId: match.id, position: index + 1 });
          added.push(match.title);
        } else {
          notFound.push(title);
        }
      }

      return {
        created: true,
        setlist: { id: setlist.id, name: setlist.name },
        addedSongs: added,
        songsNotFound: notFound,
        linkPath: `/setlists/${setlist.id}`,
      };
    }

    case "create_event": {
      const title = String(input.title || "").trim();
      const date = new Date(String(input.date || ""));
      if (!title || Number.isNaN(date.getTime())) return { error: "Valid title and ISO date are required" };
      const [event] = await db
        .insert(events)
        .values({
          title,
          date,
          location: input.location || null,
          theme: input.theme || null,
          organizationId: ctx.orgId,
          createdBy: ctx.userId,
        })
        .returning();
      return { created: true, event: { id: event.id, title: event.title, date: event.date }, linkPath: "/dashboard" };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Chat loop ────────────────────────────────────────────────

function buildSystemPrompt(ctx) {
  return [
    "You are the VPC Music assistant, embedded in a worship-team planning app.",
    `Organization: ${ctx.orgName}. The user's role is ${ctx.orgRole}. Today is ${new Date().toDateString()}.`,
    "You help manage the song library, setlists, and events using the provided tools.",
    "Keep replies short and practical. When you create something, mention it by name and note that it's linked below.",
    "If a request is ambiguous (e.g. which songs to add), ask a brief clarifying question instead of guessing.",
    ctx.canWrite ? "" : "This user has read-only access — you can look things up but must not offer to create or change anything.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Run the assistant conversation.
 * @param {Array<{role: "user"|"assistant", content: string}>} history — prior turns, newest last
 * @param {{ userId, orgId, orgName, orgRole, globalRole }} ctx
 * @param {object} [client] — injectable Anthropic client (tests)
 * @returns {{ reply: string, actions: Array<{label: string, linkPath: string}> }}
 */
export async function runAssistant(history, ctx, client) {
  if (!client) {
    if (!env.ANTHROPIC_API_KEY) {
      const error = new Error("Assistant is not configured (missing ANTHROPIC_API_KEY)");
      error.status = 503;
      throw error;
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  const canWrite = ctx.globalRole === "owner" || ctx.orgRole === "admin" || ctx.orgRole === "musician";
  const tools = toolsForRole(ctx.orgRole, ctx.globalRole);
  const messages = history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? "").slice(0, 4000),
  }));

  const actions = [];
  let reply = "";

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt({ ...ctx, canWrite }),
      tools,
      messages,
    });

    const textBlocks = response.content.filter((block) => block.type === "text");
    const toolUses = response.content.filter((block) => block.type === "tool_use");

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      reply = textBlocks.map((block) => block.text).join("\n").trim();
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const results = [];
    for (const toolUse of toolUses) {
      let result;
      try {
        result = await executeTool(toolUse.name, toolUse.input ?? {}, ctx);
      } catch (err) {
        result = { error: err.message };
      }
      if (result?.created && result.linkPath) {
        const label =
          result.song?.title || result.setlist?.name || result.event?.title || "Created item";
        actions.push({ label, linkPath: result.linkPath });
      }
      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: results });
  }

  if (!reply) {
    reply = "I ran out of steps while working on that. Anything I created is linked below — ask me to continue if something is missing.";
  }

  return { reply, actions };
}
