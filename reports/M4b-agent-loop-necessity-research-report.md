# M4b Agent Loop Necessity Research Report

Date: 2026-05-27
Status: research draft
Scope: mathematical and engineering evaluation of the claim that LLM agents must operate as loops because of LLM structure

## Executive Verdict

The user's core intuition is directionally right, but the strongest wording needs to be narrowed.

한국어로 요약하면 다음과 같다.

1. 원 아이디어의 핵심은 맞다. LLM의 one-shot decoding은 과제 효용의 전역 최적화가 아니며, 장기 agent 작업에서 feedback/search/verification loop가 구조적으로 필요해지는 과제군이 있다.
2. 다만 "모든 LLM agent 작업은 반드시 loop여야 한다"는 보편명제는 반례가 많다. 짧은 분류, 단순 추출, 형식 변환, 낮은 위험의 deterministic task는 one-shot으로 충분할 수 있다.
3. "softmax이므로 긴 실행에서 저확률 토큰이 반드시 나온다"는 설명은 약하다. decoding policy가 greedy이거나 truncation을 쓰면 tail event는 발생하지 않을 수 있고, 저확률 토큰이 곧 오류인 것도 아니다.
4. 더 강한 논지는 "자기회귀적 국소 생성은 task utility, 환경 피드백, state revision, verifier를 내장하지 않으므로, 장기·개방형·부분관측·외부검증 과제에서는 loop가 조건부로 필연화된다"이다.

The defensible thesis is not:

> Every LLM agent task must be loop-based because low-probability tokens will inevitably appear.

The defensible thesis is:

> Autoregressive LLMs generate locally conditioned trajectories and do not, by default, optimize arbitrary task utility, revise committed state, search globally, or ground themselves in external observations. Therefore, for long-horizon, open-ended, partially observable, externally verifiable tasks, an LLM agent is structurally better modeled as a bounded feedback-control and search system than as a one-shot generator. Loop-based generate-evaluate-act-revise structures are not universally necessary or sufficient, but they are a principled engineering response to the mismatch between next-token generation and task-level optimization.

That conditional version is well supported by current literature. It is also more publishable because it avoids three overclaims:

1. Softmax distributions do not imply stochastic decoding in every deployment.
2. Low-probability token occurrence is not the same thing as error occurrence.
3. A loop improves reliability only when it has useful feedback, verification, search diversity, rollback, and state management.

## Paper-Style Abstract

This report evaluates the claim that LLM agents must operate through iterative loops because of the intrinsic structure of large language models. We separate three ideas that are often conflated: autoregressive next-token modeling, stochastic sampling, and agentic feedback control. The mathematical analysis shows that token-level greedy decoding is not equivalent to sequence-level maximum a posteriori decoding, and neither objective is generally equivalent to task-utility maximization. Long-horizon failure accumulation can be formalized with hazard-style assumptions, but it does not follow merely from softmax probabilities. The engineering review shows that successful LLM agents repeatedly use loops because real tasks require search, external observation, verification, repair, and memory management. Evidence from self-consistency, Tree of Thoughts, verifier-guided reasoning, ReAct, SWE-agent, MemGPT, and recent test-time scaling work supports a conditional thesis: loop-based architectures are structurally justified for long-horizon, open-ended, partially observable, externally verifiable tasks. However, loops are not universally necessary or sufficient. They can fail under weak feedback, correlated samples, verifier error, context drift, and high cost. The publishable conclusion is therefore conditional structural necessity rather than universal necessity.

## Operational Definitions

To make the thesis testable, the following terms should be fixed before any experiment.

