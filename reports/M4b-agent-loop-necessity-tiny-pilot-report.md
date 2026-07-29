# M4b Agent Loop Necessity Tiny Empirical Pilot

Date: 2026-05-27
Status: first tiny real-provider pilot complete
Manifest: `data/M4b-agent-loop-necessity-tiny-pilot-manifest.json`
Runner: `scripts/m4b_tiny_pilot_runner.py`
Provider check: `data/M4b-agent-loop-necessity-tiny-pilot-provider-check.json`
Dry run: `data/M4b-agent-loop-necessity-tiny-pilot-dry-run.json`
Real run: `data/M4b-agent-loop-necessity-tiny-pilot-results.json`
Paired analysis: `data/M4b-agent-loop-necessity-tiny-pilot-analysis.json`

## Boundary

This is not publication-grade evidence. It is a small empirical smoke test for the broader M4b thesis and preregistered protocol. It uses one provider, one selected model, twelve synthetic deterministic tasks, and five loop conditions.

The result should be cited as a pilot observation:

> Loop structure is not automatically beneficial. Its value depends on task difficulty, feedback quality, verifier reliability, and whether the loop has enough information or tools to change the trajectory.

## Provider Check

The provider check succeeded.

| field | value |
|---|---:|
| API base | `https://api.openai.com` |
| API key present | yes |
| available model count | 120 |
| selected model | `gpt-5.4-mini` |

The selected model came from provider model discovery, not from a hardcoded environment variable.

## Conditions

| id | condition | temperature policy |
|---|---|---|
| `C0` | one-shot | deterministic, `0.0` |
| `C3` | best-of-n with strong verifier | sampling, `0.7` |
| `C4` | self-reflection loop | deterministic, `0.0` |
| `C6` | grounded verifier loop | deterministic, `0.0` |
| `C7` | weak-verifier stress | sampling, `0.7` |

The temperature split is intentional: `C3` and `C7` test candidate diversity; `C0`, `C4`, and `C6` test deterministic trajectory plus reflection or verifier feedback. This avoids mixing sampling effects into the main `C0` vs `C6` comparison.

## Task Matrix

The pilot used 12 tasks:

| class | n | purpose |
|---|---:|---|
| `short_deterministic` | 2 | negative control; one-shot should usually saturate |
| `medium_reasoning` | 3 | small algebra and logic tasks |
| `tiny_symbolic` | 1 | modular arithmetic warm-up |
| `stress_deterministic` | 6 | exact transformations, CRT-style arithmetic, expression evaluation, ordering, and prime-position extraction |

## Main Result

| condition | n | success rate | model calls |
|---|---:|---:|---:|
| `C0` one-shot | 12 | 0.750000 | 12 |
| `C3` best-of-n strong verifier | 12 | 0.750000 | 36 |
| `C4` self-reflection | 12 | 0.416667 | 24 |
| `C6` grounded verifier loop | 12 | 0.750000 | 19 |
| `C7` weak-verifier stress | 12 | 0.666667 | 36 |

Predeclared contrasts:

| contrast | value |
|---|---:|
| `C3-C0` all tasks | 0.000000 |
| `C3-C0` non-short tasks | 0.000000 |
| `C4-C0` all tasks | -0.333333 |
| `C6-C0` all tasks | 0.000000 |
| `C6-C0` medium reasoning | 0.000000 |
| `C6-C0` stress deterministic | 0.000000 |
| `C6-C0` tiny symbolic | 0.000000 |
| `C7-C0` all tasks | -0.083333 |

Paired task-level analysis against `C0`:

| condition | n | success delta | baseline-only wins | condition-only wins | exact p |
|---|---:|---:|---:|---:|---:|
| `C3` | 12 | 0.000000 | 0 | 0 | 1.000000 |
| `C4` | 12 | -0.333333 | 4 | 0 | 0.125000 |
| `C6` | 12 | 0.000000 | 0 | 0 | 1.000000 |
| `C7` | 12 | -0.083333 | 1 | 0 | 1.000000 |

These p-values are descriptive only. With 12 tasks, the pilot is underpowered; the directional pattern matters more than significance.

