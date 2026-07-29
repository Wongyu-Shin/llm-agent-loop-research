"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  LabShell,
  RangeControl,
  useSvgIdPrefix,
} from "@/components/visualizations/viz-shell";
import {
  breakEvenConfidenceLevel,
  damageLoss,
  recoveryGain,
  verdictForNetChange,
  type NetChangeVerdict,
} from "./paper-model";
import { PlaybackBar } from "./playback-bar";
import { useScenePlayback, type PlaybackStep } from "./use-scene-playback";
import styles from "./paper-scenes.module.css";

const STEPS: PlaybackStep[] = [
  { id: "default-read", durationMs: 6000, label: "기본 순변화 막대 읽기" },
  { id: "cl-sweep", durationMs: 14000, label: "99% preset에서 CLₜ 하강" },
  { id: "breakeven-hold", durationMs: 4000, label: "손익분기 고정" },
  { id: "handoff", durationMs: 4000, label: "반복 궤적 화면으로 전환" },
];

type PresetId = "balanced" | "99-percent-accuracy" | "harmful-revision";

const PRESETS: Record<
  PresetId,
  { label: string; accuracy: number; confidenceLevel: number; critiqueScore: number }
> = {
  balanced: {
    label: "낮은 초기 정확도",
    accuracy: 0.7,
    confidenceLevel: 0.9,
    critiqueScore: 0.4,
  },
  "99-percent-accuracy": {
    label: "99% 정확도",
    accuracy: 0.99,
    confidenceLevel: 0.9949,
    critiqueScore: 0.5,
  },
  "harmful-revision": {
    label: "복구보다 훼손이 큰 사례",
    accuracy: 0.9,
    confidenceLevel: 0.85,
    critiqueScore: 0.3,
  },
};

const VERDICT_LABEL: Record<NetChangeVerdict, string> = {
  BENEFICIAL: "BENEFICIAL · 평균 정확도 상승",
  BREAK_EVEN: "BREAK-EVEN · 수정 전후 동일",
  HARMFUL: "HARMFUL · 평균 정확도 하락",
};

const SWEEP_FROM = 1;
const SWEEP_TO = 0.994;

/**
 * Scene 3 primary visual (wireframe §5). Recovery gain and damage loss as
 * opposing bars; the autoplay sweeps CLₜ down from 100% in the 99% preset
 * so the sign flip at the break-even point (≈99.49%) is visible.
 */