| term | operational definition |
|---|---|
| one-shot decoding | A single model call that returns a final answer without externally observed intermediate feedback changing the subsequent generation process. It may use greedy, sampled, beam, or constrained decoding. |
| loop-based agent | A system that repeatedly executes at least two of: candidate generation, external action, observation, verification, memory/state update, rollback, or revision. |
| task utility | A pre-declared score over output and environment state, such as correctness, safety, cost, latency, side effects, and hidden-test success. |
| verifier | A signal used to choose, reject, or revise candidates. It may be deterministic tests, compiler output, retrieval evidence, a theorem checker, a reward model, an LLM judge, or human feedback. |
| long-horizon task | A task whose success depends on multiple intermediate commitments, tool calls, files, memory states, or environment observations. |
| conditional structural necessity | A design necessity that follows under stated task and reliability assumptions, not a logical necessity across all possible LLM uses. |

The report uses `loop` broadly, but a publishable empirical paper should record the exact loop policy:

```text
loop_policy = {
  generator,
  action_space,
  observation_space,
  verifier,
  state_update_rule,
  rollback_rule,
  stopping_rule,
  budget
}
```

Without these fields, "loop-based" is too vague to test.

## Claim Decomposition

| original claim | verdict | correction |
|---|---|---|
| LLMs define next-token probabilities from prior context. | supported | More precisely, an autoregressive LM factorizes sequence probability as `P(y_1:T | x) = product_t P(y_t | x, y_<t)`. |
| Every token is probabilistically generated by softmax. | partially supported | The model defines a softmax distribution, but the decoding policy can be deterministic: greedy, constrained decoding, or temperature 0. |
| A one-shot output is not guaranteed to be the global optimum. | supported | Define the objective. Greedy decoding does not guarantee sequence-level MAP, and sequence-level MAP does not guarantee task-utility optimum. |
| Early wrong tokens can strongly steer later generation. | supported with caveats | In a single autoregressive trajectory, prefixes condition later tokens. However, attention can deweight earlier tokens, and an agent harness can branch, discard, summarize, or roll back state. |
| In very long runs, low-probability tokens must appear. | overstrong | This needs assumptions: sampling with support, nonzero conditional hazard, and no truncation. It fails under greedy decoding or top-k/top-p policies that remove the event. |
| Therefore LLM agents must be loop-based. | overstrong as universal claim | Stronger form: long-horizon, open-ended, partially observable, externally checkable agent tasks have a structural need for feedback/search loops if reliability matters. |

## Mathematical Core

The deterministic appendix for this section is `reports/M4b-agent-loop-necessity-math-appendix.md`. It is generated from the standard-library script `scripts/m4b_loop_math_demo.py`, which writes `data/M4b-agent-loop-necessity-math-demo.json`.

### 1. Autoregressive decoding is local

For a prompt `x` and output `y_1:T`, the language model gives:

```text
P_theta(y_1:T | x) = product_{t=1..T} P_theta(y_t | x, y_<t)
```

Greedy decoding selects:

```text
y_t = argmax_v P_theta(v | x, y_<t)
```

This is a local decision rule. It is not, in general, the same as:

```text
argmax_y P_theta(y | x)
```

A minimal counterexample:

```text
P(A | x) = 0.6
P(B | x) = 0.4
P(C | x,A) = 0.5
P(D | x,B) = 1.0
```

Greedy chooses `A` then `C`, giving sequence probability `0.30`. The non-greedy path `B D` has sequence probability `0.40`. Thus local argmax can miss even the model's own sequence-level optimum.

But even sequence-level MAP is not the same as solving the task. If task utility is `U(x, y)`, the task objective is:

```text
y* = argmax_y U(x, y)
```

The model typically decodes by likelihood or a heuristic surrogate, not by directly optimizing `U`. This distinction is central. The claim should be about a mismatch between model likelihood and task utility, not about a vague "global minimum."

Stahlberg and Byrne's exact-search result in neural machine translation is a useful warning: the global best model score can be a degenerate output, so better search over model likelihood can reveal model-objective pathology rather than solve the task. Holtzman et al. similarly show that likelihood-oriented decoding can produce low-quality repetitive text. Eikema and Aziz motivate MBR-style expected-utility decoding as an alternative to pure mode seeking.

