import { useAuth } from "@/contexts/AuthContext";
import { RolesPermissionsManager } from "@/components/admin/RolesPermissionsManager";
import { PERMISSION_CATEGORIES, ROLE_PERMISSION_DEFAULTS, ROLE_LABELS } from "@vpc-music/shared";
import { Check, Minus, ShieldCheck } from "lucide-react";

const BASE_ROLES = ["admin", "musician", "observer"] as const;

/** Admin → Roles & permissions: permission matrix + custom role manager. */
export function AdminRolesTab() {
  const { user, activeOrg } = useAuth();
  const isAdmin = activeOrg?.role === "admin" || user?.role === "owner";

  if (!isAdmin) {
    return (
      <div className="max-w-2xl py-8 text-center">
        <h3 className="text-lg font-brand mb-1">Access Denied</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">You need admin permissions to view roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Permission matrix */}
      <section className="space-y-3">
        <h3 className="section-title">
          <ShieldCheck className="section-title-icon" /> Built-in role matrix
        </h3>
        <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] text-left text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                <th className="px-4 py-2.5">Permission</th>
                {BASE_ROLES.map((role) => (
                  <th key={role} className="px-4 py-2.5 text-center">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_CATEGORIES.flatMap((category) =>
                category.permissions.map((permission) => (
                  <tr key={permission.id} className="border-b border-[hsl(var(--border))]/50 last:border-b-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{permission.label}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{permission.description}</div>
                    </td>
                    {BASE_ROLES.map((role) => (
                      <td key={role} className="px-4 py-2 text-center">
                        {ROLE_PERMISSION_DEFAULTS[role]?.includes(permission.id) ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Allowed" />
                        ) : (
                          <Minus className="mx-auto h-4 w-4 text-[hsl(var(--muted-foreground))]/40" aria-label="Not allowed" />
                        )}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Every member can view songs, set lists, and charts. Global owners bypass all checks.
        </p>
      </section>

      {/* Custom roles */}
      <RolesPermissionsManager />
    </div>
  );
}
