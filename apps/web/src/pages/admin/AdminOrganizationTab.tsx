import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { orgsApi } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import { Building2, Trash2, ShieldAlert } from "lucide-react";

/** Admin → Organization: name, slug, logo. Danger zone for owners. */
export function AdminOrganizationTab() {
  const { user, activeOrg, refreshUser } = useAuth();
  const canManage = user?.role === "owner" || activeOrg?.role === "admin";
  const canDelete = user?.role === "owner";

  const [name, setName] = useState(activeOrg?.name ?? "");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setName(activeOrg?.name ?? "");
    // Fetch slug/logo from the org list (activeOrg in auth context carries name/role only)
    orgsApi
      .list()
      .then((res) => {
        const org = res.organizations.find((o) => o.id === activeOrg?.id);
        setSlug(org?.slug ?? "");
        setLogoUrl(org?.logoUrl ?? "");
      })
      .catch(() => {});
  }, [activeOrg?.id, activeOrg?.name]);

  if (!activeOrg) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">No active organization.</p>;
  }

  if (!canManage) {
    return (
      <div className="max-w-2xl py-8 text-center">
        <h3 className="text-lg font-brand mb-1">Access Denied</h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">You need admin permissions to manage the organization.</p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Organization name is required");
      return;
    }
    setSaving(true);
    try {
      await orgsApi.update(activeOrg.id, {
        name: name.trim(),
        slug: slug.trim() || null,
        logoUrl: logoUrl.trim() || null,
      });
      await refreshUser();
      toast.success("Organization updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update organization");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await orgsApi.remove(activeOrg.id);
      await refreshUser();
      toast.success("Organization deleted");
      setShowDeleteConfirm(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete organization");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="space-y-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h3 className="flex items-center gap-2 text-lg font-brand">
          <Building2 className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Organization
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Name *</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" disabled={saving} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-2 block">
              <span className="text-sm font-medium">Slug</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                className="input w-full"
                placeholder="my-team"
                pattern="[a-z0-9-]*"
                disabled={saving}
              />
            </label>
            <label className="space-y-2 block">
              <span className="text-sm font-medium">Logo URL</span>
              <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="input w-full" placeholder="https://…" disabled={saving} />
            </label>
          </div>
          {logoUrl && <img src={logoUrl} alt="Organization logo preview" className="h-16 w-16 rounded-md object-cover border border-[hsl(var(--border))]" />}
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? "Saving..." : "Save Organization"}
          </button>
        </form>
      </section>

      {canDelete && (
        <footer
          aria-label="Danger zone"
          className="mt-16 flex flex-col gap-2 border-t border-[hsl(var(--border))] pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="flex items-start gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--destructive))]" />
            <span>
              Deleting this organization permanently removes songs, set lists, events, media, and memberships. This
              cannot be undone.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-[hsl(var(--destructive))]/40 px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 disabled:opacity-50 sm:self-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Organization
          </button>
        </footer>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title={`Delete organization "${activeOrg.name}"?`}
        description="This removes its songs, setlists, events, and memberships."
        confirmLabel="Delete organization"
        busy={deleting}
        onClose={() => {
          if (!deleting) setShowDeleteConfirm(false);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
