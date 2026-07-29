import {
  stationaryTrajectory,
  stationaryUpperBound,
} from "./paper-model";

/**
 * EMNLP 2025 원 논문(2025.emnlp-main.685) 그림에서 옮긴 실측 곡선 fixture.
 *
 * 수치 규약 (wireframe §12.1 provenance):
 * - "figure-digitized": 논문 그림에서 눈으로 읽은 근사값. 원문은 수치 표를
 *   제공하지 않으므로 ±1%p 수준의 오차가 있다. 화면 fallback에 반드시
 *   근사 출처를 병기한다.
 * - "paper-explicit": 원문이 텍스트·범례로 숫자를 명시한 값 (예: Figure 4·9의 α).
 * - "derived": Upp·α 눈읽기 값에서 CL = α + CS, CS = Upp × (1 − α)로 역산.
 *
 * 이론 곡선은 저장하지 않고 (Acc_0, CL, CS)의 닫힌식으로 재계산한다.
 * 닫힌식이 원문 이론 곡선과 눈에 띄게 어긋나는 케이스만
 * theoryPercentByRoundOverride로 그림 눈읽기 값을 둔다.
 */

export type FigureProvenance = "figure-digitized" | "paper-explicit" | "derived";

export const REPLAY_ROUND_COUNT = 5;

export const FIXTURE_APPROXIMATION_NOTE =
  "실측 곡선과 Upp는 논문 그림에서 눈으로 읽은 근사값이며, 이론 곡선은 " +
  "역산한 CL·CS로 닫힌식을 재계산한 것이다. α는 원문 명시값이 있는 경우에만 " +
  "paper-explicit으로 표시한다.";

export type ReplayGroupId =
  | "llama3-datasets"
  | "glm4-datasets"
  | "boolq-models"
  | "corollary"
  | "failure";

export type DatasetCase = {
  id: string;
  group: ReplayGroupId;
  model: string;
  dataset: string;
  sourceFigure: string;
  /** 실측 평균 정확도 r0..r5 (%). */
  empiricalPercentByRound: number[];
  /** 분산 밴드 반폭 근사 (%p). */
  bandHalfWidthPercent: number;
  uppPercent: number;
  alpha: number;
  alphaProvenance: FigureProvenance;
  theoryPercentByRoundOverride?: number[];
  verdict: string;
  note?: string;
};

export type FanTrajectory = {
  label: string;
  empiricalPercentByRound: number[];
};

export type FanCase = {
  id: string;
  dataset: string;
  sourceFigure: string;
  uppPercent: number;
  alpha: number;
  alphaProvenance: FigureProvenance;
  trajectories: FanTrajectory[];
  note: string;
};

export type AlphaComparisonCase = {
  id: string;
  dataset: string;
  sourceFigure: string;
  /** 더 작은 α — 빨리 수렴하는 쪽. Llama3-8B-Instruct. */
  fasterCaseId: string;
  slower: {
    model: string;
    alpha: number;
    alphaProvenance: FigureProvenance;
    empiricalPercentByRound: number[];
    bandHalfWidthPercent: number;
    uppPercent: number;
  };
};

