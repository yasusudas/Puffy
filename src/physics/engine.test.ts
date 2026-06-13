import { describe, expect, it } from "vitest";
import { BalloonEngine } from "./engine";

/** 浮遊の揺らぎを除外して決定的に検証するためのエンジンを作る */
function makeEngine(): BalloonEngine {
  const e = new BalloonEngine();
  e.reducedMotion = true;
  e.setBounds(800, 600);
  return e;
}

describe("BalloonEngine ドラッグ解放", () => {
  it("速いフリックで離してもヘリウム風船らしく緩やかな速度に収まる", () => {
    const e = makeEngine();
    const b = e.upsert("a", 40, 400, 300);
    e.startDrag("a");
    e.dragTo("a", 400, 300);
    // 単一フレームのスパイクや勢いよく振った場合を想定した大きな速度
    e.endDrag("a", 5000, 0);
    expect(Math.abs(b.vx)).toBeLessThanOrEqual(200);
  });

  it("解放後に画面を横切るような長距離移動をしない", () => {
    const e = makeEngine();
    const b = e.upsert("a", 40, 400, 300);
    e.startDrag("a");
    e.dragTo("a", 400, 300);
    e.endDrag("a", 5000, 0);
    const startX = b.x;
    let maxExcursion = 0;
    for (let i = 0; i < 90; i++) {
      e.step(1 / 60);
      maxExcursion = Math.max(maxExcursion, Math.abs(b.x - startX));
    }
    expect(maxExcursion).toBeLessThan(200);
  });
});

describe("BalloonEngine 衝突", () => {
  it("重なった状態の風船を解放しても高速で吹き飛ばない", () => {
    const e = makeEngine();
    // 互いの定位置 (home) は離れているが、片方を相手の上に落とした状態を再現する
    const a = e.upsert("a", 25, 300, 300);
    const b = e.upsert("b", 25, 360, 300);
    b.x = 315;
    b.y = 300;
    let maxSpeed = 0;
    for (let i = 0; i < 120; i++) {
      e.step(1 / 60);
      maxSpeed = Math.max(maxSpeed, Math.hypot(a.vx, a.vy), Math.hypot(b.vx, b.vy));
    }
    expect(maxSpeed).toBeLessThanOrEqual(100);
    // 重なりは解消している
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(53);
  });
});
