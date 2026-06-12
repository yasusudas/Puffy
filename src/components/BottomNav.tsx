import type { MainTab } from "../types";
import { BalloonTabIcon, CheckCircleIcon, TrashIcon } from "./icons";

interface BottomNavProps {
  tab: MainTab;
  onChange: (tab: MainTab) => void;
}

const TABS: { id: MainTab; label: string; icon: typeof BalloonTabIcon }[] = [
  { id: "active", label: "未完了", icon: BalloonTabIcon },
  { id: "completed", label: "完了", icon: CheckCircleIcon },
  { id: "trash", label: "ゴミ箱", icon: TrashIcon },
];

export function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主タブ">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={tab === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
