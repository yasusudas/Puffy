export function nowIso(): string {
  return new Date().toISOString();
}

/** datetime-local 入力値 (ローカル時刻) を UTC ISO 8601 に変換 */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

/** UTC ISO を datetime-local 入力値 (YYYY-MM-DDTHH:mm) に変換 */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 期限表示: 同年なら M/D HH:mm、別の年なら YYYY/M/D HH:mm */
export function formatDue(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 超過時間の表示 (例: 3時間超過, 2日超過) */
export function formatOverdue(dueIso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(dueIso).getTime();
  if (ms < 0) return "";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}分超過`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間超過`;
  const days = Math.floor(hours / 24);
  return `${days}日超過`;
}

/** 期限までの残り時間表示 (例: あと45分, あと1時間) — 期限内のみ */
export function formatTimeLeft(dueIso: string, now: Date = new Date()): string {
  const ms = new Date(dueIso).getTime() - now.getTime();
  if (ms <= 0) return "";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `あと${minutes}分`;
  const hours = Math.floor(minutes / 60);
  return `あと${hours}時間`;
}

/** ゴミ箱の残り保持日数 (切り上げ、0〜retentionDaysにクランプ) */
export function trashDaysLeft(deletedAtIso: string, retentionDays: number, now: Date = new Date()): number {
  const expire = new Date(deletedAtIso).getTime() + retentionDays * 24 * 60 * 60 * 1000;
  const ms = expire - now.getTime();
  return Math.min(retentionDays, Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000))));
}