/** Figure 1 — Llama3-8B-Instruct × 8 datasets. */
export const LLAMA3_DATASET_CASES: DatasetCase[] = [
  {
    id: "gsm8k-llama3",
    group: "llama3-datasets",
    model: "Llama3-8B-Instruct",
    dataset: "GSM8k",
    sourceFigure: "Figure 1",
    empiricalPercentByRound: [70.5, 76.3, 77.2, 77.6, 78.0, 78.4],
    bandHalfWidthPercent: 0.8,
    uppPercent: 79.3,
    alpha: 0.596,
    alphaProvenance: "paper-explicit",
    verdict: "상승·포화를 이론이 적중",
  },
  {
    id: "humaneval-llama3",
    group: "llama3-datasets",
    model: "Llama3-8B-Instruct",
    dataset: "HumanEval",
    sourceFigure: "Figure 1",
    empiricalPercentByRound: [48.0, 51.0, 51.5, 52.0, 52.3, 52.5],
    bandHalfWidthPercent: 2.0,
    uppPercent: 54.5,
    alpha: 0.56,
    alphaProvenance: "paper-explicit",
    verdict: "상승·포화를 이론이 적중",
  },
  {
    id: "ifeval-llama3",
    group: "llama3-datasets",
    model: "Llama3-8B-Instruct",
    dataset: "IFEval",
    sourceFigure: "Figure 1",
    empiricalPercentByRound: [66.0, 70.5, 71.5, 72.3, 72.0, 72.5],
    bandHalfWidthPercent: 1.5,
    uppPercent: 75.5,
    alpha: 0.751,
    alphaProvenance: "paper-explicit",
    verdict: "상승·포화를 이론이 적중",
  },
  {
    id: "boolq-llama3",
    group: "llama3-datasets",
    model: "Llama3-8B-Instruct",
    dataset: "BoolQ",
    sourceFigure: "Figure 1",
    empiricalPercentByRound: [61.5, 64.5, 65.0, 65.2, 65.3, 65.4],
    bandHalfWidthPercent: 0.8,
    uppPercent: 65.3,
    alpha: 0.707,
    alphaProvenance: "paper-explicit",
    verdict: "Upp 바로 아래에서 포화",
  },
  {
    id: "mmlu-llama3",
    group: "llama3-datasets",
    model: "Llama3-8B-Instruct",
    dataset: "MMLU",
    sourceFigure: "Figure 1",
    empiricalPercentByRound: [62.2, 64.2, 64.3, 64.4, 64.4, 64.5],
    bandHalfWidthPercent: 0.4,
    uppPercent: 64.8,
    alpha: 0.77,
    alphaProvenance: "derived",
    verdict: "실측은 1라운드에 근접, 이론은 완만히 접근",
  },
  {
    id: "commonsenseqa-llama3",
    group: "llama3-datasets",
    model: "Llama3-8B-Instruct",
    dataset: "CommonsenseQA",
    sourceFigure: "Figure 1",
    empiricalPercentByRound: [74.5, 76.8, 77.0, 77.1, 77.1, 77.2],
    bandHalfWidthPercent: 0.5,
    uppPercent: 77.4,
    alpha: 0.8,
    alphaProvenance: "derived",
    verdict: "실측은 1라운드에 근접, 이론은 완만히 접근",
  },
  {
    id: "piqa-llama3",
    group: "llama3-datasets",
    model: "Llama3-8B-Instruct",
    dataset: "PiQA",
    sourceFigure: "Figure 1",
    empiricalPercentByRound: [81.5, 83.8, 84.2, 84.5, 84.6, 84.7],
    bandHalfWidthPercent: 0.5,
    uppPercent: 85.2,
    alpha: 0.693,
    alphaProvenance: "paper-explicit",
    verdict: "상승·포화를 이론이 적중",
  },
  {
    id: "hotpotqa-llama3",
    group: "llama3-datasets",
    model: "Llama3-8B-Instruct",
    dataset: "HotpotQA",
    sourceFigure: "Figure 1",
    empiricalPercentByRound: [32.5, 40.0, 42.5, 44.0, 43.5, 44.0],
    bandHalfWidthPercent: 5.0,
    uppPercent: 47.5,
    alpha: 0.778,
    alphaProvenance: "paper-explicit",
    verdict: "형태는 일치하되 분산 밴드가 넓다",
  },
];

