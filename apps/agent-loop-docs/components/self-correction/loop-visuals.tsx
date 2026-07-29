"use client";

import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  LabShell,
  RangeControl,
  SegmentedControl,
} from "@/components/visualizations/viz-shell";
import {
  DIAGNOSTIC_CASES,
  LOOP_PHASES,
  LOOP_POLICY_SECTIONS,
  OFFICIAL_AUTORESEARCH_FIXTURE,
  OFFICIAL_RESEARCH_CONTRACT,
  THEORY_TRANSFER_ROWS,
  determineStopReason,
  formatMetric,
  formatPeakMemory,
  outcomeLabel,
  type AutoresearchOutcome,
  type CriterionMode,
  type StopInputs,
} from "./loop-model";
import styles from "./loop-visuals.module.css";

type PlaybackController = {
  step: number;
  isPlaying: boolean;
  completed: boolean;
  prefersReducedMotion: boolean;
  select: (step: number) => void;
  move: (delta: number) => void;
  toggle: () => void;
  replay: () => void;
  pauseForUser: () => void;
};

function useReducedMotion() {
  const [ready, setReady] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setPrefersReducedMotion(mediaQuery.matches);
      setReady(true);
    };

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return { ready, prefersReducedMotion };
}

function useOnePassPlayback(
  stepCount: number,
  intervalMilliseconds = 1500,
): [PlaybackController, (node: HTMLDivElement | null) => void] {
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasAutoplayed = useRef(false);
  const userInteracted = useRef(false);
  const { ready, prefersReducedMotion } = useReducedMotion();
  const setViewportNode = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
  }, []);

  useEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;

    if (typeof IntersectionObserver === "undefined") {
      const fallbackTimer = globalThis.setTimeout(
        () => setHasEnteredViewport(true),
        0,
      );
      return () => globalThis.clearTimeout(fallbackTimer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasEnteredViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
    );

    observer.observe(viewportNode);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      !ready ||
      !hasEnteredViewport ||
      hasAutoplayed.current ||
      userInteracted.current
    )
      return;
    hasAutoplayed.current = true;

    const kickoffTimer = window.setTimeout(() => {
      if (userInteracted.current) return;
      if (prefersReducedMotion) {
        setStep(stepCount - 1);
        setCompleted(true);
        return;
      }

      setStep(0);
      setCompleted(false);
      setIsPlaying(true);
    }, 0);

    return () => window.clearTimeout(kickoffTimer);
  }, [hasEnteredViewport, prefersReducedMotion, ready, stepCount]);

  useEffect(() => {
    if (!ready || !prefersReducedMotion) return;
    const stopTimer = window.setTimeout(() => setIsPlaying(false), 0);
    return () => window.clearTimeout(stopTimer);
  }, [prefersReducedMotion, ready]);

  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) return;

    const timer = window.setTimeout(() => {
      setStep((currentStep) => {
        if (currentStep >= stepCount - 1) {
          setIsPlaying(false);
          setCompleted(true);
          return currentStep;
        }
        return currentStep + 1;
      });
    }, intervalMilliseconds);

    return () => window.clearTimeout(timer);
  }, [
    intervalMilliseconds,
    isPlaying,
    prefersReducedMotion,
    step,
    stepCount,
  ]);

  function select(nextStep: number) {
    userInteracted.current = true;
    const boundedStep = Math.max(0, Math.min(stepCount - 1, nextStep));
    setIsPlaying(false);
    setStep(boundedStep);
    setCompleted(boundedStep === stepCount - 1);
  }

  function move(delta: number) {
    select(step + delta);
  }

  function toggle() {
    userInteracted.current = true;
    if (prefersReducedMotion) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (step >= stepCount - 1) {
      setStep(0);
      setCompleted(false);
    }
    setIsPlaying(true);
  }

  function replay() {
    userInteracted.current = true;
    if (prefersReducedMotion) return;
    setStep(0);
    setCompleted(false);
    setIsPlaying(true);
  }

  function pauseForUser() {
    userInteracted.current = true;
    setIsPlaying(false);
  }

  return [
    {
      step,
      isPlaying,
      completed,
      prefersReducedMotion,
      select,
      move,
      toggle,
      replay,
      pauseForUser,
    },
    setViewportNode,
  ];
}

function PlaybackActions({
  playback,
  stepCount,
}: {
  playback: PlaybackController;
  stepCount: number;
}) {
  const toggleLabel = playback.isPlaying
    ? "자동 재생 일시정지"
    : playback.prefersReducedMotion
      ? "동작 줄이기 설정에서는 자동 재생을 사용할 수 없음"
      : playback.completed
      ? "처음부터 자동 재생"
      : "자동 재생 계속";

  return (
    <>
      <button
        className="lab-icon-button"
        type="button"
        onClick={() => playback.move(-1)}
        disabled={playback.step === 0}
        aria-label="이전 단계"
        title="이전 단계"
      >
        <ChevronLeft aria-hidden="true" size={18} />
      </button>
      <button
        className="lab-icon-button"
        type="button"
        onClick={playback.toggle}
        disabled={playback.prefersReducedMotion}
        aria-label={toggleLabel}
        title={toggleLabel}
      >
        {playback.isPlaying ? (
          <Pause aria-hidden="true" size={17} />
        ) : (
          <Play aria-hidden="true" size={17} />
        )}
      </button>
      <button
        className="lab-icon-button"
        type="button"
        onClick={() => playback.move(1)}
        disabled={playback.step === stepCount - 1}
        aria-label="다음 단계"
        title="다음 단계"
      >
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      <button
        className="lab-icon-button"
        type="button"
        onClick={playback.replay}
        disabled={playback.prefersReducedMotion}
        aria-label="자동 재생 다시 보기"
        title="자동 재생 다시 보기"
      >
        <RotateCcw aria-hidden="true" size={17} />
      </button>
    </>
  );
}

function PlaybackViewport({
  setViewportNode,
  children,
}: {
  setViewportNode: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  return (
    <div ref={setViewportNode} className={styles.viewportGate}>
      {children}
    </div>
  );
}

function activateOnKey(
  event: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    activate();
  }
}

function useSvgIds(prefix: string) {
  const reactId = useId().replaceAll(":", "");
  return {
    titleId: `${prefix}-title-${reactId}`,
    descriptionId: `${prefix}-description-${reactId}`,
    arrowId: `${prefix}-arrow-${reactId}`,
    accentArrowId: `${prefix}-accent-arrow-${reactId}`,
    successArrowId: `${prefix}-success-arrow-${reactId}`,
    dangerArrowId: `${prefix}-danger-arrow-${reactId}`,
    glowId: `${prefix}-glow-${reactId}`,
    gradientId: `${prefix}-gradient-${reactId}`,
  };
}

function SvgDefinitions({
  ids,
}: {
  ids: ReturnType<typeof useSvgIds>;
}) {
  return (
    <defs>
      <marker
        id={ids.arrowId}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        markerUnits="userSpaceOnUse"
        orient="auto"
      >
        <path d="M0 0 10 5 0 10Z" fill="var(--border-emphasis)" />
      </marker>
      <marker
        id={ids.accentArrowId}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        markerUnits="userSpaceOnUse"
        orient="auto"
      >
        <path d="M0 0 10 5 0 10Z" fill="var(--fg-accent)" />
      </marker>
      <marker
        id={ids.successArrowId}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        markerUnits="userSpaceOnUse"
        orient="auto"
      >
        <path d="M0 0 10 5 0 10Z" fill="var(--fg-success)" />
      </marker>
      <marker
        id={ids.dangerArrowId}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        markerUnits="userSpaceOnUse"
        orient="auto"
      >
        <path d="M0 0 10 5 0 10Z" fill="var(--fg-danger)" />
      </marker>
      <filter id={ids.glowId} x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow
          dx="0"
          dy="5"
          stdDeviation="7"
          floodColor="var(--fg-accent)"
          floodOpacity="0.18"
        />
      </filter>
      <linearGradient id={ids.gradientId} x1="0" x2="1">
        <stop offset="0" stopColor="var(--bg-accent-muted)" />
        <stop offset="0.54" stopColor="var(--bg-canvas)" />
        <stop offset="1" stopColor="var(--bg-success-muted)" />
      </linearGradient>
    </defs>
  );
}

