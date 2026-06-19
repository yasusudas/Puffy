import type { FolderColorId } from "../types";

export const FOLDER_COLORS: { id: FolderColorId; label: string; hex: string }[] = [
  { id: "sky", label: "スカイ", hex: "#0284C7" },
  { id: "blue", label: "ブルー", hex: "#2563EB" },
  { id: "indigo", label: "インディゴ", hex: "#4F46E5" },
  { id: "violet", label: "バイオレット", hex: "#7C3AED" },
  { id: "fuchsia", label: "フクシア", hex: "#C026D3" },
  { id: "pink", label: "ピンク", hex: "#DB2777" },
  { id: "black", label: "ブラック", hex: "#171717" },
  { id: "orange", label: "オレンジ", hex: "#EA580C" },
  { id: "amber", label: "アンバー", hex: "#D97706" },
  { id: "lime", label: "ライム", hex: "#65A30D" },
  { id: "green", label: "グリーン", hex: "#16A34A" },
  { id: "teal", label: "ティール", hex: "#0D9488" },
  { id: "cyan", label: "シアン", hex: "#0891B2" },
];

/** タスク色ピッカー 1行目 (7列): 自動 + 6色。2行目先頭の黒は自動の真下 */
export const TASK_COLOR_ROW1: readonly (FolderColorId | "auto")[] = [
  "auto", "sky", "blue", "indigo", "violet", "fuchsia", "pink",
];
export const TASK_COLOR_ROW2: readonly FolderColorId[] = [
  "black", "orange", "amber", "lime", "green", "teal", "cyan",
];

/** フォルダ色ピッカー 2行 (7列 + 6列) */
export const FOLDER_COLOR_ROW1: readonly FolderColorId[] = [
  "sky", "blue", "indigo", "violet", "fuchsia", "pink",
];
export const FOLDER_COLOR_ROW2: readonly FolderColorId[] = [
  "black", "orange", "amber", "lime", "green", "teal", "cyan",
];

const COLOR_BY_ID = new Map(FOLDER_COLORS.map((c) => [c.id, c]));

export function folderColorById(id: FolderColorId) {
  return COLOR_BY_ID.get(id)!;
}

export const UNFILED_COLOR = "#64748B";
export const WARNING_COLOR = "#DC2626";

export function colorHex(colorId: FolderColorId): string {
  return FOLDER_COLORS.find((c) => c.id === colorId)?.hex ?? UNFILED_COLOR;
}

/** 現在使われていない色を優先して新規フォルダの初期色を選ぶ */
export function pickUnusedColor(usedColorIds: FolderColorId[]): FolderColorId {
  const unused = FOLDER_COLORS.find((c) => !usedColorIds.includes(c.id));
  if (unused) return unused.id;
  // 全色使用済みの場合は使用回数が最少の色
  const counts = new Map<FolderColorId, number>();
  for (const c of FOLDER_COLORS) counts.set(c.id, 0);
  for (const id of usedColorIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best: FolderColorId = FOLDER_COLORS[0].id;
  let min = Infinity;
  for (const [id, n] of counts) {
    if (n < min) {
      min = n;
      best = id;
    }
  }
  return best;
}

/** 背景色とのコントラストに応じて白または濃色の文字色を返す */
export function textColorFor(bgHex: string): string {
  const r = parseInt(bgHex.slice(1, 3), 16) / 255;
  const g = parseInt(bgHex.slice(3, 5), 16) / 255;
  const b = parseInt(bgHex.slice(5, 7), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? "#0F172A" : "#FFFFFF";
}
