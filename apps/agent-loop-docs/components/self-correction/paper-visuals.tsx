"use client";

import { Calculator, Pause, Play, StepForward } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  LabShell,
  RangeControl,
  ResetButton,
  SegmentedControl,
} from "@/components/visualizations/viz-shell";
import {
  convergenceAlpha,
  damageLoss,
  recoveryGain,
  stationaryTrajectory,
  stationaryUpperBound,
  transitionBreakdown,
} from "./paper-model";
import styles from "./paper-visuals.module.css";

type PaperView = "trajectory" | "experiment" | "claim-boundary";
type TransitionId = "preserved" | "damaged" | "recovered" | "remaining";
type RepairMetric = "recovery" | "damage" | "net";
type RepairPreset = "balanced" | "high-accuracy" | "harmful";
type TrajectoryCurveId = "below" | "at" | "above";

const TRANSITION_ORDER: TransitionId[] = [
  "preserved",
  "damaged",
  "recovered",
  "remaining",
];

const REPAIR_DEMO_CONFIDENCE_LEVELS = [1, 0.9975, 0.99495, 0.994, 0.99];
const PAPER_VIEWS: PaperView[] = ["trajectory", "experiment", "claim-boundary"];
const QUESTION_INITIAL_ACCURACY = 0.66;
const QUESTION_RECOVERY_RATE = 0.18;
const QUESTION_ITERATION_COUNT = 5;
const QUESTION_PLAYBACK_DELAYS = [1750, 1400, 1100, 850] as const;

