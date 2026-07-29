"use client";

import { Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";

import type {
  PlaybackControls,
  PlaybackState,
} from "./use-scene-playback";
import styles from "./playback-bar.module.css";

/**
 * Shared playback controls for every scene visual. Buttons keep the 44px
 * touch contract, and every press counts as user interaction so autoplay
 * hands control over per wireframe §12.5.
 */
export function PlaybackBar({
  state,
  controls,
  stepCount,
  stepLabel,
  markUserInteraction,
}: {
  state: PlaybackState;
  controls: PlaybackControls;
  stepCount: number;
  stepLabel: string;
  markUserInteraction: () => void;
}) {
  const playing = state.status === "playing";

  const wrap = (action: () => void) => () => {
    markUserInteraction();
    action();
  };

  return (
    <div className={styles.bar} data-playback-bar>
      <div className={styles.transport}>
        <button
          type="button"
          onClick={wrap(playing ? controls.pause : controls.play)}
          disabled={state.reducedMotion}
          aria-label={playing ? "일시정지" : "재생"}
          title={playing ? "일시정지" : "재생"}
        >
          {playing ? (
            <Pause aria-hidden="true" size={16} />
          ) : (
            <Play aria-hidden="true" size={16} />
          )}
        </button>
        <button
          type="button"
          onClick={wrap(controls.stepBack)}
          aria-label="이전 단계"
          title="이전 단계"
        >
          <StepBack aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          onClick={wrap(controls.stepForward)}
          aria-label="다음 단계"
          title="다음 단계"
        >
          <StepForward aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          onClick={wrap(controls.replay)}
          aria-label="처음부터 재생"
          title="처음부터 재생"
        >
          <RotateCcw aria-hidden="true" size={16} />
        </button>
      </div>
      <span className={styles.stepLabel}>
        {state.status === "idle"
          ? "대기 중"
          : `${Math.min(state.step + 1, stepCount)} / ${stepCount} · ${stepLabel}`}
      </span>
      {state.reducedMotion ? (
        <span className={styles.reducedNote}>
          모션 감소 설정으로 자동 재생을 사용할 수 없습니다. 단계 버튼으로
          살펴보세요.
        </span>
      ) : null}
    </div>
  );
}
