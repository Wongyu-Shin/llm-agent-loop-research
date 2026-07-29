"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { LabShell, useSvgIdPrefix } from "@/components/visualizations/viz-shell";
import {
  ALPHA_COMPARISON_CASES,
  ARE_YOU_SURE_CASE,
  BOOLQ_MODEL_CASES,
  FAN_CASES,
  FIXTURE_APPROXIMATION_NOTE,
  GLM4_DATASET_CASES,
  LLAMA3_DATASET_CASES,
  ORACLE_CASES,
  REPLAY_ROUND_COUNT,
  caseTheoryPercentByRound,
  confidenceLevelFromUppAlpha,
  critiqueScoreFromUppAlpha,
  type AlphaComparisonCase,
  type DatasetCase,
  type FanCase,
} from "./paper-figures-fixture";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./paper-scenes.module.css";

const STEPS: PlaybackStep[] = [
  { id: "stage-intro", durationMs: 8000, label: "무대 소개 — 보정과 예측 구간" },
  { id: "case-gsm8k", durationMs: 10000, label: "GSM8k 상승·포화 리플레이" },
  { id: "case-are-you-sure", durationMs: 8000, label: "Are you sure 하락 리플레이" },
  { id: "case-oracle", durationMs: 6000, label: "CL=1 oracle 리플레이" },
  { id: "claim-boundary", durationMs: 4000, label: "주장 경계 3열" },
  { id: "handoff", durationMs: 4000, label: "Part I 종료 전환" },
];

const AUTOPLAY_CASE_BY_STEP: Record<string, string> = {
  "case-gsm8k": "gsm8k-llama3",
  "case-are-you-sure": "are-you-sure-gsm8k",
  "case-oracle": "oracle-gsm8k",
};

type StageCase =
  | { kind: "dataset"; id: string; data: DatasetCase }
  | { kind: "fan"; id: string; data: FanCase }
  | { kind: "alpha"; id: string; data: AlphaComparisonCase };

type ShelfGroup = { id: string; label: string; cases: StageCase[] };

const DATASET_CASE_BY_ID = new Map(
  [
    ...LLAMA3_DATASET_CASES,
    ...GLM4_DATASET_CASES,
    ...BOOLQ_MODEL_CASES,
    ...ORACLE_CASES,
    ARE_YOU_SURE_CASE,
  ].map((caseData) => [caseData.id, caseData]),
);

const SHELF_GROUPS: ShelfGroup[] = [
  {
    id: "llama3-datasets",
    label: "Llama3-8B × 8 데이터셋 · Figure 1",
    cases: LLAMA3_DATASET_CASES.map((data) => ({
      kind: "dataset" as const,
      id: data.id,
      data,
    })),
  },
  {
    id: "glm4-datasets",
    label: "GLM4-9B × 8 데이터셋 · Figure 7",
    cases: GLM4_DATASET_CASES.map((data) => ({
      kind: "dataset" as const,
      id: data.id,
      data,
    })),
  },
  {
    id: "boolq-models",
    label: "모델 × BoolQ · Figure 8",
    cases: BOOLQ_MODEL_CASES.map((data) => ({
      kind: "dataset" as const,
      id: data.id,
      data,
    })),
  },
  {
    id: "corollary",
    label: "따름정리 검증 · Figure 3·4·5·9·10",
    cases: [
      ...FAN_CASES.map((data) => ({ kind: "fan" as const, id: data.id, data })),
      ...ALPHA_COMPARISON_CASES.map((data) => ({
        kind: "alpha" as const,
        id: data.id,
        data,
      })),
      ...ORACLE_CASES.map((data) => ({
        kind: "dataset" as const,
        id: data.id,
        data,
      })),
    ],
  },
  {
    id: "failure",
    label: "실패 사례 · Figure 6",
    cases: [
      { kind: "dataset" as const, id: ARE_YOU_SURE_CASE.id, data: ARE_YOU_SURE_CASE },
    ],
  },
];

