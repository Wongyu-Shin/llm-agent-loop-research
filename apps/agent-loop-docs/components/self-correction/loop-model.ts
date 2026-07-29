export type CriterionMode = "binary" | "scalar";

export type TheoryTransferRow = {
  id:
    | "artifact"
    | "judgment"
    | "transition"
    | "comparison"
    | "history"
    | "stationarity";
  paper: string;
  transferCondition: string;
  engineering: string;
  scalarAlternative?: string;
};

export const THEORY_TRANSFER_ROWS: TheoryTransferRow[] = [
  {
    id: "artifact",
    paper: "같은 응답의 aᵢ,ₜ → aᵢ,ₜ₊₁",
    transferCondition: "변경 범위와 baseline을 고정",
    engineering: "Incumbent와 격리된 Challenger를 비교",
  },
  {
    id: "judgment",
    paper: "외부 정답 판정",
    transferCondition: "제안과 평가를 분리",
    engineering: "Frozen harness, metric, guards, gold check",
  },
  {
    id: "transition",
    paper: "CLₜ / CSₜ 전이 회계",
    transferCondition: "사례별 pass/fail criterion 필요",
    engineering: "Candidate와 system-after-gate 전이를 따로 측정",
    scalarAlternative: "Metric delta, uncertainty, guards, holdout을 직접 비교",
  },
  {
    id: "comparison",
    paper: "같은 답의 반복 수정",
    transferCondition: "한 번에 하나의 bounded diff",
    engineering: "같은 harness에서 Challenger와 Incumbent를 재실행",
  },
  {
    id: "history",
    paper: "라운드별 관찰 결과",
    transferCondition: "실패도 관찰 가능해야 함",
    engineering: "Append-only Experiment ledger",
  },
  {
    id: "stationarity",
    paper: "고정 CL / CS와 수렴점 Upp",
    transferCondition: "Adaptive proposal에서는 정지 가정이 깨짐",
    engineering: "Upp를 campaign utility나 stop target으로 사용하지 않음",
  },
];

export type AutoresearchOutcome = "KEEP" | "DISCARD" | "CRASH";

export type ExperimentRecord = {
  iteration: number;
  revision: string;
  metricName: "val_bpb";
  metric: number | null;
  rawMetric: number;
  peakMemoryGigabytes: number | null;
  rawPeakMemoryGigabytes: number;
  outcome: AutoresearchOutcome;
  description: string;
  incumbentAfter: string;
  observationValid: boolean;
};

export const OFFICIAL_RESEARCH_CONTRACT = {
  goal: "고정된 실행 시간 안에서 val_bpb 낮추기",
  mutableArtifact: "train.py",
  frozenHarness: "prepare.py · data · runtime utility · evaluator",
  trialBudget: "training wall clock 5분",
  metric: "val_bpb · lower is better",
  guard: "peak GPU memory와 complexity",
  ledger: "results.tsv",
  defaultCampaignStop: "사람이 중단할 때까지 계속 실행",
} as const;

export const OFFICIAL_AUTORESEARCH_FIXTURE: ExperimentRecord[] = [
  {
    iteration: 0,
    revision: "a1b2c3d",
    metricName: "val_bpb",
    metric: 0.9979,
    rawMetric: 0.9979,
    peakMemoryGigabytes: 44,
    rawPeakMemoryGigabytes: 44,
    outcome: "KEEP",
    description: "baseline",
    incumbentAfter: "a1b2c3d",
    observationValid: true,
  },
  {
    iteration: 1,
    revision: "b2c3d4e",
    metricName: "val_bpb",
    metric: 0.9932,
    rawMetric: 0.9932,
    peakMemoryGigabytes: 44.2,
    rawPeakMemoryGigabytes: 44.2,
    outcome: "KEEP",
    description: "increase learning rate to 0.04",
    incumbentAfter: "b2c3d4e",
    observationValid: true,
  },
  {
    iteration: 2,
    revision: "c3d4e5f",
    metricName: "val_bpb",
    metric: 1.005,
    rawMetric: 1.005,
    peakMemoryGigabytes: 44,
    rawPeakMemoryGigabytes: 44,
    outcome: "DISCARD",
    description: "switch to Gaussian Error Linear Unit activation",
    incumbentAfter: "b2c3d4e",
    observationValid: true,
  },
  {
    iteration: 3,
    revision: "d4e5f6g",
    metricName: "val_bpb",
    metric: null,
    rawMetric: 0,
    peakMemoryGigabytes: null,
    rawPeakMemoryGigabytes: 0,
    outcome: "CRASH",
    description: "double model width, out of memory",
    incumbentAfter: "b2c3d4e",
    observationValid: false,
  },
];

