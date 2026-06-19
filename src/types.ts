export type TaskStatus = "active" | "completed" | "trashed";
export type PreTrashStatus = "active" | "completed" | null;
export type InflationWindowHours = 24 | 72 | 168;

export interface Task {
  id: string; // UUID
  title: string;
  memo: string;
  dueAt: string; // UTC ISO 8601
  inflationWindowHours: InflationWindowHours;
  folderId: string | null;
  /** 風船の色を個別に上書きする。null の場合はフォルダの色を使う */
  colorId: FolderColorId | null;
  status: TaskStatus;
  preTrashStatus: PreTrashStatus;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FolderColorId =
  | "sky" | "blue" | "indigo" | "violet"
  | "fuchsia" | "pink" | "orange" | "amber"
  | "lime" | "green" | "teal" | "cyan";

export interface Folder {
  id: string; // UUID
  name: string;
  colorId: FolderColorId;
  createdAt: string;
  updatedAt: string;
}

export type NotificationOffsetMinutes = 2880 | 1440 | 360 | 60 | 0;

export interface NotificationReceipt {
  id: string; // `${taskId}:${dueAt}:${offsetMinutes}`
  taskId: string;
  dueAt: string;
  offsetMinutes: NotificationOffsetMinutes;
  notifiedAt: string;
}

export interface Settings {
  id: "app";
  schemaVersion: 1;
  firstTaskHintDismissed: boolean;
  notificationsEnabled: boolean;
  /** ユーザーが任意に設定する表示名。メールアドレスとは別 */
  accountName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MainTab = "active" | "completed" | "trash";

/** フォルダフィルタ: "all" | "none"(未分類) | フォルダID */
export type FolderFilter = "all" | "none" | string;

export const SCHEMA_VERSION = 1;
export const APP_VERSION = "Ver. 2.2";
export const APP_UPDATED_AT = "2026/06/19 23:54";
export const TRASH_RETENTION_DAYS = 30;
export const NOTIFICATION_OFFSETS: NotificationOffsetMinutes[] = [2880, 1440, 360, 60, 0];
export const INFLATION_OPTIONS: { value: InflationWindowHours; label: string }[] = [
  { value: 24, label: "24時間前" },
  { value: 72, label: "72時間前" },
  { value: 168, label: "7日前" },
];
