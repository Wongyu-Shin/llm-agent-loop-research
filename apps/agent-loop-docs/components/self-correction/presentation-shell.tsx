"use client";

import {
  BookOpenText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  HARD_CHECKPOINTS,
  PART_LABELS,
  PART_TOTAL_SECONDS,
  SCENE_TIMINGS,
  SECONDS_PER_PRESENTER_NOTE,
  TOTAL_DECK_SECONDS,
  TOTAL_SENTENCE_BUDGET,
  TOTAL_SPEECH_SECONDS,
  TOTAL_VISUAL_SECONDS,
  getSceneTiming,
  isSceneId,
  type ResearchPart,
  type SceneId,
} from "./presenter-notes";
import styles from "./presentation-shell.module.css";

const SESSION_KEY = "self-correction-research-deck:v1";
const TITLE_KO = "LLM 자기수정을 위한 확률적 추론 스케일링 이론";
const TITLE_EN = "A Probabilistic Inference Scaling Theory for LLM Self-Correction";

type DeckMode = "presentation" | "reading";

type CompletionRecord = {
  sceneId: SceneId;
  noteId: string;
  seconds: number;
};

type StoredDeckState = {
  mode: DeckMode;
  activeSceneId: SceneId;
  currentNoteId: string;
  elapsedSeconds: number;
  completionRecords: CompletionRecord[];
  visualHoldSeconds: number;
  suggestedCutCandidate: string | null;
};

type DeckContextValue = {
  activeSceneId: SceneId;
  elapsedSeconds: number;
  isRunning: boolean;
  mode: DeckMode;
  reducedMotion: boolean;
};

const DeckContext = createContext<DeckContextValue | null>(null);

const PART_START_SECONDS: Record<ResearchPart, number> = {
  paper: 0,
  bridge: 700,
  practice: 800,
};

const provenanceLabels = {
  paper: "논문",
  interpretation: "해석",
  practice: "실무 권고",
  official: "공식 Autoresearch 사례",
  synthetic: "합성 예시",
} as const;

export type ProvenanceKind = keyof typeof provenanceLabels;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatClock(rawSeconds: number) {
  const seconds = Math.max(0, Math.round(rawSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatSignedClock(seconds: number) {
  const sign = seconds > 0.5 ? "+" : seconds < -0.5 ? "−" : "±";
  return `${sign}${formatClock(Math.abs(seconds))}`;
}

function mean(values: readonly number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sceneForNote(noteId: string) {
  return SCENE_TIMINGS.find((scene) => scene.notes.some((note) => note.id === noteId));
}

function preparePresenterWindow(popup: Window) {
  const popupDocument = popup.document;
  popupDocument.documentElement.lang = "ko";
  popupDocument.head.replaceChildren();
  popupDocument.body.replaceChildren();
  popupDocument.title = `${TITLE_KO} · 발표자 노트`;

  const charset = popupDocument.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  popupDocument.head.append(charset);

  const viewport = popupDocument.createElement("meta");
  viewport.name = "viewport";
  viewport.content = "width=device-width, initial-scale=1";
  popupDocument.head.append(viewport);

  document.head
    .querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], style',
    )
    .forEach((styleNode) => {
      popupDocument.head.append(styleNode.cloneNode(true));
    });

  const bootstrapStyle = popupDocument.createElement("style");
  bootstrapStyle.textContent =
    "html,body{min-height:100%;margin:0;background:#0d0d0d;color:#e8e8e8}body{overflow-y:auto}";
  popupDocument.head.append(bootstrapStyle);

  const root = popupDocument.createElement("div");
  root.id = "self-correction-presenter-window";
  root.className = `${styles.deck} ${styles.presenterWindowRoot}`;
  root.dataset.mode = "presentation";
  popupDocument.body.append(root);
  return root;
}

function PresenterSurface({
  root,
  children,
}: {
  root: HTMLElement | null;
  children: ReactNode;
}) {
  return root ? createPortal(children, root) : children;
}

function parseStoredState(value: string | null): StoredDeckState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredDeckState>;
    if (
      (parsed.mode !== "presentation" && parsed.mode !== "reading") ||
      typeof parsed.activeSceneId !== "string" ||
      !isSceneId(parsed.activeSceneId) ||
      typeof parsed.currentNoteId !== "string" ||
      typeof parsed.elapsedSeconds !== "number"
    ) {
      return null;
    }

    const noteScene = sceneForNote(parsed.currentNoteId);
    const completionRecords = Array.isArray(parsed.completionRecords)
      ? parsed.completionRecords.filter(
          (record): record is CompletionRecord =>
            typeof record === "object" &&
            record !== null &&
            typeof record.sceneId === "string" &&
            isSceneId(record.sceneId) &&
            typeof record.noteId === "string" &&
            typeof record.seconds === "number" &&
            Number.isFinite(record.seconds),
        )
      : [];

    return {
      mode: parsed.mode,
      activeSceneId: parsed.activeSceneId,
      currentNoteId: noteScene
        ? parsed.currentNoteId
        : getSceneTiming(parsed.activeSceneId).notes[0].id,
      elapsedSeconds: clamp(parsed.elapsedSeconds, 0, TOTAL_DECK_SECONDS),
      completionRecords,
      visualHoldSeconds:
        typeof parsed.visualHoldSeconds === "number"
          ? Math.max(0, parsed.visualHoldSeconds)
          : 0,
      suggestedCutCandidate:
        typeof parsed.suggestedCutCandidate === "string"
          ? parsed.suggestedCutCandidate
          : null,
    };
  } catch {
    return null;
  }
}

