import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

interface ModalSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  headerExtra?: ReactNode;
  initialFocus?: "dialog" | "first-field";
}

/** 下から出るモーダルシート (デスクトップでは中央ダイアログ) */
export function ModalSheet({ title, onClose, children, headerExtra, initialFocus = "first-field" }: ModalSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    if (initialFocus === "dialog") {
      sheetRef.current?.focus();
    } else {
      // 開いた時に入力欄へ移動 (完了ボタンより先にフォーカスし、誤操作を避ける)
      const focusable =
        sheetRef.current?.querySelector<HTMLElement>("#task-title")
        ?? sheetRef.current?.querySelector<HTMLElement>("input, textarea, select");
      focusable?.focus();
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [initialFocus, onClose]);

  return (
    <div
      className="modal-backdrop"
      // clickだと風船タップ直後のゴーストクリックで即閉じするためpointerdownで判定する
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label={title} ref={sheetRef} tabIndex={-1}>
        <div className="modal-header">
          <h2>{title}</h2>
          {headerExtra}
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="閉じる">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-scroll">{children}</div>
      </div>
    </div>
  );
}
