import type { Task } from "../types";

const HOUR_MS = 60 * 60 * 1000;

/**
 * 膨張開始から期限までの進捗を eased (progress^2) で返す連続値 [0,1]。
 * sizeLevel の段階化前のなめらかな値で、直径アニメーションに用いる。
 */
export function inflationProgress(dueAtIso: string, inflationWindowHours: number, now: Date = new Date()): number {
  const dueAt = new Date(dueAtIso).getTime();
  const startAt = dueAt - inflationWindowHours * HOUR_MS;
  const t = now.getTime();

  let progress: number;
  if (t <= startAt) progress = 0;
  else if (t >= dueAt) progress = 1;
  else progress = (t - startAt) / (dueAt - startAt);

  return progress * progress;
}

/**
 * 期限と膨張開始タイミングから10段階のサイズレベルを計算する。
 * 仕様 7.2: eased = progress^2, sizeLevel = clamp(1 + floor(eased * 10), 1, 10)
 */
export function sizeLevel(dueAtIso: string, inflationWindowHours: number, now: Date = new Date()): number {
  const eased = inflationProgress(dueAtIso, inflationWindowHours, now);
  return Math.min(10, Math.max(1, 1 + Math.floor(eased * 10)));
}

export function isOverdue(dueAtIso: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(dueAtIso).getTime();
}

/** 点滅で緊急を知らせる残り時間 (期限の1時間前から) */
export const IMMINENT_WINDOW_HOURS = 1;

/**
 * 期限まで残り1時間以内で、まだ期限内のタスク。
 * サイズ変化だけでは気づきにくい締切直前を点滅で強調するための判定。
 */
export function isImminent(dueAtIso: string, now: Date = new Date()): boolean {
  const due = new Date(dueAtIso).getTime();
  const t = now.getTime();
  return t < due && due - t <= IMMINENT_WINDOW_HOURS * HOUR_MS;
}

/**
 * 風船の直径 (px)。
 * 最小: 基準幅の約19% (可読性目安 88px)、最大: 画面幅の35%以下かつ160px以下。
 * 画面幅の%ルールはスマートフォン想定のため、基準幅を480pxで頭打ちにして
 * デスクトップでもレベル差が直径に反映されるようにする。
 * レベル1〜10を線形補間。
 */
export function balloonDiameter(level: number, fieldWidth: number): number {
  const refWidth = Math.min(fieldWidth, 480);
  const max = Math.max(88, Math.min(fieldWidth * 0.35, 160));
  const min = Math.min(Math.max(88, refWidth * 0.19), max);
  return min + ((max - min) * (level - 1)) / 9;
}

/**
 * 連続進捗 (inflationProgress の戻り値 [0,1]) から直径を求める。
 * 期限変更時の直径アニメーションを段階の境目でカクつかせないために使う。
 * 端点 (0→最小, 1→最大) は balloonDiameter のレベル1・10と一致する。
 */
export function diameterForProgress(easedProgress: number, fieldWidth: number): number {
  const refWidth = Math.min(fieldWidth, 480);
  const max = Math.max(88, Math.min(fieldWidth * 0.35, 160));
  const min = Math.min(Math.max(88, refWidth * 0.19), max);
  const p = Math.min(1, Math.max(0, easedProgress));
  return min + (max - min) * p;
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
