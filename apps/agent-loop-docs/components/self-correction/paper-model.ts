export type TransitionBreakdown = {
  preservedCorrect: number;
  damagedCorrect: number;
  recoveredCorrect: number;
  remainingIncorrect: number;
  nextAccuracy: number;
  netChange: number;
};

export type TrajectoryPoint = {
  round: number;
  accuracy: number;
};

function assertProbability(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite probability in [0, 1].`);
  }
}

function assertRound(round: number) {
  if (!Number.isInteger(round) || round < 0) {
    throw new RangeError("round must be a non-negative integer.");
  }
}

/**
 * Paper transition, re-indexed from t-1 → t to t → t+1:
 * Acc_{t+1} = Acc_t × CL_t + (1 - Acc_t) × CS_t.
 */
export function transitionAccuracy(
  accT: number,
  confidenceLevelT: number,
  critiqueScoreT: number,
) {
  assertProbability(accT, "Acc_t");
  assertProbability(confidenceLevelT, "CL_t");
  assertProbability(critiqueScoreT, "CS_t");

  return accT * confidenceLevelT + (1 - accT) * critiqueScoreT;
}

/** Recovery inflow: (1 - Acc_t) × CS_t. */
export function recoveryGain(accT: number, critiqueScoreT: number) {
  assertProbability(accT, "Acc_t");
  assertProbability(critiqueScoreT, "CS_t");

  return (1 - accT) * critiqueScoreT;
}

/** Damage outflow: Acc_t × (1 - CL_t). */
export function damageLoss(accT: number, confidenceLevelT: number) {
  assertProbability(accT, "Acc_t");
  assertProbability(confidenceLevelT, "CL_t");

  return accT * (1 - confidenceLevelT);
}

export function transitionBreakdown(
  accT: number,
  confidenceLevelT: number,
  critiqueScoreT: number,
): TransitionBreakdown {
  assertProbability(accT, "Acc_t");
  assertProbability(confidenceLevelT, "CL_t");
  assertProbability(critiqueScoreT, "CS_t");

  const preservedCorrect = accT * confidenceLevelT;
  const damagedCorrect = damageLoss(accT, confidenceLevelT);
  const recoveredCorrect = recoveryGain(accT, critiqueScoreT);
  const remainingIncorrect = (1 - accT) * (1 - critiqueScoreT);
  const nextAccuracy = preservedCorrect + recoveredCorrect;

  return {
    preservedCorrect,
    damagedCorrect,
    recoveredCorrect,
    remainingIncorrect,
    nextAccuracy,
    netChange: recoveredCorrect - damagedCorrect,
  };
}

/**
 * Paper notation Upp = CS / (1 - CL + CS).
 * The identity transition CL=1, CS=0 has no single Upp, so null is returned.
 */
export function stationaryUpperBound(
  confidenceLevel: number,
  critiqueScore: number,
) {
  assertProbability(confidenceLevel, "CL");
  assertProbability(critiqueScore, "CS");

  const denominator = 1 - confidenceLevel + critiqueScore;
  return denominator === 0 ? null : critiqueScore / denominator;
}

/** Paper notation α = CL - CS. */
export function convergenceAlpha(
  confidenceLevel: number,
  critiqueScore: number,
) {
  assertProbability(confidenceLevel, "CL");
  assertProbability(critiqueScore, "CS");

  return confidenceLevel - critiqueScore;
}

/**
 * Closed-form stationary trajectory:
 * Acc_t = Upp - α^t × (Upp - Acc_0).
 */
export function stationaryAccuracyAtRound(
  initialAccuracy: number,
  confidenceLevel: number,
  critiqueScore: number,
  round: number,
) {
  assertProbability(initialAccuracy, "Acc_0");
  assertProbability(confidenceLevel, "CL");
  assertProbability(critiqueScore, "CS");
  assertRound(round);

  const upp = stationaryUpperBound(confidenceLevel, critiqueScore);
  if (upp === null) return initialAccuracy;

  const alpha = convergenceAlpha(confidenceLevel, critiqueScore);
  return upp - Math.pow(alpha, round) * (upp - initialAccuracy);
}

export function stationaryTrajectory(
  initialAccuracy: number,
  confidenceLevel: number,
  critiqueScore: number,
  rounds: number,
): TrajectoryPoint[] {
  assertProbability(initialAccuracy, "Acc_0");
  assertProbability(confidenceLevel, "CL");
  assertProbability(critiqueScore, "CS");
  assertRound(rounds);

  return Array.from({ length: rounds + 1 }, (_, round) => ({
    round,
    accuracy: stationaryAccuracyAtRound(
      initialAccuracy,
      confidenceLevel,
      critiqueScore,
      round,
    ),
  }));
}
