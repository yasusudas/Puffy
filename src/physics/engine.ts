/**
 * ヘリウム風船用の軽量2D物理エンジン。
 * 鉛直方向の浮力を主とし、水平方向はごく弱い揺らぎに留める。
 */

export interface BalloonBody {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  homeX: number;
  homeY: number;
  phase: number;
  dragging: boolean;
}

const FLOAT_FORCE_X = 5;
const FLOAT_FORCE_Y = 6;
const HOME_SPRING_X = 0.12;
const HOME_SPRING_Y = 0.65;
const DAMPING = 2.1;
export const COLLISION_GAP = 4;
export const EDGE_PAD = 6;
const MAX_HORIZ_SPEED = 42;
const MAX_VERT_SPEED = 160;
const BUOYANCY = 20;
const RELEASE_RISE = 55;

export class BalloonEngine {
  bodies = new Map<string, BalloonBody>();
  width = 0;
  height = 0;
  reducedMotion = false;
  private time = 0;

  setBounds(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  /** 新規ボディのみ home を設定する。既存ボディは半径だけ更新し位置・home は保持する。 */
  upsert(id: string, r: number, homeX: number, homeY: number): BalloonBody {
    const existing = this.bodies.get(id);
    if (existing) {
      existing.r = r;
      return existing;
    }
    const body: BalloonBody = {
      id,
      x: homeX,
      y: homeY,
      vx: 0,
      vy: 0,
      r,
      homeX,
      homeY,
      phase: Math.random() * Math.PI * 2,
      dragging: false,
    };
    this.bodies.set(id, body);
    return body;
  }

  /** 幅変更など、全風船を初期グリッドへ戻すときだけ使う。 */
  resetLayout(placed: PlacedCircle[]) {
    const ids = new Set(placed.map((p) => p.id));
    this.retainOnly(ids);
    for (const p of placed) {
      const existing = this.bodies.get(p.id);
      if (existing) {
        existing.r = p.r;
        existing.homeX = p.x;
        existing.homeY = p.y;
        existing.x = p.x;
        existing.y = p.y;
        existing.vx = 0;
        existing.vy = 0;
      } else {
        this.upsert(p.id, p.r, p.x, p.y);
      }
    }
  }

  contentBottom(): number {
    let bottom = 0;
    for (const b of this.bodies.values()) {
      bottom = Math.max(bottom, b.y + b.r);
    }
    return bottom;
  }

  remove(id: string) {
    this.bodies.delete(id);
  }

  retainOnly(ids: Set<string>) {
    for (const id of [...this.bodies.keys()]) {
      if (!ids.has(id)) this.bodies.delete(id);
    }
  }

  startDrag(id: string) {
    const b = this.bodies.get(id);
    if (!b) return;
    b.dragging = true;
    b.vx = 0;
    b.vy = 0;
  }

  dragTo(id: string, x: number, y: number) {
    const b = this.bodies.get(id);
    if (!b || !b.dragging) return;
    b.x = x;
    b.y = y;
  }

  endDrag(id: string) {
    const b = this.bodies.get(id);
    if (!b) return;
    b.dragging = false;
    const minX = b.r + EDGE_PAD;
    const maxX = Math.max(minX, this.width - b.r - EDGE_PAD);
    b.homeX = clamp(b.x, minX, maxX);
    b.vx = 0;
    b.vy = -RELEASE_RISE;
  }

  step(dt: number) {
    this.time += dt;
    const bodies = [...this.bodies.values()];

    for (const b of bodies) {
      if (b.dragging) continue;
      if (!this.reducedMotion) {
        b.vx += Math.cos(this.time * 1.05 + b.phase) * FLOAT_FORCE_X * dt;
        b.vy += Math.sin(this.time * 0.8 + b.phase * 1.2) * FLOAT_FORCE_Y * dt;
      }
      b.vx += (b.homeX - b.x) * HOME_SPRING_X * dt;
      b.vy += (b.homeY - b.y) * HOME_SPRING_Y * dt;
      b.vy -= BUOYANCY * dt;
      const decay = Math.max(0, 1 - DAMPING * dt);
      b.vx *= decay;
      b.vy *= decay;
      b.vx = clamp(b.vx, -MAX_HORIZ_SPEED, MAX_HORIZ_SPEED);
      b.vy = clamp(b.vy, -MAX_VERT_SPEED, MAX_VERT_SPEED);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          this.resolveCollision(bodies[i], bodies[j]);
        }
      }
    }

