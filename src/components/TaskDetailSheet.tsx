import { useRef } from "react";
import type { Folder, Task } from "../types";
import { ModalSheet } from "./ModalSheet";
import { TaskForm, type TaskFormValues } from "./TaskForm";
import { CheckIcon } from "./icons";

interface TaskDetailSheetProps {
  task: Task;
  folders: Folder[];
  onComplete: () => void;
  onSave: (values: TaskFormValues) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskDetailSheet({ task, folders, onComplete, onSave, onDelete, onClose }: TaskDetailSheetProps) {
  const isOverdue = new Date(task.dueAt).getTime() <= Date.now();
  const completePressRef = useRef(false);

  return (
    <ModalSheet title="タスクの詳細" onClose={onClose} initialFocus="dialog">
      <div style={{ padding: "0 16px" }}>
        <button
          type="button"
          className="button-complete"
          style={{ width: "100%" }}
          onPointerDown={() => {
            completePressRef.current = true;
          }}
          onPointerUp={() => {
            if (!completePressRef.current) return;
            completePressRef.current = false;
            onComplete();
          }}
          onPointerCancel={() => {
            completePressRef.current = false;
          }}
          onClick={(e) => e.preventDefault()}
        >
          <CheckIcon size={20} />
          完了して風船を割る
        </button>
      </div>
      <TaskForm
        key={task.id}
        folders={folders}
        initial={{
          title: task.title,
          dueAt: task.dueAt,
          folderId: task.folderId,
          colorId: task.colorId ?? null,
          inflationWindowHours: task.inflationWindowHours,
          memo: task.memo,
        }}
        submitLabel="変更を保存"
        colorDisabled={isOverdue}
        onSubmit={onSave}
      />
      <div className="task-detail-delete">
        <button type="button" className="button-text-danger" onClick={onDelete}>
          このタスクを削除
        </button>
      </div>
    </ModalSheet>
  );
}
