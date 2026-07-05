// Permission catalog for org roles.
//
// The three system roles (admin/musician/observer) keep their behavior via
// ROLE_PERMISSION_DEFAULTS — derived from the API's requireOrgRole call
// sites, so a member without a custom role behaves exactly as before.
// Custom roles override the defaults with an explicit permission list.
//
// Out of scope for v1 (still governed by base-role checks): sharing/team
// shares, song-group manager delegation, org create/rename/delete.

export const PERMISSION_CATEGORIES = [
  {
    key: "songs",
    label: "Songs",
    permissions: [
      { id: "songs:edit", label: "Create & edit songs", description: "Create, edit, import, archive, and trash songs, variations, and usage records." },
      { id: "songs:delete_permanent", label: "Permanently delete songs", description: "Hard-delete songs from the trash." },
    ],
  },
  {
    key: "setlists",
    label: "Setlists",
    permissions: [
      { id: "setlists:edit", label: "Create & edit setlists", description: "Create, edit, reorder, archive, complete, and trash setlists." },
      { id: "setlists:delete_permanent", label: "Permanently delete setlists", description: "Hard-delete setlists from the trash." },
    ],
  },
  {
    key: "events",
    label: "Events",
    permissions: [
      { id: "events:edit", label: "Manage events", description: "Create, edit, and delete services and rehearsals." },
    ],
  },
  {
    key: "artists",
    label: "Artists",
    permissions: [
      { id: "artists:edit", label: "Manage artists", description: "Create, edit, and delete artist directory entries." },
    ],
  },
  {
    key: "team",
    label: "Team & Admin",
    permissions: [
      { id: "team:manage", label: "Manage team", description: "Invite members, change roles, and remove members." },
      { id: "roles:manage", label: "Manage roles", description: "Create and edit custom roles and permissions." },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_CATEGORIES.flatMap((category) =>
  category.permissions.map((permission) => permission.id),
);

// Base-role permission sets. Reading is implicit for every member; these
// gates cover writes and admin surfaces only.
export const ROLE_PERMISSION_DEFAULTS = {
  admin: [...ALL_PERMISSIONS],
  musician: ["songs:edit", "setlists:edit", "events:edit", "artists:edit"],
  observer: [],
};

/**
 * Effective permission check.
 * @param {string[]|null|undefined} customPermissions — the member's custom role permissions, if any
 * @param {string} baseRole — admin | musician | observer
 * @param {string} permission
 */
export function hasPermission(customPermissions, baseRole, permission) {
  if (Array.isArray(customPermissions)) {
    return customPermissions.includes(permission);
  }
  return (ROLE_PERMISSION_DEFAULTS[baseRole] ?? []).includes(permission);
}
