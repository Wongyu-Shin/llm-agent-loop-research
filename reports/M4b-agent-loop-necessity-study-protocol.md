# M4b Agent Loop Necessity Study Protocol

Date: 2026-05-27
Status: preregistration-style protocol draft
Linked reports:
- `reports/M4b-agent-loop-necessity-research-report.md`
- `reports/M4b-agent-loop-necessity-paper-draft.md`
- `data/M4b-agent-loop-necessity-sources.json`

## Purpose

This protocol turns the claim "LLM agent work becomes loop-based because of LLM structure" into a falsifiable empirical study. The study does not try to prove that every LLM use must loop. It tests the conditional thesis:

> Loop-based agent structure improves expected task utility over one-shot decoding primarily when the task is long-horizon, partially observable, externally verifiable, and requires state revision.

The protocol is designed to distinguish three mechanisms that are often conflated:

1. More samples: repeated candidate generation increases coverage.
2. Better selection: verifiers choose useful candidates.
3. Better state control: observation, rollback, memory, and revision prevent error propagation.

## Primary Research Questions

| id | question | falsifiable answer |
|---|---|---|
| RQ1 | Does loop-based operation outperform one-shot decoding on long-horizon tasks? | Yes only if loop conditions beat one-shot baselines after cost normalization. |
| RQ2 | Is external feedback necessary for loop benefits? | Yes if grounded tool/test/retrieval feedback beats self-reflection-only loops. |
| RQ3 | Does loop benefit scale with horizon length? | Yes if the loop advantage grows from short to medium to long tasks. |
| RQ4 | Can loops harm performance? | Yes if weak-verifier or no-rollback loops regress relative to one-shot baselines. |
| RQ5 | Which loop component matters most? | Determined by ablations over verifier, rollback, memory, and external tools. |

## Hypotheses

### H1: Conditional loop benefit

For long-horizon externally verifiable tasks, full feedback loops will produce higher task utility than one-shot greedy and one-shot sampled decoding under matched or reported compute budgets.

### H2: Feedback quality moderation

Loops with external feedback will outperform self-reflection-only loops. External feedback includes unit tests, compiler/runtime errors, theorem checkers, retrieval evidence, browser observations, or human labels.

### H3: Horizon moderation

The performance gap between full loops and one-shot baselines will increase with horizon length, measured by required intermediate commitments, tool calls, files touched, or reasoning steps.

### H4: Loop failure under weak selection

Repeated generation without a reliable verifier will plateau or regress as sample count or iteration count increases.

### H5: State-control contribution

Rollback, explicit state ledgers, and memory hygiene will independently reduce regression-after-revision and stale-assumption errors.

## Task Taxonomy

The study should include positive and negative controls.

| class | examples | horizon proxy | expected loop effect |
|---|---|---|---|
| short deterministic | JSON extraction, format conversion, simple classification | 1 commitment, no external state | neutral or negative |
| medium reasoning | GSM8K-style math, logic puzzles, multi-hop QA | 3-10 reasoning commitments | positive with verifier/search |
| long software | bug fix, refactor, failing-test repair, documentation issue | files, tests, runtime observations | positive with tool/test loop |
| long research | web/source search, citation-backed synthesis, contradiction resolution | source count, citation checks | positive with retrieval/provenance loop |
| long planning | grid/world/web navigation, scheduling, multi-step plan validation | environment steps | positive with observation-action loop |

## Experimental Conditions

Each task should be run under the same model family where possible.

| id | condition | description | isolates |
|---|---|---|---|
| C0 | one-shot greedy | Deterministic direct answer. | Base local decoding. |
| C1 | one-shot sampling | Single stochastic answer. | Sampling without feedback. |
| C2 | best-of-n no verifier | Multiple samples, arbitrary first/last or random selection. | Sample count without selection. |
| C3 | best-of-n verifier | Multiple samples selected by external or calibrated verifier. | Search plus selection. |
| C4 | self-reflection loop | Model critiques and revises without external feedback. | Intrinsic reflection. |
| C5 | grounded feedback loop | Model observes tests/tools/retrieval and revises. | External feedback. |
| C6 | full state-control loop | Grounded feedback plus rollback, explicit state ledger, and stopping rule. | Feedback plus state management. |
| C7 | weak-verifier stress | Loop uses intentionally noisy or underpowered verifier. | Failure mode. |

## Loop Policy Schema

Every loop run must record:

