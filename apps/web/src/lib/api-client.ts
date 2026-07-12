const API_ORIGIN = import.meta.env.VITE_API_URL || "";

function buildApiUrl(path: string) {
  const normalizedPath = API_ORIGIN && path.startsWith("/api/") ? path.slice(4) : path;
  return `${API_ORIGIN}${normalizedPath}`;
}

// ── Active Organization ──────────────────────────
let _activeOrgId: string | null = null;

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
  status?: SongStatus | null;
  isArchived?: boolean;
  isFavorite?: boolean;
  timeSignature?: string | null;
  durationSeconds?: number | null;
  genre?: string | null;
  albumId?: string | null;
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
  listSetlists: (id: string) =>
    request<{ setlists: { id: string; name: string; status?: string; updatedAt?: string }[] }>(`/api/songs/${id}/setlists`),
  setStatus: (id: string, status: SongStatus | null) =>
    request<{ song: Song }>(`/api/songs/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  archive: (id: string) => request<{ song: Song }>(`/api/songs/${id}/archive`, { method: "POST" }),
  unarchive: (id: string) => request<{ song: Song }>(`/api/songs/${id}/unarchive`, { method: "POST" }),
  restore: (id: string) => request<{ song: Song }>(`/api/songs/${id}/restore`, { method: "POST" }),
  permanentDelete: (id: string) =>
    request<{ message: string }>(`/api/songs/${id}/permanent`, { method: "DELETE" }),
  favorite: (id: string) => request<{ message: string }>(`/api/songs/${id}/favorite`, { method: "POST" }),
  unfavorite: (id: string) => request<{ message: string }>(`/api/songs/${id}/favorite`, { method: "DELETE" }),
  get: (id: string) => request<{ song: Song; variations: SongVariation[] }>(`/api/songs/${id}`),
  getGroups: () => request<{ groups: SongGroup[] }>("/api/songs/groups"),
  createGroup: (data: { name: string }) =>
    request<{ group: SongGroup }>("/api/songs/groups", { method: "POST", body: JSON.stringify(data) }),
  updateGroup: (groupId: string, data: { name: string }) =>
    request<{ group: SongGroup }>(`/api/songs/groups/${groupId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteGroup: (groupId: string) =>
    request<{ message: string }>(`/api/songs/groups/${groupId}`, { method: "DELETE" }),
  updateGroupManagers: (groupId: string, userIds: string[]) =>
    request<{ groupId: string; managerUserIds: string[]; managerNames: string[] }>(`/api/songs/groups/${groupId}/managers`, {
      method: "PUT",
      body: JSON.stringify({ userIds }),
    }),
  addSongsToGroup: (groupId: string, songIds: string[]) =>
    request<{ addedSongIds: string[]; skippedSongIds: string[] }>(`/api/songs/groups/${groupId}/songs`, {
      method: "POST",
      body: JSON.stringify({ songIds }),
    }),
  removeSongFromGroup: (groupId: string, songId: string) =>
    request<{ message: string }>(`/api/songs/groups/${groupId}/songs/${songId}`, { method: "DELETE" }),
  getCategories: () => request<{ categories: string[] }>("/api/songs/categories"),
  getTags: () => request<{ tags: string[] }>("/api/songs/tags"),
  findDuplicates: (data: { title?: string; content?: string; excludeSongId?: string }) =>
    request<{ matches: DuplicateSongMatch[] }>("/api/songs/duplicates/check", {
      method: "POST",
      body: JSON.stringify(data),
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
export const variationsApi = {
  create: (songId: string, data: { name: string; content: string; key?: string }) =>
    request<{ variation: SongVariation }>(`/api/songs/${songId}/variations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (songId: string, varId: string, data: Partial<Pick<SongVariation, "name" | "content" | "key">>) =>
    request<{ variation: SongVariation }>(`/api/songs/${songId}/variations/${varId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  setDefault: (songId: string, variationId: string | null) =>
    request<{ song: Song }>(`/api/songs/${songId}/default-variation`, {
      method: "PATCH",
      body: JSON.stringify({ variationId }),
    }),
  delete: (songId: string, varId: string) =>
    request<{ message: string }>(`/api/songs/${songId}/variations/${varId}`, { method: "DELETE" }),
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
  songTitle: string | null;
  songKey?: string | null;
  songArtist?: string | null;
  songTempo?: number | null;
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
    data: Partial<Pick<SetlistSongItem, "key" | "notes" | "duration" | "capo" | "arrangement" | "transitionCues" | "songId">>,
  ) =>
    request<{ item: SetlistSongItem }>(`/api/setlists/${setlistId}/songs/${songItemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  removeSong: (setlistId: string, songItemId: string) =>
    request<{ message: string }>(`/api/setlists/${setlistId}/songs/${songItemId}`, { method: "DELETE" }),
  markComplete: (setlistId: string, usedAt?: string) =>
    request<{ setlist: Setlist; usagesLogged: number }>(`/api/setlists/${setlistId}/complete`, {
      method: "POST",
      body: JSON.stringify({ usedAt }),
    }),
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

export const songHistoryApi = {
  list: (songId: string) =>
    request<{ history: SongEdit[] }>(`/api/songs/${songId}/history`),
};

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

export const stickyNotesApi = {
  list: (songId: string) =>
    request<{ notes: StickyNote[] }>(`/api/songs/${songId}/notes`),
  create: (songId: string, data: { content: string; color?: string }) =>
    request<{ note: StickyNote }>(`/api/songs/${songId}/notes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (songId: string, noteId: string, data: { content?: string; color?: string }) =>
    request<{ note: StickyNote }>(`/api/songs/${songId}/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (songId: string, noteId: string) =>
    request<{ message: string }>(`/api/songs/${songId}/notes/${noteId}`, { method: "DELETE" }),
};

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

export const songCollaborationApi = {
  list: (songId: string) =>
    request<{ items: SongCollaborationItem[] }>(`/api/songs/${songId}/collaboration`),
  create: (songId: string, data: {
    type: SongCollaborationItem["type"];
    anchor?: string;
    title?: string;
    content: string;
    parentId?: string;
  }) =>
    request<{ item: SongCollaborationItem }>(`/api/songs/${songId}/collaboration`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (songId: string, itemId: string, data: {
    anchor?: string;
    title?: string;
    content?: string;
    status?: SongCollaborationItem["status"];
  }) =>
    request<{ item: SongCollaborationItem }>(`/api/songs/${songId}/collaboration/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (songId: string, itemId: string) =>
    request<{ message: string }>(`/api/songs/${songId}/collaboration/${itemId}`, { method: "DELETE" }),
};

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

export const shareApi = {
  /** Create a share link for a song */
  create: (songId: string, data?: { label?: string; expiresInDays?: number }) =>
    request<{ shareToken: ShareToken; shareUrl: string }>(`/api/songs/${songId}/share`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  /** List all share tokens for a song */
  list: (songId: string) =>
    request<{ shares: ShareToken[] }>(`/api/songs/${songId}/shares`),
  /** Revoke a share token */
  revoke: (songId: string, tokenId: string) =>
    request<{ message: string }>(`/api/songs/${songId}/shares/${tokenId}`, { method: "DELETE" }),
  /** Update a share token (label) */
  update: (songId: string, tokenId: string, data: { label?: string | null }) =>
    request<{ shareToken: ShareToken }>(`/api/songs/${songId}/shares/${tokenId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  /** List direct authenticated user shares for a song */
  listDirect: (songId: string) =>
    request<{ directShares: DirectSongShare[] }>(`/api/songs/${songId}/direct-shares`),
  /** Share a song directly with an existing user by email */
  createDirect: (songId: string, data: { email: string }) =>
    request<{ directShare: DirectSongShare }>(`/api/songs/${songId}/direct-shares`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Remove a direct authenticated user share */
  removeDirect: (songId: string, shareId: string) =>
    request<{ message: string }>(`/api/songs/${songId}/direct-shares/${shareId}`, { method: "DELETE" }),
  /** List reusable share teams for the active organization */
  listTeams: () => request<{ teams: ShareTeam[] }>("/api/share-teams"),
  /** Create a reusable share team */
  createTeam: (data: { name: string; userIds: string[] }) =>
    request<{ team: ShareTeam }>("/api/share-teams", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Delete a reusable share team */
  deleteTeam: (teamId: string) =>
    request<{ message: string }>(`/api/share-teams/${teamId}`, { method: "DELETE" }),
  /** List team shares for a song */
  listTeamShares: (songId: string) =>
    request<{ teamShares: SongTeamShare[] }>(`/api/songs/${songId}/team-shares`),
  /** Share a song with a reusable team */
  createTeamShare: (songId: string, data: { teamId: string }) =>
    request<{ teamShare: SongTeamShare }>(`/api/songs/${songId}/team-shares`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Remove a team share from a song */
  removeTeamShare: (songId: string, shareId: string) =>
    request<{ message: string }>(`/api/songs/${songId}/team-shares/${shareId}`, { method: "DELETE" }),
  /** List other organizations that can receive shared songs */
  listOrganizationTargets: () =>
    request<{ organizations: OrganizationShareTarget[] }>("/api/share-organizations"),
  /** List current organization share assignments for selected songs */
  listBatchOrganizationShares: (songIds: string[]) => {
    const query = new URLSearchParams();
    for (const songId of songIds) {
      query.append("songId", songId);
    }

    return request<{ shares: OrganizationShareAssignment[] }>(`/api/songs/batch/organization-shares?${query.toString()}`);
  },
  /** Batch share songs with one or more organizations */
  batchShareToOrganizations: (data: { songIds: string[]; organizationIds: string[] }) =>
    request<BatchOrganizationShareResult>("/api/songs/batch/organization-shares", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Edit batch organization sharing by adding and removing target orgs */
  updateBatchOrganizationShares: (data: { songIds: string[]; addOrganizationIds?: string[]; removeOrganizationIds?: string[] }) =>
    request<BatchOrganizationShareResult>("/api/songs/batch/organization-shares", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  /** Public: fetch a shared song by token (no auth needed) */
  getShared: (token: string) =>
    request<{ song: Song; shared: true }>(`/api/shared/${token}`),
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
  /** Update a member's org role */
  updateRole: (userId: string, role: string) =>
    request<{ message: string }>(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  /** Assign or clear a member's custom-role overlay */
  updateCustomRole: (userId: string, customRoleId: string | null) =>
    request<{ message: string }>(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ customRoleId }),
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

export const rolesApi = {
  list: () => request<{ roles: OrgRole[] }>("/api/roles"),
  create: (data: { name: string; description?: string; color?: string; permissions: string[] }) =>
    request<{ role: OrgRole }>("/api/roles", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; description: string; color: string; permissions: string[] }>) =>
    request<{ role: OrgRole }>(`/api/roles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/roles/${id}`, { method: "DELETE" }),
};

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

export const albumsApi = {
  list: (params?: { artistId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.artistId) qs.set("artistId", params.artistId);
    const query = qs.toString();
    return request<{ albums: Album[] }>(`/api/albums${query ? `?${query}` : ""}`);
  },
  get: (id: string) => request<{ album: Album; songs: Song[] }>(`/api/albums/${id}`),
  create: (data: Partial<Album>) =>
    request<{ album: Album }>("/api/albums", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Album>) =>
    request<{ album: Album }>(`/api/albums/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/albums/${id}`, { method: "DELETE" }),
};

// ── Media ────────────────────────────────────────
export type MediaType = "chart" | "lyrics" | "audio" | "backing_track" | "stem" | "other";

export interface MediaFile {
  id: string;
  type: MediaType;
  fileUrl: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  songId?: string | null;
  songTitle?: string | null;
  createdAt?: string;
}

export const mediaApi = {
  list: (params?: { type?: MediaType; songId?: string; unattached?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.songId) qs.set("songId", params.songId);
    if (params?.unattached) qs.set("unattached", "true");
    const query = qs.toString();
    return request<{ media: MediaFile[] }>(`/api/media${query ? `?${query}` : ""}`);
  },
  upload: (file: File, options?: { type?: MediaType; songId?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (options?.type) form.append("type", options.type);
    if (options?.songId) form.append("songId", options.songId);
    return fetchWithOrganization("/api/media", { method: "POST", body: form }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const error: any = new Error(body?.error?.message || "Upload failed");
        error.status = res.status;
        throw error;
      }
      return res.json() as Promise<{ media: MediaFile }>;
    });
  },
  update: (id: string, data: { type?: MediaType; songId?: string | null }) =>
    request<{ media: MediaFile }>(`/api/media/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/media/${id}`, { method: "DELETE" }),
};

// ── Set list templates ───────────────────────────
export interface SetlistTemplate {
  id: string;
  title: string;
  description?: string | null;
  structure: { label: string }[];
  createdAt?: string;
}

export const templatesApi = {
  list: () => request<{ templates: SetlistTemplate[] }>("/api/setlists/templates"),
  create: (data: { title: string; description?: string; structure: { label: string }[] }) =>
    request<{ template: SetlistTemplate }>("/api/setlists/templates", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ title: string; description: string; structure: { label: string }[] }>) =>
    request<{ template: SetlistTemplate }>(`/api/setlists/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/setlists/templates/${id}`, { method: "DELETE" }),
  apply: (id: string, name?: string) =>
    request<{ setlist: Setlist; slotCount: number }>(`/api/setlists/templates/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
};

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

export const rehearsalsApi = {
  list: (params?: { upcoming?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.upcoming) qs.set("upcoming", "true");
    const query = qs.toString();
    return request<{ rehearsals: Rehearsal[] }>(`/api/rehearsals${query ? `?${query}` : ""}`);
  },
  create: (data: Partial<Rehearsal>) =>
    request<{ rehearsal: Rehearsal }>("/api/rehearsals", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Rehearsal>) =>
    request<{ rehearsal: Rehearsal }>(`/api/rehearsals/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/rehearsals/${id}`, { method: "DELETE" }),
};

// ── Availability ─────────────────────────────────
export type AvailabilityStatus = "available" | "tentative" | "unavailable";

export interface AvailabilityEntry {
  userId: string;
  date: string;
  status: AvailabilityStatus;
}

export const availabilityApi = {
  list: (params: { from: string; to: string }) =>
    request<{ entries: AvailabilityEntry[] }>(`/api/availability?from=${params.from}&to=${params.to}`),
  set: (data: { userId?: string; date: string; status: AvailabilityStatus }) =>
    request<{ entry: AvailabilityEntry }>("/api/availability", { method: "PUT", body: JSON.stringify(data) }),
  clear: (data: { userId?: string; date: string }) =>
    request<{ message: string }>("/api/availability", { method: "DELETE", body: JSON.stringify(data) }),
};

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

export const activityApi = {
  list: (params?: { actorId?: string; action?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.actorId) qs.set("actorId", params.actorId);
    if (params?.action) qs.set("action", params.action);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<{ entries: ActivityEntry[] }>(`/api/activity${query ? `?${query}` : ""}`);
  },
};

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

export const usageReportApi = {
  get: () => request<{ songs: SongUsageReportRow[] }>("/api/songs/usage-report"),
};

// ── Assistant ────────────────────────────────────
export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAction {
  label: string;
  linkPath: string;
}

export const assistantApi = {
  chat: (messages: AssistantMessage[]) =>
    request<{ reply: string; actions: AssistantAction[] }>("/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),
};

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

export const notificationsApi = {
  list: (params?: { unread?: boolean; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.unread) qs.set("unread", "true");
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request<{ notifications: AppNotification[] }>(`/api/notifications${query ? `?${query}` : ""}`);
  },
  unreadCount: () => request<{ count: number }>("/api/notifications/unread-count"),
  markRead: (id: string) =>
    request<{ notification: AppNotification }>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<{ message: string }>("/api/notifications/read-all", { method: "POST" }),
  delete: (id: string) => request<{ message: string }>(`/api/notifications/${id}`, { method: "DELETE" }),
  clearAll: () => request<{ message: string }>("/api/notifications", { method: "DELETE" }),
};

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

export const artistsApi = {
  list: (params?: { q?: string; genre?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.genre) qs.set("genre", params.genre);
    const query = qs.toString();
    return request<{ artists: Artist[] }>(`/api/artists${query ? `?${query}` : ""}`);
  },
  get: (id: string) => request<{ artist: Artist; songs: ArtistSong[] }>(`/api/artists/${id}`),
  create: (data: Partial<Artist>) =>
    request<{ artist: Artist }>("/api/artists", { method: "POST", body: JSON.stringify(data) }),
  resolve: (name: string) =>
    request<{ artist: Artist; created: boolean }>("/api/artists/resolve", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  update: (id: string, data: Partial<Artist>) =>
    request<{ artist: Artist }>(`/api/artists/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<{ message: string }>(`/api/artists/${id}`, { method: "DELETE" }),
};

export const orgsApi = {
  /** List organizations the user belongs to (owners see all) */
  list: () => request<{ organizations: Organization[] }>("/api/organizations"),
  /** List members of the active organization (readable by all org roles) */
  members: () => request<{ members: OrgMember[] }>("/api/organizations/current/members"),
  /** Create a new organization */
  create: (name: string) =>
    request<{ organization: Organization }>("/api/organizations", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  /** Update an organization (name, slug, logo) */
  update: (id: string, data: string | { name?: string; slug?: string | null; logoUrl?: string | null }) =>
    request<{ organization: Organization }>(`/api/organizations/${id}`, {
      method: "PUT",
      body: JSON.stringify(typeof data === "string" ? { name: data } : data),
    }),
  /** Delete an organization (owner only) */
  remove: (id: string) =>
    request<{ message: string }>(`/api/organizations/${id}`, {
      method: "DELETE",
    }),
};