const ALL_STAGE_CASES = new Map<string, StageCase>(
  SHELF_GROUPS.flatMap((group) => group.cases).map((stageCase) => [
    stageCase.id,
    stageCase,
  ]),
);

const SHELF_CASE_COUNT = ALL_STAGE_CASES.size;

function chipLabel(stageCase: StageCase) {
  if (stageCase.kind === "fan") return `팬차트 ${stageCase.data.dataset}`;
  if (stageCase.kind === "alpha") return `α 비교 ${stageCase.data.dataset}`;
  const { data } = stageCase;
  if (data.group === "boolq-models") return data.model;
  if (data.group === "corollary") return `CL=1 ${data.dataset}`;
  if (data.group === "failure") return "Are you sure?";
  return data.dataset;
}

function chipValues(stageCase: StageCase) {
  if (stageCase.kind === "fan") {
    return stageCase.data.trajectories[stageCase.data.trajectories.length - 1]
      .empiricalPercentByRound;
  }
  if (stageCase.kind === "alpha") {
    return stageCase.data.slower.empiricalPercentByRound;
  }
  return stageCase.data.empiricalPercentByRound;
}

function isDecline(values: number[]) {
  return values[values.length - 1] < values[0];
}

function stageTitle(stageCase: StageCase) {
  if (stageCase.kind === "fan") {
    return `팬차트 · ${stageCase.data.dataset} (초기 정확도 조작)`;
  }
  if (stageCase.kind === "alpha") {
    return `α 비교 · ${stageCase.data.dataset}`;
  }
  return `${stageCase.data.dataset} · ${stageCase.data.model}`;
}

function stageVerdict(stageCase: StageCase) {
  if (stageCase.kind === "fan") {
    return "시작점과 무관하게 같은 값으로 수렴 (Corollary 1)";
  }
  if (stageCase.kind === "alpha") {
    return `작은 α가 먼저 도착 — α ${stageCase.data.slower.alpha.toFixed(3)} 대비 (Corollary 2)`;
  }
  return stageCase.data.verdict;
}

const PLOT_LEFT = 90;
const PLOT_RIGHT = 600;
const PLOT_TOP = 40;
const PLOT_BOTTOM = 330;

const roundX = (round: number) =>
  PLOT_LEFT + (round / REPLAY_ROUND_COUNT) * (PLOT_RIGHT - PLOT_LEFT);