export function useResearchDeckState() {
  const context = useContext(DeckContext);
  if (!context) {
    throw new Error("useResearchDeckState must be used inside ResearchDeck.");
  }
  return context;
}

export function ProvenanceBadge({
  kind,
  children,
}: {
  kind: ProvenanceKind;
  children?: ReactNode;
}) {
  return (
    <span className={styles.provenanceBadge} data-provenance={kind}>
      <span className={styles.provenanceDot} aria-hidden="true" />
      {children ?? provenanceLabels[kind]}
    </span>
  );
}

export function ResearchHero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroOrbit} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.heroCopy}>
        <div className={styles.heroLabel}>
          <span>EMNLP 2025 · PAPER TO PRACTICE</span>
          <span>25:00</span>
        </div>
        <h1>
          <span>{TITLE_KO}</span>
          <span lang="en">{TITLE_EN}</span>
        </h1>
        <p>같은 답을 더 고치면 더 좋아집니까?</p>
        <dl className={styles.heroTiming} aria-label="발표 시간 계약">
          <div>
            <dt>발표자 노트</dt>
            <dd>{TOTAL_SENTENCE_BUDGET}문장</dd>
          </div>
          <div>
            <dt>낭독</dt>
            <dd>{formatClock(TOTAL_SPEECH_SECONDS)}</dd>
          </div>
          <div>
            <dt>시각·전환</dt>
            <dd>{formatClock(TOTAL_VISUAL_SECONDS)}</dd>
          </div>
          <div>
            <dt>전체</dt>
            <dd>{formatClock(TOTAL_DECK_SECONDS)}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

