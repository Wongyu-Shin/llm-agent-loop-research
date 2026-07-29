# M4b Parked Empirical Layer Plan

Date: 2026-05-29
Status: parked side-track; not the current priority

## Correction Note

This plan was drafted during an audit detour into the M4b agent-loop artifacts.
It is preserved as a parked side-track, but it is not the current highest
priority for this thread.

The active work should return to the M3/H1 persona and expert-role prompt
analysis track:

1. Use the M3p prior-art scan to keep the role/persona claim boundary clear.
2. Use the M3a GPU first-run outputs as feasibility and record-shape evidence.
3. Start M3b by defining the residual-stream and SAE topology metrics for
   persona/expert-role prompt contrasts.

## Parked Decision

If the project later resumes the M4b agent-loop track, the next useful M4b work
would be to upgrade the tiny pilot into a preregistered, tool-afforded
experiment that can test whether loop value appears when the loop has
actionable feedback, external tools, and state control.

That M4b priority would follow from the audit result:

1. The project is already honest about claim boundaries.
2. The deterministic simulation is pipeline validation, not empirical evidence.
3. The real tiny pilot did not show an advantage for loop conditions over
   one-shot.
4. The current `C6` loop only received rejection-style verifier feedback, so it
   did not test the stronger agent-loop claim.
5. The largest remaining risk is an empty positive empirical layer, not a lack
   of explanation.

## Why This Is Parked

`M3b` is the natural next step for the H1 representation-topology track, and
`M4a` is the natural next step for the original H2-H6 roadmap. But the audit was
about the cloud/GPU and M4b evidence stack. In that stack, the most important
gap is clear: the project can defend its honesty, but it cannot yet defend the
positive empirical side of the M4b thesis.

That remains useful later, but it should not displace the active persona prompt
analysis work.

## Scope

The next empirical layer should test this narrowed claim:

> Loop advantage is expected only when the task has enough horizon and
> uncertainty for feedback to matter, and when the loop receives independent,
> actionable observations such as unit-test output, calculator/Python results,
> retrieval evidence, citation checks, or explicit state rollback.

It should not test the universal claim that all LLM tasks need loops.

## Workstreams

### 0. Roadmap And Label Cleanup

Goal: remove the current M4b naming mismatch before adding more artifacts.

Tasks:

1. Decide whether `M4b` is now the agent-loop necessity track or whether this
   work should move to a separate milestone id.
2. Update `milestone.md` so the milestone label, status, and deliverables match
   the actual artifacts.
3. Add an explicit note that the current M4b tiny pilot is null evidence for the
   tested loop policies, not H2-H6 token-optimization evidence.

Done when:

1. `milestone.md` no longer describes M4b only as a relaxation-family or
   discrete-token optimization map while pointing to agent-loop artifacts.
2. The roadmap distinguishes H1/M3 GPU feasibility work from M4b agent-loop
   empirical work.

### 1. Preregister The V2 Empirical Protocol

Goal: freeze the next experiment before seeing results.

Required artifacts:

1. `reports/M4b-agent-loop-necessity-v2-protocol.md`
2. `data/M4b-agent-loop-necessity-v2-manifest.json`

Protocol decisions to freeze:

1. Task classes: short exact-answer negative controls, medium reasoning,
   code-repair with unit tests, tool-checkable arithmetic/symbolic tasks,
   retrieval/citation tasks, and at least one long-horizon stateful task class.
2. Conditions: one-shot, sampled best-of-n with strong verifier, self-reflection,
   pass/fail verifier loop, tool-afforded full loop, and weak-verifier stress.
3. Ablations: tool without state ledger, state ledger without actionable tool
   feedback, and strong verifier without revision when feasible.
4. Budgets: max model calls, max tool calls, max wall time, and max generated
   tokens per condition.
5. Metrics: raw success, cost-normalized success, latency-normalized success,
   success per model call, success per 1k generated tokens, and failure taxonomy.
6. Claim boundary: no H1/H2-H6 general claim from this run; this is M4b
   agent-loop evidence only.

Done when:

1. Every condition has a machine-readable loop policy.
2. Every task class has a replayable verifier or scoring rubric.
3. Every success metric and contrast is predeclared.
4. The protocol explicitly states what result would weaken the thesis.

### 2. Build A Tool-Afforded Runner

Goal: make `C6` a real agent loop rather than pass/fail retry.

Runner capabilities:

