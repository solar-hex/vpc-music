import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { templatesApi, type SetlistTemplate } from "@/lib/api-client";
import { useApiList } from "@/hooks/useApiList";
import { useAuth } from "@/contexts/AuthContext";
import { CardGrid } from "@/components/shared/CardGrid";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LayoutTemplate, Plus, Pencil, Trash2, Play, X } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

function TemplateFormDialog({
  template,
  onClose,
  onSaved,
}: {
  template: SetlistTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [slots, setSlots] = useState<string[]>(template?.structure.map((slot) => slot.label) ?? ["Opener", "Slow", "Closer"]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const structure = slots.map((label) => ({ label: label.trim() })).filter((slot) => slot.label);
    if (!title.trim() || structure.length === 0) {
      toast.error("A title and at least one slot are required");
      return;
    }
    setSaving(true);
    try {
      if (template) {
        await templatesApi.update(template.id, { title: title.trim(), description: description.trim() || undefined, structure });
        toast.success("Template updated");
      } else {
        await templatesApi.create({ title: title.trim(), description: description.trim() || undefined, structure });
        toast.success("Template created");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="template-form-title">
      <form onSubmit={handleSubmit} className="modal-content max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 id="template-form-title" className="text-lg font-brand text-[hsl(var(--foreground))]">
          {template ? "Edit template" : "New template"}
        </h3>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Title *</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full" placeholder="Sunday service" autoFocus disabled={saving} />
        </label>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Description</span>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input w-full" placeholder="2 fast, 1 mid, 2 slow, closer" disabled={saving} />
        </label>
        <div className="space-y-2">
          <span className="text-sm font-medium">Slots (in order)</span>
          {slots.map((label, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-5 text-right text-xs text-[hsl(var(--muted-foreground))]">{index + 1}.</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setSlots((prev) => prev.map((s, i) => (i === index ? e.target.value : s)))}
                className="input flex-1"
                placeholder="Slot role, e.g. Fast opener"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setSlots((prev) => prev.filter((_, i) => i !== index))}
                className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                aria-label={`Remove slot ${index + 1}`}
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setSlots((prev) => [...prev, ""])} className="btn-outline btn-sm" disabled={saving}>
            <Plus className="h-4 w-4" /> Add slot
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-outline btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? "Saving..." : template ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Set Lists → Templates: reusable set structures with labelled slots. */
export function TemplatesPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const navigate = useNavigate();
  const { data: templates, setData: setTemplates, loading, refresh } = useApiList<SetlistTemplate[]>(
    () => templatesApi.list().then((res) => res.templates),
    [],
  );
  const [formTemplate, setFormTemplate] = useState<SetlistTemplate | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<SetlistTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = async (template: SetlistTemplate) => {
    setApplyingId(template.id);
    try {
      const res = await templatesApi.apply(template.id);
      toast.success(`Set list created with ${res.slotCount} slots`);
      navigate(`/setlists/${res.setlist.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to apply template");
    } finally {
      setApplyingId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await templatesApi.delete(pendingDelete.id);
      setTemplates((prev) => prev.filter((t) => t.id !== pendingDelete.id));
      toast.success("Template deleted");
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h3 className="section-title">
          <LayoutTemplate className="section-title-icon" /> Templates
        </h3>
        {canEdit && (
          <button onClick={() => setFormTemplate(null)} className="btn-primary btn-sm">
            <Plus className="h-4 w-4" /> New template
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          message="Templates capture a set's shape once so every week starts pre-structured."
          action={
            canEdit ? (
              <button onClick={() => setFormTemplate(null)} className="btn-primary">
                <Plus className="h-4 w-4" /> Create template
              </button>
            ) : undefined
          }
        />
      ) : (
        <CardGrid>
          {templates.map((template) => (
            <div key={template.id} className="card card-body space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{template.title}</span>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setFormTemplate(template)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setPendingDelete(template)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {template.description && <p className="text-xs text-[hsl(var(--muted-foreground))]">{template.description}</p>}
              <ol className="space-y-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                {template.structure.map((slot, index) => (
                  <li key={index}>
                    {index + 1}. {slot.label}
                  </li>
                ))}
              </ol>
              {canEdit && (
                <button onClick={() => void handleApply(template)} disabled={applyingId === template.id} className="btn-outline btn-sm w-fit">
                  <Play className="h-4 w-4" /> {applyingId === template.id ? "Creating…" : "Use template"}
                </button>
              )}
            </div>
          ))}
        </CardGrid>
      )}

      {formTemplate !== undefined && (
        <TemplateFormDialog template={formTemplate} onClose={() => setFormTemplate(undefined)} onSaved={refresh} />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : "Delete template?"}
        description="Set lists already created from it are unaffected."
        confirmLabel="Delete template"
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
