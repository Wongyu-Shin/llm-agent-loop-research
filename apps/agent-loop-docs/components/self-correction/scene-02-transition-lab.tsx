"use client";

import { useMemo, useRef, useState } from "react";

import {
  LabShell,
  RangeControl,
  SegmentedControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import { transitionBreakdown } from "./paper-model";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
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

const STEPS: PlaybackStep[] = [
  { id: "sources", durationMs: 8000, label: "현재 정답·오답 분포 읽기" },
  { id: "dots-move", durationMs: 16000, label: "100개 점이 네 전이 셀로 이동" },
  { id: "merge", durationMs: 4000, label: "정답 셀 병합 → Accₜ₊₁" },
  { id: "handoff", durationMs: 4000, label: "다음 장면의 손익 막대로 전환" },
];

type ViewMode = "count" | "probability" | "matrix";

type CellId = "preserved" | "damaged" | "recovered" | "remaining";

/** Largest-remainder rounding so the four cells always sum to population. */
function allocateCounts(population: number, shares: number[]) {
  const raw = shares.map((share) => share * population);
  const floors = raw.map(Math.floor);
  let remainder = population - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  const counts = [...floors];
  for (const { index } of order) {
    if (remainder <= 0) break;
    counts[index] += 1;
    remainder -= 1;
  }
  return counts;
}

const GLYPHS = 100;

const CELLS: Array<{
  id: CellId;
  label: string;
  tone: "good" | "danger" | "muted";
  x: number;
}> = [
  { id: "preserved", label: "정답 유지", tone: "good", x: 42 },
  { id: "damaged", label: "오답 훼손", tone: "danger", x: 204 },
  { id: "recovered", label: "정답 복구", tone: "good", x: 366 },
  { id: "remaining", label: "오답 유지", tone: "muted", x: 528 },
];

const CELL_WIDTH = 110;
const CELL_Y = 322;
const CELL_HEIGHT = 96;

function gridPosition(
  index: number,
  columns: number,
  originX: number,
  originY: number,
  spacingX: number,
  spacingY: number,
) {
  return {
    x: originX + (index % columns) * spacingX,
    y: originY + Math.floor(index / columns) * spacingY,
  };
}

/**
 * Scene 2 primary visual (wireframe §4). 100 dots split by Accₜ flow
 * through the CLₜ / CSₜ gates into the four transition cells, then the two
 * correct cells merge into Accₜ₊₁. Counts use largest-remainder rounding
 * so the cells always sum to the population.
 */
export function TwoStateTransitionLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction } = useScenePlayback(
    STEPS,
    containerRef,
  );
  const idPrefix = useSvgIdPrefix("transition-lab");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const [accuracy, setAccuracy] = useState(0.7);
  const [confidenceLevel, setConfidenceLevel] = useState(0.9);
  const [critiqueScore, setCritiqueScore] = useState(0.4);
  const [population, setPopulation] = useState<100 | 1000>(100);
  const [view, setView] = useState<ViewMode>("count");
  const [committed, setCommitted] = useState({
    accuracy: 0.7,
    confidenceLevel: 0.9,
    critiqueScore: 0.4,
  });

  const breakdown = useMemo(
    () => transitionBreakdown(accuracy, confidenceLevel, critiqueScore),
    [accuracy, confidenceLevel, critiqueScore],
  );
  const committedBreakdown = useMemo(
    () =>
      transitionBreakdown(
        committed.accuracy,
        committed.confidenceLevel,
        committed.critiqueScore,
      ),
    [committed],
  );

  const cellShares = [
    breakdown.preservedCorrect,
    breakdown.damagedCorrect,
    breakdown.recoveredCorrect,
    breakdown.remainingIncorrect,
  ];
  // allocateCounts is cheap; recompute per render instead of memoizing.
  const counts = allocateCounts(population, cellShares);
  const glyphCounts = allocateCounts(GLYPHS, cellShares);

  const stage =
    state.status === "idle"
      ? "sources"
      : state.status === "completed"
        ? "handoff"
        : STEPS[state.step]?.id ?? "sources";
  const dotsMoved = stage !== "sources";
  const merged = stage === "merge" || stage === "handoff";

  // Dot assignment: indexes 0..(correctGlyphs-1) start in the correct
  // source stack, the rest in the incorrect stack. Within each source the
  // first slice transitions to its "good" outcome cell.
  const correctGlyphs = glyphCounts[0] + glyphCounts[1];
  const dots = useMemo(() => {
    return Array.from({ length: GLYPHS }, (_, index) => {
      const fromCorrect = index < correctGlyphs;
      const sourceIndex = fromCorrect ? index : index - correctGlyphs;
      const source = fromCorrect
        ? gridPosition(sourceIndex, 14, 74, 74, 16.5, 16.5)
        : gridPosition(sourceIndex, 10, 420, 74, 16.5, 16.5);
      let cell: CellId;
      let cellIndex: number;
      if (fromCorrect) {
        cell = sourceIndex < glyphCounts[0] ? "preserved" : "damaged";
        cellIndex =
          sourceIndex < glyphCounts[0]
            ? sourceIndex
            : sourceIndex - glyphCounts[0];
      } else {
        cell = sourceIndex < glyphCounts[2] ? "recovered" : "remaining";
        cellIndex =
          sourceIndex < glyphCounts[2]
            ? sourceIndex
            : sourceIndex - glyphCounts[2];
      }
      const cellMeta = CELLS.find((candidate) => candidate.id === cell)!;
      const target = gridPosition(
        cellIndex,
        7,
        cellMeta.x + 13,
        CELL_Y + 26,
        14,
        14,
      );
      return {
        index,
        source,
        target,
        cell,
        correctOutcome: cell === "preserved" || cell === "recovered",
      };
    });
  }, [correctGlyphs, glyphCounts]);

  const interact = (updater: () => void) => {
    markUserInteraction();
    updater();
  };
  const commit = () => {
    setCommitted({ accuracy, confidenceLevel, critiqueScore });
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const cellAnnotation = (index: number) =>
    view === "probability"
      ? formatPercent(cellShares[index])
      : `${counts[index]}개`;

  const nextCount = counts[0] + counts[2];

  return (
    <div
      ref={containerRef}
      data-transition-lab
      data-stage={stage}
      onPointerUp={commit}
      onKeyUp={commit}
      onTouchEnd={commit}
    >
      <LabShell
        title="두 상태 전이 회계"
        subtitle="Accₜ₊₁ = Accₜ × CLₜ + (1 − Accₜ) × CSₜ"
        legend={[
          { label: "정답", tone: "success" },
          { label: "오답", tone: "danger" },
          { label: "훼손·잔여", tone: "neutral" },
        ]}
        stageLabel={`population ${population}개 · 확률은 동일`}
        controls={
          <>
            <PlaybackBar
              state={state}
              controls={controls}
              stepCount={STEPS.length}
              stepLabel={STEPS[Math.min(state.step, STEPS.length - 1)].label}
              markUserInteraction={markUserInteraction}
            />
            <RangeControl
              id="transition-accuracy"
              label="Accₜ · 현재 정확도"
              value={accuracy}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(accuracy)}
              onChange={(value) => interact(() => setAccuracy(value))}
            />
            <RangeControl
              id="transition-confidence"
              label="CLₜ · 정답 보존율"
              value={confidenceLevel}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(confidenceLevel)}
              onChange={(value) => interact(() => setConfidenceLevel(value))}
            />
            <RangeControl
              id="transition-critique"
              label="CSₜ · 오답 복구율"
              value={critiqueScore}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(critiqueScore)}
              onChange={(value) => interact(() => setCritiqueScore(value))}
            />
            <SegmentedControl
              label="population"
              value={String(population) as "100" | "1000"}
              options={[
                { value: "100", label: "100" },
                { value: "1000", label: "1,000" },
              ]}
              onChange={(value) =>
                interact(() => setPopulation(Number(value) as 100 | 1000))
              }
            />
            <SegmentedControl
              label="보기"
              value={view}
              options={[
                { value: "count", label: "count" },
                { value: "probability", label: "probability" },
                { value: "matrix", label: "2×2 표" },
              ]}
              onChange={(value) => interact(() => setView(value))}
            />
          </>
        }
        status={[
          { label: "Accₜ", value: formatPercent(committed.accuracy) },
          {
            label: "Accₜ₊₁",
            value: formatPercent(committedBreakdown.nextAccuracy),
          },
          {
            label: "순변화",
            value: `${committedBreakdown.netChange >= 0 ? "+" : "−"}${Math.abs(
              committedBreakdown.netChange * 100,
            ).toFixed(2)}%p`,
          },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              네 전이 셀의 값입니다. 다음 정확도는 현재 정확도 곱하기 CLₜ
              더하기 현재 오답률 곱하기 CSₜ입니다.
            </p>
            <table className={styles.transitionTable}>
              <caption>2×2 전이 표 · population {population}개</caption>
              <thead>
                <tr>
                  <th scope="col">현재 상태</th>
                  <th scope="col">다음 상태</th>
                  <th scope="col">count</th>
                  <th scope="col">probability</th>
                </tr>
              </thead>
              <tbody>
                <tr data-transition="preserved">
                  <td>정답</td>
                  <td>정답 · 유지</td>
                  <td>{counts[0]}</td>
                  <td>{formatPercent(cellShares[0])}</td>
                </tr>
                <tr data-transition="damaged">
                  <td>정답</td>
                  <td>오답 · 훼손</td>
                  <td>{counts[1]}</td>
                  <td>{formatPercent(cellShares[1])}</td>
                </tr>
                <tr data-transition="recovered">
                  <td>오답</td>
                  <td>정답 · 복구</td>
                  <td>{counts[2]}</td>
                  <td>{formatPercent(cellShares[2])}</td>
                </tr>
                <tr data-transition="remaining">
                  <td>오답</td>
                  <td>오답 · 잔여</td>
                  <td>{counts[3]}</td>
                  <td>{formatPercent(cellShares[3])}</td>
                </tr>
              </tbody>
            </table>
            <p data-committed-summary>
              commit된 Accₜ {formatPercent(committed.accuracy)} 기준으로 다음
              정확도는 {formatPercent(committedBreakdown.nextAccuracy)}입니다.
            </p>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="두 상태 전이 시각화 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox="0 0 680 520"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>두 상태 전이 회계 시각화</title>
            <desc id={descId}>
              위쪽의 정답·오답 두 상자에서 100개의 점이 CLₜ와 CSₜ 게이트를
              지나 유지, 훼손, 복구, 잔여 네 셀로 이동하고, 유지와 복구 셀이
              합쳐져 다음 정확도 Accₜ₊₁이 된다.
            </desc>

            {/* Source stacks */}
            <g>
              <rect
                className={styles.stateBoxGood}
                x="56"
                y="52"
                width="248"
                height="118"
                rx="12"
              />
              <text className={styles.sourceLabel} x="60" y="42">
                현재 정답 · Accₜ ={" "}
                {view === "probability"
                  ? formatPercent(accuracy)
                  : `${allocateCounts(population, [accuracy, 1 - accuracy])[0]}개`}
              </text>
              <rect
                className={styles.stateBoxDanger}
                x="404"
                y="52"
                width="182"
                height="118"
                rx="12"
              />
              <text className={styles.sourceLabel} x="408" y="42">
                현재 오답 ·{" "}
                {view === "probability"
                  ? formatPercent(1 - accuracy)
                  : `${allocateCounts(population, [accuracy, 1 - accuracy])[1]}개`}
              </text>
            </g>

            {/* Gates */}
            <g className={styles.gateRow}>
              <g data-tone="good">
                <rect x="96" y="206" width="120" height="34" rx="8" />
                <text x="156" y="228" textAnchor="middle">
                  CLₜ {formatPercent(confidenceLevel)}
                </text>
              </g>
              <g data-tone="danger">
                <rect x="232" y="206" width="132" height="34" rx="8" />
                <text x="298" y="228" textAnchor="middle">
                  1−CLₜ {formatPercent(1 - confidenceLevel)}
                </text>
              </g>
              <g data-tone="good">
                <rect x="404" y="206" width="120" height="34" rx="8" />
                <text x="464" y="228" textAnchor="middle">
                  CSₜ {formatPercent(critiqueScore)}
                </text>
              </g>
              <g data-tone="muted">
                <rect x="540" y="206" width="132" height="34" rx="8" />
                <text x="606" y="228" textAnchor="middle">
                  1−CSₜ {formatPercent(1 - critiqueScore)}
                </text>
              </g>
            </g>

            {/* Destination cells */}
            {CELLS.map((cell, index) => (
              <g
                key={cell.id}
                className={styles.transitionCell}
                data-tone={cell.tone}
                data-cell={cell.id}
                data-merged={
                  merged && (cell.id === "preserved" || cell.id === "recovered")
                    ? "true"
                    : undefined
                }
              >
                <rect
                  x={cell.x}
                  y={CELL_Y}
                  width={CELL_WIDTH}
                  height={CELL_HEIGHT}
                  rx="10"
                />
                <text className={styles.cellLabel} x={cell.x + CELL_WIDTH / 2} y={CELL_Y - 10} textAnchor="middle">
                  {cell.label}
                </text>
                <text
                  className={styles.cellValue}
                  x={cell.x + CELL_WIDTH / 2}
                  y={CELL_Y + CELL_HEIGHT + 22}
                  textAnchor="middle"
                >
                  {cellAnnotation(index)}
                </text>
              </g>
            ))}

            {/* Dots */}
            {dots.map((dot) => (
              <circle
                key={dot.index}
                className={styles.transitionDot}
                data-outcome={dot.correctOutcome ? "good" : dot.cell === "damaged" ? "danger" : "muted"}
                data-moved={dotsMoved ? "true" : undefined}
                style={{
                  transitionDelay: dotsMoved
                    ? `${dot.index * 0.09}s`
                    : "0s",
                  transform: dotsMoved
                    ? `translate(${dot.target.x - dot.source.x}px, ${dot.target.y - dot.source.y}px)`
                    : "translate(0, 0)",
                }}
                cx={dot.source.x}
                cy={dot.source.y}
                r="5.2"
              />
            ))}

            {/* Merge bar */}
            <g className={styles.mergeGroup} data-visible={merged ? "true" : "false"}>
              <text className={styles.mergeLabel} x="56" y="482">
                Accₜ₊₁ ={" "}
                {view === "probability"
                  ? formatPercent(breakdown.nextAccuracy)
                  : `${nextCount}개`}
              </text>
              <rect
                className={styles.mergeTrack}
                x="230"
                y="468"
                width="400"
                height="18"
                rx="9"
              />
              <rect
                className={styles.mergeFill}
                x="230"
                y="468"
                width={400 * breakdown.nextAccuracy}
                height="18"
                rx="9"
              />
            </g>
          </svg>
        </div>
        {view === "matrix" ? (
          <p className={styles.matrixHint}>
            2×2 전이 표는 아래 표 형태 대체 자료에서 현재 값으로 제공됩니다.
          </p>
        ) : null}
      </LabShell>
    </div>
  );
}
