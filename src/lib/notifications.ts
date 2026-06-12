import { db } from "../db/db";
import { formatDue, nowIso } from "./time";
import { NOTIFICATION_OFFSETS, type NotificationOffsetMinutes, type Task } from "../types";

export type PermissionState = "granted" | "denied" | "default" | "unsupported";

export function notificationPermission(): PermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === "undefined") return "unsupported";
  const result = await Notification.requestPermission();
  return result as PermissionState;
}

function offsetLabel(offset: NotificationOffsetMinutes): string {
  switch (offset) {
    case 2880: return "期限まで48時間";
    case 1440: return "期限まで24時間";
    case 360: return "期限まで6時間";
    case 60: return "期限まで1時間";
    case 0: return "期限になりました";
  }
}

/**
 * 未完了タスクの通知時点を判定して表示する。
 * - lastCheckedAt より後に到来した通知時点のみ対象 (遡及送信しない)
 * - NotificationReceipt により同一時点の二重送信を防ぐ
 */
export async function checkAndNotify(lastCheckedAt: Date, now: Date = new Date()): Promise<void> {
  if (notificationPermission() !== "granted") return;
  const settings = await db.settings.get("app");
  if (!settings?.notificationsEnabled) return;

  const tasks: Task[] = await db.tasks.where("status").equals("active").toArray();
  for (const task of tasks) {
    const dueMs = new Date(task.dueAt).getTime();
    for (const offset of NOTIFICATION_OFFSETS) {
      const fireAt = dueMs - offset * 60000;
      if (fireAt <= lastCheckedAt.getTime() || fireAt > now.getTime()) continue;
      // 通知時点がタスク作成より前なら遡及にあたるためスキップ
      if (fireAt < new Date(task.createdAt).getTime()) continue;
      const receiptId = `${task.id}:${task.dueAt}:${offset}`;
      const existing = await db.notificationReceipts.get(receiptId);
      if (existing) continue;
      try {
        new Notification(`PopTask: ${task.title}`, {
          body: `${offsetLabel(offset)} (期限 ${formatDue(task.dueAt, now)})`,
          tag: receiptId,
        });
      } catch {
        // 通知は補助機能のため、表示に失敗してもアプリ動作は継続する
      }
      await db.notificationReceipts.put({
        id: receiptId,
        taskId: task.id,
        dueAt: task.dueAt,
        offsetMinutes: offset,
        notifiedAt: nowIso(),
      });
    }
  }
}