/** Figure 7 — GLM4-9B-Chat × 8 datasets. */
export const GLM4_DATASET_CASES: DatasetCase[] = [
  {
    id: "gsm8k-glm4",
    group: "glm4-datasets",
    model: "GLM4-9B-Chat",
    dataset: "GSM8k",
    sourceFigure: "Figure 7",
    empiricalPercentByRound: [72.0, 80.0, 85.0, 88.0, 86.0, 84.0],
    bandHalfWidthPercent: 3.0,
    uppPercent: 91.5,
    alpha: 0.6,
    alphaProvenance: "derived",
    verdict: "상승 후 요동 — 밴드가 넓다",
    note: "축 간격이 넓어 근사 오차가 크다",
  },
  {
    id: "humaneval-glm4",
    group: "glm4-datasets",
    model: "GLM4-9B-Chat",
    dataset: "HumanEval",
    sourceFigure: "Figure 7",
    empiricalPercentByRound: [30.0, 31.5, 32.0, 31.5, 32.0, 32.5],
    bandHalfWidthPercent: 1.0,
    uppPercent: 32.8,
    alpha: 0.75,
    alphaProvenance: "derived",
    verdict: "완만한 상승·요동",
  },
  {
    id: "ifeval-glm4",
    group: "glm4-datasets",
    model: "GLM4-9B-Chat",
    dataset: "IFEval",
    sourceFigure: "Figure 7",
    empiricalPercentByRound: [64.5, 64.0, 63.7, 63.3, 63.4, 63.2],
    bandHalfWidthPercent: 1.8,
    uppPercent: 63.0,
    alpha: 0.8,
    alphaProvenance: "derived",
    verdict: "자연 하락 — Upp가 시작점 아래",
  },
  {
    id: "boolq-glm4",
    group: "glm4-datasets",
    model: "GLM4-9B-Chat",
    dataset: "BoolQ",
    sourceFigure: "Figure 7·8",
    empiricalPercentByRound: [61.0, 64.5, 64.8, 64.9, 65.0, 64.9],
    bandHalfWidthPercent: 0.6,
    uppPercent: 65.0,
    alpha: 0.55,
    alphaProvenance: "derived",
    verdict: "상승·포화를 이론이 적중",
  },
  {
    id: "mmlu-glm4",
    group: "glm4-datasets",
    model: "GLM4-9B-Chat",
    dataset: "MMLU",
    sourceFigure: "Figure 7",
    empiricalPercentByRound: [63.4, 64.5, 64.6, 64.7, 64.7, 64.7],
    bandHalfWidthPercent: 0.3,
    uppPercent: 64.9,
    alpha: 0.7,
    alphaProvenance: "derived",
    verdict: "상승·포화를 이론이 적중",
  },
  {
    id: "commonsenseqa-glm4",
    group: "glm4-datasets",
    model: "GLM4-9B-Chat",
    dataset: "CommonsenseQA",
    sourceFigure: "Figure 7",
    empiricalPercentByRound: [77.9, 78.7, 78.8, 78.9, 78.9, 78.9],
    bandHalfWidthPercent: 0.3,
    uppPercent: 79.0,
    alpha: 0.65,
    alphaProvenance: "derived",
    verdict: "상승·포화를 이론이 적중",
  },
  {
    id: "piqa-glm4",
    group: "glm4-datasets",
    model: "GLM4-9B-Chat",
    dataset: "PiQA",
    sourceFigure: "Figure 7",
    empiricalPercentByRound: [80.7, 82.5, 83.0, 83.2, 83.3, 83.4],
    bandHalfWidthPercent: 0.4,
    uppPercent: 83.5,
    alpha: 0.65,
    alphaProvenance: "derived",
    verdict: "상승·포화를 이론이 적중",
  },
  {
    id: "hotpotqa-glm4",
    group: "glm4-datasets",
    model: "GLM4-9B-Chat",
    dataset: "HotpotQA",
    sourceFigure: "Figure 7",
    empiricalPercentByRound: [54.0, 60.0, 60.5, 61.0, 61.0, 61.0],
    bandHalfWidthPercent: 1.5,
    uppPercent: 61.5,
    alpha: 0.45,
    alphaProvenance: "derived",
    verdict: "상승·포화를 이론이 적중",
  },
];

