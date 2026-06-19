import { db } from "./db";
import { uuid } from "../lib/id";
import { nowIso } from "../lib/time";
import { syncBridge } from "../sync/syncBridge";
import {
  SCHEMA_VERSION,
  TRASH_RETENTION_DAYS,
  type Folder,
  type FolderColorId,
  type InflationWindowHours,
  type Settings,
  type Task,
} from "../types";

export interface TaskInput {
  title: string;
  memo: string;
  dueAt: string;
  inflationWindowHours: InflationWindowHours;
  folderId: string | null;
  colorId: FolderColorId | null;
}

export const TaskRepository = {
  async create(input: TaskInput): Promise<Task> {
    const now = nowIso();
    const task: Task = {
      id: uuid(),
      title: input.title.trim(),
      memo: input.memo,
      dueAt: input.dueAt,
      inflationWindowHours: input.inflationWindowHours,
      folderId: input.folderId,
      colorId: input.colorId ?? null,
      status: "active",
      preTrashStatus: null,
      completedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.tasks.add(task);
    void syncBridge.onTaskCreated(task);
    return task;
  },

  async update(id: string, patch: Partial<TaskInput>): Promise<void> {
    const prev = await db.tasks.get(id);
    if (!prev) throw new Error("タスクが見つかりません");
    // 期限が変わったら過去の通知記録は無効になるため削除する
    if (patch.dueAt && patch.dueAt !== prev.dueAt) {
      await db.notificationReceipts.where("taskId").equals(id).delete();
    }
    const next: Task = {
      ...prev,
      ...patch,
      title: patch.title !== undefined ? patch.title.trim() : prev.title,
      colorId: patch.colorId !== undefined ? patch.colorId : (prev.colorId ?? null),
      updatedAt: nowIso(),
    };
    await db.tasks.put(next);
    void syncBridge.onTaskUpdated(next);
  },

  async complete(id: string): Promise<void> {
    const now = nowIso();
    await db.tasks.update(id, { status: "completed", completedAt: now, updatedAt: now });
    const task = await db.tasks.get(id);
    if (task) void syncBridge.onTaskUpdated(task);
  },

  /** 完了の取り消し・完了一覧から未完了へ戻す */
  async reactivate(id: string): Promise<void> {
    await db.tasks.update(id, { status: "active", completedAt: null, updatedAt: nowIso() });
    const task = await db.tasks.get(id);
    if (task) void syncBridge.onTaskUpdated(task);
  },

  async moveToTrash(id: string): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task || task.status === "trashed") return;
    const now = nowIso();
    await db.tasks.update(id, {
      status: "trashed",
      preTrashStatus: task.status,
      deletedAt: now,
      updatedAt: now,
    });
    const next = await db.tasks.get(id);
    if (next) void syncBridge.onTaskUpdated(next);
  },

  /** ゴミ箱から削除前の状態へ復元する */
  async restoreFromTrash(id: string): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task || task.status !== "trashed") return;
    const status = task.preTrashStatus ?? "active";
    await db.tasks.update(id, {
      status,
      preTrashStatus: null,
      deletedAt: null,
      updatedAt: nowIso(),
    });
    const next = await db.tasks.get(id);
    if (next) void syncBridge.onTaskUpdated(next);
  },

  async deletePermanently(id: string): Promise<void> {
    await db.transaction("rw", db.tasks, db.notificationReceipts, async () => {
      await db.tasks.delete(id);
      await db.notificationReceipts.where("taskId").equals(id).delete();
    });
    void syncBridge.onTaskDeleted(id);
  },

  /** deletedAt + 30日 を過ぎたゴミ箱タスクを完全削除する */
  async purgeExpiredTrash(now: Date = new Date()): Promise<number> {
    const cutoff = now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expired = await db.tasks
      .where("status")
      .equals("trashed")
      .filter((t) => t.deletedAt !== null && new Date(t.deletedAt).getTime() < cutoff)
      .toArray();
    for (const t of expired) {
      await TaskRepository.deletePermanently(t.id);
    }
    return expired.length;
  },

  async emptyTrash(): Promise<void> {
    const trashed = await db.tasks.where("status").equals("trashed").toArray();
    await db.transaction("rw", db.tasks, db.notificationReceipts, async () => {
      for (const t of trashed) {
        await db.tasks.delete(t.id);
        await db.notificationReceipts.where("taskId").equals(t.id).delete();
      }
    });
    await syncBridge.onBulkLocalChange();
  },
};

export const FolderRepository = {
  async create(name: string, colorId: FolderColorId): Promise<Folder> {
    const now = nowIso();
    const folder: Folder = { id: uuid(), name: name.trim(), colorId, createdAt: now, updatedAt: now };
    await db.folders.add(folder);
    void syncBridge.onFolderCreated(folder);
    return folder;
  },

  async update(id: string, patch: { name?: string; colorId?: FolderColorId }): Promise<void> {
    await db.folders.update(id, { ...patch, updatedAt: nowIso() });
    const folder = await db.folders.get(id);
    if (folder) void syncBridge.onFolderUpdated(folder);
  },

  /** フォルダ削除時、所属する全状態のタスクを未分類へ移す */
  async remove(id: string): Promise<void> {
    await db.transaction("rw", db.folders, db.tasks, async () => {
      await db.tasks.where("folderId").equals(id).modify({ folderId: null, updatedAt: nowIso() });
      await db.folders.delete(id);
    });
    void syncBridge.onFolderDeleted(id);
    void syncBridge.onBulkLocalChange();
  },

  /** 名前の重複チェック (英字の大文字・小文字を区別しない) */
  async isNameTaken(name: string, excludeId?: string): Promise<boolean> {
    const target = name.trim().toLowerCase();
    const all = await db.folders.toArray();
    return all.some((f) => f.id !== excludeId && f.name.toLowerCase() === target);
  },
};

export const SettingsRepository = {
  async get(): Promise<Settings> {
    const existing = await db.settings.get("app");
    if (existing) {
      return { ...existing, accountName: existing.accountName ?? null };
    }
    const now = nowIso();
    const settings: Settings = {
      id: "app",
      schemaVersion: SCHEMA_VERSION,
      firstTaskHintDismissed: false,
      notificationsEnabled: false,
      accountName: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.settings.put(settings);
    return settings;
  },

  async update(patch: Partial<Omit<Settings, "id" | "schemaVersion" | "createdAt">>): Promise<void> {
    const current = await SettingsRepository.get();
    const next: Settings = { ...current, ...patch, updatedAt: nowIso() };
    await db.settings.put(next);
    void syncBridge.onSettingsUpdated(next);
  },
};

/** 起動時の整合性確認: 参照先フォルダが存在しないタスクを未分類へ移す */
export async function repairIntegrity(): Promise<void> {
  const folderIds = new Set((await db.folders.toArray()).map((f) => f.id));
  await db.tasks
    .filter((t) => t.folderId !== null && !folderIds.has(t.folderId))
    .modify({ folderId: null, updatedAt: nowIso() });
}
