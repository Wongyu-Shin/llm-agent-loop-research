"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  LabShell,
  SegmentedControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import {
  CANONICAL_AUTORESEARCH_CAMPAIGN,
  CRITERION_TRANSITION_EXAMPLE,
  determineStopReason,
  foldCampaign,
  formatMemoryValue,
  formatMetricValue,
  GATE_OFF_ADOPTED_VALUES,
  GATE_ORDER,
  GATE_REPLAY_LABELS,
  gateReplaySummary,
  INCUMBENT_STAIRCASE_VALUES,
  OFFICIAL_EXAMPLE_FACTS,
  PLATEAU_LIMIT,
  STRUCTURAL_BREAKTHROUGHS,
  TELEMETRY_SAMPLE,
  type GateReplayMode,
  type StopInputs,
} from "./loop-model";
import { ProvenanceBadge } from "./presentation-shell";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./loop-scenes.module.css";

/**
 * Scene 7 — gate replay (reports/scene7-8-autoresearch-wireframe.md §3).
 *
 * Ralph의 네 한계를 autoresearch의 구조물이 하나씩 막는 것을 같은 캠페인
 * 재생으로 보인다. 좌측 ring은 Scene 6과 같은 progress 클록을 공유하되
 * 귀환 경로의 검문소가 상시 점등된 acceptance gate다. 우측 궤적은
 * val_bpb 축 위의 incumbent 계단(ratchet)이고, gate 토글을 끄면 같은 네
 * 시도가 걸러지지 않고 채택되는 Ralph counterfactual이 재생된다.
 */

