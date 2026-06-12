import type { Folder } from "../types";
import { ModalSheet } from "./ModalSheet";
import { TaskForm, type TaskFormValues } from "./TaskForm";

interface TaskCreateModalProps {
  folders: Folder[];
  defaultFolderId: string | null;
  onCreate: (values: TaskFormValues) => void;
  onClose: () => void;
}

export function TaskCreateModal({ folders, defaultFolderId, onCreate, onClose }: TaskCreateModalProps) {
  return (
    <ModalSheet title="新しいタスク" onClose={onClose}>
      <TaskForm
        folders={folders}
        defaultFolderId={defaultFolderId}
        submitLabel="作成"
        requireFutureDue
        onSubmit={onCreate}
      />
    </ModalSheet>
  );
}
