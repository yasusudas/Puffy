/**
 * 風船用の軽量2D物理エンジン。
 * 円形ボディの浮遊・衝突・初期位置への復元・ドラッグ・慣性を扱う。
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
  phase: number; // 浮遊アニメーションの位相
  dragging: boolean;
}

const FLOAT_FORCE = 12; // px/s^2
const HOME_SPRING = 1.2; // 初期位置への復元力
const DAMPING = 1.4; // 速度減衰
const COLLISION_GAP = 4; // 風船同士の最小間隔
const MAX_SPEED = 900;
const EDGE_PAD = 6;

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

  upsert(id: string, r: number, homeX: number, homeY: number): BalloonBody {
    const existing = this.bodies.get(id);
    if (existing) {
      existing.r = r;
      existing.homeX = homeX;
      existing.homeY = homeY;
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

  endDrag(id: string, vx: number, vy: number) {
    const b = this.bodies.get(id);
    if (!b) return;
    b.dragging = false;
    // 指を離した後の弱い慣性 (上限あり)
    const scale = 0.6;
    b.vx = clamp(vx * scale, -MAX_SPEED, MAX_SPEED);
    b.vy = clamp(vy * scale, -MAX_SPEED, MAX_SPEED);
  }

  step(dt: number) {
    this.time += dt;
    const bodies = [...this.bodies.values()];

    for (const b of bodies) {
      if (b.dragging) continue;
      if (!this.reducedMotion) {
        // 基本位置の周囲での弱い浮遊
        b.vx += Math.cos(this.time * 0.9 + b.phase) * FLOAT_FORCE * dt;
        b.vy += Math.sin(this.time * 0.7 + b.phase * 1.3) * FLOAT_FORCE * dt;
      }
      // 初期位置への弱い復元力
      b.vx += (b.homeX - b.x) * HOME_SPRING * dt;
      b.vy += (b.homeY - b.y) * HOME_SPRING * dt;
      // 減衰
      const decay = Math.max(0, 1 - DAMPING * dt);
      b.vx *= decay;
      b.vy *= decay;
      b.vx = clamp(b.vx, -MAX_SPEED, MAX_SPEED);
      b.vy = clamp(b.vy, -MAX_SPEED, MAX_SPEED);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    // 衝突解決 (位置補正ベース、数回反復して安定させる)
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          this.resolveCollision(bodies[i], bodies[j]);
        }
      }
    }

    // 境界を貫通させない
    for (const b of bodies) {
      const minX = b.r + EDGE_PAD;
      const maxX = this.width - b.r - EDGE_PAD;
      const minY = b.r + EDGE_PAD;
      const maxY = this.height - b.r - EDGE_PAD;
      if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x > maxX) { b.x = Math.max(minX, maxX); b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy) * 0.5; }
      if (b.y > maxY) { b.y = Math.max(minY, maxY); b.vy = -Math.abs(b.vy) * 0.5; }
    }
  }

  private resolveCollision(a: BalloonBody, b: BalloonBody) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minDist = a.r + b.r + COLLISION_GAP;
    const distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist) return;
    const dist = Math.sqrt(distSq) || 0.001;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;

    // ドラッグ中のボディは動かさず、相手側を全量押し出す
    const aWeight = a.dragging ? 0 : b.dragging ? 1 : 0.5;
    const bWeight = 1 - aWeight;
    a.x -= nx * overlap * aWeight;
    a.y -= ny * overlap * aWeight;
    b.x += nx * overlap * bWeight;
    b.y += ny * overlap * bWeight;

    // 互いに押し合う反発速度
    const push = overlap * 6;
    if (!a.dragging) {
      a.vx -= nx * push * bWeight;
      a.vy -= ny * push * bWeight;
    }
    if (!b.dragging) {
      b.vx += nx * push * aWeight;
      b.vy += ny * push * aWeight;
    }
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

/**
 * 衝突しない初期位置を上から下へ優先度順に生成する。
 * 返り値の requiredHeight をフィールドの高さに使う。
 */
export function generateInitialLayout(
  items: { id: string; r: number }[],
  fieldWidth: number,
  minHeight: number,
): { placed: PlacedCircle[]; requiredHeight: number } {
  const placed: PlacedCircle[] = [];
  const gap = COLLISION_GAP + 6;
  let maxBottom = 0;

  for (const item of items) {
    const r = item.r;
    const minX = r + EDGE_PAD;
    const maxX = Math.max(minX, fieldWidth - r - EDGE_PAD);
    let found = false;
    for (let y = r + EDGE_PAD + 8; !found; y += 14) {
      // 同じ高さでは横位置をジッター付きで数候補試す
      const slots = 7;
      const order = shuffled(slots);
      for (const s of order) {
        const x = minX + ((maxX - minX) * s) / Math.max(1, slots - 1) + (Math.random() - 0.5) * 10;
        const cx = clamp(x, minX, maxX);
        if (placed.every((p) => (p.x - cx) ** 2 + (p.y - y) ** 2 >= (p.r + r + gap) ** 2)) {
          placed.push({ id: item.id, x: cx, y, r });
          maxBottom = Math.max(maxBottom, y + r);
          found = true;
          break;
        }
      }
      if (y > 100000) break; // 安全弁
    }
  }

  return { placed, requiredHeight: Math.max(minHeight, maxBottom + EDGE_PAD + 16) };
}

function shuffled(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
