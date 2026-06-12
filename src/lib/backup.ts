import { db } from "../db/db";
import { TaskRepository, SettingsRepository } from "../db/repositories";
import { FOLDER_COLORS } from "./colors";
import { nowIso } from "./time";
import { SCHEMA_VERSION, type Folder, type Settings, type Task } from "../types";

export interface BackupFile {
  app: "PopTask";
  schemaVersion: number;
  exportedAt: string;
  tasks: Task[];
  folders: Folder[];
  settings: Partial<Settings>;
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `poptask-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
}

export async function exportBackup(): Promise<{ json: string; fileName: string }> {
  // 出力前に30日を過ぎたゴミ箱データを削除する
  await TaskRepository.purgeExpiredTrash();
  const [tasks, folders, settings] = await Promise.all([
    db.tasks.toArray(),
    db.folders.toArray(),
    SettingsRepository.get(),
  ]);
  const backup: BackupFile = {
    app: "PopTask",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    tasks,
    folders,
    settings,
  };
  return { json: JSON.stringify(backup, null, 2), fileName: backupFileName() };
}

const TASK_STATUSES = ["active", "completed", "trashed"];
const INFLATION_VALUES = [24, 72, 168];
const COLOR_IDS = FOLDER_COLORS.map((c) => c.id as string);

export interface ValidatedBackup {
  tasks: Task[];
  folders: Folder[];
  settings: Partial<Settings>;
}

/** JSON構文・スキーマバージョン・必須フィールド・ID重複・参照整合性を検証する */
export function validateBackup(json: string): { ok: true; data: ValidatedBackup } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "JSONの構文が不正です。" };
  }
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "JSONのルートがオブジェクトではありません。" };
  const data = raw as Record<string, unknown>;
  if (data.app !== "PopTask") return { ok: false, error: "PopTaskのバックアップファイルではありません。" };
  if (data.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: `未対応のスキーマバージョンです (${String(data.schemaVersion)})。` };
  }
  if (!Array.isArray(data.tasks) || !Array.isArray(data.folders)) {
    return { ok: false, error: "tasks または folders が配列ではありません。" };
  }

  const folders = data.folders as Folder[];
  const folderIds = new Set<string>();
  for (const f of folders) {
    if (typeof f?.id !== "string" || typeof f?.name !== "string" || typeof f?.createdAt !== "string") {
      return { ok: false, error: "フォルダの必須フィールドが不足しています。" };
    }
    if (!COLOR_IDS.includes(f.colorId)) return { ok: false, error: `フォルダの色IDが不正です (${String(f.colorId)})。` };
    if (folderIds.has(f.id)) return { ok: false, error: `フォルダIDが重複しています (${f.id})。` };
    folderIds.add(f.id);
  }

  const tasks = data.tasks as Task[];
  const taskIds = new Set<string>();
  for (const t of tasks) {
    if (
      typeof t?.id !== "string" ||
      typeof t?.title !== "string" ||
      typeof t?.dueAt !== "string" ||
      typeof t?.createdAt !== "string" ||
      typeof t?.updatedAt !== "string"
    ) {
      return { ok: false, error: "タスクの必須フィールドが不足しています。" };
    }
    if (Number.isNaN(new Date(t.dueAt).getTime())) return { ok: false, error: `期限日時が不正です (${t.id})。` };
    if (!TASK_STATUSES.includes(t.status)) return { ok: false, error: `タスクの状態が不正です (${t.id})。` };
    if (!INFLATION_VALUES.includes(t.inflationWindowHours)) {
      return { ok: false, error: `膨張開始タイミングが不正です (${t.id})。` };
    }
    if (t.folderId !== null && !folderIds.has(t.folderId)) {
      return { ok: false, error: `存在しないフォルダを参照しています (${t.id})。` };
    }
    if (taskIds.has(t.id)) return { ok: false, error: `タスクIDが重複しています (${t.id})。` };
    taskIds.add(t.id);
  }

  const settings = (typeof data.settings === "object" && data.settings !== null ? data.settings : {}) as Partial<Settings>;
  return { ok: true, data: { tasks, folders, settings } };
}

/** 検証済みデータで全置換し、期限切れゴミ箱を掃除する */
export async function importBackup(data: ValidatedBackup): Promise<void> {
  const now = nowIso();
  const current = await SettingsRepository.get();
  await db.transaction("rw", db.tasks, db.folders, db.settings, db.notificationReceipts, async () => {
    await db.tasks.clear();
    await db.folders.clear();
    await db.notificationReceipts.clear();
    await db.tasks.bulkAdd(data.tasks);
    await db.folders.bulkAdd(data.folders);
    await db.settings.put({
      ...current,
      firstTaskHintDismissed: data.settings.firstTaskHintDismissed ?? current.firstTaskHintDismissed,
      notificationsEnabled: data.settings.notificationsEnabled ?? current.notificationsEnabled,
      updatedAt: now,
    });
  });
  await TaskRepository.purgeExpiredTrash();
}

export async function deleteAllData(): Promise<void> {
  await db.transaction("rw", db.tasks, db.folders, db.settings, db.notificationReceipts, async () => {
    await db.tasks.clear();
    await db.folders.clear();
    await db.notificationReceipts.clear();
    await db.settings.clear();
  });
}
