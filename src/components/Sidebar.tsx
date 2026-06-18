import type { MainTab } from "../types";
import { BalloonLogo, BalloonTabIcon, CheckCircleIcon, GearIcon, TrashIcon } from "./icons";

interface SidebarProps {
  tab: MainTab;
  view: "main" | "settings";
  activeCount: number;
  overdueCount: number;
  onSelectTab: (tab: MainTab) => void;
  onOpenSettings: () => void;
}

const NAV_ITEMS: { id: MainTab; label: string; icon: typeof BalloonTabIcon }[] = [
  { id: "active", label: "未完了", icon: BalloonTabIcon },
  { id: "completed", label: "完了", icon: CheckCircleIcon },
  { id: "trash", label: "ゴミ箱", icon: TrashIcon },
];

/** タブレット・デスクトップ用の左サイドバーナビゲーション */
export function Sidebar({ tab, view, activeCount, overdueCount, onSelectTab, onOpenSettings }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <BalloonLogo size={30} />
        <span>Puffy</span>
      </div>
      <nav className="sidebar-nav" aria-label="主タブ">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="sidebar-item"
            aria-current={view === "main" && tab === id ? "page" : undefined}
            onClick={() => onSelectTab(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
            {id === "active" && activeCount > 0 && (
              <span
                className={`sidebar-badge${overdueCount > 0 ? " warn" : ""}`}
                aria-label={
                  overdueCount > 0 ? `未完了${activeCount}件、うち期限超過${overdueCount}件` : `未完了${activeCount}件`
                }
              >
                {activeCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-item"
          aria-current={view === "settings" ? "page" : undefined}
          onClick={onOpenSettings}
        >
          <GearIcon size={20} />
          <span>設定</span>
        </button>
      </div>
    </aside>
  );
}
