import { expect, test } from "@playwright/test";

import {
  breakEvenConfidenceLevel,
  convergenceAlpha,
  stationaryAccuracyAtRound,
  stationaryUpperBound,
  transitionBreakdown,
  verdictForNetChange,
} from "../components/self-correction/paper-model";
import {
  CANONICAL_AUTORESEARCH_CAMPAIGN,
  CRITERION_TRANSITION_EXAMPLE,
  determineStopReason,
  foldCampaign,
  formatMetricValue,
  INITIAL_CAMPAIGN_STATE,
  reduceExperiment,
  TANK_DEFAULTS,
  VERIFIER_BLOCK_RATES,
  type StopInputs,
} from "../components/self-correction/loop-model";
import {
  HARD_CHECKPOINTS,
  PART_TOTAL_SECONDS,
  SCENE_TIMINGS,
  SECONDS_PER_PRESENTER_NOTE,
  TOTAL_DECK_SECONDS,
  TOTAL_SENTENCE_BUDGET,
  TOTAL_SPEECH_SECONDS,
  TOTAL_VISUAL_SECONDS,
} from "../components/self-correction/presenter-notes";

test.describe("발표 시간 계약 (wireframe §1, §12.2)", () => {
  test("장면별 문장 수와 시간 예산이 와이어프레임과 일치한다", () => {
    expect(SCENE_TIMINGS.map((scene) => scene.sentenceBudget)).toEqual([
      8, 21, 19, 25, 10, 22, 30, 15,
    ]);
    expect(SCENE_TIMINGS.map((scene) => scene.visualSeconds)).toEqual([
      16, 32, 28, 40, 20, 64, 70, 30,
    ]);
    for (const scene of SCENE_TIMINGS) {
      expect(scene.speechSeconds).toBe(
        scene.sentenceBudget * SECONDS_PER_PRESENTER_NOTE,
      );
      expect(scene.totalSeconds).toBe(
        scene.speechSeconds + scene.visualSeconds,
      );
    }
  });

  test("전체·Part별 합계와 hard checkpoint가 계약과 일치한다", () => {
    expect(TOTAL_SENTENCE_BUDGET).toBe(150);
    expect(TOTAL_SPEECH_SECONDS).toBe(1200);
    expect(TOTAL_VISUAL_SECONDS).toBe(300);
    expect(TOTAL_DECK_SECONDS).toBe(1500);
    expect(PART_TOTAL_SECONDS).toEqual({ paper: 700, bridge: 100, practice: 700 });
    expect(HARD_CHECKPOINTS.map((checkpoint) => checkpoint.seconds)).toEqual([
      700, 800, 1500,
    ]);
  });

  test("발표자 노트 ID는 장면별로 연속이고 컷 후보는 지정 집합과 같다", () => {
    const expectedCuts = [
      ["S01.06"],
      ["S02.04", "S02.18"],
      ["S03.07", "S03.10"],
      ["S04.05", "S04.11", "S04.13"],
      [],
      ["S06.03", "S06.12"],
      ["S07.07", "S07.20", "S07.25", "S07.28"],
      [],
    ];
    SCENE_TIMINGS.forEach((scene, sceneIndex) => {
      scene.notes.forEach((note, noteIndex) => {
        const expectedId = `S${String(sceneIndex + 1).padStart(2, "0")}.${String(noteIndex + 1).padStart(2, "0")}`;
        expect(note.id).toBe(expectedId);
        expect(note.text.length).toBeGreaterThan(0);
      });
      expect([...scene.cutCandidates]).toEqual(expectedCuts[sceneIndex]);
      for (const cut of scene.cutCandidates) {
        expect(scene.notes.some((note) => note.id === cut)).toBe(true);
      }
    });
  });
});

test.describe("논문 수식 모델 (wireframe §4–6, §12.3)", () => {
  test("전이 회계의 네 셀은 합이 1이고 다음 정확도와 정합한다", () => {
    const breakdown = transitionBreakdown(0.7, 0.9, 0.4);
    const cellSum =
      breakdown.preservedCorrect +
      breakdown.damagedCorrect +
      breakdown.recoveredCorrect +
      breakdown.remainingIncorrect;
    expect(cellSum).toBeCloseTo(1, 12);
    expect(breakdown.preservedCorrect).toBeCloseTo(0.63, 12);
    expect(breakdown.recoveredCorrect).toBeCloseTo(0.12, 12);
    expect(breakdown.nextAccuracy).toBeCloseTo(0.75, 12);
    expect(breakdown.netChange).toBeCloseTo(0.05, 12);
  });

  test("99% 예시의 손익분기 CL_t는 약 0.994949다", () => {
    const breakEven = breakEvenConfidenceLevel(0.99, 0.5);
    expect(breakEven).not.toBeNull();
    expect(breakEven as number).toBeCloseTo(0.99494949, 8);
    expect(breakEvenConfidenceLevel(0, 0.5)).toBeNull();
  });

  test("CL=1, CS=0 경계에서는 Upp를 계산하지 않는다", () => {
    expect(stationaryUpperBound(1, 0)).toBeNull();
    expect(stationaryAccuracyAtRound(0.42, 1, 0, 7)).toBe(0.42);
  });

  test("정지 궤적은 Upp를 향해 α 배율로 수렴한다", () => {
    const confidenceLevel = 0.9;
    const critiqueScore = 0.2;
    const upp = stationaryUpperBound(confidenceLevel, critiqueScore);
    const alpha = convergenceAlpha(confidenceLevel, critiqueScore);
    expect(upp).toBeCloseTo(0.2 / 0.3, 12);
    expect(alpha).toBeCloseTo(0.7, 12);
    const deviation0 = (upp as number) - 0.3;
    const deviation1 =
      (upp as number) -
      stationaryAccuracyAtRound(0.3, confidenceLevel, critiqueScore, 1);
    expect(deviation1 / deviation0).toBeCloseTo(alpha, 12);
  });

  test("순변화 verdict는 부호와 epsilon 경계를 따른다", () => {
    expect(verdictForNetChange(0.05)).toBe("BENEFICIAL");
    expect(verdictForNetChange(-0.0001)).toBe("HARMFUL");
    expect(verdictForNetChange(0)).toBe("BREAK_EVEN");
    expect(verdictForNetChange(1e-9)).toBe("BREAK_EVEN");
  });
});

