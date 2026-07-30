/**
 * Canonical experiment-loop model for Part II scenes.
 *
 * The record shape, canonical fixture, and pure reducer follow wireframe
 * §9.2 (canonical replay data), §9.5 (stop reasons), §9.6 (telemetry),
 * and §12.4 (loop experiment state). Scenes 6 and 7 must both derive
 * their SVG, ledger table, and live announcements from `reduceExperiment`
 * so verdict → incumbent logic exists in exactly one place.
 */

export type CriterionMode = "binary" | "scalar";

export type ClaimProvenance =
  | "paper-definition"
  | "paper-mathematical-consequence"
  | "paper-observation"
  | "critical-reading"
  | "official-autoresearch-example"
  | "engineering-transfer"
  | "synthetic-example";

export type VerifierMode = "none" | "external" | "gate";

/**
 * Scene 5 — 외부 verifier가 훼손 전이(정답 → 오답)를 차단하는 비율.
 * 논문 측정치가 아니라 엔지니어링 예시값이다. "external"의 80%는
 * 불완전한 자동 판정을, "gate"의 100%는 KEEP 전에는 채택 상태가
 * 후퇴하지 않는 이상적 acceptance gate를 나타낸다.
 */
export const VERIFIER_BLOCK_RATES: Record<VerifierMode, number> = {
  none: 0,
  external: 0.8,
  gate: 1,
};

/** Scene 5 기본 예시값 — Upp = 0.7 / (0.4 + 0.7) ≈ 63.6%. */
export const TANK_DEFAULTS = {
  critiqueScore: 0.7,
  damage: 0.4,
  initialAccuracy: 0.9,
} as const;

export type OfficialExampleFact = {
  id:
    | "goal"
    | "mutable"
    | "frozen"
    | "trial-budget"
    | "metric"
    | "soft-constraint"
    | "baseline"
    | "decision"
    | "ledger"
    | "campaign-stop";
  label: string;
  value: string;
  caveat?: string;
};

/** Wireframe §8.2 — 공식 README와 program.md가 직접 명시한 기본 사례. */
export const OFFICIAL_EXAMPLE_FACTS: OfficialExampleFact[] = [
  {
    id: "goal",
    label: "목표",
    value: "고정된 실행 시간 안에서 validation bits per byte인 val_bpb를 낮춤",
  },
  { id: "mutable", label: "Mutable", value: "agent가 train.py 하나를 수정" },
  {
    id: "frozen",
    label: "Frozen",
    value: "prepare.py의 data, runtime utility, evaluator",
  },
  {
    id: "trial-budget",
    label: "Trial budget",
    value: "startup·compile을 제외한 training wall clock 5분",
  },
  { id: "metric", label: "Metric", value: "val_bpb · lower is better" },
  {
    id: "soft-constraint",
    label: "Soft constraint",
    value: "최대 GPU 메모리(VRAM)와 complexity",
  },
  {
    id: "baseline",
    label: "Baseline",
    value: "첫 run은 수정하지 않은 train.py",
  },
  {
    id: "decision",
    label: "Decision",
    value: "개선하면 keep, 같거나 나쁘면 discard와 revert, 실행 실패는 crash",
  },
  {
    id: "ledger",
    label: "Ledger",
    value: "results.tsv에 commit, metric, memory, status, description",
  },
  {
    id: "campaign-stop",
    label: "Campaign stop",
    value: "기본 지침은 사람이 중단할 때까지 계속 실행",
    caveat:
      "overnight autonomous research 예시의 운영 정책이며 범용 loop의 불변식이 아니다 — Scene 7에서 bounded stopping으로 일반화",
  },
];

export type ExperimentVerdict =
  | "KEEP"
  | "DISCARD"
  | "CRASH"
  | "PENDING"
  | "BLOCKED";

export type ExperimentMetric = {
  name: string;
  value: number | null;
  direction: "higher" | "lower";
  evaluatorVersion: string;
};

export type ExperimentGuard = {
  name: string;
  status: "pass" | "fail" | "unknown";
};

