"use client";

import { useRef, useState } from "react";

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
 * 판정자가 agent 자신이며 채택 gate가 없다. 좌측 ring이 그 구조를,
 * 우측 궤적이 그 구조가 물려받는 한계(자기평가 괴리·훼손 채택·천장)를
 * 보여 준다. backpressure 토글은 부분 external verifier의 효과다.
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
  { id: "backpressure", durationMs: 12000, label: "test backpressure: 천장 상승, 후퇴 잔존" },
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

function chartX(iteration: number) {
  return CHART_X0 + (iteration / LAST_ITERATION) * (CHART_X1 - CHART_X0);
}

function chartY(value: number) {
  return (
    CHART_Y1 - (value / RALPH_TOTAL_REQUIREMENTS) * (CHART_Y1 - CHART_Y0)
  );
}

function linePath(values: readonly number[]) {
  return values
    .map(
      (value, iteration) =>
        `${iteration === 0 ? "M" : "L"} ${chartX(iteration).toFixed(1)} ${chartY(value).toFixed(1)}`,
    )
    .join(" ");
}

/** believed와 actual 사이의 괴리 음영 폐곡선. */
function gapPath(believed: readonly number[], actual: readonly number[]) {
  const forward = believed.map(
    (value, iteration) =>
      `${iteration === 0 ? "M" : "L"} ${chartX(iteration).toFixed(1)} ${chartY(value).toFixed(1)}`,
  );
  const backward = [...actual]
    .map(
      (value, iteration) =>
        `L ${chartX(iteration).toFixed(1)} ${chartY(value).toFixed(1)}`,
    )
    .reverse();
  return `${forward.join(" ")} ${backward.join(" ")} Z`;
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
}: {
  mode: RalphBackpressure;
  active: boolean;
}) {
  const trajectory = RALPH_TRAJECTORIES[mode];
  const ceilingY = chartY(trajectory.ceiling);
  return (
    <g
      className={styles.ralphModeGroup}
      data-trajectory={mode}
      data-active={active ? "true" : "false"}
    >
      <path
        className={styles.ralphGap}
        d={gapPath(trajectory.believed, trajectory.actual)}
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
      <path
        className={`${styles.ralphTraj} ${styles.ralphBelieved}`}
        d={linePath(trajectory.believed)}
        pathLength={1}
      />
      <path
        className={`${styles.ralphTraj} ${styles.ralphActual}`}
        d={linePath(trajectory.actual)}
        pathLength={1}
      />
      <g className={styles.ralphRegression}>
        {trajectory.regressions.map((iteration) => (
          <g key={iteration} data-regression={iteration}>
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
      </g>
      {trajectory.completeClaimIteration !== null ? (
        <g className={styles.ralphComplete}>
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

  const [userMode, setUserMode] = useState<RalphBackpressure | null>(null);

  const stage =
    state.status === "idle"
      ? "ring"
      : state.status === "completed"
        ? "handoff"
        : (STEPS[state.step]?.id ?? "ring");
  const autoMode: RalphBackpressure = reachedStep("backpressure")
    ? "test"
    : "none";
  const mode = userMode ?? autoMode;
  const curvesRevealed = state.hasUserInteracted || stage !== "ring";
  const detailRevealed =
    state.hasUserInteracted || reachedStep("gap");

  const trajectory = RALPH_TRAJECTORIES[mode];
  const summary = ralphSummary(mode);

  const selectMode = (value: RalphBackpressure) => {
    markUserInteraction();
    setUserMode(value);
  };

  return (
    <div
      ref={containerRef}
      data-ralph-loop
      data-ralph-stage={stage}
      data-mode={mode}
      data-curves={curvesRevealed ? "on" : "off"}
      data-detail={detailRevealed ? "on" : "off"}
    >
      <LabShell
        title="Ralph loop — 논문의 모형과 가장 가까운 실전 구조"
        subtitle="같은 프롬프트 재투입 · 자기 판정 · gate 없음 — 그래서 논문의 한계를 물려받는다"
        legend={[
          { label: "believed · 자기 평가", tone: "accent" },
          { label: "actual · 실제 충족", tone: "success" },
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
              제공합니다. 수치는 구조를 보여 주기 위한 합성 예시값입니다.
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
              투입되는 순환을 나타낸다. 오른쪽 차트는 iteration에 따라 agent가
              믿는 진행 believed와 실제 충족 actual이 벌어지고, actual이 훼손
              채택으로 후퇴하며 천장 아래에서 정체하는 모습을 보여 준다. test
              backpressure를 켜면 천장이 올라가지만 후퇴는 남는다.
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
              <text
                className={styles.ralphStation}
                x={RING_CX}
                y={RING_CY - RING_R - 12}
                textAnchor="middle"
              >
                PROMPT.md
              </text>
              <text
                className={styles.ralphStation}
                x={RING_CX + RING_R + 10}
                y={RING_CY + 4}
              >
                agent
              </text>
              <text
                className={styles.ralphStation}
                x={RING_CX}
                y={RING_CY + RING_R + 18}
                textAnchor="middle"
              >
                working tree
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
                <TrajectoryGroup mode="none" active={mode === "none"} />
                <TrajectoryGroup mode="test" active={mode === "test"} />
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
