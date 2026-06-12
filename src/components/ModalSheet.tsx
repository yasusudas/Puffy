import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

interface ModalSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  headerExtra?: ReactNode;
}

/** 下から出るモーダルシート (デスクトップでは中央ダイアログ) */
export function ModalSheet({ title, onClose, children, headerExtra }: ModalSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // 開いた時に最初のフォーカス可能要素へ移動
    const focusable = sheetRef.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not(.modal-close)",
    );
    focusable?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      // clickだと風船タップ直後のゴーストクリックで即閉じするためpointerdownで判定する
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label={title} ref={sheetRef}>
        <div className="modal-header">
          <h2>{title}</h2>
          {headerExtra}
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="閉じる">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
