import type { Folder, FolderFilter } from "../types";
import { colorHex, UNFILED_COLOR } from "../lib/colors";
import { FolderCogIcon } from "./icons";

interface FolderFilterBarProps {
  folders: Folder[];
  filter: FolderFilter;
  onChange: (filter: FolderFilter) => void;
  onManage: () => void;
}

export function FolderFilterBar({ folders, filter, onChange, onManage }: FolderFilterBarProps) {
  return (
    <div className="folder-bar" role="toolbar" aria-label="フォルダフィルタ">
      <button
        type="button"
        className="folder-chip"
        aria-pressed={filter === "all"}
        onClick={() => onChange("all")}
      >
        すべて
      </button>
      <button
        type="button"
        className="folder-chip"
        aria-pressed={filter === "none"}
        onClick={() => onChange("none")}
      >
        <span className="chip-dot" style={{ background: UNFILED_COLOR }} aria-hidden="true" />
        未分類
      </button>
      {folders.map((f) => (
        <button
          key={f.id}
          type="button"
          className="folder-chip"
          aria-pressed={filter === f.id}
          onClick={() => onChange(f.id)}
        >
          <span className="chip-dot" style={{ background: colorHex(f.colorId) }} aria-hidden="true" />
          {f.name}
        </button>
      ))}
      <button
        type="button"
        className="icon-button folder-manage-button"
        onClick={onManage}
        aria-label="フォルダを管理"
      >
        <FolderCogIcon />
      </button>
    </div>
  );
}