### 2. Long horizons accumulate risk only under explicit assumptions

The user's long-run argument can be made precise. Let `E_t` be the event that step `t` makes a harmful commitment. Then:

```text
P(any harmful commitment by T) = 1 - P(no harmful commitment by T)
```

If events are conditionally independent and each has probability at least `epsilon > 0`, then:

```text
P(any harmful commitment by T) >= 1 - (1 - epsilon)^T
```

This approaches 1 as `T` grows.

However, this is not a universal theorem about LLMs. It requires a nonzero lower bound on harmful events under the actual decoding policy. Greedy decoding can make some low-probability events impossible. Top-k and top-p sampling can truncate tails. A "low-probability token" can also be correct, creative, or necessary. The rigorous version is therefore a horizon-risk claim, not a tail-token inevitability claim.

### 3. Loop/search improves expected utility when feedback is informative

If one independent candidate succeeds with probability `p` and a perfect verifier can recognize success, then `n` candidates succeed with probability:

```text
1 - (1 - p)^n
```

More generally, for candidate utilities `U(Y_i)`, adding candidates cannot reduce the oracle best-of-n utility:

```text
E[max(U(Y_1), ..., U(Y_n))] is nondecreasing in n
```

This is the cleanest mathematical reason that loops can help: they convert inference-time compute into approximate search over output trajectories. But the result depends on candidate diversity and verifier quality. If candidates are highly correlated or the verifier is wrong, repetition can plateau or make things worse.

### 4. Propositions that can be defended

The research claim becomes much stronger when split into narrow propositions.

**Proposition 1: local decoding mismatch.**
For a nontrivial autoregressive distribution, token-level greedy decoding does not generally recover the sequence-level MAP output.

Evidence type: constructive counterexample, as above.

**Proposition 2: model-objective mismatch.**
Even exact optimization of `P_theta(y|x)` does not generally optimize task utility `U(x,y,s)`.

Evidence type: model-error/search-error literature, MBR decoding literature, task-specific counterexamples.

**Proposition 3: horizon-risk accumulation.**
If an agent has a nonzero lower-bounded probability of unrepaired harmful commitment at each step, and if dependence assumptions do not eliminate accumulation, then the probability of at least one harmful commitment increases with horizon.

Evidence type: hazard model plus empirical failure logs. This is not a theorem about low-probability tokens by itself.

**Proposition 4: verifier-conditioned loop benefit.**
If candidate generation has nonzero probability of producing a high-utility output and the verifier selects high-utility candidates better than chance, repeated generation plus selection can improve expected utility over a single attempt.

Evidence type: best-of-n, self-consistency, verifier-guided math, code-test-debug, theorem proving, and test-time scaling experiments.

**Proposition 5: loop non-sufficiency.**
If feedback is uninformative, verifier error is high, candidates are strongly correlated, or revision introduces side effects, additional loop iterations may fail to improve or may reduce utility.

Evidence type: self-correction failures, reward-model plateaus, visible-test overfitting, context drift.

These propositions avoid the brittle universal claim while preserving the core insight: loops arise because raw autoregressive generation lacks built-in global utility search, grounding, and repair.

## Engineering Synthesis

### Why agent loops appear again and again

In a nontrivial agent task, the LLM is not only producing text. It is choosing actions, receiving observations, updating state, and deciding whether to continue. This is naturally a closed loop:

```text
state -> prompt/context -> model action -> environment/tool/test -> observation -> updated state
```

This loop compensates for four missing mechanisms in a raw one-shot decoder.

| missing mechanism in one-shot generation | loop mechanism |
|---|---|
| No global search over plans or outputs | sampling, beam/tree/graph search, best-of-n |
| No environmental correction | tool calls, tests, browser/API observations |
| No reliable state revision | branch, rollback, memory rewrite, context summarization |
| No independent quality signal | verifier, compiler, unit tests, retrieval, human feedback |

