import { useState } from "react";
import type { Folder, FolderColorId, InflationWindowHours } from "../types";
import { INFLATION_OPTIONS } from "../types";
import { TASK_COLOR_ROW1, TASK_COLOR_ROW2, folderColorById } from "../lib/colors";
import { isoToLocalInput, localInputToIso } from "../lib/time";

export interface TaskFormValues {
  title: string;
  dueAt: string; // UTC ISO
  folderId: string | null;
  colorId: FolderColorId | null;
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
  /** 期限超過中: カラーピッカーを選択不可にする */
  colorDisabled?: boolean;
  onSubmit: (values: TaskFormValues) => void;
}

export function TaskForm({ folders, initial, defaultFolderId, submitLabel, requireFutureDue, colorDisabled, onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [dueLocal, setDueLocal] = useState(initial ? isoToLocalInput(initial.dueAt) : "");
  const [folderId, setFolderId] = useState<string | null>(initial?.folderId ?? defaultFolderId ?? null);
  const [colorId, setColorId] = useState<FolderColorId | null>(initial?.colorId ?? null);
  const [inflation, setInflation] = useState<InflationWindowHours>(initial?.inflationWindowHours ?? 72);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [errors, setErrors] = useState<{ title?: string; due?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    const next: { title?: string; due?: string } = {};
    if (trimmed.length < 1) {
      next.title = "タスク名を入力してください。";
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
      colorId,
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
          onChange={(e) => setTitle(e.target.value)}
          required
          aria-invalid={!!errors.title}
        />
        {errors.title && <span className="field-error" role="alert">{errors.title}</span>}
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
        <span id="color-label" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-sub)" }}>
          風船の色
        </span>
        <div
          className={`color-swatches task-color-swatches${colorDisabled ? " is-disabled" : ""}`}
          role="group"
          aria-labelledby="color-label"
          aria-disabled={colorDisabled}
        >
          <div className="color-swatches-row">
            {TASK_COLOR_ROW1.map((id) =>
              id === "auto" ? (
                <button
                  key="auto"
                  type="button"
                  className={`color-swatch color-swatch-default${colorId === null ? " is-selected" : ""}`}
                  aria-pressed={colorId === null}
                  aria-label="フォルダの色に従う"
                  title="フォルダの色に従う"
                  disabled={colorDisabled}
                  onClick={() => setColorId(null)}
                >
                  自動
                </button>
              ) : (
                (() => {
                  const c = folderColorById(id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`color-swatch${colorId === c.id ? " is-selected" : ""}`}
                      style={{ backgroundColor: c.hex }}
                      aria-pressed={colorId === c.id}
                      aria-label={c.label}
                      title={c.label}
                      disabled={colorDisabled}
                      onClick={() => setColorId(c.id)}
                    />
                  );
                })()
              ),
            )}
          </div>
          <div className="color-swatches-row">
            {TASK_COLOR_ROW2.map((id) => {
              const c = folderColorById(id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`color-swatch${colorId === c.id ? " is-selected" : ""}`}
                  style={{ backgroundColor: c.hex }}
                  aria-pressed={colorId === c.id}
                  aria-label={c.label}
                  title={c.label}
                  disabled={colorDisabled}
                  onClick={() => setColorId(c.id)}
                />
              );
            })}
          </div>
        </div>
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
          onChange={(e) => setMemo(e.target.value)}
          rows={4}
        />
      </div>

      <button type="submit" className="button-primary">
        {submitLabel}
      </button>
    </form>
  );
}
