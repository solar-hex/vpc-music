import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../../src/db.js", () => ({ db: mockDb, pool: {} }));

const TEST_SECRET = "test-secret-for-assistant-tests";
vi.mock("../../src/config/env.js", () => ({
  env: {
    JWT_SECRET: TEST_SECRET,
    CORS_ORIGIN: "http://localhost:5176",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    ANTHROPIC_API_KEY: "",
  },
}));

const { app } = await import("../../src/app.js");
const { toolsForRole } = await import("../../src/features/assistant/service.js");

function createQueryChain(result) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function tokenFor(globalRole = "member") {
  return jwt.sign({ id: `user-${globalRole}`, role: globalRole }, TEST_SECRET, { expiresIn: "1h" });
}

function membership(role) {
  return createQueryChain([{ id: "org-1", name: "Test Church", role }]);
}

/** Fake Anthropic client scripted with a sequence of responses. */
function fakeClient(responses) {
  let call = 0;
  const calls = [];
  return {
    calls,
    messages: {
      create: vi.fn(async (params) => {
        calls.push(params);
        const response = responses[Math.min(call, responses.length - 1)];
        call += 1;
        return response;
      }),
    },
  };
}

describe("Assistant API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReset();
    mockDb.insert.mockReset();
    app.set("assistantClient", undefined);
  });

  it("rejects unauthenticated requests (401)", async () => {
    const res = await request(app).post("/api/assistant/chat").send({ messages: [] });
    expect(res.status).toBe(401);
  });

  it("requires a messages array (400)", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));

    const res = await request(app)
      .post("/api/assistant/chat")
      .set("Cookie", `token=${tokenFor()}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 503 when no API key is configured", async () => {
    mockDb.select.mockImplementationOnce(() => membership("musician"));

    const res = await request(app)
      .post("/api/assistant/chat")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(503);
  });

  it("filters tools by role: observers get read-only tools", () => {
    const observerTools = toolsForRole("observer", "member").map((t) => t.name);
    expect(observerTools).toEqual(["search_songs", "list_upcoming_events", "list_setlists"]);

    const musicianTools = toolsForRole("musician", "member").map((t) => t.name);
    expect(musicianTools).toContain("create_song");
    expect(musicianTools).toContain("create_setlist");
    expect(musicianTools).toContain("create_event");

    const ownerTools = toolsForRole("observer", "owner").map((t) => t.name);
    expect(ownerTools).toContain("create_song");
  });

  it("runs the tool-use loop: executes create_song with caller context and returns an action link", async () => {
    const client = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Creating that song now." },
          { type: "tool_use", id: "tu_1", name: "create_song", input: { title: "Way Maker", key: "E" } },
        ],
      },
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Done! I created Way Maker in E." }],
      },
    ]);
    app.set("assistantClient", client);

    const insertChain = {
      values: vi.fn(() => insertChain),
      returning: vi.fn(() => Promise.resolve([{ id: "song-9", title: "Way Maker" }])),
    };
    mockDb.select.mockImplementationOnce(() => membership("musician"));
    mockDb.insert.mockImplementationOnce(() => insertChain);

    const res = await request(app)
      .post("/api/assistant/chat")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ messages: [{ role: "user", content: "Add Way Maker in E" }] });

    expect(res.status).toBe(200);
    expect(res.body.reply).toContain("Way Maker");
    expect(res.body.actions).toEqual([{ label: "Way Maker", linkPath: "/songs/song-9" }]);
    // Song row carries the caller's org and user ids
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Way Maker", organizationId: "org-1", createdBy: "user-member" }),
    );
    // Second call passed the tool_result back
    expect(client.calls).toHaveLength(2);
    const secondCallMessages = client.calls[1].messages;
    const lastMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMessage.role).toBe("user");
    expect(lastMessage.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
  });

  it("terminates the loop even if the model keeps requesting tools", async () => {
    const client = fakeClient([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "tu_x", name: "list_setlists", input: {} }],
      },
    ]);
    app.set("assistantClient", client);

    mockDb.select.mockImplementationOnce(() => membership("musician"));
    // Every list_setlists execution resolves to an empty list
    mockDb.select.mockImplementation(() => createQueryChain([]));

    const res = await request(app)
      .post("/api/assistant/chat")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ messages: [{ role: "user", content: "loop forever" }] });

    expect(res.status).toBe(200);
    expect(client.calls.length).toBeLessThanOrEqual(6);
    expect(res.body.reply).toBeTruthy();
  });

  it("passes only read tools to the model for observers", async () => {
    const client = fakeClient([
      { stop_reason: "end_turn", content: [{ type: "text", text: "Here's what I found." }] },
    ]);
    app.set("assistantClient", client);
    mockDb.select.mockImplementationOnce(() => membership("observer"));

    const res = await request(app)
      .post("/api/assistant/chat")
      .set("Cookie", `token=${tokenFor()}`)
      .send({ messages: [{ role: "user", content: "create a song called Test" }] });

    expect(res.status).toBe(200);
    const toolNames = client.calls[0].tools.map((t) => t.name);
    expect(toolNames).not.toContain("create_song");
    expect(toolNames).toContain("search_songs");
  });
});
