/**
 * Resolving the org and the creator a load runs as.
 *
 * Extracted from `import-chrd-library.js` so the corpus loader and the legacy
 * importer share one definition rather than drifting apart. `database` is
 * always passed in, so nothing here opens a connection of its own and tests
 * can hand it a pg-mem instance.
 */
import { and, asc, eq } from "drizzle-orm";
import { organizationMembers, organizations, users } from "../schema/index.js";
import { UUID_PATTERN } from "./identity.js";

/** By id or by exact name. On a miss, list what is actually there. */
export async function resolveOrganization(database, orgArg) {
  const rows = await database.select({ id: organizations.id, name: organizations.name }).from(organizations);
  const match = UUID_PATTERN.test(orgArg)
    ? rows.find((row) => row.id.toLowerCase() === orgArg.toLowerCase())
    : rows.find((row) => row.name === orgArg);
  if (!match) {
    const list = rows.map((row) => `  ${row.id}  ${row.name}`).join("\n") || "  (none)";
    throw new Error(`Organization "${orgArg}" not found. Organizations in this database:\n${list}`);
  }
  return match;
}

/**
 * The user a load is attributed to. With no `--created-by`, the org's oldest
 * admin. A named user must actually belong to the org, or the rows would be
 * owned by someone who cannot see them.
 */
export async function resolveCreator(database, organization, createdByArg) {
  if (createdByArg) {
    const [user] = await database
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, createdByArg))
      .limit(1);
    if (!user) throw new Error(`User "${createdByArg}" not found`);

    const [membership] = await database
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organization.id),
          eq(organizationMembers.userId, user.id),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new Error(
        `User ${user.email} has no membership in "${organization.name}". Add one first, e.g.\n` +
          `  INSERT INTO organization_members (organization_id, user_id, role) VALUES ('${organization.id}', '${user.id}', 'admin');`,
      );
    }
    return user;
  }

  const [admin] = await database
    .select({ id: users.id, email: users.email })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.role, "admin"),
      ),
    )
    .orderBy(asc(organizationMembers.createdAt))
    .limit(1);
  if (!admin) {
    throw new Error(`"${organization.name}" has no admin member to own the imported songs; pass --created-by <email>`);
  }
  return admin;
}