export function formatMetric(record: ExperimentRecord) {
  return record.metric === null ? "측정 없음" : record.metric.toFixed(6);
}

export function formatPeakMemory(record: ExperimentRecord) {
  return record.peakMemoryGigabytes === null
    ? "측정 없음"
    : `${record.peakMemoryGigabytes.toFixed(1)} GB`;
}

export function outcomeLabel(outcome: AutoresearchOutcome) {
  if (outcome === "KEEP") return "KEEP · Incumbent 전진";
  if (outcome === "DISCARD") return "DISCARD · Incumbent 유지";
  return "CRASH · 유효한 측정 없음";
}

export type LoopPhase = {
  id:
    | "contract"
    | "incumbent"
    | "proposal"
    | "challenger"
    | "execution"
    | "verdict"
    | "ledger";
  shortLabel: string;
  title: string;
  owner: string;
  changed: string;
  persisted: string;
};

export const LOOP_PHASES: LoopPhase[] = [
  {
    id: "contract",
    shortLabel: "계약",
    title: "Research contract",
    owner: "Human owner + controller",
    changed: "변경 없음",
    persisted: "목표, mutable scope, frozen harness, metric, budget",
  },
  {
    id: "incumbent",
    shortLabel: "기준",
    title: "Current Incumbent",
    owner: "Controller",
    changed: "Gate 이전에는 변경 없음",
    persisted: "Accepted revision와 baseline evaluation",
  },
  {
    id: "proposal",
    shortLabel: "가설",
    title: "Hypothesis + bounded diff",
    owner: "Proposer",
    changed: "하나의 testable change",
    persisted: "Hypothesis와 changed scope",
  },
  {
    id: "challenger",
    shortLabel: "후보",
    title: "Isolated Challenger",
    owner: "Executor",
    changed: "격리된 artifact만 변경",
    persisted: "Revision과 diff",
  },
  {
    id: "execution",
    shortLabel: "검증",
    title: "Raw observation + metric + guards",
    owner: "Frozen harness + evaluator",
    changed: "실행 관찰 생성",
    persisted: "Raw log, metric, memory, exit status",
  },
  {
    id: "verdict",
    shortLabel: "판정",
    title: "KEEP / DISCARD / CRASH",
    owner: "Controller",
    changed: "KEEP일 때만 Incumbent 교체",
    persisted: "Verdict와 reason",
  },
  {
    id: "ledger",
    shortLabel: "기억",
    title: "Experiment ledger + Derived memory",
    owner: "Controller",
    changed: "모든 시도 append, memory 재계산",
    persisted: "성공과 실패의 전체 이력",
  },
];

export type DiagnosticCase = {
  id:
    | "repeated"
    | "crash"
    | "observation"
    | "alignment"
    | "selection"
    | "integrity";
  shortLabel: string;
  symptom: string;
  boundary: string;
  evidence: string[];
};

export const DIAGNOSTIC_CASES: DiagnosticCase[] = [
  {
    id: "repeated",
    shortLabel: "반복",
    symptom: "비슷한 Challenger가 반복됨",
    boundary: "Proposer 또는 Derived memory",
    evidence: ["Hypothesis similarity", "Memory input", "Ledger cursor"],
  },
  {
    id: "crash",
    shortLabel: "Crash",
    symptom: "실행 실패가 집중됨",
    boundary: "Executor 또는 resource",
    evidence: ["Exit code", "Stack trace", "Environment hash"],
  },
  {
    id: "observation",
    shortLabel: "관찰",
    symptom: "Observation이 누락되거나 요동함",
    boundary: "Instrumentation 또는 evaluator",
    evidence: ["Raw log", "Repeated measure", "Data/evaluator version"],
  },
  {
    id: "alignment",
    shortLabel: "정렬",
    symptom: "Proxy가 좋아지지만 gold가 나빠짐",
    boundary: "Metric alignment",
    evidence: ["Proxy/gold pair", "Criterion transitions", "Holdout result"],
  },
  {
    id: "selection",
    shortLabel: "채택",
    symptom: "더 나쁜 Challenger가 채택됨",
    boundary: "Selector",
    evidence: ["Baseline revision", "Threshold", "Verdict reason"],
  },
  {
    id: "integrity",
    shortLabel: "무결성",
    symptom: "Evaluator 변경 뒤 개선으로 보임",
    boundary: "Mutable scope 또는 integrity",
    evidence: ["Contract version", "Harness hash", "Changed scope"],
  },
];

