// Organization member roles — must match the DB enum in organizationMembers.js
export const ROLES = {
  OBSERVER: "observer",
  MUSICIAN: "musician",
  ADMIN: "admin",
};

export const ROLE_LABELS = {
  observer: "Observer",
  musician: "Musician",
  admin: "Worship Leader",
};

export const ROLE_DESCRIPTIONS = {
  observer: "View-only access — can browse songs, setlists, and chord charts but cannot create or edit anything.",
  musician: "Can create and edit songs, setlists, and variations. Full read-write access to the music library.",
  admin: "Everything a Musician can do plus team management — invite members, change roles, and remove users.",
};

/**
 * Get the human-readable label for an org role.
 * Falls back to capitalizing the raw value if unknown.
 */
export function roleLabel(role) {
  return ROLE_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1);
}
