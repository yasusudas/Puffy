import type { Folder, Task } from "../types";
import { TRASH_RETENTION_DAYS } from "../types";
import { colorHex, UNFILED_COLOR } from "../lib/colors";
import { formatDateTime, formatDue, trashDaysLeft } from "../lib/time";

interface CardProps {
  task: Task;
  folders: Map<string, Folder>;
  now: Date;
}

function folderInfo(task: Task, folders: Map<string, Folder>) {
  const folder = task.folderId ? folders.get(task.folderId) : undefined;
  return {
    name: folder?.name ?? "未分類",
    color: folder ? colorHex(folder.colorId) : UNFILED_COLOR,
  };
}

interface CompletedListProps extends Omit<CardProps, "task"> {
  tasks: Task[];
  onReactivate: (id: string) => void;
  onDelete: (id: string) => void;
}

/** 完了タブ: 完了日時付きの履歴カード */
export function CompletedList({ tasks, folders, now, onReactivate, onDelete }: CompletedListProps) {
  if (tasks.length === 0) {
    return (
      <div className="empty-state" style={{ position: "static", padding: 48 }}>
        <span className="empty-icon" aria-hidden="true">🎈</span>
        <p>完了したタスクはまだありません</p>
      </div>
    );
  }
  return (
    <ul className="card-list" style={{ listStyle: "none" }}>
      {tasks.map((task) => {
        const f = folderInfo(task, folders);
        return (
          <li className="history-card" key={task.id}>
            <span className="card-color" style={{ background: f.color }} aria-hidden="true" />
            <div className="card-main">
              <p className="card-title">{task.title}</p>
              <p className="card-sub">
                <span>完了 {task.completedAt ? formatDateTime(task.completedAt) : "-"}</span>
                <span>期限 {formatDue(task.dueAt, now)}</span>
                <span>{f.name}</span>
              </p>
            </div>
            <div className="card-actions">
              <button type="button" className="card-action" onClick={() => onReactivate(task.id)}>
                未完了に戻す
              </button>
              <button type="button" className="card-action danger" onClick={() => onDelete(task.id)}>
                削除
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface TrashListProps extends Omit<CardProps, "task"> {
  tasks: Task[];
  onRestore: (id: string) => void;
  onDeletePermanently: (id: string) => void;
}

/** ゴミ箱タブ: 残り保持日数付きの履歴カード */
export function TrashList({ tasks, folders, now, onRestore, onDeletePermanently }: TrashListProps) {
  if (tasks.length === 0) {
    return (
      <div className="empty-state" style={{ position: "static", padding: 48 }}>
        <span className="empty-icon" aria-hidden="true">🗑️</span>
        <p>ゴミ箱は空です</p>
      </div>
    );
  }
  return (
    <ul className="card-list" style={{ listStyle: "none" }}>
      {tasks.map((task) => {
        const f = folderInfo(task, folders);
        const daysLeft = task.deletedAt ? trashDaysLeft(task.deletedAt, TRASH_RETENTION_DAYS, now) : TRASH_RETENTION_DAYS;
        return (
          <li className="history-card" key={task.id}>
            <span className="card-color" style={{ background: f.color }} aria-hidden="true" />
            <div className="card-main">
              <p className="card-title">{task.title}</p>
              <p className="card-sub">
                <span>残り{daysLeft}日で完全削除</span>
                <span>期限 {formatDue(task.dueAt, now)}</span>
                <span>{f.name}</span>
                <span>{task.preTrashStatus === "completed" ? "完了から削除" : "未完了から削除"}</span>
              </p>
            </div>
            <div className="card-actions">
              <button type="button" className="card-action" onClick={() => onRestore(task.id)}>
                復元
              </button>
              <button type="button" className="card-action danger" onClick={() => onDeletePermanently(task.id)}>
                完全削除
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