/** Figure 8 — 8개 모델 × BoolQ. Llama3·GLM4 항목은 dataset group의 케이스를 재사용한다. */
export const BOOLQ_MODEL_CASES: DatasetCase[] = [
  {
    id: "boolq-deepseek",
    group: "boolq-models",
    model: "DeepSeek-LLM-7B-Chat",
    dataset: "BoolQ",
    sourceFigure: "Figure 8",
    empiricalPercentByRound: [57.8, 57.5, 57.2, 57.0, 56.8, 56.6],
    bandHalfWidthPercent: 0.8,
    uppPercent: 55.3,
    alpha: 0.9,
    alphaProvenance: "derived",
    verdict: "자연 하락 — Upp가 시작점 아래",
  },
  {
    id: "boolq-mistral",
    group: "boolq-models",
    model: "Mistral-7B-Instruct-v3",
    dataset: "BoolQ",
    sourceFigure: "Figure 8",
    empiricalPercentByRound: [61.2, 62.3, 62.8, 63.2, 63.6, 64.0],
    bandHalfWidthPercent: 0.5,
    uppPercent: 65.5,
    alpha: 0.85,
    alphaProvenance: "derived",
    verdict: "느린 상승 — 5라운드로는 Upp 미달",
  },
  {
    id: "boolq-qwen25",
    group: "boolq-models",
    model: "Qwen2.5-7B-Chat",
    dataset: "BoolQ",
    sourceFigure: "Figure 4·8",
    empiricalPercentByRound: [58.8, 61.0, 61.2, 61.3, 61.4, 61.4],
    bandHalfWidthPercent: 0.5,
    uppPercent: 62.0,
    alpha: 0.914,
    alphaProvenance: "paper-explicit",
    verdict: "느린 상승 — 큰 α",
  },
  {
    id: "boolq-qwenmax",
    group: "boolq-models",
    model: "Qwen-Max",
    dataset: "BoolQ",
    sourceFigure: "Figure 8",
    empiricalPercentByRound: [71.0, 74.0, 76.5, 78.5, 79.5, 80.3],
    bandHalfWidthPercent: 0.8,
    uppPercent: 93.5,
    alpha: 0.87,
    alphaProvenance: "derived",
    verdict: "느린 상승 — 5라운드로는 Upp에 근접하지 못함",
  },
  {
    id: "boolq-gpt35",
    group: "boolq-models",
    model: "GPT-3.5 Turbo",
    dataset: "BoolQ",
    sourceFigure: "Figure 8",
    empiricalPercentByRound: [68.4, 70.2, 70.4, 70.5, 70.5, 70.5],
    bandHalfWidthPercent: 0.4,
    uppPercent: 70.7,
    alpha: 0.45,
    alphaProvenance: "derived",
    verdict: "빠른 포화를 이론이 적중",
  },
  {
    id: "boolq-gpt4",
    group: "boolq-models",
    model: "GPT-4 Turbo",
    dataset: "BoolQ",
    sourceFigure: "Figure 8",
    empiricalPercentByRound: [80.8, 78.5, 77.8, 77.4, 77.2, 77.1],
    bandHalfWidthPercent: 0.5,
    uppPercent: 77.0,
    alpha: 0.6,
    alphaProvenance: "derived",
    verdict: "자연 하락까지 이론이 예측 — Upp가 시작점 아래",
  },
];