```json
{
  "condition_id": "C6",
  "model": "model-name",
  "decoding": {
    "temperature": 0.2,
    "top_p": 0.95,
    "max_output_tokens": 4096
  },
  "budget": {
    "max_iterations": 8,
    "max_model_calls": 16,
    "max_tool_calls": 32,
    "max_wall_time_seconds": 1800
  },
  "state_policy": {
    "ledger_required": true,
    "rollback_enabled": true,
    "memory_write_requires_verification": true
  },
  "verifier": {
    "type": "unit_tests|compiler|retrieval|llm_judge|human|none",
    "independence": "external|same_model|weaker_model|human",
    "known_error_rate": null
  },
  "stopping_rule": {
    "success_condition": "predeclared verifier pass",
    "failure_condition": "budget exhausted or regression",
    "tie_break": "lowest cost among passing candidates"
  }
}
```

## Metrics

### Primary metric

`task_utility` should be predeclared per task:

```text
task_utility = success_score - cost_penalty - side_effect_penalty - regression_penalty
```

For binary tasks:

```text
success_score = 1 if hidden verifier passes else 0
```

For graded tasks:

```text
success_score in [0,1]
```

### Secondary metrics

| metric | definition |
|---|---|
| success_rate | Fraction of tasks passing hidden or final verifier. |
| visible_hidden_gap | Visible verifier pass rate minus hidden verifier pass rate. |
| cost | Tokens, model calls, tool calls, wall time. |
| latency | End-to-end runtime. |
| revision_count | Number of nontrivial output/state revisions. |
| rollback_count | Number of discarded branches or reverted changes. |
| verifier_disagreement | Rate of disagreement among independent verifiers. |
| context_growth | Prompt/context token growth across loop. |
| regression_after_revision | Cases where a later revision worsens an earlier passing criterion. |
| stale_state_error | Failures caused by carrying forward obsolete assumptions. |

## Statistical Analysis Plan

### Main model

Use a mixed-effects model or hierarchical Bayesian model with task as a random effect.

For binary success:

```text
logit(P(success)) ~ condition * horizon_class + feedback_type + log(cost)
                    + (1 | task_family) + (1 | task_id)
```

For continuous utility:

```text
utility ~ condition * horizon_class + feedback_type + log(cost)
          + (1 | task_family) + (1 | task_id)
```

### Predeclared contrasts

| contrast | interpretation |
|---|---|
| C6 > C0 on long tasks | Full loop beats one-shot greedy. |
| C6 > C4 on long tasks | External feedback beats self-reflection only. |
| C3 > C2 | Verifier selection matters beyond more samples. |
| C7 < C6 | Verifier quality moderates loop benefit. |
| C6 long-task advantage > C6 short-task advantage | Horizon moderates loop value. |

### Cost-normalized reporting

For each condition, report:

1. raw success,
2. success per 1k generated tokens,
3. success per model call,
4. success per minute,
5. Pareto frontier over success and cost.

This prevents a loop from looking better merely because it spends more compute.

## Minimum Sample Plan

This is an initial planning target, not a power analysis.

| task class | tasks | seeds per condition | conditions |
|---|---:|---:|---:|
| short deterministic | 50 | 3 | C0-C6 |
| medium reasoning | 100 | 3 | C0-C6 |
| long software | 50 | 2 | C0-C7 |
| long research | 50 | 2 | C0-C7 |
| long planning | 50 | 2 | C0-C7 |

The final paper should replace this with a power analysis after pilot variance estimates are available.

## Failure Taxonomy

Every failed run should be labeled with one primary and optional secondary cause.

| label | definition |
|---|---|
| local_decoding_error | Early local generation choice leads to unrecoverable bad trajectory. |
| objective_mismatch | Output is likely/plausible but fails task utility. |
| verifier_false_positive | Verifier accepts a bad candidate. |
| verifier_false_negative | Verifier rejects a good candidate. |
| self_critique_regression | Reflection makes output worse without external evidence. |
| context_drift | Requirements are lost or distorted across iterations. |
| stale_memory | Incorrect memory/summary affects later decisions. |
| tool_observation_error | Tool output is misread, stale, incomplete, or unavailable. |
| rollback_failure | System cannot return to a better previous state. |
| cost_overrun | Utility gain is dominated by latency or compute cost. |
| side_effect | Tool/action causes unintended external change. |

## Inclusion And Exclusion Criteria

Include tasks when:

1. The task has a predeclared verifier or scoring rubric.
2. The input can be replayed across conditions.
3. Model/tool budgets can be recorded.
4. Intermediate observations can be logged.

Exclude tasks when:

1. Success is purely subjective without a rubric.
2. External state cannot be reset or replayed.
3. Tool actions are irreversible and unsafe.
4. The task is already in the model prompt examples used to design the protocol.

## Evidence Needed To Support The Thesis

The conditional thesis is supported only if:

