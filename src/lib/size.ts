import type { Task } from "../types";

const HOUR_MS = 60 * 60 * 1000;

/**
 * 期限と膨張開始タイミングから10段階のサイズレベルを計算する。
 * 仕様 7.2: eased = progress^2, sizeLevel = clamp(1 + floor(eased * 10), 1, 10)
 */
export function sizeLevel(dueAtIso: string, inflationWindowHours: number, now: Date = new Date()): number {
  const dueAt = new Date(dueAtIso).getTime();
  const startAt = dueAt - inflationWindowHours * HOUR_MS;
  const t = now.getTime();

  let progress: number;
  if (t <= startAt) progress = 0;
  else if (t >= dueAt) progress = 1;
  else progress = (t - startAt) / (dueAt - startAt);

  const eased = progress * progress;
  return Math.min(10, Math.max(1, 1 + Math.floor(eased * 10)));
}

export function isOverdue(dueAtIso: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(dueAtIso).getTime();
}

/**
 * 風船の直径 (px)。
 * 最小: 画面幅の約19% (可読性目安 88px)、最大: 画面幅の35%以下かつ160px以下。
 * レベル1〜10を線形補間。
 */
export function balloonDiameter(level: number, fieldWidth: number): number {
  const max = Math.max(88, Math.min(fieldWidth * 0.35, 160));
  const min = Math.min(Math.max(88, fieldWidth * 0.19), max);
  return min + ((max - min) * (level - 1)) / 9;
}

/** 並び順: 期限超過が先頭、次に期限が近い順、同じ期限なら更新が新しい順 */
export function sortActiveTasks(tasks: Task[], now: Date = new Date()): Task[] {
  return [...tasks].sort((a, b) => {
    const aOver = isOverdue(a.dueAt, now) ? 0 : 1;
    const bOver = isOverdue(b.dueAt, now) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    const dueDiff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    if (dueDiff !== 0) return dueDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
