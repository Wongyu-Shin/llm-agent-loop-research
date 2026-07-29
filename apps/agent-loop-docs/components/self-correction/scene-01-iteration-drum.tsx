"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
} from "react";

import { LabShell, useSvgIdPrefix } from "@/components/visualizations/viz-shell";
import { stationaryUpperBound, transitionAccuracy } from "./paper-model";
import styles from "./paper-scenes.module.css";

/**
 * Scene 1 primary visual — neon iteration drum.
 *
 * Each iteration's state is one flat 2D bar: the correct share glows neon
 * green, the incorrect share neon red (glow filters in the style of the
 * neo-nixietube diagrams). Bars sit on a rolling drum: future iterations
 * approach from the back as colorless silhouettes, get lit when they reach
 * the front, then recede as history, fading darker and more transparent at
 * the same rate as their glow. Two mixer-style faders set the recovery
 * ratio CSₜ and the damage ratio 1 − CLₜ; each fader soft-locks onto the
 * other's value, which is the break-even point switching 개선/중지/훼손.
 */

const SLOT_COUNT = 14;
const SOFT_LOCK_RANGE = 0.035;
const CONDITION_EPSILON = 0.0025;
const INITIAL_ACCURACY = 0.5;
const INITIAL_RECOVERY = 0.65;
const INITIAL_DAMAGE = 0.4;
const MAX_STEPS_PER_SECOND = 1.26;
const SPEED_RAMP_MS = 3200;
const REDUCED_MOTION_FRONT = 5;

const CX = 340;
const CY = 210;
const DRUM_RADIUS = 168;
const BAR_LENGTH = 430;
const BAR_DIAMETER = 30;
/** Design-system --radius-md (globals.css). */
const BAR_RADIUS = 6;

type DrumCondition = "개선" | "중지" | "훼손";

type DrumState = {
  progress: number;
  history: number[];
};

function easeInCubic(x: number) {
  return x * x * x;
}

/**
 * 초기 정확도 50%에서는 복구 비율이 훼손 비율보다 크면 Upp > 50%로
 * 개선이고, 작으면 훼손이며, 같으면 손익분기다.
 */
function conditionFor(recovery: number, damage: number): DrumCondition {
  if (recovery > damage + CONDITION_EPSILON) return "개선";
  if (recovery < damage - CONDITION_EPSILON) return "훼손";
  return "중지";
}

function extendHistory(
  history: number[],
  upTo: number,
  recovery: number,
  damage: number,
) {
  if (history.length > upTo) return history;
  const extended = [...history];
  while (extended.length <= upTo) {
    extended.push(
      transitionAccuracy(extended[extended.length - 1], 1 - damage, recovery),
    );
  }
  return extended;
}

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function DrumFader({
  label,
  description,
  value,
  detent,
  role,
  condition,
  onCommit,
}: {
  label: string;
  description: string;
  value: number;
  /** 다른 페이더의 현재 값 — 손익분기이자 소프트 락 지점. */
  detent: number;
  /** improve zone 방향: recovery는 detent 오른쪽, damage는 왼쪽이 개선. */
  role: "recovery" | "damage";
  condition: DrumCondition;
  onCommit: (value: number) => void;
}) {
  const draggingRef = useRef(false);
  const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    let next = Number(event.target.value);
    // Mixer-style soft lock: while dragging, snap onto the other fader's
    // value so 중지 can be dialed in exactly. Keyboard steps are not
    // captured so arrow keys can still leave the detent.
    if (draggingRef.current && Math.abs(next - detent) < SOFT_LOCK_RANGE) {
      next = detent;
    }
    onCommit(next);
  };

  const detentPercent = `${(detent * 100).toFixed(1)}%`;

  return (
    <div
      className={styles.faderBlock}
      data-fader={role}
      style={{ "--drum-detent": detentPercent } as CSSProperties}
    >
      <div className={styles.faderHeading}>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <div className={styles.faderZones} aria-hidden="true">
        <span data-zone={role === "recovery" ? "damage" : "improve"}>
          ◀ {role === "recovery" ? "훼손" : "개선"}
        </span>
        <span data-zone="stall">중지</span>
        <span data-zone={role === "recovery" ? "improve" : "damage"}>
          {role === "recovery" ? "개선" : "훼손"} ▶
        </span>
      </div>
      <input
        className={styles.faderInput}
        type="range"
        min={0}
        max={1}
        step={0.005}
        value={value}
        aria-label={label}
        aria-valuetext={`${label} ${formatPercent(value)} · ${condition}`}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onChange={handleChange}
      />
      <div className={styles.faderScale} aria-hidden="true">
        <span>0%</span>
        <span className={styles.faderDetent}>
          ▲ 손익분기 {formatPercent(detent)}
        </span>
        <span>100%</span>
      </div>
    </div>
  );
}

