import { ModalSheet } from "./ModalSheet";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <ModalSheet title={title} onClose={onCancel}>
      <div className="confirm-box">
        <p>{message}</p>
        <div className="confirm-actions">
          <button type="button" className="button-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className={danger ? "button-danger" : "button-primary"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalSheet>
  );
}
