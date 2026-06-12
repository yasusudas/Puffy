import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  onChange: (query: string) => void;
  onClose: () => void;
}

/** 150msデバウンス付きの検索バー */
export function SearchBar({ onChange, onClose }: SearchBarProps) {
  const [value, setValue] = useState("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(value), 150);
    return () => window.clearTimeout(timer.current);
  }, [value, onChange]);

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="タスク名・メモを検索"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="タスク名・メモを検索"
        autoFocus
      />
      <button
        type="button"
        className="button-secondary"
        onClick={() => {
          setValue("");
          onChange("");
          onClose();
        }}
      >
        閉じる
      </button>
    </div>
  );
}