ReAct is a direct example: reasoning traces update action plans while actions gather external information. Reflexion adds a trial-feedback-reflection memory loop. Toolformer shows API results can be incorporated into later prediction. WebGPT uses browsing and reference collection. SWE-agent and SWE-bench show that real software tasks require repository navigation, edits, execution, logs, and re-edits. MemGPT adds memory/context management as an operating-system-like loop. Voyager combines environment feedback, execution errors, self-verification, and an accumulating skill library.

The 2025 survey literature points in the same direction. Luo et al. organize LLM agents around methodology, architecture, collaboration, evolution, evaluation, tool applications, and challenges. Cao et al.'s planning survey explicitly separates external-module augmented methods, finetuning with feedback signals, and searching-based methods that decompose tasks or navigate planning spaces. This matters because "agent loop" is no longer just an implementation habit: the field's taxonomies increasingly treat planning, tool use, memory, feedback, and search as core agent design dimensions.

### Why this is not just accidental engineering

The loop is not merely a UI pattern. It follows from the mismatch between:

1. The base model's local next-token distribution.
2. The task's long-horizon utility.
3. The partial observability of real environments.
4. The availability of external feedback after actions.

For a one-shot model call, all latent decisions are compressed into a single forward trajectory. For an agent loop, the system can expose intermediate states to verification and correction. This makes the procedure closer to approximate search or feedback control than to pure text continuation.

### Why loop is not sufficient

Looping can fail. Huang et al. report that intrinsic self-correction without external feedback can degrade reasoning. SWE-bench shows that real-world software tasks remain difficult even with advanced models. Repeated sampling scales best in domains with automatic verifiers; without reliable selection, majority voting and reward models can plateau. Long loops can also create context bloat, stale memory, test overfitting, plan churn, and non-idempotent tool side effects.

Recent test-time scaling work reinforces both sides of the argument. Step-level verifier-guided hybrid scaling suggests that fine-grained process verification can extend reasoning performance, but the method's value comes from verifier-guided allocation, not from repetition alone. T1-style tool-integrated self-verification also supports the distinction between ungrounded self-critique and tool-grounded checking: when verification requires calculation or factual memory, external tools can reduce the burden on the model's internal memory. Domain-specific self-feedback studies in retrieval-augmented QA likewise show why "the model critiques itself" should be separated from "the system receives independent evidence."

Thus "loop" is not the causal ingredient by itself. The causal ingredients are:

1. diverse candidate generation,
2. informative feedback,
3. reliable verification,
4. state reset or rollback,
5. budget-aware stopping,
6. memory hygiene,
7. task decomposition with explicit intermediate checks.

## Multidisciplinary Critique

### Mathematics and optimization

The user's strongest mathematical point is the non-equivalence between local token argmax, sequence-level likelihood, and task-level optimality. This can be defended with small counterexamples and supported by decoding literature.

The weak point is the universal inevitability argument. A theorem of the form "bad low-probability tokens must appear" requires a definition of badness, a stochastic decoding policy, support assumptions, and horizon assumptions. It is better to state an increasing hazard result under specified conditions.

### Control and RL

In control terms, one-shot prompting is open-loop control: the controller commits without measuring the result. Agent operation is closed-loop control: actions are followed by observations and corrective action. Closed-loop control is not always necessary, but for uncertain environments and long horizons it is the default reliable design.

In RL terms, the agent-environment interface is inherently iterative: observe, act, receive feedback, update state. LLMs used as policies inherit this requirement when the task is interactive, not because softmax alone logically forces it.

### Software engineering

Coding agents make the loop especially concrete. A patch is not reliable because the LLM wrote plausible text; it becomes more reliable when the system runs tests, reads compiler/runtime failures, inspects files, and revises. This is why code agents converge toward edit-test-debug loops.

The failure mode is visible-test overfitting. A loop that optimizes only the visible harness can produce brittle patches. For publication, this motivates held-out tests, mutation tests, human review, or independent validators.

### Cognitive science and philosophy

