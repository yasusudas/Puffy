export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  error?: boolean;
}

interface ToastProps {
  toast: ToastState;
}

export function Toast({ toast }: ToastProps) {
  return (
    <div className={`toast${toast.error ? " error" : ""}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button type="button" onClick={toast.onAction}>
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
