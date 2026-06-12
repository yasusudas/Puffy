import { useState } from "react";
import type { Folder, InflationWindowHours } from "../types";
import { INFLATION_OPTIONS } from "../types";
import { isoToLocalInput, localInputToIso } from "../lib/time";

export interface TaskFormValues {
  title: string;
  dueAt: string; // UTC ISO
  folderId: string | null;
  inflationWindowHours: InflationWindowHours;
  memo: string;
}

interface TaskFormProps {
  folders: Folder[];
  initial?: TaskFormValues;
  /** 新規作成時のフォルダ初期値 (initial がない場合に使用) */
  defaultFolderId?: string | null;
  submitLabel: string;
  /** タスク作成時のみ期限が未来であることを必須にする */
  requireFutureDue?: boolean;
  onSubmit: (values: TaskFormValues) => void;
}

export function TaskForm({ folders, initial, defaultFolderId, submitLabel, requireFutureDue, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueLocal, setDueLocal] = useState(initial ? isoToLocalInput(initial.dueAt) : "");
  const [folderId, setFolderId] = useState<string | null>(initial?.folderId ?? defaultFolderId ?? null);
  const [inflation, setInflation] = useState<InflationWindowHours>(initial?.inflationWindowHours ?? 72);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [errors, setErrors] = useState<{ title?: string; due?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    const next: { title?: string; due?: string } = {};
    if (trimmed.length < 1 || trimmed.length > 80) {
      next.title = "タスク名は1〜80文字で入力してください。";
    }
    if (!dueLocal || Number.isNaN(new Date(dueLocal).getTime())) {
      next.due = "期限日時を入力してください。";
    } else if (requireFutureDue && new Date(dueLocal).getTime() <= Date.now()) {
      next.due = "期限は現在より後の日時を指定してください。";
    }
    setErrors(next);
    if (next.title || next.due) return;
    onSubmit({
      title: trimmed,
      dueAt: localInputToIso(dueLocal),
      folderId,
      inflationWindowHours: inflation,
      memo,
    });
  };

  return (
    <form className="modal-body" onSubmit={handleSubmit}>
      <div className="field-group">
        <label htmlFor="task-title">
          タスク名<span className="required" aria-hidden="true">*</span>
        </label>
        <input
          id="task-title"
          type="text"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          required
          aria-invalid={!!errors.title}
        />
        {errors.title && <span className="field-error" role="alert">{errors.title}</span>}
        <span className="field-counter">{title.trim().length} / 80</span>
      </div>

      <div className="field-group">
        <label htmlFor="task-due">
          期限日時<span className="required" aria-hidden="true">*</span>
        </label>
        <input
          id="task-due"
          type="datetime-local"
          value={dueLocal}
          onChange={(e) => setDueLocal(e.target.value)}
          required
          aria-invalid={!!errors.due}
        />
        {errors.due && <span className="field-error" role="alert">{errors.due}</span>}
      </div>

      <div className="field-group">
        <label htmlFor="task-folder">フォルダ</label>
        <select
          id="task-folder"
          value={folderId ?? ""}
          onChange={(e) => setFolderId(e.target.value || null)}
        >
          <option value="">未分類</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field-group">
        <span id="inflation-label" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-sub)" }}>
          膨張開始
        </span>
        <div className="segmented" role="group" aria-labelledby="inflation-label">
          {INFLATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={inflation === opt.value}
              onClick={() => setInflation(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="task-memo">メモ</label>
        <textarea
          id="task-memo"
          value={memo}
          maxLength={2000}
          onChange={(e) => setMemo(e.target.value)}
          rows={4}
        />
        <span className="field-counter">{memo.length} / 2,000</span>
      </div>

      <button type="submit" className="button-primary">
        {submitLabel}
      </button>
    </form>
  );
}
