"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  LabShell,
  RangeControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import { transitionBreakdown } from "./paper-model";
import styles from "./paper-scenes.module.css";

/** Wireframe §4.2 — 논문의 범위. Rendered in the narrative column, not the lab. */
export function PaperScopeBand() {
  return (
    <div className={styles.scopeBand} data-paper-scope-band>
      <div data-scope="included">
        <strong>포함</strong>
        <p>같은 모델 · 이전 답 재검토 · 외부 정보 없는 intrinsic self-correction</p>
      </div>
      <div data-scope="excluded">
        <strong>직접 포함하지 않음</strong>
        <p>검색 · 코드 실행 · 사람 피드백 · tool-using agent 전체</p>
      </div>
    </div>
  );
}

/**
 * Scene 2 primary visual — 두 상태 전이 흐름 (Sankey).
 *
 * Scene 1의 막대 언어를 그대로 잇는다: iter t 막대의 정답 구간은 네온
 * green으로 점등, 오답 구간은 소등. 네 개의 흐름 리본이 iter t+1 막대로
 * 내려가는데 리본의 폭이 곧 Eq. 6의 네 항이라 수식이 그대로 기하가 된다.
 * 훼손 리본은 내려가며 소등되고(green→gray gradient) 복구 리본은 내려가며
 * 점등된다(gray→green). 도착한 유지·복구 구간이 Accₜ₊₁ 브래킷으로 병합된
 * 뒤 전체가 페이드로 리셋되며, 이 순환은 재생 컨트롤 없이 화면에 보이는
 * 동안 위상 기반 연속 함수로 무한 반복된다.
 */

const CYCLE_SECONDS = 11;
const SPEED_RAMP_MS = 1600;

const BAR_X = 60;
const BAR_LENGTH = 560;
const BAR_HEIGHT = 34;
const TOP_Y = 64;
const BOTTOM_Y = 330;
const RIBBON_TOP = TOP_Y + BAR_HEIGHT;
const RIBBON_BOTTOM = BOTTOM_Y;
const MID_Y = (RIBBON_TOP + RIBBON_BOTTOM) / 2;
/** Design-system --radius-md (globals.css). */
const BAR_RADIUS = 6;

const NEON_GREEN = "#5ee97d";
const FLOW_GRAY = "#8a919c";

type StageId = "sources" | "flow" | "merge";

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function easeInCubic(x: number) {
  return x * x * x;
}

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** 리본 좌우 변은 세로 중점에 제어점을 둔 cubic — x는 smoothstep을 따른다. */
function ribbonPath(t0: number, t1: number, b0: number, b1: number) {
  return [
    `M ${t0} ${RIBBON_TOP}`,
    `C ${t0} ${MID_Y}, ${b0} ${MID_Y}, ${b0} ${RIBBON_BOTTOM}`,
    `L ${b1} ${RIBBON_BOTTOM}`,
    `C ${b1} ${MID_Y}, ${t1} ${MID_Y}, ${t1} ${RIBBON_TOP}`,
    "Z",
  ].join(" ");
}

function ribbonCenterPath(topCenter: number, bottomCenter: number) {
  return `M ${topCenter} ${RIBBON_TOP} C ${topCenter} ${MID_Y}, ${bottomCenter} ${MID_Y}, ${bottomCenter} ${RIBBON_BOTTOM}`;
}