/** 와이어프레임 §3.2 — 공식 1차 출처 사실 strip (구 Scene 6 §8.2 이관). */
export function AutoresearchFactsStrip() {
  return (
    <div className={styles.officialStrip} data-autoresearch-facts-strip>
      <div className={styles.officialStripHeading}>
        <ProvenanceBadge kind="official-autoresearch-example" />
      </div>
      <dl>
        {OFFICIAL_EXAMPLE_FACTS.map((fact) => (
          <div key={fact.id} data-fact={fact.id}>
            <dt>{fact.label}</dt>
            <dd>
              {fact.value}
              {fact.caveat ? <small>{fact.caveat}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 와이어프레임 §3.3 — Ralph 한계 ↔ autoresearch 구조물 대응(해석). */
export function StructuralBreakthroughs() {
  return (
    <div className={styles.officialStrip} data-structural-breakthroughs>
      <div className={styles.officialStripHeading}>
        <ProvenanceBadge kind="engineering-transfer" />
      </div>
      <dl>
        {STRUCTURAL_BREAKTHROUGHS.map((row) => (
          <div key={row.id} data-row={row.id}>
            <dt>{row.ralphLimit}</dt>
            <dd>{row.structure}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const STEPS: PlaybackStep[] = [
  { id: "ring", durationMs: 8000, label: "contract·frozen harness 고정 — loop 한 바퀴" },
  { id: "keep", durationMs: 10000, label: "KEEP — 측정 개선, incumbent 전진" },
  { id: "discard", durationMs: 10000, label: "DISCARD — 훼손이 gate에 막힘" },
  { id: "crash", durationMs: 8000, label: "CRASH — 측정 없음, incumbent 불변" },
  { id: "counterfactual", durationMs: 12000, label: "gate 없음(Ralph): 같은 시도가 채택돼 궤적 진동" },
  { id: "accounting", durationMs: 8000, label: "전이 회계 — candidate CLₜ 낮아도 system 보호" },
  { id: "stop", durationMs: 10000, label: "COMPLETE 선언 대신 구조화된 stop reason" },
  { id: "hold", durationMs: 4000, label: "incumbent 계단과 best-so-far 반환" },
] as const;

const VIEW_W = 680;
const VIEW_H = 470;

const RING_CX = 116;
const RING_CY = 168;
const RING_R = 62;

const CHART_X0 = 268;
const CHART_X1 = 612;
const CHART_Y0 = 64;
const CHART_Y1 = 246;

/** val_bpb 축 범위 — fixture 값(0.9932~1.005)을 여유 있게 감싼다. */
const VAL_MAX = 1.008;
const VAL_MIN = 0.99;

/** crash(측정 없음) 마커를 놓는 상단 밴드의 y. */
const CRASH_Y = CHART_Y0 + 12;

const LAST_ITERATION = CANONICAL_AUTORESEARCH_CAMPAIGN.length - 1;

const CAMPAIGN_STATE = foldCampaign(CANONICAL_AUTORESEARCH_CAMPAIGN);

/** 자동 재생에서 keep→discard→crash 세 단계에 맞춘 캠페인 draw 시간. */
const DRAW_MS_AUTO = 24000;
/** 사용자가 gate를 직접 토글했을 때의 빠른 재생. */
const DRAW_MS_USER = 3600;
/** 화면에 보이는 동안 반복 재생되는 사이클의 draw 시간. */
const DRAW_MS_LOOP = 7200;
/** 완주한 궤적을 보여 주는 hold 시간 — 지나면 처음부터 다시 그린다. */
const HOLD_MS = 2600;

function chartX(iteration: number) {
  return CHART_X0 + (iteration / LAST_ITERATION) * (CHART_X1 - CHART_X0);
}

function chartY(value: number) {
  return (
    CHART_Y0 + ((VAL_MAX - value) / (VAL_MAX - VAL_MIN)) * (CHART_Y1 - CHART_Y0)
  );
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ChartPoint = { x: number; y: number };

function toPath(points: readonly ChartPoint[]) {
  if (points.length < 2) return "";
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
}

/**
 * incumbent 계단 — 수평 구간은 progress를 따라 자라고, KEEP 바퀴를 지나는
 * 순간 수직 하강이 함께 나타난다.
 */
function staircasePath(progress: number) {
  if (progress <= 0) return "";
  const points: ChartPoint[] = [
    { x: chartX(0), y: chartY(INCUMBENT_STAIRCASE_VALUES[0]) },
  ];
  for (let iteration = 1; iteration <= LAST_ITERATION; iteration += 1) {
    const previous = INCUMBENT_STAIRCASE_VALUES[iteration - 1];
    const current = INCUMBENT_STAIRCASE_VALUES[iteration];
    if (progress >= iteration) {
      points.push({ x: chartX(iteration), y: chartY(previous) });
      points.push({ x: chartX(iteration), y: chartY(current) });
    } else {
      const fraction = progress - (iteration - 1);
      if (fraction > 0) {
        points.push({
          x: chartX(iteration - 1 + Math.min(1, fraction)),
          y: chartY(previous),
        });
      }
      return toPath(points);
    }
  }
  return toPath(points);
}

/**
 * gate 없음(Ralph counterfactual) 채택 궤적 — 측정값이 있는 구간은 그대로
 * 잇고, crash 바퀴는 상단의 측정 없음 밴드로 점선 하강한다(별도 세그먼트).
 */
function adoptedPath(progress: number) {
  const points: ChartPoint[] = [];
  const limit = Math.min(progress, 2);
  if (limit <= 0) return "";
  for (let iteration = 0; iteration <= Math.floor(limit); iteration += 1) {
    const value = GATE_OFF_ADOPTED_VALUES[iteration];
    if (value === null) break;
    points.push({ x: chartX(iteration), y: chartY(value) });
  }
  const whole = Math.floor(limit);
  const fraction = limit - whole;
  if (whole < 2 && fraction > 0) {
    const from = GATE_OFF_ADOPTED_VALUES[whole];
    const to = GATE_OFF_ADOPTED_VALUES[whole + 1];
    if (from !== null && to !== null) {
      points.push({
        x: chartX(whole + fraction),
        y: chartY(from + (to - from) * fraction),
      });
    }
  }
  return toPath(points);
}

/** counterfactual의 crash 채택 — 마지막 측정에서 측정 없음 밴드로 가는 점선. */
function adoptedCrashPath(progress: number) {
  const start = LAST_ITERATION - 1;
  if (progress <= start) return null;
  const t = Math.min(1, progress - start);
  const fromValue = GATE_OFF_ADOPTED_VALUES[start];
  if (fromValue === null) return null;
  const x0 = chartX(start);
  const y0 = chartY(fromValue);
  const x1 = chartX(start + t);
  const y1 = y0 + (CRASH_Y - y0) * t;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function ringPoint(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: RING_CX + RING_R * Math.cos(rad),
    y: RING_CY + RING_R * Math.sin(rad),
    rotate: angleDeg + 90,
  };
}

const RING_CHEVRON_ANGLES = [-30, 90, 210] as const;
/** acceptance gate 검문소 — ledger에서 다음 제안으로 돌아가는 귀환 경로. */
const STATION_ANGLE = 180;

const DEFAULT_STOP_INPUTS: StopInputs = {
  manualInterrupt: false,
  safetyViolation: false,
  harnessValid: true,
  successPredicateMet: false,
  humanGateRequired: false,
  cycleDetected: false,
  plateauIterations: 0,
  campaignBudgetRemainingHours: 4,
  testableHypothesisAvailable: true,
};

const STOP_TOGGLES: Array<{
  key: keyof Pick<
    StopInputs,
    | "manualInterrupt"
    | "safetyViolation"
    | "harnessValid"
    | "successPredicateMet"
    | "humanGateRequired"
    | "cycleDetected"
    | "testableHypothesisAvailable"
  >;
  label: string;
}> = [
  { key: "manualInterrupt", label: "manual interrupt" },
  { key: "safetyViolation", label: "safety violation" },
  { key: "harnessValid", label: "harness valid" },
  { key: "successPredicateMet", label: "success predicate" },
  { key: "humanGateRequired", label: "human gate" },
  { key: "cycleDetected", label: "cycle detected" },
  { key: "testableHypothesisAvailable", label: "hypothesis 남음" },
];

export function GateReplayLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction, reachedStep } =
    useScenePlayback(STEPS, containerRef);
  const idPrefix = useSvgIdPrefix("gate-replay");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );

  const [userMode, setUserMode] = useState<GateReplayMode | null>(null);
  const [stopInputs, setStopInputs] = useState<StopInputs>(DEFAULT_STOP_INPUTS);

  /** ring 회전과 궤적 드로잉이 공유하는 클록 (0..3 바퀴). */
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  /** 진행 계획 — 상시 rAF 루프가 읽어서 progress를 갱신한다. */
  const drawPlanRef = useRef<
    | { kind: "draw"; start: number | null; duration: number }
    | { kind: "hold"; until: number }
    | null
  >(null);
  const interactedRef = useRef(false);

  useEffect(() => {
    interactedRef.current = state.hasUserInteracted;
  }, [state.hasUserInteracted]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setVisible(
            entry.isIntersecting &&
              (entry.intersectionRatio >= 0.2 ||
                entry.intersectionRect.height / window.innerHeight >= 0.35),
          );
        }
      },
      { threshold: [0, 0.2, 0.5] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Scene 6 문법 — 화면에 보이는 동안 도는 상시 rAF 루프가 draw plan을
  // 소비한다. setState는 rAF 콜백 안에서만 일어난다.
  useEffect(() => {
    if (reducedMotion || !visible) return;
    const pending = drawPlanRef.current;
    if (pending?.kind === "draw") {
      pending.start = null;
    }
    let frame = 0;
    const tick = (now: number) => {
      let plan = drawPlanRef.current;
      if (!plan) {
        plan = { kind: "draw", start: null, duration: DRAW_MS_LOOP };
        drawPlanRef.current = plan;
      }
      if (plan.kind === "hold") {
        if (now >= plan.until) {
          drawPlanRef.current = {
            kind: "draw",
            start: null,
            duration: DRAW_MS_LOOP,
          };
        }
      } else {
        if (plan.start === null) plan.start = now;
        const t = Math.min(1, (now - plan.start) / plan.duration);
        if (t >= 1) {
          drawPlanRef.current = { kind: "hold", until: now + HOLD_MS };
        }
        setProgress(smoothstep(t) * LAST_ITERATION);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, visible]);

  const stage =
    state.status === "idle"
      ? "ring"
      : state.status === "completed"
        ? "hold"
        : (STEPS[state.step]?.id ?? "ring");

  // keep 진입 시 캠페인을 내레이션에 맞춰 그리고, counterfactual과
  // accounting(모드 복귀) 진입 시 캠페인을 처음부터 다시 그린다.
  const prevStageRef = useRef(stage);
  useEffect(() => {
    if (prevStageRef.current === stage) return;
    prevStageRef.current = stage;
    if (reducedMotion) return;
    if (stage === "keep") {
      drawPlanRef.current = {
        kind: "draw",
        start: null,
        duration: interactedRef.current ? DRAW_MS_USER : DRAW_MS_AUTO,
      };
    } else if (stage === "counterfactual" || stage === "accounting") {
      drawPlanRef.current = {
        kind: "draw",
        start: null,
        duration: interactedRef.current ? DRAW_MS_USER : 10000,
      };
    }
  }, [stage, reducedMotion]);

  const autoMode: GateReplayMode =
    reachedStep("counterfactual") && !reachedStep("accounting") ? "off" : "on";
  const mode = userMode ?? autoMode;

  const stopReason = determineStopReason(stopInputs);

  const selectMode = (value: GateReplayMode) => {
    markUserInteraction();
    setUserMode(value);
    if (!reducedMotion) {
      setProgress(0);
      drawPlanRef.current = {
        kind: "draw",
        start: null,
        duration: DRAW_MS_USER,
      };
    }
  };

  const toggleStopInput = (key: (typeof STOP_TOGGLES)[number]["key"]) => {
    markUserInteraction();
    setStopInputs((current) => ({ ...current, [key]: !current[key] }));
  };

  const shownProgress = reducedMotion ? LAST_ITERATION : progress;
  const lap = Math.min(LAST_ITERATION, Math.floor(shownProgress));
  const arrivingIteration = Math.min(LAST_ITERATION, lap + 1);
  const drawing = shownProgress > 0 && shownProgress < LAST_ITERATION;
  const cursorAngle = -90 + shownProgress * 360;
  const cursorPoint = ringPoint(cursorAngle);
  const arrivingRecord = CANONICAL_AUTORESEARCH_CAMPAIGN[arrivingIteration];
  const blockedArrival = arrivingRecord.verdict !== "KEEP";
  /** gate 없음에서는 훼손이 채택되는 바퀴에 커서가 소등(red)된다. */
  const failing = mode === "off" && drawing && blockedArrival;
  /** gate에서는 같은 바퀴에 검문소가 차단을 점등한다. */
  const stationBlocking = mode === "on" && drawing && blockedArrival;
  const stationPoint = ringPoint(STATION_ANGLE);

  const example = CRITERION_TRANSITION_EXAMPLE;
  const bestSoFar = CAMPAIGN_STATE.bestSoFar;
  const stairPath = staircasePath(shownProgress);
  const offPath = adoptedPath(shownProgress);
  const offCrashPath = adoptedCrashPath(shownProgress);

  return (
    <div
      ref={containerRef}
      data-gate-replay
      data-stage={stage}
      data-mode={mode}
      data-failing={failing ? "true" : "false"}
    >
      <LabShell
        title="Gate replay — Ralph의 한계를 구조로 막는 loop"
        subtitle="같은 네 시도를 gate가 거르면 incumbent는 계단으로만 내려간다 · gate를 끄면 Ralph 궤적이 재현된다"
        legend={[
          { label: "KEEP · incumbent 계단", tone: "success" },
          { label: "DISCARD·CRASH · 소등", tone: "neutral" },
          { label: "gate 차단", tone: "attention" },
          { label: "gate 없음 · 채택 궤적", tone: "danger" },
        ]}
        stageLabel={`gate: ${GATE_REPLAY_LABELS[mode]} · iteration ${lap}/${LAST_ITERATION}`}
        controls={
          <>
            <PlaybackBar
              state={state}
              controls={controls}
              stepCount={STEPS.length}
              stepLabel={STEPS[Math.min(state.step, STEPS.length - 1)].label}
              markUserInteraction={markUserInteraction}
            />
            <SegmentedControl
              label="gate"
              value={mode}
              options={[
                { value: "on", label: GATE_REPLAY_LABELS.on },
                { value: "off", label: GATE_REPLAY_LABELS.off },
              ]}
              onChange={selectMode}
            />
            <div className={styles.stopControls}>
              <div
                className={styles.stopToggleRow}
                role="group"
                aria-label="stop 조건"
              >
                {STOP_TOGGLES.map((toggle) => (
                  <button
                    key={toggle.key}
                    type="button"
                    aria-pressed={Boolean(stopInputs[toggle.key])}
                    onClick={() => toggleStopInput(toggle.key)}
                  >
                    {toggle.label}
                  </button>
                ))}
              </div>
              <label className={styles.stopSlider}>
                plateau {stopInputs.plateauIterations} / {PLATEAU_LIMIT}
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={stopInputs.plateauIterations}
                  aria-valuetext={`plateau ${stopInputs.plateauIterations} iterations`}
                  onChange={(event) => {
                    markUserInteraction();
                    setStopInputs((current) => ({
                      ...current,
                      plateauIterations: Number(event.target.value),
                    }));
                  }}
                />
              </label>
              <label className={styles.stopSlider}>
                budget {stopInputs.campaignBudgetRemainingHours}h
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={1}
                  value={stopInputs.campaignBudgetRemainingHours}
                  aria-valuetext={`campaign budget ${stopInputs.campaignBudgetRemainingHours} hours`}
                  onChange={(event) => {
                    markUserInteraction();
                    setStopInputs((current) => ({
                      ...current,
                      campaignBudgetRemainingHours: Number(event.target.value),
                    }));
                  }}
                />
              </label>
            </div>
          </>
        }
        status={[
          { label: "incumbent", value: CAMPAIGN_STATE.incumbent ?? "없음" },
          {
            label: "best-so-far",
            value: bestSoFar
              ? `${bestSoFar.revision} · ${bestSoFar.metricValue.toFixed(4)}`
              : "없음",
          },
          { label: "gate", value: gateReplaySummary(mode) },
          { label: "stop reason", value: stopReason ?? "계속 실행" },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              공식 autoresearch 예시의 네 시도(baseline·keep·discard·crash)를
              gate가 어떻게 거르는지 iteration별로 제공합니다. gate를 끄면 같은
              시도가 걸러지지 않고 그대로 채택됐을 때의 궤적(synthetic
              counterfactual)을 함께 보여 줍니다.
            </p>
            <table className={styles.transferTable} data-ledger-table>
              <caption>canonical replay ledger · crash sentinel은 측정 없음으로 표시</caption>
              <thead>
                <tr>
                  <th scope="col">iteration</th>
                  <th scope="col">challenger</th>
                  <th scope="col">val_bpb ↓</th>
                  <th scope="col">peak memory</th>
                  <th scope="col">verdict</th>
                  <th scope="col">incumbent after</th>
                </tr>
              </thead>
              <tbody>
                {CANONICAL_AUTORESEARCH_CAMPAIGN.map((record) => (
                  <tr key={record.iteration} data-verdict={record.verdict}>
                    <td>{record.iteration}</td>
                    <td>{record.challenger}</td>
                    <td>{formatMetricValue(record.metrics[0]?.value ?? null)}</td>
                    <td>{formatMemoryValue(record.metrics[1]?.value ?? null)}</td>
                    <td>{record.verdict}</td>
                    <td>{record.incumbentAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className={styles.rawDrawer} data-raw-drawer>
              <summary>raw results.tsv drawer (원형 sentinel 보존)</summary>
              <pre>
                {CANONICAL_AUTORESEARCH_CAMPAIGN.map(
                  (record) => record.rawLedgerRow,
                ).join("\n")}
              </pre>
            </details>
            <p data-gate-order>
              gate 순서:{" "}
              {GATE_ORDER.map(
                (step) =>
                  `${step.label}${step.provenance === "engineering-transfer" ? " [ENGINEERING TRANSFER]" : ""}`,
              ).join(" → ")}
            </p>
            <table className={styles.transferTable} data-gate-off-table>
              <caption>
                gate 없음(Ralph counterfactual) — 같은 시도가 걸러지지 않고
                채택됐을 때의 iteration별 val_bpb (synthetic)
              </caption>
              <tbody>
                {GATE_OFF_ADOPTED_VALUES.map((value, iteration) => (
                  <tr key={iteration}>
                    <th scope="row">iteration {iteration}</th>
                    <td>
                      {value === null
                        ? "측정 없음 · crash 상태 채택"
                        : formatMetricValue(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className={styles.transferTable} data-transition-compare>
              <caption>
                candidate 전이 (criterion {example.totalCriteria}개) vs
                system-after-gate
              </caption>
              <tbody>
                <tr>
                  <th scope="row">incumbent 통과</th>
                  <td>{example.incumbentPass}</td>
                </tr>
                <tr>
                  <th scope="row">candidate 보존 / 훼손</th>
                  <td>
                    {example.preserved} / {example.damaged} (candidate CLₜ{" "}
                    {(example.candidateConfidenceLevel * 100).toFixed(1)}%)
                  </td>
                </tr>
                <tr>
                  <th scope="row">candidate 복구 / 잔여</th>
                  <td>
                    {example.recovered} / {example.remaining} (candidate CSₜ{" "}
                    {(example.candidateCritiqueScore * 100).toFixed(1)}%)
                  </td>
                </tr>
                <tr>
                  <th scope="row">verdict</th>
                  <td>{example.verdict}</td>
                </tr>
                <tr>
                  <th scope="row">system-after-gate 통과</th>
                  <td>{example.systemPassAfterGate} · incumbent 보호됨</td>
                </tr>
              </tbody>
            </table>
            <p data-scalar-note>
              전제: 이 회계에는 기준별 통과·실패 판정이 필요합니다. val_bpb
              같은 연속형 scalar 하나로는 CLₜ/CSₜ를 셀 수 없으므로 metric
              delta, 분산, guard, holdout을 직접 비교합니다.
            </p>
            <p data-stop-summary>
              현재 stop reason: {stopReason ?? "없음 (계속 실행)"} · 종료 시
              마지막 candidate가 아니라 검증된 best-so-far{" "}
              {bestSoFar?.revision ?? "없음"}과 남은 불확실성, stop reason을
              함께 반환합니다.
            </p>
            <pre className={styles.pseudocode} aria-label="최소 telemetry 예시">
              {JSON.stringify(TELEMETRY_SAMPLE, null, 2)}
            </pre>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="gate replay 구조와 궤적 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>
              acceptance gate가 있는 experiment loop와 incumbent 계단 궤적
            </title>
            <desc id={descId}>
              왼쪽 ring은 가설이 격리된 challenger로 실행되고 frozen harness의
              측정을 거쳐 귀환 경로의 acceptance gate를 지나는 순환이다.
              커서가 한 바퀴 돌 때마다 오른쪽 val_bpb 궤적이 iteration 한 칸
              자라며, keep만 통과한 incumbent는 계단으로만 내려가고 discard와
              crash는 소등된 시도로 남는다. gate를 끄면 같은 네 시도가
              걸러지지 않고 채택되어 궤적이 진동하는 Ralph counterfactual이
              재생된다. 아래 밴드는 열두 기준 전이 회계와 구조화된 stop
              reason을 보여 준다.
            </desc>

            <defs>
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

            {/* Loop ring — 가설 → challenger → harness 측정 → gate */}
            <g data-ring>
              <circle
                className={styles.ralphRingBase}
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
              />
              <circle
                className={styles.ralphRingDash}
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                filter={`url(#${idPrefix}-glow)`}
              />
              {RING_CHEVRON_ANGLES.map((angle) => {
                const point = ringPoint(angle);
                return (
                  <path
                    key={angle}
                    className={styles.ralphChevron}
                    d="M -5 -3.5 L 5 0 L -5 3.5 Z"
                    transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) rotate(${point.rotate})`}
                  />
                );
              })}
              {drawing && !reducedMotion ? (
                <circle
                  className={styles.ralphCursor}
                  data-failing={failing ? "true" : "false"}
                  cx={cursorPoint.x}
                  cy={cursorPoint.y}
                  r={5}
                  filter={`url(#${idPrefix}-glow)`}
                />
              ) : null}

              {/* acceptance gate 검문소 — Scene 6의 소등 점선이 여기서는 상시 점등 */}
              <g
                className={styles.gateStation}
                data-station-mode={mode}
                data-blocking={stationBlocking ? "true" : "false"}
              >
                <rect
                  x={stationPoint.x - 23}
                  y={stationPoint.y - 12}
                  width={46}
                  height={24}
                  rx={6}
                />
                <text
                  x={stationPoint.x}
                  y={stationPoint.y + 4}
                  textAnchor="middle"
                >
                  GATE
                </text>
                <text
                  className={styles.ralphStationSub}
                  x={stationPoint.x}
                  y={stationPoint.y - 20}
                  textAnchor="middle"
                >
                  {mode === "on" ? "acceptance gate" : "없음"}
                </text>
              </g>

              <text
                className={styles.ralphStationLabel}
                x={RING_CX}
                y={RING_CY - RING_R - 12}
                textAnchor="middle"
              >
                hypothesis
              </text>
              <text
                className={styles.ralphStationLabel}
                x={RING_CX + RING_R + 10}
                y={RING_CY + 4}
              >
                challenger
              </text>
              <text
                className={styles.ralphStationLabel}
                x={RING_CX}
                y={RING_CY + RING_R + 18}
                textAnchor="middle"
              >
                frozen harness 측정
              </text>

              <text
                className={styles.ralphLapLabel}
                x={RING_CX}
                y={RING_CY - 10}
                textAnchor="middle"
              >
                iteration
              </text>
              <text
                className={styles.ralphLapCount}
                x={RING_CX}
                y={RING_CY + 14}
                textAnchor="middle"
              >
                {lap} / {LAST_ITERATION}
              </text>

              <text
                className={styles.ralphStationSub}
                x={RING_CX}
                y={RING_CY + RING_R + 38}
                textAnchor="middle"
              >
                keep만 통과 · 실패는 ledger로
              </text>
            </g>

            {/* 궤적 무대 — val_bpb, 낮을수록 좋음 */}
            <g data-chart>
              <text
                className={styles.ralphAxisLabel}
                x={CHART_X0}
                y={CHART_Y0 - 20}
              >
                val_bpb · 낮을수록 좋음
              </text>
              <line
                className={styles.ralphAxis}
                x1={CHART_X0}
                y1={CHART_Y1}
                x2={CHART_X1}
                y2={CHART_Y1}
              />
              <line
                className={styles.ralphAxis}
                x1={CHART_X0}
                y1={CHART_Y0}
                x2={CHART_X0}
                y2={CHART_Y1}
              />
              {[1.005, 0.998, 0.993].map((tick) => (
                <text
                  key={tick}
                  className={styles.ralphAxisLabel}
                  x={CHART_X0 - 8}
                  y={chartY(tick) + 4}
                  textAnchor="end"
                >
                  {tick.toFixed(3)}
                </text>
              ))}
              {CANONICAL_AUTORESEARCH_CAMPAIGN.map((record) => (
                <text
                  key={record.iteration}
                  className={styles.ralphAxisLabel}
                  x={chartX(record.iteration)}
                  y={CHART_Y1 + 18}
                  textAnchor="middle"
                >
                  {record.iteration}
                </text>
              ))}
              <text
                className={styles.ralphAxisLabel}
                x={(CHART_X0 + CHART_X1) / 2}
                y={CHART_Y1 + 34}
                textAnchor="middle"
              >
                iteration
              </text>

              <g filter={`url(#${idPrefix}-glow)`}>
                {/* gate ON — incumbent 계단 (ratchet) */}
                <g
                  className={styles.ralphModeGroup}
                  data-trajectory="on"
                  data-active={mode === "on" ? "true" : "false"}
                >
                  {stairPath ? (
                    <path className={styles.incumbentStep} d={stairPath} />
                  ) : null}
                  {CANONICAL_AUTORESEARCH_CAMPAIGN.map((record) => {
                    const value = record.metrics[0]?.value ?? null;
                    const x = chartX(record.iteration);
                    const y = value === null ? CRASH_Y : chartY(value);
                    return (
                      <g
                        key={record.iteration}
                        className={styles.attemptDot}
                        data-verdict={record.verdict}
                        data-visible={
                          shownProgress >= record.iteration ? "true" : "false"
                        }
                      >
                        <circle cx={x} cy={y} r={record.verdict === "KEEP" ? 4.6 : 5.4} />
                        {record.verdict === "CRASH" ? (
                          <text
                            className={styles.crashLabel}
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                          >
                            측정 없음
                          </text>
                        ) : null}
                        {record.verdict !== "KEEP" ? (
                          <text
                            className={styles.blockedTag}
                            x={x}
                            y={y + 20}
                            textAnchor="middle"
                          >
                            차단
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>

                {/* gate OFF — Ralph counterfactual 채택 궤적 */}
                <g
                  className={styles.ralphModeGroup}
                  data-trajectory="off"
                  data-active={mode === "off" ? "true" : "false"}
                >
                  {offPath ? (
                    <path className={styles.adoptedPath} d={offPath} />
                  ) : null}
                  {offCrashPath ? (
                    <path className={styles.adoptedCrashPath} d={offCrashPath} />
                  ) : null}
                  {GATE_OFF_ADOPTED_VALUES.map((value, iteration) => {
                    const record = CANONICAL_AUTORESEARCH_CAMPAIGN[iteration];
                    const x = chartX(iteration);
                    const y = value === null ? CRASH_Y : chartY(value);
                    return (
                      <g
                        key={iteration}
                        className={styles.attemptDot}
                        data-verdict={record.verdict}
                        data-adopted="true"
                        data-visible={
                          shownProgress >= iteration ? "true" : "false"
                        }
                      >
                        <circle cx={x} cy={y} r={4.6} />
                        {record.verdict !== "KEEP" ? (
                          <text
                            className={styles.adoptedTag}
                            x={x}
                            y={y - 10}
                            textAnchor="middle"
                          >
                            {record.verdict === "CRASH"
                              ? "crash 채택"
                              : "훼손 채택"}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              </g>
            </g>

            {/* 하단 밴드 — 전이 회계 · bounded stopping */}
            <g
              className={styles.gateBandPanel}
              data-band="accounting"
              data-active={reachedStep("accounting") ? "true" : "false"}
            >
              <rect x={40} y={296} width={344} height={158} rx={12} />
              <text className={styles.bandTitle} x={56} y={322}>
                전이 회계 · 기준 {example.totalCriteria}개 (synthetic)
              </text>
              {[
                { label: "보존", value: example.preserved, tone: "good", x: 56 },
                { label: "훼손", value: example.damaged, tone: "danger", x: 138 },
                { label: "복구", value: example.recovered, tone: "good", x: 220 },
                { label: "잔여", value: example.remaining, tone: "muted", x: 302 },
              ].map((cell) => (
                <g
                  key={cell.label}
                  className={styles.compareCell}
                  data-tone={cell.tone}
                >
                  <rect x={cell.x} y={334} width={70} height={48} rx={8} />
                  <text className={styles.compareLabel} x={cell.x + 10} y={354}>
                    {cell.label}
                  </text>
                  <text className={styles.compareValue} x={cell.x + 10} y={376}>
                    {cell.value}
                  </text>
                </g>
              ))}
              <text className={styles.bandCaption} x={56} y={410}>
                candidate CLₜ {example.preserved}/{example.incumbentPass} →
                verdict {example.verdict}
              </text>
              <text className={styles.bandCaption} x={56} y={432}>
                system-after-gate {example.systemPassAfterGate}/
                {example.totalCriteria} · incumbent 보호
              </text>
            </g>

            <g
              className={styles.gateBandPanel}
              data-band="stop"
              data-active={reachedStep("stop") ? "true" : "false"}
              data-stopped={stopReason ? "true" : "false"}
            >
              <rect x={400} y={296} width={240} height={158} rx={12} />
              <text className={styles.bandTitle} x={416} y={322}>
                bounded stopping
              </text>
              <text
                className={styles.stopBandVerdict}
                x={416}
                y={356}
                data-stopped={stopReason ? "true" : "false"}
              >
                {stopReason ? `STOP · ${stopReason}` : "CONTINUE"}
              </text>
              <text className={styles.bandCaption} x={416} y={386}>
                COMPLETE 선언 대신 구조화된 종료
              </text>
              <text className={styles.bandCaption} x={416} y={410}>
                best-so-far {bestSoFar?.revision ?? "없음"} 반환
              </text>
              <text className={styles.bandCaption} x={416} y={432}>
                safety·harness가 success보다 먼저
              </text>
            </g>
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
