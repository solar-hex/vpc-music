const API_ORIGIN = import.meta.env.VITE_API_URL || "";

function buildApiUrl(path: string) {
  const normalizedPath = API_ORIGIN && path.startsWith("/api/") ? path.slice(4) : path;
  return `${API_ORIGIN}${normalizedPath}`;
}

// ── Active Organization ──────────────────────────
// Seeded synchronously from localStorage (same key AuthContext reads) so a
// request fired from a page's own mount effect already carries the right
// org header even if it runs before AuthContext's sync effect does — those
// two effects race on the very first render after login/reload, and losing
// that race now 400s on org-scoped GETs instead of just fetching cross-org.
let _activeOrgId: string | null =
  typeof localStorage !== "undefined" ? localStorage.getItem("vpc-music-active-org-id") : null;

/** Call from AuthContext whenever the active org changes */
export function setActiveOrganizationId(id: string | null) {
  _activeOrgId = id;
}

function withOrganizationHeaders(headers?: HeadersInit) {
  const nextHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };

  if (_activeOrgId) {
    nextHeaders["X-Organization-Id"] = _activeOrgId;
  }

  return nextHeaders;
}

function fetchWithOrganization(path: string, options?: RequestInit) {
  return fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
    headers: withOrganizationHeaders(options?.headers),
  });
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...withOrganizationHeaders(options?.headers),
  };
  const res = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error: Error & { status?: number; body?: unknown } = new Error(body?.error?.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return res.json();
}

// ── Auth ─────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await fetch(buildApiUrl("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || `HTTP ${res.status}`);
    }
    if (body.needsPassword) {
      const err: any = new Error("Password setup required");
      err.body = body;
      throw err;
    }
    return body as { user: any; token: string };
  },
  setPassword: (email: string, password: string) =>
    request<{ user: any; token: string }>("/api/auth/set-password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (data: { email: string; password: string; displayName?: string }) =>
    request<{ user: any; token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: any }>("/api/auth/me"),
  forgotPassword: (email: string) =>
    request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};

// ── Songs ────────────────────────────────────────
export type SongStatus = "ready" | "needs_review" | "in_rehearsal" | "updated" | "missing_chords";
export type SongTier = "personal" | "organization" | "global";

