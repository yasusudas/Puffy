import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Folder, Task } from "../types";
import { colorHex, textColorFor, UNFILED_COLOR, WARNING_COLOR } from "../lib/colors";
import { formatDue, formatOverdue } from "../lib/time";
import { balloonDiameter, isOverdue, sizeLevel } from "../lib/size";
import { BalloonEngine, generateInitialLayout } from "../physics/engine";

const TAP_THRESHOLD_PX = 8;
const POP_DURATION_MS = 420;

interface BalloonFieldProps {
  tasks: Task[]; // 優先度順にソート済み
  folders: Map<string, Folder>;
  now: Date;
  poppingIds: Set<string>;
  onTapTask: (id: string) => void;
}

interface ShardBurst {
  key: string;
  x: number;
  y: number;
  color: string;
}

interface DragState {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
}

export function BalloonField({ tasks, folders, now, poppingIds, onTapTask }: BalloonFieldProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BalloonEngine | null>(null);
  if (!engineRef.current) engineRef.current = new BalloonEngine();
  const engine = engineRef.current;

  const elRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<DragState | null>(null);
  const [width, setWidth] = useState(0);
  const [fieldHeight, setFieldHeight] = useState(0);
  const [bursts, setBursts] = useState<ShardBurst[]>([]);
  const seenPopping = useRef(new Set<string>());

  // フィールド幅の監視
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => setWidth(wrap.clientWidth));
    observer.observe(wrap);
    setWidth(wrap.clientWidth);
    return () => observer.disconnect();
  }, []);

  // prefers-reduced-motion で自動浮遊を停止
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      engine.reducedMotion = mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [engine]);

  // 風船ごとの表示パラメータ
  const balloons = useMemo(() => {
    return tasks.map((task) => {
      const overdue = isOverdue(task.dueAt, now);
      const level = sizeLevel(task.dueAt, task.inflationWindowHours, now);
      const diameter = width > 0 ? balloonDiameter(level, width) : 100;
      const folder = task.folderId ? folders.get(task.folderId) : undefined;
      const baseColor = folder ? colorHex(folder.colorId) : UNFILED_COLOR;
      const color = overdue ? WARNING_COLOR : baseColor;
      return {
        task,
        overdue,
        level,
        diameter,
        color,
        textColor: textColorFor(color),
        folderName: folder?.name ?? "未分類",
        folderColor: baseColor,
      };
    });
  }, [tasks, folders, now, width]);

  const idsKey = useMemo(() => tasks.map((t) => t.id).join("|"), [tasks]);

  // 初期配置の生成 (タスク構成や幅が変わった時のみ)
  useEffect(() => {
    if (width <= 0) return;
    const minHeight = wrapRef.current?.clientHeight ?? 400;
    const items = balloons.map((b) => ({ id: b.task.id, r: b.diameter / 2 }));
    const { placed, requiredHeight } = generateInitialLayout(items, width, minHeight);
    setFieldHeight(requiredHeight);
    engine.setBounds(width, requiredHeight);
    engine.retainOnly(new Set(items.map((i) => i.id)));
    for (const p of placed) {
      engine.upsert(p.id, p.r, p.x, p.y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, width, engine]);

  // 時間経過によるサイズ変化を物理ボディへ反映
  useEffect(() => {
    for (const b of balloons) {
      const body = engine.bodies.get(b.task.id);
      if (body) body.r = b.diameter / 2;
    }
  }, [balloons, engine]);

  // 物理演算ループ
  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.032, (t - lastT) / 1000);
      lastT = t;
      engine.step(dt);
      for (const [id, el] of elRefs.current) {
        const body = engine.bodies.get(id);
        if (!body) continue;
        el.style.setProperty("--tx", `${body.x - body.r}px`);
        el.style.setProperty("--ty", `${body.y - body.r}px`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // 破裂エフェクトの発火
  useEffect(() => {
    for (const id of poppingIds) {
      if (seenPopping.current.has(id)) continue;
      seenPopping.current.add(id);
      const body = engine.bodies.get(id);
      const balloon = balloons.find((b) => b.task.id === id);
      if (!body || !balloon) continue;
      const burst: ShardBurst = { key: `${id}:${Date.now()}`, x: body.x, y: body.y, color: balloon.color };
      setBursts((prev) => [...prev, burst]);
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((s) => s.key !== burst.key));
        seenPopping.current.delete(id);
      }, POP_DURATION_MS + 120);
    }
  }, [poppingIds, balloons, engine]);

  const fieldPos = useCallback((clientX: number, clientY: number) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (poppingIds.has(id)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const t = performance.now();
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: t,
      vx: 0,
      vy: 0,
    };
  }, [poppingIds]);

  const handlePointerMove = useCallback((e: React.PointerEvent, id: string) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging && Math.hypot(dx, dy) >= TAP_THRESHOLD_PX) {
      drag.dragging = true;
      engine.startDrag(id);
    }
    if (drag.dragging) {
      const t = performance.now();
      const dtMs = Math.max(1, t - drag.lastT);
      drag.vx = ((e.clientX - drag.lastX) / dtMs) * 1000;
      drag.vy = ((e.clientY - drag.lastY) / dtMs) * 1000;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastT = t;
      const pos = fieldPos(e.clientX, e.clientY);
      engine.dragTo(id, pos.x, pos.y);
    }
  }, [engine, fieldPos]);

  const handlePointerEnd = useCallback((e: React.PointerEvent, id: string, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (drag.dragging) {
      engine.endDrag(id, drag.vx, drag.vy);
    } else if (!cancelled) {
      // 移動量8px未満はタップとして詳細を開く
      onTapTask(id);
    }
  }, [engine, onTapTask]);

  return (
    <div className="balloon-field-wrap" ref={wrapRef}>
      <div className="balloon-field" ref={fieldRef} style={{ height: fieldHeight }}>
        {balloons.map((b) => {
          const d = b.diameter;
          const fontSize = Math.max(11, Math.min(15, d * 0.115));
          const popping = poppingIds.has(b.task.id);
          const ariaLabel = [
            b.task.title,
            `期限 ${formatDue(b.task.dueAt, now)}`,
            b.overdue ? `期限超過 ${formatOverdue(b.task.dueAt, now)}` : null,
            `フォルダ ${b.folderName}`,
          ]
            .filter(Boolean)
            .join("、");
          return (
            <div
              key={b.task.id}
              ref={(el) => {
                if (el) elRefs.current.set(b.task.id, el);
                else elRefs.current.delete(b.task.id);
              }}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel}
              className={`balloon${b.overdue ? " overdue" : ""}${popping ? " popping" : ""}`}
              style={
                {
                  width: d,
                  height: d,
                  fontSize,
                  background: `radial-gradient(circle at 32% 28%, ${lighten(b.color, 0.25)}, ${b.color} 62%, ${darken(b.color, 0.18)})`,
                  color: b.textColor,
                  transform: "translate(var(--tx), var(--ty))",
                  "--balloon-color": b.color,
                  "--tx": "0px",
                  "--ty": "0px",
                } as React.CSSProperties
              }
              onPointerDown={(e) => handlePointerDown(e, b.task.id)}
              onPointerMove={(e) => handlePointerMove(e, b.task.id)}
              onPointerUp={(e) => handlePointerEnd(e, b.task.id, false)}
              onPointerCancel={(e) => handlePointerEnd(e, b.task.id, true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTapTask(b.task.id);
                }
              }}
            >
              {b.overdue && (
                <span className="balloon-overdue-label">
                  期限超過 {formatOverdue(b.task.dueAt, now)}
                </span>
              )}
              <span className="balloon-title">{b.task.title}</span>
              <span className="balloon-due">{formatDue(b.task.dueAt, now)}</span>
              {b.overdue && b.task.folderId && (
                <span
                  className="balloon-folder-tag"
                  style={{ background: b.folderColor, color: textColorFor(b.folderColor) }}
                >
                  {b.folderName}
                </span>
              )}
            </div>
          );
        })}
        {bursts.map((burst) => (
          <PopShards key={burst.key} burst={burst} />
        ))}
      </div>
    </div>
  );
}

function PopShards({ burst }: { burst: ShardBurst }) {
  const shards = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 40 + Math.random() * 50;
      return {
        sx: Math.cos(angle) * dist,
        sy: Math.sin(angle) * dist,
        delay: Math.random() * 0.05,
      };
    });
  }, []);
  return (
    <div className="pop-shards" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
      {shards.map((s, i) => (
        <span
          key={i}
          className="pop-shard"
          style={{
            background: burst.color,
            animationDelay: `${s.delay}s`,
            "--sx": `${s.sx}px`,
            "--sy": `${s.sy}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function lighten(hex: string, amount: number): string {
  return mix(hex, 255, amount);
}

function darken(hex: string, amount: number): string {
  return mix(hex, 0, amount);
}

function mix(hex: string, target: number, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const m = (v: number) => Math.round(v + (target - v) * amount);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}
