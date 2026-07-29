# M4b Agent Loop Necessity Pilot Preflight Report

Date: 2026-05-27
Status: deterministic simulation preflight complete
Manifest: `data/M4b-agent-loop-necessity-pilot-manifest.json`
Runner: `scripts/m4b_pilot_simulation.py`
Results: `data/M4b-agent-loop-necessity-pilot-results.json`

## Boundary

This preflight is not empirical evidence about real LLM behavior. It does not call a model and does not measure an actual agent. It validates whether the preregistered M4b protocol can express the expected interaction:

```text
loop benefit = f(horizon, feedback quality, verifier reliability, state control, cost)
```

The result should be cited only as pipeline validation and a deterministic sanity check for the analysis plan.

## Setup

The simulation uses five task classes:

| task class | horizon | base success | hazard | expected effect |
|---|---:|---:|---:|---|
| `short_deterministic` | 1 | 0.98 | 0.002 | one-shot should be enough |
| `medium_reasoning` | 8 | 0.35 | 0.008 | verifier/search should help |
| `long_software` | 25 | 0.12 | 0.012 | tests/rollback should help |
| `long_research` | 20 | 0.18 | 0.010 | retrieval/provenance should help |
| `long_planning` | 30 | 0.10 | 0.014 | observation-action loop should help |

It evaluates eight protocol conditions:

| id | condition |
|---|---|
| `C0` | one-shot greedy |
| `C1` | one-shot sampling |
| `C2` | best-of-n without verifier |
| `C3` | best-of-n with strong verifier |
| `C4` | self-reflection loop |
| `C5` | grounded feedback loop |
| `C6` | full state-control loop |
| `C7` | weak-verifier stress |

The utility formula is:

```text
expected_task_utility =
  expected_success_after_horizon_risk - cost_penalty
```

## Summary

All predeclared checks passed.

| check | result |
|---|---|
| `C6` improves over `C0` on all long tasks | pass |
| `C6` does not improve over `C0` on short deterministic task | pass |
| `C3` beats `C2` for all task classes | pass |
| `C6` beats `C7` for all task classes | pass |
| `C6` beats `C4` on all long tasks | pass |

## Winners

| task class | winning condition | expected utility |
|---|---|---:|
| `short_deterministic` | `C0` one-shot greedy | 0.972040 |
| `medium_reasoning` | `C6` full state-control loop | 0.797202 |
| `long_software` | `C6` full state-control loop | 0.493863 |
| `long_research` | `C6` full state-control loop | 0.599176 |
| `long_planning` | `C6` full state-control loop | 0.440731 |

This is the desired negative-control pattern: the full loop does not win on the short deterministic task because one-shot is already near saturation and loop costs dominate.

## Predeclared Contrasts

| task class | `C6-C0` | `C6-C4` | `C3-C2` | `C6-C7` |
|---|---:|---:|---:|---:|
| `short_deterministic` | -0.030740 | -0.026500 | 0.015889 | 0.003100 |
| `medium_reasoning` | 0.474985 | 0.443886 | 0.501147 | 0.433856 |
| `long_software` | 0.411126 | 0.407687 | 0.308346 | 0.401529 |
| `long_research` | 0.457953 | 0.445644 | 0.412814 | 0.436325 |
| `long_planning` | 0.381221 | 0.383285 | 0.244150 | 0.379685 |

Interpretation:

1. `C6-C0` is negative on short deterministic tasks and positive on every longer task class.
2. `C6-C4` is strongly positive on long tasks, so external feedback plus state control is not equivalent to self-reflection.
3. `C3-C2` is positive, so verifier selection matters beyond more samples.
4. `C6-C7` is positive, so weak verifier stress does not mimic full loops.

## What This Validates

The preflight validates the shape of the protocol:

1. Task horizon can be represented as an explicit moderator.
2. One-shot negative controls can be represented.
3. Verifier quality can be separated from candidate count.
4. Self-reflection can be separated from external feedback.
5. Cost penalties can prevent "more loop is always better" conclusions.
6. The runner can emit machine-readable contrasts for later empirical runs.

## What This Does Not Validate

This preflight does not prove:

1. Any real LLM has the simulated base success probabilities.
2. Any real verifier has the simulated TPR/FPR values.
3. `C6` will beat one-shot in actual benchmarks.
4. The cost model matches any provider or runtime.
5. The conditional loop-necessity thesis is empirically true.

It only verifies that the protocol can express both support and falsification patterns.

## Commands

```sh
npm run m4b:pilot-sim
jq . data/M4b-agent-loop-necessity-pilot-manifest.json >/dev/null
jq . data/M4b-agent-loop-necessity-pilot-results.json >/dev/null
python3 -m py_compile scripts/m4b_pilot_simulation.py
```

## Next Step

The next step is a real pilot with actual model calls on a tiny task matrix:

1. 5 short deterministic tasks.
2. 5 medium reasoning tasks with deterministic answer checks.
3. 5 small code repair tasks with unit tests.
4. Conditions `C0`, `C3`, `C4`, `C6`, and `C7`.

This would be the first empirical evidence layer. Until then, the M4b work remains a theoretical/literature/protocol package plus deterministic pipeline validation.