test.describe("실험 loop 모델 (wireframe §9, §12.4)", () => {
  test("reducer fold는 canonical fixture의 incumbent 체인과 일치한다", () => {
    let state = INITIAL_CAMPAIGN_STATE;
    const incumbentChain: Array<string | null> = [];
    for (const record of CANONICAL_AUTORESEARCH_CAMPAIGN) {
      state = reduceExperiment(state, record);
      incumbentChain.push(state.incumbent);
      expect(state.incumbent).toBe(record.incumbentAfter);
    }
    expect(incumbentChain).toEqual([
      "a1b2c3d",
      "b2c3d4e",
      "b2c3d4e",
      "b2c3d4e",
    ]);
    expect(state.ledger).toHaveLength(4);
    expect(state.bestSoFar).toEqual({
      revision: "b2c3d4e",
      metricValue: 0.9932,
    });
  });

  test("crash 기록은 화면값이 측정 없음이고 raw sentinel은 ledger row에만 남는다", () => {
    const crash = CANONICAL_AUTORESEARCH_CAMPAIGN[3];
    expect(crash.observation.exitStatus).toBe("crash");
    expect(crash.metrics.every((metric) => metric.value === null)).toBe(true);
    expect(formatMetricValue(crash.metrics[0].value)).toBe("측정 없음");
    expect(crash.rawLedgerRow).toContain("0.000000");
  });

  test("foldCampaign은 reduceExperiment의 순차 적용과 같다", () => {
    const folded = foldCampaign(CANONICAL_AUTORESEARCH_CAMPAIGN);
    expect(folded.incumbent).toBe("b2c3d4e");
    expect(folded.bestSoFar?.revision).toBe("b2c3d4e");
  });

  test("stop reason은 안전·무결성을 성능보다 먼저 평가한다 (S07.29)", () => {
    const base: StopInputs = {
      manualInterrupt: false,
      safetyViolation: false,
      harnessValid: true,
      successPredicateMet: false,
      humanGateRequired: false,
      cycleDetected: false,
      plateauIterations: 0,
      campaignBudgetRemainingHours: 4,
      testableHypothesisAvailable: true,
    };
    expect(determineStopReason(base)).toBeNull();
    expect(
      determineStopReason({
        ...base,
        safetyViolation: true,
        successPredicateMet: true,
      }),
    ).toBe("SAFETY_VIOLATION");
    expect(
      determineStopReason({
        ...base,
        harnessValid: false,
        successPredicateMet: true,
      }),
    ).toBe("HARNESS_INVALID");
    expect(determineStopReason({ ...base, successPredicateMet: true })).toBe(
      "SUCCESS_PREDICATE_MET",
    );
    expect(determineStopReason({ ...base, plateauIterations: 5 })).toBe(
      "PLATEAU",
    );
    expect(
      determineStopReason({ ...base, campaignBudgetRemainingHours: 0 }),
    ).toBe("CAMPAIGN_BUDGET_EXHAUSTED");
    expect(
      determineStopReason({ ...base, testableHypothesisAvailable: false }),
    ).toBe("BLOCKED");
  });

  test("candidate 전이 예시는 gate가 system state를 보호함을 보여 준다", () => {
    const example = CRITERION_TRANSITION_EXAMPLE;
    expect(example.preserved + example.damaged).toBe(example.incumbentPass);
    expect(example.recovered + example.remaining).toBe(example.incumbentFail);
    expect(example.preserved + example.recovered).toBe(example.candidatePass);
    expect(example.candidatePass).toBeLessThan(example.incumbentPass);
    expect(example.verdict).toBe("DISCARD");
    expect(example.systemPassAfterGate).toBe(example.incumbentPass);
  });

  test("평형 수조의 verifier별 천장은 63.6% · 89.7% · 100%다", () => {
    const { critiqueScore, damage } = TANK_DEFAULTS;
    const ceilingFor = (blockRate: number) => {
      const ceiling = stationaryUpperBound(
        1 - damage * (1 - blockRate),
        critiqueScore,
      );
      expect(ceiling).not.toBeNull();
      return ceiling as number;
    };

    expect(ceilingFor(VERIFIER_BLOCK_RATES.none)).toBeCloseTo(0.6364, 4);
    expect(ceilingFor(VERIFIER_BLOCK_RATES.external)).toBeCloseTo(0.8974, 4);
    expect(ceilingFor(VERIFIER_BLOCK_RATES.gate)).toBe(1);
    // 기본 시작 수위는 천장보다 높아야 "끌려 내려오는" 수렴이 보인다.
    expect(TANK_DEFAULTS.initialAccuracy).toBeGreaterThan(
      ceilingFor(VERIFIER_BLOCK_RATES.none),
    );
  });
});