export function PredictionReplayLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction } = useScenePlayback(
    STEPS,
    containerRef,
  );
  const idPrefix = useSvgIdPrefix("prediction-replay");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;
  const glowId = `${idPrefix}-glow`;

  const [activeCaseId, setActiveCaseId] = useState("gsm8k-llama3");
  const [showClaimBoundary, setShowClaimBoundary] = useState(false);

  const stage =
    state.status === "idle"
      ? "stage-intro"
      : state.status === "completed"
        ? "handoff"
        : STEPS[state.step]?.id ?? "stage-intro";

  // Autoplay: case-* 단계가 무대 케이스를 갈아끼우고, claim-boundary 단계가
  // 3열 overlay를 켠다. setTimeout(0)은 effect 내 동기 setState를 피하기 위함.
  useEffect(() => {
    if (state.status !== "playing" || state.hasUserInteracted) return;
    const stepId = STEPS[state.step]?.id;
    const timer = window.setTimeout(() => {
      const target = stepId ? AUTOPLAY_CASE_BY_STEP[stepId] : undefined;
      if (target) setActiveCaseId(target);
      setShowClaimBoundary(stepId === "claim-boundary");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state.status, state.step, state.hasUserInteracted]);

  const fallbackCase: StageCase = SHELF_GROUPS[0].cases[0];
  const activeCase = ALL_STAGE_CASES.get(activeCaseId) ?? fallbackCase;

  const selectCase = (caseId: string) => {
    markUserInteraction();
    setActiveCaseId(caseId);
  };

  // 무대에 그릴 시리즈와 목적지 선을 케이스 종류별로 구성한다.
  const stageModel = useMemo(() => {
    if (activeCase.kind === "fan") {
      const series = activeCase.data.trajectories.map((trajectory) => ({
        key: trajectory.label,
        label: trajectory.label,
        role: "empirical" as const,
        valuesPercent: trajectory.empiricalPercentByRound,
        bandHalfWidthPercent: 0,
      }));
      return {
        series,
        uppLines: [
          { key: "upp", label: `Upp ${activeCase.data.uppPercent.toFixed(1)}%`, valuePercent: activeCase.data.uppPercent },
        ],
        insetPoints: [] as Array<{ confidenceLevel: number; critiqueScore: number }>,
      };
    }
    if (activeCase.kind === "alpha") {
      const faster =
        DATASET_CASE_BY_ID.get(activeCase.data.fasterCaseId) ??
        LLAMA3_DATASET_CASES[0];
      const { slower } = activeCase.data;
      return {
        series: [
          {
            key: faster.id,
            label: `${faster.model} · α ${faster.alpha.toFixed(3)}`,
            role: "empirical" as const,
            valuesPercent: faster.empiricalPercentByRound,
            bandHalfWidthPercent: faster.bandHalfWidthPercent,
          },
          {
            key: "slower",
            label: `${slower.model} · α ${slower.alpha.toFixed(3)}`,
            role: "empirical-alt" as const,
            valuesPercent: slower.empiricalPercentByRound,
            bandHalfWidthPercent: slower.bandHalfWidthPercent,
          },
        ],
        uppLines: [
          { key: "upp-fast", label: `Upp ${faster.uppPercent.toFixed(1)}%`, valuePercent: faster.uppPercent },
          { key: "upp-slow", label: `Upp ${slower.uppPercent.toFixed(1)}%`, valuePercent: slower.uppPercent },
        ],
        insetPoints: [
          {
            confidenceLevel: confidenceLevelFromUppAlpha(faster.uppPercent, faster.alpha),
            critiqueScore: critiqueScoreFromUppAlpha(faster.uppPercent, faster.alpha),
          },
          {
            confidenceLevel: confidenceLevelFromUppAlpha(slower.uppPercent, slower.alpha),
            critiqueScore: critiqueScoreFromUppAlpha(slower.uppPercent, slower.alpha),
          },
        ],
      };
    }
    const { data } = activeCase;
    return {
      series: [
        {
          key: `${data.id}-theory`,
          label: "이론 예측",
          role: "theory" as const,
          valuesPercent: caseTheoryPercentByRound(data),
          bandHalfWidthPercent: 0,
        },
        {
          key: `${data.id}-empirical`,
          label: "실측",
          role: "empirical" as const,
          valuesPercent: data.empiricalPercentByRound,
          bandHalfWidthPercent: data.bandHalfWidthPercent,
        },
      ],
      uppLines: [
        { key: "upp", label: `Upp ${data.uppPercent.toFixed(1)}%`, valuePercent: data.uppPercent },
      ],
      insetPoints: [
        {
          confidenceLevel: confidenceLevelFromUppAlpha(data.uppPercent, data.alpha),
          critiqueScore: critiqueScoreFromUppAlpha(data.uppPercent, data.alpha),
        },
      ],
    };
  }, [activeCase]);

  const domain = useMemo(() => {
    const values = [
      ...stageModel.series.flatMap((series) => series.valuesPercent),
      ...stageModel.uppLines.map((line) => line.valuePercent),
    ];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.12, 1.5);
    return { min: Math.max(0, min - pad), max: Math.min(100.5, max + pad) };
  }, [stageModel]);

  const valueY = (percent: number) =>
    PLOT_BOTTOM -
    ((percent - domain.min) / (domain.max - domain.min)) *
      (PLOT_BOTTOM - PLOT_TOP);

  const percentPerPixel =
    (domain.max - domain.min) / (PLOT_BOTTOM - PLOT_TOP);

  const polyline = (valuesPercent: number[]) =>
    valuesPercent
      .map((value, round) => `${roundX(round)},${valueY(value)}`)
      .join(" ");

  const formatPercent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

  const provenanceText =
    activeCase.kind === "dataset"
      ? `${activeCase.data.sourceFigure} · ${
          activeCase.data.alphaProvenance === "paper-explicit"
            ? "α 원문 명시값"
            : "α 역산 근사"
        }`
      : activeCase.kind === "alpha"
        ? `${activeCase.data.sourceFigure} · α 원문 명시값`
        : `${activeCase.data.sourceFigure} · 눈읽기 근사`;

  return (
    <div ref={containerRef} data-prediction-replay data-stage={stage}>
      <LabShell
        title="예측 리플레이"
        subtitle="이론이 먼저 긋고, 실측이 라운드마다 도착해 채점받는다"
        legend={[
          { label: "실측", tone: "accent" },
          { label: "이론 예측", tone: "neutral" },
          { label: "목적지 Upp", tone: "attention" },
        ]}
        stageLabel="라운드 1은 보정, 2~5가 예측 구간"
        controls={
          <>
            <PlaybackBar
              state={state}
              controls={controls}
              stepCount={STEPS.length}
              stepLabel={STEPS[Math.min(state.step, STEPS.length - 1)].label}
              markUserInteraction={markUserInteraction}
            />
            <button
              type="button"
              className={styles.presetButton}
              data-action="claim-boundary"
              aria-pressed={showClaimBoundary}
              onClick={() => {
                markUserInteraction();
                setShowClaimBoundary((current) => !current);
              }}
            >
              주장 경계 3열 보기
            </button>
          </>
        }
        status={[
          { label: "케이스", value: stageTitle(activeCase) },
          { label: "판정", value: stageVerdict(activeCase) },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              논문은 질문마다 응답 5개를 샘플링해 5라운드를 반복하고, 첫
              수정에서 추정한 Acc₀·CL·CS로 이후 곡선을 예측했습니다. 1라운드는
              같은 데이터로 보정된 값이므로, 예측력은 2~5라운드에서 판단합니다.
            </p>
            <table className={styles.transitionTable} data-replay-table>
              <caption>
                {stageTitle(activeCase)} — {provenanceText}
              </caption>
              <thead>
                <tr>
                  <th scope="col">시리즈</th>
                  {Array.from({ length: REPLAY_ROUND_COUNT + 1 }, (_, round) => (
                    <th key={round} scope="col">
                      r{round}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stageModel.series.map((series) => (
                  <tr key={series.key}>
                    <th scope="row">{series.label}</th>
                    {series.valuesPercent.map((value, round) => (
                      <td key={round}>{formatPercent(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              목적지:{" "}
              {stageModel.uppLines.map((line) => line.label).join(" · ")} —{" "}
              판정: <span data-replay-verdict>{stageVerdict(activeCase)}</span>
            </p>
            <p data-shelf-summary>
              데이터 선반에는 원문 그림의 곡선 {SHELF_CASE_COUNT}개 케이스가
              그룹별로 있습니다. {FIXTURE_APPROXIMATION_NOTE}
            </p>
            <div data-claim-boundary>
              <h4>직접 도출</h4>
              <ul>
                <li>고정 CL·CS 아래의 궤적과 고정점 Upp, 수렴 계수 α</li>
                <li>Upp = Acc₀에서의 손익분기와 개선·훼손 방향</li>
              </ul>
              <h4>실험이 지지</h4>
              <ul>
                <li>제한된 설정에서 상승·포화·하락 곡선 형태의 일치</li>
                <li>초기 정확도와 무관한 수렴, CL=1 보호 상승, Are you sure 하락</li>
              </ul>
              <h4>아직 미검증</h4>
              <ul>
                <li>RMSE·R²·신뢰구간 같은 정량 적합도와 광범위한 정상성</li>
                <li>5라운드 초과 반복, 현세대 frontier·tool-using Agent</li>
              </ul>
            </div>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="예측 리플레이 무대 스크롤 영역"
        >
          <svg
            className="viz-svg viz-compact"
            viewBox="0 0 680 470"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>논문 실측 곡선의 예측 리플레이 무대</title>
            <desc id={descId}>
              선택한 케이스의 목적지 Upp 수평선, 보정 구간, 이론 예측 곡선
              위로 실측 점이 라운드 순서대로 착지하는 모습을 보여 준다.
            </desc>
            <defs>
              <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
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

            {/* 보정/예측 구간 */}
            <rect
              className={styles.replayCalibration}
              x={roundX(0)}
              y={PLOT_TOP}
              width={roundX(1) - roundX(0)}
              height={PLOT_BOTTOM - PLOT_TOP}
            />
            <text className={styles.replayZoneLabel} x={(roundX(0) + roundX(1)) / 2} y={PLOT_TOP - 10} textAnchor="middle">
              보정
            </text>
            <text
              className={styles.replayZoneLabel}
              data-zone="prediction"
              x={(roundX(1) + roundX(REPLAY_ROUND_COUNT)) / 2}
              y={PLOT_TOP - 10}
              textAnchor="middle"
            >
              예측
            </text>

            {/* 축 */}
            <line className={styles.replayAxis} x1={PLOT_LEFT} y1={PLOT_BOTTOM} x2={PLOT_RIGHT} y2={PLOT_BOTTOM} />
            {Array.from({ length: REPLAY_ROUND_COUNT + 1 }, (_, round) => (
              <text
                key={round}
                className={styles.mapAxisTick}
                x={roundX(round)}
                y={PLOT_BOTTOM + 20}
                textAnchor="middle"
              >
                {round}
              </text>
            ))}
            <text className={styles.mapAxisLabel} x={(PLOT_LEFT + PLOT_RIGHT) / 2} y={PLOT_BOTTOM + 40} textAnchor="middle">
              self-correction round
            </text>
            <text className={styles.mapAxisTick} x={PLOT_LEFT - 10} y={PLOT_TOP + 4} textAnchor="end">
              {formatPercent(domain.max, 0)}
            </text>
            <text className={styles.mapAxisTick} x={PLOT_LEFT - 10} y={PLOT_BOTTOM + 4} textAnchor="end">
              {formatPercent(domain.min, 0)}
            </text>

            {/* 케이스별 무대 — key로 착지 애니메이션을 케이스 전환마다 재시작 */}
            <g key={activeCase.id}>
              {stageModel.uppLines.map((line) => (
                <g key={line.key}>
                  <line
                    className={styles.replayUpp}
                    x1={PLOT_LEFT}
                    y1={valueY(line.valuePercent)}
                    x2={PLOT_RIGHT}
                    y2={valueY(line.valuePercent)}
                    filter={`url(#${glowId})`}
                  />
                  <text
                    className={styles.replayUppLabel}
                    x={PLOT_RIGHT}
                    y={valueY(line.valuePercent) - 8}
                    textAnchor="end"
                  >
                    {line.label}
                  </text>
                </g>
              ))}

              {stageModel.series.map((series, seriesIndex) => (
                <g key={series.key} className={styles.replaySeries} data-role={series.role}>
                  <polyline
                    className={styles.replayLine}
                    points={polyline(series.valuesPercent)}
                    pathLength={1}
                  />
                  {series.role !== "theory"
                    ? series.valuesPercent.map((value, round) => {
                        const haloRadius = Math.max(
                          6,
                          series.bandHalfWidthPercent / percentPerPixel,
                        );
                        return (
                          <g
                            key={round}
                            className={styles.replayDot}
                            style={{
                              animationDelay: `${0.3 + round * 0.28 + seriesIndex * 0.1}s`,
                            }}
                          >
                            {series.bandHalfWidthPercent > 0 ? (
                              <circle
                                className={styles.replayHalo}
                                cx={roundX(round)}
                                cy={valueY(value)}
                                r={haloRadius}
                              />
                            ) : null}
                            <circle
                              className={styles.replayMark}
                              cx={roundX(round)}
                              cy={valueY(value)}
                              r="5"
                            />
                          </g>
                        );
                      })
                    : null}
                  {series.role !== "empirical" || stageModel.series.length > 2 ? (
                    <text
                      className={styles.replaySeriesLabel}
                      x={roundX(REPLAY_ROUND_COUNT) + 6}
                      y={valueY(series.valuesPercent[REPLAY_ROUND_COUNT]) + 4}
                    >
                      {series.label}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>

            {/* 미니 수렴 지도 inset — 이 케이스가 조건 공간 어디에 있는가 */}
            {stageModel.insetPoints.length > 0 ? (
              <g className={styles.replayInset} aria-hidden="true">
                <rect className={styles.mapField} x={92} y={372} width={84} height={84} rx="4" />
                <line
                  className={styles.mapContour}
                  x1={92 + 84}
                  y1={372 + 84}
                  x2={92 + (1 - 1 / 9) * 84}
                  y2={372}
                />
                {stageModel.insetPoints.map((point, index) => (
                  <circle
                    key={index}
                    className={styles.insetPoint}
                    cx={92 + point.confidenceLevel * 84}
                    cy={372 + (1 - point.critiqueScore) * 84}
                    r="4"
                  />
                ))}
                <text className={styles.mapAxisTick} x={92 + 42} y={372 + 84 + 14} textAnchor="middle">
                  수렴 지도 위 위치
                </text>
              </g>
            ) : null}
            <text className={styles.replayProvenance} x={PLOT_RIGHT} y={452} textAnchor="end">
              {provenanceText} · 눈읽기 근사 포함
            </text>
          </svg>
        </div>

        {showClaimBoundary ? (
          <div className={styles.claimBoundary} data-claim-overlay>
            <div data-claim-column="direct">
              <h4>직접 도출</h4>
              <p>고정 CL·CS 아래의 궤적·Upp·α와 손익분기.</p>
            </div>
            <div data-claim-column="supported">
              <h4>실험이 지지</h4>
              <p>상승·포화·하락 형태, 시작점 무관 수렴, CL=1, Are you sure.</p>
            </div>
            <div data-claim-column="unverified">
              <h4>아직 미검증</h4>
              <p>정량 적합도, 광범위 정상성, 5라운드 초과, tool-using Agent.</p>
            </div>
          </div>
        ) : null}

        <div className={styles.shelf} aria-label="논문 데이터 선반">
          {SHELF_GROUPS.map((group) => (
            <div key={group.id} className={styles.shelfGroup}>
              <h4>{group.label}</h4>
              <div className={styles.shelfChips} role="group" aria-label={group.label}>
                {group.cases.map((stageCase) => {
                  const values = chipValues(stageCase);
                  const min = Math.min(...values);
                  const max = Math.max(...values);
                  const span = Math.max(max - min, 0.001);
                  const sparkline = values
                    .map(
                      (value, round) =>
                        `${(round / REPLAY_ROUND_COUNT) * 40},${14 - ((value - min) / span) * 12}`,
                    )
                    .join(" ");
                  return (
                    <button
                      key={stageCase.id}
                      type="button"
                      className={styles.shelfChip}
                      data-case-id={stageCase.id}
                      aria-pressed={stageCase.id === activeCase.id}
                      onClick={() => selectCase(stageCase.id)}
                    >
                      <svg viewBox="0 0 40 16" aria-hidden="true" focusable="false">
                        <polyline points={sparkline} />
                      </svg>
                      <span>
                        {chipLabel(stageCase)}
                        {isDecline(values) ? " ↓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </LabShell>
    </div>
  );
}