/** Figure 3 — 초기 정확도를 인위 조작해도 같은 값으로 수렴 (Corollary 1). */
export const FAN_CASES: FanCase[] = [
  {
    id: "fan-gsm8k",
    dataset: "GSM8k",
    sourceFigure: "Figure 3",
    uppPercent: 77.5,
    alpha: 0.55,
    alphaProvenance: "derived",
    trajectories: [
      { label: "Acc_0 0%", empiricalPercentByRound: [0, 45, 65, 72, 75, 76.5] },
      { label: "Acc_0 20%", empiricalPercentByRound: [20, 55, 70, 74, 76, 77] },
      { label: "Acc_0 40%", empiricalPercentByRound: [40, 63, 72, 75, 76.5, 77] },
      { label: "Acc_0 60%", empiricalPercentByRound: [60, 70, 74, 76, 77, 77.2] },
      { label: "Acc_0 80%", empiricalPercentByRound: [80, 78.5, 78, 77.7, 77.5, 77.4] },
      { label: "Acc_0 100%", empiricalPercentByRound: [100, 90, 83, 80, 78.5, 78] },
    ],
    note: "초기 정답을 인위 배정한 실험 — 80%·100% 시작은 위에서 내려와 수렴한다",
  },
  {
    id: "fan-boolq",
    dataset: "BoolQ",
    sourceFigure: "Figure 3",
    uppPercent: 65.2,
    alpha: 0.55,
    alphaProvenance: "derived",
    trajectories: [
      { label: "Acc_0 0%", empiricalPercentByRound: [0, 50, 60, 63, 64, 64.8] },
      { label: "Acc_0 20%", empiricalPercentByRound: [20, 55, 62, 64, 64.5, 65] },
      { label: "Acc_0 40%", empiricalPercentByRound: [40, 60, 63.5, 64.5, 65, 65] },
      { label: "Acc_0 60%", empiricalPercentByRound: [60, 64, 64.8, 65, 65, 65] },
      { label: "Acc_0 80%", empiricalPercentByRound: [80, 70, 67, 66, 65.5, 65.2] },
      { label: "Acc_0 100%", empiricalPercentByRound: [100, 80, 71, 68, 66.5, 65.8] },
    ],
    note: "초기 정답을 인위 배정한 실험",
  },
  {
    id: "fan-piqa",
    dataset: "PiQA",
    sourceFigure: "Figure 3",
    uppPercent: 84.6,
    alpha: 0.55,
    alphaProvenance: "derived",
    trajectories: [
      { label: "Acc_0 0%", empiricalPercentByRound: [0, 60, 75, 80, 82.5, 83.5] },
      { label: "Acc_0 20%", empiricalPercentByRound: [20, 65, 78, 81.5, 83, 84] },
      { label: "Acc_0 40%", empiricalPercentByRound: [40, 72, 80, 82.5, 83.5, 84] },
      { label: "Acc_0 60%", empiricalPercentByRound: [60, 78, 82, 83.5, 84, 84.3] },
      { label: "Acc_0 80%", empiricalPercentByRound: [80, 83, 84, 84.3, 84.4, 84.5] },
      { label: "Acc_0 100%", empiricalPercentByRound: [100, 92, 88, 86, 85.3, 85] },
    ],
    note: "초기 정답을 인위 배정한 실험",
  },
];

/** Figure 4·9 — α가 다른 두 모델의 수렴 속도 비교 (Corollary 2). */
export const ALPHA_COMPARISON_CASES: AlphaComparisonCase[] = [
  {
    id: "alpha-gsm8k",
    dataset: "GSM8k",
    sourceFigure: "Figure 4",
    fasterCaseId: "gsm8k-llama3",
    slower: {
      model: "Qwen2.5-7B-Chat",
      alpha: 0.955,
      alphaProvenance: "paper-explicit",
      empiricalPercentByRound: [91.6, 92.2, 92.5, 92.6, 92.7, 92.8],
      bandHalfWidthPercent: 0.4,
      uppPercent: 95.3,
    },
  },
  {
    id: "alpha-boolq",
    dataset: "BoolQ",
    sourceFigure: "Figure 4",
    fasterCaseId: "boolq-llama3",
    slower: {
      model: "Qwen2.5-7B-Chat",
      alpha: 0.914,
      alphaProvenance: "paper-explicit",
      empiricalPercentByRound: [58.8, 61.0, 61.2, 61.3, 61.4, 61.4],
      bandHalfWidthPercent: 0.5,
      uppPercent: 62.0,
    },
  },
  {
    id: "alpha-piqa",
    dataset: "PiQA",
    sourceFigure: "Figure 4",
    fasterCaseId: "piqa-llama3",
    slower: {
      model: "Qwen2.5-7B-Chat",
      alpha: 0.83,
      alphaProvenance: "paper-explicit",
      empiricalPercentByRound: [87.3, 88.3, 88.7, 88.9, 89.0, 89.1],
      bandHalfWidthPercent: 0.4,
      uppPercent: 90.5,
    },
  },
  {
    id: "alpha-humaneval",
    dataset: "HumanEval",
    sourceFigure: "Figure 9",
    fasterCaseId: "humaneval-llama3",
    slower: {
      model: "Qwen2.5-7B-Chat",
      alpha: 0.872,
      alphaProvenance: "paper-explicit",
      empiricalPercentByRound: [76.5, 77.2, 77.5, 77.7, 77.8, 77.9],
      bandHalfWidthPercent: 0.8,
      uppPercent: 79.5,
    },
  },
  {
    id: "alpha-ifeval",
    dataset: "IFEval",
    sourceFigure: "Figure 9",
    fasterCaseId: "ifeval-llama3",
    slower: {
      model: "Qwen2.5-7B-Chat",
      alpha: 0.88,
      alphaProvenance: "paper-explicit",
      empiricalPercentByRound: [72.5, 75.0, 76.0, 76.5, 76.8, 77.0],
      bandHalfWidthPercent: 1.0,
      uppPercent: 81.5,
    },
  },
  {
    id: "alpha-hotpotqa",
    dataset: "HotpotQA",
    sourceFigure: "Figure 9",
    fasterCaseId: "hotpotqa-llama3",
    slower: {
      model: "Qwen2.5-7B-Chat",
      alpha: 0.969,
      alphaProvenance: "paper-explicit",
      empiricalPercentByRound: [58.0, 59.5, 60.0, 60.2, 60.3, 60.4],
      bandHalfWidthPercent: 1.5,
      uppPercent: 66.0,
    },
  },
];