1. Full loops beat one-shot baselines on long-horizon tasks after cost reporting.
2. The advantage is smaller or absent on short deterministic tasks.
3. External feedback loops beat self-reflection-only loops.
4. Weak verifier loops show plateau or regression.
5. Failure logs show loops reduce unrepaired error propagation rather than merely increasing output length.

The thesis is weakened if:

1. One-shot baselines match full loops on long-horizon tasks.
2. Self-reflection-only loops match external feedback loops.
3. Loop gains vanish after cost normalization.
4. Failures are dominated by verifier error, memory corruption, or context drift.
5. Negative controls show loops help equally on trivial tasks, suggesting benchmark or scoring artifacts.

## Completion Audit Checklist

Use this checklist before claiming the research program is complete.

| requirement | evidence required | current status |
|---|---|---|
| Mathematical plausibility assessed | Formal propositions and counterexamples stated. | satisfied by research report and paper draft |
| Engineering plausibility assessed | Agent-loop literature mapped to mechanisms. | satisfied by source map and evidence review |
| Multidisciplinary critique performed | Math/optimization, control/RL, software engineering, cognitive/bounded-rationality critiques recorded. | satisfied at literature-synthesis level |
| Universal claim corrected | Report explicitly rejects "all LLM tasks must loop." | satisfied |
| Conditional thesis stated | Task class and reliability assumptions stated. | satisfied |
| Experimental protocol defined | Conditions, metrics, task classes, contrasts, failure taxonomy defined. | satisfied in this protocol |
| Empirical evidence collected | Actual runs across task classes and loop conditions. | tiny pilot started; see `reports/M4b-agent-loop-necessity-tiny-pilot-report.md` |
| Statistical analysis performed | Mixed-effects or Bayesian estimates over collected data. | tiny pilot paired exact analysis only; publication-grade model not started |
| Negative controls tested | Short deterministic tasks included and analyzed. | tiny pilot only |
| Hidden/verifier tests used | Independent verification beyond visible feedback. | deterministic exact-answer verifier in tiny pilot only |
| Publication manuscript completed | Full paper with results, tables, limitations, and references. | draft only |

Current conclusion: the theoretical and literature-review phase supports the conditional thesis, and the tiny pilot adds an initial empirical caution: loop structure alone did not improve accuracy without actionable feedback or tools. A publishable empirical claim still requires a larger preregistered run with statistical analysis.

## Relation To The Mathematical Argument

The experiment does not prove that loops are logically necessary. It tests whether the mathematical failure modes identified in the research report have measurable engineering consequences.

The deterministic mathematical appendix is recorded in `reports/M4b-agent-loop-necessity-math-appendix.md`, and the machine-readable calculation output is `data/M4b-agent-loop-necessity-math-demo.json`.

The deterministic simulation preflight for the protocol is recorded in `reports/M4b-agent-loop-necessity-pilot-preflight-report.md`, with manifest `data/M4b-agent-loop-necessity-pilot-manifest.json`, runner `scripts/m4b_pilot_simulation.py`, and results `data/M4b-agent-loop-necessity-pilot-results.json`.

The first real-provider tiny pilot is recorded in `reports/M4b-agent-loop-necessity-tiny-pilot-report.md`, with manifest `data/M4b-agent-loop-necessity-tiny-pilot-manifest.json`, runner `scripts/m4b_tiny_pilot_runner.py`, and results `data/M4b-agent-loop-necessity-tiny-pilot-results.json`.

| mathematical issue | empirical proxy |
|---|---|
| local decoding mismatch | greedy vs search/verifier contrast |
| task utility mismatch | likelihood-like direct answer vs external scoring |
| horizon-risk accumulation | performance by horizon class |
| verifier-conditioned improvement | best-of-n no verifier vs best-of-n verifier |
| loop non-sufficiency | weak-verifier and self-reflection-only conditions |

## Reporting Template

The final empirical report should include:

1. Task inventory and horizon labels.
2. Model and decoding settings.
3. Loop policy schemas for each condition.
4. Verifier descriptions and independence level.
5. Raw success and task utility.
6. Cost-normalized results.
7. Mixed-effects or Bayesian estimates.
8. Failure taxonomy counts.
9. Representative trajectories.
10. Negative controls.
11. Threats to validity.
12. Claim boundary.

## Bottom Line

This protocol turns the philosophical claim into a falsifiable research program. The expected result is not that loops always win. The expected result is an interaction:

```text
loop benefit = f(horizon, feedback quality, verifier reliability, state control, cost)
```

If this interaction is observed, the original idea becomes publishable in a precise form: LLM agent loops are not universal necessities, but they are conditionally necessary engineering structures for reliable long-horizon work with external state and verifiable intermediate outcomes.
