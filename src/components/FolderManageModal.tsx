import { useState } from "react";
import type { Folder, FolderColorId } from "../types";
import { FOLDER_COLOR_ROW1, FOLDER_COLOR_ROW2, colorHex, folderColorById, pickUnusedColor } from "../lib/colors";
import { FolderRepository } from "../db/repositories";
import { ModalSheet } from "./ModalSheet";
import { ConfirmDialog } from "./ConfirmDialog";
import { CheckIcon, PlusIcon } from "./icons";

interface FolderManageModalProps {
  folders: Folder[];
  onClose: () => void;
  onError: (message: string) => void;
}

interface EditorState {
  mode: "create" | "edit";
  folderId?: string;
  name: string;
  colorId: FolderColorId;
}

export function FolderManageModal({ folders, onClose, onError }: FolderManageModalProps) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleting, setDeleting] = useState<Folder | null>(null);
  const [nameError, setNameError] = useState("");

  const openCreate = () => {
    setNameError("");
    setEditor({
      mode: "create",
      name: "",
      colorId: pickUnusedColor(folders.map((f) => f.colorId)),
    });
  };

  const openEdit = (folder: Folder) => {
    setNameError("");
    setEditor({ mode: "edit", folderId: folder.id, name: folder.name, colorId: folder.colorId });
  };

  const save = async () => {
    if (!editor) return;
    const name = editor.name.trim();
    if (name.length < 1 || name.length > 30) {
      setNameError("フォルダ名は1〜30文字で入力してください。");
      return;
    }
    if (await FolderRepository.isNameTaken(name, editor.folderId)) {
      setNameError("同じ名前のフォルダがすでに存在します。");
      return;
    }
    try {
      if (editor.mode === "create") {
        await FolderRepository.create(name, editor.colorId);
      } else if (editor.folderId) {
        await FolderRepository.update(editor.folderId, { name, colorId: editor.colorId });
      }
      setEditor(null);
    } catch {
      onError("フォルダの保存に失敗しました。");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await FolderRepository.remove(deleting.id);
      setDeleting(null);
    } catch {
      onError("フォルダの削除に失敗しました。");
    }
  };

  if (deleting) {
    return (
      <ConfirmDialog
        title="フォルダを削除"
        message={`フォルダ「${deleting.name}」を削除します。所属しているタスクはすべて未分類に移動します。よろしいですか?`}
        confirmLabel="削除する"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    );
  }

  if (editor) {
    return (
      <ModalSheet
        title={editor.mode === "create" ? "フォルダを作成" : "フォルダを編集"}
        onClose={() => setEditor(null)}
      >
        <div className="modal-body">
          <div className="field-group">
            <label htmlFor="folder-name">
              フォルダ名<span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="folder-name"
              type="text"
              value={editor.name}
              maxLength={30}
              onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              aria-invalid={!!nameError}
            />
            {nameError && <span className="field-error" role="alert">{nameError}</span>}
            <span className="field-counter">{editor.name.trim().length} / 30</span>
          </div>
          <div className="field-group">
            <span id="color-label" style={{ fontSize: 13, fontWeight: 700, color: "var(--text-sub)" }}>
              色
            </span>
            <div className="color-swatches folder-color-swatches" role="group" aria-labelledby="color-label">
              <div className="color-swatches-row">
                {FOLDER_COLOR_ROW1.map((id) => {
                  const c = folderColorById(id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="color-swatch"
                      style={{ background: c.hex }}
                      aria-pressed={editor.colorId === c.id}
                      aria-label={c.label}
                      onClick={() => setEditor({ ...editor, colorId: c.id })}
                    >
                      {editor.colorId === c.id && <CheckIcon size={14} />}
                    </button>
                  );
                })}
              </div>
              <div className="color-swatches-row">
                {FOLDER_COLOR_ROW2.map((id) => {
                  const c = folderColorById(id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="color-swatch"
                      style={{ background: c.hex }}
                      aria-pressed={editor.colorId === c.id}
                      aria-label={c.label}
                      onClick={() => setEditor({ ...editor, colorId: c.id })}
                    >
                      {editor.colorId === c.id && <CheckIcon size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button type="button" className="button-primary" onClick={save}>
            {editor.mode === "create" ? "作成" : "保存"}
          </button>
        </div>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet title="フォルダの管理" onClose={onClose}>
      <div className="modal-body">
        {folders.length === 0 && <p style={{ color: "var(--text-sub)", fontSize: 14 }}>フォルダはまだありません。</p>}
        {folders.map((f) => (
          <div className="folder-row" key={f.id}>
            <span className="chip-dot" style={{ background: colorHex(f.colorId), width: 14, height: 14, borderRadius: "50%", flexShrink: 0 }} aria-hidden="true" />
            <span className="folder-name">{f.name}</span>
            <button type="button" className="card-action" onClick={() => openEdit(f)}>
              編集
            </button>
            <button type="button" className="card-action danger" onClick={() => setDeleting(f)}>
              削除
            </button>
          </div>
        ))}
        <button type="button" className="button-primary with-icon" onClick={openCreate}>
          <PlusIcon size={18} />
          新しいフォルダ
        </button>
      </div>
    </ModalSheet>
  );
}