export function RepairDamageLab() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { state, controls, markUserInteraction } = useScenePlayback(
    STEPS,
    containerRef,
  );
  const idPrefix = useSvgIdPrefix("repair-damage");
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;

  const [accuracy, setAccuracy] = useState(PRESETS.balanced.accuracy);
  const [confidenceLevel, setConfidenceLevel] = useState(
    PRESETS.balanced.confidenceLevel,
  );
  const [critiqueScore, setCritiqueScore] = useState(
    PRESETS.balanced.critiqueScore,
  );
  const [committed, setCommitted] = useState({
    accuracy: PRESETS.balanced.accuracy,
    confidenceLevel: PRESETS.balanced.confidenceLevel,
    critiqueScore: PRESETS.balanced.critiqueScore,
  });
  const [breakEvenOutput, setBreakEvenOutput] = useState<number | null>(null);

  const stage =
    state.status === "idle"
      ? "default-read"
      : state.status === "completed"
        ? "handoff"
        : STEPS[state.step]?.id ?? "default-read";

  // Autoplay choreography: entering cl-sweep applies the 99% preset and
  // lowers CLₜ from 100% to 99.40% so the verdict flips sign on screen;
  // break-even hold pins CLₜ to the exact break-even value.
  useEffect(() => {
    if (state.status !== "playing" || state.hasUserInteracted) return;
    const stepId = STEPS[state.step]?.id;
    if (stepId === "cl-sweep") {
      const startedAt = performance.now();
      const durationMs = STEPS[1].durationMs / state.speed;
      let applied = false;
      const timer = window.setInterval(() => {
        if (!applied) {
          applied = true;
          const preset = PRESETS["99-percent-accuracy"];
          setAccuracy(preset.accuracy);
          setCritiqueScore(preset.critiqueScore);
        }
        const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
        setConfidenceLevel(SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * progress);
        if (progress >= 1) window.clearInterval(timer);
      }, 120);
      return () => window.clearInterval(timer);
    }
    if (stepId === "breakeven-hold") {
      const timer = window.setTimeout(() => {
        const breakEven = breakEvenConfidenceLevel(0.99, 0.5);
        if (breakEven !== null) {
          setConfidenceLevel(breakEven);
          setBreakEvenOutput(breakEven);
          setCommitted({
            accuracy: 0.99,
            confidenceLevel: breakEven,
            critiqueScore: 0.5,
          });
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [state.status, state.step, state.speed, state.hasUserInteracted]);

  const gain = recoveryGain(accuracy, critiqueScore);
  const loss = damageLoss(accuracy, confidenceLevel);
  const net = gain - loss;
  const verdict = verdictForNetChange(net);

  const committedNet =
    recoveryGain(committed.accuracy, committed.critiqueScore) -
    damageLoss(committed.accuracy, committed.confidenceLevel);
  const committedVerdict = verdictForNetChange(committedNet);

  const breakEven = useMemo(
    () => breakEvenConfidenceLevel(accuracy, critiqueScore),
    [accuracy, critiqueScore],
  );

  const barUnit = 340 / Math.max(gain, loss, 0.004);
  const formatPercentPoints = (value: number) =>
    `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(3)}%p`;
  const formatPercent = (value: number, digits = 2) =>
    `${(value * 100).toFixed(digits)}%`;

  const interact = (updater: () => void) => {
    markUserInteraction();
    updater();
  };
  const commit = () => {
    setCommitted({ accuracy, confidenceLevel, critiqueScore });
  };
  const applyPreset = (id: PresetId) => {
    const preset = PRESETS[id];
    markUserInteraction();
    setAccuracy(preset.accuracy);
    setConfidenceLevel(preset.confidenceLevel);
    setCritiqueScore(preset.critiqueScore);
    setCommitted({
      accuracy: preset.accuracy,
      confidenceLevel: preset.confidenceLevel,
      critiqueScore: preset.critiqueScore,
    });
    setBreakEvenOutput(null);
  };

  // CL strip geometry: zoomed window around the interesting range.
  const stripMin = Math.min(0.98, confidenceLevel - 0.005, (breakEven ?? 1) - 0.005);
  const stripMax = 1;
  const stripX = (value: number) =>
    60 + ((value - stripMin) / (stripMax - stripMin)) * 560;

  return (
    <div
      ref={containerRef}
      data-repair-damage
      data-stage={stage}
      data-verdict={verdict}
      onPointerUp={commit}
      onKeyUp={commit}
      onTouchEnd={commit}
    >
      <LabShell
        title="한 라운드의 손익"
        subtitle="복구 이득 (1 − Accₜ) × CSₜ 대 훼손 손실 Accₜ × (1 − CLₜ)"
        legend={[
          { label: "복구 이득", tone: "success" },
          { label: "훼손 손실", tone: "danger" },
        ]}
        stageLabel="순변화 = 복구 이득 − 훼손 손실"
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
              <button
                type="button"
                className={styles.presetButton}
                data-action="break-even"
                onClick={() =>
                  interact(() => {
                    if (breakEven !== null) {
                      setConfidenceLevel(breakEven);
                      setBreakEvenOutput(breakEven);
                      setCommitted({ accuracy, confidenceLevel: breakEven, critiqueScore });
                    }
                  })
                }
              >
                손익분기 CLₜ 계산
              </button>
            </div>
            <RangeControl
              id="repair-accuracy"
              label="Accₜ · 현재 정확도"
              value={accuracy}
              min={0.01}
              max={1}
              step={0.01}
              valueLabel={formatPercent(accuracy)}
              onChange={(value) => interact(() => setAccuracy(value))}
            />
            <RangeControl
              id="repair-confidence"
              label="CLₜ · 정답 보존율"
              value={confidenceLevel}
              min={0.9}
              max={1}
              step={0.0001}
              valueLabel={formatPercent(confidenceLevel, 4)}
              onChange={(value) => interact(() => setConfidenceLevel(value))}
            />
            <RangeControl
              id="repair-critique"
              label="CSₜ · 오답 복구율"
              value={critiqueScore}
              min={0}
              max={1}
              step={0.01}
              valueLabel={formatPercent(critiqueScore)}
              onChange={(value) => interact(() => setCritiqueScore(value))}
            />
          </>
        }
        status={[
          { label: "순변화", value: formatPercentPoints(committedNet) },
          { label: "판정", value: VERDICT_LABEL[committedVerdict] },
        ]}
        explanation={
          <div data-visual-fallback>
            <p>
              대입한 원식: Accₜ₊₁ − Accₜ = (1 − {formatPercent(accuracy)}) ×{" "}
              {formatPercent(critiqueScore)} − {formatPercent(accuracy)} × (1 −{" "}
              {formatPercent(confidenceLevel, 4)}) ={" "}
              {formatPercentPoints(net)}
            </p>
            <table className={styles.transitionTable}>
              <caption>손익 계산 값</caption>
              <tbody>
                <tr>
                  <th scope="row">복구 이득</th>
                  <td>+{(gain * 100).toFixed(3)}%p</td>
                </tr>
                <tr>
                  <th scope="row">훼손 손실</th>
                  <td>−{(loss * 100).toFixed(3)}%p</td>
                </tr>
                <tr>
                  <th scope="row">순변화</th>
                  <td>{formatPercentPoints(net)}</td>
                </tr>
                <tr>
                  <th scope="row">판정</th>
                  <td>{VERDICT_LABEL[verdict]}</td>
                </tr>
                <tr>
                  <th scope="row">손익분기 CLₜ</th>
                  <td>
                    {breakEven === null
                      ? "정의되지 않음 (Accₜ = 0)"
                      : `약 ${formatPercent(breakEven, 2)}`}
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              손익분기 계산 결과:{" "}
              <output data-break-even-output>
                {breakEvenOutput === null
                  ? "아직 계산하지 않음"
                  : `약 ${formatPercent(breakEvenOutput, 2)}`}
              </output>
              {breakEvenOutput === null ? null : (
                <span>
                  {" "}
                  (반올림 전 {breakEvenOutput.toFixed(6)})
                </span>
              )}
            </p>
          </div>
        }
      >
        <div
          className="viz-scroll"
          tabIndex={0}
          aria-label="복구 이득과 훼손 손실 막대 시각화 스크롤 영역"
        >
          <svg
            className="viz-svg viz-compact"
            viewBox="0 0 680 340"
            role="group"
            aria-labelledby={titleId}
            aria-describedby={descId}
          >
            <title id={titleId}>복구 이득과 훼손 손실의 손익 막대</title>
            <desc id={descId}>
              복구 이득 막대와 훼손 손실 막대의 길이를 비교하고, 순변화의
              부호와 손익분기 CLₜ 위치를 보여 준다.
            </desc>

            <text className={styles.barRowLabel} x="60" y="52">
              복구 이득
            </text>
            <text className={styles.barRowValue} data-tone="good" x="620" y="52" textAnchor="end">
              +{(gain * 100).toFixed(3)}%p
            </text>
            <rect className={styles.barTrack} x="60" y="62" width="560" height="20" rx="10" />
            <rect
              className={styles.gainBar}
              x="60"
              y="62"
              width={Math.min(560, gain * barUnit)}
              height="20"
              rx="10"
            />

            <text className={styles.barRowLabel} x="60" y="118">
              훼손 손실
            </text>
            <text className={styles.barRowValue} data-tone="danger" x="620" y="118" textAnchor="end">
              −{(loss * 100).toFixed(3)}%p
            </text>
            <rect className={styles.barTrack} x="60" y="128" width="560" height="20" rx="10" />
            <rect
              className={styles.lossBar}
              x="60"
              y="128"
              width={Math.min(560, loss * barUnit)}
              height="20"
              rx="10"
            />

            <text className={styles.barRowLabel} x="60" y="184">
              순변화
            </text>
            <text
              className={styles.verdictText}
              data-verdict={verdict}
              x="620"
              y="184"
              textAnchor="end"
            >
              {formatPercentPoints(net)} · {verdict.replace("_", "-")}
            </text>
            <line className={styles.netAxis} x1="340" y1="196" x2="340" y2="232" />
            <rect className={styles.barTrack} x="60" y="204" width="560" height="20" rx="10" />
            <rect
              className={net >= 0 ? styles.gainBar : styles.lossBar}
              x={net >= 0 ? 340 : 340 - Math.min(280, Math.abs(net) * barUnit)}
              y="204"
              width={Math.min(280, Math.abs(net) * barUnit)}
              height="20"
              rx="10"
            />

            {/* CLₜ strip with break-even marker */}
            <text className={styles.barRowLabel} x="60" y="272">
              CLₜ 위치와 손익분기
            </text>
            <line className={styles.stripAxis} x1="60" y1="296" x2="620" y2="296" />
            <text className={styles.stripTick} x="60" y="326">
              {formatPercent(stripMin, 2)}
            </text>
            <text className={styles.stripTick} x="620" y="326" textAnchor="end">
              100%
            </text>
            {breakEven !== null && breakEven >= stripMin ? (
              <g className={styles.breakEvenMarker}>
                <line x1={stripX(breakEven)} y1="282" x2={stripX(breakEven)} y2="310" />
                <text x={stripX(breakEven)} y="330" textAnchor="middle">
                  손익분기 {formatPercent(breakEven, 2)}
                </text>
              </g>
            ) : null}
            <circle
              className={styles.stripCurrent}
              data-verdict={verdict}
              cx={stripX(Math.max(stripMin, Math.min(1, confidenceLevel)))}
              cy="296"
              r="8"
            />
            <text
              className={styles.stripCurrentLabel}
              x={stripX(Math.max(stripMin, Math.min(1, confidenceLevel)))}
              y="266"
              textAnchor="middle"
            >
              CLₜ {formatPercent(confidenceLevel, 4)}
            </text>
          </svg>
        </div>
      </LabShell>
    </div>
  );
}