## Stress-Class Result

| condition | stress success rate | stress calls |
|---|---:|---:|
| `C0` | 0.500000 | 6 |
| `C3` | 0.500000 | 18 |
| `C4` | 0.000000 | 12 |
| `C6` | 0.500000 | 13 |
| `C7` | 0.333333 | 18 |

This stress subset is the most informative part of the pilot. The model failed several exact arithmetic and string-manipulation tasks, but the current loop implementation did not reliably recover from those failures.

## Concrete Failure Observations

Self-reflection can corrupt correct answers:

| task | condition | first answer | final answer | result |
|---|---|---|---|---|
| `M1` | `C4` | `10` | `8` | correct to wrong |
| `ST1` | `C4` | `6202_foorp_pool_b4M` | `6202_foorp_pool-b4M` | correct to wrong |
| `ST2` | `C4` | `8-17-29` | `8-13-29` | correct to wrong |
| `ST5` | `C4` | `A` | `E` | correct to wrong |

Weak verification can select a wrong answer even when a correct candidate exists:

| task | condition | selected | hidden candidate set |
|---|---|---|---|
| `ST1` | `C7` | `6202_fpoorp_pool_b4M` | two wrong candidates, then one correct candidate |

Pass/fail verifier feedback was too weak for several stress tasks:

| task | expected | final `C6` answer | observation |
|---|---|---|---|
| `ST3` | `876` | `1619` | repeated modular arithmetic failure |
| `ST4` | `299` | `289` | arithmetic recomputation drift |
| `ST6` | `anfuli` | `lgnb` | prime-position extraction failure |

## Interpretation Against The Thesis

The absolute thesis, "LLM agent work must be loop-based because of LLM nature," is too strong as stated.

The pilot supports the refined thesis:

1. One-shot inference can saturate on short or easy deterministic tasks.
2. Repetition alone is not enough; `C3` and `C6` did not beat `C0` in this tiny run.
3. Self-reflection alone is unsafe; it can move a correct answer into an incorrect attractor.
4. A weak verifier is not a substitute for a good loop; it can select plausible wrong answers.
5. A grounded loop needs actionable feedback, tool access, state control, or tests that expose useful error structure. Pass/fail alone did not repair the hardest failures here.

This is exactly the conditional claim boundary needed for a paper:

> Loop-based agent structure is mathematically and engineering-motivated for long-horizon, externally checkable, partially observable tasks, but its benefit is conditional on verifier quality, feedback actionability, state control, and cost. It is not a universal consequence of next-token prediction alone.

## Methodological Caveats

1. The pilot is tiny: 12 tasks, one model, one run.
2. The tasks are synthetic and exact-answer based, not full software or research-agent tasks.
3. `C3` and `C7` use sampling while `C0`, `C4`, and `C6` are deterministic, by design. This separates candidate diversity from deterministic loop feedback, but it also means each contrast answers a different sub-question.
4. `C6` received only rejection-style verifier feedback. It did not receive executable tools, intermediate test traces, retrieval, scratchpad editing, or a calculator.
5. The exact-answer verifier is reliable for these tasks, but not representative of open-ended research quality.

## Research Consequence

The pilot weakens a naive "more loop is always better" claim and strengthens a more defensible control-theoretic claim:

```text
loop value = f(task horizon, uncertainty, verifier reliability, feedback actionability, state control, cost)
```

For the next empirical layer, `C6` should be upgraded from pass/fail feedback to real agent affordances:

1. code tasks with unit-test failure output,
2. arithmetic/symbolic tasks with calculator or Python tool access,
3. research tasks with retrieval and citation verification,
4. long-horizon tasks with explicit state ledger and rollback,
5. paired statistical analysis across at least 100 tasks per class.

## Commands

```sh
npm run m4b:tiny-pilot:check
npm run m4b:tiny-pilot:dry-run
npm run m4b:tiny-pilot:run
npm run m4b:tiny-pilot:analyze
jq .summary data/M4b-agent-loop-necessity-tiny-pilot-results.json
python3 -m py_compile scripts/m4b_tiny_pilot_runner.py
```