/** Wireframe §12.4 loop experiment state. */
export type ExperimentRecord = {
  campaignId: string;
  iteration: number;
  contractVersion: string;
  incumbentBefore: string | null;
  challenger: string;
  hypothesis: { id: string; statement: string };
  changedScope: string[];
  harnessRevision: string;
  observation: {
    valid: boolean;
    rawRef: string;
    exitStatus: "ok" | "crash" | "timeout";
  };
  metrics: ExperimentMetric[];
  guards: ExperimentGuard[];
  verdict: ExperimentVerdict;
  verdictReason: string;
  incumbentAfter: string;
  stopReason: StopReason;
  /**
   * Original results.tsv row. The official ledger stores crash runs with
   * `0.000000` / `0.0` sentinels; screens must show `측정 없음` instead and
   * surface this raw row only inside the raw drawer (§9.2, S07.07).
   */
  rawLedgerRow: string;
};

const CANONICAL_CAMPAIGN_ID = "official-illustrative-campaign";
const CANONICAL_CONTRACT_VERSION = "official-program-md-v1";
const CANONICAL_HARNESS_REVISION = "prepare-py-frozen-evaluator";

/** Wireframe §9.2 — 공식 program.md의 illustrative results.tsv 재생 fixture. */
export const CANONICAL_AUTORESEARCH_CAMPAIGN: ExperimentRecord[] = [
  {
    campaignId: CANONICAL_CAMPAIGN_ID,
    iteration: 0,
    contractVersion: CANONICAL_CONTRACT_VERSION,
    incumbentBefore: null,
    challenger: "a1b2c3d",
    hypothesis: {
      id: "hypothesis-000",
      statement: "수정하지 않은 train.py로 baseline을 세운다",
    },
    changedScope: [],
    harnessRevision: CANONICAL_HARNESS_REVISION,
    observation: { valid: true, rawRef: "runs/000/raw.log", exitStatus: "ok" },
    metrics: [
      {
        name: "val_bpb",
        value: 0.9979,
        direction: "lower",
        evaluatorVersion: CANONICAL_HARNESS_REVISION,
      },
      {
        name: "peak_memory_gigabytes",
        value: 44.0,
        direction: "lower",
        evaluatorVersion: CANONICAL_HARNESS_REVISION,
      },
    ],
    guards: [{ name: "peak_gpu_memory_gigabytes", status: "pass" }],
    verdict: "KEEP",
    verdictReason: "baseline이 비교 기준이 된다",
    incumbentAfter: "a1b2c3d",
    stopReason: null,
    rawLedgerRow: "a1b2c3d\t0.997900\t44.0\tok\tbaseline",
  },
  {
    campaignId: CANONICAL_CAMPAIGN_ID,
    iteration: 1,
    contractVersion: CANONICAL_CONTRACT_VERSION,
    incumbentBefore: "a1b2c3d",
    challenger: "b2c3d4e",
    hypothesis: {
      id: "hypothesis-001",
      statement: "learning rate를 0.04로 올리면 val_bpb가 내려간다",
    },
    changedScope: ["train.py:optimizer"],
    harnessRevision: CANONICAL_HARNESS_REVISION,
    observation: { valid: true, rawRef: "runs/001/raw.log", exitStatus: "ok" },
    metrics: [
      {
        name: "val_bpb",
        value: 0.9932,
        direction: "lower",
        evaluatorVersion: CANONICAL_HARNESS_REVISION,
      },
      {
        name: "peak_memory_gigabytes",
        value: 44.2,
        direction: "lower",
        evaluatorVersion: CANONICAL_HARNESS_REVISION,
      },
    ],
    guards: [{ name: "peak_gpu_memory_gigabytes", status: "pass" }],
    verdict: "KEEP",
    verdictReason: "metric이 개선되고 guard를 통과했다",
    incumbentAfter: "b2c3d4e",
    stopReason: null,
    rawLedgerRow: "b2c3d4e\t0.993200\t44.2\tok\tincrease learning rate to 0.04",
  },
  {
    campaignId: CANONICAL_CAMPAIGN_ID,
    iteration: 2,
    contractVersion: CANONICAL_CONTRACT_VERSION,
    incumbentBefore: "b2c3d4e",
    challenger: "c3d4e5f",
    hypothesis: {
      id: "hypothesis-002",
      statement: "activation을 GELU로 바꾸면 val_bpb가 내려간다",
    },
    changedScope: ["train.py:activation"],
    harnessRevision: CANONICAL_HARNESS_REVISION,
    observation: { valid: true, rawRef: "runs/002/raw.log", exitStatus: "ok" },
    metrics: [
      {
        name: "val_bpb",
        value: 1.005,
        direction: "lower",
        evaluatorVersion: CANONICAL_HARNESS_REVISION,
      },
      {
        name: "peak_memory_gigabytes",
        value: 44.0,
        direction: "lower",
        evaluatorVersion: CANONICAL_HARNESS_REVISION,
      },
    ],
    guards: [{ name: "peak_gpu_memory_gigabytes", status: "pass" }],
    verdict: "DISCARD",
    verdictReason: "metric이 나빠져 incumbent를 유지하고 rollback했다",
    incumbentAfter: "b2c3d4e",
    stopReason: null,
    rawLedgerRow:
      "c3d4e5f\t1.005000\t44.0\tok\tswitch to Gaussian Error Linear Unit activation",
  },
  {
    campaignId: CANONICAL_CAMPAIGN_ID,
    iteration: 3,
    contractVersion: CANONICAL_CONTRACT_VERSION,
    incumbentBefore: "b2c3d4e",
    challenger: "d4e5f6g",
    hypothesis: {
      id: "hypothesis-003",
      statement: "model width를 두 배로 늘리면 val_bpb가 내려간다",
    },
    changedScope: ["train.py:model"],
    harnessRevision: CANONICAL_HARNESS_REVISION,
    observation: {
      valid: false,
      rawRef: "runs/003/raw.log",
      exitStatus: "crash",
    },
    metrics: [
      {
        name: "val_bpb",
        value: null,
        direction: "lower",
        evaluatorVersion: CANONICAL_HARNESS_REVISION,
      },
      {
        name: "peak_memory_gigabytes",
        value: null,
        direction: "lower",
        evaluatorVersion: CANONICAL_HARNESS_REVISION,
      },
    ],
    guards: [{ name: "peak_gpu_memory_gigabytes", status: "unknown" }],
    verdict: "CRASH",
    verdictReason: "out of memory로 유효한 성능 측정이 없다",
    incumbentAfter: "b2c3d4e",
    stopReason: null,
    rawLedgerRow: "d4e5f6g\t0.000000\t0.0\tcrash\tdouble model width, out of memory",
  },
];

