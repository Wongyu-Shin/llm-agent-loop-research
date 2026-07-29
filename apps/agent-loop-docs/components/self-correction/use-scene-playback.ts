"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type RefObject,
} from "react";

/**
 * Wireframe §12.5 playback contract, shared by every scene visual.
 *
 * - Autoplay runs once, on first viewport entry, only while the user has
 *   not interacted and reduced motion is off.
 * - Under `prefers-reduced-motion` the final state renders first and the
 *   user steps through manually (§2.3).
 * - The SVG and its DOM-equivalent fallback must both derive from the
 *   single `state.step` this hook owns — no parallel timelines.
 * - Timers are a `setTimeout` chain (never requestAnimationFrame) so the
 *   deck shell's own rAF presentation timer is left alone.
 */

export type PlaybackStep = {
  id: string;
  durationMs: number;
  label: string;
};

export type PlaybackStatus = "idle" | "playing" | "paused" | "completed";

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

export type PlaybackState = {
  status: PlaybackStatus;
  step: number;
  speed: PlaybackSpeed;
  hasUserInteracted: boolean;
  reducedMotion: boolean;
};

type PlaybackAction =
  | { type: "ENTER_VIEWPORT" }
  | { type: "ADVANCE" }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "STEP_FORWARD" }
  | { type: "STEP_BACK" }
  | { type: "REPLAY" }
  | { type: "RESET" }
  | { type: "USER_INTERACT" }
  | { type: "SET_REDUCED_MOTION"; value: boolean }
  | { type: "SET_SPEED"; value: PlaybackSpeed };

function createReducer(stepCount: number) {
  const lastStep = Math.max(0, stepCount - 1);

  return function reduce(
    state: PlaybackState,
    action: PlaybackAction,
  ): PlaybackState {
    switch (action.type) {
      case "SET_REDUCED_MOTION": {
        if (action.value === state.reducedMotion) return state;
        if (action.value) {
          // Final state first; manual step buttons take over.
          return {
            ...state,
            reducedMotion: true,
            status: "completed",
            step: lastStep,
          };
        }
        return { ...state, reducedMotion: false };
      }
      case "ENTER_VIEWPORT": {
        if (
          state.status !== "idle" ||
          state.hasUserInteracted ||
          state.reducedMotion
        ) {
          return state;
        }
        return { ...state, status: "playing", step: 0 };
      }
      case "ADVANCE": {
        if (state.status !== "playing") return state;
        if (state.step >= lastStep) {
          return { ...state, status: "completed", step: lastStep };
        }
        return { ...state, step: state.step + 1 };
      }
      case "PLAY": {
        if (state.status === "playing") return state;
        const step =
          state.status === "completed" && state.step >= lastStep
            ? 0
            : state.step;
        return { ...state, status: "playing", step };
      }
      case "PAUSE": {
        if (state.status !== "playing") return state;
        return { ...state, status: "paused" };
      }
      case "STEP_FORWARD": {
        const step = Math.min(lastStep, state.step + 1);
        return {
          ...state,
          step,
          status: step >= lastStep ? "completed" : "paused",
        };
      }
      case "STEP_BACK": {
        return { ...state, step: Math.max(0, state.step - 1), status: "paused" };
      }
      case "REPLAY": {
        if (state.reducedMotion) {
          return { ...state, step: 0, status: "paused" };
        }
        return { ...state, step: 0, status: "playing" };
      }
      case "RESET": {
        return { ...state, step: 0, status: "paused" };
      }
      case "USER_INTERACT": {
        if (state.hasUserInteracted && state.status !== "playing") return state;
        return {
          ...state,
          hasUserInteracted: true,
          status: state.status === "playing" ? "paused" : state.status,
        };
      }
      case "SET_SPEED": {
        return { ...state, speed: action.value };
      }
    }
  };
}

export type PlaybackControls = {
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBack: () => void;
  replay: () => void;
  reset: () => void;
  setSpeed: (value: PlaybackSpeed) => void;
};

export function useScenePlayback(
  steps: readonly PlaybackStep[],
  containerRef: RefObject<Element | null>,
) {
  const reducer = useMemo(() => createReducer(steps.length), [steps.length]);
  const [state, dispatch] = useReducer(reducer, {
    status: "idle",
    step: 0,
    speed: 1,
    hasUserInteracted: false,
    reducedMotion: false,
  });
  const hasAutoplayedRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    dispatch({ type: "SET_REDUCED_MOTION", value: media.matches });
    const onChange = (event: MediaQueryListEvent) => {
      dispatch({ type: "SET_REDUCED_MOTION", value: event.matches });
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || hasAutoplayedRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Tall scenes never reach a high ratio, so also fire when the
          // visible slice covers a meaningful share of the viewport.
          const viewportShare =
            entry.intersectionRect.height / window.innerHeight;
          if (
            entry.isIntersecting &&
            (entry.intersectionRatio >= 0.35 || viewportShare >= 0.45) &&
            !hasAutoplayedRef.current
          ) {
            hasAutoplayedRef.current = true;
            dispatch({ type: "ENTER_VIEWPORT" });
            observer.disconnect();
          }
        }
      },
      { threshold: [0, 0.1, 0.2, 0.35] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    if (state.status !== "playing") return;
    const current = steps[state.step];
    if (!current) return;
    const timer = window.setTimeout(
      () => dispatch({ type: "ADVANCE" }),
      current.durationMs / state.speed,
    );
    return () => window.clearTimeout(timer);
  }, [state.status, state.step, state.speed, steps]);

  const markUserInteraction = useCallback(() => {
    dispatch({ type: "USER_INTERACT" });
  }, []);

  const controls = useMemo<PlaybackControls>(
    () => ({
      play: () => dispatch({ type: "PLAY" }),
      pause: () => dispatch({ type: "PAUSE" }),
      stepForward: () => dispatch({ type: "STEP_FORWARD" }),
      stepBack: () => dispatch({ type: "STEP_BACK" }),
      replay: () => dispatch({ type: "REPLAY" }),
      reset: () => dispatch({ type: "RESET" }),
      setSpeed: (value: PlaybackSpeed) =>
        dispatch({ type: "SET_SPEED", value }),
    }),
    [],
  );

  const currentStep = steps[state.step] ?? null;

  const reachedStep = useCallback(
    (stepId: string) => {
      const index = steps.findIndex((candidate) => candidate.id === stepId);
      if (index === -1) return false;
      if (state.status === "idle") return false;
      return state.step >= index;
    },
    [state.status, state.step, steps],
  );

  return { state, controls, markUserInteraction, currentStep, reachedStep };
}