The human analogy is useful but should not be overloaded. Humans also solve hard tasks through iterative deliberation, external memory, experiments, and error correction. But this is an analogy, not a proof. The publishable claim should be operational: loops improve outcomes under specific task and feedback conditions.

Bounded rationality is the better bridge. Since neither humans nor LLM agents can exhaustively search the solution space, both rely on satisficing, decomposition, heuristics, external artifacts, and verification.

This does not make the LLM cognitively human-like. It only supports a weaker and cleaner analogy: under bounded compute, systems facing large search spaces benefit from staged search, external memory, and feedback.

## Revised Thesis For A Paper

### Strong Korean version

LLM agent의 loop 기반 구조는 단순한 공학적 관습이 아니라, 자기회귀 언어모델의 국소 생성 과정이 과제 효용의 전역 최적화, 환경 피드백 반영, 상태 수정, 검증을 기본적으로 제공하지 않는다는 구조적 한계를 보완하기 위한 설계 원리다. 다만 이 명제는 모든 LLM 사용에 대한 논리적 필연성이 아니라, 장기적이고 개방형이며 부분관측적이고 중간 산출물을 외부적으로 검증할 수 있는 과제군에 대한 조건부 필연성으로 제한되어야 한다.

### Strong English version

Loop-based LLM agents are not merely an accidental engineering convention. They are a structurally justified response to the mismatch between autoregressive local generation and long-horizon task utility under partial observability. For tasks with verifiable intermediate signals, iterative generate-evaluate-act-revise procedures provide bounded approximate search, environmental grounding, and state repair. However, loops are neither universally necessary nor sufficient; their benefit depends on task decomposability, feedback quality, verifier reliability, candidate diversity, memory hygiene, and compute budget.

## Proposed Research Hypotheses

| id | hypothesis | expected evidence |
|---|---|---|
| H-loop-1 | One-shot decoding does not optimize task utility for long-horizon tasks. | Greedy/sample/beam baselines underperform search or verifier-guided methods at equal or recorded compute. |
| H-loop-2 | Feedback quality moderates loop benefit. | External tests/tools/verifiers outperform intrinsic self-reflection when both use the same base model. |
| H-loop-3 | Horizon length increases the value of loop structure. | Loop advantage grows with number of required intermediate decisions, repository size, or environment steps. |
| H-loop-4 | Looping without reliable selection can plateau or regress. | Repetition with weak self-evaluation shows diminishing returns, overfitting, or answer degradation. |
| H-loop-5 | State-management quality is an independent factor. | Branch/rollback/summarization/memory hygiene ablations change success rate and error propagation. |

## Threats To Validity

| threat | why it matters | mitigation |
|---|---|---|
| Task-selection bias | Loop methods look better if only long, decomposable tasks are selected. | Include short deterministic tasks as negative controls. |
| Verifier leakage | A verifier may encode benchmark-specific shortcuts or visible-test overfitting. | Use hidden tests, independent validators, or adversarial held-out tasks. |
| Candidate correlation | Best-of-n assumptions weaken when samples share the same systematic mistake. | Measure diversity across plans, intermediate states, and final answers. |
| Cost confounding | A larger loop budget may simply spend more compute than the baseline. | Report Pareto frontiers over success, cost, latency, and risk. |
| Self-critique illusion | Natural-language reflection can sound plausible without adding evidence. | Separate intrinsic self-critique from external tests/tools/retrieval/human feedback. |
| Context drift | Long loops can dilute requirements or preserve stale assumptions. | Use explicit state records, requirement checklists, and rollback points. |
| Memory corruption | Bad summaries can become persistent false state. | Track provenance and require verification before long-term memory writes. |
| Non-idempotent actions | Tool loops may cause irreversible side effects. | Use sandboxing, dry-runs, transaction logs, and explicit commit gates. |
| Overclaiming mathematical necessity | "Must loop" can be falsified by trivial one-shot tasks. | State the conditional task class and reliability target. |