/**
 * Figure 5·10 — oracle verifier로 CL=1을 만든 특수 사례 (Corollary 3).
 * cl = α + cs = 1이 되도록 upp 100%, α = 1 − CS로 저장한다.
 */
export const ORACLE_CASES: DatasetCase[] = [
  {
    id: "oracle-gsm8k",
    group: "corollary",
    model: "Llama3-8B-Instruct",
    dataset: "GSM8k",
    sourceFigure: "Figure 5",
    empiricalPercentByRound: [70.5, 85.0, 90.0, 92.5, 94.0, 95.3],
    bandHalfWidthPercent: 1.0,
    uppPercent: 100,
    alpha: 0.68,
    alphaProvenance: "derived",
    verdict: "CL=1이면 Upp 자체가 100%로 재배선",
  },
  {
    id: "oracle-boolq",
    group: "corollary",
    model: "Llama3-8B-Instruct",
    dataset: "BoolQ",
    sourceFigure: "Figure 5",
    empiricalPercentByRound: [61.5, 71.0, 76.0, 79.0, 81.0, 82.5],
    bandHalfWidthPercent: 1.2,
    uppPercent: 100,
    alpha: 0.809,
    alphaProvenance: "derived",
    verdict: "CL<1의 Upp 65%를 크게 돌파",
  },
  {
    id: "oracle-piqa",
    group: "corollary",
    model: "Llama3-8B-Instruct",
    dataset: "PiQA",
    sourceFigure: "Figure 5",
    empiricalPercentByRound: [81.5, 85.5, 86.8, 87.7, 88.3, 88.7],
    bandHalfWidthPercent: 0.8,
    uppPercent: 100,
    alpha: 0.738,
    alphaProvenance: "derived",
    theoryPercentByRoundOverride: [81.5, 84.0, 85.5, 86.7, 87.6, 88.4],
    verdict: "CL<1의 Upp 85%를 돌파",
    note: "닫힌식이 원문 이론 곡선보다 가파르게 나와 그림 눈읽기로 대체",
  },
  {
    id: "oracle-humaneval",
    group: "corollary",
    model: "Llama3-8B-Instruct",
    dataset: "HumanEval",
    sourceFigure: "Figure 10",
    empiricalPercentByRound: [48.0, 60.0, 68.0, 73.0, 76.5, 78.5],
    bandHalfWidthPercent: 2.0,
    uppPercent: 100,
    alpha: 0.76,
    alphaProvenance: "derived",
    verdict: "CL<1의 Upp 54.5%를 크게 돌파",
  },
  {
    id: "oracle-ifeval",
    group: "corollary",
    model: "Llama3-8B-Instruct",
    dataset: "IFEval",
    sourceFigure: "Figure 10",
    empiricalPercentByRound: [66.0, 74.0, 79.0, 82.5, 85.0, 86.5],
    bandHalfWidthPercent: 1.5,
    uppPercent: 100,
    alpha: 0.812,
    alphaProvenance: "derived",
    verdict: "CL<1의 Upp 75.5%를 돌파",
  },
  {
    id: "oracle-hotpotqa",
    group: "corollary",
    model: "Llama3-8B-Instruct",
    dataset: "HotpotQA",
    sourceFigure: "Figure 10",
    empiricalPercentByRound: [33.0, 47.0, 55.0, 60.0, 63.5, 66.0],
    bandHalfWidthPercent: 3.0,
    uppPercent: 100,
    alpha: 0.895,
    alphaProvenance: "derived",
    verdict: "CL<1의 Upp 47.5%를 크게 돌파",
  },
  {
    id: "oracle-mmlu",
    group: "corollary",
    model: "Llama3-8B-Instruct",
    dataset: "MMLU",
    sourceFigure: "Figure 10",
    empiricalPercentByRound: [62.5, 66.5, 68.5, 70.0, 71.0, 71.8],
    bandHalfWidthPercent: 0.8,
    uppPercent: 100,
    alpha: 0.851,
    alphaProvenance: "derived",
    verdict: "CL<1의 Upp 64.8%를 돌파",
  },
  {
    id: "oracle-commonsenseqa",
    group: "corollary",
    model: "Llama3-8B-Instruct",
    dataset: "CommonsenseQA",
    sourceFigure: "Figure 10",
    empiricalPercentByRound: [75.0, 78.5, 80.5, 82.0, 83.0, 84.0],
    bandHalfWidthPercent: 0.8,
    uppPercent: 100,
    alpha: 0.845,
    alphaProvenance: "derived",
    verdict: "CL<1의 Upp 77.4%를 돌파",
  },
];

