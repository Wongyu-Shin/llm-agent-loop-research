"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  LabShell,
  SegmentedControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import {
  RALPH_BACKPRESSURE_LABELS,
  RALPH_CORRESPONDENCE,
  RALPH_FACTS,
  RALPH_TOTAL_REQUIREMENTS,
  RALPH_TRAJECTORIES,
  ralphSummary,
  type RalphBackpressure,
} from "./loop-model";
import { ProvenanceBadge } from "./presentation-shell";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./loop-scenes.module.css";

/**
 * Scene 6 — Ralph loop (reports/scene6-ralph-loop-wireframe.md).
 *
 * 논문의 모형과 가장 가까운 실전 loop: 같은 프롬프트를 무한 재투입하고
 * 판정자가 agent 자신이며 채택 gate가 없다. 좌측 ring과 우측 궤적은
 * 하나의 progress 클록을 공유한다 — ring 커서가 한 바퀴 돌 때마다 궤적이
 * iteration 한 칸 자라고, 후퇴로 이어지는 바퀴에서는 커서가 소등된다.
 * backpressure(test)는 ring의 귀환 경로에 검문소로 나타나는 부분 external
 * verifier로, 훼손을 잡은 바퀴(차단)를 ring과 궤적 양쪽에 표시한다.
 */

