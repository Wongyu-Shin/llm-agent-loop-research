"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  LabShell,
  RangeControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import {
  FIXTURE_APPROXIMATION_NOTE,
  improvementAreaFraction,
  llama3GridPoints,
  type GridPoint,
} from "./paper-figures-fixture";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./paper-scenes.module.css";

const STEPS: PlaybackStep[] = [
  { id: "fan-reveal", durationMs: 6000, label: "등고선 전개와 영역 구분" },
  { id: "points-land", durationMs: 6000, label: "실측 8점 착지" },
  { id: "boundary-sweep", durationMs: 12000, label: "Acc₀ 50→99% 경계선 스윕" },
  { id: "corner-hold", durationMs: 4000, label: "CL=1 탈출구 강조" },
];

type PresetId = "llama3-observed" | "acc0-99" | "oracle-edge";

const PRESETS: Record<
  PresetId,
  { label: string; accuracy0: number; oracleEdge: boolean }
> = {
  "llama3-observed": { label: "관측 배치 (Acc₀ 70%)", accuracy0: 0.7, oracleEdge: false },
  "acc0-99": { label: "시작 99%", accuracy0: 0.99, oracleEdge: false },
  "oracle-edge": { label: "탈출구 CL=1", accuracy0: 0.99, oracleEdge: true },
};

/** 목적지 등고선으로 보여줄 Upp 값들. */
const CONTOUR_TARGETS = [0.5, 0.75, 0.9, 0.99];

const SWEEP_FROM = 0.5;
const SWEEP_TO = 0.99;

const MAP_LEFT = 70;
const MAP_TOP = 30;
const MAP_SIZE = 380;
const GAUGE_X = 560;

const mapX = (confidenceLevel: number) => MAP_LEFT + confidenceLevel * MAP_SIZE;
const mapY = (critiqueScore: number) => MAP_TOP + (1 - critiqueScore) * MAP_SIZE;
const gaugeY = (accuracy: number) => MAP_TOP + (1 - accuracy) * MAP_SIZE;

/** Upp=c 등고선이 CS=1 상단 변과 만나는 CL. c ≥ 0.5에서 k ≥ 1이 보장된다. */
function contourTopConfidenceLevel(uppTarget: number) {
  const slope = uppTarget / (1 - uppTarget);
  return 1 - 1 / slope;
}