## Publication-Ready Claim Boundary

The paper should not claim:

> LLMs are stochastic, therefore bad tokens inevitably appear, therefore every agent must loop.

The paper can claim:

> For long-horizon tasks with external state and verifiable intermediate outcomes, one-shot autoregressive decoding is an open-loop approximation to a sequential decision problem. Loop-based agents implement bounded search and feedback control over model-generated trajectories. Under informative feedback and manageable costs, this structure can improve expected task utility and reduce unrepaired error propagation.

This boundary matters because it makes the thesis falsifiable. A study can then ask where loop benefit appears, where it disappears, and which feedback channels are responsible.

## Suggested Experiment Design

1. Define task families by horizon: short extraction/classification, medium reasoning, long software or web tasks.
2. Compare four inference regimes under fixed budgets:
   - one-shot greedy or deterministic decoding,
   - one-shot sampling,
   - repeated sampling with verifier,
   - full agent loop with tool/test feedback and rollback.
3. Separate verifier types:
   - no verifier,
   - self-critique only,
   - LLM judge,
   - external deterministic verifier such as tests, compiler, theorem checker, retrieval citation check.
4. Measure:
   - task success,
   - cost and latency,
   - number of generated tokens,
   - number of tool calls,
   - context length,
   - regression rate after revision,
   - hidden or held-out test success where possible.
5. Report effect by horizon and feedback quality, not only global average.

The strongest empirical prediction is not "loops always win." It is:

> Loop advantage is largest when the task has long horizon, decomposable intermediate states, and reliable external feedback. Loop advantage shrinks or reverses when tasks are short, feedback is weak, candidates are correlated, or loop overhead dominates.

## Minimal Acceptance Criteria For A Publishable Study

Before submission, the project should produce at least:

1. A formal task taxonomy separating short deterministic tasks, medium reasoning tasks, and long-horizon interactive tasks.
2. A pre-declared loop policy schema with generator, verifier, state update, rollback, stopping rule, and budget.
3. Baselines for one-shot greedy, one-shot sampling, repeated sampling with verifier, and full tool/test feedback loops.
4. Cost-normalized and latency-normalized comparisons, not just maximum accuracy.
5. Negative controls where loops are expected not to help.
6. Ablations that remove external feedback, rollback, memory, and verifier components separately.
7. Failure analysis covering context drift, verifier error, test overfitting, and memory corruption.
8. A claim-boundary section explicitly rejecting universal necessity.

The preregistration-style version of this plan is recorded in `reports/M4b-agent-loop-necessity-study-protocol.md` with a machine-readable manifest in `data/M4b-agent-loop-necessity-study-protocol.json`.

A deterministic protocol preflight is recorded in `reports/M4b-agent-loop-necessity-pilot-preflight-report.md`. It validates the analysis shape only and should not be cited as real LLM evidence.

A tiny real-provider pilot is recorded in `reports/M4b-agent-loop-necessity-tiny-pilot-report.md`, with results in `data/M4b-agent-loop-necessity-tiny-pilot-results.json`. It found no accuracy lift from the tested loop conditions over one-shot on 12 synthetic deterministic tasks; `C0`, `C3`, and `C6` all reached 0.75 success, while self-reflection dropped to 0.416667 and weak verification dropped to 0.666667. This does not settle the thesis, but it sharply supports the claim boundary: loop structure is not sufficient by itself; the loop needs actionable feedback, reliable verification, tool access, and state control.

## Bottom Line

The original idea becomes strong when reframed from an absolute claim into a conditional structural claim.

It is true that LLMs are not global optimizers of task utility. It is true that early commitments can shape later generation. It is true that long-horizon agent work needs mechanisms for search, verification, correction, and state management. And it is true that modern LLM agent systems repeatedly rediscover loop structures for those reasons.

