import { describe, expect, it } from "vitest";
import {
  balloonDiameter,
  crowdScale,
  CROWD_SCALE_MAX,
  CROWD_SCALE_PER_TASK,
  diameterForProgress,
  inflationProgress,
  isImminent,
  isOverdue,
  sizeLevel,
  sortActiveTasks,
} from "./size";
import type { Task } from "../types";

const HOUR = 60 * 60 * 1000;

function dueIn(hours: number, from: Date): string {
  return new Date(from.getTime() + hours * HOUR).toISOString();
}

describe("sizeLevel", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");

  it("膨張開始前はレベル1", () => {
    expect(sizeLevel(dueIn(100, now), 72, now)).toBe(1);
  });

  it("膨張開始ちょうどはレベル1", () => {
    expect(sizeLevel(dueIn(72, now), 72, now)).toBe(1);
  });

  it("進行に応じて非線形 (progress^2) に増加する", () => {
    // progress = 0.5 → eased = 0.25 → level 3
    expect(sizeLevel(dueIn(36, now), 72, now)).toBe(3);
    // progress = 0.9 → eased = 0.81 → level 9
    expect(sizeLevel(dueIn(7.2, now), 72, now)).toBe(9);
  });

  it("期限ちょうど・超過後はレベル10", () => {
    expect(sizeLevel(now.toISOString(), 72, now)).toBe(10);
    expect(sizeLevel(dueIn(-5, now), 72, now)).toBe(10);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");
  it("期限前はfalse、期限以降はtrue", () => {
    expect(isOverdue(dueIn(1, now), now)).toBe(false);
    expect(isOverdue(now.toISOString(), now)).toBe(true);
    expect(isOverdue(dueIn(-1, now), now)).toBe(true);
  });
});

describe("inflationProgress", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");

  it("膨張開始前は0、期限以降は1", () => {
    expect(inflationProgress(dueIn(100, now), 72, now)).toBe(0);
    expect(inflationProgress(now.toISOString(), 72, now)).toBe(1);
    expect(inflationProgress(dueIn(-3, now), 72, now)).toBe(1);
  });

  it("progress^2 の連続値を返す (段階化しない)", () => {
    // progress = 0.5 → 0.25
    expect(inflationProgress(dueIn(36, now), 72, now)).toBeCloseTo(0.25);
    // progress = 0.25 → 0.0625
    expect(inflationProgress(dueIn(54, now), 72, now)).toBeCloseTo(0.0625);
  });
});

describe("diameterForProgress", () => {
  it("進捗0で最小、1で最大 (balloonDiameterのレベル1・10と一致)", () => {
    expect(diameterForProgress(0, 390)).toBeCloseTo(balloonDiameter(1, 390));
    expect(diameterForProgress(1, 390)).toBeCloseTo(balloonDiameter(10, 390));
  });

  it("中間の進捗は線形に補間する", () => {
    const mid = diameterForProgress(0.5, 390);
    expect(mid).toBeCloseTo((88 + 136.5) / 2);
  });

  it("範囲外の進捗は0〜1にクランプする", () => {
    expect(diameterForProgress(-1, 390)).toBeCloseTo(diameterForProgress(0, 390));
    expect(diameterForProgress(2, 390)).toBeCloseTo(diameterForProgress(1, 390));
  });
});

describe("isImminent", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");
  it("残り1時間以内かつ期限内のときtrue", () => {
    expect(isImminent(dueIn(0.5, now), now)).toBe(true);
    expect(isImminent(dueIn(1, now), now)).toBe(true);
  });
  it("残り1時間より前はfalse", () => {
    expect(isImminent(dueIn(1.1, now), now)).toBe(false);
    expect(isImminent(dueIn(5, now), now)).toBe(false);
  });
  it("期限ちょうど・超過後はfalse (点滅ではなく超過表示へ)", () => {
    expect(isImminent(now.toISOString(), now)).toBe(false);
    expect(isImminent(dueIn(-0.5, now), now)).toBe(false);
  });
});

describe("balloonDiameter", () => {
  it("レベル1は最小、レベル10は最大", () => {
    // 幅390px: min = max(88, 74.1) = 88, max = min(136.5, 160) = 136.5
    expect(balloonDiameter(1, 390)).toBeCloseTo(88);
    expect(balloonDiameter(10, 390)).toBeCloseTo(136.5);
  });

  it("最大直径は160pxを超えない", () => {
    expect(balloonDiameter(10, 1200)).toBeLessThanOrEqual(160);
  });
});

describe("crowdScale", () => {
  it("超過0件は等倍", () => {
    expect(crowdScale(0)).toBe(1);
  });

  it("超過1件目から倍率が効く", () => {
    expect(crowdScale(1)).toBeCloseTo(1 + CROWD_SCALE_PER_TASK);
  });

  it("件数が増えるほど倍率が上がる", () => {
    expect(crowdScale(2)).toBeCloseTo(1 + 2 * CROWD_SCALE_PER_TASK);
    expect(crowdScale(2)).toBeGreaterThan(crowdScale(1));
    expect(crowdScale(3)).toBeGreaterThan(crowdScale(2));
  });

  it("上限で頭打ちになる", () => {
    expect(crowdScale(1000)).toBe(CROWD_SCALE_MAX);
  });
});

describe("diameterForProgress (crowd scale)", () => {
  it("scale=1 は従来どおり", () => {
    expect(diameterForProgress(0, 390, 1)).toBeCloseTo(diameterForProgress(0, 390));
    expect(diameterForProgress(1, 390, 1)).toBeCloseTo(diameterForProgress(1, 390));
  });

  it("scaleが大きいほど直径が大きくなる", () => {
    const base = diameterForProgress(0.5, 390, 1);
    const scaled = diameterForProgress(0.5, 390, 1.4);
    expect(scaled).toBeGreaterThan(base);
    expect(scaled).toBeCloseTo(base * 1.4);
  });

  it("フィールド幅の50%を超えない", () => {
    expect(diameterForProgress(1, 390, CROWD_SCALE_MAX)).toBeLessThanOrEqual(390 * 0.5);
  });
});

function makeTask(partial: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: "t",
    memo: "",
    dueAt: "2026-06-20T00:00:00.000Z",
    inflationWindowHours: 72,
    folderId: null,
    colorId: null,
    status: "active",
    preTrashStatus: null,
    completedAt: null,
    deletedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

describe("sortActiveTasks", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");

  it("期限超過 → 期限が近い順 → 更新が新しい順", () => {
    const overdue = makeTask({ id: "overdue", dueAt: dueIn(-2, now) });
    const soon = makeTask({ id: "soon", dueAt: dueIn(3, now) });
    const later = makeTask({ id: "later", dueAt: dueIn(50, now) });
    const sameDueNewer = makeTask({ id: "newer", dueAt: dueIn(50, now), updatedAt: "2026-06-10T00:00:00.000Z" });
    const sorted = sortActiveTasks([later, soon, sameDueNewer, overdue], now);
    expect(sorted.map((t) => t.id)).toEqual(["overdue", "soon", "newer", "later"]);
  });
});