export type CampaignState = {
  incumbent: string | null;
  bestSoFar: { revision: string; metricValue: number } | null;
  ledger: readonly ExperimentRecord[];
};

export const INITIAL_CAMPAIGN_STATE: CampaignState = {
  incumbent: null,
  bestSoFar: null,
  ledger: [],
};

function primaryMetric(record: ExperimentRecord) {
  return record.metrics[0] ?? null;
}

function isBetter(
  candidate: number,
  best: number,
  direction: "higher" | "lower",
) {
  return direction === "lower" ? candidate < best : candidate > best;
}

/**
 * The only place where verdict → incumbent logic lives. Candidate failure
 * appends to the ledger but never moves the incumbent backwards; only KEEP
 * advances the incumbent, and best-so-far tracks accepted revisions.
 */
export function reduceExperiment(
  state: CampaignState,
  record: ExperimentRecord,
): CampaignState {
  const incumbent =
    record.verdict === "KEEP" ? record.challenger : state.incumbent;
  const metric = primaryMetric(record);
  const bestSoFar =
    record.verdict === "KEEP" && metric !== null && metric.value !== null
      ? state.bestSoFar === null ||
        isBetter(metric.value, state.bestSoFar.metricValue, metric.direction)
        ? { revision: record.challenger, metricValue: metric.value }
        : state.bestSoFar
      : state.bestSoFar;

  return { incumbent, bestSoFar, ledger: [...state.ledger, record] };
}

export function foldCampaign(records: readonly ExperimentRecord[]) {
  return records.reduce(reduceExperiment, INITIAL_CAMPAIGN_STATE);
}

export function formatMetricValue(
  value: number | null,
  fractionDigits = 6,
): string {
  return value === null ? "측정 없음" : value.toFixed(fractionDigits);
}

