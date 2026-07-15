import { ResponsiveModal } from "@/components/ui/ResponsiveModal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      maxWidthClass="max-w-md"
      showCloseButton={false}
    >
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          className={destructive ? "btn-destructive" : "btn-primary"}
          disabled={busy}
        >
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </ResponsiveModal>
  );
}
