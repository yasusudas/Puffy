import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Folder, Task } from "../types";
import { colorHex, textColorFor, UNFILED_COLOR, WARNING_COLOR } from "../lib/colors";
import { formatDue, formatOverdue, formatTimeLeft } from "../lib/time";
import { diameterForProgress, inflationProgress } from "../lib/size";
import { BalloonEngine, generateInitialLayout, placeNewBalloon, EDGE_PAD } from "../physics/engine";

const TAP_THRESHOLD_PX = 8;
const POP_DURATION_MS = 420;
// 期限変更後、旧デザインから新デザインへ遷移させる時間
const DUE_ANIM_DURATION_MS = 7000;
const IMMINENT_MS = 60 * 60 * 1000;

/** 期限変更アニメーションのイージング (緩急のある滑らかな遷移) */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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
  const syncedWidthRef = useRef(0);
  const syncedIdsRef = useRef<Set<string>>(new Set());

  // 期限変更アニメーション: id ごとに「変更前の期限」から実効期限を補間する
  const animsRef = useRef(new Map<string, { fromDueMs: number; startPerf: number }>());
  const lastDueRef = useRef(new Map<string, number>());
  const animRafRef = useRef<number | null>(null);
  const [frame, setFrame] = useState(0);

  // 期限の変化を検知してアニメーションを登録 (描画中に同期実行し、変更直後の
  // フレームから「変更前デザイン」で開始されるようにする)
  useMemo(() => {
    const perf = performance.now();
    const seen = new Set<string>();
    for (const task of tasks) {
      seen.add(task.id);
      const dueMs = new Date(task.dueAt).getTime();
      const prev = lastDueRef.current.get(task.id);
      if (prev === undefined) {
        // 初出 (新規作成・タブ切替) はアニメーションせず即時表示
        lastDueRef.current.set(task.id, dueMs);
      } else if (prev !== dueMs) {
        animsRef.current.set(task.id, { fromDueMs: prev, startPerf: perf });
        lastDueRef.current.set(task.id, dueMs);
      }
    }
    for (const id of Array.from(lastDueRef.current.keys())) {
      if (!seen.has(id)) {
        lastDueRef.current.delete(id);
        animsRef.current.delete(id);
      }
    }
  }, [tasks]);

  // アニメーション中は毎フレーム再描画し、終了したら停止する
  useEffect(() => {
    if (animsRef.current.size === 0 || animRafRef.current !== null) return;
    const loop = () => {
      const perf = performance.now();
      for (const [id, a] of animsRef.current) {
        if (perf - a.startPerf >= DUE_ANIM_DURATION_MS) animsRef.current.delete(id);
      }
      setFrame((f) => f + 1);
      animRafRef.current = animsRef.current.size > 0 ? requestAnimationFrame(loop) : null;
    };
    animRafRef.current = requestAnimationFrame(loop);
  });

  useEffect(
    () => () => {
      if (animRafRef.current !== null) cancelAnimationFrame(animRafRef.current);
    },
    [],
  );

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

  // 風船ごとの表示パラメータ。
  // 期限が変更された風船は「実効期限」を変更前→変更後へ7秒かけて補間し、
  // サイズ・色・期限超過/まもなく表示・残り時間ラベルをそれに連動させる。
  // 期限の絶対表示とaria-labelは実際の値で即時更新する (誤読防止)。
  const balloons = useMemo(() => {
    const perf = performance.now();
    const nowMs = now.getTime();
    return tasks.map((task) => {
      const realDueMs = new Date(task.dueAt).getTime();
      const anim = animsRef.current.get(task.id);
      let effDueMs = realDueMs;
      if (anim) {
        const t = (perf - anim.startPerf) / DUE_ANIM_DURATION_MS;
        if (t < 1) {
          effDueMs = anim.fromDueMs + (realDueMs - anim.fromDueMs) * easeInOutCubic(t);
        }
      }
      const effIso = new Date(effDueMs).toISOString();
      const overdue = nowMs >= effDueMs;
      const imminent = !overdue && effDueMs - nowMs <= IMMINENT_MS;
      const eased = inflationProgress(effIso, task.inflationWindowHours, now);
      const diameter = width > 0 ? diameterForProgress(eased, width) : 100;
      const folder = task.folderId ? folders.get(task.folderId) : undefined;
      const folderColor = folder ? colorHex(folder.colorId) : UNFILED_COLOR;
      // タスク個別の色が指定されていればフォルダ色より優先する
      const baseColor = task.colorId ? colorHex(task.colorId) : folderColor;
      const color = overdue ? WARNING_COLOR : baseColor;
      return {
        task,
        overdue,
        imminent,
        diameter,
        color,
        textColor: textColorFor(color),
        folderName: folder?.name ?? "未分類",
        folderColor,
        dueText: formatDue(task.dueAt, now),
        overdueText: formatOverdue(effIso, now),
        imminentText: formatTimeLeft(effIso, now),
        realOverdue: nowMs >= realDueMs,
        realImminent: nowMs < realDueMs && realDueMs - nowMs <= IMMINENT_MS,
      };
    });
    // frame はアニメーション中の毎フレーム再計算のためのトリガー
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, folders, now, width, frame]);

  // 配置: 幅変更時のみ全再配置。風船の増減では既存の home/位置を保持する。
  useEffect(() => {
    if (width <= 0) return;
    const minHeight = wrapRef.current?.clientHeight ?? 400;
    const items = balloons.map((b) => ({ id: b.task.id, r: b.diameter / 2 }));
    const currentIds = new Set(items.map((i) => i.id));

    if (syncedWidthRef.current !== width) {
      const { placed, requiredHeight } = generateInitialLayout(items, width, minHeight);
      setFieldHeight(requiredHeight);
      engine.setBounds(width, requiredHeight);
      engine.resetLayout(placed);
      syncedWidthRef.current = width;
      syncedIdsRef.current = currentIds;
      return;
    }

    for (const id of syncedIdsRef.current) {
      if (!currentIds.has(id)) engine.remove(id);
    }

    const obstacles = [...engine.bodies.values()].map((b) => ({ x: b.x, y: b.y, r: b.r }));
    for (const item of items) {
      if (!syncedIdsRef.current.has(item.id)) {
        const pos = placeNewBalloon(item.r, width, obstacles);
        if (pos) {
          engine.upsert(item.id, item.r, pos.x, pos.y);
          obstacles.push({ x: pos.x, y: pos.y, r: item.r });
        }
      } else {
        const body = engine.bodies.get(item.id);
        if (body) body.r = item.r;
      }
    }

    engine.retainOnly(currentIds);
    syncedIdsRef.current = currentIds;

    const requiredHeight = Math.max(minHeight, engine.contentBottom() + EDGE_PAD + 16);
    setFieldHeight(requiredHeight);
    engine.setBounds(width, requiredHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balloons, width, engine]);

  // 時間経過によるサイズ変化を物理ボディへ反映 (home は変えない)
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
        el.style.setProperty("--tx", `${Math.round(body.x - body.r)}px`);
        el.style.setProperty("--ty", `${Math.round(body.y - body.r)}px`);
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
      engine.remove(id);
      elRefs.current.delete(id);
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
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
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
      const pos = fieldPos(e.clientX, e.clientY);
      engine.dragTo(id, pos.x, pos.y);
    }
  }, [engine, fieldPos]);

  const handlePointerEnd = useCallback((e: React.PointerEvent, id: string, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== id || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (drag.dragging) {
      // ドラッグ方向に関わらず、離した位置から鉛直上方向へ浮かせる
      engine.endDrag(id);
    } else if (!cancelled) {
      // 移動量8px未満はタップとして詳細を開く。
      // preventDefault でタッチ後の合成 click (ゴーストクリック) を抑止し、
      // 詳細シート上の「完了」ボタンが同座標で誤発火するのを防ぐ。
      e.preventDefault();
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
            `期限 ${b.dueText}`,
            b.realOverdue ? `期限超過 ${formatOverdue(b.task.dueAt, now)}` : null,
            b.realImminent ? `まもなく期限 ${formatTimeLeft(b.task.dueAt, now)}` : null,
            `フォルダ ${b.folderName}`,
          ]
            .filter(Boolean)
            .join("、");
          return (
            <div
              key={b.task.id}
              ref={(el) => {
                if (el) {
                  elRefs.current.set(b.task.id, el);
                  // 位置はRAFが --tx/--ty で制御する。再描画でリセットしないよう
                  // インラインstyleには持たせず、未設定時のみ初期化する。
                  if (!el.style.getPropertyValue("--tx")) {
                    el.style.setProperty("--tx", "0px");
                    el.style.setProperty("--ty", "0px");
                  }
                } else {
                  elRefs.current.delete(b.task.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel}
              className={`balloon${b.overdue ? " overdue" : ""}${b.imminent ? " imminent" : ""}${popping ? " popping" : ""}`}
              style={
                {
                  width: d,
                  height: d,
                  fontSize,
                  background: `radial-gradient(circle at 32% 28%, ${lighten(b.color, 0.25)}, ${b.color} 62%, ${darken(b.color, 0.18)})`,
                  color: b.textColor,
                  transform: "translate(var(--tx), var(--ty))",
                  "--balloon-color": b.color,
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
                  期限超過 {b.overdueText}
                </span>
              )}
              {b.imminent && (
                <span className="balloon-imminent-label">
                  まもなく期限 {b.imminentText}
                </span>
              )}
              <span className="balloon-title">{b.task.title}</span>
              <span className="balloon-due">{b.dueText}</span>
              {b.overdue && b.task.folderId && (
                <span
                  className="balloon-folder-tag"
                  style={{ background: b.folderColor, color: textColorFor(b.folderColor) }}
                >
                  {b.folderName}
                </span>
              )}
              <svg className="balloon-string" viewBox="0 0 18 114" aria-hidden="true">
                <path d="M9 0 C 2 33, 16 66, 9 114" />
              </svg>
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