export function formatMemoryValue(value: number | null): string {
  return value === null ? "측정 없음" : `${value.toFixed(1)} GB`;
}

export function verdictLabel(verdict: ExperimentVerdict) {
  switch (verdict) {
    case "KEEP":
      return "KEEP · Challenger가 다음 Incumbent";
    case "DISCARD":
      return "DISCARD · Incumbent 유지, rollback";
    case "CRASH":
      return "CRASH · 유효한 측정 없음, Incumbent 유지";
    case "PENDING":
      return "PENDING · 판정 대기";
    case "BLOCKED":
      return "BLOCKED · 권한 또는 안전 차단";
  }
}

export type GateStep = {
  id:
    | "valid-observation"
    | "required-guards"
    | "improvement-beyond-uncertainty"
    | "independent-verify"
    | "keep";
  label: string;
  provenance: Extract<
    ClaimProvenance,
    "official-autoresearch-example" | "engineering-transfer"
  >;
};

/** Wireframe §9.3 gate order. 공식 예시보다 넓은 guard·holdout은 engineering transfer. */
export const GATE_ORDER: GateStep[] = [
  {
    id: "valid-observation",
    label: "유효한 observation",
    provenance: "official-autoresearch-example",
  },
  {
    id: "required-guards",
    label: "필수 guard 통과",
    provenance: "engineering-transfer",
  },
  {
    id: "improvement-beyond-uncertainty",
    label: "불확실성을 넘는 개선",
    provenance: "engineering-transfer",
  },
  {
    id: "independent-verify",
    label: "필요 시 독립 verify",
    provenance: "engineering-transfer",
  },
  {
    id: "keep",
    label: "KEEP",
    provenance: "official-autoresearch-example",
  },
];

/**
 * Wireframe §9.4 — 사례별 pass/fail criterion이 있을 때만 쓰는 전이 비교
 * synthetic fixture. 훼손이 큰 candidate를 gate가 discard하면 candidate 수준
 * CLₜ가 낮아도 system-after-gate의 통과 항목은 보호된다.
 */
export const CRITERION_TRANSITION_EXAMPLE = {
  totalCriteria: 12,
  incumbentPass: 9,
  incumbentFail: 3,
  preserved: 6,
  damaged: 3,
  recovered: 1,
  remaining: 2,
  candidatePass: 7,
  candidateConfidenceLevel: 6 / 9,
  candidateCritiqueScore: 1 / 3,
  verdict: "DISCARD" as const,
  systemPassAfterGate: 9,
} as const;

/** Wireframe §9.6 최소 telemetry 예시. */
export const TELEMETRY_SAMPLE = {
  contract_version: "research-contract-version-3",
  iteration: 12,
  incumbent_revision: "b2c3d4e",
  challenger_revision: "e5f6g7h",
  hypothesis_id: "hypothesis-012",
  changed_scope: ["train.py:optimizer"],
  harness_revision: "evaluator-version-7",
  observation_ref: "runs/012/raw.log",
  metric: { name: "val_bpb", value: 0.9928, direction: "lower" },
  guards: [{ name: "peak_gpu_memory_gigabytes", status: "pass" }],
  verdict: "KEEP",
  verdict_reason: "metric improved and guards passed",
  campaign_budget_remaining: 28800,
  stop_reason: null,
} as const;

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
    persisted: "Accepted revision과 baseline evaluation",
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

/** Wireframe §9.4 증상에서 고장 층으로. */
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

export const PLATEAU_LIMIT = 5;

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

/**
 * Wireframe §9.5. 여러 종료 조건이 겹치면 안전과 하네스 무결성을 성능
 * 개선보다 먼저 평가한다 (S07.29).
 */
