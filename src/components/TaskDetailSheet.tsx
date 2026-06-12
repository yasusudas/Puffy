import type { Folder, Task } from "../types";
import { ModalSheet } from "./ModalSheet";
import { TaskForm, type TaskFormValues } from "./TaskForm";

interface TaskDetailSheetProps {
  task: Task;
  folders: Folder[];
  onComplete: () => void;
  onSave: (values: TaskFormValues) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskDetailSheet({ task, folders, onComplete, onSave, onDelete, onClose }: TaskDetailSheetProps) {
  return (
    <ModalSheet title="タスクの詳細" onClose={onClose}>
      <div style={{ padding: "0 16px" }}>
        <button type="button" className="button-complete" style={{ width: "100%" }} onClick={onComplete}>
          ✓ 完了して風船を割る
        </button>
      </div>
      <TaskForm
        folders={folders}
        initial={{
          title: task.title,
          dueAt: task.dueAt,
          folderId: task.folderId,
          inflationWindowHours: task.inflationWindowHours,
          memo: task.memo,
        }}
        submitLabel="変更を保存"
        onSubmit={onSave}
      />
      <button type="button" className="button-text-danger" onClick={onDelete} style={{ marginBottom: 12 }}>
        このタスクを削除
      </button>
    </ModalSheet>
  );
}