/** Figure 6 — "Are you sure?" 프롬프트가 CL과 Upp를 낮춰 실측 하락. */
export const ARE_YOU_SURE_CASE: DatasetCase = {
  id: "are-you-sure-gsm8k",
  group: "failure",
  model: "Llama3-8B-Instruct",
  dataset: "GSM8k",
  sourceFigure: "Figure 6",
  empiricalPercentByRound: [71.5, 64.0, 61.0, 60.3, 59.8, 60.2],
  bandHalfWidthPercent: 1.5,
  uppPercent: 60.2,
  alpha: 0.34,
  alphaProvenance: "derived",
  verdict: "유도된 하락까지 이론이 예측",
  note: "같은 모델·과제에서 프롬프트만 'Are you sure?'로 교체",
};

export const ALL_DATASET_CASES: DatasetCase[] = [
  ...LLAMA3_DATASET_CASES,
  ...GLM4_DATASET_CASES,
  ...BOOLQ_MODEL_CASES,
  ...ORACLE_CASES,
  ARE_YOU_SURE_CASE,
];

function assertUnitInterval(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite value in [0, 1].`);
  }
}

/** CS = Upp × (1 − α). CL=1 케이스는 upp 100%이므로 CS = 1 − α가 된다. */
export function critiqueScoreFromUppAlpha(uppPercent: number, alpha: number) {
  assertUnitInterval(uppPercent / 100, "Upp");
  assertUnitInterval(alpha, "α");
  return (uppPercent / 100) * (1 - alpha);
}

/** CL = α + CS. */
export function confidenceLevelFromUppAlpha(uppPercent: number, alpha: number) {
  return alpha + critiqueScoreFromUppAlpha(uppPercent, alpha);
}

/** 케이스의 이론 곡선(%): digitize 오버라이드가 없으면 닫힌식으로 재계산. */
export function caseTheoryPercentByRound(caseData: DatasetCase): number[] {
  if (caseData.theoryPercentByRoundOverride) {
    return caseData.theoryPercentByRoundOverride;
  }
  const confidenceLevel = confidenceLevelFromUppAlpha(
    caseData.uppPercent,
    caseData.alpha,
  );
  const critiqueScore = critiqueScoreFromUppAlpha(
    caseData.uppPercent,
    caseData.alpha,
  );
  return stationaryTrajectory(
    caseData.empiricalPercentByRound[0] / 100,
    confidenceLevel,
    critiqueScore,
    REPLAY_ROUND_COUNT,
  ).map((point) => point.accuracy * 100);
}

export type GridPoint = {
  caseId: string;
  dataset: string;
  confidenceLevel: number;
  critiqueScore: number;
  uppPercent: number;
};

/** Scene 3 수렴 지도에 올릴 Llama3-8B 실측 8점 (역산 CL·CS). */
export function llama3GridPoints(): GridPoint[] {
  return LLAMA3_DATASET_CASES.map((caseData) => ({
    caseId: caseData.id,
    dataset: caseData.dataset,
    confidenceLevel: confidenceLevelFromUppAlpha(
      caseData.uppPercent,
      caseData.alpha,
    ),
    critiqueScore: critiqueScoreFromUppAlpha(caseData.uppPercent, caseData.alpha),
    uppPercent: caseData.uppPercent,
  }));
}

/**
 * (CL, CS) 단위 정사각형에서 Upp > Acc_0인 개선 영역의 넓이.
 * 경계선 CS = k(1−CL), k = Acc_0/(1−Acc_0)에 대해
 * k ≤ 1이면 1 − k/2, k > 1이면 1/(2k). Acc_0=0.5 → 0.5, Acc_0=0.99 → ≈0.005.
 */
export function improvementAreaFraction(initialAccuracy: number) {
  assertUnitInterval(initialAccuracy, "Acc_0");
  if (initialAccuracy === 1) return 0;
  const slope = initialAccuracy / (1 - initialAccuracy);
  return slope <= 1 ? 1 - slope / 2 : 1 / (2 * slope);
}

/** 목적지 등고선: Upp = c인 직선 위에서 CL에 대응하는 CS. 정의역 밖이면 null. */
export function contourCritiqueScore(uppTarget: number, confidenceLevel: number) {
  assertUnitInterval(uppTarget, "Upp");
  assertUnitInterval(confidenceLevel, "CL");
  if (uppTarget === 1) return null;
  const critiqueScore =
    (uppTarget / (1 - uppTarget)) * (1 - confidenceLevel);
  return critiqueScore > 1 ? null : critiqueScore;
}

/** fixture 자체 정합성: 역산 CL·CS가 저장된 Upp를 재현하는지 확인. */
export function fixtureSelfCheck(): string[] {
  const problems: string[] = [];
  for (const caseData of ALL_DATASET_CASES) {
    const confidenceLevel = confidenceLevelFromUppAlpha(
      caseData.uppPercent,
      caseData.alpha,
    );
    const critiqueScore = critiqueScoreFromUppAlpha(
      caseData.uppPercent,
      caseData.alpha,
    );
    if (confidenceLevel < 0 || confidenceLevel > 1) {
      problems.push(`${caseData.id}: CL ${confidenceLevel.toFixed(4)} out of range`);
      continue;
    }
    const upp = stationaryUpperBound(confidenceLevel, critiqueScore);
    if (upp === null) {
      problems.push(`${caseData.id}: degenerate CL=1, CS=0`);
      continue;
    }
    if (Math.abs(upp * 100 - caseData.uppPercent) > 0.05) {
      problems.push(
        `${caseData.id}: Upp mismatch ${(upp * 100).toFixed(2)} vs ${caseData.uppPercent}`,
      );
    }
    if (
      caseData.empiricalPercentByRound.length !== REPLAY_ROUND_COUNT + 1 ||
      (caseData.theoryPercentByRoundOverride &&
        caseData.theoryPercentByRoundOverride.length !== REPLAY_ROUND_COUNT + 1)
    ) {
      problems.push(`${caseData.id}: round count is not ${REPLAY_ROUND_COUNT + 1}`);
    }
  }
  return problems;
}