But it is not true that softmax sampling alone proves every LLM agent must loop, nor that low-probability tokens must appear in every long run, nor that loop structure guarantees optimality. The publishable thesis is therefore "conditional structural necessity": for reliable long-horizon agentic work, loop-based feedback/search is the principled architecture, while one-shot generation is a special case suitable only when the task is short, fully specified, low-risk, or already solved by the model's default distribution.

## Sources

- Bengio et al., [A Neural Probabilistic Language Model](https://jmlr.org/papers/v3/bengio03a.html), JMLR, 2003.
- Vaswani et al., [Attention Is All You Need](https://arxiv.org/abs/1706.03762), 2017.
- Holtzman et al., [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751), 2019.
- Stahlberg and Byrne, [On NMT Search Errors and Model Errors: Cat Got Your Tongue?](https://aclanthology.org/D19-1331/), EMNLP-IJCNLP, 2019.
- Eikema and Aziz, [Sampling-Based Approximations to Minimum Bayes Risk Decoding for Neural Machine Translation](https://arxiv.org/abs/2108.04718), 2021.
- Wang et al., [Self-Consistency Improves Chain of Thought Reasoning in Language Models](https://arxiv.org/abs/2203.11171), 2022.
- Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629), 2022.
- Schick et al., [Toolformer: Language Models Can Teach Themselves to Use Tools](https://arxiv.org/abs/2302.04761), 2023.
- Shinn et al., [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366), 2023.
- Yao et al., [Tree of Thoughts: Deliberate Problem Solving with Large Language Models](https://arxiv.org/abs/2305.10601), 2023.
- Lightman et al., [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050), 2023.
- Nakano et al., [WebGPT: Browser-assisted question-answering with human feedback](https://arxiv.org/abs/2112.09332), 2021.
- Cobbe et al., [Training Verifiers to Solve Math Word Problems](https://arxiv.org/abs/2110.14168), 2021.
- Huang et al., [Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798), 2023.
- Packer et al., [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560), 2023.
- Jimenez et al., [SWE-bench: Can Language Models Resolve Real-World GitHub Issues?](https://arxiv.org/abs/2310.06770), 2023.
- Yang et al., [SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering](https://arxiv.org/abs/2405.15793), 2024.
- Brown et al., [Large Language Monkeys: Scaling Inference Compute with Repeated Sampling](https://arxiv.org/abs/2407.21787), 2024.
- Snell et al., [Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters](https://arxiv.org/abs/2408.03314), 2024.
- Kang et al., [T1: Tool-integrated Self-verification for Test-time Compute Scaling in Small Language Models](https://arxiv.org/abs/2504.04718), 2025.
- Wang et al., [Voyager: An Open-Ended Embodied Agent with Large Language Models](https://arxiv.org/abs/2305.16291), 2023.
- Luo et al., [Large Language Model Agent: A Survey on Methodology, Applications and Challenges](https://arxiv.org/abs/2503.21460), 2025.
- Cao et al., [Large Language Models for Planning: A Comprehensive and Systematic Survey](https://arxiv.org/abs/2505.19683), 2025.
- Chang et al., [Step-level Verifier-guided Hybrid Test-Time Scaling for Large Language Models](https://arxiv.org/abs/2507.15512), 2025.
- [Can Language Models Critique Themselves? Investigating Self-Feedback for Retrieval Augmented Generation at BioASQ 2025](https://arxiv.org/abs/2508.05366), 2025.
- Åström and Murray, [Feedback Systems: An Introduction for Scientists and Engineers](https://fbswiki.org/wiki/index.php/Feedback_Systems:_An_Introduction_for_Scientists_and_Engineers), 2021.
- Sutton and Barto, [Reinforcement Learning: An Introduction](https://web.stanford.edu/class/psych209/Readings/SuttonBartoIPRLBook2ndEd.pdf), 2018.
- Simon, [A Behavioral Model of Rational Choice](https://cooperative-individualism.org/simon-herbert_a-behavioral-model-of-rational-choice-1955-feb.pdf), 1955.