export function ConvergenceMapLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction, reachedStep } = useScenePlayback(
    STEPS,
    containerRef,
  );
  const idPrefix = useSvgIdPrefix("convergence-map");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;
  const glowId = `${idPrefix}-glow`;
  const hatchId = `${idPrefix}-hatch`;

  const points = useMemo(() => llama3GridPoints(), []);

  const [accuracy0, setAccuracy0] = useState(PRESETS["llama3-observed"].accuracy0);
  const [committedAccuracy0, setCommittedAccuracy0] = useState(
    PRESETS["llama3-observed"].accuracy0,
  );
  const [selectedCaseId, setSelectedCaseId] = useState(points[0].caseId);
  const [oracleEdge, setOracleEdge] = useState(false);

  const stage =
    state.status === "idle"
      ? "fan-reveal"
      : state.status === "completed"
        ? "corner-hold"
        : STEPS[state.step]?.id ?? "fan-reveal";

  // Autoplay choreography: boundary-sweep drives Acc₀ from 50% to 99% so the
  // improvement wedge collapses on screen; corner-hold pins the oracle edge.
  useEffect(() => {
    if (state.status !== "playing" || state.hasUserInteracted) return;
    const stepId = STEPS[state.step]?.id;
    if (stepId === "boundary-sweep") {
      const startedAt = performance.now();
      const durationMs = STEPS[2].durationMs / state.speed;
      const timer = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
        const value = SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * progress;
        setAccuracy0(value);
        setCommittedAccuracy0(value);
        if (progress >= 1) window.clearInterval(timer);
      }, 120);
      return () => window.clearInterval(timer);
    }
    if (stepId === "corner-hold") {
      const timer = window.setTimeout(() => {
        setAccuracy0(SWEEP_TO);
        setCommittedAccuracy0(SWEEP_TO);
        setOracleEdge(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [state.status, state.step, state.speed, state.hasUserInteracted]);

  const selectedPoint =
    points.find((point) => point.caseId === selectedCaseId) ?? points[0];
  const selectedUppFraction = selectedPoint.uppPercent / 100;

  const litCount = points.filter(
    (point) => point.uppPercent / 100 > accuracy0,
  ).length;
  const areaFraction = improvementAreaFraction(accuracy0);
  const committedAreaFraction = improvementAreaFraction(committedAccuracy0);

  const formatPercent = (value: number, digits = 1) =>
    `${(value * 100).toFixed(digits)}%`;
  const formatArea = (fraction: number) =>
    fraction >= 0.1 ? formatPercent(fraction, 0) : formatPercent(fraction, 1);

  const directionFor = (point: GridPoint) =>
    point.uppPercent / 100 > accuracy0 ? "개선" : "훼손";

  const interact = (updater: () => void) => {
    markUserInteraction();
    updater();
  };
  const commit = () => {
    setCommittedAccuracy0(accuracy0);
  };
  const applyPreset = (id: PresetId) => {
    const preset = PRESETS[id];
    markUserInteraction();
    setAccuracy0(preset.accuracy0);
    setCommittedAccuracy0(preset.accuracy0);
    setOracleEdge(preset.oracleEdge);
  };

  // 경계선(Upp = Acc₀): 기울기 k에 따라 상단 변 또는 좌측 변과 만난다.
  const boundarySlope = accuracy0 / (1 - accuracy0);
  const boundaryEnd =
    boundarySlope >= 1
      ? { x: mapX(1 - 1 / boundarySlope), y: mapY(1) }
      : { x: mapX(0), y: mapY(boundarySlope) };
  const cornerX = mapX(1);
  const cornerY = mapY(0);
  const gainPolygon =
    boundarySlope >= 1
      ? `${cornerX},${cornerY} ${boundaryEnd.x},${boundaryEnd.y} ${mapX(1)},${mapY(1)}`
      : `${cornerX},${cornerY} ${boundaryEnd.x},${boundaryEnd.y} ${mapX(0)},${mapY(1)} ${mapX(1)},${mapY(1)}`;

  const pointsVisible = state.status === "idle" || reachedStep("points-land");

  return (
    <div
      ref={containerRef}
      data-convergence-map
      data-stage={stage}
      data-lit-count={litCount}
      data-oracle-edge={oracleEdge || undefined}
      onPointerUp={commit}
      onKeyUp={commit}
      onTouchEnd={commit}
    >
      <LabShell
        title="수렴 지도"
        subtitle="CL × CS 조건 공간 — 어떤 조합이 어디로 수렴하는가"
        legend={[
          { label: "개선 구간", tone: "success" },
          { label: "훼손 구간(소등)", tone: "neutral" },
          { label: "실측 데이터셋", tone: "accent" },
          { label: "목적지 등고선", tone: "attention" },
        ]}
        stageLabel="경계선 Upp = Acc₀이 개선과 훼손을 가른다"
        controls={
          <>
            <PlaybackBar
              state={state}
              controls={controls}
              stepCount={STEPS.length}
              stepLabel={STEPS[Math.min(state.step, STEPS.length - 1)].label}
              markUserInteraction={markUserInteraction}
            />
            <div className={styles.presetRow} role="group" aria-label="preset">
              {(Object.keys(PRESETS) as PresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.presetButton}
                  data-preset={id}
                  onClick={() => applyPreset(id)}
                >
                  {PRESETS[id].label}
                </button>
              ))}
            </div>
            <RangeControl
              id="map-accuracy0"
              label="Acc₀ · 현재(시작) 정확도"
              value={accuracy0}
              min={0.05}
              max={0.995}
              step={0.005}
              valueLabel={formatPercent(accuracy0)}
              onChange={(value) =>
                interact(() => {
                  setAccuracy0(value);
                  setOracleEdge(false);
                })
              }
            />
          </>
        }
        status={[
          { label: "개선 조합 넓이", value: formatArea(committedAreaFraction) },
          {
            label: "선택 데이터셋",
            value: `${selectedPoint.dataset} → Upp ${selectedPoint.uppPercent.toFixed(1)}% · ${
              selectedUppFraction > committedAccuracy0 ? "개선" : "훼손"
            }`,
          },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              목적지 Upp = c인 (CL, CS) 조합은 (CL=1, CS=0) 모서리를 지나는
              직선이며, 개선 경계선은 Upp = Acc₀ 등고선입니다. 현재 Acc₀{" "}
              {formatPercent(accuracy0)}에서 개선 조합의 넓이는{" "}
              <output data-improvement-area>{formatArea(areaFraction)}</output>
              입니다.
            </p>
            <table className={styles.transitionTable} data-area-table>
              <caption>기대별 (CL, CS) 조합 넓이</caption>
              <tbody>
                <tr>
                  <th scope="row">목적지 90% 이상</th>
                  <td>{formatArea(improvementAreaFraction(0.9))}</td>
                </tr>
                <tr>
                  <th scope="row">목적지 95% 이상</th>
                  <td>{formatArea(improvementAreaFraction(0.95))}</td>
                </tr>
                <tr>
                  <th scope="row">Acc₀ 50%에서 개선</th>
                  <td>{formatArea(improvementAreaFraction(0.5))}</td>
                </tr>
                <tr>
                  <th scope="row">Acc₀ 99%에서 개선</th>
                  <td>{formatArea(improvementAreaFraction(0.99))}</td>
                </tr>
              </tbody>
            </table>
            <table className={styles.transitionTable} data-grid-points>
              <caption>
                Llama3-8B 실측 8점 (논문 Figure 1·2 눈읽기 근사, CL·CS는 Upp·α
                역산값)
              </caption>
              <thead>
                <tr>
                  <th scope="col">데이터셋</th>
                  <th scope="col">CL</th>
                  <th scope="col">CS</th>
                  <th scope="col">Upp</th>
                  <th scope="col">현재 방향</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.caseId}>
                    <th scope="row">{point.dataset}</th>
                    <td>{formatPercent(point.confidenceLevel)}</td>
                    <td>{formatPercent(point.critiqueScore)}</td>
                    <td>{point.uppPercent.toFixed(1)}%</td>
                    <td>{directionFor(point)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>{FIXTURE_APPROXIMATION_NOTE}</p>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="수렴 지도와 목적지 게이지 스크롤 영역"
        >
          <svg
            className="viz-svg viz-compact"
            viewBox="0 0 680 460"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>CL과 CS 조건 공간의 수렴 지도</title>
            <desc id={descId}>
              목적지 등고선이 CL 1, CS 0 모서리에서 방사되고, Acc₀ 경계선이
              개선 영역과 훼손 영역을 가르며, Llama3-8B 실측 8점의 점등
              여부와 목적지 게이지를 보여 준다.
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
              <pattern
                id={hatchId}
                width="8"
                height="8"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="8" className={styles.mapHatchLine} />
              </pattern>
            </defs>

            {/* 지도 바탕: 훼손(소등) 빗금 위에 개선 영역을 점등한다 */}
            <rect
              className={styles.mapField}
              x={MAP_LEFT}
              y={MAP_TOP}
              width={MAP_SIZE}
              height={MAP_SIZE}
              rx="6"
            />
            <rect
              x={MAP_LEFT}
              y={MAP_TOP}
              width={MAP_SIZE}
              height={MAP_SIZE}
              fill={`url(#${hatchId})`}
              opacity="0.5"
            />
            <polygon className={styles.mapGainRegion} points={gainPolygon} />

            {/* 목적지 등고선 부챗살 */}
            <g>
              {CONTOUR_TARGETS.map((target) => {
                const topX = mapX(contourTopConfidenceLevel(target));
                return (
                  <g key={target}>
                    <line
                      className={styles.mapContour}
                      x1={cornerX}
                      y1={cornerY}
                      x2={topX}
                      y2={mapY(1)}
                    />
                    <text
                      className={styles.mapContourLabel}
                      x={Math.min(topX, mapX(1) - 8)}
                      y={mapY(1) - 8}
                      textAnchor={target >= 0.99 ? "end" : "middle"}
                    >
                      {Math.round(target * 100)}%
                    </text>
                  </g>
                );
              })}
            </g>

            {/* 경계선 Upp = Acc₀ */}
            <g filter={`url(#${glowId})`}>
              <line
                className={styles.mapBoundary}
                x1={cornerX}
                y1={cornerY}
                x2={boundaryEnd.x}
                y2={boundaryEnd.y}
              />
            </g>
            <text
              className={styles.mapBoundaryLabel}
              x={Math.max(boundaryEnd.x, MAP_LEFT + 8)}
              y={Math.max(boundaryEnd.y - 10, MAP_TOP + 14)}
            >
              경계선 Upp = {formatPercent(accuracy0)}
            </text>

            {/* CL=1 탈출구 변 */}
            <line
              className={styles.mapOracleEdge}
              data-active={oracleEdge || undefined}
              x1={cornerX}
              y1={cornerY}
              x2={mapX(1)}
              y2={mapY(1)}
            />
            {oracleEdge ? (
              <text
                className={styles.mapOracleLabel}
                x={mapX(1) - 6}
                y={mapY(1) + 62}
                textAnchor="end"
              >
                CL=1 변: CS가 조금만 있어도 Upp=100%
              </text>
            ) : null}

            {/* 실측 8점 */}
            <g data-points-visible={pointsVisible}>
              {points.map((point, index) => {
                const lit = point.uppPercent / 100 > accuracy0;
                const cx = mapX(point.confidenceLevel);
                const cy = mapY(point.critiqueScore);
                const selected = point.caseId === selectedCaseId;
                return (
                  <g
                    key={point.caseId}
                    className={styles.mapPoint}
                    data-lit={lit}
                    data-selected={selected || undefined}
                    data-visible={pointsVisible}
                    style={{ transitionDelay: pointsVisible ? `${index * 0.35}s` : "0s" }}
                  >
                    {lit ? (
                      <circle
                        className={styles.mapPointGlow}
                        cx={cx}
                        cy={cy}
                        r="9"
                        filter={`url(#${glowId})`}
                      />
                    ) : null}
                    <circle className={styles.mapPointDot} cx={cx} cy={cy} r="6" />
                    {/* viz-compact는 390px에서 620/680≈0.91로 축소 렌더되므로
                        52단위로 렌더 44px 이상을 보장한다 */}
                    <rect
                      x={cx - 26}
                      y={cy - 26}
                      width="52"
                      height="52"
                      className={styles.mapPointHit}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={`${point.dataset}: CL ${formatPercent(point.confidenceLevel)}, CS ${formatPercent(point.critiqueScore)}, 목적지 Upp ${point.uppPercent.toFixed(1)}%, 현재 ${directionFor(point)} 구간`}
                      onClick={() =>
                        interact(() => setSelectedCaseId(point.caseId))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          interact(() => setSelectedCaseId(point.caseId));
                        }
                      }}
                    />
                  </g>
                );
              })}
            </g>

            {/* 축 라벨 */}
            <text className={styles.mapAxisLabel} x={mapX(0.5)} y={mapY(0) + 34} textAnchor="middle">
              CL · 정답 보존율 →
            </text>
            <text
              className={styles.mapAxisLabel}
              x={MAP_LEFT - 40}
              y={mapY(0.5)}
              textAnchor="middle"
              transform={`rotate(-90 ${MAP_LEFT - 40} ${mapY(0.5)})`}
            >
              CS · 오답 복구율 →
            </text>
            <text className={styles.mapAxisTick} x={MAP_LEFT} y={mapY(0) + 16} textAnchor="middle">
              0
            </text>
            <text className={styles.mapAxisTick} x={mapX(1)} y={mapY(0) + 16} textAnchor="middle">
              1
            </text>

            {/* 목적지 게이지 */}
            <g aria-hidden="true">
              <text className={styles.mapAxisLabel} x={GAUGE_X} y={MAP_TOP - 10} textAnchor="middle">
                목적지 게이지
              </text>
              <line
                className={styles.gaugeTrack}
                x1={GAUGE_X}
                y1={gaugeY(1)}
                x2={GAUGE_X}
                y2={gaugeY(0)}
              />
              {[0, 0.5, 1].map((tick) => (
                <text
                  key={tick}
                  className={styles.mapAxisTick}
                  x={GAUGE_X + 16}
                  y={gaugeY(tick) + 4}
                >
                  {Math.round(tick * 100)}%
                </text>
              ))}
              <line
                className={styles.gaugeAccMarker}
                x1={GAUGE_X - 14}
                y1={gaugeY(accuracy0)}
                x2={GAUGE_X + 8}
                y2={gaugeY(accuracy0)}
              />
              <text
                className={styles.gaugeAccLabel}
                x={GAUGE_X - 18}
                y={gaugeY(accuracy0) + 4}
                textAnchor="end"
              >
                Acc₀
              </text>
              <line
                className={styles.gaugeUppMarker}
                x1={GAUGE_X - 14}
                y1={gaugeY(oracleEdge ? 1 : selectedUppFraction)}
                x2={GAUGE_X + 8}
                y2={gaugeY(oracleEdge ? 1 : selectedUppFraction)}
                filter={`url(#${glowId})`}
              />
              <text
                className={styles.gaugeUppLabel}
                x={GAUGE_X - 18}
                y={gaugeY(oracleEdge ? 1 : selectedUppFraction) - 8}
                textAnchor="end"
              >
                Upp
              </text>
              <circle
                className={styles.gaugePulse}
                cx={GAUGE_X}
                r="5"
                style={
                  {
                    "--pulse-from": `${gaugeY(accuracy0)}px`,
                    "--pulse-to": `${gaugeY(oracleEdge ? 1 : selectedUppFraction)}px`,
                  } as CSSProperties
                }
              />
            </g>
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