1. Unit-test tool for code tasks, returning exact failing test names and output.
2. Python/calculator tool for arithmetic and symbolic tasks.
3. Retrieval and citation-check tool for research tasks.
4. State ledger with separate fields for facts, hypotheses, tool observations,
   rejected candidates, and final answer.
5. Rollback policy that can restore the best verified state.
6. Structured trajectory logging for every model call, tool call, verifier
   result, rollback, and final selection.

Required artifacts:

1. `scripts/m4b_v2_runner.py`
2. `scripts/m4b_v2_analyze.py`
3. `data/M4b-agent-loop-necessity-v2-smoke.json`
4. `data/M4b-agent-loop-necessity-v2-dry-run.json`

Done when:

1. Dry-run can replay every condition without network access.
2. Tool outputs are recorded as observations, not silently folded into prompts.
3. The runner can resume after partial failure without corrupting prior rows.
4. The analyzer recomputes all predeclared contrasts from raw rows.

### 3. Build And Audit The Task Suite

Goal: avoid a benchmark that accidentally favors loops or one-shot baselines.

Initial target:

1. 20 tasks per class for smoke and runner validation.
2. At least 100 tasks per class before claiming publishable empirical evidence.

Task requirements:

1. Each task must be replayable across all conditions.
2. The verifier must be independent of the generation path where possible.
3. Expected answers, hidden tests, or rubrics must be separated from visible
   feedback.
4. Tool tasks must expose actionable failure information to `C6`, not just
   pass/fail.
5. Negative controls must remain in the suite so loop overhead can be measured.

Done when:

1. The task manifest passes schema validation.
2. A fixture audit records leakage, ambiguity, expected difficulty, verifier
   independence, and reset safety for each task.
3. A small dry-run demonstrates that all tools and verifiers work.

### 4. Run The Staged Empirical Study

Goal: spend cloud/API budget only after the protocol and runner are stable.

Stages:

1. Local dry-run: deterministic fixture answers only.
2. Provider smoke: 5 tasks per class, all conditions, one model.
3. Calibration pilot: 20 tasks per class, all conditions, one model.
4. Main run: at least 100 tasks per class, all conditions, predefined seed
   policy.

Stop/go gates:

1. Do not start the main run if dry-run and smoke disagree on schema.
2. Do not start the main run if tool observations are missing from trajectories.
3. Do not promote the result if verifier errors dominate failure labels.
4. Report null or negative results directly if `C6` still fails to beat
   baselines after cost normalization.

### 5. Analyze And Report Without Overclaiming

Goal: turn the run into evidence without weakening the project's honesty.

Required outputs:

1. `data/M4b-agent-loop-necessity-v2-results.json`
2. `data/M4b-agent-loop-necessity-v2-analysis.json`
3. `reports/M4b-agent-loop-necessity-v2-empirical-report.md`

Analysis requirements:

1. Paired contrasts against `C0`.
2. Effects by task class and feedback type, not only global averages.
3. Cost and latency normalization.
4. Failure taxonomy counts.
5. Representative trajectories for success, regression, verifier error, and
   rollback.
6. Explicit distinction between support, null, negative, and inconclusive
   outcomes.

Done when:

1. All reported numbers can be recomputed from raw rows.
2. The report states whether the positive empirical gap is closed, still open,
   or contradicted.
3. Public-facing content uses only the verified empirical claim boundary.

## Immediate Next Session Checklist

The first implementation session should do only the foundation work:

1. Update `milestone.md` or create a new milestone id for this track.
2. Draft `reports/M4b-agent-loop-necessity-v2-protocol.md`.
3. Draft `data/M4b-agent-loop-necessity-v2-manifest.json`.
4. Define the raw row schema for trajectories and tool observations.
5. Add a runner skeleton that can execute deterministic dry-run fixtures.

This keeps the next step small enough to verify, while still moving directly
toward the actual audit gap.

## Completion Criteria For The Priority

This priority is complete only when the project has:

1. A corrected roadmap entry for the M4b agent-loop evidence track.
2. A preregistered v2 protocol and machine-readable manifest.
3. A runner that gives `C6` real tool feedback and state control.
4. A replayable task suite with audited verifiers.
5. A staged empirical run with raw results and recomputable analysis.
6. A report that honestly says whether the positive empirical side is supported,
   null, negative, or still inconclusive.

Until then, M4b should remain labeled as theory plus protocol plus tiny null
pilot, not as confirmed empirical evidence for loop necessity.