export interface Song {
  id: string;
  title: string;
  aka?: string | null;
  category?: string | null;
  key?: string | null;
  tempo?: number | null;
  artist?: string | null;
  shout?: string | null;
  year?: string | null;
  tags?: string | null;
  content: string;
  abcNotation?: string | null;
  isDraft?: boolean;
  tier?: SongTier;
  status?: SongStatus | null;
  isArchived?: boolean;
  isFavorite?: boolean;
  timeSignature?: string | null;
  durationSeconds?: number | null;
  genre?: string | null;
  albumId?: string | null;
  energy?: number | null;
  lastPlayed?: string | null;
  defaultVariationId?: string | null;
  sharedWithMe?: boolean;
  organizationName?: string | null;
  organizationId?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SongVariation {
  id: string;
  songId: string;
  name: string;
  content: string;
  key?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SimilarSong {
  id: string;
  title: string;
  artist?: string | null;
  key?: string | null;
  tempo?: number | null;
  tags?: string | null;
  energy?: number | null;
  durationSeconds?: number | null;
  tempoDiff?: number | null;
  sharedTags: string[];
}

export interface SongGroup {
  id: string;
  name: string;
  songCount?: number;
  managers?: Array<{ userId: string; name: string }>;
  managerUserIds?: string[];
  managerNames?: string[];
  canManage?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportPreviewResponse {
  chordPro: string;
  metadata: {
    title?: string | null;
    artist?: string | null;
    key?: string | null;
    tempo?: number | null;
  };
}

export interface DuplicateSongMatch {
  id: string;
  title: string;
  aka?: string | null;
  artist?: string | null;
  key?: string | null;
  updatedAt?: string | null;
  titleScore: number;
  lyricScore: number;
  overallScore: number;
  matchedOn: string[];
}

/** One side of a possible duplicate, as the duplicate review lists it. */
export interface DuplicateCandidate {
  id: string;
  title: string;
  artist: string | null;
  key: string | null;
  tempo: number | null;
  isDraft: boolean;
  status: SongStatus | null;
  /** Where the chart came from: chrd, docx, pdf, text, onsong, or app. */
  source: string;
  chords: number;
  updatedAt?: string | null;
}

/** Two songs whose words mostly match. `overlap` is 0-1. */
export interface DuplicatePair {
  overlap: number;
  shared: number;
  titlesAgree: boolean;
  left: DuplicateCandidate;
  right: DuplicateCandidate;
}

export type SongWriteInput = Partial<Song> & {
  lastKnownUpdatedAt?: string;
  forceOverwrite?: boolean;
};

export const songsApi = {
  list: (params?: { q?: string; groupId?: string; scope?: "organization" | "shared"; category?: string; tag?: string; key?: string; tempoMin?: number; tempoMax?: number; status?: SongStatus; favorites?: boolean; archived?: boolean; sort?: "lastEdited" | "title" | "recentlyAdded" | "mostUsed"; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.groupId) qs.set("groupId", params.groupId);
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.category) qs.set("category", params.category);
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.key) qs.set("key", params.key);
    if (params?.tempoMin !== undefined) qs.set("tempoMin", String(params.tempoMin));
    if (params?.tempoMax !== undefined) qs.set("tempoMax", String(params.tempoMax));
    if (params?.status) qs.set("status", params.status);
    if (params?.favorites) qs.set("favorites", "true");
    if (params?.archived) qs.set("archived", "true");
    if (params?.sort) qs.set("sort", params.sort);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return request<{ songs: Song[]; total: number }>(`/api/songs${query ? `?${query}` : ""}`);
  },
  get: (id: string) => request<{ song: Song; variations: SongVariation[] }>(`/api/songs/${id}`),
  getTags: () => request<{ tags: string[] }>("/api/songs/tags"),
  findDuplicates: (data: { title?: string; content?: string; excludeSongId?: string }) =>
    request<{ matches: DuplicateSongMatch[] }>("/api/songs/duplicates/check", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Pairs of songs whose words mostly match, most alike first. */
  duplicates: () => request<{ pairs: DuplicatePair[] }>("/api/songs/duplicates"),
  /** Keep `keepId` with this chart text; the other song is archived, pointing at it. */
  merge: (keepId: string, data: { otherId: string; content: string; keptUpdatedAt?: string; otherUpdatedAt?: string }) =>
    request<{ song: Song; merged: { id: string; title: string } }>(`/api/songs/${keepId}/merge`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Bring back a song that was merged into another. */
  unmerge: (id: string) => request<{ song: Song }>(`/api/songs/${id}/unmerge`, { method: "POST" }),
  /** Mark two songs as different songs, so they stop being offered as duplicates (or undo that). */
  markDistinct: (id: string, otherId: string, distinct = true) =>
    request<{ ok: true; distinct: boolean }>(`/api/songs/${id}/distinct`, {
      method: "POST",
      body: JSON.stringify({ otherId, distinct }),
    }),
  create: (data: Partial<Song>) =>
    request<{ song: Song }>("/api/songs", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: SongWriteInput) =>
    request<{ song: Song }>(`/api/songs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/songs/${id}`, { method: "DELETE" }),
  importChrd: (data: { filename: string; content: string }) =>
    request<{ song: Song }>("/api/songs/import/chrd", { method: "POST", body: JSON.stringify(data) }),
  previewImportChrd: (data: { filename: string; content: string }) =>
    request<ImportPreviewResponse>("/api/songs/import/chrd/preview", { method: "POST", body: JSON.stringify(data) }),
  importOnSong: (data: { filename: string; content: string }) =>
    request<{ song: Song; chordPro: string }>("/api/songs/import/onsong", { method: "POST", body: JSON.stringify(data) }),
  previewImportOnSong: (data: { filename: string; content: string }) =>
    request<ImportPreviewResponse>("/api/songs/import/onsong/preview", { method: "POST", body: JSON.stringify(data) }),
  exportZip: (songIds: string[], format: "chordpro" | "onsong" | "text" = "chordpro") => {
    const qs = new URLSearchParams({ format });
    for (const songId of songIds) {
      qs.append("id", songId);
    }
    return fetchWithOrganization(`/api/songs/export/zip?${qs.toString()}`);
  },
  exportChordPro: (id: string, variationId?: string | null) =>
    fetchWithOrganization(`/api/songs/${id}/export/chordpro${variationId ? `?variationId=${variationId}` : ""}`),
  exportOnSong: (id: string, variationId?: string | null) =>
    fetchWithOrganization(`/api/songs/${id}/export/onsong${variationId ? `?variationId=${variationId}` : ""}`),
  exportText: (id: string, variationId?: string | null, lyricsOnly?: boolean) =>
    fetchWithOrganization(`/api/songs/${id}/export/text${variationId || lyricsOnly ? `?${new URLSearchParams({ ...(variationId ? { variationId } : {}), ...(lyricsOnly ? { lyricsOnly: "true" } : {}) }).toString()}` : ""}`),
  exportPdf: (id: string, variationId?: string | null) =>
    buildApiUrl(`/api/songs/${id}/export/pdf${variationId ? `?variationId=${variationId}` : ""}`),
  /**
   * A song's audio part or chart PDF, by its directive key. The route answers
   * 302 to a short-lived signed URL, so this works directly as `<audio src>`
   * or as a link, and must never be cached (see the NetworkOnly rule in
   * vite.config.ts).
   */
  mediaHref: (id: string, directiveKey: string) =>
    buildApiUrl(`/api/songs/${encodeURIComponent(id)}/media/${encodeURIComponent(directiveKey)}`),
  importPdf: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (_activeOrgId) headers["X-Organization-Id"] = _activeOrgId;
    const res = await fetch(buildApiUrl("/api/songs/import/pdf"), {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ song: Song; chordPro: string }>;
  },
  previewImportPdf: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (_activeOrgId) headers["X-Organization-Id"] = _activeOrgId;
    const res = await fetch(buildApiUrl("/api/songs/import/pdf/preview"), {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `HTTP ${res.status}`);
    }
    return res.json() as Promise<ImportPreviewResponse>;
  },
};

// ── Song Variations ──────────────────────────────

// ── Instrument parts (per-musician layers) ───────
export interface InstrumentPart {
  id: string;
  songId: string;
  userId: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  content?: string | null;
  abcNotation?: string | null;
  tier: SongTier;
  authorName?: string | null;
  isMine?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type InstrumentPartInput = {
  name?: string;
  icon?: string | null;
  color?: string | null;
  content?: string | null;
  abcNotation?: string | null;
};

// ── Setlists ─────────────────────────────────────
export interface Setlist {
  id: string;
  name: string;
  category?: string | null;
  notes?: string | null;
  status?: "draft" | "in_review" | "approved" | "complete";
  leader?: string | null;
  tags?: string | null;
  isArchived?: boolean;
  archivedAt?: string | null;
  deletedAt?: string | null;
  songCount?: number;
  /** Sum of per-song planned durations, in seconds. */
  totalDuration?: number | null;
  averageBpm?: number | null;
  /** Comma-separated distinct keys across the set. */
  keys?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type SetlistView = "active" | "archived" | "trash" | "all";

export type SetlistArrangement = "ACOUSTIC" | "ELECTRIC" | "FULL_BAND" | "STRIPPED_DOWN";
export type TransitionCueType = "SPEAKING" | "PRAYER" | "INSTRUMENTAL" | "COUNTDOWN" | "SPONTANEOUS" | "NOTE";

export interface TransitionCue {
  type: TransitionCueType;
  text?: string;
  durationSec?: number;
}

export interface SetlistSongItem {
  id: string;
  /** Null when this row is an unfilled template slot */
  songId: string | null;
  slotLabel?: string | null;
  variationId?: string | null;
  variationName?: string | null;
  position: number;
  key?: string | null;
  notes?: string | null;
  duration?: number | null;
  capo?: number | null;
  arrangement?: SetlistArrangement | null;
  transitionCues?: TransitionCue[] | null;
  talkSeconds?: number | null;
  songTitle: string | null;
  songKey?: string | null;
  songArtist?: string | null;
  songTempo?: number | null;
  songDurationSeconds?: number | null;
  songEnergy?: number | null;
  songStatus?: SongStatus | null;
}

export const setlistsApi = {
  list: (params?: { view?: SetlistView }) =>
    request<{ setlists: Setlist[] }>(`/api/setlists${params?.view ? `?view=${params.view}` : ""}`),
  archive: (id: string) => request<{ setlist: Setlist }>(`/api/setlists/${id}/archive`, { method: "POST" }),
  unarchive: (id: string) => request<{ setlist: Setlist }>(`/api/setlists/${id}/unarchive`, { method: "POST" }),
  restore: (id: string) => request<{ setlist: Setlist }>(`/api/setlists/${id}/restore`, { method: "POST" }),
  permanentDelete: (id: string) =>
    request<{ message: string }>(`/api/setlists/${id}/permanent`, { method: "DELETE" }),
  get: (id: string) => request<{ setlist: Setlist; songs: SetlistSongItem[] }>(`/api/setlists/${id}`),
  exportZip: (id: string, format: "chordpro" | "onsong" | "text" = "chordpro") =>
    fetchWithOrganization(`/api/setlists/${id}/export/zip?format=${format}`),
  create: (data: Partial<Setlist>) =>
    request<{ setlist: Setlist }>("/api/setlists", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Setlist>) =>
    request<{ setlist: Setlist }>(`/api/setlists/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/setlists/${id}`, { method: "DELETE" }),
  addSong: (setlistId: string, data: { songId: string; variationId?: string; key?: string; notes?: string }) =>
    request<{ item: SetlistSongItem }>(`/api/setlists/${setlistId}/songs`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reorderSongs: (setlistId: string, order: { id: string; position: number }[]) =>
    request<{ message: string }>(`/api/setlists/${setlistId}/songs`, {
      method: "PUT",
      body: JSON.stringify({ order }),
    }),
  approve: (id: string) => request<{ setlist: Setlist }>(`/api/setlists/${id}/approve`, { method: "POST" }),
  updateSong: (
    setlistId: string,
    songItemId: string,
    data: Partial<Pick<SetlistSongItem, "key" | "notes" | "duration" | "capo" | "arrangement" | "transitionCues" | "songId" | "talkSeconds">>,
  ) =>
    request<{ item: SetlistSongItem }>(`/api/setlists/${setlistId}/songs/${songItemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  removeSong: (setlistId: string, songItemId: string) =>
    request<{ message: string }>(`/api/setlists/${setlistId}/songs/${songItemId}`, { method: "DELETE" }),
  markComplete: (setlistId: string, usedAt?: string, source?: "perform") =>
    request<{ setlist: Setlist; usagesLogged: number }>(`/api/setlists/${setlistId}/complete`, {
      method: "POST",
      body: JSON.stringify({ usedAt, source }),
    }),
  share: (setlistId: string, data?: { label?: string; expiresInDays?: number }) =>
    request<{ shareToken: { token: string }; shareUrl: string }>(`/api/setlists/${setlistId}/share`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  getShared: (token: string) =>
    request<{
      setlist: { id: string; name: string; category?: string | null };
      songs: Array<{
        id: string;
        position: number;
        keyOverride?: string | null;
        capo?: number | null;
        notes?: string | null;
        songId: string;
        title: string;
        artist?: string | null;
        songKey?: string | null;
        tempo?: number | null;
        content: string;
      }>;
    }>(`/api/shared/setlist/${token}`),
  reopen: (setlistId: string) =>
    request<{ setlist: Setlist }>(`/api/setlists/${setlistId}/reopen`, { method: "POST" }),
};

// ── Platform / Settings ──────────────────────────
export const platformApi = {
  getSettings: () => request<{ settings: Record<string, any> }>("/api/platform/settings"),
  updateSettings: (settings: Record<string, any>) =>
    request<{ settings: Record<string, any> }>("/api/platform/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  updateProfile: (data: { displayName: string }) =>
    request<{ user: any }>("/api/platform/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>("/api/platform/password", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ── Events ───────────────────────────────────────
export interface EventTeamMember {
  userId?: string;
  name: string;
  role?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  location?: string | null;
  notes?: string | null;
  theme?: string | null;
  eventType?: string | null;
  status?: "scheduled" | "completed" | "cancelled";
  completedAt?: string | null;
  targetSeconds?: number | null;
  preparedBy?: string | null;
  preparedByName?: string | null;
  team?: EventTeamMember[] | null;
  setlistId?: string | null;
  setlistName?: string | null;
  setlistStatus?: "draft" | "complete" | null;
  songCount?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export const eventsApi = {
  list: (params?: { upcoming?: boolean; status?: "scheduled" | "completed" | "cancelled" }) => {
    const qs = new URLSearchParams();
    if (params?.upcoming !== undefined) qs.set("upcoming", String(params.upcoming));
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return request<{ events: Event[] }>(`/api/events${query ? `?${query}` : ""}`);
  },
  complete: (id: string) =>
    request<{ event: Event; playsLogged: number }>(`/api/events/${id}/complete`, { method: "POST" }),
  setStatus: (id: string, status: "scheduled" | "cancelled") =>
    request<{ event: Event }>(`/api/events/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  get: (id: string) => request<{ event: Event }>(`/api/events/${id}`),
  create: (data: Partial<Event>) =>
    request<{ event: Event }>("/api/events", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Event>) =>
    request<{ event: Event }>(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/events/${id}`, { method: "DELETE" }),
};

// ── Song Usages ──────────────────────────────────
export interface SongUsage {
  id: string;
  songId: string;
  usedAt: string;
  notes?: string | null;
  recordedBy?: string | null;
  organizationId?: string | null;
  createdAt?: string;
}

export const songUsageApi = {
  log: (songId: string, data: { usedAt: string; notes?: string }) =>
    request<{ usage: SongUsage }>(`/api/songs/${songId}/usage`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  list: (songId: string) =>
    request<{ usages: SongUsage[] }>(`/api/songs/${songId}/usage`),
  remove: (songId: string, usageId: string) =>
    request<{ message: string }>(`/api/songs/${songId}/usage/${usageId}`, { method: "DELETE" }),
  mostUsed: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : "";
    return request<{ songs: (Song & { useCount: number; lastUsed: string })[] }>(`/api/songs/most-used${qs}`);
  },
};

// ── Song Edit History ────────────────────────────
export interface SongEdit {
  id: string;
  songId: string;
  editedBy?: string | null;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt?: string;
}

// ── Sticky Notes ─────────────────────────────────
export interface StickyNote {
  id: string;
  songId: string;
  userId: string;
  content: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Song Collaboration ──────────────────────────
export interface SongCollaborationItem {
  id: string;
  songId: string;
  organizationId?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  parentId?: string | null;
  type: "comment" | "rehearsal_marker" | "rehearsal_note";
  anchor?: string | null;
  title?: string | null;
  content: string;
  status?: "open" | "resolved";
  createdAt?: string;
  updatedAt?: string;
}

// ── Share (read-only links) ──────────────────────
export interface ShareToken {
  id: string;
  token: string;
  songId: string;
  label?: string | null;
  expiresAt?: string | null;
  revoked?: boolean;
  createdAt?: string;
}

export interface DirectSongShare {
  id: string;
  userId: string;
  email: string;
  displayName?: string | null;
  createdAt?: string;
}

export interface ShareTeam {
  id: string;
  name: string;
  members: Array<{ userId: string; email: string; displayName?: string | null }>;
  memberUserIds: string[];
  memberNames: string[];
  memberCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SongTeamShare {
  id: string;
  teamId: string;
  teamName: string;
  createdAt?: string;
}

export interface OrganizationShareTarget {
  id: string;
  name: string;
}

export interface OrganizationShareAssignment {
  songId: string;
  organizationId: string;
}

export interface BatchOrganizationShareResult {
  sharedSongs: number;
  createdShares: number;
  removedShares?: number;
  skippedShares: number;
  targetOrganizations?: number;
}

/** What a share link shows: the chart and its credits, and nothing else. */
export interface SharedSong {
  title: string;
  artist: string | null;
  year: string | null;
  key: string | null;
  tempo: number | null;
  status: SongStatus | null;
  content: string;
}

export const shareApi = {
  /** The song's share link: the one already out, or a new one when there is none. */
  create: (songId: string, data?: { label?: string; expiresInDays?: number; fresh?: boolean }) =>
    request<{ shareToken: ShareToken; shareUrl: string }>(`/api/songs/${songId}/share`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  /** Turn off every link the song has. Sharing again makes a new one. */
  stopSharing: (songId: string) =>
    request<{ revoked: number }>(`/api/songs/${songId}/shares`, { method: "DELETE" }),
  /** Public: fetch a shared song by token (no auth needed) */
  getShared: (token: string) =>
    request<{ song: SharedSong; shared: true }>(`/api/shared/${encodeURIComponent(token)}`),
  /** Public: where a shared song's practice audio or PDF plays from. */
  mediaHref: (token: string, directiveKey: string) =>
    buildApiUrl(`/api/shared/${encodeURIComponent(token)}/media/${encodeURIComponent(directiveKey)}`),
};

// ── Admin ────────────────────────────────────────
export interface OrgUser {
  id: string;
  email: string;
  displayName: string | null;
  globalRole: "owner" | "member";
  orgRole: "admin" | "musician" | "observer";
  customRoleId?: string | null;
  hasPassword: boolean;
  createdAt: string;
}

export const adminApi = {
  /** List all members of the current org */
  listUsers: () => request<{ users: OrgUser[] }>("/api/admin/users"),
  /** Invite a new member by email */
  invite: (data: { email: string; displayName?: string; role?: string }) =>
    request<{ user: OrgUser; inviteUrl: string; message: string }>(
      "/api/admin/users/invite",
      { method: "POST", body: JSON.stringify(data) },
    ),
  /** Invite several members at once */
  inviteBulk: (invites: Array<{ email: string; displayName?: string; role?: string }>) =>
    request<{ results: Array<{ email: string | null; status: "invited" | "skipped" | "error"; role?: string; message?: string }>; invited: number }>(
      "/api/admin/users/invite-bulk",
      { method: "POST", body: JSON.stringify({ invites }) },
    ),
  /** Re-send a fresh invite link to a member who hasn't set a password */
  resendInvite: (userId: string) =>
    request<{ message: string; inviteUrl: string }>(`/api/admin/users/${userId}/resend-invite`, {
      method: "POST",
    }),
  /** Update a member's org role */
  updateRole: (userId: string, role: string) =>
    request<{ message: string }>(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  /** Remove a member from the org */
  removeMember: (userId: string) =>
    request<{ message: string }>(`/api/admin/users/${userId}`, {
      method: "DELETE",
    }),
};

// ── Roles & Permissions ──────────────────────────
export interface OrgRole {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount?: number;
}

// ── Organizations ────────────────────────────────
export interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  role?: "admin" | "musician" | "observer";
}

export interface OrgMember {
  userId: string;
  displayName: string | null;
  role: "admin" | "musician" | "observer";
}

// ── Albums ───────────────────────────────────────
export interface Album {
  id: string;
  title: string;
  year?: number | null;
  coverUrl?: string | null;
  artistId?: string | null;
  artistName?: string | null;
  trackCount?: number;
  createdAt?: string;
}

// ── Media ────────────────────────────────────────
export type MediaType = "chart" | "lyrics" | "audio" | "backing_track" | "stem" | "other";

export interface MediaFile {
  id: string;
  type: MediaType;
  fileUrl: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  format?: "chordpro" | "pdf" | "image" | null;
  songId?: string | null;
  songTitle?: string | null;
  createdAt?: string;
}

// ── Set list templates ───────────────────────────
export interface SetlistTemplate {
  id: string;
  title: string;
  description?: string | null;
  structure: { label: string }[];
  createdAt?: string;
}

// ── Rehearsals ───────────────────────────────────
export interface Rehearsal {
  id: string;
  rehearsalDate: string;
  location?: string | null;
  notes?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  setlistId?: string | null;
  setlistName?: string | null;
  createdAt?: string;
}

// ── Availability ─────────────────────────────────
export type AvailabilityStatus = "available" | "tentative" | "unavailable";

export interface AvailabilityEntry {
  userId: string;
  date: string;
  status: AvailabilityStatus;
}

// ── Activity log ─────────────────────────────────
export interface ActivityEntry {
  id: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
}

// ── Usage report ─────────────────────────────────
export interface SongUsageReportRow {
  id: string;
  title: string;
  artist?: string | null;
  key?: string | null;
  tempo?: number | null;
  playCount: number;
  lastPlayed?: string | null;
  setlistNames?: string | null;
}

// ── Statistics ───────────────────────────────────
export interface MonthPlays {
  month: string; // "YYYY-MM"
  plays: number;
}

export interface StatsOverview {
  playsByMonth: MonthPlays[];
  topSongs: Array<{ id: string; title: string; plays: number; lastPlayed?: string | null }>;
  keyDistribution: Array<{ key: string; count: number }>;
  tempoDistribution: Array<{ band: string; count: number }>;
  memberActivity: Array<{ userId: string; name?: string | null; plays: number }>;
  totals: { totalPlays: number; songsPlayed: number };
}

export interface SongPerformance {
  id: string;
  usedAt: string;
  source: string;
  notes?: string | null;
  eventTitle?: string | null;
  eventId?: string | null;
  setlistName?: string | null;
  setlistId?: string | null;
}

// ── Ink annotations ──────────────────────────────
export interface AnnotationStroke {
  tool: "pen" | "highlighter";
  color: string;
  /** Normalized [0..1] coordinates relative to the chart's content box. */
  points: Array<{ x: number; y: number }>;
}

// ── Assistant ────────────────────────────────────
export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAction {
  label: string;
  linkPath: string;
}

// ── Notifications ────────────────────────────────
export interface AppNotification {
  id: string;
  type: "event" | "team" | "setlist" | "system";
  title: string;
  message?: string | null;
  linkPath?: string | null;
  readAt?: string | null;
  createdAt?: string;
}

// ── Artists ──────────────────────────────────────
export interface Artist {
  id: string;
  name: string;
  bio?: string | null;
  genre?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  verified?: boolean;
  songCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArtistSong {
  id: string;
  title: string;
  key?: string | null;
  tempo?: number | null;
  useCount?: number;
}

export const orgsApi = {
  /** Update an organization (name, slug, logo) */
  update: (id: string, data: string | { name?: string; slug?: string | null; logoUrl?: string | null }) =>
    request<{ organization: Organization }>(`/api/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify(typeof data === "string" ? { name: data } : data),
    }),
};
