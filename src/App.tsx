import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db/db";
import { repairIntegrity, SettingsRepository, TaskRepository } from "./db/repositories";
import { checkAndNotify } from "./lib/notifications";
import { sortActiveTasks } from "./lib/size";
import type { FolderFilter, MainTab, Task } from "./types";
import { BalloonField } from "./components/BalloonField";
import { BottomNav } from "./components/BottomNav";
import { CompletedList, TrashList } from "./components/HistoryLists";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { FolderFilterBar } from "./components/FolderFilterBar";
import { FolderManageModal } from "./components/FolderManageModal";
import { SearchBar } from "./components/SearchBar";
import { SettingsScreen } from "./components/SettingsScreen";
import { TaskCreateModal } from "./components/TaskCreateModal";
import { TaskDetailSheet } from "./components/TaskDetailSheet";
import { Toast, type ToastState } from "./components/Toast";
import { BackIcon, GearIcon, SearchIcon } from "./components/icons";
import type { TaskFormValues } from "./components/TaskForm";

const POP_DURATION_MS = 420;
const UNDO_TOAST_MS = 5000;

const STATUS_BY_TAB: Record<MainTab, Task["status"]> = {
  active: "active",
  completed: "completed",
  trash: "trashed",
};

export default function App() {
  const [tab, setTab] = useState<MainTab>("active");
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"main" | "settings">("main");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [folderManageOpen, setFolderManageOpen] = useState(false);
  const [poppingIds, setPoppingIds] = useState<Set<string>>(new Set());
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [now, setNow] = useState(() => new Date());

  const toastTimer = useRef<number | undefined>(undefined);
  const lastNotifyCheck = useRef(new Date());

  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const folders = useLiveQuery(() => db.folders.orderBy("createdAt").toArray(), []) ?? [];
  // liveQueryは読み取り専用のため、設定レコードの初期化は起動時エフェクトで行う
  const settings = useLiveQuery(() => db.settings.get("app"), []);

  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  // 起動時: 設定の初期化、整合性確認、ゴミ箱の自動完全削除 (以後24時間ごと)
  useEffect(() => {
    void SettingsRepository.get();
    void repairIntegrity();
    void TaskRepository.purgeExpiredTrash();
    const id = window.setInterval(() => void TaskRepository.purgeExpiredTrash(), 24 * 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // 現在時刻の更新: 1分ごと + フォアグラウンド復帰時 (サイズ再計算用)
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // 通知判定: 1分ごと + フォアグラウンド復帰時
  useEffect(() => {
    const check = async () => {
      const current = new Date();
      await checkAndNotify(lastNotifyCheck.current, current);
      lastNotifyCheck.current = current;
    };
    const id = window.setInterval(() => void check(), 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // 削除されたフォルダがフィルタに残っていたらリセット
  useEffect(() => {
    if (folderFilter !== "all" && folderFilter !== "none" && !folderMap.has(folderFilter)) {
      setFolderFilter("all");
    }
  }, [folderFilter, folderMap]);

  const showToast = useCallback((next: ToastState, duration = UNDO_TOAST_MS) => {
    window.clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  const dismissToast = useCallback(() => {
    window.clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  // 現在のタブ + フォルダフィルタ + 検索を適用
  const visibleTasks = useMemo(() => {
    const status = STATUS_BY_TAB[tab];
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (t.status !== status) return false;
      if (folderFilter === "none" && t.folderId !== null) return false;
      if (folderFilter !== "all" && folderFilter !== "none" && t.folderId !== folderFilter) return false;
      if (query && !t.title.toLowerCase().includes(query) && !t.memo.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [tasks, tab, folderFilter, searchQuery]);

  const activeTasks = useMemo(() => sortActiveTasks(visibleTasks, now), [visibleTasks, now]);
  const completedTasks = useMemo(
    () =>
      [...visibleTasks].sort(
        (a, b) => new Date(b.completedAt ?? b.updatedAt).getTime() - new Date(a.completedAt ?? a.updatedAt).getTime(),
      ),
    [visibleTasks],
  );
  const trashedTasks = useMemo(
    () =>
      [...visibleTasks].sort(
        (a, b) => new Date(b.deletedAt ?? b.updatedAt).getTime() - new Date(a.deletedAt ?? a.updatedAt).getTime(),
      ),
    [visibleTasks],
  );

  const detailTask = detailTaskId ? tasks.find((t) => t.id === detailTaskId) ?? null : null;

  const handleError = useCallback(
    (message: string) => showToast({ message, error: true }),
    [showToast],
  );

  const createTask = async (values: TaskFormValues) => {
    try {
      await TaskRepository.create(values);
      setCreateOpen(false);
      setNow(new Date());
    } catch {
      handleError("タスクの保存に失敗しました。");
    }
  };

  const openCreate = async () => {
    setCreateOpen(true);
    if (settings && !settings.firstTaskHintDismissed) {
      await SettingsRepository.update({ firstTaskHintDismissed: true });
    }
  };

  const completeTask = (id: string) => {
    if (poppingIds.has(id)) return;
    setDetailTaskId(null);
    setPoppingIds((prev) => new Set(prev).add(id));
    window.setTimeout(async () => {
      try {
        await TaskRepository.complete(id);
        showToast({
          message: "タスクを完了しました",
          actionLabel: "元に戻す",
          onAction: () => {
            void TaskRepository.reactivate(id);
            dismissToast();
          },
        });
      } catch {
        handleError("完了の保存に失敗しました。");
      } finally {
        setPoppingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }, POP_DURATION_MS);
  };

  const saveTask = async (id: string, values: TaskFormValues) => {
    try {
      await TaskRepository.update(id, values);
      setDetailTaskId(null);
      setNow(new Date());
    } catch {
      handleError("タスクの保存に失敗しました。");
    }
  };

  const trashTask = async (id: string) => {
    try {
      setDetailTaskId(null);
      await TaskRepository.moveToTrash(id);
      showToast({
        message: "ゴミ箱に移動しました",
        actionLabel: "元に戻す",
        onAction: () => {
          void TaskRepository.restoreFromTrash(id);
          dismissToast();
        },
      });
    } catch {
      handleError("削除に失敗しました。");
    }
  };

  const reactivateTask = async (id: string) => {
    try {
      await TaskRepository.reactivate(id);
      setNow(new Date());
    } catch {
      handleError("操作に失敗しました。");
    }
  };

  const restoreTask = async (id: string) => {
    try {
      await TaskRepository.restoreFromTrash(id);
      setNow(new Date());
    } catch {
      handleError("復元に失敗しました。");
    }
  };

  const deletePermanently = async () => {
    if (!permanentDeleteId) return;
    try {
      await TaskRepository.deletePermanently(permanentDeleteId);
    } catch {
      handleError("完全削除に失敗しました。");
    }
    setPermanentDeleteId(null);
  };

  const showFirstTaskHint =
    view === "main" && tab === "active" && settings != null && !settings.firstTaskHintDismissed;

  return (
    <div className="app">
      <header className="app-header">
        {view === "settings" ? (
          <>
            <button type="button" className="icon-button" onClick={() => setView("main")} aria-label="戻る">
              <BackIcon />
            </button>
            <h1>設定</h1>
          </>
        ) : (
          <>
            <h1>
              <span aria-hidden="true">🎈</span> PopTask
            </h1>
            <button
              type="button"
              className="icon-button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="検索"
              aria-expanded={searchOpen}
            >
              <SearchIcon />
            </button>
            <button type="button" className="icon-button" onClick={() => setView("settings")} aria-label="設定">
              <GearIcon />
            </button>
          </>
        )}
      </header>

      {view === "settings" ? (
        <main className="app-main">
          <SettingsScreen
            notificationsEnabled={settings?.notificationsEnabled ?? false}
            onNotify={(message, error) => showToast({ message, error })}
          />
        </main>
      ) : (
        <>
          {searchOpen && (
            <SearchBar
              onChange={setSearchQuery}
              onClose={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            />
          )}
          <FolderFilterBar
            folders={folders}
            filter={folderFilter}
            onChange={setFolderFilter}
            onManage={() => setFolderManageOpen(true)}
          />
          <main className="app-main">
            {tab === "active" && (
              <>
                <BalloonField
                  tasks={activeTasks}
                  folders={folderMap}
                  now={now}
                  poppingIds={poppingIds}
                  onTapTask={setDetailTaskId}
                />
                {activeTasks.length === 0 && (
                  <div className="empty-state">
                    <span className="empty-icon" aria-hidden="true">🎈</span>
                    <p>{searchQuery ? "一致するタスクがありません" : "タスクはありません"}</p>
                  </div>
                )}
                {showFirstTaskHint && (
                  <div className="first-task-hint">
                    <span>このボタンから最初のタスクを追加</span>
                    <button
                      type="button"
                      aria-label="ヒントを閉じる"
                      onClick={() => void SettingsRepository.update({ firstTaskHintDismissed: true })}
                    >
                      ×
                    </button>
                  </div>
                )}
                <button type="button" className="fab" onClick={() => void openCreate()} aria-label="タスクを作成">
                  +
                </button>
              </>
            )}
            {tab === "completed" && (
              <CompletedList
                tasks={completedTasks}
                folders={folderMap}
                now={now}
                onReactivate={(id) => void reactivateTask(id)}
                onDelete={(id) => void trashTask(id)}
              />
            )}
            {tab === "trash" && (
              <TrashList
                tasks={trashedTasks}
                folders={folderMap}
                now={now}
                onRestore={(id) => void restoreTask(id)}
                onDeletePermanently={setPermanentDeleteId}
              />
            )}
          </main>
        </>
      )}

      <BottomNav tab={tab} onChange={setTab} />

      {createOpen && (
        <TaskCreateModal
          folders={folders}
          defaultFolderId={folderFilter !== "all" && folderFilter !== "none" ? folderFilter : null}
          onCreate={(values) => void createTask(values)}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {detailTask && (
        <TaskDetailSheet
          task={detailTask}
          folders={folders}
          onComplete={() => completeTask(detailTask.id)}
          onSave={(values) => void saveTask(detailTask.id, values)}
          onDelete={() => void trashTask(detailTask.id)}
          onClose={() => setDetailTaskId(null)}
        />
      )}

      {folderManageOpen && (
        <FolderManageModal folders={folders} onClose={() => setFolderManageOpen(false)} onError={handleError} />
      )}

      {permanentDeleteId && (
        <ConfirmDialog
          title="完全削除の確認"
          message="このタスクを完全に削除します。この操作は元に戻せません。よろしいですか?"
          confirmLabel="完全削除"
          danger
          onConfirm={() => void deletePermanently()}
          onCancel={() => setPermanentDeleteId(null)}
        />
      )}

      {toast && <Toast toast={toast} />}
    </div>
  );
}