function splitSvgLines(
  text: string,
  maxCharacters = 31,
  maxLines = 2,
) {
  if (text.length <= maxCharacters) return [text];

  const words = text.split(/\s+/).flatMap((word) => {
    if (word.length <= maxCharacters) return [word];
    const delimiter = word.includes("_") ? "_" : word.includes("-") ? "-" : "";
    if (!delimiter) {
      return Array.from(
        { length: Math.ceil(word.length / maxCharacters) },
        (_, index) =>
          word.slice(index * maxCharacters, (index + 1) * maxCharacters),
      );
    }

    const parts = word.split(delimiter);
    return parts
      .filter(Boolean)
      .map((part, index) =>
        index < parts.length - 1 ? `${part}${delimiter}` : part,
      );
  });
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const separator =
      currentLine.endsWith("_") || currentLine.endsWith("-") ? "" : " ";
    const nextLine = currentLine ? `${currentLine}${separator}${word}` : word;
    if (nextLine.length <= maxCharacters || currentLine.length === 0) {
      currentLine = nextLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.slice(0, maxLines);
}

function SvgMultilineText({
  text,
  x,
  y,
  className = "viz-body",
  maxCharacters,
  maxLines = 2,
  lineHeight = 16,
  textAnchor,
}: {
  text: string;
  x: number;
  y: number;
  className?: string;
  maxCharacters?: number;
  maxLines?: number;
  lineHeight?: number;
  textAnchor?: "start" | "middle" | "end";
}) {
  return (
    <text className={className} x={x} y={y} textAnchor={textAnchor}>
      {splitSvgLines(text, maxCharacters, maxLines).map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function VisualFallback({
  label,
  children,
  onUserInteraction,
}: {
  label: string;
  children: ReactNode;
  onUserInteraction: () => void;
}) {
  return (
    <details
      className={styles.fallback}
      data-visual-fallback
      onToggle={onUserInteraction}
    >
      <summary>{label}</summary>
      <div className={styles.fallbackBody}>{children}</div>
    </details>
  );
}

export function TheoryToLoopBridge() {
  const [playback, setViewportNode] = useOnePassPlayback(
    THEORY_TRANSFER_ROWS.length,
    1450,
  );
  const [criterionMode, setCriterionMode] =
    useState<CriterionMode>("binary");
  const ids = useSvgIds("theory-loop-bridge");
  const selectedRow = THEORY_TRANSFER_ROWS[playback.step];
  const engineeringText =
    criterionMode === "scalar" && selectedRow.scalarAlternative
      ? selectedRow.scalarAlternative
      : selectedRow.engineering;

  function selectCriterionMode(nextMode: CriterionMode) {
    playback.pauseForUser();
    setCriterionMode(nextMode);
  }

  return (
    <PlaybackViewport setViewportNode={setViewportNode}>
      <LabShell
      title="논문의 전이 회계에서 Autoresearch형 loop로 건너가는 경계"
      subtitle="같은 dynamics라고 가정하지 않고, 옮길 질문과 옮기지 않을 고정점 해석을 한 행씩 확인합니다."
      actions={
        <PlaybackActions
          playback={playback}
          stepCount={THEORY_TRANSFER_ROWS.length}
        />
      }
      controls={
        <SegmentedControl<CriterionMode>
          label="평가 단위"
          value={criterionMode}
          options={[
            { value: "binary", label: "사례별 pass/fail" },
            { value: "scalar", label: "연속형 metric" },
          ]}
          onChange={selectCriterionMode}
        />
      }
      stageLabel={`전환 행 ${playback.step + 1} / ${THEORY_TRANSFER_ROWS.length} · ${criterionMode === "binary" ? "전이 회계 사용 가능" : "metric 비교 사용"}`}
      legend={[
        { label: "논문 직접 범위", tone: "accent" },
        { label: "전환 조건", tone: "attention" },
        { label: "엔지니어링 적용", tone: "success" },
      ]}
      status={[
        {
          label: "현재 논문 요소",
          value: selectedRow.paper,
        },
        {
          label: "전환 조건",
          value: selectedRow.transferCondition,
        },
        {
          label: "적용 결과",
          value: engineeringText,
        },
      ]}
      explanation={
        <>
          <strong>{selectedRow.paper}</strong>를{" "}
          {selectedRow.transferCondition} 조건 아래에서만 옮깁니다. 사용자
          조작은 자동 재생을 즉시 멈춥니다.
        </>
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="논문 모형과 Autoresearch형 loop의 대응 관계, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className={`viz-svg viz-wide ${styles.bridgeSvg}`}
          viewBox="0 0 1000 540"
          role="group"
          aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
        >
          <title id={ids.titleId}>
            논문의 자기수정 상태에서 Autoresearch형 실험 상태로 이어지는 적용
            경계
          </title>
          <desc id={ids.descriptionId}>
            왼쪽에는 논문의 직접 범위, 가운데에는 전환 조건, 오른쪽에는
            엔지니어링 적용을 여섯 행으로 표시합니다. 선택한 행과 평가
            단위에 따라 대응 설명이 바뀝니다.
          </desc>
          <SvgDefinitions ids={ids} />

          <rect
            x="26"
            y="20"
            width="948"
            height="466"
            rx="12"
            fill={`url(#${ids.gradientId})`}
            stroke="var(--border-muted)"
          />
          <line
            x1="352"
            y1="20"
            x2="352"
            y2="486"
            className="viz-divider"
          />
          <line
            x1="628"
            y1="20"
            x2="628"
            y2="486"
            className="viz-divider"
          />

          <text className="viz-eyebrow" x="54" y="50">
            PAPER MODEL
          </text>
          <text className="viz-title" x="54" y="76">
            같은 응답의 자기수정
          </text>
          <text className="viz-eyebrow" x="380" y="50">
            TRANSFER CONDITION
          </text>
          <text className="viz-title" x="380" y="76">
            적용 경계
          </text>
          <text className="viz-eyebrow" x="656" y="50">
            ENGINEERING TRANSFER
          </text>
          <text className="viz-title" x="656" y="76">
            격리된 artifact experiment
          </text>

          {THEORY_TRANSFER_ROWS.map((row, index) => {
            const rowY = 100 + index * 60;
            const selected = index === playback.step;
            const rowEngineering =
              criterionMode === "scalar" && row.scalarAlternative
                ? row.scalarAlternative
                : row.engineering;

            return (
              <g
                key={row.id}
                role="button"
                tabIndex={0}
                aria-label={`${index + 1}번째 전환: ${row.paper}. ${row.transferCondition}. ${rowEngineering}`}
                aria-pressed={selected}
                className="viz-interactive"
                onClick={() => playback.select(index)}
                onKeyDown={(event) =>
                  activateOnKey(event, () => playback.select(index))
                }
              >
                <rect
                  x="42"
                  y={rowY - 5}
                  width="916"
                  height="60"
                  rx="8"
                  className={styles.svgHitTarget}
                />
                <rect
                  x="42"
                  y={rowY}
                  width="916"
                  height="50"
                  rx="8"
                  fill={
                    selected
                      ? "color-mix(in srgb, var(--bg-accent-muted) 58%, var(--bg-canvas))"
                      : "var(--bg-canvas)"
                  }
                  stroke={
                    selected ? "var(--fg-accent)" : "var(--border-muted)"
                  }
                  filter={selected ? `url(#${ids.glowId})` : undefined}
                />
                <rect
                  x="52"
                  y={rowY + 9}
                  width="286"
                  height="32"
                  rx="6"
                  className={selected ? "viz-node-accent" : "viz-node"}
                />
                <SvgMultilineText
                  text={row.paper}
                  x={68}
                  y={rowY + 29}
                  maxCharacters={31}
                />
                <path
                  d={`M338 ${rowY + 25} H366`}
                  className={
                    selected
                      ? "viz-flow viz-flow-accent"
                      : "viz-flow"
                  }
                  markerEnd={`url(#${selected ? ids.accentArrowId : ids.arrowId})`}
                />
                <SvgMultilineText
                  text={row.transferCondition}
                  x={490}
                  y={rowY + 22}
                  maxCharacters={25}
                  textAnchor="middle"
                />
                <path
                  d={`M614 ${rowY + 25} H642`}
                  className={
                    selected
                      ? "viz-flow viz-flow-success"
                      : "viz-flow"
                  }
                  markerEnd={`url(#${selected ? ids.successArrowId : ids.arrowId})`}
                />
                <rect
                  x="652"
                  y={rowY + 9}
                  width="296"
                  height="32"
                  rx="6"
                  className={selected ? "viz-node-success" : "viz-node"}
                />
                <SvgMultilineText
                  text={rowEngineering}
                  x={668}
                  y={rowY + 29}
                  maxCharacters={34}
                />
                <rect
                  className={styles.svgHitTarget}
                  x="42"
                  y={rowY - 5}
                  width="916"
                  height="60"
                  rx="8"
                />
              </g>
            );
          })}

          <rect
            x="42"
            y="478"
            width="916"
            height="46"
            rx="8"
            fill="var(--bg-attention-muted)"
            stroke="var(--fg-attention)"
          />
          <text
            className="viz-eyebrow"
            x="60"
            y="497"
            fill="var(--fg-attention)"
          >
            BOUNDARY
          </text>
          <text className="viz-body" x="60" y="516">
            Adaptive proposal에서는 고정 CL / CS 가정이 깨지므로 Upp를
            campaign utility나 stop target으로 사용하지 않습니다.
          </text>
        </svg>
      </div>

      <VisualFallback
        label="전환 관계를 표로 보기"
        onUserInteraction={playback.pauseForUser}
      >
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th scope="col">논문</th>
                <th scope="col">전환 조건</th>
                <th scope="col">현재 적용</th>
              </tr>
            </thead>
            <tbody>
              {THEORY_TRANSFER_ROWS.map((row, index) => (
                <tr
                  key={row.id}
                  data-selected={index === playback.step ? "true" : undefined}
                >
                  <td>{row.paper}</td>
                  <td>{row.transferCondition}</td>
                  <td>
                    {criterionMode === "scalar" && row.scalarAlternative
                      ? row.scalarAlternative
                      : row.engineering}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VisualFallback>
      </LabShell>
    </PlaybackViewport>
  );
}

const OUTCOME_RECORD_INDEX: Record<AutoresearchOutcome, number> = {
  KEEP: 1,
  DISCARD: 2,
  CRASH: 3,
};

export function AutoresearchLoopMap() {
  const [playback, setViewportNode] = useOnePassPlayback(
    LOOP_PHASES.length,
    1450,
  );
  const [outcome, setOutcome] = useState<AutoresearchOutcome>("KEEP");
  const ids = useSvgIds("autoresearch-loop");
  const activePhase = LOOP_PHASES[playback.step];
  const record = OFFICIAL_AUTORESEARCH_FIXTURE[OUTCOME_RECORD_INDEX[outcome]];

  function selectOutcome(nextOutcome: AutoresearchOutcome) {
    playback.pauseForUser();
    setOutcome(nextOutcome);
  }

  const phasePositions = [
    { x: 48, y: 178, width: 126 },
    { x: 202, y: 178, width: 126 },
    { x: 356, y: 178, width: 126 },
    { x: 510, y: 178, width: 126 },
    { x: 664, y: 178, width: 126 },
    { x: 818, y: 178, width: 126 },
    { x: 434, y: 376, width: 166 },
  ];

  return (
    <PlaybackViewport setViewportNode={setViewportNode}>
      <LabShell
      title="고정된 계약 아래 한 건의 experiment transaction을 완결하는 loop"
      subtitle="공식 illustrative fixture로 Incumbent 보호, Challenger 격리, external harness, 판정, ledger 갱신을 재생합니다."
      actions={
        <PlaybackActions
          playback={playback}
          stepCount={LOOP_PHASES.length}
        />
      }
      controls={
        <SegmentedControl<AutoresearchOutcome>
          label="공식 illustrative 결과"
          value={outcome}
          options={[
            { value: "KEEP", label: "KEEP" },
            { value: "DISCARD", label: "DISCARD" },
            { value: "CRASH", label: "CRASH" },
          ]}
          onChange={selectOutcome}
        />
      }
      stageLabel={`공식 사례 → 엔지니어링 일반화 · 단계 ${playback.step + 1} / ${LOOP_PHASES.length}`}
      legend={[
        { label: "고정 계약", tone: "accent" },
        { label: "채택 가능 상태", tone: "success" },
        { label: "실행·판정", tone: "attention" },
        { label: "실패", tone: "danger" },
      ]}
      status={[
        {
          label: "현재 단계",
          value: `${activePhase.shortLabel} · ${activePhase.title}`,
        },
        {
          label: "선택한 결과",
          value: `${outcome} · ${formatMetric(record)}`,
        },
        {
          label: "Incumbent after",
          value: record.incumbentAfter,
        },
      ]}
      explanation={
        <>
          <strong>{activePhase.owner}</strong>가 담당합니다.{" "}
          {activePhase.changed}이며, {activePhase.persisted}를 보존합니다.
        </>
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="Autoresearch형 loop 한 iteration, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className={`viz-svg viz-wide ${styles.loopSvg}`}
          viewBox="0 0 1000 540"
          role="group"
          aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
        >
          <title id={ids.titleId}>
            Research contract에서 Experiment ledger까지 이어지는
            Autoresearch형 loop
          </title>
          <desc id={ids.descriptionId}>
            고정된 research contract 아래 현재 Incumbent에서 가설과 격리된
            Challenger를 만들고, frozen harness로 실행한 뒤 KEEP, DISCARD,
            CRASH를 판정해 ledger와 derived memory를 갱신합니다.
          </desc>
          <SvgDefinitions ids={ids} />

          <rect
            x="28"
            y="20"
            width="944"
            height="500"
            rx="12"
            className="viz-lane"
          />
          <rect
            x="48"
            y="46"
            width="896"
            height="88"
            rx="10"
            className={
              activePhase.id === "contract"
                ? "viz-node-accent"
                : "viz-node"
            }
            filter={
              activePhase.id === "contract"
                ? `url(#${ids.glowId})`
                : undefined
            }
          />
          <text className="viz-eyebrow" x="68" y="70">
            RESEARCH CONTRACT · OFFICIAL EXAMPLE
          </text>
          <text className="viz-title" x="68" y="96">
            mutable {OFFICIAL_RESEARCH_CONTRACT.mutableArtifact} · frozen{" "}
            {OFFICIAL_RESEARCH_CONTRACT.frozenHarness}
          </text>
          <text className="viz-body" x="68" y="119">
            {OFFICIAL_RESEARCH_CONTRACT.metric} ·{" "}
            {OFFICIAL_RESEARCH_CONTRACT.trialBudget} · ledger{" "}
            {OFFICIAL_RESEARCH_CONTRACT.ledger}
          </text>

          {phasePositions.slice(0, 6).map((position, index) => {
            const phase = LOOP_PHASES[index];
            const selected = index === playback.step;
            const completed = index < playback.step;
            const nodeClass =
              selected
                ? "viz-node-accent"
                : completed
                  ? "viz-node-success"
                  : phase.id === "execution" || phase.id === "verdict"
                    ? "viz-node-attention"
                    : "viz-node";

            return (
              <g
                key={phase.id}
                role="button"
                tabIndex={0}
                aria-label={`${index + 1}단계 ${phase.title}`}
                aria-pressed={selected}
                className="viz-interactive"
                onClick={() => playback.select(index)}
                onKeyDown={(event) =>
                  activateOnKey(event, () => playback.select(index))
                }
              >
                {index < 5 ? (
                  <path
                    d={`M${position.x + position.width} 226 H${phasePositions[index + 1].x - 10}`}
                    className={
                      completed
                        ? "viz-flow viz-flow-success"
                        : "viz-flow"
                    }
                    markerEnd={`url(#${completed ? ids.successArrowId : ids.arrowId})`}
                  />
                ) : null}
                <rect
                  x={position.x}
                  y={position.y}
                  width={position.width}
                  height="112"
                  rx="8"
                  className={nodeClass}
                  filter={selected ? `url(#${ids.glowId})` : undefined}
                />
                <text
                  className="viz-eyebrow"
                  x={position.x + 14}
                  y={position.y + 23}
                >
                  {String(index + 1).padStart(2, "0")} · {phase.shortLabel}
                </text>
                <SvgMultilineText
                  text={phase.title}
                  x={position.x + 14}
                  y={position.y + 49}
                  className="viz-title"
                  maxCharacters={13}
                  maxLines={4}
                  lineHeight={16}
                />
              </g>
            );
          })}

          <path
            d="M881 290 V324 H680"
            className={`viz-flow ${
              outcome === "KEEP"
                ? "viz-flow-success"
                : outcome === "CRASH"
                  ? "viz-flow-danger"
                  : "viz-flow-attention"
            }`}
            markerEnd={`url(#${
              outcome === "KEEP"
                ? ids.successArrowId
                : outcome === "CRASH"
                  ? ids.dangerArrowId
                  : ids.arrowId
            })`}
          />
          <rect
            x="680"
            y="302"
            width="264"
            height="72"
            rx="9"
            className={
              outcome === "KEEP"
                ? "viz-node-success"
                : outcome === "CRASH"
                  ? "viz-node-danger"
                  : "viz-node-attention"
            }
          />
          <text className="viz-eyebrow" x="698" y="327">
            {outcome}
          </text>
          <text className="viz-title" x="698" y="351">
            {outcome === "KEEP"
              ? "Challenger가 다음 Incumbent"
              : "현재 Incumbent 유지"}
          </text>

          <path
            d="M680 338 H620 V410 H604"
            className={
              activePhase.id === "ledger"
                ? "viz-flow viz-flow-accent"
                : "viz-flow"
            }
            markerEnd={`url(#${activePhase.id === "ledger" ? ids.accentArrowId : ids.arrowId})`}
          />
          <g
            role="button"
            tabIndex={0}
            aria-label="7단계 Experiment ledger와 Derived memory"
            aria-pressed={playback.step === 6}
            className="viz-interactive"
            onClick={() => playback.select(6)}
            onKeyDown={(event) =>
              activateOnKey(event, () => playback.select(6))
            }
          >
            <rect
              x={phasePositions[6].x}
              y={phasePositions[6].y}
              width={phasePositions[6].width}
              height="82"
              rx="9"
              className={
                playback.step === 6 ? "viz-node-accent" : "viz-node"
              }
              filter={
                playback.step === 6 ? `url(#${ids.glowId})` : undefined
              }
            />
            <text
              className="viz-eyebrow"
              x={phasePositions[6].x + 16}
              y={phasePositions[6].y + 25}
            >
              07 · 기억
            </text>
            <text
              className="viz-title"
              x={phasePositions[6].x + 16}
              y={phasePositions[6].y + 50}
            >
              Experiment ledger
            </text>
            <text
              className="viz-body"
              x={phasePositions[6].x + 16}
              y={phasePositions[6].y + 70}
            >
              → Derived memory
            </text>
          </g>

          <path
            d="M434 418 H190 V292"
            className="viz-flow viz-flow-accent"
            strokeDasharray="7 5"
            markerEnd={`url(#${ids.accentArrowId})`}
          />
          <text className="viz-body" x="208" y="404">
            다음 proposal에 실패까지 전달
          </text>

          <rect
            x="48"
            y="472"
            width="896"
            height="34"
            rx="6"
            fill="var(--bg-subtle)"
            stroke="var(--border-muted)"
          />
          <text className="viz-body" x="64" y="494">
            revision {record.revision} · val_bpb {formatMetric(record)} · peak
            memory {formatPeakMemory(record)} · incumbent after{" "}
            {record.incumbentAfter}
          </text>
        </svg>
      </div>

      <VisualFallback
        label="현재 experiment와 loop 단계를 표로 보기"
        onUserInteraction={playback.pauseForUser}
      >
        <div className={styles.fallbackGrid}>
          <table>
            <caption>선택한 공식 illustrative experiment</caption>
            <tbody>
              <tr>
                <th scope="row">Revision</th>
                <td>{record.revision}</td>
              </tr>
              <tr>
                <th scope="row">Metric</th>
                <td>{formatMetric(record)}</td>
              </tr>
              <tr>
                <th scope="row">Peak memory</th>
                <td>{formatPeakMemory(record)}</td>
              </tr>
              {!record.observationValid ? (
                <>
                  <tr>
                    <th scope="row">Raw metric sentinel</th>
                    <td>
                      <code>{record.rawMetric.toFixed(6)}</code>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Raw memory sentinel</th>
                    <td>
                      <code>
                        {record.rawPeakMemoryGigabytes.toFixed(1)}
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Sentinel provenance</th>
                    <td>
                      공식 illustrative results.tsv의 crash sentinel이며 성능
                      측정값이 아닙니다.
                    </td>
                  </tr>
                </>
              ) : null}
              <tr>
                <th scope="row">Verdict</th>
                <td>{outcomeLabel(record.outcome)}</td>
              </tr>
              <tr>
                <th scope="row">Incumbent after</th>
                <td>{record.incumbentAfter}</td>
              </tr>
            </tbody>
          </table>
          <ol className={styles.phaseList}>
            {LOOP_PHASES.map((phase, index) => (
              <li
                key={phase.id}
                data-selected={index === playback.step ? "true" : undefined}
              >
                <strong>{phase.title}</strong>
                <span>
                  {phase.owner} · {phase.persisted}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </VisualFallback>
      </LabShell>
    </PlaybackViewport>
  );
}

type WorkbenchMode = "replay" | "diagnose" | "stop";
type StopPreset =
  | "continue"
  | "success"
  | "plateau"
  | "safety"
  | "budget"
  | "harness"
  | "human"
  | "cycle"
  | "manual"
  | "direct";

const WORKBENCH_STEP_COUNT = 6;

function workbenchModeForStep(step: number): WorkbenchMode {
  if (step <= 3) return "replay";
  if (step === 4) return "diagnose";
  return "stop";
}

function outcomeNodeClass(outcome: AutoresearchOutcome) {
  if (outcome === "KEEP") return "viz-node-success";
  if (outcome === "DISCARD") return "viz-node-attention";
  return "viz-node-danger";
}

function outcomeFlowClass(outcome: AutoresearchOutcome) {
  if (outcome === "KEEP") return "viz-flow viz-flow-success";
  if (outcome === "DISCARD") return "viz-flow viz-flow-attention";
  return "viz-flow viz-flow-danger";
}

function WorkbenchReplaySvg({
  ids,
  selectedIteration,
  onSelectIteration,
}: {
  ids: ReturnType<typeof useSvgIds>;
  selectedIteration: number;
  onSelectIteration: (iteration: number) => void;
}) {
  const selectedRecord = OFFICIAL_AUTORESEARCH_FIXTURE[selectedIteration];

  return (
    <svg
      className={`viz-svg viz-wide ${styles.workbenchSvg}`}
      viewBox="0 0 1000 500"
      role="group"
      aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
    >
      <title id={ids.titleId}>
        공식 illustrative 결과의 KEEP, DISCARD, CRASH replay
      </title>
      <desc id={ids.descriptionId}>
        네 experiment revision과 각 결과 뒤의 Incumbent를 나란히
        표시합니다. 실패한 Challenger는 ledger에 남지만 Incumbent를
        덮어쓰지 않습니다.
      </desc>
      <SvgDefinitions ids={ids} />

      <rect
        x="28"
        y="20"
        width="944"
        height="458"
        rx="12"
        className="viz-lane"
      />
      <text className="viz-eyebrow" x="54" y="50">
        CHALLENGER HISTORY · OFFICIAL ILLUSTRATIVE FIXTURE
      </text>
      <text className="viz-title" x="54" y="78">
        결과와 system state를 같은 timeline에서 분리합니다
      </text>

      {OFFICIAL_AUTORESEARCH_FIXTURE.map((record, index) => {
        const nodeX = 64 + index * 226;
        const selected = index === selectedIteration;
        const toneClass =
          index === 0 ? "viz-node-accent" : outcomeNodeClass(record.outcome);

        return (
          <g
            key={record.revision}
            role="button"
            tabIndex={0}
            aria-label={`iteration ${record.iteration}, revision ${record.revision}, val_bpb ${formatMetric(record)}, ${record.outcome}`}
            aria-pressed={selected}
            className="viz-interactive"
            onClick={() => onSelectIteration(index)}
            onKeyDown={(event) =>
              activateOnKey(event, () => onSelectIteration(index))
            }
          >
            {index < OFFICIAL_AUTORESEARCH_FIXTURE.length - 1 ? (
              <path
                d={`M${nodeX + 176} 190 H${nodeX + 212}`}
                className={
                  index < selectedIteration
                    ? "viz-flow viz-flow-accent"
                    : "viz-flow"
                }
                markerEnd={`url(#${
                  index < selectedIteration
                    ? ids.accentArrowId
                    : ids.arrowId
                })`}
              />
            ) : null}
            <rect
              x={nodeX}
              y="116"
              width="176"
              height="150"
              rx="10"
              className={toneClass}
              filter={selected ? `url(#${ids.glowId})` : undefined}
            />
            <text className="viz-eyebrow" x={nodeX + 16} y="143">
              ITERATION {record.iteration}
            </text>
            <text className="viz-title mono" x={nodeX + 16} y="170">
              {record.revision}
            </text>
            <text className="viz-body" x={nodeX + 16} y="198">
              val_bpb
            </text>
            <text className="viz-value" x={nodeX + 160} y="198" textAnchor="end">
              {formatMetric(record)}
            </text>
            <text
              className="viz-eyebrow"
              x={nodeX + 16}
              y="230"
              fill={
                record.outcome === "KEEP"
                  ? "var(--fg-success)"
                  : record.outcome === "CRASH"
                    ? "var(--fg-danger)"
                    : "var(--fg-attention)"
              }
            >
              {record.outcome}
            </text>
            <circle
              cx={nodeX + 154}
              cy="137"
              r="10"
              fill={
                selected ? "var(--bg-accent-emphasis)" : "var(--bg-canvas)"
              }
              stroke={
                selected ? "var(--bg-accent-emphasis)" : "var(--border-default)"
              }
            />
            <text
              x={nodeX + 154}
              y="141"
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={
                selected ? "var(--fg-on-emphasis)" : "var(--fg-muted)"
              }
            >
              {index + 1}
            </text>
          </g>
        );
      })}

      <path
        d="M152 296 H848"
        className="viz-flow viz-flow-accent"
        strokeDasharray="7 5"
      />
      <text className="viz-eyebrow" x="54" y="322">
        INCUMBENT AFTER GATE
      </text>

      {OFFICIAL_AUTORESEARCH_FIXTURE.map((record, index) => {
        const nodeX = 64 + index * 226;
        const selected = index === selectedIteration;
        return (
          <g key={`incumbent-${record.revision}`}>
            <path
              d={`M${nodeX + 88} 266 V348`}
              className={outcomeFlowClass(record.outcome)}
              markerEnd={`url(#${
                record.outcome === "KEEP"
                  ? ids.successArrowId
                  : record.outcome === "CRASH"
                    ? ids.dangerArrowId
                    : ids.arrowId
              })`}
            />
            <rect
              x={nodeX}
              y="352"
              width="176"
              height="74"
              rx="9"
              className={selected ? "viz-node-accent" : "viz-node"}
            />
            <text className="viz-eyebrow" x={nodeX + 16} y="376">
              SYSTEM STATE
            </text>
            <text className="viz-title mono" x={nodeX + 16} y="404">
              {record.incumbentAfter}
            </text>
          </g>
        );
      })}

      {selectedRecord.outcome === "CRASH" ? (
        <g>
          <rect
            x="690"
            y="438"
            width="246"
            height="28"
            rx="14"
            fill="var(--bg-danger-muted)"
            stroke="var(--fg-danger)"
          />
          <text
            className="viz-body"
            x="813"
            y="457"
            textAnchor="middle"
            fill="var(--fg-danger)"
          >
            raw sentinel 0 → 화면 표시는 “측정 없음”
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function WorkbenchDiagnoseSvg({
  ids,
  diagnosticIndex,
}: {
  ids: ReturnType<typeof useSvgIds>;
  diagnosticIndex: number;
}) {
  const diagnostic = DIAGNOSTIC_CASES[diagnosticIndex];

  return (
    <svg
      className={`viz-svg viz-wide ${styles.workbenchSvg}`}
      viewBox="0 0 1000 500"
      role="group"
      aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
    >
      <title id={ids.titleId}>
        실험 증상에서 실패한 역할 경계와 확인할 evidence로 이어지는 진단
        지도
      </title>
      <desc id={ids.descriptionId}>
        선택한 증상을 proposer, executor, evaluator, selector 또는 contract
        integrity 경계에 연결하고 우선 확인할 evidence 세 가지를
        표시합니다.
      </desc>
      <SvgDefinitions ids={ids} />

      <rect
        x="28"
        y="20"
        width="944"
        height="458"
        rx="12"
        className="viz-lane"
      />
      <text className="viz-eyebrow" x="54" y="50">
        DIAGNOSE · SYMPTOM → BOUNDARY → EVIDENCE
      </text>
      <text className="viz-title" x="54" y="78">
        결과가 나쁘다는 말 대신 고장 난 경계를 좁힙니다
      </text>

      <rect
        x="58"
        y="124"
        width="254"
        height="130"
        rx="11"
        className="viz-node-danger"
        filter={`url(#${ids.glowId})`}
      />
      <text
        className="viz-eyebrow"
        x="78"
        y="151"
        fill="var(--fg-danger)"
      >
        OBSERVED SYMPTOM
      </text>
      <SvgMultilineText
        text={diagnostic.symptom}
        x={78}
        y={184}
        className="viz-title"
        maxCharacters={24}
        lineHeight={22}
      />
      <text className="viz-body" x="78" y="235">
        사례 {diagnosticIndex + 1} / {DIAGNOSTIC_CASES.length}
      </text>

      <path
        d="M312 189 H390"
        className="viz-flow viz-flow-danger"
        markerEnd={`url(#${ids.dangerArrowId})`}
      />
      <rect
        x="400"
        y="124"
        width="244"
        height="130"
        rx="11"
        className="viz-node-attention"
      />
      <text
        className="viz-eyebrow"
        x="420"
        y="151"
        fill="var(--fg-attention)"
      >
        FIRST BOUNDARY TO CHECK
      </text>
      <SvgMultilineText
        text={diagnostic.boundary}
        x={420}
        y={184}
        className="viz-title"
        maxCharacters={23}
        lineHeight={22}
      />

      <path
        d="M644 189 H700"
        className="viz-flow viz-flow-attention"
        markerEnd={`url(#${ids.arrowId})`}
      />
      {diagnostic.evidence.map((evidence, index) => (
        <g key={evidence}>
          <rect
            x="714"
            y={108 + index * 62}
            width="224"
            height="48"
            rx="8"
            className={index === 0 ? "viz-node-accent" : "viz-node"}
          />
          <text className="viz-eyebrow" x="730" y={128 + index * 62}>
            EVIDENCE {index + 1}
          </text>
          <text className="viz-body" x="730" y={148 + index * 62}>
            {evidence}
          </text>
        </g>
      ))}

      <rect
        x="58"
        y="304"
        width="880"
        height="132"
        rx="11"
        fill="var(--bg-canvas)"
        stroke="var(--border-muted)"
      />
      <text className="viz-eyebrow" x="78" y="332">
        CANDIDATE RESULT ≠ SYSTEM STATE
      </text>
      <rect
        x="82"
        y="354"
        width="220"
        height="58"
        rx="8"
        className="viz-node-danger"
      />
      <text className="viz-title" x="98" y="379">
        Challenger failure
      </text>
      <text className="viz-body" x="98" y="400">
        ledger에는 실패를 append
      </text>
      <path
        d="M302 383 H390"
        className="viz-flow viz-flow-danger"
        markerEnd={`url(#${ids.dangerArrowId})`}
      />
      <rect
        x="404"
        y="354"
        width="190"
        height="58"
        rx="8"
        className="viz-node-attention"
      />
      <text className="viz-title" x="420" y="379">
        External gate
      </text>
      <text className="viz-body" x="420" y="400">
        DISCARD 또는 CRASH
      </text>
      <path
        d="M594 383 H682"
        className="viz-flow viz-flow-success"
        markerEnd={`url(#${ids.successArrowId})`}
      />
      <rect
        x="696"
        y="354"
        width="218"
        height="58"
        rx="8"
        className="viz-node-success"
      />
      <text className="viz-title" x="712" y="379">
        Incumbent retained
      </text>
      <text className="viz-body" x="712" y="400">
        accepted system은 후퇴하지 않음
      </text>
    </svg>
  );
}

function WorkbenchStopSvg({
  ids,
  stopInputs,
}: {
  ids: ReturnType<typeof useSvgIds>;
  stopInputs: StopInputs;
}) {
  const stopReason = determineStopReason(stopInputs);
  const budgetRatio = Math.max(
    0,
    Math.min(1, stopInputs.campaignBudgetRemainingHours / 6),
  );
  const plateauRatio = Math.max(
    0,
    Math.min(1, stopInputs.plateauIterations / 5),
  );
  const circumference = 2 * Math.PI * 52;

  const predicates = [
    {
      label: "Manual interrupt clear",
      pass: !stopInputs.manualInterrupt,
      detail: stopInputs.manualInterrupt ? "REQUESTED" : "CLEAR",
    },
    {
      label: "Safety clear",
      pass: !stopInputs.safetyViolation,
      detail: stopInputs.safetyViolation ? "VIOLATION" : "CLEAR",
    },
    {
      label: "Harness valid",
      pass: stopInputs.harnessValid,
      detail: stopInputs.harnessValid ? "VALID" : "INVALID",
    },
    {
      label: "Human gate clear",
      pass: !stopInputs.humanGateRequired,
      detail: stopInputs.humanGateRequired ? "REQUIRED" : "CLEAR",
    },
    {
      label: "Success not met",
      pass: !stopInputs.successPredicateMet,
      detail: stopInputs.successPredicateMet ? "MET" : "NOT MET",
    },
    {
      label: "No cycle",
      pass: !stopInputs.cycleDetected,
      detail: stopInputs.cycleDetected ? "DETECTED" : "CLEAR",
    },
    {
      label: "No plateau",
      pass: stopInputs.plateauIterations < 5,
      detail: `${stopInputs.plateauIterations} / 5`,
    },
    {
      label: "Budget remains",
      pass: stopInputs.campaignBudgetRemainingHours > 0,
      detail: `${stopInputs.campaignBudgetRemainingHours.toFixed(1)}h`,
    },
    {
      label: "Hypothesis remains",
      pass: stopInputs.testableHypothesisAvailable,
      detail: stopInputs.testableHypothesisAvailable ? "YES" : "NONE",
    },
  ];
  const predicatePositions = [
    { x: 50, y: 300 },
    { x: 370, y: 300 },
    { x: 690, y: 300 },
    { x: 690, y: 390 },
    { x: 370, y: 390 },
    { x: 50, y: 390 },
    { x: 50, y: 480 },
    { x: 370, y: 480 },
    { x: 690, y: 480 },
  ];
  const firstBlockedIndex = predicates.findIndex(
    (predicate) => !predicate.pass,
  );

  function pathBetweenPredicates(index: number) {
    const current = predicatePositions[index];
    const next = predicatePositions[index + 1];
    const nodeWidth = 260;
    const centerY = current.y + 27;
    const nextCenterY = next.y + 27;

    if (current.y === next.y && next.x > current.x) {
      return `M${current.x + nodeWidth} ${centerY} H${next.x - 10}`;
    }
    if (current.y === next.y) {
      return `M${current.x} ${centerY} H${next.x + nodeWidth + 10}`;
    }
    if (current.x > 500) {
      return `M${current.x + nodeWidth} ${centerY} H972 V${nextCenterY} H${next.x + nodeWidth + 10}`;
    }
    return `M${current.x} ${centerY} H28 V${nextCenterY} H${next.x - 10}`;
  }

  return (
    <svg
      className={`viz-svg viz-wide ${styles.workbenchSvg}`}
      viewBox="0 0 1000 680"
      role="group"
      aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
    >
      <title id={ids.titleId}>
        Trial timeout과 campaign stopping condition을 분리한 제어 화면
      </title>
      <desc id={ids.descriptionId}>
        candidate당 5분 trial clock, 남은 campaign 시간, plateau 길이를 서로
        다른 계기로 표시합니다. 아홉 predicate를 빠짐없이 통과한 뒤
        continue 또는 구조화된 stop reason을 반환합니다.
      </desc>
      <SvgDefinitions ids={ids} />

      <rect
        x="28"
        y="20"
        width="944"
        height="638"
        rx="12"
        className="viz-lane"
      />
      <text className="viz-eyebrow" x="54" y="50">
        STOP MODE · LOCAL CLOCK ≠ GLOBAL CLOCK
      </text>
      <text className="viz-title" x="54" y="78">
        한 trial의 timeout과 전체 campaign의 종료를 분리합니다
      </text>

      <g transform="translate(104 170)">
        <circle
          r="52"
          fill="var(--bg-canvas)"
          stroke="var(--border-muted)"
          strokeWidth="12"
        />
        <circle
          r="52"
          fill="none"
          stroke="var(--fg-attention)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          transform="rotate(-90)"
        />
        <text className="viz-value" y="-4" textAnchor="middle">
          5m
        </text>
        <text className="viz-body" y="20" textAnchor="middle">
          per trial
        </text>
      </g>
      <g transform="translate(244 170)">
        <circle
          r="52"
          fill="var(--bg-canvas)"
          stroke="var(--border-muted)"
          strokeWidth="12"
        />
        <circle
          r="52"
          fill="none"
          stroke="var(--fg-accent)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference * budgetRatio} ${circumference}`}
          transform="rotate(-90)"
        />
        <text className="viz-value" y="-4" textAnchor="middle">
          {stopInputs.campaignBudgetRemainingHours.toFixed(1)}h
        </text>
        <text className="viz-body" y="20" textAnchor="middle">
          campaign left
        </text>
      </g>
      <g transform="translate(384 170)">
        <circle
          r="52"
          fill="var(--bg-canvas)"
          stroke="var(--border-muted)"
          strokeWidth="12"
        />
        <circle
          r="52"
          fill="none"
          stroke={
            stopInputs.plateauIterations >= 5
              ? "var(--fg-danger)"
              : "var(--fg-attention)"
          }
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circumference * plateauRatio} ${circumference}`}
          transform="rotate(-90)"
        />
        <text className="viz-value" y="-4" textAnchor="middle">
          {stopInputs.plateauIterations}/5
        </text>
        <text className="viz-body" y="20" textAnchor="middle">
          plateau
        </text>
      </g>
      <text className="viz-eyebrow" x="490" y="130">
        TWO BUDGET LEVELS
      </text>
      <text className="viz-title" x="490" y="158">
        Trial 5분은 Challenger 하나를 끝냅니다
      </text>
      <text className="viz-body" x="490" y="184">
        Campaign budget은 전체 탐색을 끝내며 서로 대체하지 않습니다.
      </text>
      <rect
        x="490"
        y="198"
        width="430"
        height="60"
        rx="8"
        fill="var(--bg-subtle)"
        stroke="var(--border-muted)"
      />
      <SvgMultilineText
        text="판정 우선순위 · manual → safety → harness → human → success → cycle → plateau → budget → blocked"
        x={510}
        y={221}
        className="viz-body"
        maxCharacters={52}
        maxLines={3}
        lineHeight={16}
      />

      <path
        d="M384 226 V272 H180 V290"
        className="viz-flow viz-flow-accent"
        markerEnd={`url(#${ids.accentArrowId})`}
      />

      {predicates.map((predicate, index) => {
        const position = predicatePositions[index];
        const flowPassed =
          firstBlockedIndex === -1 || index < firstBlockedIndex;
        return (
          <g key={predicate.label}>
            {index < predicates.length - 1 ? (
              <path
                d={pathBetweenPredicates(index)}
                className={
                  flowPassed
                    ? "viz-flow viz-flow-success"
                    : "viz-flow viz-flow-danger"
                }
                strokeDasharray={flowPassed ? undefined : "6 5"}
                markerEnd={`url(#${
                  flowPassed ? ids.successArrowId : ids.dangerArrowId
                })`}
              />
            ) : null}
            <rect
              x={position.x}
              y={position.y}
              width="260"
              height="54"
              rx="8"
              className={
                predicate.pass ? "viz-node-success" : "viz-node-danger"
              }
            />
            <text className="viz-title" x={position.x + 16} y={position.y + 33}>
              {predicate.label}
            </text>
            <text
              className="viz-value"
              x={position.x + 244}
              y={position.y + 33}
              textAnchor="end"
              fill={
                predicate.pass ? "var(--fg-success)" : "var(--fg-danger)"
              }
            >
              {predicate.detail}
            </text>
          </g>
        );
      })}

      <path
        d="M820 534 V558"
        className={
          stopReason
            ? "viz-flow viz-flow-danger"
            : "viz-flow viz-flow-success"
        }
        markerEnd={`url(#${
          stopReason ? ids.dangerArrowId : ids.successArrowId
        })`}
      />
      <rect
        x="690"
        y="568"
        width="260"
        height="78"
        rx="10"
        className={stopReason ? "viz-node-danger" : "viz-node-success"}
        filter={`url(#${ids.glowId})`}
      />
      <text
        className="viz-eyebrow"
        x="710"
        y="590"
        textAnchor="start"
      >
        CONTROL VERDICT
      </text>
      <SvgMultilineText
        text={stopReason ?? "CONTINUE"}
        x={820}
        y={616}
        className="viz-title"
        maxCharacters={18}
        maxLines={3}
        lineHeight={18}
        textAnchor="middle"
      />
    </svg>
  );
}

export function LoopControlWorkbench() {
  const [playback, setViewportNode] = useOnePassPlayback(
    WORKBENCH_STEP_COUNT,
    1500,
  );
  const [diagnosticIndex, setDiagnosticIndex] = useState(1);
  const [stopPreset, setStopPreset] = useState<StopPreset>("plateau");
  const [campaignBudgetRemainingHours, setCampaignBudgetRemainingHours] =
    useState(6);
  const [plateauIterations, setPlateauIterations] = useState(5);
  const [safetyViolation, setSafetyViolation] = useState(false);
  const [harnessValid, setHarnessValid] = useState(true);
  const [successPredicateMet, setSuccessPredicateMet] = useState(false);
  const [humanGateRequired, setHumanGateRequired] = useState(false);
  const [cycleDetected, setCycleDetected] = useState(false);
  const [manualInterrupt, setManualInterrupt] = useState(false);
  const ids = useSvgIds("loop-control-workbench");

  const mode = workbenchModeForStep(playback.step);
  const selectedIteration = Math.min(playback.step, 3);
  const selectedRecord = OFFICIAL_AUTORESEARCH_FIXTURE[selectedIteration];
  const selectedDiagnostic = DIAGNOSTIC_CASES[diagnosticIndex];

  const stopInputs: StopInputs = {
    manualInterrupt,
    safetyViolation,
    harnessValid,
    successPredicateMet,
    humanGateRequired,
    cycleDetected,
    plateauIterations,
    campaignBudgetRemainingHours,
    testableHypothesisAvailable: true,
  };
  const stopReason = determineStopReason(stopInputs);

  function selectMode(nextMode: WorkbenchMode) {
    if (nextMode === "replay") {
      playback.select(selectedIteration);
      return;
    }
    playback.select(nextMode === "diagnose" ? 4 : 5);
  }

  function selectDiagnostic(nextIndex: number) {
    playback.pauseForUser();
    setDiagnosticIndex(nextIndex);
  }

  function applyStopPreset(nextPreset: StopPreset) {
    playback.pauseForUser();
    setStopPreset(nextPreset);
    setCampaignBudgetRemainingHours(nextPreset === "budget" ? 0 : 6);
    setPlateauIterations(nextPreset === "plateau" ? 5 : 0);
    setSafetyViolation(nextPreset === "safety");
    setHarnessValid(nextPreset !== "harness");
    setSuccessPredicateMet(nextPreset === "success");
    setHumanGateRequired(nextPreset === "human");
    setCycleDetected(nextPreset === "cycle");
    setManualInterrupt(nextPreset === "manual");
  }

  function updateCampaignBudget(value: number) {
    playback.pauseForUser();
    setStopPreset("direct");
    setCampaignBudgetRemainingHours(value);
  }

  function updatePlateauIterations(value: number) {
    playback.pauseForUser();
    setStopPreset("direct");
    setPlateauIterations(value);
  }

  const status =
    mode === "replay"
      ? [
          {
            label: "선택한 experiment",
            value: `iteration ${selectedRecord.iteration} · ${selectedRecord.revision}`,
          },
          {
            label: "결과",
            value: `${selectedRecord.outcome} · ${formatMetric(selectedRecord)}`,
          },
          {
            label: "Incumbent after",
            value: selectedRecord.incumbentAfter,
          },
        ]
      : mode === "diagnose"
        ? [
            { label: "증상", value: selectedDiagnostic.symptom },
            { label: "먼저 볼 경계", value: selectedDiagnostic.boundary },
            {
              label: "첫 evidence",
              value: selectedDiagnostic.evidence[0],
            },
          ]
        : [
            {
              label: "Campaign budget",
              value: `${campaignBudgetRemainingHours.toFixed(1)}h remaining`,
            },
            {
              label: "Plateau",
              value: `${plateauIterations} / 5 iterations`,
            },
            { label: "Control verdict", value: stopReason ?? "CONTINUE" },
          ];

  const explanation =
    mode === "replay" ? (
      <>
        <strong>{selectedRecord.outcome}</strong> 뒤의 실제 system state는{" "}
        <strong>{selectedRecord.incumbentAfter}</strong>입니다. Challenger 결과와
        Incumbent 상태를 분리해 읽습니다.
      </>
    ) : mode === "diagnose" ? (
      <>
        <strong>{selectedDiagnostic.boundary}</strong> 경계에서{" "}
        {selectedDiagnostic.evidence.join(", ")}를 먼저 확인합니다.
      </>
    ) : (
      <>
        구조화된 판정은 <strong>{stopReason ?? "CONTINUE"}</strong>입니다.
        종료 시 마지막 Challenger가 아니라 검증된 best-so-far를 반환합니다.
      </>
    );

  return (
    <PlaybackViewport setViewportNode={setViewportNode}>
      <LabShell
      title="같은 ledger로 replay, diagnose, stop을 전환하는 control workbench"
      subtitle="공식 illustrative 결과를 재생하고, 실패 경계를 좁힌 뒤, trial과 campaign의 종료 조건을 분리합니다."
      actions={
        <PlaybackActions
          playback={playback}
          stepCount={WORKBENCH_STEP_COUNT}
        />
      }
      controls={
        <>
          <SegmentedControl<WorkbenchMode>
            label="Workbench mode"
            value={mode}
            options={[
              { value: "replay", label: "Replay" },
              { value: "diagnose", label: "Diagnose" },
              { value: "stop", label: "Stop" },
            ]}
            onChange={selectMode}
          />
          {mode === "replay" ? (
            <RangeControl
              id="loop-control-iteration"
              label="Experiment iteration"
              value={selectedIteration}
              min={0}
              max={3}
              step={1}
              valueLabel={`${selectedIteration} · ${selectedRecord.outcome}`}
              onChange={(value) => playback.select(value)}
            />
          ) : null}
          {mode === "diagnose" ? (
            <RangeControl
              id="loop-control-diagnostic"
              label="증상 사례"
              value={diagnosticIndex}
              min={0}
              max={DIAGNOSTIC_CASES.length - 1}
              step={1}
              valueLabel={`${diagnosticIndex + 1} · ${selectedDiagnostic.shortLabel}`}
              onChange={selectDiagnostic}
            />
          ) : null}
          {mode === "stop" ? (
            <>
              <div className="mobile-two-row-segments">
                <SegmentedControl<StopPreset>
                  label="Stop scenario"
                  value={stopPreset}
                  options={[
                    { value: "continue", label: "Continue" },
                    { value: "success", label: "Success" },
                    { value: "plateau", label: "Plateau" },
                    { value: "safety", label: "Safety" },
                    { value: "budget", label: "Budget" },
                    { value: "harness", label: "Harness" },
                    { value: "human", label: "Human gate" },
                    { value: "cycle", label: "Cycle" },
                    { value: "manual", label: "Manual" },
                    { value: "direct", label: "직접 조작" },
                  ]}
                  onChange={applyStopPreset}
                />
              </div>
              <RangeControl
                id="campaign-budget-remaining"
                label="Campaign budget remaining"
                value={campaignBudgetRemainingHours}
                min={0}
                max={6}
                step={0.5}
                valueLabel={`${campaignBudgetRemainingHours.toFixed(1)}h`}
                onChange={updateCampaignBudget}
              />
              <RangeControl
                id="plateau-iterations"
                label="Plateau iterations"
                value={plateauIterations}
                min={0}
                max={8}
                step={1}
                valueLabel={`${plateauIterations}회`}
                onChange={updatePlateauIterations}
              />
            </>
          ) : null}
        </>
      }
      stageLabel={`${mode.toUpperCase()} · autoplay step ${playback.step + 1} / ${WORKBENCH_STEP_COUNT}`}
      legend={
        mode === "replay"
          ? [
              { label: "KEEP", tone: "success" },
              { label: "DISCARD", tone: "attention" },
              { label: "CRASH", tone: "danger" },
            ]
          : mode === "diagnose"
            ? [
                { label: "증상", tone: "danger" },
                { label: "경계", tone: "attention" },
                { label: "evidence", tone: "accent" },
              ]
            : [
                { label: "continue", tone: "success" },
                { label: "stop", tone: "danger" },
              ]
      }
      status={status}
      explanation={explanation}
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label={`${mode} control workbench, 가로로 스크롤할 수 있습니다.`}
      >
        {mode === "replay" ? (
          <WorkbenchReplaySvg
            ids={ids}
            selectedIteration={selectedIteration}
            onSelectIteration={playback.select}
          />
        ) : mode === "diagnose" ? (
          <WorkbenchDiagnoseSvg
            ids={ids}
            diagnosticIndex={diagnosticIndex}
          />
        ) : (
          <WorkbenchStopSvg ids={ids} stopInputs={stopInputs} />
        )}
      </div>

      <VisualFallback
        label={`${mode} 상태를 DOM 구조로 보기`}
        onUserInteraction={playback.pauseForUser}
      >
        {mode === "replay" ? (
          <div className={styles.tableScroll}>
            <table>
              <caption>
                화면 값과 공식 illustrative results.tsv의 raw 값을 함께
                표시합니다.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Iteration</th>
                  <th scope="col">Revision</th>
                  <th scope="col">val_bpb 표시</th>
                  <th scope="col">raw val_bpb</th>
                  <th scope="col">Peak memory 표시</th>
                  <th scope="col">raw memory</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Incumbent after</th>
                </tr>
              </thead>
              <tbody>
                {OFFICIAL_AUTORESEARCH_FIXTURE.map((record, index) => (
                  <tr
                    key={record.revision}
                    data-selected={
                      index === selectedIteration ? "true" : undefined
                    }
                  >
                    <td>{record.iteration}</td>
                    <td>
                      <code>{record.revision}</code>
                    </td>
                    <td>{formatMetric(record)}</td>
                    <td>
                      <code>{record.rawMetric.toFixed(6)}</code>
                      {!record.observationValid ? " · crash sentinel" : ""}
                    </td>
                    <td>{formatPeakMemory(record)}</td>
                    <td>
                      <code>
                        {record.rawPeakMemoryGigabytes.toFixed(1)}
                      </code>
                      {!record.observationValid ? " · crash sentinel" : ""}
                    </td>
                    <td>{record.outcome}</td>
                    <td>
                      <code>{record.incumbentAfter}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : mode === "diagnose" ? (
          <table>
            <tbody>
              <tr>
                <th scope="row">증상</th>
                <td>{selectedDiagnostic.symptom}</td>
              </tr>
              <tr>
                <th scope="row">먼저 볼 경계</th>
                <td>{selectedDiagnostic.boundary}</td>
              </tr>
              <tr>
                <th scope="row">Evidence</th>
                <td>{selectedDiagnostic.evidence.join(", ")}</td>
              </tr>
              <tr>
                <th scope="row">System state</th>
                <td>
                  DISCARD 또는 CRASH라면 기존 Incumbent를 유지하고 실패를
                  ledger에 기록
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table>
            <tbody>
              <tr>
                <th scope="row">Manual interrupt</th>
                <td>{manualInterrupt ? "REQUESTED" : "CLEAR"}</td>
              </tr>
              <tr>
                <th scope="row">Harness</th>
                <td>{harnessValid ? "VALID" : "INVALID"}</td>
              </tr>
              <tr>
                <th scope="row">Safety</th>
                <td>{safetyViolation ? "VIOLATION" : "CLEAR"}</td>
              </tr>
              <tr>
                <th scope="row">Success predicate</th>
                <td>{successPredicateMet ? "MET" : "NOT MET"}</td>
              </tr>
              <tr>
                <th scope="row">Human gate</th>
                <td>{humanGateRequired ? "REQUIRED" : "CLEAR"}</td>
              </tr>
              <tr>
                <th scope="row">Cycle</th>
                <td>{cycleDetected ? "DETECTED" : "CLEAR"}</td>
              </tr>
              <tr>
                <th scope="row">Trial budget</th>
                <td>candidate당 5분 · local clock</td>
              </tr>
              <tr>
                <th scope="row">Campaign budget</th>
                <td>{campaignBudgetRemainingHours.toFixed(1)}h remaining</td>
              </tr>
              <tr>
                <th scope="row">Plateau</th>
                <td>{plateauIterations} / 5 iterations</td>
              </tr>
              <tr>
                <th scope="row">Control verdict</th>
                <td>{stopReason ?? "CONTINUE"}</td>
              </tr>
            </tbody>
          </table>
        )}
      </VisualFallback>
      </LabShell>
    </PlaybackViewport>
  );
}

type PolicyMode = "blank" | "example";

export function LoopPolicyStudio() {
  const [playback, setViewportNode] = useOnePassPlayback(
    LOOP_POLICY_SECTIONS.length + 1,
    1200,
  );
  const [blankSectionIndex, setBlankSectionIndex] = useState(0);
  const ids = useSvgIds("loop-policy-studio");
  const policyMode: PolicyMode = playback.step === 0 ? "blank" : "example";
  const selectedSectionIndex =
    policyMode === "blank" ? blankSectionIndex : playback.step - 1;
  const selectedSection = LOOP_POLICY_SECTIONS[selectedSectionIndex];
  const filledSectionCount =
    policyMode === "example" ? Math.min(playback.step, LOOP_POLICY_SECTIONS.length) : 0;

  function selectPolicyMode(nextMode: PolicyMode) {
    if (nextMode === "blank") {
      playback.select(0);
      return;
    }
    playback.select(blankSectionIndex + 1);
  }

  function selectPolicySection(nextSectionIndex: number) {
    if (policyMode === "blank") {
      playback.pauseForUser();
      setBlankSectionIndex(nextSectionIndex);
      return;
    }
    playback.select(nextSectionIndex + 1);
  }

  const cardPositions = LOOP_POLICY_SECTIONS.map((_, index) => ({
    x: 48 + (index % 4) * 232,
    y: 104 + Math.floor(index / 4) * 240,
  }));
  const policyCardHeight = 216;

  return (
    <PlaybackViewport setViewportNode={setViewportNode}>
      <LabShell
      title="목표·변경·증거·채택·기억·중단을 한 장에 고정하는 policy studio"
      subtitle="Blank contract에서 시작해 synthetic checkout 예시를 한 구역씩 채우며 누락된 운영 규칙을 확인합니다."
      actions={
        <PlaybackActions
          playback={playback}
          stepCount={LOOP_POLICY_SECTIONS.length + 1}
        />
      }
      controls={
        <>
          <SegmentedControl<PolicyMode>
            label="Policy view"
            value={policyMode}
            options={[
              { value: "blank", label: "Blank template" },
              { value: "example", label: "Synthetic example" },
            ]}
            onChange={selectPolicyMode}
          />
          <RangeControl
            id="loop-policy-section"
            label="Policy section"
            value={selectedSectionIndex}
            min={0}
            max={LOOP_POLICY_SECTIONS.length - 1}
            step={1}
            valueLabel={`${selectedSectionIndex + 1} · ${selectedSection.shortLabel}`}
            onChange={selectPolicySection}
          />
        </>
      }
      stageLabel={`${policyMode === "blank" ? "BLANK CONTRACT" : "SYNTHETIC CHECKOUT POLICY"} · ${filledSectionCount} / ${LOOP_POLICY_SECTIONS.length} sections filled`}
      legend={[
        { label: "비어 있는 계약", tone: "neutral" },
        { label: "현재 구역", tone: "accent" },
        { label: "채워진 구역", tone: "success" },
        { label: "검증 경계", tone: "attention" },
      ]}
      status={[
        { label: "현재 구역", value: selectedSection.title },
        {
          label: "Policy 상태",
          value:
            policyMode === "blank"
              ? "입력 대기"
              : `${filledSectionCount} / ${LOOP_POLICY_SECTIONS.length} sections filled`,
        },
        {
          label: "Provenance",
          value:
            policyMode === "blank"
              ? "ENGINEERING TRANSFER"
              : "SYNTHETIC EXAMPLE",
        },
      ]}
      explanation={
        policyMode === "blank" ? (
          <>
            <strong>{selectedSection.title}</strong>:{" "}
            {selectedSection.blankPrompt}
          </>
        ) : (
          <>
            <strong>{selectedSection.title}</strong>:{" "}
            {selectedSection.exampleValue.join(" · ")}. 수치는 실제 운영 측정값이
            아닌 화면 구조용 synthetic example입니다.
          </>
        )
      }
    >
      <div
        className="viz-scroll"
        tabIndex={0}
        aria-label="Loop policy의 여덟 구역, 가로로 스크롤할 수 있습니다."
      >
        <svg
          className={`viz-svg viz-wide ${styles.policySvg}`}
          viewBox="0 0 1000 700"
          role="group"
          aria-labelledby={`${ids.titleId} ${ids.descriptionId}`}
        >
          <title id={ids.titleId}>
            Autoresearch형 loop policy의 여덟 구역
          </title>
          <desc id={ids.descriptionId}>
            목표, 변경 범위, 예산, evidence, transition, memory, stop, owner
            구역을 두 줄의 카드로 보여줍니다. Blank template에서는 필요한
            질문을, synthetic example에서는 checkout 예시 값을 표시합니다.
          </desc>
          <SvgDefinitions ids={ids} />

          <rect
            x="24"
            y="20"
            width="952"
            height="656"
            rx="12"
            className="viz-lane"
          />
          <text className="viz-eyebrow" x="48" y="50">
            LOOP POLICY · ONE AUDITABLE CONTRACT
          </text>
          <text className="viz-title" x="48" y="78">
            실행 전에 여덟 구역을 채우고 서로 모순되지 않는지 확인합니다
          </text>

          {LOOP_POLICY_SECTIONS.map((section, index) => {
            const position = cardPositions[index];
            const selected = index === selectedSectionIndex;
            const filled =
              policyMode === "example" && index < filledSectionCount;
            const nodeClass = selected
              ? "viz-node-accent"
              : filled
                ? styles.policyFilledNode
                : "viz-node";
            const displayedLines = filled
              ? section.exampleValue
              : [section.blankPrompt];
            const detailLines = displayedLines.flatMap((line) =>
              splitSvgLines(line, 27, 3),
            );

            return (
              <g
                key={section.id}
                role="button"
                tabIndex={0}
                aria-label={`${index + 1}번째 policy 구역 ${section.title}. ${
                  filled
                    ? section.exampleValue.join(". ")
                    : section.blankPrompt
                }`}
                aria-pressed={selected}
                className="viz-interactive"
                onClick={() => selectPolicySection(index)}
                onKeyDown={(event) =>
                  activateOnKey(event, () => selectPolicySection(index))
                }
              >
                <rect
                  x={position.x}
                  y={position.y}
                  width="208"
                  height={policyCardHeight}
                  rx="10"
                  className={nodeClass}
                  strokeDasharray={!filled && !selected ? "6 5" : undefined}
                  filter={selected ? `url(#${ids.glowId})` : undefined}
                />
                <text
                  className="viz-eyebrow"
                  x={position.x + 16}
                  y={position.y + 25}
                >
                  {String(index + 1).padStart(2, "0")} · {section.shortLabel}
                </text>
                <SvgMultilineText
                  text={section.title}
                  x={position.x + 16}
                  y={position.y + 50}
                  className="viz-title"
                  maxCharacters={19}
                  maxLines={3}
                  lineHeight={17}
                />
                {detailLines.map((line, lineIndex) => (
                  <text
                    key={`${section.id}-${line}-${lineIndex}`}
                    className="viz-body"
                    x={position.x + 16}
                    y={position.y + 104 + lineIndex * 16}
                  >
                    {line}
                  </text>
                ))}
                <circle
                  cx={position.x + 186}
                  cy={position.y + 22}
                  r="9"
                  fill={
                    selected
                      ? "var(--bg-accent-emphasis)"
                      : filled
                        ? "var(--viz-category)"
                        : "var(--bg-subtle)"
                  }
                  stroke={
                    selected
                      ? "var(--bg-accent-emphasis)"
                      : filled
                        ? "var(--viz-category)"
                        : "var(--border-default)"
                  }
                />
                <text
                  x={position.x + 186}
                  y={position.y + 26}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={
                    selected || filled
                      ? "var(--fg-on-emphasis)"
                      : "var(--fg-muted)"
                  }
                >
                  {filled ? "✓" : index + 1}
                </text>
              </g>
            );
          })}

          {cardPositions.map((position, index) => (
            <path
              key={`policy-edge-${LOOP_POLICY_SECTIONS[index].id}`}
              d={`M${position.x + 104} ${position.y + policyCardHeight} V${
                position.y < 200 ? 332 : 584
              } H500`}
              className={
                policyMode === "example" && index < filledSectionCount
                  ? `viz-flow ${styles.policyFilledFlow}`
                  : "viz-flow"
              }
              strokeDasharray="5 5"
            />
          ))}

          <rect
            x="244"
            y="600"
            width="512"
            height="62"
            rx="10"
            className={
              filledSectionCount === LOOP_POLICY_SECTIONS.length
                ? styles.policyFilledNode
                : "viz-node-attention"
            }
          />
          <text
            className="viz-eyebrow"
            x="500"
            y="623"
            textAnchor="middle"
          >
            CONTRACT READINESS
          </text>
          <text
            className="viz-title"
            x="500"
            y="647"
            textAnchor="middle"
          >
            {filledSectionCount === LOOP_POLICY_SECTIONS.length
              ? "8개 구역 입력 완료 · human review 대기"
              : `${filledSectionCount}개 입력 · ${
                  LOOP_POLICY_SECTIONS.length - filledSectionCount
                }개 구역 남음`}
          </text>
        </svg>
      </div>

      <VisualFallback
        label="Loop policy 전체 구역을 표로 보기"
        onUserInteraction={playback.pauseForUser}
      >
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                <th scope="col">구역</th>
                <th scope="col">Blank contract</th>
                <th scope="col">현재 값</th>
              </tr>
            </thead>
            <tbody>
              {LOOP_POLICY_SECTIONS.map((section, index) => {
                const filled =
                  policyMode === "example" && index < filledSectionCount;
                return (
                  <tr
                    key={section.id}
                    data-selected={
                      index === selectedSectionIndex ? "true" : undefined
                    }
                  >
                    <th scope="row">{section.title}</th>
                    <td>{section.blankPrompt}</td>
                    <td>
                      {filled
                        ? section.exampleValue.join(" · ")
                        : "입력 대기"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </VisualFallback>
      </LabShell>
    </PlaybackViewport>
  );
}