/** ribbonPath와 같은 제어점을 쓰는 cubic 위의 점 — gate 라벨 배치용. */
function ribbonPoint(u: number, topX: number, bottomX: number) {
  const x = topX + (bottomX - topX) * (3 * u * u - 2 * u * u * u);
  const inv = 1 - u;
  const y =
    inv ** 3 * RIBBON_TOP +
    3 * inv * u * MID_Y +
    u ** 3 * RIBBON_BOTTOM;
  return { x, y };
}

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TwoStateTransitionLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const idPrefix = useSvgIdPrefix("transition-lab");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );

  const [accuracy, setAccuracy] = useState(0.7);
  const [confidenceLevel, setConfidenceLevel] = useState(0.9);
  const [critiqueScore, setCritiqueScore] = useState(0.4);
  const [visible, setVisible] = useState(false);
  const [anim, setAnim] = useState({ phase: 0, clock: 0 });

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

  // Continuous cycle while visible; speed ramps 0 → 1 with ease-in every
  // time the lab (re-)enters the viewport. The clock never wraps so the
  // ribbon dashes keep flowing even while the phase holds at merge.
  useEffect(() => {
    if (reducedMotion || !visible) return;
    let frame = 0;
    const startedAt = performance.now();
    let last = startedAt;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ramp = easeInCubic(Math.min(1, (now - startedAt) / SPEED_RAMP_MS));
      setAnim((current) => ({
        phase: (current.phase + (dt * ramp) / CYCLE_SECONDS) % 1,
        clock: current.clock + dt * ramp,
      }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, visible]);

  const breakdown = transitionBreakdown(accuracy, confidenceLevel, critiqueScore);

  // ---- cycle phase → continuous visual parameters -------------------------
  const phase = reducedMotion ? 0.7 : anim.phase;
  const flowProgress = reducedMotion
    ? 1
    : easeInOutCubic(clamp01((phase - 0.1) / 0.44));
  const mergeT = reducedMotion ? 1 : smoothstep(0.56, 0.66, phase);
  const resetFade = reducedMotion ? 0 : smoothstep(0.9, 0.995, phase);
  const litOpacity = 1 - resetFade;
  const frontY = RIBBON_TOP + flowProgress * (RIBBON_BOTTOM - RIBBON_TOP);
  const arrive = clamp01((frontY - (RIBBON_BOTTOM - 24)) / 24);
  const breath = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(anim.clock * 2.4);
  const stage: StageId =
    phase >= 0.9 || phase < 0.1 ? "sources" : phase < 0.56 ? "flow" : "merge";

  // ---- Eq. 6 항 → 리본 폭 --------------------------------------------------
  const preservedW = BAR_LENGTH * breakdown.preservedCorrect;
  const damagedW = BAR_LENGTH * breakdown.damagedCorrect;
  const recoveredW = BAR_LENGTH * breakdown.recoveredCorrect;
  const correctW = BAR_LENGTH * accuracy;
  const darkStart = BAR_X + correctW;
  const nextW = BAR_LENGTH * breakdown.nextAccuracy;

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

  // 위 막대 조각 → 아래 막대 조각. 아래 순서는 [유지][복구][훼손][잔여]라
  // 정답 두 구간이 인접해 Accₜ₊₁ 브래킷으로 자연스럽게 병합된다.
  const ribbons: Array<{
    id: string;
    gradient: string;
    topX0: number;
    topX1: number;
    botX0: number;
    botX1: number;
    gate: { text: string; u: number };
  }> = [
    {
      id: "preserved",
      gradient: `${idPrefix}-grad-keep`,
      topX0: BAR_X,
      topX1: BAR_X + preservedW,
      botX0: BAR_X,
      botX1: BAR_X + preservedW,
      gate: { text: `CLₜ ${formatPercent(confidenceLevel)}`, u: 0.5 },
    },
    {
      id: "damaged",
      gradient: `${idPrefix}-grad-lose`,
      topX0: BAR_X + preservedW,
      topX1: darkStart,
      botX0: BAR_X + preservedW + recoveredW,
      botX1: BAR_X + preservedW + recoveredW + damagedW,
      gate: { text: `1−CLₜ ${formatPercent(1 - confidenceLevel)}`, u: 0.28 },
    },
    {
      id: "recovered",
      gradient: `${idPrefix}-grad-gain`,
      topX0: darkStart,
      topX1: darkStart + recoveredW,
      botX0: BAR_X + preservedW,
      botX1: BAR_X + preservedW + recoveredW,
      gate: { text: `CSₜ ${formatPercent(critiqueScore)}`, u: 0.72 },
    },
    {
      id: "remaining",
      gradient: `${idPrefix}-grad-stay`,
      topX0: darkStart + recoveredW,
      topX1: BAR_X + BAR_LENGTH,
      botX0: BAR_X + preservedW + recoveredW + damagedW,
      botX1: BAR_X + BAR_LENGTH,
      gate: { text: `1−CSₜ ${formatPercent(1 - critiqueScore)}`, u: 0.5 },
    },
  ];

  // 아래 막대의 확정 구간: [유지][복구]는 점등, [훼손][잔여]는 소등.
  const bottomSegments = [
    { id: "preserved", lit: true, x0: BAR_X, x1: BAR_X + preservedW },
    {
      id: "recovered",
      lit: true,
      x0: BAR_X + preservedW,
      x1: BAR_X + preservedW + recoveredW,
    },
    {
      id: "damaged",
      lit: false,
      x0: BAR_X + preservedW + recoveredW,
      x1: BAR_X + preservedW + recoveredW + damagedW,
    },
    {
      id: "remaining",
      lit: false,
      x0: BAR_X + preservedW + recoveredW + damagedW,
      x1: BAR_X + BAR_LENGTH,
    },
  ];

  const annotations = [
    {
      id: "preserved",
      tone: "good",
      label: "유지 · Accₜ×CLₜ",
      value: breakdown.preservedCorrect,
    },
    {
      id: "recovered",
      tone: "good",
      label: "복구 · (1−Accₜ)×CSₜ",
      value: breakdown.recoveredCorrect,
    },
    {
      id: "damaged",
      tone: "danger",
      label: "훼손 · Accₜ×(1−CLₜ)",
      value: breakdown.damagedCorrect,
    },
    {
      id: "remaining",
      tone: "muted",
      label: "잔여 · (1−Accₜ)×(1−CSₜ)",
      value: breakdown.remainingIncorrect,
    },
  ];
  const annotationCenters = [130, 270, 410, 550];

  const bracketEnd = BAR_X + nextW;
  const bracketTextX = Math.min(530, Math.max(150, BAR_X + nextW / 2));

  return (
    <div ref={containerRef} data-transition-lab data-stage={stage}>
      <LabShell
        title="두 상태 전이 회계"
        subtitle="Accₜ₊₁ = Accₜ × CLₜ + (1 − Accₜ) × CSₜ"
        legend={[
          { label: "정답 · 점등", tone: "success" },
          { label: "오답 · 소등", tone: "neutral" },
          { label: "전이 흐름", tone: "neutral" },
        ]}
        stageLabel={
          reducedMotion
            ? "모션 감소 설정으로 흐름을 멈추고 병합 결과를 표시합니다 — 슬라이더는 계속 사용할 수 있습니다"
            : "화면에 보이는 동안 전이 흐름이 계속 반복됩니다 · 시작 속도 0에서 ease-in"
        }
        controls={
          <>
            <RangeControl
              id="transition-accuracy"
              label="Accₜ · 현재 정확도"
              value={accuracy}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(accuracy)}
              onChange={setAccuracy}
            />
            <RangeControl
              id="transition-confidence"
              label="CLₜ · 정답 보존율"
              value={confidenceLevel}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(confidenceLevel)}
              onChange={setConfidenceLevel}
            />
            <RangeControl
              id="transition-critique"
              label="CSₜ · 오답 복구율"
              value={critiqueScore}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(critiqueScore)}
              onChange={setCritiqueScore}
            />
          </>
        }
        status={[
          { label: "Accₜ", value: formatPercent(accuracy) },
          { label: "Accₜ₊₁", value: formatPercent(breakdown.nextAccuracy) },
          {
            label: "순변화",
            value: `${breakdown.netChange >= 0 ? "+" : "−"}${Math.abs(
              breakdown.netChange * 100,
            ).toFixed(2)}%p`,
          },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              iter t 막대의 정답 비율이 Accₜ이고, 네 흐름의 폭이 식의 네
              항입니다. 다음 정확도는 현재 정확도 곱하기 CLₜ 더하기 현재
              오답률 곱하기 CSₜ입니다.
            </p>
            <table className={styles.transitionTable}>
              <caption>2×2 전이 표 · 확률 회계</caption>
              <thead>
                <tr>
                  <th scope="col">현재 상태</th>
                  <th scope="col">다음 상태</th>
                  <th scope="col">항</th>
                  <th scope="col">probability</th>
                </tr>
              </thead>
              <tbody>
                <tr data-transition="preserved">
                  <td>정답</td>
                  <td>정답 · 유지</td>
                  <td>Accₜ × CLₜ</td>
                  <td>{formatPercent(breakdown.preservedCorrect)}</td>
                </tr>
                <tr data-transition="damaged">
                  <td>정답</td>
                  <td>오답 · 훼손</td>
                  <td>Accₜ × (1 − CLₜ)</td>
                  <td>{formatPercent(breakdown.damagedCorrect)}</td>
                </tr>
                <tr data-transition="recovered">
                  <td>오답</td>
                  <td>정답 · 복구</td>
                  <td>(1 − Accₜ) × CSₜ</td>
                  <td>{formatPercent(breakdown.recoveredCorrect)}</td>
                </tr>
                <tr data-transition="remaining">
                  <td>오답</td>
                  <td>오답 · 잔여</td>
                  <td>(1 − Accₜ) × (1 − CSₜ)</td>
                  <td>{formatPercent(breakdown.remainingIncorrect)}</td>
                </tr>
              </tbody>
            </table>
            <p data-next-accuracy-summary>
              Accₜ {formatPercent(accuracy)} 기준으로 다음 정확도는{" "}
              {formatPercent(breakdown.nextAccuracy)}입니다.
            </p>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="두 상태 전이 흐름 시각화 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox="0 0 680 470"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>두 상태 전이 흐름 시각화</title>
            <desc id={descId}>
              위 막대는 라운드 t의 정답과 오답 비율이고, 네 개의 흐름 리본이
              아래 라운드 t 더하기 1 막대로 내려간다. 리본의 폭이 유지, 훼손,
              복구, 잔여 네 항의 확률이며, 훼손 흐름은 내려가며 소등되고 복구
              흐름은 내려가며 점등된다. 도착한 유지와 복구 구간이 합쳐져 다음
              정확도 Accₜ₊₁이 되고, 이 순환은 화면에 보이는 동안 계속
              반복된다.
            </desc>

            <defs>
              {/* neo-nixietube-style multi-layer glow — 상태 막대 전용 */}
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
              <linearGradient
                id={`${idPrefix}-grad-keep`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={RIBBON_TOP}
                x2="0"
                y2={RIBBON_BOTTOM}
              >
                <stop offset="0" stopColor={NEON_GREEN} />
                <stop offset="1" stopColor={NEON_GREEN} />
              </linearGradient>
              <linearGradient
                id={`${idPrefix}-grad-lose`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={RIBBON_TOP}
                x2="0"
                y2={RIBBON_BOTTOM}
              >
                <stop offset="0.3" stopColor={NEON_GREEN} />
                <stop offset="0.7" stopColor={FLOW_GRAY} />
              </linearGradient>
              <linearGradient
                id={`${idPrefix}-grad-gain`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={RIBBON_TOP}
                x2="0"
                y2={RIBBON_BOTTOM}
              >
                <stop offset="0.3" stopColor={FLOW_GRAY} />
                <stop offset="0.7" stopColor={NEON_GREEN} />
              </linearGradient>
              <linearGradient
                id={`${idPrefix}-grad-stay`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={RIBBON_TOP}
                x2="0"
                y2={RIBBON_BOTTOM}
              >
                <stop offset="0" stopColor={FLOW_GRAY} />
                <stop offset="1" stopColor={FLOW_GRAY} />
              </linearGradient>
              {/* 흐름 front까지만 점등 — reveal은 세로 진행의 연속 함수 */}
              <clipPath id={`${idPrefix}-lit`}>
                <rect
                  x="0"
                  y={RIBBON_TOP}
                  width="680"
                  height={Math.max(0, frontY - RIBBON_TOP)}
                />
              </clipPath>
            </defs>

            {/* ---- iter t 막대 (항상 점등) ---- */}
            <text className={styles.flowBarLabel} x={BAR_X} y="46">
              iter t · 정답 Accₜ {formatPercent(accuracy)}
            </text>
            <text
              className={styles.flowBarSub}
              x={BAR_X + BAR_LENGTH}
              y="46"
              textAnchor="end"
            >
              오답 {formatPercent(1 - accuracy)}
            </text>
            {correctW < BAR_LENGTH - 0.5 ? (
              <rect
                className={styles.incorrectBar}
                x={darkStart}
                y={TOP_Y}
                width={BAR_LENGTH - correctW}
                height={BAR_HEIGHT}
                rx={BAR_RADIUS}
              />
            ) : null}
            {correctW > 0.5 ? (
              <g filter={`url(#${idPrefix}-glow)`}>
                <rect
                  x={BAR_X}
                  y={TOP_Y}
                  width={correctW}
                  height={BAR_HEIGHT}
                  rx={BAR_RADIUS}
                  fill={NEON_GREEN}
                  fillOpacity={0.08}
                  stroke={NEON_GREEN}
                  strokeWidth={2.4}
                />
              </g>
            ) : null}

            {/* ---- 흐름 리본: 실루엣(미도달 경로) + front까지 점등 ---- */}
            <g>
              {ribbons.map((ribbon) =>
                ribbon.topX1 - ribbon.topX0 > 0.5 ? (
                  <path
                    key={`${ribbon.id}-silhouette`}
                    className={styles.flowSilhouette}
                    d={ribbonPath(
                      ribbon.topX0,
                      ribbon.topX1,
                      ribbon.botX0,
                      ribbon.botX1,
                    )}
                  />
                ) : null,
              )}
            </g>
            <g clipPath={`url(#${idPrefix}-lit)`} opacity={litOpacity}>
              {ribbons.map((ribbon) =>
                ribbon.topX1 - ribbon.topX0 > 0.5 ? (
                  <g key={ribbon.id} data-flow-ribbon={ribbon.id}>
                    <path
                      d={ribbonPath(
                        ribbon.topX0,
                        ribbon.topX1,
                        ribbon.botX0,
                        ribbon.botX1,
                      )}
                      fill={`url(#${ribbon.gradient})`}
                      fillOpacity={0.13}
                      stroke={`url(#${ribbon.gradient})`}
                      strokeWidth={1.7}
                    />
                    <path
                      d={ribbonCenterPath(
                        (ribbon.topX0 + ribbon.topX1) / 2,
                        (ribbon.botX0 + ribbon.botX1) / 2,
                      )}
                      fill="none"
                      stroke={`url(#${ribbon.gradient})`}
                      strokeWidth={2.2}
                      strokeDasharray="3 10"
                      strokeDashoffset={-(anim.clock * 30)}
                      opacity={0.8}
                    />
                  </g>
                ) : null,
              )}
            </g>

            {/* ---- gate 라벨: 흐름 front가 지나가면 점등 ---- */}
            {ribbons.map((ribbon) => {
              const width = ribbon.topX1 - ribbon.topX0;
              if (width < 16) return null;
              const point = ribbonPoint(
                ribbon.gate.u,
                (ribbon.topX0 + ribbon.topX1) / 2,
                (ribbon.botX0 + ribbon.botX1) / 2,
              );
              const lit = clamp01((frontY - point.y) / 30);
              return (
                <g
                  key={`${ribbon.id}-gate`}
                  className={styles.flowGate}
                  opacity={(0.3 + 0.7 * lit * litOpacity)}
                >
                  <text x={point.x} y={point.y + 4} textAnchor="middle">
                    {ribbon.gate.text}
                  </text>
                </g>
              );
            })}

            {/* ---- iter t+1 막대: 실루엣 → 도착하면 구간별 점등/소등 ---- */}
            <text
              className={styles.flowBarSub}
              x={BAR_X - 8}
              y={BOTTOM_Y + BAR_HEIGHT / 2 + 4}
              textAnchor="end"
            >
              iter t+1
            </text>
            <rect
              className={styles.silhouetteBar}
              x={BAR_X}
              y={BOTTOM_Y}
              width={BAR_LENGTH}
              height={BAR_HEIGHT}
              rx={BAR_RADIUS}
            />
            {bottomSegments.map((segment) =>
              segment.x1 - segment.x0 > 0.5 ? (
                segment.lit ? (
                  <g
                    key={segment.id}
                    filter={`url(#${idPrefix}-glow)`}
                    opacity={arrive * litOpacity}
                  >
                    <rect
                      x={segment.x0}
                      y={BOTTOM_Y}
                      width={segment.x1 - segment.x0}
                      height={BAR_HEIGHT}
                      rx={BAR_RADIUS}
                      fill={NEON_GREEN}
                      fillOpacity={0.08}
                      stroke={NEON_GREEN}
                      strokeWidth={2.4}
                    />
                  </g>
                ) : (
                  <rect
                    key={segment.id}
                    className={styles.incorrectBar}
                    x={segment.x0}
                    y={BOTTOM_Y}
                    width={segment.x1 - segment.x0}
                    height={BAR_HEIGHT}
                    rx={BAR_RADIUS}
                    opacity={arrive * litOpacity}
                  />
                )
              ) : null,
            )}

            {/* ---- Accₜ₊₁ 병합 브래킷 ---- */}
            {nextW > 0.5 ? (
              <>
                <g
                  filter={`url(#${idPrefix}-glow)`}
                  opacity={mergeT * litOpacity * breath}
                >
                  <path
                    d={`M ${BAR_X} 372 v 7 H ${bracketEnd} v -7`}
                    fill="none"
                    stroke={NEON_GREEN}
                    strokeWidth={2}
                  />
                </g>
                <text
                  className={styles.flowBracketLabel}
                  x={bracketTextX}
                  y="398"
                  textAnchor="middle"
                  opacity={mergeT * litOpacity}
                >
                  Accₜ₊₁ = 유지 + 복구 = {formatPercent(breakdown.nextAccuracy)}
                </text>
              </>
            ) : null}

            {/* ---- 네 항 annotation (고정 슬롯이라 라벨이 밀리지 않는다) ---- */}
            {annotations.map((annotation, index) => (
              <g
                key={annotation.id}
                className={styles.flowAnnotation}
                data-tone={annotation.tone}
              >
                <text
                  className={styles.flowAnnotationLabel}
                  x={annotationCenters[index]}
                  y="428"
                  textAnchor="middle"
                >
                  {annotation.label}
                </text>
                <text
                  className={styles.flowAnnotationValue}
                  x={annotationCenters[index]}
                  y="448"
                  textAnchor="middle"
                >
                  {formatPercent(annotation.value)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