    for (const b of bodies) {
      if (b.dragging) continue;
      b.vx = clamp(b.vx, -MAX_HORIZ_SPEED, MAX_HORIZ_SPEED);
      b.vy = clamp(b.vy, -MAX_VERT_SPEED, MAX_VERT_SPEED);
      const minX = b.r + EDGE_PAD;
      const maxX = this.width - b.r - EDGE_PAD;
      const minY = b.r + EDGE_PAD;
      const maxY = this.height - b.r - EDGE_PAD;
      if (b.x < minX) {
        b.x = minX;
        b.vx = Math.abs(b.vx) * 0.08;
      }
      if (b.x > maxX) {
        b.x = Math.max(minX, maxX);
        b.vx = -Math.abs(b.vx) * 0.08;
      }
      if (b.y < minY) {
        b.y = minY;
        b.vy = Math.abs(b.vy) * 0.2;
      }
      if (b.y > maxY) {
        b.y = Math.max(minY, maxY);
        b.vy = -Math.abs(b.vy) * 0.25;
      }
    }
  }

  private resolveCollision(a: BalloonBody, b: BalloonBody) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minDist = a.r + b.r + COLLISION_GAP;
    const distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist) return;
    const dist = Math.sqrt(distSq) || 0.001;
    let nx = dx / dist;
    let ny = dy / dist;
    const overlap = minDist - dist;

    const aWeight = a.dragging ? 0 : b.dragging ? 1 : 0.5;
    const bWeight = 1 - aWeight;

    // 横方向の押し出しを弱め、鉛直方向を優先してヘリウム風船らしい分離にする
    if (Math.abs(nx) > Math.abs(ny)) {
      nx *= 0.35;
      ny = ny >= 0 ? 1 : -1;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
    }

    a.x -= nx * overlap * aWeight;
    a.y -= ny * overlap * aWeight;
    b.x += nx * overlap * bWeight;
    b.y += ny * overlap * bWeight;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface PlacedCircle {
  id: string;
  x: number;
  y: number;
  r: number;
}

export function generateInitialLayout(
  items: { id: string; r: number }[],
  fieldWidth: number,
  minHeight: number,
): { placed: PlacedCircle[]; requiredHeight: number } {
  const placed: PlacedCircle[] = [];
  const gap = COLLISION_GAP + 6;
  let maxBottom = 0;

  for (const item of items) {
    const pos = placeNewBalloon(item.r, fieldWidth, placed, gap);
    if (!pos) continue;
    placed.push({ id: item.id, x: pos.x, y: pos.y, r: item.r });
    maxBottom = Math.max(maxBottom, pos.y + item.r);
  }

  return { placed, requiredHeight: Math.max(minHeight, maxBottom + EDGE_PAD + 16) };
}

/** 既存風船を動かさず、新しい風船の初期位置だけを探す。 */
export function placeNewBalloon(
  r: number,
  fieldWidth: number,
  existing: { x: number; y: number; r: number }[],
  gap = COLLISION_GAP + 6,
): { x: number; y: number } | null {
  const minX = r + EDGE_PAD;
  const maxX = Math.max(minX, fieldWidth - r - EDGE_PAD);
  for (let y = r + EDGE_PAD + 8; y < 100000; y += 14) {
    const slots = 7;
    const order = shuffled(slots);
    for (const s of order) {
      const x = minX + ((maxX - minX) * s) / Math.max(1, slots - 1) + (Math.random() - 0.5) * 10;
      const cx = clamp(x, minX, maxX);
      if (existing.every((p) => (p.x - cx) ** 2 + (p.y - y) ** 2 >= (p.r + r + gap) ** 2)) {
        return { x: cx, y };
      }
    }
  }
  return null;
}

function shuffled(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
