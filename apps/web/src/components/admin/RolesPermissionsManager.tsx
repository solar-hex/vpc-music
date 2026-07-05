import { useEffect, useState } from "react";
import { toast } from "sonner";
import { rolesApi, type OrgRole } from "@/lib/api-client";
import { PERMISSION_CATEGORIES } from "@vpc-music/shared";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Plus, Pencil, Trash2, ShieldCheck, Lock, X, Users } from "lucide-react";

function RoleFormDialog({
  role,
  onClose,
  onSaved,
}: {
  /** null = create mode */
  role: OrgRole | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [saving, setSaving] = useState(false);

  const togglePermission = (id: string) => {
    setPermissions((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, permissions };
      if (role) {
        await rolesApi.update(role.id, payload);
        toast.success("Role updated");
      } else {
        await rolesApi.create(payload);
        toast.success("Role created");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="role-form-title">
      <form onSubmit={handleSubmit} className="modal-content max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <h3 id="role-form-title" className="text-lg font-brand text-[hsl(var(--foreground))]">
            {role ? "Edit role" : "New custom role"}
          </h3>
          <button type="button" onClick={onClose} disabled={saving} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="space-y-2 block">
          <span className="text-sm font-medium">Name *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder="e.g. Song Editor" autoFocus disabled={saving} />
        </label>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Description</span>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input w-full" placeholder="What this role is for" disabled={saving} />
        </label>

        <div className="space-y-3">
          <span className="text-sm font-medium">Permissions</span>
          {PERMISSION_CATEGORIES.map((category) => (
            <div key={category.key} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                {category.label}
              </p>
              {category.permissions.map((permission) => (
                <label key={permission.id} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission.id)}
                    onChange={() => togglePermission(permission.id)}
                    className="mt-0.5 rounded accent-[hsl(var(--secondary))]"
                    disabled={saving}
                  />
                  <span>
                    {permission.label}
                    <span className="block text-xs text-[hsl(var(--muted-foreground))]">{permission.description}</span>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-outline btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving || !name.trim()} className="btn-primary btn-sm">
            {saving ? "Saving..." : role ? "Save" : "Create role"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Roles & permissions manager for the admin page: shows the three built-in
 * roles (read-only) and lets admins create custom roles with explicit
 * permission grants.
 */
export function RolesPermissionsManager() {
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [formRole, setFormRole] = useState<OrgRole | null | undefined>(undefined); // undefined = closed, null = create
  const [pendingDelete, setPendingDelete] = useState<OrgRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    rolesApi
      .list()
      .then((res) => setRoles(res.roles))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await rolesApi.delete(pendingDelete.id);
      toast.success("Role deleted — members fall back to their base role");
      setPendingDelete(null);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="section-header">
        <h3 className="section-title">
          <ShieldCheck className="section-title-icon" /> Roles &amp; Permissions
        </h3>
        <button onClick={() => setFormRole(null)} className="btn-primary btn-sm">
          <Plus className="h-4 w-4" /> New role
        </button>
      </div>

      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        Built-in roles cover most teams. Custom roles replace a member's default permissions with an explicit set.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {roles.map((role) => (
          <div key={role.id} className="card card-body space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {role.isSystem ? (
                  <Lock className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--secondary))] shrink-0" />
                )}
                <span className="font-medium truncate">{role.name}</span>
                {role.isSystem && <span className="badge badge-muted shrink-0">Built-in</span>}
              </div>
              {!role.isSystem && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setFormRole(role)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Edit role">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setPendingDelete(role)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" title="Delete role">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {role.description && <p className="text-xs text-[hsl(var(--muted-foreground))]">{role.description}</p>}
            <div className="flex flex-wrap gap-1">
              {role.permissions.length === 0 ? (
                <span className="badge badge-muted">Read-only</span>
              ) : (
                role.permissions.map((permission) => (
                  <span key={permission} className="badge badge-muted">
                    {permission}
                  </span>
                ))
              )}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {role.memberCount ?? 0} member{(role.memberCount ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>

      {formRole !== undefined && (
        <RoleFormDialog role={formRole} onClose={() => setFormRole(undefined)} onSaved={refresh} />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : "Delete role?"}
        description="Members with this role fall back to their built-in role."
        confirmLabel="Delete role"
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