export function IterationDrum() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idPrefix = useSvgIdPrefix("iteration-drum");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );

  const [recovery, setRecovery] = useState(INITIAL_RECOVERY);
  const [damage, setDamage] = useState(INITIAL_DAMAGE);
  const [visible, setVisible] = useState(false);
  const [drum, setDrum] = useState<DrumState>(() => ({
    progress: 0,
    history: extendHistory(
      [INITIAL_ACCURACY],
      REDUCED_MOTION_FRONT,
      INITIAL_RECOVERY,
      INITIAL_DAMAGE,
    ),
  }));

  const recoveryRef = useRef(recovery);
  const damageRef = useRef(damage);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setVisible(
            entry.isIntersecting &&
              (entry.intersectionRatio >= 0.25 ||
                entry.intersectionRect.height / window.innerHeight >= 0.35),
          );
        }
      },
      { threshold: [0, 0.25, 0.5] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Continuous rotation while visible; speed ramps 0 → max with ease-in
  // every time the drum (re-)enters the viewport. History extends inside
  // the tick so past iterations keep the rates active at the time.
  useEffect(() => {
    if (reducedMotion || !visible) return;
    let frame = 0;
    const startedAt = performance.now();
    let last = startedAt;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ramp = easeInCubic(Math.min(1, (now - startedAt) / SPEED_RAMP_MS));
      setDrum((current) => {
        const progress = current.progress + dt * MAX_STEPS_PER_SECOND * ramp;
        return {
          progress,
          // +1: 다가오는 막대가 crossfade로 미리 점등되므로 한 칸 앞서 계산.
          history: extendHistory(
            current.history,
            Math.floor(progress) + 1,
            recoveryRef.current,
            damageRef.current,
          ),
        };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, visible]);

  const displayProgress = reducedMotion ? REDUCED_MOTION_FRONT : drum.progress;
  const frontIteration = Math.min(
    Math.floor(displayProgress),
    drum.history.length - 1,
  );

  const condition = conditionFor(recovery, damage);
  const upperBound = stationaryUpperBound(1 - damage, recovery);
  const frontAccuracy = drum.history[frontIteration];

  // Past iterations stay frozen; only not-yet-reached ones adopt the new
  // rates.
  const refreshFuture = (nextRecovery: number, nextDamage: number) => {
    setDrum((current) => {
      const front = Math.min(
        Math.floor(
          readReducedMotion() ? REDUCED_MOTION_FRONT : current.progress,
        ),
        current.history.length - 1,
      );
      const needed = Math.max(front + 1, REDUCED_MOTION_FRONT);
      return {
        progress: current.progress,
        history: extendHistory(
          current.history.slice(0, front + 1),
          needed,
          nextRecovery,
          nextDamage,
        ),
      };
    });
  };

  const commitRecovery = (value: number) => {
    recoveryRef.current = value;
    setRecovery(value);
    refreshFuture(value, damageRef.current);
  };

  const commitDamage = (value: number) => {
    damageRef.current = value;
    setDamage(value);
    refreshFuture(recoveryRef.current, value);
  };

  const bars = useMemo(() => {
    const items: Array<{
      iteration: number;
      y: number;
      depth: number;
      scale: number;
      state: "past" | "front" | "future";
      accuracy: number;
    }> = [];
    for (
      let iteration = frontIteration - 6;
      iteration <= frontIteration + 7;
      iteration += 1
    ) {
      if (iteration < 0) continue;
      const angle =
        ((iteration - displayProgress) * (2 * Math.PI)) / SLOT_COUNT;
      const depth = Math.cos(angle);
      if (depth < 0.04) continue;
      // 회전 방향: 미도달 막대가 아래-뒤에서 올라와 전면을 지나 위로 물러난다.
      const y = CY + Math.sin(angle) * DRUM_RADIUS;
      const scale = 0.48 + 0.52 * depth;
      const state =
        iteration > frontIteration
          ? "future"
          : iteration === frontIteration
            ? "front"
            : "past";
      items.push({
        iteration,
        y,
        depth,
        scale,
        state,
        // 다가오는 막대(front+1)는 crossfade 점등을 위해 미리 계산된
        // history 값을 사용한다.
        accuracy: drum.history[iteration] ?? INITIAL_ACCURACY,
      });
    }
    return items.sort((a, b) => a.depth - b.depth);
  }, [frontIteration, displayProgress, drum.history]);

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const recentRows = [];
  for (
    let iteration = Math.max(0, frontIteration - 4);
    iteration <= frontIteration;
    iteration += 1
  ) {
    recentRows.push({ iteration, accuracy: drum.history[iteration] });
  }

  return (
    <div
      ref={containerRef}
      data-iteration-drum
      data-condition={condition}
      data-spinning={!reducedMotion && visible ? "true" : "false"}
      data-front-iteration={frontIteration}
    >
      <LabShell
        title="Iteration 네온 드럼"
        subtitle="한 막대가 한 iteration — 정답 구간만 네온 green으로 점등된다"
        legend={[
          { label: "정답 · 점등", tone: "success" },
          { label: "오답 · 소등", tone: "neutral" },
          { label: "미도달 iteration", tone: "neutral" },
        ]}
        stageLabel={
          reducedMotion
            ? "모션 감소 설정으로 회전을 정지했습니다 — 페이더는 계속 사용할 수 있습니다"
            : "드럼은 화면에 보이는 동안 계속 회전합니다 · 시작 속도 0에서 ease-in"
        }
        controls={
          <>
            <DrumFader
              label="복구 비율 CSₜ"
              description="오답 → 정답 · 오답이던 응답이 이번 라운드에 정답으로 복구될 확률. 훼손 비율보다 높이면 개선."
              value={recovery}
              detent={damage}
              role="recovery"
              condition={condition}
              onCommit={commitRecovery}
            />
            <DrumFader
              label="훼손 비율 1−CLₜ"
              description="정답 → 오답 · 정답이던 응답이 이번 라운드에 오답으로 훼손될 확률. 복구 비율보다 높이면 훼손."
              value={damage}
              detent={recovery}
              role="damage"
              condition={condition}
              onCommit={commitDamage}
            />
          </>
        }
        status={[
          { label: "조건", value: condition },
          { label: "복구 CSₜ", value: formatPercent(recovery) },
          { label: "훼손 1−CLₜ", value: formatPercent(damage) },
          {
            label: `Accₜ · iter ${frontIteration}`,
            value: formatPercent(frontAccuracy),
          },
          {
            label: "Upp",
            value: upperBound === null ? "정의 안 됨" : formatPercent(upperBound),
          },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              복구 비율 CSₜ와 훼손 비율 1 − CLₜ를 각각의 페이더로 조절합니다.
              초기 정확도 50%에서는 복구 비율이 훼손 비율보다 높으면 개선,
              낮으면 훼손, 같으면 중지이며, 드래그 중에는 서로의 값에서 소프트
              락이 걸립니다.
            </p>
            <p>
              매 라운드 기존 정답의 {formatPercent(damage)}가 훼손되므로, 복구
              비율이 높아도 정확도는 복구 유입과 훼손 유출이 균형을 이루는
              고정점 Upp = CSₜ ÷ (1 − CLₜ + CSₜ)
              {upperBound === null ? "" : ` = ${formatPercent(upperBound)}`}에
              수렴합니다. 반복 자체가 아니라 보존과 복구의 비율이 도달점을
              정합니다.
            </p>
            <table className={styles.transitionTable} data-drum-table>
              <caption>
                최근 iteration의 정확도 · 조건 {condition} · CSₜ{" "}
                {formatPercent(recovery)} · 1−CLₜ {formatPercent(damage)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">iteration</th>
                  <th scope="col">Accₜ</th>
                  <th scope="col">정답 막대</th>
                  <th scope="col">오답 막대</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((row) => (
                  <tr key={row.iteration}>
                    <th scope="row">{row.iteration}</th>
                    <td>{formatPercent(row.accuracy)}</td>
                    <td>{formatPercent(row.accuracy)}</td>
                    <td>{formatPercent(1 - row.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              아직 도달하지 않은 iteration은 색이 없는 실루엣 막대로 뒤에서
              다가오고, 앞에 도착하는 순간 현재 정확도의 비율로 점등됩니다.
            </p>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="iteration 네온 드럼 시각화 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox="0 0 680 430"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>iteration 상태를 보여 주는 회전 네온 드럼</title>
            <desc id={descId}>
              가로 막대들이 드럼처럼 회전한다. 앞에 도착한 막대는 현재
              정확도만큼 네온 green으로 점등되고, 오답 구간은 검게 소등된 채
              점선 실루엣 테두리만 남으며, 아직 도달하지 않은 막대는 전체가
              실루엣이다. 상단 페이더 두 개로 복구 비율과 훼손 비율을 바꾸면
              개선과 중지와 훼손 조건이 전환된다.
            </desc>

            <defs>
              {/* neo-nixietube-style multi-layer glow */}
              <filter
                id={`${idPrefix}-glow`}
                x="-60%"
                y="-60%"
                width="220%"
                height="220%"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b3" />
                <feMerge>
                  <feMergeNode in="b3" />
                  <feMergeNode in="b2" />
                  <feMergeNode in="b1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {bars.map((bar) => {
              const width = BAR_LENGTH * bar.scale;
              const height = BAR_DIAMETER * bar.scale;
              const x = CX - width / 2;
              const y = bar.y - height / 2;
              const labelY = y + height + Math.max(13, 18 * bar.scale);
              const labelSize = Math.max(9, 13 * bar.scale);

              // Continuous crossfade so iteration handover never jumps in a
              // single frame. phase = 0 exactly at the front; incoming bars
              // (phase > 0) light up over the last 45% of their approach.
              const phase = bar.iteration - displayProgress;
              const closeness = Math.max(0, 1 - Math.abs(phase));
              const litness =
                phase <= 0
                  ? 1
                  : Math.min(1, Math.max(0, (closeness - 0.55) / 0.45));
              const silhouetteOpacity =
                (0.28 + bar.depth * 0.24) * (1 - litness);
              const baseFade = 0.3 + bar.depth * 0.5;
              const litFade = (baseFade + (1 - baseFade) * closeness) * litness;
              const darkness =
                Math.min(0.55, (1 - bar.depth) * 0.9) * (1 - closeness);

              const silhouette =
                litness < 1 ? (
                  <g opacity={silhouetteOpacity}>
                    <rect
                      className={styles.silhouetteBar}
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      rx={BAR_RADIUS}
                    />
                    <text
                      className={styles.drumBarLabel}
                      x={CX}
                      y={labelY}
                      textAnchor="middle"
                      fontSize={labelSize}
                    >
                      iter {bar.iteration} · 미도달
                    </text>
                  </g>
                ) : null;

              if (litness === 0) {
                return (
                  <g
                    key={bar.iteration}
                    data-drum-bar={bar.iteration}
                    data-bar-state="future"
                  >
                    {silhouette}
                  </g>
                );
              }

              const greenWidth = width * bar.accuracy;
              const clipMargin = 4;
              const leftClipId = `${idPrefix}-clip-left-${bar.iteration}`;
              const rightClipId = `${idPrefix}-clip-right-${bar.iteration}`;
              const outline = (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={BAR_RADIUS}
                  fill="none"
                  strokeWidth={2.4}
                />
              );

              return (
                <g
                  key={bar.iteration}
                  data-drum-bar={bar.iteration}
                  data-bar-state={bar.state}
                >
                  {silhouette}
                  <g opacity={litFade}>
                    {/* Both segments clip the SAME rounded outline, so the two
                        halves stay perfectly aligned at the divider. */}
                    <clipPath id={leftClipId}>
                      <rect
                        x={x - clipMargin}
                        y={y - clipMargin}
                        width={greenWidth + clipMargin}
                        height={height + clipMargin * 2}
                      />
                    </clipPath>
                    <clipPath id={rightClipId}>
                      <rect
                        x={x + greenWidth}
                        y={y - clipMargin}
                        width={width - greenWidth + clipMargin}
                        height={height + clipMargin * 2}
                      />
                    </clipPath>
                    {/* 오답 구간: 검정 내부 + 미도달 실루엣과 같은 점선 border
                        (글로우 없음). 정답 구간의 네온이 위에 얹힌다. */}
                    <g clipPath={`url(#${rightClipId})`}>
                      <rect
                        className={styles.incorrectBar}
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={BAR_RADIUS}
                      />
                    </g>
                    {/* 정답 구간: border만 강하게 glow. The dark overlay sits
                        INSIDE the filtered group so the glow is computed from
                        the already-darkened strokes and fades in lockstep. */}
                    <g filter={`url(#${idPrefix}-glow)`}>
                      <g clipPath={`url(#${leftClipId})`}>
                        <g stroke="#5ee97d" fill="#5ee97d" fillOpacity={0.08}>
                          {outline}
                        </g>
                        {/* divider: 정답 구간을 닫는 네온 마감선 */}
                        <line
                          x1={x + greenWidth - 1.2}
                          y1={y}
                          x2={x + greenWidth - 1.2}
                          y2={y + height}
                          stroke="#5ee97d"
                          strokeWidth={2}
                        />
                        {darkness > 0 ? (
                          <rect
                            x={x - clipMargin}
                            y={y - clipMargin}
                            width={greenWidth + clipMargin}
                            height={height + clipMargin * 2}
                            fill="#0d0d0d"
                            opacity={darkness}
                          />
                        ) : null}
                      </g>
                    </g>
                    <text
                      className={
                        bar.state === "front"
                          ? styles.drumFrontLabel
                          : styles.drumBarLabel
                      }
                      x={CX}
                      y={labelY}
                      textAnchor="middle"
                      fontSize={bar.state === "front" ? undefined : labelSize}
                    >
                      {bar.state === "front"
                        ? `iter ${bar.iteration} · Accₜ ${formatPercent(bar.accuracy)} · ${condition}`
                        : `iter ${bar.iteration} · Accₜ ${formatPercent(bar.accuracy)}`}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