/** 와이어프레임 §4 — 1차 출처가 직접 지원하는 사실 strip. */
export function RalphFactsStrip() {
  return (
    <div className={styles.officialStrip} data-ralph-facts-strip>
      <div className={styles.officialStripHeading}>
        <ProvenanceBadge kind="community-practice" />
      </div>
      <dl>
        {RALPH_FACTS.map((fact) => (
          <div key={fact.id} data-fact={fact.id}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** 와이어프레임 §5 — 논문 모형의 가정 ↔ Ralph 구조 대응(해석). */
export function RalphCorrespondence() {
  return (
    <div className={styles.officialStrip} data-ralph-correspondence>
      <div className={styles.officialStripHeading}>
        <ProvenanceBadge kind="engineering-transfer" />
      </div>
      <dl>
        {RALPH_CORRESPONDENCE.map((row) => (
          <div key={row.id} data-row={row.id}>
            <dt>{row.paper}</dt>
            <dd>{row.ralph}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const STEPS: PlaybackStep[] = [
  { id: "ring", durationMs: 8000, label: "같은 프롬프트 재투입 — 상태는 파일뿐" },
  { id: "drift", durationMs: 12000, label: "backpressure 없음: 괴리 확장 + 후퇴 2회" },
  { id: "gap", durationMs: 4000, label: "COMPLETE 선언 vs actual 7/12" },
  { id: "backpressure", durationMs: 12000, label: "test 검문소 점등: 천장 상승, 후퇴 잔존" },
  { id: "handoff", durationMs: 4000, label: "gate는 여전히 없음 — 다음 장 예고" },
] as const;

const VIEW_W = 680;
const VIEW_H = 430;

const RING_CX = 114;
const RING_CY = 205;
const RING_R = 62;

const CHART_X0 = 252;
const CHART_X1 = 620;
const CHART_Y0 = 86;
const CHART_Y1 = 356;

const LAST_ITERATION = RALPH_TRAJECTORIES.none.actual.length - 1;

/**
 * 모든 draw가 공유하는 일정한 바퀴 속도 — 바퀴당 0.9초, 선형.
 * 자동 재생 진입·토글 재정렬·상시 반복 사이클이 전부 같은 속도를 쓰므로
 * 반복될 때마다 ring 회전과 궤적 성장 속도가 일정하게 유지된다.
 */
const LAP_MS = 900;
const CAMPAIGN_DRAW_MS = LAP_MS * LAST_ITERATION;
/** 완주한 궤적을 보여 주는 hold 시간 — 지나면 처음부터 다시 그린다. */
const HOLD_MS = 2600;

function chartX(iteration: number) {
  return CHART_X0 + (iteration / LAST_ITERATION) * (CHART_X1 - CHART_X0);
}

function chartY(value: number) {
  return (
    CHART_Y1 - (value / RALPH_TOTAL_REQUIREMENTS) * (CHART_Y1 - CHART_Y0)
  );
}

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function readReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** progress(0..12)까지의 좌표열 — 마지막 구간은 선형 보간으로 자란다. */
function pointsUpTo(values: readonly number[], progress: number) {
  if (progress <= 0) return [] as Array<{ x: number; y: number }>;
  const whole = Math.min(LAST_ITERATION, Math.floor(progress));
  const points = values
    .slice(0, whole + 1)
    .map((value, iteration) => ({ x: chartX(iteration), y: chartY(value) }));
  const fraction = progress - whole;
  if (whole < LAST_ITERATION && fraction > 0) {
    const from = values[whole];
    const to = values[whole + 1];
    points.push({
      x: chartX(whole + fraction),
      y: chartY(from + (to - from) * fraction),
    });
  }
  return points;
}

function linePath(values: readonly number[], progress: number) {
  const points = pointsUpTo(values, progress);
  if (points.length < 2) return "";
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
}

/** 후퇴 바퀴의 하락 구간 — actual 위에 red로 덧그린다. progress를 따라 자란다. */
function failSegmentPath(
  values: readonly number[],
  iteration: number,
  progress: number,
) {
  const start = iteration - 1;
  if (progress <= start) return null;
  const t = Math.min(1, progress - start);
  const from = values[start];
  const to = values[iteration];
  const x0 = chartX(start);
  const y0 = chartY(from);
  const x1 = chartX(start + t);
  const y1 = chartY(from + (to - from) * t);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

/** believed와 actual 사이의 괴리 음영 — progress까지만 채운다. */
function gapPath(
  believed: readonly number[],
  actual: readonly number[],
  progress: number,
) {
  const forward = pointsUpTo(believed, progress);
  const backward = pointsUpTo(actual, progress).reverse();
  if (forward.length < 2) return "";
  const commands = [
    ...forward.map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    ),
    ...backward.map(
      (point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    ),
  ];
  return `${commands.join(" ")} Z`;
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
/** backpressure 검문소 — working tree에서 PROMPT.md로 돌아가는 귀환 경로. */
const STATION_ANGLE = 180;

type RalphEvent = {
  mode: RalphBackpressure;
  iteration: number;
  text: string;
};

const EVENTS: RalphEvent[] = (["none", "test"] as const).flatMap((mode) => {
  const trajectory = RALPH_TRAJECTORIES[mode];
  const label = RALPH_BACKPRESSURE_LABELS[mode];
  const items: RalphEvent[] = trajectory.regressions.map((iteration) => ({
    mode,
    iteration,
    text: `backpressure ${label} · iteration ${iteration} — actual ${trajectory.actual[iteration - 1]}→${trajectory.actual[iteration]} 후퇴: 훼손이 gate 없이 그대로 채택되었다.`,
  }));
  items.push(
    ...trajectory.blocked.map((iteration) => ({
      mode,
      iteration,
      text: `backpressure ${label} · iteration ${iteration} — test 검문소가 훼손 시도를 실행 단계에서 잡아 후퇴를 차단했다.`,
    })),
  );
  if (trajectory.completeClaimIteration !== null) {
    const claim = trajectory.completeClaimIteration;
    items.push({
      mode,
      iteration: claim,
      text: `backpressure ${label} · iteration ${claim} — believed가 ${RALPH_TOTAL_REQUIREMENTS}/${RALPH_TOTAL_REQUIREMENTS} COMPLETE를 선언했지만 actual은 ${trajectory.actual[trajectory.actual.length - 1]}/${RALPH_TOTAL_REQUIREMENTS}다.`,
    });
  }
  return items.sort((a, b) => a.iteration - b.iteration);
});

function TrajectoryGroup({
  mode,
  active,
  progress,
}: {
  mode: RalphBackpressure;
  active: boolean;
  progress: number;
}) {
  const trajectory = RALPH_TRAJECTORIES[mode];
  const ceilingY = chartY(trajectory.ceiling);
  const believedPath = linePath(trajectory.believed, progress);
  const actualPath = linePath(trajectory.actual, progress);
  return (
    <g
      className={styles.ralphModeGroup}
      data-trajectory={mode}
      data-active={active ? "true" : "false"}
    >
      <path
        className={styles.ralphGap}
        d={gapPath(trajectory.believed, trajectory.actual, progress)}
      />
      <line
        className={styles.ralphCeiling}
        x1={CHART_X0}
        y1={ceilingY}
        x2={CHART_X1}
        y2={ceilingY}
      />
      <text
        className={styles.ralphCeilingLabel}
        x={CHART_X0 + 4}
        y={ceilingY - 7}
      >
        천장 Upp (해석)
      </text>
      {believedPath ? (
        <path className={styles.ralphBelieved} d={believedPath} />
      ) : null}
      {actualPath ? (
        <path className={styles.ralphActual} d={actualPath} />
      ) : null}
      {trajectory.regressions.map((iteration) => {
        const failPath = failSegmentPath(trajectory.actual, iteration, progress);
        return failPath ? (
          <path
            key={`fail-${iteration}`}
            className={styles.ralphActualFail}
            data-fail-segment={iteration}
            d={failPath}
          />
        ) : null;
      })}
      {trajectory.regressions.map((iteration) => (
        <g
          key={`regression-${iteration}`}
          className={styles.ralphRegression}
          data-regression={iteration}
          data-visible={progress >= iteration ? "true" : "false"}
        >
          {/* 직전 바퀴에 점등돼 있던 높이가 소등되는 자리 */}
          <circle
            className={styles.ralphRegressionGhost}
            cx={chartX(iteration)}
            cy={chartY(trajectory.actual[iteration - 1])}
            r={5}
          />
          <line
            className={styles.ralphRegressionDrop}
            x1={chartX(iteration)}
            y1={chartY(trajectory.actual[iteration - 1]) + 5}
            x2={chartX(iteration)}
            y2={chartY(trajectory.actual[iteration]) - 4}
          />
          <circle
            className={styles.ralphRegressionDot}
            cx={chartX(iteration)}
            cy={chartY(trajectory.actual[iteration])}
            r={3.4}
          />
        </g>
      ))}
      {trajectory.blocked.map((iteration) => (
        <g
          key={`blocked-${iteration}`}
          className={styles.ralphBlockedMark}
          data-blocked={iteration}
          data-visible={progress >= iteration ? "true" : "false"}
        >
          <circle
            cx={chartX(iteration)}
            cy={chartY(trajectory.actual[iteration])}
            r={6.5}
          />
          <text
            x={chartX(iteration)}
            y={chartY(trajectory.actual[iteration]) - 12}
            textAnchor="middle"
          >
            차단
          </text>
        </g>
      ))}
      {trajectory.completeClaimIteration !== null ? (
        <g
          className={styles.ralphComplete}
          data-visible={
            progress >= trajectory.completeClaimIteration ? "true" : "false"
          }
        >
          <line
            x1={chartX(trajectory.completeClaimIteration)}
            y1={chartY(RALPH_TOTAL_REQUIREMENTS) - 2}
            x2={chartX(trajectory.completeClaimIteration)}
            y2={chartY(RALPH_TOTAL_REQUIREMENTS) - 14}
          />
          <text
            x={chartX(trajectory.completeClaimIteration)}
            y={chartY(RALPH_TOTAL_REQUIREMENTS) - 18}
            textAnchor="middle"
          >
            COMPLETE 선언
          </text>
        </g>
      ) : null}
    </g>
  );
}

export function RalphLoopLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction, reachedStep } =
    useScenePlayback(STEPS, containerRef);
  const idPrefix = useSvgIdPrefix("ralph-loop");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    () => false,
  );

  const [userMode, setUserMode] = useState<RalphBackpressure | null>(null);

  /** ring 회전과 궤적 드로잉이 공유하는 클록 (0..12 바퀴). */
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  /** 진행 계획 — 상시 rAF 루프가 읽어서 progress를 갱신한다. */
  const drawPlanRef = useRef<
    | { kind: "draw"; start: number | null }
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

  // Scene 1·2·5 문법 — 화면에 보이는 동안 도는 상시 rAF 루프가 draw plan을
  // 소비한다. setState는 rAF 콜백 안에서만 일어난다. plan이 비면 캠페인을
  // 처음부터 다시 그리므로, 별도 설정 없이도 화면에 보이는 동안 계속
  // 반복 재생된다 (draw → 잠깐 hold → 다시 draw).
  useEffect(() => {
    if (reducedMotion || !visible) return;
    const pending = drawPlanRef.current;
    if (pending?.kind === "draw") {
      // 화면 밖에 있던 시간은 세지 않는다 — 복귀 시 현재 draw를 재시작.
      pending.start = null;
    }
    let frame = 0;
    const tick = (now: number) => {
      let plan = drawPlanRef.current;
      if (!plan) {
        plan = { kind: "draw", start: null };
        drawPlanRef.current = plan;
      }
      if (plan.kind === "hold") {
        if (now >= plan.until) {
          drawPlanRef.current = { kind: "draw", start: null };
        }
      } else {
        if (plan.start === null) plan.start = now;
        const t = Math.min(1, (now - plan.start) / CAMPAIGN_DRAW_MS);
        if (t >= 1) {
          drawPlanRef.current = { kind: "hold", until: now + HOLD_MS };
        }
        setProgress(t * LAST_ITERATION);
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
        ? "handoff"
        : (STEPS[state.step]?.id ?? "ring");

  // 재생 단계 전환은 반복 사이클의 위상만 맞춘다: drift·backpressure 진입
  // 시 캠페인을 처음부터 다시 그려 내레이션과 정렬하고, 나머지 단계에서는
  // 상시 반복 사이클이 그대로 이어진다.
  const prevStageRef = useRef(stage);
  useEffect(() => {
    if (prevStageRef.current === stage) return;
    prevStageRef.current = stage;
    if (reducedMotion) return;
    if (stage === "drift" || stage === "backpressure") {
      drawPlanRef.current = { kind: "draw", start: null };
    }
  }, [stage, reducedMotion]);

  const autoMode: RalphBackpressure = reachedStep("backpressure")
    ? "test"
    : "none";
  const mode = userMode ?? autoMode;

  const trajectory = RALPH_TRAJECTORIES[mode];
  const summary = ralphSummary(mode);

  const selectMode = (value: RalphBackpressure) => {
    markUserInteraction();
    setUserMode(value);
    if (!reducedMotion) {
      setProgress(0);
      drawPlanRef.current = { kind: "draw", start: null };
    }
  };

  // Ring cursor: 한 바퀴 = iteration 한 칸. 후퇴로 끝나는 바퀴(loop 실패)
  // 에서는 ring 전체가 red로 전환되고, test 모드의 차단 바퀴에서는
  // 검문소가 점등된다.
  const shownProgress = reducedMotion ? LAST_ITERATION : progress;
  const lap = Math.min(LAST_ITERATION, Math.floor(shownProgress));
  const arrivingIteration = Math.min(LAST_ITERATION, lap + 1);
  const drawing = shownProgress > 0 && shownProgress < LAST_ITERATION;
  const cursorAngle = -90 + shownProgress * 360;
  const cursorPoint = ringPoint(cursorAngle);
  const failing =
    drawing && trajectory.regressions.includes(arrivingIteration);
  const stationBlocking =
    mode === "test" &&
    drawing &&
    trajectory.blocked.includes(arrivingIteration);
  const stationPoint = ringPoint(STATION_ANGLE);

  return (
    <div
      ref={containerRef}
      data-ralph-loop
      data-ralph-stage={stage}
      data-mode={mode}
      data-failing={failing ? "true" : "false"}
      data-curves="on"
    >
      <LabShell
        title="Ralph loop — 논문의 모형과 가장 가까운 실전 구조"
        subtitle="같은 프롬프트 재투입 · 자기 판정 · gate 없음 — 그래서 논문의 한계를 물려받는다"
        legend={[
          { label: "believed · 자기 평가", tone: "accent" },
          { label: "actual · 실제 충족", tone: "success" },
          { label: "후퇴 · 훼손 채택", tone: "danger" },
          { label: "천장 Upp (해석)", tone: "attention" },
        ]}
        stageLabel={`backpressure: ${RALPH_BACKPRESSURE_LABELS[mode]}`}
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
              label="backpressure"
              value={mode}
              options={[
                { value: "none", label: "없음" },
                { value: "test", label: "test" },
              ]}
              onChange={selectMode}
            />
          </>
        }
        status={[
          {
            label: "관측",
            value: summary,
          },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              같은 프롬프트를 무한 재투입하는 loop에서 agent가 스스로 믿는
              진행(believed)과 실제 충족된 요구사항 수(actual)를 iteration별로
              제공합니다. backpressure는 agent가 스스로 돌리는 test로, 훼손
              일부를 실행 단계에서 차단하는 부분 external verifier입니다.
              수치는 구조를 보여 주기 위한 합성 예시값입니다.
            </p>
            <table className={styles.ralphTable} data-ralph-table>
              <caption>
                iteration별 believed / actual (충족 요구사항 수, 총{" "}
                {RALPH_TOTAL_REQUIREMENTS}개)
              </caption>
              <thead>
                <tr>
                  <th scope="col">iteration</th>
                  <th scope="col">believed (없음)</th>
                  <th scope="col">actual (없음)</th>
                  <th scope="col">believed (test)</th>
                  <th scope="col">actual (test)</th>
                </tr>
              </thead>
              <tbody>
                {RALPH_TRAJECTORIES.none.believed.map((_, iteration) => (
                  <tr key={iteration}>
                    <th scope="row">{iteration}</th>
                    <td>{RALPH_TRAJECTORIES.none.believed[iteration]}</td>
                    <td>{RALPH_TRAJECTORIES.none.actual[iteration]}</td>
                    <td>{RALPH_TRAJECTORIES.test.believed[iteration]}</td>
                    <td>{RALPH_TRAJECTORIES.test.actual[iteration]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ol className={styles.ralphEvents} data-ralph-events>
              {EVENTS.map((event) => (
                <li key={`${event.mode}-${event.iteration}`}>{event.text}</li>
              ))}
            </ol>
            <p data-ralph-summary>
              backpressure {RALPH_BACKPRESSURE_LABELS[mode]}: {summary} · 천장{" "}
              {trajectory.ceiling}/{RALPH_TOTAL_REQUIREMENTS}
            </p>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="Ralph loop 구조와 궤적 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>
              Ralph loop의 순환 구조와 자기평가·실제 궤적
            </title>
            <desc id={descId}>
              왼쪽 ring은 같은 프롬프트가 agent와 working tree를 거쳐 다시
              투입되는 순환이며, 커서가 한 바퀴 돌 때마다 오른쪽 궤적이
              iteration 한 칸 자란다. agent가 믿는 진행 believed와 실제 충족
              actual이 벌어지고, actual은 훼손 채택으로 후퇴하며 천장 아래에서
              정체한다. backpressure test를 켜면 ring의 귀환 경로에 검문소가
              생겨 훼손 일부를 차단하고 천장이 올라가지만, 후퇴는 남는다.
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

            {/* Loop ring — 같은 프롬프트의 순환 */}
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

              {/* backpressure 검문소 — 귀환 경로의 부분 verifier */}
              <g
                className={styles.ralphStation}
                data-station-mode={mode}
                data-blocking={stationBlocking ? "true" : "false"}
              >
                <rect
                  x={stationPoint.x - 21}
                  y={stationPoint.y - 12}
                  width={42}
                  height={24}
                  rx={6}
                />
                <text
                  x={stationPoint.x}
                  y={stationPoint.y + 4}
                  textAnchor="middle"
                >
                  test
                </text>
                <text
                  className={styles.ralphStationSub}
                  x={stationPoint.x}
                  y={stationPoint.y - 20}
                  textAnchor="middle"
                >
                  {mode === "test" ? "부분 verifier" : "없음"}
                </text>
              </g>

              <text
                className={styles.ralphStationLabel}
                x={RING_CX}
                y={RING_CY - RING_R - 12}
                textAnchor="middle"
              >
                PROMPT.md
              </text>
              <text
                className={styles.ralphStationLabel}
                x={RING_CX + RING_R + 10}
                y={RING_CY + 4}
              >
                agent
              </text>
              <text
                className={styles.ralphStationLabel}
                x={RING_CX}
                y={RING_CY + RING_R + 18}
                textAnchor="middle"
              >
                working tree
              </text>

              {/* Ring 중앙 — 궤적과 결합된 바퀴 카운터 */}
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
                같은 프롬프트 · 판정자도 자신
              </text>
              <text
                className={styles.ralphStationSub}
                x={RING_CX}
                y={RING_CY + RING_R + 54}
                textAnchor="middle"
              >
                남는 상태는 파일뿐
              </text>
            </g>

            {/* 궤적 무대 */}
            <g data-chart>
              <text
                className={styles.ralphAxisLabel}
                x={CHART_X0}
                y={CHART_Y0 - 22}
              >
                충족 요구사항 수 (0–{RALPH_TOTAL_REQUIREMENTS})
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
              {[0, 6, 12].map((tick) => (
                <text
                  key={tick}
                  className={styles.ralphAxisLabel}
                  x={CHART_X0 - 8}
                  y={chartY(tick) + 4}
                  textAnchor="end"
                >
                  {tick}
                </text>
              ))}
              {[0, 4, 8, 12].map((tick) => (
                <text
                  key={tick}
                  className={styles.ralphAxisLabel}
                  x={chartX(tick)}
                  y={CHART_Y1 + 18}
                  textAnchor="middle"
                >
                  {tick}
                </text>
              ))}
              <text
                className={styles.ralphAxisLabel}
                x={(CHART_X0 + CHART_X1) / 2}
                y={CHART_Y1 + 36}
                textAnchor="middle"
              >
                iteration
              </text>

              <g filter={`url(#${idPrefix}-glow)`}>
                <TrajectoryGroup
                  mode="none"
                  active={mode === "none"}
                  progress={shownProgress}
                />
                <TrajectoryGroup
                  mode="test"
                  active={mode === "test"}
                  progress={shownProgress}
                />
              </g>

              {/* 다음 장 예고 — Ralph에는 없는 acceptance gate */}
              <g className={styles.ralphGate}>
                <line
                  x1={CHART_X1 + 16}
                  y1={CHART_Y0}
                  x2={CHART_X1 + 16}
                  y2={CHART_Y1}
                />
                <text x={CHART_X1 + 24} y={CHART_Y0 + 14} textAnchor="start">
                  gate?
                </text>
              </g>
            </g>
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