export type StopReason =
  | "SUCCESS_PREDICATE_MET"
  | "SAFETY_VIOLATION"
  | "HARNESS_INVALID"
  | "HUMAN_GATE"
  | "CYCLE_DETECTED"
  | "PLATEAU"
  | "CAMPAIGN_BUDGET_EXHAUSTED"
  | "BLOCKED"
  | "MANUAL_INTERRUPT"
  | null;

export type StopInputs = {
  manualInterrupt: boolean;
  safetyViolation: boolean;
  harnessValid: boolean;
  successPredicateMet: boolean;
  humanGateRequired: boolean;
  cycleDetected: boolean;
  plateauIterations: number;
  campaignBudgetRemainingHours: number;
  testableHypothesisAvailable: boolean;
};

export function determineStopReason(inputs: StopInputs): StopReason {
  if (inputs.manualInterrupt) return "MANUAL_INTERRUPT";
  if (inputs.safetyViolation) return "SAFETY_VIOLATION";
  if (!inputs.harnessValid) return "HARNESS_INVALID";
  if (inputs.humanGateRequired) return "HUMAN_GATE";
  if (inputs.successPredicateMet) return "SUCCESS_PREDICATE_MET";
  if (inputs.cycleDetected) return "CYCLE_DETECTED";
  if (inputs.plateauIterations >= 5) return "PLATEAU";
  if (inputs.campaignBudgetRemainingHours <= 0) {
    return "CAMPAIGN_BUDGET_EXHAUSTED";
  }
  if (!inputs.testableHypothesisAvailable) return "BLOCKED";
  return null;
}

export type LoopPolicySection = {
  id:
    | "goal"
    | "scope"
    | "budget"
    | "evidence"
    | "transition"
    | "memory"
    | "stop"
    | "owners";
  shortLabel: string;
  title: string;
  blankPrompt: string;
  exampleValue: string[];
};

export const LOOP_POLICY_SECTIONS: LoopPolicySection[] = [
  {
    id: "goal",
    shortLabel: "목표",
    title: "Goal + success predicate",
    blankPrompt: "실제 목표와 성공 조건을 적습니다.",
    exampleValue: [
      "checkout 결제 성공률을 안전하게 높입니다",
      "성공 조건은 metric과 guards를 함께 충족",
    ],
  },
  {
    id: "scope",
    shortLabel: "범위",
    title: "Mutable artifact + frozen harness",
    blankPrompt: "바꿀 수 있는 것과 바꾸면 안 되는 것을 분리합니다.",
    exampleValue: [
      "Mutable: checkout/**, tests/checkout/**",
      "Frozen: checkout-evaluator-version-7 + holdout-2026-07",
    ],
  },
  {
    id: "budget",
    shortLabel: "예산",
    title: "Trial budget + campaign budget",
    blankPrompt: "한 시도와 전체 탐색의 시계를 따로 둡니다.",
    exampleValue: ["Trial: candidate당 5분", "Campaign: 6시간", "Cost: 40 USD"],
  },
  {
    id: "evidence",
    shortLabel: "증거",
    title: "Observation + metric + guards",
    blankPrompt: "원시 관찰, 주 metric, 불확실성, guard, holdout을 적습니다.",
    exampleValue: [
      "Primary: checkout_success_rate · higher is better",
      "Guards: tests, latency p95, permission",
    ],
  },
  {
    id: "transition",
    shortLabel: "채택",
    title: "KEEP + DISCARD + CRASH + rollback",
    blankPrompt: "Incumbent를 교체하거나 보존하는 판정 규칙을 적습니다.",
    exampleValue: [
      "KEEP: gain > 0.3%p, guards pass, holdout no regression",
      "Rollback: Incumbent revision과 격리 환경 복원",
    ],
  },
  {
    id: "memory",
    shortLabel: "기억",
    title: "Experiment ledger + Derived memory",
    blankPrompt: "원시 이력과 다음 제안을 위한 압축 기억을 구분합니다.",
    exampleValue: [
      "Ledger: hypothesis, revision, observation, verdict, cost",
      "Memory: 실패 패턴과 다음 testable hypothesis",
    ],
  },
  {
    id: "stop",
    shortLabel: "중단",
    title: "Success + safety + cycle + plateau + budget",
    blankPrompt: "성공, 안전, 반복, 정체, 예산, 사람 승인을 구조화합니다.",
    exampleValue: [
      "Plateau: 5 iterations",
      "Safety와 human gate는 항상 활성",
    ],
  },
  {
    id: "owners",
    shortLabel: "책임",
    title: "Proposer + evaluator + selector + external commit",
    blankPrompt: "제안, 평가, 채택, 외부 변경의 책임을 분리합니다.",
    exampleValue: [
      "Proposer: research agent",
      "External commit: human approval",
    ],
  },
];