export function StoryScene({
  id,
  part,
  eyebrow,
  title,
  visual,
  children,
}: {
  id: SceneId;
  part: ResearchPart;
  eyebrow: string;
  title: string;
  visual?: ReactNode;
  children: ReactNode;
}) {
  const context = useContext(DeckContext);
  const timing = getSceneTiming(id);
  const headingId = `${id}-title`;

  if (timing.part !== part) {
    throw new Error(
      `${id} belongs to ${timing.part}, but StoryScene received ${part}.`,
    );
  }

  return (
    <section
      id={id}
      className={styles.scene}
      data-active={context?.activeSceneId === id ? "true" : "false"}
      data-part={part}
      data-scene-id={id}
      data-sentence-budget={timing.sentenceBudget}
      data-speech-seconds={timing.speechSeconds}
      data-visual-seconds={timing.visualSeconds}
      data-total-seconds={timing.totalSeconds}
      aria-labelledby={headingId}
    >
      <div className={styles.sceneBackdrop} aria-hidden="true" />
      <div className={styles.sceneInner}>
        <header className={styles.sceneHeader}>
          <div>
            <div className={styles.sceneEyebrow}>
              <span>{String(timing.index).padStart(2, "0")}</span>
              <span>{PART_LABELS[part]}</span>
              <span>{eyebrow}</span>
            </div>
            <h2 id={headingId}>{title}</h2>
          </div>
          <div className={styles.sceneTiming} aria-label={`${title} 시간 예산`}>
            <span>{timing.sentenceBudget}문장</span>
            <strong>{formatClock(timing.totalSeconds)}</strong>
          </div>
        </header>
        <div
          className={visual ? styles.sceneComposition : styles.sceneCompositionTextOnly}
        >
          <div className={styles.sceneNarrative} data-scene-prose>
            {children}
          </div>
          {visual ? (
            <div className={styles.sceneVisual} data-scene-visual>
              {visual}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PresenterNotes({ sceneId }: { sceneId: SceneId }) {
  const context = useContext(DeckContext);
  const timing = getSceneTiming(sceneId);
  const [notesOpen, setNotesOpen] = useState(context?.mode === "reading");

  return (
    <details
      className={styles.presenterNotes}
      data-presenter-notes-for={sceneId}
      open={notesOpen}
      onToggle={(event) => setNotesOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <BookOpenText aria-hidden="true" size={16} />
          발표자 노트
        </span>
        <span>
          {timing.sentenceBudget}문장 · {formatClock(timing.speechSeconds)}
          <ChevronDown aria-hidden="true" size={15} />
        </span>
      </summary>
      <ol>
        {timing.notes.map((note) => {
          const cutCandidate = timing.cutCandidates.includes(note.id);
          return (
            <li
              key={note.id}
              data-presenter-note={note.id}
              data-note-seconds={SECONDS_PER_PRESENTER_NOTE}
              data-cut-candidate={cutCandidate ? "true" : undefined}
            >
              <span>{note.id}</span>
              <p>{note.text}</p>
              {cutCandidate ? <small>지정된 컷 후보</small> : null}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export function ResearchDeck({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DeckMode>("reading");
  const [activeSceneId, setActiveSceneId] = useState<SceneId>("scene-01");
  const [currentNoteId, setCurrentNoteId] = useState("S01.01");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [completionRecords, setCompletionRecords] = useState<
    CompletionRecord[]
  >([]);
  const [visualHoldSeconds, setVisualHoldSeconds] = useState(0);
  const [suggestedCutCandidate, setSuggestedCutCandidate] = useState<
    string | null
  >(null);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [presenterPortalRoot, setPresenterPortalRoot] =
    useState<HTMLElement | null>(null);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "읽기 모드입니다. 발표 모드에서 타이머를 시작할 수 있습니다.",
  );

  const deckRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const accumulatedSecondsRef = useRef(0);
  const timerStartedAtRef = useRef<number | null>(null);
  const lastRenderedQuarterRef = useRef(-1);
  const sentenceStartedAtRef = useRef<number | null>(null);
  const restoredSceneRef = useRef<SceneId | null>(null);
  const presenterWindowRef = useRef<Window | null>(null);
  const presenterRootRef = useRef<HTMLElement | null>(null);

  const activeTiming = getSceneTiming(activeSceneId);
  const currentNoteIndex = Math.max(
    0,
    activeTiming.notes.findIndex((note) => note.id === currentNoteId),
  );
  const currentNote = activeTiming.notes[currentNoteIndex];
  const nextNote =
    activeTiming.notes[currentNoteIndex + 1] ??
    SCENE_TIMINGS[activeTiming.index]?.notes[0] ??
    null;

  const currentPartElapsed = clamp(
    elapsedSeconds - PART_START_SECONDS[activeTiming.part],
    0,
    PART_TOTAL_SECONDS[activeTiming.part],
  );
  const currentSceneElapsed = clamp(
    elapsedSeconds - activeTiming.plannedStartSeconds,
    0,
    activeTiming.totalSeconds,
  );
  const plannedElapsedAtNote =
    activeTiming.plannedStartSeconds +
    currentNoteIndex * SECONDS_PER_PRESENTER_NOTE;
  const driftSeconds = elapsedSeconds - plannedElapsedAtNote;
  const remainingSeconds = Math.max(0, TOTAL_DECK_SECONDS - elapsedSeconds);
  const overallMean = mean(completionRecords.map((record) => record.seconds));
  const partMean = mean(
    completionRecords
      .filter(
        (record) =>
          getSceneTiming(record.sceneId).part === activeTiming.part,
      )
      .map((record) => record.seconds),
  );
  const timerProgress = clamp(
    (elapsedSeconds / TOTAL_DECK_SECONDS) * 100,
    0,
    100,
  );

  const readElapsedNow = useCallback(() => {
    if (timerStartedAtRef.current === null) {
      return accumulatedSecondsRef.current;
    }
    return clamp(
      accumulatedSecondsRef.current +
        (performance.now() - timerStartedAtRef.current) / 1000,
      0,
      TOTAL_DECK_SECONDS,
    );
  }, []);

  const pauseTimer = useCallback(
    (message = "발표 타이머를 일시정지했습니다.") => {
      const elapsed = readElapsedNow();
      accumulatedSecondsRef.current = elapsed;
      timerStartedAtRef.current = null;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setElapsedSeconds(elapsed);
      setIsRunning(false);
      setAnnouncement(message);
    },
    [readElapsedNow],
  );

  const startTimer = useCallback(() => {
    if (mode !== "presentation") return;
    if (accumulatedSecondsRef.current >= TOTAL_DECK_SECONDS) {
      accumulatedSecondsRef.current = 0;
      setElapsedSeconds(0);
    }
    timerStartedAtRef.current = performance.now();
    sentenceStartedAtRef.current = performance.now();
    setIsRunning(true);
    setAnnouncement("발표 타이머를 시작했습니다.");
  }, [mode]);

  const goToScene = useCallback(
    (sceneId: SceneId, behavior?: ScrollBehavior) => {
      const scene = deckRef.current?.querySelector<HTMLElement>(
        `[data-scene-id="${sceneId}"]`,
      );
      scene?.scrollIntoView({
        behavior: behavior ?? (reducedMotion ? "auto" : "smooth"),
        block: "start",
      });
      setActiveSceneId(sceneId);
      setCurrentNoteId(getSceneTiming(sceneId).notes[0].id);
      sentenceStartedAtRef.current = performance.now();
    },
    [reducedMotion],
  );

  const resetDeck = useCallback(() => {
    pauseTimer("발표 상태를 초기화했습니다.");
    accumulatedSecondsRef.current = 0;
    sentenceStartedAtRef.current = performance.now();
    setElapsedSeconds(0);
    setCompletionRecords([]);
    setVisualHoldSeconds(0);
    setSuggestedCutCandidate(null);
    setCurrentNoteId("S01.01");
    goToScene("scene-01", "auto");
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Session persistence is an enhancement; the deck remains usable without it.
    }
  }, [goToScene, pauseTimer]);

  const openPresenterWindow = useCallback(() => {
    const existingWindow = presenterWindowRef.current;
    const existingRoot = presenterRootRef.current;
    if (existingWindow && !existingWindow.closed && existingRoot) {
      existingWindow.focus();
      setPresenterPortalRoot(existingRoot);
      setConsoleOpen(true);
      return true;
    }

    const width = 760;
    const height = Math.min(960, Math.max(700, window.screen.availHeight - 80));
    const left = Math.max(0, window.screen.availWidth - width - 32);
    const popup = window.open(
      "",
      "self-correction-presenter-notes",
      `popup=yes,width=${width},height=${height},left=${left},top=32,resizable=yes,scrollbars=yes`,
    );
    if (!popup) return false;

    try {
      const root = preparePresenterWindow(popup);
      presenterWindowRef.current = popup;
      presenterRootRef.current = root;
      setPresenterPortalRoot(root);
      setConsoleOpen(true);
      popup.addEventListener(
        "pagehide",
        () => {
          if (presenterWindowRef.current !== popup) return;
          presenterWindowRef.current = null;
          presenterRootRef.current = null;
          setPresenterPortalRoot(null);
          setConsoleOpen(false);
        },
        { once: true },
      );
      popup.focus();
      return true;
    } catch {
      popup.close();
      return false;
    }
  }, []);

  const closePresenterWindow = useCallback(() => {
    const popup = presenterWindowRef.current;
    presenterWindowRef.current = null;
    presenterRootRef.current = null;
    setPresenterPortalRoot(null);
    setConsoleOpen(false);
    if (popup && !popup.closed) {
      popup.close();
    }
  }, []);

  const changeMode = useCallback(
    (nextMode: DeckMode) => {
      const presenterWindowOpened =
        nextMode === "presentation" ? openPresenterWindow() : false;
      if (nextMode === mode) {
        if (nextMode === "presentation") {
          setAnnouncement(
            presenterWindowOpened
              ? "발표자 노트 창을 열었습니다."
              : "팝업이 차단되어 발표자 노트를 이 화면에 표시합니다.",
          );
        }
        return;
      }
      if (isRunning) {
        pauseTimer("보기 모드를 바꿔 발표 타이머를 일시정지했습니다.");
      }
      if (nextMode === "reading") {
        closePresenterWindow();
      }
      setMode(nextMode);
      setAnnouncement(
        nextMode === "presentation"
          ? presenterWindowOpened
            ? "발표 모드입니다. 발표자 노트를 새 창에 열었습니다."
            : "발표 모드입니다. 팝업이 차단되어 발표자 노트를 이 화면에 표시합니다."
          : "읽기 모드입니다. 모든 Scene과 발표자 노트를 이어서 표시합니다.",
      );
      window.requestAnimationFrame(() => goToScene(activeSceneId, "auto"));
    },
    [
      activeSceneId,
      closePresenterWindow,
      goToScene,
      isRunning,
      mode,
      openPresenterWindow,
      pauseTimer,
    ],
  );

  const moveNote = useCallback(
    (delta: -1 | 1) => {
      const flattened = SCENE_TIMINGS.flatMap((scene) =>
        scene.notes.map((note) => ({ sceneId: scene.id, note })),
      );
      const currentIndex = flattened.findIndex(
        ({ note }) => note.id === currentNoteId,
      );
      const nextIndex = clamp(currentIndex + delta, 0, flattened.length - 1);
      const target = flattened[nextIndex];
      if (target.sceneId !== activeSceneId) {
        goToScene(target.sceneId);
      }
      setCurrentNoteId(target.note.id);
      sentenceStartedAtRef.current = performance.now();
      setAnnouncement(`${target.note.id} 문장으로 이동했습니다.`);
    },
    [activeSceneId, currentNoteId, goToScene],
  );

  function markSentenceComplete(event: MouseEvent<HTMLButtonElement>) {
    const now = event.timeStamp;
    const measuredSeconds =
      sentenceStartedAtRef.current === null
        ? SECONDS_PER_PRESENTER_NOTE
        : Math.max(0.1, (now - sentenceStartedAtRef.current) / 1000);
    setCompletionRecords((records) => [
      ...records,
      {
        sceneId: activeSceneId,
        noteId: currentNote.id,
        seconds: measuredSeconds,
      },
    ]);
    sentenceStartedAtRef.current = now;
    setAnnouncement(
      `${currentNote.id} 낭독을 ${measuredSeconds.toFixed(1)}초로 기록했습니다.`,
    );
    moveNote(1);
  }

  function proposeCutCandidate() {
    if (overallMean === null || overallMean <= 8.5) return;
    const candidates = activeTiming.cutCandidates;
    if (!candidates.length) {
      setAnnouncement(
        `${PART_LABELS[activeTiming.part]}의 현재 Scene은 문장 컷 대상이 아닙니다.`,
      );
      return;
    }
    const nextCandidate =
      candidates[
        suggestedCutCandidate
          ? (candidates.indexOf(suggestedCutCandidate) + 1) %
            candidates.length
          : 0
      ];
    setSuggestedCutCandidate(nextCandidate);
    setAnnouncement(
      `${nextCandidate}을 컷 후보로 제안했습니다. 문장은 자동 삭제되지 않습니다.`,
    );
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = parseStoredState(
        window.sessionStorage.getItem(SESSION_KEY),
      );
      if (stored) {
        accumulatedSecondsRef.current = stored.elapsedSeconds;
        setElapsedSeconds(stored.elapsedSeconds);
        setMode(stored.mode);
        setActiveSceneId(stored.activeSceneId);
        setCurrentNoteId(stored.currentNoteId);
        setCompletionRecords(stored.completionRecords);
        setVisualHoldSeconds(stored.visualHoldSeconds);
        setSuggestedCutCandidate(stored.suggestedCutCandidate);
        restoredSceneRef.current = stored.activeSceneId;
        setAnnouncement("이 탭의 이전 발표 위치를 복원했습니다.");
      }
      setHasRestoredSession(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hasRestoredSession) return;
    const stored: StoredDeckState = {
      mode,
      activeSceneId,
      currentNoteId,
      elapsedSeconds,
      completionRecords,
      visualHoldSeconds,
      suggestedCutCandidate,
    };
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
    } catch {
      // The UI remains functional when storage is unavailable.
    }
  }, [
    activeSceneId,
    completionRecords,
    currentNoteId,
    elapsedSeconds,
    hasRestoredSession,
    mode,
    suggestedCutCandidate,
    visualHoldSeconds,
  ]);

  useEffect(() => {
    if (!hasRestoredSession || !restoredSceneRef.current) return;
    const restoredScene = restoredSceneRef.current;
    restoredSceneRef.current = null;
    window.requestAnimationFrame(() => goToScene(restoredScene, "auto"));
  }, [goToScene, hasRestoredSession]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const closeOnPageExit = () => {
      const popup = presenterWindowRef.current;
      presenterWindowRef.current = null;
      presenterRootRef.current = null;
      if (popup && !popup.closed) popup.close();
    };
    window.addEventListener("pagehide", closeOnPageExit);
    return () => {
      window.removeEventListener("pagehide", closeOnPageExit);
      closeOnPageExit();
    };
  }, []);

  useEffect(() => {
    const currentPopupNote = presenterPortalRoot?.querySelector<HTMLElement>(
      `[data-popup-presenter-note="${currentNoteId}"]`,
    );
    currentPopupNote?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [currentNoteId, presenterPortalRoot, reducedMotion]);

  useEffect(() => {
    if (!isRunning) return;
    if (timerStartedAtRef.current === null) {
      timerStartedAtRef.current = performance.now();
    }

    const tick = () => {
      const nextElapsed = readElapsedNow();
      const quarter = Math.floor(nextElapsed * 4);
      if (
        quarter !== lastRenderedQuarterRef.current ||
        nextElapsed >= TOTAL_DECK_SECONDS
      ) {
        lastRenderedQuarterRef.current = quarter;
        setElapsedSeconds(nextElapsed);
      }
      if (nextElapsed >= TOTAL_DECK_SECONDS) {
        accumulatedSecondsRef.current = TOTAL_DECK_SECONDS;
        timerStartedAtRef.current = null;
        setIsRunning(false);
        setAnnouncement("25분 발표 예산에 도달했습니다.");
        return;
      }
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isRunning, readElapsedNow]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && isRunning) {
        pauseTimer(
          "탭이 보이지 않아 발표 타이머를 자동으로 일시정지했습니다.",
        );
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isRunning, pauseTimer]);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    const ratios = new Map<SceneId, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const candidate = (entry.target as HTMLElement).dataset.sceneId;
          if (candidate && isSceneId(candidate)) {
            ratios.set(candidate, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
        }
        const visible = [...ratios.entries()]
          .filter(([, ratio]) => ratio > 0)
          .sort((left, right) => right[1] - left[1])[0];
        if (!visible) return;
        setActiveSceneId((current) => {
          if (current === visible[0]) return current;
          const nextTiming = getSceneTiming(visible[0]);
          setCurrentNoteId(nextTiming.notes[0].id);
          sentenceStartedAtRef.current = performance.now();
          return visible[0];
        });
      },
      {
        root: mode === "presentation" ? deck : null,
        rootMargin: mode === "presentation" ? "-18% 0px -22% 0px" : "-22% 0px -58% 0px",
        threshold: [0, 0.2, 0.4, 0.6, 0.8],
      },
    );

    deck
      .querySelectorAll<HTMLElement>("[data-scene-id]")
      .forEach((scene) => observer.observe(scene));
    return () => observer.disconnect();
  }, [mode]);

  const context = useMemo<DeckContextValue>(
    () => ({
      activeSceneId,
      elapsedSeconds,
      isRunning,
      mode,
      reducedMotion,
    }),
    [activeSceneId, elapsedSeconds, isRunning, mode, reducedMotion],
  );

  return (
    <DeckContext.Provider value={context}>
      <div
        ref={deckRef}
        className={styles.deck}
        data-research-deck
        data-mode={mode}
        data-active-scene={activeSceneId}
        data-reduced-motion={reducedMotion ? "true" : "false"}
        data-total-seconds={TOTAL_DECK_SECONDS}
        data-speech-seconds={TOTAL_SPEECH_SECONDS}
        data-visual-seconds={TOTAL_VISUAL_SECONDS}
      >
        <header className={styles.deckTopBar}>
          <div className={styles.topBarPrimary}>
            <a className={styles.deckIdentity} href="#scene-01">
              <span>SELF-CORRECTION</span>
              <strong>{TITLE_KO}</strong>
            </a>
            <div className={styles.modeSwitch} role="group" aria-label="문서 보기 모드">
              <button
                type="button"
                aria-pressed={mode === "reading"}
                onClick={() => changeMode("reading")}
              >
                <BookOpenText aria-hidden="true" size={15} />
                읽기
              </button>
              <button
                type="button"
                aria-pressed={mode === "presentation"}
                onClick={() => changeMode("presentation")}
              >
                <Gauge aria-hidden="true" size={15} />
                발표
              </button>
            </div>
            <div className={styles.timerControls}>
              <button
                type="button"
                onClick={isRunning ? () => pauseTimer() : startTimer}
                disabled={mode !== "presentation"}
                aria-label={isRunning ? "발표 타이머 일시정지" : "발표 타이머 시작"}
              >
                {isRunning ? (
                  <Pause aria-hidden="true" size={16} />
                ) : (
                  <Play aria-hidden="true" size={16} />
                )}
                <span>{isRunning ? "일시정지" : "시작"}</span>
              </button>
              <button
                type="button"
                onClick={resetDeck}
                aria-label="발표 상태 초기화"
              >
                <RotateCcw aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                aria-expanded={consoleOpen}
                disabled={mode !== "presentation"}
                aria-label={
                  presenterPortalRoot
                    ? "발표자 노트 창 닫기"
                    : "발표자 노트 창 열기"
                }
                onClick={() => {
                  if (mode !== "presentation") return;
                  if (presenterPortalRoot) {
                    closePresenterWindow();
                    return;
                  }
                  if (mode === "presentation" && consoleOpen) {
                    setConsoleOpen(false);
                    return;
                  }
                  const opened = openPresenterWindow();
                  setConsoleOpen(opened || mode === "presentation");
                }}
              >
                노트 창
              </button>
            </div>
          </div>

          <div className={styles.deckTelemetry}>
            <div>
              <span>{PART_LABELS[activeTiming.part]}</span>
              <strong>
                Scene {String(activeTiming.index).padStart(2, "0")} / 08
              </strong>
            </div>
            <div>
              <span>elapsed</span>
              <time dateTime={`PT${Math.round(elapsedSeconds)}S`}>
                {formatClock(elapsedSeconds)}
              </time>
            </div>
            <div>
              <span>remaining</span>
              <time dateTime={`PT${Math.round(remainingSeconds)}S`}>
                {formatClock(remainingSeconds)}
              </time>
            </div>
            <div data-drift={driftSeconds > 0.5 ? "late" : driftSeconds < -0.5 ? "early" : "on-time"}>
              <span>drift</span>
              <strong>{formatSignedClock(driftSeconds)}</strong>
            </div>
          </div>

          <nav className={styles.sceneRail} aria-label="발표 Scene">
            {SCENE_TIMINGS.map((scene) => (
              <button
                key={scene.id}
                type="button"
                data-part={scene.part}
                data-active={activeSceneId === scene.id ? "true" : "false"}
                aria-current={activeSceneId === scene.id ? "step" : undefined}
                aria-label={`${scene.index}번 Scene, ${PART_LABELS[scene.part]}, ${formatClock(scene.totalSeconds)}`}
                style={{ flexGrow: scene.totalSeconds }}
                onClick={() => goToScene(scene.id)}
              >
                <span>{String(scene.index).padStart(2, "0")}</span>
              </button>
            ))}
            <span
              className={styles.timerProgress}
              style={{ width: `${timerProgress}%` }}
              aria-hidden="true"
            />
          </nav>
        </header>

        <div className={styles.deckBody}>{children}</div>

        {mode === "presentation" && consoleOpen ? (
          <PresenterSurface root={presenterPortalRoot}>
            <aside className={styles.presenterConsole} aria-label="발표자 console">
            <div className={styles.consoleHeader}>
              <div>
                <span>PRESENTER CONSOLE</span>
                <strong>{PART_LABELS[activeTiming.part]}</strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (presenterPortalRoot) {
                    closePresenterWindow();
                    return;
                  }
                  setConsoleOpen(false);
                }}
                aria-label="발표자 console 접기"
              >
                <ChevronDown aria-hidden="true" size={16} />
              </button>
            </div>

            <dl className={styles.consoleMetrics}>
              <div>
                <dt>Part</dt>
                <dd>
                  {formatClock(currentPartElapsed)} /{" "}
                  {formatClock(PART_TOTAL_SECONDS[activeTiming.part])}
                </dd>
              </div>
              <div>
                <dt>Scene</dt>
                <dd>
                  {formatClock(currentSceneElapsed)} /{" "}
                  {formatClock(activeTiming.totalSeconds)}
                </dd>
              </div>
              <div>
                <dt>전체</dt>
                <dd>
                  {formatClock(elapsedSeconds)} /{" "}
                  {formatClock(TOTAL_DECK_SECONDS)}
                </dd>
              </div>
              <div data-drift={driftSeconds > 0.5 ? "late" : "on-time"}>
                <dt>drift</dt>
                <dd>{formatSignedClock(driftSeconds)}</dd>
              </div>
              <div>
                <dt>전체 평균</dt>
                <dd>{overallMean === null ? "—" : `${overallMean.toFixed(1)}s`}</dd>
              </div>
              <div>
                <dt>Part 평균</dt>
                <dd>{partMean === null ? "—" : `${partMean.toFixed(1)}s`}</dd>
              </div>
            </dl>

            <div className={styles.consoleScript}>
              <div>
                <span>NOW</span>
                <p>
                  <strong>{currentNote.id}</strong> {currentNote.text}
                </p>
              </div>
              <div>
                <span>NEXT</span>
                <p>
                  {nextNote ? (
                    <>
                      <strong>{nextNote.id}</strong> {nextNote.text}
                    </>
                  ) : (
                    "발표 종료"
                  )}
                </p>
              </div>
            </div>

            <section
              className={styles.presenterWindowNotes}
              aria-label={`${activeTiming.index}번 Scene 발표자 노트`}
            >
              <header>
                <div>
                  <span>SCENE SCRIPT</span>
                  <strong>
                    Scene {String(activeTiming.index).padStart(2, "0")} ·{" "}
                    {activeTiming.sentenceBudget}문장
                  </strong>
                </div>
                <time>{formatClock(activeTiming.speechSeconds)}</time>
              </header>
              <ol>
                {activeTiming.notes.map((note) => {
                  const isCurrent = note.id === currentNote.id;
                  const cutCandidate = activeTiming.cutCandidates.includes(
                    note.id,
                  );
                  return (
                    <li
                      key={note.id}
                      data-popup-presenter-note={note.id}
                      data-current={isCurrent ? "true" : "false"}
                    >
                      <button
                        type="button"
                        aria-current={isCurrent ? "step" : undefined}
                        onClick={() => {
                          setCurrentNoteId(note.id);
                          sentenceStartedAtRef.current = performance.now();
                          setAnnouncement(`${note.id} 문장으로 이동했습니다.`);
                        }}
                      >
                        <span>{note.id}</span>
                        <p>{note.text}</p>
                        {cutCandidate ? <small>컷 후보</small> : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className={styles.consoleActions}>
              <button type="button" onClick={markSentenceComplete}>
                문장 완료
              </button>
              <button
                type="button"
                onClick={proposeCutCandidate}
                disabled={
                  overallMean === null ||
                  overallMean <= 8.5 ||
                  activeTiming.cutCandidates.length === 0
                }
                title="평균이 8.5초를 넘을 때 와이어프레임에 지정된 후보만 제안합니다."
              >
                컷 후보
              </button>
              <button
                type="button"
                onClick={() => {
                  setVisualHoldSeconds((seconds) => seconds + 5);
                  setAnnouncement("시각 자료 정지 5초를 기록했습니다.");
                }}
              >
                visual hold +5s
              </button>
              <button
                type="button"
                onClick={() => moveNote(-1)}
                aria-label="이전 발표자 노트"
              >
                <ChevronLeft aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveNote(1)}
                aria-label="다음 발표자 노트"
              >
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </div>

            <div className={styles.consoleFooter}>
              <span>visual hold {visualHoldSeconds}s</span>
              {suggestedCutCandidate ? (
                <span>
                  제안: <strong>{suggestedCutCandidate}</strong> · 자동 삭제 안 함
                </span>
              ) : (
                <span>
                  {overallMean !== null && overallMean > 8.5
                    ? "현재 Scene의 지정 후보를 확인하십시오."
                    : "평균 8.5초 이내"}
                </span>
              )}
            </div>

            <ol className={styles.checkpoints} aria-label="발표 hard checkpoint">
              {HARD_CHECKPOINTS.map((checkpoint) => (
                <li
                  key={checkpoint.afterScene}
                  data-reached={
                    elapsedSeconds >= checkpoint.seconds ? "true" : "false"
                  }
                >
                  <span>{checkpoint.label}</span>
                  <time>{formatClock(checkpoint.seconds)}</time>
                </li>
              ))}
            </ol>
            </aside>
          </PresenterSurface>
        ) : null}

        <p className={styles.liveStatus} role="status" aria-live="polite">
          {announcement}
        </p>
      </div>
    </DeckContext.Provider>
  );
}