export function determineStopReason(inputs: StopInputs): StopReason {
  if (inputs.manualInterrupt) return "MANUAL_INTERRUPT";
  if (inputs.safetyViolation) return "SAFETY_VIOLATION";
  if (!inputs.harnessValid) return "HARNESS_INVALID";
  if (inputs.humanGateRequired) return "HUMAN_GATE";
  if (inputs.successPredicateMet) return "SUCCESS_PREDICATE_MET";
  if (inputs.cycleDetected) return "CYCLE_DETECTED";
  if (inputs.plateauIterations >= PLATEAU_LIMIT) return "PLATEAU";
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

/** Wireframe §10.2 blank template + §10.3 synthetic example의 일곱 구역. */
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
      "Guards: all_tests_pass, latency p95 ≤ baseline, no_new_permission",
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

/** Wireframe §10.2 blank policy template (YAML 원문). */
export const BLANK_POLICY_YAML = `loop_policy:
  goal:
  success_predicate:

  mutable_artifact:
  frozen_harness:

  trial_budget:
  campaign_budget:

  evidence:
    raw_observation:
    primary_metric:
    uncertainty:
    guards:
    gold_or_holdout:

  transition:
    keep:
    discard:
    crash:
    rollback:

  ledger:
  memory:

  stop:
    success:
    safety:
    cycle:
    plateau:
    budget:
    human_gate:

  owners:
    proposer:
    evaluator:
    selector:
    external_commit:`;

/** Wireframe §10.3 synthetic example (실제 운영 수치가 아니다). */
export const SYNTHETIC_POLICY_YAML = `goal: "checkout 결제 성공률을 안전하게 높인다"
mutable_artifact: ["checkout/**", "tests/checkout/**"]
frozen_harness: "checkout-evaluator-version-7 + holdout-2026-07"
primary_metric: "checkout_success_rate, higher is better"
guards: ["all_tests_pass", "latency_95th_percentile_milliseconds<=baseline", "no_new_permission"]
keep: "checkout_success_rate_gain_percentage_points>0.3 && guards_pass && holdout_no_regression"
rollback: "restore incumbent revision and isolated environment"
stop:
  success: true
  plateau_iterations: 5
  time_budget_hours: 6
  cost_budget_usd: 40
  safety: true
  human_gate: true`;

/**
 * Scene 6 — Ralph loop (reports/scene6-ralph-loop-wireframe.md).
 *
 * 1차 출처: ghuntley.com/ralph (2025-07) + 공식 Claude 플러그인 ralph-loop
 * README. 궤적 수치는 synthetic 예시값이며 측정치가 아니다.
 */

export type RalphFact = {
  id:
    | "definition"
    | "state"
    | "unit"
    | "judgement"
    | "failures"
    | "missing"
    | "source";
  label: string;
  value: string;
};

export const RALPH_FACTS: RalphFact[] = [
  {
    id: "definition",
    label: "정의",
    value:
      "while :; do cat PROMPT.md | claude ; done — 같은 프롬프트 무한 재투입",
  },
  {
    id: "state",
    label: "상태",
    value: "매 바퀴 컨텍스트 초기화, 지속되는 것은 파일과 git history뿐",
  },
  {
    id: "unit",
    label: "단위",
    value: "한 바퀴에 한 작업, 우선순위는 agent가 스스로 결정",
  },
  {
    id: "judgement",
    label: "판정",
    value:
      "agent 자기 평가 + 스스로 돌리는 compile·test·정적 분석(backpressure)",
  },
  {
    id: "failures",
    label: "문서화된 실패",
    value:
      "컴파일 보상만 쫓는 placeholder 구현 · 깨진 codebase로 기상 → 수동 git reset",
  },
  {
    id: "missing",
    label: "없는 것",
    value: "incumbent/challenger 분리, acceptance gate, append-only ledger",
  },
  {
    id: "source",
    label: "출처",
    value:
      "Geoffrey Huntley, 2025-07 (ghuntley.com/ralph) · 공식 Claude 플러그인 ralph-loop",
  },
];

/** 논문 모형의 가정 ↔ Ralph 구조 대응 — engineering-transfer 해석. */
export type RalphCorrespondenceRow = {
  id: "policy" | "judge" | "state-chain" | "no-gate";
  paper: string;
  ralph: string;
};

export const RALPH_CORRESPONDENCE: RalphCorrespondenceRow[] = [
  {
    id: "policy",
    paper: "같은 정책으로 매 라운드 재시도 (정지 가정, CS·CL 고정)",
    ralph: "같은 PROMPT.md를 매 바퀴 재투입, 컨텍스트 초기화",
  },
  {
    id: "judge",
    paper: "판정자 없음 — 모델이 스스로 고치고 스스로 망가뜨림",
    ralph: "agent 자기 평가가 유일한 판정, 외부 verifier 없음(기본형)",
  },
  {
    id: "state-chain",
    paper: "이전 답이 다음 라운드의 입력",
    ralph: "working tree가 유일한 상태로 다음 바퀴에 상속",
  },
  {
    id: "no-gate",
    paper: "채택 gate 없음 — 전이가 그대로 상태가 됨",
    ralph: "KEEP/DISCARD 분리 없음, 훼손도 즉시 채택",
  },
];

export type RalphBackpressure = "none" | "test";

/** Scene 7 fixture(CRITERION_TRANSITION_EXAMPLE)와 같은 12개 기준. */
export const RALPH_TOTAL_REQUIREMENTS = 12;

export type RalphTrajectory = {
  /** agent가 스스로 믿는 충족 수 — 매끈히 상승하는 자기 평가. */
  believed: readonly number[];
  /** 실제 충족 수 — 훼손 채택으로 후퇴하는 궤적. */
  actual: readonly number[];
  /** actual이 정체하는 높이에 그리는 천장 Upp 점선(해석). */
  ceiling: number;
  /** actual이 직전보다 낮아지는 iteration — 훼손이 그대로 채택된 바퀴. */
  regressions: readonly number[];
  /** backpressure(test)가 훼손 시도를 실행 단계에서 잡아낸 바퀴. */
  blocked: readonly number[];
  /** believed가 12/12에 닿아 COMPLETE를 선언하는 iteration. */
  completeClaimIteration: number | null;
};

/**
 * Synthetic 궤적 — 논문의 예측(자기평가 괴리·훼손 채택·천장)을 구조로
 * 보여 주기 위한 예시값. backpressure(test)는 부분 external verifier라서
 * 천장은 오르지만 후퇴가 완전히 사라지지는 않는다.
 */
export const RALPH_TRAJECTORIES: Record<RalphBackpressure, RalphTrajectory> = {
  none: {
    believed: [0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 12, 12],
    actual: [0, 2, 3, 4, 3, 5, 6, 7, 5, 6, 7, 7, 7],
    ceiling: 7.4,
    regressions: [4, 8],
    blocked: [],
    completeClaimIteration: 10,
  },
  test: {
    believed: [0, 2, 4, 5, 6, 7, 8, 8, 9, 10, 10, 11, 11],
    actual: [0, 2, 4, 5, 6, 7, 8, 7, 8, 9, 10, 10, 10],
    ceiling: 10.4,
    regressions: [7],
    blocked: [4, 11],
    completeClaimIteration: null,
  },
};

export const RALPH_BACKPRESSURE_LABELS: Record<RalphBackpressure, string> = {
  none: "없음",
  test: "test",
};

export function ralphSummary(mode: RalphBackpressure) {
  const trajectory = RALPH_TRAJECTORIES[mode];
  const believedFinal = trajectory.believed[trajectory.believed.length - 1];
  const actualFinal = trajectory.actual[trajectory.actual.length - 1];
  const claim =
    trajectory.completeClaimIteration === null
      ? `believed ${believedFinal}/${RALPH_TOTAL_REQUIREMENTS}`
      : `believed ${believedFinal}/${RALPH_TOTAL_REQUIREMENTS} · COMPLETE 선언`;
  const blocked =
    trajectory.blocked.length > 0
      ? ` · 차단 ${trajectory.blocked.length}회`
      : "";
  return `${claim} · actual ${actualFinal}/${RALPH_TOTAL_REQUIREMENTS} · 후퇴 ${trajectory.regressions.length}회${blocked}`;
}

/** Wireframe §10.4 최종 세 문장. */
export const FINAL_TAKEAWAYS = [
  "논문은 반복 횟수보다 정답 보존과 오답 복구의 균형을 보게 한다.",
  "적용할 때는 candidate의 전이와 system-after-gate의 전이를 분리한다.",
  "좋은 agent loop는 많이 고치는 시스템이 아니라 증거 없는 변경을 채택하지 않는 시스템이다.",
] as const;