function clampProbability(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatSignedPercentagePoints(value: number, digits = 2) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value * 100).toFixed(digits)}%p`;
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function useSvgA11yIds(prefix: string) {
  const suffix = useId().replaceAll(":", "");
  return {
    prefix: `${prefix}-${suffix}`,
    titleId: `${prefix}-${suffix}-title`,
    descriptionId: `${prefix}-${suffix}-description`,
  };
}

function useMotionPreference() {
  const [preference, setPreference] = useState({
    ready: false,
    reduced: false,
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setPreference({
        ready: true,
        reduced: media.matches,
      });
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return preference;
}

function useViewportAutoplayGate(onFirstEntry: () => void) {
  const targetRef = useRef<HTMLDivElement>(null);
  const enteredRef = useRef(false);
  const cancelledRef = useRef(false);
  const onFirstEntryRef = useRef(onFirstEntry);
  const [entered, setEntered] = useState(false);
  const { ready, reduced } = useMotionPreference();

  useEffect(() => {
    onFirstEntryRef.current = onFirstEntry;
  }, [onFirstEntry]);

  useEffect(() => {
    if (!ready || reduced || enteredRef.current) return;
    const target = targetRef.current;
    if (!target) return;

    const enter = () => {
      if (enteredRef.current || cancelledRef.current) return;
      enteredRef.current = true;
      onFirstEntryRef.current();
      setEntered(true);
    };

    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(enter);
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          enter();
          observer.disconnect();
        }
      },
      {
        threshold: 0.18,
        rootMargin: "160px 0px 120px 0px",
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [ready, reduced]);

  return {
    targetRef,
    entered,
    reducedMotion: reduced,
    cancelPendingAutoplay: () => {
      cancelledRef.current = true;
    },
    beginManualPlayback: () => {
      if (reduced) return;
      cancelledRef.current = false;
      if (!enteredRef.current) {
        enteredRef.current = true;
        setEntered(true);
      }
    },
  };
}

function activateWithKeyboard(
  event: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

function PlaybackButtons({
  playing,
  reducedMotion,
  onPlay,
  onPause,
  onStep,
}: {
  playing: boolean;
  reducedMotion: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
}) {
  return (
    <>
      <button
        className="lab-button primary"
        type="button"
        onClick={playing ? onPause : onPlay}
        disabled={reducedMotion}
        aria-label={
          reducedMotion
            ? "모션 감소 설정으로 자동 재생을 사용할 수 없습니다"
            : playing
              ? "자동 재생 일시정지"
              : "한 번 다시 재생"
        }
      >
        {playing ? (
          <Pause aria-hidden="true" size={15} />
        ) : (
          <Play aria-hidden="true" size={15} />
        )}
        {playing ? "일시정지" : "한 번 재생"}
      </button>
      <button className="lab-button" type="button" onClick={onStep}>
        <StepForward aria-hidden="true" size={15} />
        다음
      </button>
    </>
  );
}

function SvgScroll({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`viz-scroll ${styles.scroll}`}
      tabIndex={0}
      aria-label={`${label}, 가로로 스크롤할 수 있습니다.`}
    >
      {children}
    </div>
  );
}

export function QuestionFlowLab() {
  const [damageRate, setDamageRate] = useState(0.04);
  const [visibleIteration, setVisibleIteration] = useState(0);
  const [playing, setPlaying] = useState(true);
  const { prefix, titleId, descriptionId } = useSvgA11yIds("question-flow");
  const loopArrowId = `${prefix}-loop-arrow`;
  const correctGradientId = `${prefix}-correct-cylinder`;
  const incorrectGradientId = `${prefix}-incorrect-cylinder`;
  const glassGradientId = `${prefix}-glass-fresnel`;
  const neonGlowId = `${prefix}-neon-glow`;
  const softGlowId = `${prefix}-soft-glow`;
  const damageInputId = `${prefix}-damage-rate`;
  const accuracies = useMemo(() => {
    const values = [QUESTION_INITIAL_ACCURACY];
    for (
      let iteration = 1;
      iteration < QUESTION_ITERATION_COUNT;
      iteration += 1
    ) {
      const previous = values[iteration - 1];
      values.push(
        previous * (1 - damageRate) +
          (1 - previous) * QUESTION_RECOVERY_RATE,
      );
    }
    return values;
  }, [damageRate]);
  const lastIteration = accuracies.length - 1;
  const {
    targetRef,
    entered,
    reducedMotion,
    cancelPendingAutoplay,
    beginManualPlayback,
  } = useViewportAutoplayGate(() => {
    setVisibleIteration(0);
    setPlaying(true);
  });
  const playbackActive = playing && entered && !reducedMotion;
  const activeIteration = reducedMotion ? lastIteration : visibleIteration;
  const selectedAccuracy = accuracies[activeIteration];
  const previousAccuracy =
    activeIteration > 0 ? accuracies[activeIteration - 1] : null;
  const selectedDelta =
    previousAccuracy === null ? null : selectedAccuracy - previousAccuracy;
  const traceDelta = accuracies[lastIteration] - accuracies[0];
  const tracePattern =
    traceDelta > 0.01 ? "개선" : traceDelta < -0.01 ? "악화" : "정체";
  const damagePercent = damageRate * 100;
  const potentiometerAngle = -135 + ((damagePercent - 2) / 16) * 270;
  const potentiometerStyle = {
    "--pot-angle": `${potentiometerAngle}deg`,
    "--pot-fill-angle": `${((damagePercent - 2) / 16) * 270}deg`,
  } as CSSProperties;

  useEffect(() => {
    if (!playbackActive) return;
    const timer = window.setTimeout(() => {
      if (visibleIteration < lastIteration) {
        const nextIteration = visibleIteration + 1;
        setVisibleIteration(nextIteration);
      } else {
        setPlaying(false);
      }
    }, QUESTION_PLAYBACK_DELAYS[Math.min(visibleIteration, QUESTION_PLAYBACK_DELAYS.length - 1)]);
    return () => window.clearTimeout(timer);
  }, [lastIteration, playbackActive, visibleIteration]);

  function stopAutoplay() {
    cancelPendingAutoplay();
    setPlaying(false);
  }

  function changeDamageRate(nextDamageRate: number) {
    cancelPendingAutoplay();
    beginManualPlayback();
    setDamageRate(nextDamageRate);
    setVisibleIteration(0);
    setPlaying(true);
  }

  function selectIteration(iteration: number) {
    stopAutoplay();
    setVisibleIteration(iteration);
  }

  function replay() {
    beginManualPlayback();
    setVisibleIteration(0);
    setPlaying(true);
  }

  function step() {
    stopAutoplay();
    if (visibleIteration < lastIteration) {
      const nextIteration = visibleIteration + 1;
      setVisibleIteration(nextIteration);
      return;
    }
    setVisibleIteration(0);
  }

  function reset() {
    stopAutoplay();
    setDamageRate(0.04);
    setVisibleIteration(0);
  }

  const selectedDirection =
    selectedDelta === null
      ? "시작점"
      : selectedDelta > 0.005
        ? "개선"
        : selectedDelta < -0.005
          ? "악화"
          : "정체";

  return (
    <div ref={targetRef}>
      <LabShell
        title="iteration이 늘어날 때 정답과 오답의 비중은 어떻게 바뀝니까?"
        subtitle="설명용 합성 trace입니다. 각 원기둥은 한 번의 자기수정 뒤 생긴 상태이며, 논문의 실측치는 아닙니다."
        actions={
          <>
            <PlaybackButtons
              playing={playbackActive}
              reducedMotion={reducedMotion}
              onPlay={replay}
              onPause={stopAutoplay}
              onStep={step}
            />
            <ResetButton onClick={reset} />
          </>
        }
        controls={
          <div
            className={styles.potentiometerControl}
            data-question-pattern={tracePattern}
          >
            <div className={styles.potentiometerCopy}>
              <label htmlFor={damageInputId}>정답 훼손률</label>
              <span>오답 복구율은 18%로 고정합니다.</span>
            </div>
            <div
              className={styles.potentiometerHardware}
              style={potentiometerStyle}
            >
              <div className={styles.potentiometerTicks} aria-hidden="true">
                {Array.from({ length: 17 }, (_, index) => (
                  <span
                    key={index}
                    style={
                      {
                        "--tick-angle": `${-135 + index * 16.875}deg`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
              <div className={styles.potentiometerKnob} aria-hidden="true">
                <span />
              </div>
              <input
                id={damageInputId}
                type="range"
                min="2"
                max="18"
                step="1"
                value={damagePercent}
                aria-valuetext={`정답 훼손률 ${damagePercent.toFixed(0)}%, ${tracePattern} 궤적`}
                onChange={(event) =>
                  changeDamageRate(Number(event.target.value) / 100)
                }
              />
            </div>
            <div className={styles.potentiometerScale} aria-hidden="true">
              <span>개선</span>
              <span>정체</span>
              <span>악화</span>
            </div>
            <output
              className={styles.potentiometerReadout}
              htmlFor={damageInputId}
              data-pattern={tracePattern}
            >
              <strong>{damagePercent.toFixed(0)}%</strong>
              <span>{tracePattern}</span>
            </output>
          </div>
        }
        stageLabel={`Paper question · iteration 0–${lastIteration} · viewport autoplay · ease-in`}
        legend={[
          { label: "정답 비중", tone: "success" },
          { label: "오답 비중", tone: "danger" },
          { label: "현재 / 과거 / 예정", tone: "accent" },
        ]}
        status={[
          {
            label: "현재 iteration",
            value: `t = ${activeIteration} / ${lastIteration}`,
          },
          {
            label: "정답 / 오답",
            value: `${formatPercent(selectedAccuracy, 0)} / ${formatPercent(1 - selectedAccuracy, 0)}`,
          },
          {
            label: "직전 대비",
            value:
              selectedDelta === null
                ? "기준점"
                : `${formatSignedPercentagePoints(selectedDelta, 1)} · ${selectedDirection}`,
          },
          {
            label: "훼손률 / 궤적",
            value: `${damagePercent.toFixed(0)}% · ${tracePattern}`,
          },
        ]}
        explanation={
          <>
            포텐셔미터를 돌리면 같은 오답 복구율에서도 개선·정체·악화가
            갈립니다. <strong>iteration 개수보다 정답 질량의 순변화</strong>를
            먼저 보셔야 합니다.
          </>
        }
      >
        <SvgScroll label="iteration별 정답과 오답 비중">
          <svg
            className={`viz-svg viz-wide ${styles.svg} ${styles.iterationSvg}`}
            viewBox="0 0 960 540"
            role="group"
            aria-labelledby={`${titleId} ${descriptionId}`}
            data-easing="ease-in"
          >
            <title id={titleId}>
              반복 자기수정에서 변하는 정답과 오답의 비중
            </title>
            <desc id={descriptionId}>
              정답 훼손률 {damagePercent.toFixed(0)}%에서 {tracePattern}하는 합성
              궤적입니다. 현재 iteration은 {activeIteration}, 정답{" "}
              {formatPercent(selectedAccuracy, 0)}, 오답{" "}
              {formatPercent(1 - selectedAccuracy, 0)}입니다. 지난 iteration은
              어둡고, 아직 오지 않은 iteration은 점선 실루엣으로 보입니다.
            </desc>
            <defs>
              <marker
                id={loopArrowId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M0 0 10 5 0 10Z" fill="var(--viz-focus)" />
              </marker>
              <linearGradient
                id={correctGradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor="var(--viz-correct-hot)" />
                <stop offset="0.22" stopColor="var(--viz-correct)" />
                <stop offset="0.62" stopColor="var(--viz-correct)" />
                <stop
                  offset="1"
                  stopColor="color-mix(in srgb, var(--viz-correct) 58%, black)"
                />
              </linearGradient>
              <linearGradient
                id={incorrectGradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor="var(--viz-incorrect-hot)" />
                <stop offset="0.22" stopColor="var(--viz-incorrect)" />
                <stop offset="0.62" stopColor="var(--viz-incorrect)" />
                <stop
                  offset="1"
                  stopColor="color-mix(in srgb, var(--viz-incorrect) 58%, black)"
                />
              </linearGradient>
              <linearGradient
                id={glassGradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor="white" stopOpacity="0.26" />
                <stop offset="0.14" stopColor="#c8dde8" stopOpacity="0.08" />
                <stop offset="0.48" stopColor="white" stopOpacity="0" />
                <stop offset="0.82" stopColor="#c8dde8" stopOpacity="0.05" />
                <stop offset="1" stopColor="white" stopOpacity="0.14" />
              </linearGradient>
              <filter
                id={neonGlowId}
                x="-50%"
                y="-160%"
                width="200%"
                height="420%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="8"
                  result="wide"
                />
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="3"
                  result="tight"
                />
                <feMerge>
                  <feMergeNode in="wide" />
                  <feMergeNode in="tight" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter
                id={softGlowId}
                x="-40%"
                y="-120%"
                width="180%"
                height="340%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur stdDeviation="18" />
              </filter>
              {accuracies.map((_, iteration) => {
                const barX = 198 + iteration * 17;
                const y = 66 + iteration * 84;
                return (
                  <clipPath
                    key={`clip-${iteration}`}
                    id={`${prefix}-cylinder-${iteration}`}
                  >
                    <rect x={barX + 13} y={y} width="554" height="48" />
                    <ellipse cx={barX + 13} cy={y + 24} rx="13" ry="24" />
                    <ellipse cx={barX + 567} cy={y + 24} rx="13" ry="24" />
                  </clipPath>
                );
              })}
            </defs>

            <text x="102" y="36" className="viz-eyebrow" textAnchor="middle">
              ITERATION
            </text>
            <text x="198" y="36" className="viz-eyebrow">
              0%
            </text>
            <text x="505" y="36" className="viz-eyebrow" textAnchor="middle">
              정답 / 오답 질량
            </text>
            <text x="812" y="36" className="viz-eyebrow" textAnchor="end">
              100%
            </text>
            <text x="890" y="36" className="viz-eyebrow" textAnchor="middle">
              Δ
            </text>

            {accuracies.map((accuracy, iteration) => {
              const y = 66 + iteration * 84;
              const barX = 198 + iteration * 17;
              const barWidth = 580;
              const barHeight = 48;
              const capRadiusX = 13;
              const correctWidth = barWidth * accuracy;
              const incorrectWidth = barWidth - correctWidth;
              const delta =
                iteration === 0
                  ? null
                  : accuracy - accuracies[iteration - 1];
              const deltaLabel =
                delta === null
                  ? "기준"
                  : formatSignedPercentagePoints(delta, 0);
              const deltaTone =
                delta === null
                  ? styles.deltaNeutral
                  : delta > 0.005
                    ? styles.deltaPositive
                    : delta < -0.005
                      ? styles.deltaNegative
                      : styles.deltaNeutral;
              const phase =
                iteration < activeIteration
                  ? "past"
                  : iteration === activeIteration
                    ? "current"
                    : "future";
              const isCurrent = phase === "current";
              const isFuture = phase === "future";
              const cylinderClipId = `${prefix}-cylinder-${iteration}`;

              return (
                <g
                  key={iteration}
                  className={`${styles.iterationRow} ${isCurrent ? styles.iterationRowSelected : ""}`}
                  data-question-iteration={iteration}
                  data-correct={accuracy.toFixed(2)}
                  data-incorrect={(1 - accuracy).toFixed(2)}
                  data-phase={phase}
                  data-selected={isCurrent}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isCurrent}
                  aria-label={`iteration ${iteration}, ${phase === "past" ? "지난 상태" : phase === "future" ? "예정된 상태" : "현재 상태"}, 정답 ${formatPercent(accuracy, 0)}, 오답 ${formatPercent(1 - accuracy, 0)}, ${delta === null ? "시작점" : `직전 대비 ${formatSignedPercentagePoints(delta, 0)}`}`}
                  onClick={() => selectIteration(iteration)}
                  onKeyDown={(event) =>
                    activateWithKeyboard(event, () =>
                      selectIteration(iteration),
                    )
                  }
                >
                  <rect
                    x="64"
                    y={y - 9}
                    width="864"
                    height="68"
                    rx="10"
                    className={styles.iterationHitTarget}
                  />
                  <rect
                    x={barX - 18}
                    y={y - 9}
                    width={barWidth + 36}
                    height="68"
                    rx="14"
                    className={styles.iterationSelection}
                  />
                  <text
                    x="104"
                    y={y + 30}
                    className={`viz-value ${styles.iterationLabel}`}
                    textAnchor="middle"
                  >
                    t = {iteration}
                  </text>

                  {iteration > 0 ? (
                    <path
                      d={`M150 ${y - 30} C168 ${y - 24}, 168 ${y - 9}, ${barX - 18} ${y - 7}`}
                      className={styles.loopConnector}
                      markerEnd={`url(#${loopArrowId})`}
                    />
                  ) : null}

                  {isFuture ? (
                    <g className={styles.futureCylinder} aria-hidden="true">
                      <rect
                        x={barX + capRadiusX}
                        y={y}
                        width={barWidth - capRadiusX * 2}
                        height={barHeight}
                      />
                      <ellipse
                        cx={barX + capRadiusX}
                        cy={y + barHeight / 2}
                        rx={capRadiusX}
                        ry={barHeight / 2}
                      />
                      <ellipse
                        cx={barX + barWidth - capRadiusX}
                        cy={y + barHeight / 2}
                        rx={capRadiusX}
                        ry={barHeight / 2}
                      />
                    </g>
                  ) : (
                    <>
                      {isCurrent ? (
                        <g className={styles.segmentAuras} aria-hidden="true">
                          <rect
                            x={barX + 8}
                            y={y + 8}
                            width={Math.max(0, correctWidth - 8)}
                            height={barHeight - 16}
                            rx="12"
                            fill="var(--viz-correct)"
                            filter={`url(#${softGlowId})`}
                          />
                          <rect
                            x={barX + correctWidth}
                            y={y + 8}
                            width={Math.max(0, incorrectWidth - 8)}
                            height={barHeight - 16}
                            rx="12"
                            fill="var(--viz-incorrect)"
                            filter={`url(#${softGlowId})`}
                          />
                        </g>
                      ) : null}
                      <g
                        className={styles.iterationSegments}
                        clipPath={`url(#${cylinderClipId})`}
                      >
                        <rect
                          x={barX}
                          y={y}
                          width={correctWidth}
                          height={barHeight}
                          fill={`url(#${correctGradientId})`}
                          filter={isCurrent ? `url(#${neonGlowId})` : undefined}
                          className={styles.correctSegment}
                        />
                        <rect
                          x={barX + correctWidth}
                          y={y}
                          width={incorrectWidth}
                          height={barHeight}
                          fill={`url(#${incorrectGradientId})`}
                          filter={isCurrent ? `url(#${neonGlowId})` : undefined}
                          className={styles.incorrectSegment}
                        />
                        <rect
                          x={barX}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          fill={`url(#${glassGradientId})`}
                          className={styles.cylinderGlass}
                          aria-hidden="true"
                        />
                      </g>
                      <g className={styles.cylinderShell} aria-hidden="true">
                        <rect
                          x={barX + capRadiusX}
                          y={y}
                          width={barWidth - capRadiusX * 2}
                          height={barHeight}
                        />
                        <ellipse
                          cx={barX + capRadiusX}
                          cy={y + barHeight / 2}
                          rx={capRadiusX}
                          ry={barHeight / 2}
                        />
                        <ellipse
                          cx={barX + barWidth - capRadiusX}
                          cy={y + barHeight / 2}
                          rx={capRadiusX}
                          ry={barHeight / 2}
                        />
                        <path
                          d={`M${barX + 22} ${y + 8} H${barX + barWidth - 22}`}
                          className={styles.cylinderSpecular}
                        />
                      </g>
                      <ellipse
                        cx={barX + correctWidth}
                        cy={y + barHeight / 2}
                        rx="5"
                        ry={barHeight / 2 - 5}
                        className={styles.massBoundary}
                      />
                      {correctWidth > 150 ? (
                        <text
                          x={barX + correctWidth / 2}
                          y={y + 29}
                          className={styles.segmentLabel}
                          textAnchor="middle"
                        >
                          정답 {formatPercent(accuracy, 0)}
                        </text>
                      ) : null}
                      {incorrectWidth > 132 ? (
                        <text
                          x={barX + correctWidth + incorrectWidth / 2}
                          y={y + 29}
                          className={styles.segmentLabel}
                          textAnchor="middle"
                        >
                          오답 {formatPercent(1 - accuracy, 0)}
                        </text>
                      ) : null}
                    </>
                  )}
                  <text
                    x="890"
                    y={y + 30}
                    className={`viz-value ${deltaTone}`}
                    textAnchor="middle"
                  >
                    {isFuture ? "예정" : deltaLabel}
                  </text>
                </g>
              );
            })}

            <text
              x="505"
              y="514"
              className={`viz-body ${styles.iterationCaption}`}
              textAnchor="middle"
            >
              현재 원기둥은 발광하고, 지난 iteration은 어두워지며, 다음
              iteration은 점선 실루엣으로 기다립니다.
            </text>
          </svg>
        </SvgScroll>

        <details
          className={styles.fallback}
          data-visual-fallback
          onToggle={(event) => {
            if (event.currentTarget.open) stopAutoplay();
          }}
        >
          <summary>텍스트 대체 설명 보기</summary>
          <div className={styles.fallbackContent}>
            <p>
              <strong>
                {tracePattern} 궤적 · 정답 훼손률 {damagePercent.toFixed(0)}% ·
                설명용 합성 trace
              </strong>
              <br />
              아래 값은 질문의 구조를 보여 주기 위한 예시이며 논문 실측치가
              아닙니다.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">iteration</th>
                  <th scope="col">정답</th>
                  <th scope="col">오답</th>
                  <th scope="col">직전 대비</th>
                  <th scope="col">판정</th>
                </tr>
              </thead>
              <tbody>
                {accuracies.map((accuracy, iteration) => {
                  const delta =
                    iteration === 0
                      ? null
                      : accuracy - accuracies[iteration - 1];
                  const verdict =
                    delta === null
                      ? "시작점"
                      : delta > 0.005
                        ? "개선"
                        : delta < -0.005
                          ? "악화"
                          : "정체";
                  return (
                    <tr
                      key={`damage-${damagePercent}-fallback-${iteration}`}
                      aria-current={
                        activeIteration === iteration ? "step" : undefined
                      }
                    >
                      <th scope="row">t = {iteration}</th>
                      <td data-numeric="true">{formatPercent(accuracy, 0)}</td>
                      <td data-numeric="true">
                        {formatPercent(1 - accuracy, 0)}
                      </td>
                      <td data-numeric="true">
                        {delta === null
                          ? "—"
                          : formatSignedPercentagePoints(delta, 0)}
                      </td>
                      <td>{verdict}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </LabShell>
    </div>
  );
}

export function TwoStateTransitionLab({
  initialAccuracy = 0.7,
  initialConfidenceLevel = 0.9,
  initialCritiqueScore = 0.4,
}: {
  initialAccuracy?: number;
  initialConfidenceLevel?: number;
  initialCritiqueScore?: number;
}) {
  const defaults = useMemo(
    () => ({
      accuracy: clampProbability(initialAccuracy),
      confidenceLevel: clampProbability(initialConfidenceLevel),
      critiqueScore: clampProbability(initialCritiqueScore),
    }),
    [initialAccuracy, initialConfidenceLevel, initialCritiqueScore],
  );
  const [accuracy, setAccuracy] = useState(defaults.accuracy);
  const [confidenceLevel, setConfidenceLevel] = useState(
    defaults.confidenceLevel,
  );
  const [critiqueScore, setCritiqueScore] = useState(defaults.critiqueScore);
  const [populationOption, setPopulationOption] = useState<"100" | "1000">(
    "100",
  );
  const [selectedTransition, setSelectedTransition] =
    useState<TransitionId>("remaining");
  const [autoplayStep, setAutoplayStep] = useState(TRANSITION_ORDER.length - 1);
  const [playing, setPlaying] = useState(true);
  const { prefix, titleId, descriptionId } = useSvgA11yIds(
    "two-state-transition",
  );
  const {
    targetRef,
    entered,
    reducedMotion,
    cancelPendingAutoplay,
    beginManualPlayback,
  } = useViewportAutoplayGate(() => {
    setSelectedTransition("preserved");
    setAutoplayStep(0);
    setPlaying(true);
  });
  const playbackActive = playing && entered && !reducedMotion;

  const population = Number(populationOption);
  const breakdown = useMemo(
    () => transitionBreakdown(accuracy, confidenceLevel, critiqueScore),
    [accuracy, confidenceLevel, critiqueScore],
  );

  useEffect(() => {
    if (!playbackActive) return;
    const timer = window.setTimeout(() => {
      if (autoplayStep < TRANSITION_ORDER.length - 1) {
        const next = autoplayStep + 1;
        setAutoplayStep(next);
        setSelectedTransition(TRANSITION_ORDER[next]);
      } else {
        setPlaying(false);
      }
    }, 2100);
    return () => window.clearTimeout(timer);
  }, [autoplayStep, playbackActive]);

  function stopAutoplay() {
    cancelPendingAutoplay();
    setPlaying(false);
  }

  function setProbability(setter: (value: number) => void, value: number) {
    stopAutoplay();
    setter(value);
  }

  function selectTransition(id: TransitionId) {
    stopAutoplay();
    setSelectedTransition(id);
  }

  function replay() {
    beginManualPlayback();
    setSelectedTransition("preserved");
    setAutoplayStep(0);
    setPlaying(true);
  }

  function step() {
    stopAutoplay();
    const current = TRANSITION_ORDER.indexOf(selectedTransition);
    const next = (current + 1) % TRANSITION_ORDER.length;
    setSelectedTransition(TRANSITION_ORDER[next]);
  }

  function reset() {
    stopAutoplay();
    setAccuracy(defaults.accuracy);
    setConfidenceLevel(defaults.confidenceLevel);
    setCritiqueScore(defaults.critiqueScore);
    setPopulationOption("100");
    setSelectedTransition("preserved");
    setAutoplayStep(0);
  }

  const flowDefinitions: Array<{
    id: TransitionId;
    label: string;
    formula: string;
    mass: number;
    probability: number;
    path: string;
    labelX: number;
    labelY: number;
    stroke: string;
    markerId: string;
    dash?: string;
  }> = [
    {
      id: "preserved",
      label: "정답 → 정답 · 보존",
      formula: "Accₜ × CLₜ",
      mass: breakdown.preservedCorrect,
      probability: confidenceLevel,
      path: "M210 112 C355 72 522 72 690 112",
      labelX: 382,
      labelY: 66,
      stroke: "var(--viz-correct)",
      markerId: `${prefix}-success-arrow`,
    },
    {
      id: "damaged",
      label: "정답 → 오답 · 훼손",
      formula: "Accₜ × (1 − CLₜ)",
      mass: breakdown.damagedCorrect,
      probability: 1 - confidenceLevel,
      path: "M210 152 C368 170 516 302 690 312",
      labelX: 540,
      labelY: 240,
      stroke: "var(--viz-incorrect)",
      markerId: `${prefix}-danger-arrow`,
    },
    {
      id: "recovered",
      label: "오답 → 정답 · 복구",
      formula: "(1 − Accₜ) × CSₜ",
      mass: breakdown.recoveredCorrect,
      probability: critiqueScore,
      path: "M210 312 C368 292 516 160 690 152",
      labelX: 360,
      labelY: 240,
      stroke: "var(--viz-correct)",
      markerId: `${prefix}-success-arrow`,
      dash: "9 6",
    },
    {
      id: "remaining",
      label: "오답 → 오답 · 유지",
      formula: "(1 − Accₜ) × (1 − CSₜ)",
      mass: breakdown.remainingIncorrect,
      probability: 1 - critiqueScore,
      path: "M210 352 C355 392 522 392 690 352",
      labelX: 518,
      labelY: 404,
      stroke: "var(--viz-incorrect)",
      markerId: `${prefix}-danger-arrow`,
      dash: "9 6",
    },
  ];

  const activeFlow =
    flowDefinitions.find((flow) => flow.id === selectedTransition) ??
    flowDefinitions[0];

  return (
    <div ref={targetRef}>
      <LabShell
        title="두 상태 전이를 확률 질량으로 회계합니다"
        subtitle="Accₜ, CLₜ, CSₜ를 바꾸면 네 전이와 Accₜ₊₁이 함께 갱신됩니다."
        actions={
          <>
            <PlaybackButtons
              playing={playbackActive}
              reducedMotion={reducedMotion}
              onPlay={replay}
              onPause={stopAutoplay}
              onStep={step}
            />
            <ResetButton onClick={reset} />
          </>
        }
        controls={
          <>
            <RangeControl
              id="paper-accuracy"
              label="현재 정확도 Accₜ"
              value={accuracy}
              min={0}
              max={1}
              step={0.01}
              valueLabel={`Accₜ ${formatPercent(accuracy, 0)}`}
              onChange={(value) => setProbability(setAccuracy, value)}
            />
            <RangeControl
              id="paper-confidence-level"
              label="정답 보존율 CLₜ"
              value={confidenceLevel}
              min={0}
              max={1}
              step={0.01}
              valueLabel={`CLₜ ${formatPercent(confidenceLevel, 0)}`}
              onChange={(value) => setProbability(setConfidenceLevel, value)}
            />
            <RangeControl
              id="paper-critique-score"
              label="오답 복구율 CSₜ"
              value={critiqueScore}
              min={0}
              max={1}
              step={0.01}
              valueLabel={`CSₜ ${formatPercent(critiqueScore, 0)}`}
              onChange={(value) => setProbability(setCritiqueScore, value)}
            />
            <SegmentedControl<"100" | "1000">
              label="표본 수"
              value={populationOption}
              options={[
                { value: "100", label: "100개" },
                { value: "1000", label: "1,000개" },
              ]}
              onChange={(value) => {
                stopAutoplay();
                setPopulationOption(value);
              }}
            />
          </>
        }
        stageLabel="Eq. 6 re-indexed · t → t+1"
        legend={[
          { label: "정답 보존", tone: "success" },
          { label: "오답 복구", tone: "accent" },
          { label: "정답 훼손", tone: "danger" },
          { label: "오답 유지", tone: "neutral" },
        ]}
        status={[
          {
            label: "다음 정확도 Accₜ₊₁",
            value: formatPercent(breakdown.nextAccuracy, 2),
          },
          {
            label: "현재 선택",
            value: `${activeFlow.label} · ${formatCount(activeFlow.mass * population)}개`,
          },
          {
            label: "정확도 순변화",
            value: formatSignedPercentagePoints(breakdown.netChange),
          },
        ]}
        explanation={
          <>
            <strong>
              Accₜ₊₁ = Accₜ × CLₜ + (1 − Accₜ) × CSₜ.
            </strong>{" "}
            다음 정답은 보존된 정답과 새로 복구된 정답의 합입니다.
          </>
        }
      >
        <SvgScroll label="정답과 오답 사이의 네 조건부 전이">
          <svg
            className={`viz-svg viz-wide ${styles.svg}`}
            viewBox="0 0 900 450"
            role="group"
            aria-labelledby={`${titleId} ${descriptionId}`}
          >
            <title id={titleId}>Accₜ, CLₜ, CSₜ의 두 상태 전이</title>
            <desc id={descriptionId}>
              현재 정답과 오답이 다음 라운드의 정답과 오답으로 이동하는 네
              전이를 보여 줍니다. 각 전이는 키보드와 포인터로 선택할 수
              있습니다.
            </desc>
            <defs>
              {[
                ["success", "var(--fg-success)"],
                ["danger", "var(--fg-danger)"],
                ["accent", "var(--fg-accent)"],
                ["neutral", "var(--border-emphasis)"],
              ].map(([name, color]) => (
                <marker
                  key={name}
                  id={`${prefix}-${name}-arrow`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="10"
                  markerHeight="10"
                  markerUnits="userSpaceOnUse"
                  orient="auto"
                >
                  <path d="M0 0 10 5 0 10Z" fill={color} />
                </marker>
              ))}
            </defs>

            <text x="125" y="34" className="viz-eyebrow" textAnchor="middle">
              현재 · population {population.toLocaleString("ko-KR")}
            </text>
            <text x="775" y="34" className="viz-eyebrow" textAnchor="middle">
              수정 후
            </text>

            <rect
              x="40"
              y="72"
              width="170"
              height="112"
              rx="8"
              className="viz-node-success"
            />
            <text x="125" y="112" className="viz-title" textAnchor="middle">
              현재 정답
            </text>
            <text x="125" y="139" className="viz-value" textAnchor="middle">
              Accₜ = {formatPercent(accuracy, 1)}
            </text>
            <text x="125" y="162" className="viz-body" textAnchor="middle">
              {formatCount(accuracy * population)}개
            </text>

            <rect
              x="40"
              y="272"
              width="170"
              height="112"
              rx="8"
              className="viz-node-danger"
            />
            <text x="125" y="312" className="viz-title" textAnchor="middle">
              현재 오답
            </text>
            <text x="125" y="339" className="viz-value" textAnchor="middle">
              1 − Accₜ = {formatPercent(1 - accuracy, 1)}
            </text>
            <text x="125" y="362" className="viz-body" textAnchor="middle">
              {formatCount((1 - accuracy) * population)}개
            </text>

            <rect
              x="690"
              y="72"
              width="170"
              height="112"
              rx="8"
              className="viz-node-success"
            />
            <text x="775" y="112" className="viz-title" textAnchor="middle">
              다음 정답
            </text>
            <text x="775" y="139" className="viz-value" textAnchor="middle">
              Accₜ₊₁ = {formatPercent(breakdown.nextAccuracy, 1)}
            </text>
            <text x="775" y="162" className="viz-body" textAnchor="middle">
              {formatCount(breakdown.nextAccuracy * population)}개
            </text>

            <rect
              x="690"
              y="272"
              width="170"
              height="112"
              rx="8"
              className="viz-node-danger"
            />
            <text x="775" y="312" className="viz-title" textAnchor="middle">
              다음 오답
            </text>
            <text x="775" y="339" className="viz-value" textAnchor="middle">
              1 − Accₜ₊₁ ={" "}
              {formatPercent(1 - breakdown.nextAccuracy, 1)}
            </text>
            <text x="775" y="362" className="viz-body" textAnchor="middle">
              {formatCount((1 - breakdown.nextAccuracy) * population)}개
            </text>

            {flowDefinitions.map((flow) => {
              const selected = flow.id === selectedTransition;
              const strokeWidth = Math.max(3, 4 + flow.mass * 25);
              return (
                <g
                  key={flow.id}
                  className={styles.interactive}
                  data-selected={selected}
                  data-dimmed={!selected}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  style={{ color: flow.stroke }}
                  aria-label={`${flow.label}, 확률 ${formatPercent(flow.probability, 1)}, ${formatCount(flow.mass * population)}개`}
                  onClick={() => selectTransition(flow.id)}
                  onKeyDown={(event) =>
                    activateWithKeyboard(event, () => selectTransition(flow.id))
                  }
                >
                  <path d={flow.path} className={styles.flowHitArea} />
                  <path
                    d={flow.path}
                    className={styles.flowStroke}
                    stroke={flow.stroke}
                    strokeWidth={strokeWidth}
                    strokeOpacity={selected ? 0.9 : 0.62}
                    strokeLinecap="round"
                    strokeDasharray={flow.dash}
                    markerEnd={`url(#${flow.markerId})`}
                  />
                  <rect
                    x={flow.labelX - 94}
                    y={flow.labelY - 24}
                    width="188"
                    height="48"
                    rx="6"
                    className={
                      selected ? styles.selectedPlate : styles.labelPlate
                    }
                  />
                  <text
                    x={flow.labelX}
                    y={flow.labelY - 3}
                    className="viz-value"
                    textAnchor="middle"
                  >
                    {flow.formula}
                  </text>
                  <text
                    x={flow.labelX}
                    y={flow.labelY + 16}
                    className="viz-body"
                    textAnchor="middle"
                  >
                    {formatCount(flow.mass * population)}개 · p=
                    {flow.probability.toFixed(2)}
                  </text>
                  {playbackActive && selected ? (
                    <circle
                      r="5"
                      fill={flow.stroke}
                      className={styles.motionDot}
                    >
                      <animateMotion
                        path={flow.path}
                        dur="1.65s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  ) : null}
                </g>
              );
            })}

            <rect
              x="270"
              y="418"
              width="360"
              height="26"
              rx="6"
              className="svg-surface"
            />
            <text
              x="450"
              y="436"
              className={`viz-value ${styles.equation}`}
              textAnchor="middle"
            >
              Accₜ₊₁ = {breakdown.preservedCorrect.toFixed(3)} +{" "}
              {breakdown.recoveredCorrect.toFixed(3)} ={" "}
              {breakdown.nextAccuracy.toFixed(3)}
            </text>
          </svg>
        </SvgScroll>

        <details
          className={styles.fallback}
          data-visual-fallback
          onToggle={(event) => {
            if (event.currentTarget.open) stopAutoplay();
          }}
        >
          <summary>네 전이의 데이터 표 보기</summary>
          <div className={styles.fallbackContent}>
            <table>
              <caption className="sr-only">
                현재 상태에서 다음 상태로 이동하는 네 조건부 전이
              </caption>
              <thead>
                <tr>
                  <th scope="col">현재 상태</th>
                  <th scope="col">다음 상태</th>
                  <th scope="col">논문 식</th>
                  <th scope="col">조건부 확률</th>
                  <th scope="col">표본 수</th>
                </tr>
              </thead>
              <tbody>
                {flowDefinitions.map((flow) => {
                  const [from, to] = flow.label.split(" · ")[0].split(" → ");
                  return (
                    <tr key={flow.id}>
                      <td>{from}</td>
                      <td>{to}</td>
                      <td>
                        <code>{flow.formula}</code>
                      </td>
                      <td data-numeric="true">
                        {formatPercent(flow.probability, 2)}
                      </td>
                      <td data-numeric="true">
                        {formatCount(flow.mass * population)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </LabShell>
    </div>
  );
}

const REPAIR_PRESETS: Record<
  RepairPreset,
  {
    label: string;
    accuracy: number;
    confidenceLevel: number;
    critiqueScore: number;
  }
> = {
  balanced: {
    label: "복구 우세",
    accuracy: 0.7,
    confidenceLevel: 0.9,
    critiqueScore: 0.4,
  },
  "high-accuracy": {
    label: "99% 정확도",
    accuracy: 0.99,
    confidenceLevel: 1,
    critiqueScore: 0.5,
  },
  harmful: {
    label: "훼손 우세",
    accuracy: 0.99,
    confidenceLevel: 0.99,
    critiqueScore: 0.5,
  },
};

type BreakEvenResult =
  | {
      kind: "available";
      value: number;
      message: string;
    }
  | {
      kind: "unreachable" | "non-unique";
      message: string;
    };

function breakEvenConfidenceLevel(
  accT: number,
  critiqueScoreT: number,
): BreakEvenResult {
  if (accT === 0) {
    return critiqueScoreT === 0
      ? {
          kind: "non-unique",
          message:
            "Accₜ=0, CSₜ=0에서는 모든 유효한 CLₜ가 순변화 0을 만듭니다.",
        }
      : {
          kind: "unreachable",
          message:
            "Accₜ=0, CSₜ>0에서는 훼손 손실이 없어 모든 유효한 CLₜ에서 순이득입니다.",
        };
  }

  const root = 1 - recoveryGain(accT, critiqueScoreT) / accT;
  if (root < 0 || root > 1) {
    return {
      kind: "unreachable",
      message:
        "손익분기 해가 CLₜ의 유효 범위 [0, 1] 밖입니다. 현재 조건에서는 유효한 손익분기점에 도달할 수 없습니다.",
    };
  }

  return {
    kind: "available",
    value: root,
    message:
      root === 0
        ? "손익분기점은 유효 범위의 경계 CLₜ=0입니다."
        : "이 CLₜ에서 복구 이득과 훼손 손실이 같습니다.",
  };
}

export function RepairDamageLab() {
  const [accuracy, setAccuracy] = useState(REPAIR_PRESETS.harmful.accuracy);
  const [confidenceLevel, setConfidenceLevel] = useState(
    REPAIR_PRESETS.harmful.confidenceLevel,
  );
  const [critiqueScore, setCritiqueScore] = useState(
    REPAIR_PRESETS.harmful.critiqueScore,
  );
  const [preset, setPreset] = useState<RepairPreset | "custom">("harmful");
  const [selectedMetric, setSelectedMetric] = useState<RepairMetric>("net");
  const [autoplayStep, setAutoplayStep] = useState(
    REPAIR_DEMO_CONFIDENCE_LEVELS.length - 1,
  );
  const [playing, setPlaying] = useState(true);
  const { titleId, descriptionId } = useSvgA11yIds("repair-damage");
  const {
    targetRef,
    entered,
    reducedMotion,
    cancelPendingAutoplay,
    beginManualPlayback,
  } = useViewportAutoplayGate(() => {
    const values = REPAIR_PRESETS["high-accuracy"];
    setPreset("high-accuracy");
    setAccuracy(values.accuracy);
    setCritiqueScore(values.critiqueScore);
    setConfidenceLevel(REPAIR_DEMO_CONFIDENCE_LEVELS[0]);
    setSelectedMetric("net");
    setAutoplayStep(0);
    setPlaying(true);
  });
  const playbackActive = playing && entered && !reducedMotion;

  const recovery = recoveryGain(accuracy, critiqueScore);
  const damage = damageLoss(accuracy, confidenceLevel);
  const netChange = recovery - damage;
  const breakEven = breakEvenConfidenceLevel(accuracy, critiqueScore);
  const epsilon = 0.0000005;
  const verdict =
    netChange > epsilon
      ? "BENEFICIAL"
      : netChange < -epsilon
        ? "HARMFUL"
        : "BREAK-EVEN";
  const verdictKorean =
    verdict === "BENEFICIAL"
      ? "복구 이득이 더 큼"
      : verdict === "HARMFUL"
        ? "훼손 손실이 더 큼"
        : "복구와 훼손이 같음";

  useEffect(() => {
    if (!playbackActive) return;
    const timer = window.setTimeout(() => {
      if (autoplayStep < REPAIR_DEMO_CONFIDENCE_LEVELS.length - 1) {
        const next = autoplayStep + 1;
        setAutoplayStep(next);
        setConfidenceLevel(REPAIR_DEMO_CONFIDENCE_LEVELS[next]);
      } else {
        setPlaying(false);
      }
    }, 1650);
    return () => window.clearTimeout(timer);
  }, [autoplayStep, playbackActive]);

  function stopAutoplay() {
    cancelPendingAutoplay();
    setPlaying(false);
  }

  function applyPreset(nextPreset: RepairPreset) {
    stopAutoplay();
    const values = REPAIR_PRESETS[nextPreset];
    setPreset(nextPreset);
    setAccuracy(values.accuracy);
    setConfidenceLevel(values.confidenceLevel);
    setCritiqueScore(values.critiqueScore);
    setSelectedMetric("net");
  }

  function setManualValue(setter: (value: number) => void, value: number) {
    stopAutoplay();
    setPreset("custom");
    setter(value);
  }

  function applyBreakEven() {
    if (breakEven.kind !== "available") return;
    stopAutoplay();
    setPreset("custom");
    setConfidenceLevel(breakEven.value);
  }

  function replay() {
    beginManualPlayback();
    const values = REPAIR_PRESETS["high-accuracy"];
    setPreset("high-accuracy");
    setAccuracy(values.accuracy);
    setCritiqueScore(values.critiqueScore);
    setConfidenceLevel(REPAIR_DEMO_CONFIDENCE_LEVELS[0]);
    setSelectedMetric("net");
    setAutoplayStep(0);
    setPlaying(true);
  }

  function step() {
    stopAutoplay();
    const next = (autoplayStep + 1) % REPAIR_DEMO_CONFIDENCE_LEVELS.length;
    setPreset("custom");
    setAutoplayStep(next);
    setConfidenceLevel(REPAIR_DEMO_CONFIDENCE_LEVELS[next]);
  }

  function reset() {
    stopAutoplay();
    const values = REPAIR_PRESETS["high-accuracy"];
    setPreset("high-accuracy");
    setAccuracy(values.accuracy);
    setConfidenceLevel(values.confidenceLevel);
    setCritiqueScore(values.critiqueScore);
    setSelectedMetric("net");
    setAutoplayStep(0);
  }

  const scaleMax = Math.max(recovery, damage, 0.005);
  const maxBarWidth = 278;
  const recoveryWidth = (recovery / scaleMax) * maxBarWidth;
  const damageWidth = (damage / scaleMax) * maxBarWidth;
  const netWidth = (Math.abs(netChange) / scaleMax) * maxBarWidth;
  const metricLabels: Record<RepairMetric, string> = {
    recovery: `복구 이득 ${formatSignedPercentagePoints(recovery)}`,
    damage: `훼손 손실 −${(damage * 100).toFixed(2)}%p`,
    net: `순변화 ${formatSignedPercentagePoints(netChange)}`,
  };

  return (
    <div ref={targetRef}>
      <LabShell
        title="복구 이득과 훼손 손실의 손익분기를 찾습니다"
        subtitle="99% 정확도 사례에서 CLₜ를 낮추며 순변화의 부호가 바뀌는 지점을 확인합니다."
        actions={
          <>
            <PlaybackButtons
              playing={playbackActive}
              reducedMotion={reducedMotion}
              onPlay={replay}
              onPause={stopAutoplay}
              onStep={step}
            />
            <button
              className="lab-button"
              type="button"
              onClick={applyBreakEven}
              disabled={breakEven.kind !== "available"}
            >
              <Calculator aria-hidden="true" size={15} />
              손익분기 CLₜ
            </button>
            <ResetButton onClick={reset} />
          </>
        }
        controls={
          <>
            <SegmentedControl<RepairPreset | "custom">
              label="사례"
              value={preset}
              options={[
                { value: "balanced", label: "복구 우세" },
                { value: "high-accuracy", label: "99% 정확도" },
                { value: "harmful", label: "훼손 우세" },
                { value: "custom", label: "직접 조정" },
              ]}
              onChange={(value) => {
                if (value === "custom") {
                  stopAutoplay();
                  setPreset("custom");
                  return;
                }
                applyPreset(value);
              }}
            />
            <RangeControl
              id="repair-accuracy"
              label="현재 정확도 Accₜ"
              value={accuracy}
              min={0}
              max={1}
              step={0.001}
              valueLabel={`Accₜ ${formatPercent(accuracy, 1)}`}
              onChange={(value) => setManualValue(setAccuracy, value)}
            />
            <RangeControl
              id="repair-confidence-level"
              label="정답 보존율 CLₜ"
              value={confidenceLevel}
              min={0}
              max={1}
              step={0.0001}
              valueLabel={`CLₜ ${formatPercent(confidenceLevel, 2)}`}
              onChange={(value) => setManualValue(setConfidenceLevel, value)}
            />
            <RangeControl
              id="repair-critique-score"
              label="오답 복구율 CSₜ"
              value={critiqueScore}
              min={0}
              max={1}
              step={0.01}
              valueLabel={`CSₜ ${formatPercent(critiqueScore, 0)}`}
              onChange={(value) => setManualValue(setCritiqueScore, value)}
            />
          </>
        }
        stageLabel="Net change · recovery − damage"
        legend={[
          { label: "복구 이득", tone: "success" },
          { label: "훼손 손실", tone: "danger" },
          { label: "순변화", tone: "accent" },
        ]}
        status={[
          { label: "판정", value: `${verdict} · ${verdictKorean}` },
          {
            label: "손익분기 CLₜ",
            value:
              breakEven.kind === "available"
                ? formatPercent(breakEven.value, 4)
                : "유효한 단일 값 없음",
          },
          { label: "현재 선택", value: metricLabels[selectedMetric] },
        ]}
        explanation={
          <>
            <strong>
              Accₜ₊₁ − Accₜ = (1 − Accₜ) × CSₜ − Accₜ × (1 −
              CLₜ).
            </strong>{" "}
            막대 길이는 현재 복구와 훼손 중 큰 값을 기준으로 비교하고, 라벨은
            실제 퍼센트포인트를 표시합니다. <strong>{breakEven.message}</strong>
          </>
        }
      >
        <SvgScroll label="복구 이득과 훼손 손실의 손익 막대">
          <svg
            className={`viz-svg viz-wide ${styles.svg}`}
            viewBox="0 0 900 430"
            role="group"
            aria-labelledby={`${titleId} ${descriptionId}`}
          >
            <title id={titleId}>
              자기수정 한 라운드의 복구 이득과 훼손 손실
            </title>
            <desc id={descriptionId}>
              복구 이득, 훼손 손실, 순변화를 비교하고 각 막대를 키보드나
              포인터로 선택할 수 있습니다. 99퍼센트 초기 정확도에서는 작은
              훼손도 순변화를 음수로 만들 수 있습니다.
            </desc>

            <rect
              x="52"
              y="24"
              width="796"
              height="58"
              rx="8"
              className="svg-surface"
            />
            <text
              x="450"
              y="49"
              className={`viz-value ${styles.equation}`}
              textAnchor="middle"
            >
              Accₜ₊₁ − Accₜ = (1 − {accuracy.toFixed(3)}) ×{" "}
              {critiqueScore.toFixed(3)} − {accuracy.toFixed(3)} × (1 −{" "}
              {confidenceLevel.toFixed(4)})
            </text>
            <text x="450" y="70" className="viz-body" textAnchor="middle">
              = {recovery.toFixed(5)} − {damage.toFixed(5)} ={" "}
              {netChange.toFixed(5)}
            </text>

            <line
              x1="450"
              y1="104"
              x2="450"
              y2="362"
              stroke="var(--border-emphasis)"
              strokeWidth="1"
            />
            <text x="450" y="98" className="viz-body" textAnchor="middle">
              0
            </text>

            <g
              className={styles.interactive}
              data-selected={selectedMetric === "recovery"}
              data-dimmed={selectedMetric !== "recovery"}
              role="button"
              tabIndex={0}
              aria-pressed={selectedMetric === "recovery"}
              aria-label={`복구 이득 ${formatSignedPercentagePoints(recovery)}`}
              onClick={() => {
                stopAutoplay();
                setSelectedMetric("recovery");
              }}
              onKeyDown={(event) =>
                activateWithKeyboard(event, () => {
                  stopAutoplay();
                  setSelectedMetric("recovery");
                })
              }
            >
              <rect
                x="48"
                y="120"
                width="804"
                height="68"
                className={styles.metricHitTarget}
              />
              <rect
                x="450"
                y="126"
                width={recoveryWidth}
                height="56"
                rx="6"
                fill="var(--bg-success-muted)"
                stroke="var(--fg-success)"
                className={`${styles.metricBar} ${styles.focusShape}`}
              />
              <text x="64" y="149" className="viz-title">
                복구 이득
              </text>
              <text x="64" y="171" className="viz-body">
                (1 − Accₜ) × CSₜ
              </text>
              <text
                x={Math.min(820, 468 + recoveryWidth)}
                y="159"
                className="viz-value"
              >
                +{(recovery * 100).toFixed(3)}%p
              </text>
            </g>

            <g
              className={styles.interactive}
              data-selected={selectedMetric === "damage"}
              data-dimmed={selectedMetric !== "damage"}
              role="button"
              tabIndex={0}
              aria-pressed={selectedMetric === "damage"}
              aria-label={`훼손 손실 마이너스 ${(damage * 100).toFixed(3)} 퍼센트포인트`}
              onClick={() => {
                stopAutoplay();
                setSelectedMetric("damage");
              }}
              onKeyDown={(event) =>
                activateWithKeyboard(event, () => {
                  stopAutoplay();
                  setSelectedMetric("damage");
                })
              }
            >
              <rect
                x="48"
                y="210"
                width="804"
                height="68"
                className={styles.metricHitTarget}
              />
              <rect
                x={450 - damageWidth}
                y="216"
                width={damageWidth}
                height="56"
                rx="6"
                fill="var(--bg-danger-muted)"
                stroke="var(--fg-danger)"
                className={`${styles.metricBar} ${styles.focusShape}`}
              />
              <text x="836" y="239" className="viz-title" textAnchor="end">
                훼손 손실
              </text>
              <text x="836" y="261" className="viz-body" textAnchor="end">
                Accₜ × (1 − CLₜ)
              </text>
              <text
                x={Math.max(76, 432 - damageWidth)}
                y="249"
                className="viz-value"
                textAnchor="end"
              >
                −{(damage * 100).toFixed(3)}%p
              </text>
            </g>

            <g
              className={styles.interactive}
              data-selected={selectedMetric === "net"}
              data-dimmed={selectedMetric !== "net"}
              role="button"
              tabIndex={0}
              aria-pressed={selectedMetric === "net"}
              aria-label={`순변화 ${formatSignedPercentagePoints(netChange)}, ${verdict}`}
              onClick={() => {
                stopAutoplay();
                setSelectedMetric("net");
              }}
              onKeyDown={(event) =>
                activateWithKeyboard(event, () => {
                  stopAutoplay();
                  setSelectedMetric("net");
                })
              }
            >
              <rect
                x="48"
                y="292"
                width="804"
                height="68"
                className={styles.metricHitTarget}
              />
              <line
                x1="450"
                y1="324"
                x2={450 + (netChange >= 0 ? netWidth : -netWidth)}
                y2="324"
                stroke={
                  verdict === "BENEFICIAL"
                    ? "var(--fg-success)"
                    : verdict === "HARMFUL"
                      ? "var(--fg-danger)"
                      : "var(--fg-attention)"
                }
                strokeWidth="12"
                strokeLinecap="round"
                className={`${styles.netMarker} ${styles.focusShape}`}
              />
              <circle
                cx={450 + (netChange >= 0 ? netWidth : -netWidth)}
                cy="324"
                r="9"
                fill="var(--bg-canvas)"
                stroke={
                  verdict === "BENEFICIAL"
                    ? "var(--fg-success)"
                    : verdict === "HARMFUL"
                      ? "var(--fg-danger)"
                      : "var(--fg-attention)"
                }
                strokeWidth="3"
                className={styles.focusShape}
              />
              <text x="64" y="318" className="viz-title">
                순변화
              </text>
              <text x="64" y="340" className="viz-body">
                복구 이득 − 훼손 손실
              </text>
              <text x="836" y="318" className="viz-value" textAnchor="end">
                {formatSignedPercentagePoints(netChange, 3)}
              </text>
              <text x="836" y="340" className="viz-body" textAnchor="end">
                {verdict}
              </text>
            </g>

            <rect
              x="248"
              y="376"
              width="404"
              height="40"
              rx="7"
              fill={
                verdict === "BENEFICIAL"
                  ? "var(--bg-success-muted)"
                  : verdict === "HARMFUL"
                    ? "var(--bg-danger-muted)"
                    : "var(--bg-attention-muted)"
              }
              stroke={
                verdict === "BENEFICIAL"
                  ? "var(--fg-success)"
                  : verdict === "HARMFUL"
                    ? "var(--fg-danger)"
                    : "var(--fg-attention)"
              }
            />
            <text x="450" y="401" className="viz-value" textAnchor="middle">
              {verdict} · {verdictKorean}
            </text>
          </svg>
        </SvgScroll>

        <details
          className={styles.fallback}
          data-visual-fallback
          onToggle={(event) => {
            if (event.currentTarget.open) stopAutoplay();
          }}
        >
          <summary>손익 계산 데이터 표 보기</summary>
          <div className={styles.fallbackContent}>
            <table>
              <caption className="sr-only">
                현재 입력에서 계산한 복구 이득, 훼손 손실, 순변화
              </caption>
              <thead>
                <tr>
                  <th scope="col">항목</th>
                  <th scope="col">계산</th>
                  <th scope="col">전체에 대한 값</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>복구 이득</td>
                  <td>
                    <code>(1 − Accₜ) × CSₜ</code>
                  </td>
                  <td data-numeric="true">+{(recovery * 100).toFixed(4)}%p</td>
                </tr>
                <tr>
                  <td>훼손 손실</td>
                  <td>
                    <code>Accₜ × (1 − CLₜ)</code>
                  </td>
                  <td data-numeric="true">−{(damage * 100).toFixed(4)}%p</td>
                </tr>
                <tr>
                  <td>순변화</td>
                  <td>복구 이득 − 훼손 손실</td>
                  <td data-numeric="true">
                    {formatSignedPercentagePoints(netChange, 4)}
                  </td>
                </tr>
                <tr>
                  <td>판정</td>
                  <td colSpan={2}>
                    {verdict} · {verdictKorean}
                  </td>
                </tr>
                <tr>
                  <td>손익분기 CLₜ</td>
                  <td colSpan={2}>
                    {breakEven.kind === "available"
                      ? `${formatPercent(breakEven.value, 4)} · ${breakEven.message}`
                      : breakEven.message}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </LabShell>
    </div>
  );
}

const EXPERIMENT_STEPS = [
  {
    label: "첫 전이 측정",
    notation: "Acc₀ · CL · CS",
    detail: "첫 수정 전후의 외부 정답 판정으로 세 값을 추정합니다.",
  },
  {
    label: "닫힌식 계산",
    notation: "Accₜ = Upp − αᵗ(Upp − Acc₀)",
    detail: "같은 CL과 CS를 고정해 2~5라운드의 이론 궤적을 계산합니다.",
  },
  {
    label: "실제 반복",
    notation: "rounds 1…5",
    detail: "같은 reask 절차를 다섯 라운드까지 실제로 반복합니다.",
  },
  {
    label: "곡선 비교",
    notation: "predicted ↔ observed",
    detail: "상승, 포화, 하락의 형태가 정성적으로 맞는지 비교합니다.",
  },
] as const;

const CLAIM_GROUPS = [
  {
    label: "직접 도출",
    short: "고정 전이 모형의 수학",
    items: ["Accₜ₊₁의 전이식", "Upp와 α의 닫힌식", "복구와 훼손의 균형"],
  },
  {
    label: "실험이 지지",
    short: "제한된 5라운드 근거",
    items: [
      "여러 설정의 상승·포화",
      "Are you sure? 하락 사례",
      "일부 CL·CS 안정성",
    ],
  },
  {
    label: "아직 미검증",
    short: "주장하면 안 되는 범위",
    items: [
      "모든 64개 조합의 법칙",
      "5라운드 이후의 보장",
      "최신 tool-using Agent 일반화",
    ],
  },
] as const;

export function ScalingEvidenceExplorer({
  initialConfidenceLevel = 0.9,
  initialCritiqueScore = 0.4,
}: {
  initialConfidenceLevel?: number;
  initialCritiqueScore?: number;
}) {
  const defaults = useMemo(
    () => ({
      confidenceLevel: clampProbability(initialConfidenceLevel),
      critiqueScore: clampProbability(initialCritiqueScore),
    }),
    [initialConfidenceLevel, initialCritiqueScore],
  );
  const [view, setView] = useState<PaperView>("claim-boundary");
  const [confidenceLevel, setConfidenceLevel] = useState(
    defaults.confidenceLevel,
  );
  const [critiqueScore, setCritiqueScore] = useState(defaults.critiqueScore);
  const [selectedCurve, setSelectedCurve] =
    useState<TrajectoryCurveId>("below");
  const [selectedExperimentStep, setSelectedExperimentStep] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState(0);
  const [autoplayStep, setAutoplayStep] = useState(PAPER_VIEWS.length - 1);
  const [playing, setPlaying] = useState(true);
  const { prefix, titleId, descriptionId } = useSvgA11yIds("scaling-evidence");
  const arrowId = `${prefix}-arrow`;
  const {
    targetRef,
    entered,
    reducedMotion,
    cancelPendingAutoplay,
    beginManualPlayback,
  } = useViewportAutoplayGate(() => {
    setView("trajectory");
    setAutoplayStep(0);
    setPlaying(true);
  });
  const playbackActive = playing && entered && !reducedMotion;

  const upp = stationaryUpperBound(confidenceLevel, critiqueScore);
  const alpha = convergenceAlpha(confidenceLevel, critiqueScore);
  const startingAccuracies: Record<TrajectoryCurveId, number> =
    upp === null
      ? { below: 0.25, at: 0.6, above: 0.9 }
      : {
          below: Math.max(0, upp - 0.42),
          at: upp,
          above: Math.min(1, upp + 0.18),
        };
  const trajectories = (
    Object.keys(startingAccuracies) as TrajectoryCurveId[]
  ).map((id) => ({
    id,
    initialAccuracy: startingAccuracies[id],
    points: stationaryTrajectory(
      startingAccuracies[id],
      confidenceLevel,
      critiqueScore,
      5,
    ),
  }));

  useEffect(() => {
    if (!playbackActive) return;
    const timer = window.setTimeout(() => {
      if (autoplayStep < PAPER_VIEWS.length - 1) {
        const next = autoplayStep + 1;
        setAutoplayStep(next);
        setView(PAPER_VIEWS[next]);
      } else {
        setPlaying(false);
      }
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [autoplayStep, playbackActive]);

  function stopAutoplay() {
    cancelPendingAutoplay();
    setPlaying(false);
  }

  function selectView(nextView: PaperView) {
    stopAutoplay();
    setView(nextView);
  }

  function replay() {
    beginManualPlayback();
    setView("trajectory");
    setAutoplayStep(0);
    setPlaying(true);
  }

  function step() {
    stopAutoplay();
    const current = PAPER_VIEWS.indexOf(view);
    const next = (current + 1) % PAPER_VIEWS.length;
    setView(PAPER_VIEWS[next]);
    setAutoplayStep(next);
  }

  function reset() {
    stopAutoplay();
    setView("trajectory");
    setConfidenceLevel(defaults.confidenceLevel);
    setCritiqueScore(defaults.critiqueScore);
    setSelectedCurve("below");
    setSelectedExperimentStep(0);
    setSelectedClaim(0);
    setAutoplayStep(0);
  }

  function setStationaryParameter(
    setter: (value: number) => void,
    value: number,
  ) {
    stopAutoplay();
    setter(value);
  }

  const relationToUpperBound = (initialAccuracy: number) => {
    if (upp === null) return "Upp 단일 값 없음";
    const difference = initialAccuracy - upp;
    if (Math.abs(difference) < 0.0000005) return "Acc₀ = Upp";
    return difference < 0 ? "Acc₀ < Upp" : "Acc₀ > Upp";
  };
  const trajectoryLabels: Record<TrajectoryCurveId, string> = {
    below: `하단 시작 · ${relationToUpperBound(startingAccuracies.below)}`,
    at: `고정점 시작 · ${relationToUpperBound(startingAccuracies.at)}`,
    above: `상단 시작 · ${relationToUpperBound(startingAccuracies.above)}`,
  };
  const trajectoryColors: Record<TrajectoryCurveId, string> = {
    below: "var(--fg-accent)",
    at: "var(--viz-category)",
    above: "var(--viz-warning)",
  };
  const trajectoryDashes: Record<TrajectoryCurveId, string | undefined> = {
    below: undefined,
    at: "8 5",
    above: "2 5",
  };

  const xForRound = (round: number) => 84 + (round / 5) * 622;
  const yForAccuracy = (value: number) => 354 - value * 286;
  const pathForPoints = (points: Array<{ round: number; accuracy: number }>) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${xForRound(point.round).toFixed(1)} ${yForAccuracy(point.accuracy).toFixed(1)}`,
      )
      .join(" ");
  const selectedTrajectory =
    trajectories.find((trajectory) => trajectory.id === selectedCurve) ??
    trajectories[0];
  const firstSelectedAccuracy = selectedTrajectory.points[0].accuracy;
  const lastSelectedAccuracy =
    selectedTrajectory.points[selectedTrajectory.points.length - 1].accuracy;
  const isPeriodTwo = Math.abs(alpha + 1) < 0.0000005;
  const isIdentity = Math.abs(alpha - 1) < 0.0000005;
  const isUpperBoundAtProbabilityBoundary =
    upp !== null && (upp < 0.0000005 || upp > 0.9999995);
  const dynamicsLabel = isIdentity
    ? "항등 전이 · 비수축"
    : isPeriodTwo
      ? "주기 2 · 비수렴"
      : alpha < 0
        ? "교대 수렴"
        : "단조 수렴";
  const selectedDirection =
    isPeriodTwo &&
    Math.abs(firstSelectedAccuracy - (upp ?? firstSelectedAccuracy)) >=
      0.0000005
      ? "Upp 양쪽의 두 값을 반복 · 수렴하지 않음"
      : Math.abs(lastSelectedAccuracy - firstSelectedAccuracy) < 0.000001
        ? isIdentity
          ? "항등 전이 · 변화 없음"
          : "고정점에서 변화 없음"
        : alpha < 0
          ? "Upp 양쪽을 오가며 접근"
          : lastSelectedAccuracy > firstSelectedAccuracy
            ? "Upp를 향해 상승"
            : "Upp를 향해 하락";

  const viewTitle =
    view === "trajectory"
      ? "고정 CL과 CS 아래의 세 정확도 궤적"
      : view === "experiment"
        ? "첫 전이 추정에서 2~5라운드 비교까지의 실험 절차"
        : "직접 도출, 실험이 지지, 아직 미검증인 주장 경계";
  const viewDescription =
    view === "trajectory"
      ? isIdentity
        ? "CL=1, CS=0인 항등 전이에서는 모든 초기 정확도가 그대로 유지되고 단일 Upp가 없습니다."
        : isPeriodTwo
          ? "α=-1 경계에서는 Upp에서 시작한 경우를 제외하고 두 정확도 값을 번갈아 반복합니다."
          : isUpperBoundAtProbabilityBoundary
            ? "Upp가 0 또는 1인 유효 범위 경계에서는 일부 비교 시작점이 Upp와 겹치며, 나머지 궤적은 Upp를 향합니다."
            : "서로 다른 Acc₀가 같은 Upp를 향해 접근하는 라운드별 정확도 궤적입니다."
      : view === "experiment"
        ? "첫 수정에서 Acc₀, CL, CS를 추정하고 이후 이론과 실제 곡선을 비교하는 네 단계입니다."
        : "논문에서 직접 도출한 수학, 제한된 실험이 지지한 범위, 아직 검증되지 않은 일반화를 세 열로 구분합니다.";

  const status =
    view === "trajectory"
      ? [
          {
            label: "Upp",
            value: upp === null ? "단일 값 없음 · CL=1, CS=0" : upp.toFixed(4),
          },
          {
            label: "α = CL − CS",
            value: `${alpha.toFixed(4)} · ${dynamicsLabel}`,
          },
          {
            label: trajectoryLabels[selectedCurve],
            value: `${selectedDirection} · Acc₅ ${formatPercent(lastSelectedAccuracy, 2)}`,
          },
        ]
      : view === "experiment"
        ? [
            {
              label: "선택 단계",
              value: `${selectedExperimentStep + 1}. ${EXPERIMENT_STEPS[selectedExperimentStep].label}`,
            },
            { label: "파라미터 보정", value: "첫 전이 · Acc₀, CL, CS" },
            { label: "미래 비교", value: "주로 2~5라운드" },
          ]
        : [
            { label: "근거 수준", value: CLAIM_GROUPS[selectedClaim].label },
            {
              label: "허용되는 해석",
              value: CLAIM_GROUPS[selectedClaim].short,
            },
            { label: "경계", value: "논문 절차와 데이터 범위만큼" },
          ];

  return (
    <div ref={targetRef}>
      <LabShell
        title="고정점의 예측력과 논문의 주장 경계를 함께 봅니다"
        subtitle="궤적, 실험 절차, 주장 강도를 한 번씩 자동 재생하고 각 보기를 직접 탐색합니다."
        actions={
          <>
            <PlaybackButtons
              playing={playbackActive}
              reducedMotion={reducedMotion}
              onPlay={replay}
              onPause={stopAutoplay}
              onStep={step}
            />
            <ResetButton onClick={reset} />
          </>
        }
        controls={
          <>
            <SegmentedControl<PaperView>
              label="보기"
              value={view}
              options={[
                { value: "trajectory", label: "궤적" },
                { value: "experiment", label: "실험 절차" },
                { value: "claim-boundary", label: "주장 경계" },
              ]}
              onChange={selectView}
            />
            {view === "trajectory" ? (
              <>
                <RangeControl
                  id="scaling-confidence-level"
                  label="정지 모형의 CL"
                  value={confidenceLevel}
                  min={0}
                  max={1}
                  step={0.01}
                  valueLabel={`CL ${formatPercent(confidenceLevel, 0)}`}
                  onChange={(value) =>
                    setStationaryParameter(setConfidenceLevel, value)
                  }
                />
                <RangeControl
                  id="scaling-critique-score"
                  label="정지 모형의 CS"
                  value={critiqueScore}
                  min={0}
                  max={1}
                  step={0.01}
                  valueLabel={`CS ${formatPercent(critiqueScore, 0)}`}
                  onChange={(value) =>
                    setStationaryParameter(setCritiqueScore, value)
                  }
                />
              </>
            ) : null}
          </>
        }
        stageLabel={
          view === "trajectory"
            ? "Stationary transition model · rounds 0…5"
            : view === "experiment"
              ? "Paper evaluation procedure"
              : "Claim boundary · derivation / evidence / unknown"
        }
        legend={
          view === "trajectory"
            ? [
                { label: trajectoryLabels.below, tone: "accent" },
                { label: trajectoryLabels.at, tone: "success" },
                { label: trajectoryLabels.above, tone: "danger" },
              ]
            : view === "claim-boundary"
              ? [
                  { label: "직접 도출", tone: "success" },
                  { label: "실험이 지지", tone: "accent" },
                  { label: "아직 미검증", tone: "attention" },
                ]
              : undefined
        }
        status={status}
        explanation={
          upp === null ? (
            <>
              <strong>CL=1, CS=0에서는 전이가 항등 함수입니다.</strong> 모든
              Acc₀가 그대로 유지되므로 단일 Upp는 없습니다. 논문은 5라운드의
              제한된 설정에서 곡선 형태를 비교했습니다.
            </>
          ) : (
            <>
              <strong>Accₜ = Upp − αᵗ × (Upp − Acc₀)</strong>는 CL과 CS가
              라운드마다 일정한 정지 전이 모형의 결과입니다.{" "}
              {isPeriodTwo
                ? "α=-1이면 Upp 밖의 궤적은 두 값을 번갈아 반복하며 수렴하지 않습니다."
                : "|α|<1이면 궤적이 Upp로 수렴합니다."}{" "}
              논문은 5라운드의 제한된 설정에서 곡선 형태를 비교했습니다.
            </>
          )
        }
      >
        <SvgScroll label={viewTitle}>
          <svg
            className={`viz-svg viz-wide ${styles.svg}`}
            viewBox="0 0 900 430"
            role="group"
            aria-labelledby={`${titleId} ${descriptionId}`}
          >
            <title id={titleId}>{viewTitle}</title>
            <desc id={descriptionId}>{viewDescription}</desc>
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="10"
                markerHeight="10"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M0 0 10 5 0 10Z" fill="var(--border-emphasis)" />
              </marker>
            </defs>

            {view === "trajectory" ? (
              <>
                <rect
                  x="52"
                  y="34"
                  width="696"
                  height="344"
                  rx="8"
                  className="svg-surface"
                />
                {[0, 0.25, 0.5, 0.75, 1].map((accuracyTick) => (
                  <g key={accuracyTick}>
                    <line
                      x1="84"
                      y1={yForAccuracy(accuracyTick)}
                      x2="706"
                      y2={yForAccuracy(accuracyTick)}
                      stroke="var(--border-muted)"
                      strokeWidth="1"
                    />
                    <text
                      x="72"
                      y={yForAccuracy(accuracyTick) + 4}
                      className="viz-body"
                      textAnchor="end"
                    >
                      {Math.round(accuracyTick * 100)}%
                    </text>
                  </g>
                ))}
                {[0, 1, 2, 3, 4, 5].map((round) => (
                  <g key={round}>
                    <line
                      x1={xForRound(round)}
                      y1="68"
                      x2={xForRound(round)}
                      y2="354"
                      stroke="var(--border-muted)"
                      strokeWidth="1"
                    />
                    <text
                      x={xForRound(round)}
                      y="372"
                      className="viz-body"
                      textAnchor="middle"
                    >
                      {round}
                    </text>
                  </g>
                ))}
                <text x="395" y="408" className="viz-body" textAnchor="middle">
                  자기수정 라운드 t
                </text>
                <text
                  x="20"
                  y="218"
                  className="viz-body"
                  textAnchor="middle"
                  transform="rotate(-90 20 218)"
                >
                  정확도 Accₜ
                </text>

                {upp !== null ? (
                  <>
                    <line
                      x1="84"
                      y1={yForAccuracy(upp)}
                      x2="706"
                      y2={yForAccuracy(upp)}
                      stroke="var(--fg-attention)"
                      strokeWidth="1.5"
                      strokeDasharray="10 6"
                    />
                    <text
                      x="698"
                      y={yForAccuracy(upp) - 8}
                      className="viz-value"
                      textAnchor="end"
                    >
                      Upp = {upp.toFixed(3)}
                    </text>
                  </>
                ) : null}

                {trajectories.map((trajectory) => {
                  const selected = trajectory.id === selectedCurve;
                  const path = pathForPoints(trajectory.points);
                  return (
                    <g
                      key={trajectory.id}
                      className={styles.interactive}
                      data-selected={selected}
                      data-dimmed={!selected}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={`${trajectoryLabels[trajectory.id]}, Acc₀ ${formatPercent(trajectory.initialAccuracy, 2)}, Acc₅ ${formatPercent(trajectory.points[5].accuracy, 2)}`}
                      onClick={() => {
                        stopAutoplay();
                        setSelectedCurve(trajectory.id);
                      }}
                      onKeyDown={(event) =>
                        activateWithKeyboard(event, () => {
                          stopAutoplay();
                          setSelectedCurve(trajectory.id);
                        })
                      }
                    >
                      <path d={path} className={styles.flowHitArea} />
                      <path
                        d={path}
                        className={styles.plotLine}
                        stroke={trajectoryColors[trajectory.id]}
                        strokeWidth={selected ? 4 : 2.5}
                        strokeDasharray={trajectoryDashes[trajectory.id]}
                      />
                      {trajectory.points.map((point) => (
                        <circle
                          key={point.round}
                          cx={xForRound(point.round)}
                          cy={yForAccuracy(point.accuracy)}
                          r={selected ? 5 : 3.5}
                          fill="var(--bg-canvas)"
                          stroke={trajectoryColors[trajectory.id]}
                          strokeWidth="2"
                          className={styles.plotPoint}
                        />
                      ))}
                    </g>
                  );
                })}

                <rect
                  x="766"
                  y="50"
                  width="114"
                  height="306"
                  rx="8"
                  className="svg-subtle"
                />
                <text
                  x="823"
                  y="78"
                  className="viz-eyebrow"
                  textAnchor="middle"
                >
                  PAPER MODEL
                </text>
                <text x="786" y="112" className="viz-body">
                  CL
                </text>
                <text x="860" y="112" className="viz-value" textAnchor="end">
                  {confidenceLevel.toFixed(2)}
                </text>
                <text x="786" y="144" className="viz-body">
                  CS
                </text>
                <text x="860" y="144" className="viz-value" textAnchor="end">
                  {critiqueScore.toFixed(2)}
                </text>
                <text x="786" y="176" className="viz-body">
                  Upp
                </text>
                <text x="860" y="176" className="viz-value" textAnchor="end">
                  {upp === null ? "—" : upp.toFixed(3)}
                </text>
                <text x="786" y="208" className="viz-body">
                  α
                </text>
                <text x="860" y="208" className="viz-value" textAnchor="end">
                  {alpha.toFixed(2)}
                </text>
                <line
                  x1="786"
                  y1="232"
                  x2="860"
                  y2="232"
                  stroke="var(--border-default)"
                />
                <text x="823" y="260" className="viz-body" textAnchor="middle">
                  |α| &lt; 1이면 수렴
                </text>
                <text x="823" y="284" className="viz-body" textAnchor="middle">
                  {isIdentity
                    ? "모든 정확도가 고정"
                    : isPeriodTwo
                      ? "Upp 중심의 주기 2"
                      : "Upp가 목적지"}
                </text>
                <text x="823" y="328" className="viz-value" textAnchor="middle">
                  {dynamicsLabel}
                </text>
              </>
            ) : null}

            {view === "experiment" ? (
              <>
                <text
                  x="450"
                  y="34"
                  className="viz-eyebrow"
                  textAnchor="middle"
                >
                  첫 전이에서 파라미터 추정 · 미래 비교는 주로 2~5라운드
                </text>
                {EXPERIMENT_STEPS.map((experimentStep, index) => {
                  const x = 32 + index * 216;
                  const selected = selectedExperimentStep === index;
                  return (
                    <g key={experimentStep.label}>
                      {index < EXPERIMENT_STEPS.length - 1 ? (
                        <line
                          x1={x + 182}
                          y1="146"
                          x2={x + 210}
                          y2="146"
                          stroke="var(--border-emphasis)"
                          strokeWidth="2"
                          markerEnd={`url(#${arrowId})`}
                        />
                      ) : null}
                      <g
                        className={styles.interactive}
                        data-selected={selected}
                        data-dimmed={!selected}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected}
                        aria-label={`${index + 1}단계 ${experimentStep.label}, ${experimentStep.detail}`}
                        onClick={() => {
                          stopAutoplay();
                          setSelectedExperimentStep(index);
                        }}
                        onKeyDown={(event) =>
                          activateWithKeyboard(event, () => {
                            stopAutoplay();
                            setSelectedExperimentStep(index);
                          })
                        }
                      >
                        <rect
                          x={x}
                          y="76"
                          width="182"
                          height="140"
                          rx="8"
                          className={`${styles.focusShape} ${
                            selected ? styles.selectedPlate : styles.labelPlate
                          }`}
                        />
                        <circle
                          cx={x + 24}
                          cy="101"
                          r="13"
                          fill={
                            selected
                              ? "var(--bg-accent-emphasis)"
                              : "var(--bg-subtle)"
                          }
                          stroke={
                            selected
                              ? "var(--fg-accent)"
                              : "var(--border-emphasis)"
                          }
                        />
                        <text
                          x={x + 24}
                          y="106"
                          textAnchor="middle"
                          fill={
                            selected
                              ? "var(--fg-on-emphasis)"
                              : "var(--fg-default)"
                          }
                          className="viz-value"
                        >
                          {index + 1}
                        </text>
                        <text x={x + 18} y="139" className="viz-title">
                          {experimentStep.label}
                        </text>
                        <text x={x + 18} y="168" className="viz-value">
                          {experimentStep.notation}
                        </text>
                        <text x={x + 18} y="193" className="viz-body">
                          {index === 0
                            ? "calibrate"
                            : index === 1
                              ? "predict"
                              : index === 2
                                ? "observe"
                                : "compare"}
                        </text>
                      </g>
                    </g>
                  );
                })}
                <rect
                  x="104"
                  y="268"
                  width="692"
                  height="116"
                  rx="8"
                  className="svg-surface"
                />
                <text x="132" y="298" className="viz-eyebrow">
                  선택한 단계
                </text>
                <text x="132" y="330" className="viz-title">
                  {selectedExperimentStep + 1}.{" "}
                  {EXPERIMENT_STEPS[selectedExperimentStep].label}
                </text>
                <text x="132" y="360" className="viz-body">
                  {EXPERIMENT_STEPS[selectedExperimentStep].detail}
                </text>
              </>
            ) : null}

            {view === "claim-boundary" ? (
              <>
                <text
                  x="450"
                  y="34"
                  className="viz-eyebrow"
                  textAnchor="middle"
                >
                  같은 논문 안에서도 근거 수준을 분리해 읽기
                </text>
                {CLAIM_GROUPS.map((group, index) => {
                  const x = 34 + index * 288;
                  const selected = selectedClaim === index;
                  const tone =
                    index === 0
                      ? "var(--fg-success)"
                      : index === 1
                        ? "var(--fg-accent)"
                        : "var(--fg-attention)";
                  const toneBackground =
                    index === 0
                      ? "var(--bg-success-muted)"
                      : index === 1
                        ? "var(--bg-accent-muted)"
                        : "var(--bg-attention-muted)";
                  return (
                    <g
                      key={group.label}
                      className={styles.interactive}
                      data-selected={selected}
                      data-dimmed={!selected}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={`${group.label}. ${group.items.join(". ")}`}
                      onClick={() => {
                        stopAutoplay();
                        setSelectedClaim(index);
                      }}
                      onKeyDown={(event) =>
                        activateWithKeyboard(event, () => {
                          stopAutoplay();
                          setSelectedClaim(index);
                        })
                      }
                    >
                      <rect
                        x={x}
                        y="66"
                        width="256"
                        height="318"
                        rx="9"
                        className={`${styles.claimPanel} ${styles.focusShape}`}
                        fill={selected ? toneBackground : "var(--bg-canvas)"}
                        stroke={selected ? tone : "var(--border-default)"}
                        strokeWidth={selected ? 2.5 : 1}
                      />
                      <rect
                        x={x + 18}
                        y="88"
                        width="114"
                        height="28"
                        rx="14"
                        fill={toneBackground}
                        stroke={tone}
                      />
                      <text
                        x={x + 75}
                        y="107"
                        className="viz-value"
                        textAnchor="middle"
                      >
                        {group.label}
                      </text>
                      <text x={x + 18} y="151" className="viz-title">
                        {group.short}
                      </text>
                      <line
                        x1={x + 18}
                        y1="169"
                        x2={x + 238}
                        y2="169"
                        stroke="var(--border-default)"
                      />
                      {group.items.map((item, itemIndex) => (
                        <g
                          key={item}
                          transform={`translate(${x + 18} ${202 + itemIndex * 62})`}
                        >
                          <circle cx="6" cy="-4" r="4" fill={tone} />
                          <text x="20" y="0" className="viz-body">
                            {item}
                          </text>
                          <text x="20" y="21" className="viz-body">
                            {index === 0
                              ? "정지 가정 아래 성립"
                              : index === 1
                                ? "논문 설정에서 관찰"
                                : "추가 평가가 필요"}
                          </text>
                        </g>
                      ))}
                      <text
                        x={x + 128}
                        y="365"
                        className="viz-value"
                        textAnchor="middle"
                      >
                        {selected ? "SELECTED" : "선택해 읽기"}
                      </text>
                    </g>
                  );
                })}
              </>
            ) : null}
          </svg>
        </SvgScroll>

        <details
          className={styles.fallback}
          data-visual-fallback
          onToggle={(event) => {
            if (event.currentTarget.open) stopAutoplay();
          }}
        >
          <summary>
            {view === "trajectory"
              ? "라운드별 궤적 데이터 표 보기"
              : view === "experiment"
                ? "실험 절차 목록 보기"
                : "주장 경계 목록 보기"}
          </summary>
          <div className={styles.fallbackContent}>
            {view === "trajectory" ? (
              <table>
                <caption className="sr-only">
                  서로 다른 Acc₀에서 시작한 0~5라운드 정확도 궤적
                </caption>
                <thead>
                  <tr>
                    <th scope="col">라운드</th>
                    {trajectories.map((trajectory) => (
                      <th scope="col" key={trajectory.id}>
                        {trajectoryLabels[trajectory.id]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5].map((round) => (
                    <tr key={round}>
                      <th scope="row">{round}</th>
                      {trajectories.map((trajectory) => (
                        <td data-numeric="true" key={trajectory.id}>
                          {formatPercent(trajectory.points[round].accuracy, 3)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : view === "experiment" ? (
              <ol>
                {EXPERIMENT_STEPS.map((experimentStep) => (
                  <li key={experimentStep.label}>
                    <strong>{experimentStep.label}</strong> —{" "}
                    <code>{experimentStep.notation}</code>.{" "}
                    {experimentStep.detail}
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.fallbackGrid}>
                {CLAIM_GROUPS.map((group) => (
                  <section key={group.label}>
                    <h4>{group.label}</h4>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </details>
      </LabShell>
    </div>
  );
}
