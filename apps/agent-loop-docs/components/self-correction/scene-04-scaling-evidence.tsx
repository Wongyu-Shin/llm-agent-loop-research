"use client";

import { useMemo, useRef, useState } from "react";

import {
  LabShell,
  SegmentedControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import {
  convergenceAlpha,
  stationaryTrajectory,
  stationaryUpperBound,
} from "./paper-model";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./paper-scenes.module.css";

const STEPS: PlaybackStep[] = [
  { id: "trajectory", durationMs: 16000, label: "세 초기 정확도 궤적" },
  { id: "experiment", durationMs: 10000, label: "첫 전이에서 이후 라운드 예측" },
  { id: "claim-boundary", durationMs: 10000, label: "주장 강도의 세 열" },
  { id: "part-end", durationMs: 4000, label: "Part I 종료" },
];

type ViewMode = "trajectory" | "experiment" | "claim-boundary";

const CONFIDENCE_LEVEL = 0.9;
const CRITIQUE_SCORE = 0.2;
const ROUNDS = 5;

const CURVES = [
  { id: "below", label: "Acc₀ < Upp", initial: 0.3, tone: "good" },
  { id: "equal", label: "Acc₀ = Upp", initial: 2 / 3, tone: "neutral" },
  { id: "above", label: "Acc₀ > Upp", initial: 0.9, tone: "danger" },
] as const;

const EXPERIMENT_STAGES = [
  {
    id: "sample",
    title: "샘플링",
    detail: "질문마다 응답 5개를 독립적으로 샘플링",
  },
  {
    id: "estimate",
    title: "추정",
    detail: "첫 전이에서 Acc₀, CL, CS 추정",
  },
  {
    id: "predict",
    title: "예측",
    detail: "같은 값을 고정해 2~5라운드 이론 곡선 계산",
  },
  {
    id: "compare",
    title: "비교",
    detail: "실제 곡선과 상승·포화·하락 형태 비교",
  },
] as const;

const CLAIM_COLUMNS = [
  {
    id: "derived",
    title: "직접 도출",
    provenance: "수학",
    items: [
      "고정 CL·CS 아래 궤적과 고정점의 정확한 계산",
      "Upp = CS ÷ (1 − CL + CS), α = CL − CS",
      "한 라운드 손익분기 CLₜ 공식",
    ],
  },
  {
    id: "supported",
    title: "실험이 지지",
    provenance: "관찰",
    items: [
      "제한된 설정에서 이론 곡선과 실제 곡선의 형태 일치",
      "Llama3-8B에서 5라운드 동안 CL·CS가 대체로 안정",
      "Are you sure 프롬프트의 하락 사례 설명",
    ],
  },
  {
    id: "unverified",
    title: "아직 미검증",
    provenance: "한계",
    items: [
      "8모델 × 8데이터셋 64개 조합 전체",
      "RMSE · R² · 신뢰구간 같은 정량 적합도",
      "5라운드 이후의 stationarity",
      "모든 최신 agent에 통하는 장기 법칙",
    ],
  },
] as const;

const CHART = { x0: 84, y0: 296, width: 500, height: 244 };

function chartX(round: number) {
  return CHART.x0 + (round / ROUNDS) * CHART.width;
}

function chartY(accuracy: number) {
  return CHART.y0 - accuracy * CHART.height;
}

/**
 * Scene 4 primary visual (wireframe §6). Three views: stationary
 * trajectories converging to the same Upp, the paper's estimate-then-
 * predict procedure, and the claim-strength boundary columns.
 */
export function ScalingEvidenceExplorer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction } = useScenePlayback(
    STEPS,
    containerRef,
  );
  const idPrefix = useSvgIdPrefix("scaling-evidence");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const [userView, setUserView] = useState<ViewMode | null>(null);

  // Autoplay drives the visible view until the user picks one explicitly.
  const stepId = STEPS[Math.min(state.step, STEPS.length - 1)].id;
  const autoView: ViewMode =
    state.status === "idle" || stepId === "part-end"
      ? state.status === "idle"
        ? "trajectory"
        : "claim-boundary"
      : (stepId as ViewMode);
  const view = userView ?? autoView;

  const upp = stationaryUpperBound(CONFIDENCE_LEVEL, CRITIQUE_SCORE);
  const alpha = convergenceAlpha(CONFIDENCE_LEVEL, CRITIQUE_SCORE);
  const trajectories = useMemo(
    () =>
      CURVES.map((curve) => ({
        ...curve,
        points: stationaryTrajectory(
          curve.initial,
          CONFIDENCE_LEVEL,
          CRITIQUE_SCORE,
          ROUNDS,
        ),
      })),
    [],
  );

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div ref={containerRef} data-scaling-evidence data-view={view}>
      <LabShell
        title="반복 궤적과 근거의 경계"
        subtitle="Accₜ = Upp − αᵗ × (Upp − Acc₀) · CL 0.90 · CS 0.20"
        legend={[
          { label: "Acc₀ < Upp", tone: "success" },
          { label: "Acc₀ = Upp", tone: "neutral" },
          { label: "Acc₀ > Upp", tone: "danger" },
        ]}
        stageLabel={`Upp ${upp === null ? "정의 안 됨" : formatPercent(upp)} · α ${alpha.toFixed(2)}`}
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
              label="view"
              value={view}
              options={[
                { value: "trajectory", label: "trajectory" },
                { value: "experiment", label: "experiment" },
                { value: "claim-boundary", label: "claim-boundary" },
              ]}
              onChange={(value) => {
                markUserInteraction();
                setUserView(value);
              }}
            />
          </>
        }
        status={[
          {
            label: "고정점",
            value: upp === null ? "정의 안 됨" : `Upp ${formatPercent(upp)}`,
          },
          { label: "수렴 계수", value: `α ${alpha.toFixed(2)}` },
          { label: "적용 범위", value: "논문 데이터와 절차만큼" },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              세 곡선의 라운드별 Accₜ 값입니다. 같은 Upp를 향해 편차가 라운드마다
              α배로 줄어듭니다. 빠른 수렴이 높은 정확도를 뜻하지 않습니다.
            </p>
            <table className={styles.transitionTable} data-trajectory-table>
              <caption>
                라운드별 Accₜ · CL 0.90, CS 0.20, Upp{" "}
                {upp === null ? "-" : formatPercent(upp)}, α {alpha.toFixed(2)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">round</th>
                  {trajectories.map((curve) => (
                    <th key={curve.id} scope="col">
                      {curve.label} · 시작 {formatPercent(curve.initial)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: ROUNDS + 1 }, (_, round) => (
                  <tr key={round}>
                    <th scope="row">{round}</th>
                    {trajectories.map((curve) => (
                      <td key={curve.id}>
                        {formatPercent(curve.points[round].accuracy)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <table className={styles.transitionTable} data-experiment-table>
              <caption>논문의 실험 절차 (§3)</caption>
              <tbody>
                <tr>
                  <th scope="row">응답</th>
                  <td>질문마다 5개 응답을 독립적으로 샘플링</td>
                </tr>
                <tr>
                  <th scope="row">반복</th>
                  <td>각 응답에 5회의 자기수정 라운드</td>
                </tr>
                <tr>
                  <th scope="row">모형 추정</th>
                  <td>첫 전이에서 Acc₀, CL, CS 추정</td>
                </tr>
                <tr>
                  <th scope="row">예측</th>
                  <td>같은 값을 고정해 2~5라운드 정확도 궤적 계산</td>
                </tr>
                <tr>
                  <th scope="row">비교</th>
                  <td>실제 곡선과 이론 곡선의 상승·포화·하락 형태 비교</td>
                </tr>
                <tr>
                  <th scope="row">범위</th>
                  <td>8개 모델과 8개 데이터셋, 64개 조합 전체는 아님</td>
                </tr>
              </tbody>
            </table>
            <div data-claim-lists>
              {CLAIM_COLUMNS.map((column) => (
                <section key={column.id}>
                  <h4>{column.title}</h4>
                  <ul>
                    {column.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="반복 궤적과 근거 경계 시각화 스크롤 영역"
        >
          <svg
            className="viz-svg"
            viewBox="0 0 680 380"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>반복 궤적, 실험 절차, 주장 경계</title>
            <desc id={descId}>
              trajectory 보기에서는 같은 Upp를 향해 수렴하는 세 곡선을,
              experiment 보기에서는 첫 전이 추정으로 이후 라운드를 예측하는
              절차를, claim-boundary 보기에서는 직접 도출과 실험 지지와 미검증
              주장의 세 열을 보여 준다.
            </desc>

            {view === "trajectory" ? (
              <g>
                {/* Axes */}
                <line className={styles.chartAxis} x1={CHART.x0} y1={chartY(0)} x2={CHART.x0} y2={chartY(1)} />
                <line className={styles.chartAxis} x1={CHART.x0} y1={chartY(0)} x2={chartX(ROUNDS)} y2={chartY(0)} />
                {Array.from({ length: ROUNDS + 1 }, (_, round) => (
                  <text
                    key={round}
                    className={styles.chartTick}
                    x={chartX(round)}
                    y={chartY(0) + 22}
                    textAnchor="middle"
                  >
                    {round}
                  </text>
                ))}
                <text className={styles.chartTick} x={CHART.x0 - 12} y={chartY(1) + 4} textAnchor="end">
                  100%
                </text>
                <text className={styles.chartTick} x={CHART.x0 - 12} y={chartY(0) + 4} textAnchor="end">
                  0%
                </text>
                <text className={styles.chartAxisLabel} x={chartX(2.5)} y={chartY(0) + 44} textAnchor="middle">
                  자기수정 round
                </text>

                {/* Upp line */}
                {upp !== null ? (
                  <g>
                    <line
                      className={styles.uppLine}
                      x1={CHART.x0}
                      y1={chartY(upp)}
                      x2={chartX(ROUNDS)}
                      y2={chartY(upp)}
                    />
                    <text
                      className={styles.uppLabel}
                      x={chartX(ROUNDS) + 10}
                      y={chartY(upp) + 4}
                    >
                      Upp {formatPercent(upp)}
                    </text>
                  </g>
                ) : null}

                {/* Curves */}
                {trajectories.map((curve) => (
                  <g key={curve.id} data-curve={curve.id}>
                    <polyline
                      className={styles.trajectoryLine}
                      data-tone={curve.tone}
                      points={curve.points
                        .map((point) => `${chartX(point.round)},${chartY(point.accuracy)}`)
                        .join(" ")}
                    />
                    {curve.points.map((point) => (
                      <circle
                        key={point.round}
                        className={styles.trajectoryDot}
                        data-tone={curve.tone}
                        cx={chartX(point.round)}
                        cy={chartY(point.accuracy)}
                        r="4.5"
                      />
                    ))}
                    <text
                      className={styles.curveLabel}
                      data-tone={curve.tone}
                      x={chartX(0) - 8}
                      y={chartY(curve.initial) + 4}
                      textAnchor="end"
                    >
                      Acc₀ {formatPercent(curve.initial)}
                    </text>
                  </g>
                ))}

                {/* α shrink annotation between round 0→1→2 on the below curve */}
                <text className={styles.alphaNote} x={chartX(0.55)} y={chartY(0.53)}>
                  편차 × α
                </text>
              </g>
            ) : null}

            {view === "experiment" ? (
              <g>
                {EXPERIMENT_STAGES.map((stageItem, index) => (
                  <g
                    key={stageItem.id}
                    className={styles.procedureStage}
                    style={{ animationDelay: `${index * 0.6}s` }}
                  >
                    <rect x={48 + index * 156} y="120" width="140" height="110" rx="12" />
                    <text className={styles.procedureIndex} x={62 + index * 156} y="148">
                      {index + 1}
                    </text>
                    <text className={styles.procedureTitle} x={62 + index * 156} y="174">
                      {stageItem.title}
                    </text>
                    <foreignObject x={58 + index * 156} y="182" width="124" height="44">
                      <p className={styles.procedureDetail}>{stageItem.detail}</p>
                    </foreignObject>
                    {index < EXPERIMENT_STAGES.length - 1 ? (
                      <path
                        className={styles.procedureArrow}
                        d={`M${190 + index * 156} 175 h10 l-4 -5 m4 5 l-4 5`}
                      />
                    ) : null}
                  </g>
                ))}
                <text className={styles.procedureCaveat} x="340" y="290" textAnchor="middle">
                  Acc₁은 같은 전이 데이터에 맞춰지므로 예측력 판단은 2회차 이후에서
                </text>
                <text className={styles.procedureCaveat} x="340" y="316" textAnchor="middle">
                  RMSE · R² · 신뢰구간은 보고되지 않음
                </text>
              </g>
            ) : null}

            {view === "claim-boundary" ? (
              <g>
                {CLAIM_COLUMNS.map((column, columnIndex) => (
                  <g key={column.id} className={styles.claimColumn} data-column={column.id}>
                    <rect x={40 + columnIndex * 208} y="52" width="192" height="292" rx="12" />
                    <text className={styles.claimTitle} x={56 + columnIndex * 208} y="86">
                      {column.title}
                    </text>
                    <text className={styles.claimProvenance} x={56 + columnIndex * 208} y="108">
                      {column.provenance}
                    </text>
                    {column.items.map((item, itemIndex) => (
                      <foreignObject
                        key={item}
                        x={52 + columnIndex * 208}
                        y={122 + itemIndex * 54}
                        width="170"
                        height="52"
                      >
                        <p className={styles.claimItem}>{item}</p>
                      </foreignObject>
                    ))}
                  </g>
                ))}
              </g>
            ) : null}
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
