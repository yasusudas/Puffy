import { describe, expect, it } from "vitest";
import { balloonDiameter, isOverdue, sizeLevel, sortActiveTasks } from "./size";
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

function makeTask(partial: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: "t",
    memo: "",
    dueAt: "2026-06-20T00:00:00.000Z",
    inflationWindowHours: 72,
    folderId: null,
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
