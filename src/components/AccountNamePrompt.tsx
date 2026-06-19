import { useState } from "react";
import { SettingsRepository } from "../db/repositories";
import { ModalSheet } from "./ModalSheet";

const MAX_ACCOUNT_NAME_LENGTH = 24;

interface AccountNamePromptProps {
  onComplete: (message: string) => void;
  onSkip: () => void;
}

export function AccountNamePrompt({ onComplete, onSkip }: AccountNamePromptProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("アカウント名を入力してください。");
      return;
    }
    if (trimmed.length > MAX_ACCOUNT_NAME_LENGTH) {
      setError(`アカウント名は${MAX_ACCOUNT_NAME_LENGTH}文字以内にしてください。`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await SettingsRepository.update({ accountName: trimmed });
      onComplete("アカウント名を設定しました。");
    } catch {
      setError("保存に失敗しました。");
      setSaving(false);
    }
  };

  return (
    <ModalSheet title="アカウント名を設定" onClose={onSkip}>
      <div className="modal-body account-name-prompt">
        <p>表示用のアカウント名を決められます。あとから設定画面で変更できます。</p>
        <div className="field-group">
          <label htmlFor="account-name-input">アカウント名</label>
          <input
            id="account-name-input"
            type="text"
            value={name}
            maxLength={MAX_ACCOUNT_NAME_LENGTH}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
          />
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="account-name-prompt-actions">
          <button type="button" className="button-primary auth-submit" disabled={saving} onClick={() => void save()}>
            {saving ? "保存中..." : "保存"}
          </button>
          <button type="button" className="button-ghost" disabled={saving} onClick={onSkip}>
            後で
          </button>
        </div>
      </div>
    </ModalSheet>
  );
}

export { MAX_ACCOUNT_NAME_LENGTH };
