# Why LLM Agents Become Loops: A Conditional Necessity Argument From Autoregressive Decoding To Feedback-Controlled Search

Date: 2026-05-27
Status: paper draft v0.1

## Abstract

This paper draft examines whether LLM agents must operate through loops because of the intrinsic nature of large language models. The original intuition is that autoregressive LLMs generate locally likely next tokens, so a single output cannot be assumed to be a global optimum; as agent horizons grow, errors or unlikely commitments should accumulate, making iterative improvement necessary. We argue that this intuition is directionally correct but overstrong in its universal form. The decisive issue is not that low-probability tokens must inevitably appear, nor that all decoding is stochastic. Rather, autoregressive one-shot decoding optimizes a model-likelihood surrogate and lacks built-in mechanisms for task-utility search, external observation, reliable state revision, rollback, and verification. Therefore, for long-horizon, open-ended, partially observable, externally verifiable tasks, loop-based LLM agents are structurally justified as bounded search and feedback-control systems. This thesis is conditional: loops are not necessary for all tasks and are not sufficient for reliability. Their benefit depends on task decomposability, candidate diversity, feedback quality, verifier reliability, state management, and compute budget. The paper formalizes this claim, reviews evidence from decoding, verifier-guided reasoning, test-time scaling, and agent engineering, and proposes an empirical research design to test where loop structures are beneficial, neutral, or harmful.

## 1. Introduction

Modern LLM agents commonly operate in iterative loops: they plan, call tools, inspect outputs, revise plans, execute code, run tests, search the web, update memory, and repeat. This pattern appears in reasoning systems, software engineering agents, retrieval-augmented generation, web-browsing agents, embodied agents, and test-time scaling methods. The engineering fact is clear. The theoretical question is sharper:

> Is loop-based operation merely an engineering convenience, or does it follow from the structure of autoregressive LLMs when they are used as agents?

The strongest universal answer is false. Some LLM tasks are short, static, low-risk, and adequately solved by one-shot generation. A single deterministic extraction, classification, or formatting task need not become a loop.

The more defensible answer is conditional. LLMs generate locally conditioned trajectories. They do not, by default, optimize arbitrary task utility, observe the external world, revise earlier commitments, or verify intermediate states. When the task is long-horizon and interactive, those missing capabilities become central. A loop is then not just a prompt-engineering habit but a system-level response to the mismatch between next-token generation and sequential task solving.

This draft makes four contributions.

1. It separates autoregressive modeling, stochastic sampling, and agentic feedback control.
2. It states the loop-necessity thesis as a conditional structural claim rather than a universal claim.
3. It collects mathematical and engineering evidence from decoding, search, verification, and agent systems.
4. It proposes falsifiable hypotheses and an experiment design for measuring when loops help.

## 2. Thesis

### 2.1 Overstrong thesis

The following thesis is not defensible:

> Because LLMs sample tokens from softmax distributions, long-running LLM agents will inevitably generate bad low-probability tokens; therefore every LLM agent must operate in a loop.

This fails for several reasons. Decoding can be deterministic. Tail probabilities can be truncated. Low-probability tokens are not necessarily errors. Some tasks are solved adequately in one shot. And loop structure does not guarantee global optimality.

### 2.2 Conditional thesis

The defensible thesis is:

> Autoregressive LLM decoding is a local trajectory-generation procedure that does not generally optimize task utility or include external feedback, state repair, and verification. For long-horizon, open-ended, partially observable, externally verifiable tasks, loop-based LLM agents are structurally justified as bounded feedback-control and search systems. Their necessity is conditional on task class and reliability target, not universal across all LLM uses.

In Korean:

> LLM agent의 loop 기반 구조는 모든 LLM 사용에 대한 논리적 필연성이 아니라, 장기·개방형·부분관측·외부검증 과제에서 자기회귀적 국소 생성이 갖는 과제 효용 최적화 부재, 환경 피드백 부재, 상태 수정 부재, 검증 부재를 보완하기 위한 조건부 구조적 필연성이다.

## 3. Formal Framework

Let `x` be the prompt or current context and `y_1:T` be the generated output. An autoregressive language model defines:

```text
P_theta(y_1:T | x) = product_{t=1..T} P_theta(y_t | x, y_<t)
```

Greedy decoding selects:

```text
y_t = argmax_v P_theta(v | x, y_<t)
```

The agent task, however, is not normally to maximize token likelihood. It is to maximize task utility:

```text
U(x, y, s) = success(x, y, s) - cost(y) - risk(y, s) - side_effects(y, s)
```

where `s` is external state: files, tools, APIs, test results, web pages, user constraints, memory, or environment observations.

The objective mismatch is:

```text
argmax_y P_theta(y | x) != argmax_y U(x, y, s)
```

in general.

A loop-based agent introduces intermediate state and feedback:

```text
s_t -> c_t -> a_t -> o_t -> v_t -> s_{t+1}
```

where:

| symbol | meaning |
|---|---|
| `s_t` | agent/environment state |
| `c_t` | context presented to the model |
| `a_t` | model-generated action, thought, tool call, or candidate output |
| `o_t` | observation from environment/tool/test/user/retrieval |
| `v_t` | verifier or evaluation signal |
| `s_{t+1}` | updated state after commit, rollback, or revision |

The loop is useful only if `o_t` or `v_t` carries information not already captured by the original one-shot context.

## 4. Mathematical Claims

The deterministic reproduction of the calculations in this section is in `scripts/m4b_loop_math_demo.py`, with generated output in `data/M4b-agent-loop-necessity-math-demo.json` and commentary in `reports/M4b-agent-loop-necessity-math-appendix.md`.

### Claim 1: Token-greedy decoding is not sequence-global decoding

Token-level greedy decoding can miss the model's own best sequence.

Example:

```text
P(A | x) = 0.6
P(B | x) = 0.4
P(C | x,A) = 0.5
P(D | x,B) = 1.0
```

Greedy chooses `A C` with probability `0.30`. The non-greedy sequence `B D` has probability `0.40`.

Thus the user's intuition that locally plausible early tokens can foreclose better later paths is mathematically sound.

### Claim 2: Sequence-likelihood optimum is not task-utility optimum

Even if exact search found `argmax_y P_theta(y|x)`, that output need not maximize `U`. Evidence from neural machine translation shows that exact model-score optima can be pathological, such as empty translations under particular model biases. This supports the stronger objective-mismatch framing.

### Claim 3: Long-horizon risk accumulation is conditional

Let `E_t` be an unrepaired harmful commitment at step `t`. If each step has failure probability at least `epsilon` under suitable dependence assumptions:

```text
P(any E_t by T) >= 1 - (1 - epsilon)^T
```

This justifies concern about long-running agents. But it is not a theorem about softmax alone. It requires a defined failure event, a decoding policy, support assumptions, and a hazard model.

### Claim 4: Repeated generation plus verification can improve expected utility

If each candidate has success probability `p` and a verifier can identify success, then `n` independent candidates yield:

```text
P(success among n) = 1 - (1 - p)^n
```

If utilities are observed by an oracle verifier:

```text
E[max_i U(Y_i)] >= E[U(Y_1)]
```

Real systems violate the ideal assumptions. Samples are correlated, verifiers are noisy, and loops cost time and tokens. Still, this gives the mathematical basis for self-consistency, best-of-n, verifier-guided decoding, and test-time scaling.

## 5. Evidence Review

### 5.1 Decoding and objective mismatch

Bengio et al. and Vaswani et al. provide the language-modeling and Transformer background. Holtzman et al. show that likelihood-oriented decoding can degrade text quality. Stahlberg and Byrne distinguish search errors from model errors and show that exact model-score search can reveal pathological model preferences. Eikema and Aziz move toward expected-utility decoding through MBR approximations.

The implication is direct: better optimizing model likelihood is not equivalent to solving the user's task.

### 5.2 Search and verification

Self-consistency samples multiple reasoning paths and marginalizes over answers, showing that a single greedy reasoning path is often not best. Tree of Thoughts extends this into branching, evaluation, and backtracking over thought states. Training verifiers and process-supervised reward models show that candidate generation plus evaluation can improve multi-step reasoning. Large Language Monkeys and test-time compute scaling show that repeated sampling and verifier-guided compute allocation can improve coverage and performance, especially where automatic verification exists.

### 5.3 Agent engineering

ReAct interleaves reasoning and action, so the model can gather observations and update plans. Reflexion uses feedback and episodic memory across trials. Toolformer and WebGPT show the value of external tools and browsing. SWE-bench and SWE-agent make the software loop explicit: inspect, edit, run tests, read errors, revise. MemGPT treats context as a memory-management problem. Voyager shows long-horizon environment learning with curriculum, skill library, execution feedback, and self-verification.

These systems differ, but they share the same structural pattern: the model call is embedded in a larger feedback system.

### 5.4 Limits of looping

Looping is not magic. Huang et al. show that intrinsic self-correction without external feedback can degrade reasoning. Repeated sampling scales best when selection is reliable; without good verifiers, majority voting or reward models can plateau. Coding agents can overfit visible tests. Memory systems can preserve false summaries. Tool loops can create irreversible side effects.

Therefore, the unit of analysis should not be "loop vs no loop" alone. It should be:

```text
loop = generation + feedback + verification + state management + stopping rule
```

## 6. Multidisciplinary Interpretation

### 6.1 Control theory

One-shot generation is analogous to open-loop control: the controller acts without observing the consequences. Agent loops are analogous to closed-loop control: outputs are measured, compared, and corrected. Closed-loop control is not always necessary, but it is the default robust design under uncertainty and disturbance.

### 6.2 Reinforcement learning

Sequential decision-making is naturally framed as agent-environment interaction. If an LLM is used as a policy inside such an environment, the loop requirement comes from the task interface as much as from the LLM itself.

### 6.3 Cognitive science

Human problem solving also uses decomposition, external memory, trial, feedback, and revision. This analogy should be used carefully. It does not imply that LLMs have human metacognition. It only supports a bounded-rationality perspective: under finite compute and large search spaces, staged search and feedback are useful.

## 7. Hypotheses

| id | hypothesis | expected result |
|---|---|---|
| H1 | One-shot decoding under-optimizes long-horizon task utility. | Loop/search/verifier systems outperform one-shot baselines on long-horizon tasks. |
| H2 | Feedback quality moderates loop benefit. | External deterministic feedback beats ungrounded self-critique. |
| H3 | Horizon length moderates loop benefit. | Loop advantage increases with number of intermediate commitments. |
| H4 | Loops can harm under poor verification. | Weak verifiers, correlated samples, or context drift reduce or reverse gains. |
| H5 | State management is an independent causal factor. | Rollback, memory hygiene, and explicit state records improve long-loop reliability. |

## 8. Experiment Design

The preregistered protocol for this design is maintained separately in `reports/M4b-agent-loop-necessity-study-protocol.md` and `data/M4b-agent-loop-necessity-study-protocol.json`. The summary below is the paper-facing version.

A deterministic protocol preflight is recorded in `reports/M4b-agent-loop-necessity-pilot-preflight-report.md`. It is not empirical evidence; it verifies that the planned contrasts can express both loop benefit and negative-control failure cases.

A first tiny real-provider pilot is recorded in `reports/M4b-agent-loop-necessity-tiny-pilot-report.md`. On 12 synthetic deterministic tasks with `gpt-5.4-mini`, one-shot, best-of-n with deterministic selection, and pass/fail verifier-loop conditions all reached 0.75 success. Self-reflection fell to 0.416667, and weak verification fell to 0.666667. This pilot is underpowered, but it is useful as a counterweight to an overstrong thesis: loop structure alone did not improve accuracy, and self-reflection sometimes moved correct answers to wrong answers.

Use a task matrix:

| task class | example | expected loop effect |
|---|---|---|
| short deterministic | extraction, format conversion | small or negative |
| medium reasoning | math, logic, multi-hop QA | positive with verifier/search |
| long software | issue repair, refactor, debugging | positive with tests and rollback |
| long research | source search, synthesis, citation checking | positive with external retrieval and provenance |
| embodied/web | navigation, multi-step environment tasks | positive with observation-action loops |

Compare:

1. one-shot greedy,
2. one-shot sampling,
3. repeated sampling with verifier,
4. self-reflection only,
5. tool/test/retrieval-grounded loop,
6. full loop with rollback and explicit state.

Measure:

1. task success,
2. hidden-test or external-verifier success,
3. cost and latency,
4. token and tool-call count,
5. number of revisions,
6. context growth,
7. regression after revision,
8. side effects.

Report Pareto frontiers rather than a single accuracy number.

## 9. Threats To Validity

| threat | mitigation |
|---|---|
| Task-selection bias | Include negative controls where loops should not help. |
| Verifier leakage | Use hidden tests and independent validators. |
| Sample correlation | Measure diversity of plans and intermediate states. |
| Compute confounding | Match or explicitly report compute budgets. |
| Self-critique illusion | Separate internal reflection from external evidence. |
| Context drift | Use explicit requirement ledgers and rollback. |
| Memory corruption | Require provenance for persistent memory writes. |
| Non-idempotent tools | Use sandboxing, dry-runs, and transaction logs. |

## 10. Conclusion

The original idea is strongest after one correction. LLM agent loops are not forced by the mere existence of softmax probabilities. They are forced conditionally by the mismatch between autoregressive local generation and long-horizon task solving under uncertainty.

The final thesis is:

> Loop-based LLM agents are conditionally necessary for reliable long-horizon, externally grounded work because one-shot autoregressive decoding lacks global task-utility search, environmental feedback, reliable state revision, and verification. This conditional necessity disappears or weakens for short, deterministic, low-risk tasks, and it fails when loops lack informative feedback or robust state management.

This framing preserves the user's core insight while making it mathematically precise, empirically testable, and resistant to obvious counterexamples.

## References

- Bengio et al., [A Neural Probabilistic Language Model](https://jmlr.org/papers/v3/bengio03a.html), JMLR, 2003.
- Vaswani et al., [Attention Is All You Need](https://arxiv.org/abs/1706.03762), 2017.
- Holtzman et al., [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751), 2019.
- Stahlberg and Byrne, [On NMT Search Errors and Model Errors: Cat Got Your Tongue?](https://aclanthology.org/D19-1331/), 2019.
- Eikema and Aziz, [Sampling-Based Approximations to Minimum Bayes Risk Decoding](https://arxiv.org/abs/2108.04718), 2021.
- Wang et al., [Self-Consistency Improves Chain of Thought Reasoning](https://arxiv.org/abs/2203.11171), 2022.
- Yao et al., [ReAct: Synergizing Reasoning and Acting](https://arxiv.org/abs/2210.03629), 2022.
- Yao et al., [Tree of Thoughts](https://arxiv.org/abs/2305.10601), 2023.
- Cobbe et al., [Training Verifiers to Solve Math Word Problems](https://arxiv.org/abs/2110.14168), 2021.
- Lightman et al., [Let's Verify Step by Step](https://arxiv.org/abs/2305.20050), 2023.
- Huang et al., [Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798), 2023.
- Yang et al., [SWE-agent](https://arxiv.org/abs/2405.15793), 2024.
- Snell et al., [Scaling LLM Test-Time Compute Optimally](https://arxiv.org/abs/2408.03314), 2024.
- Luo et al., [Large Language Model Agent: A Survey](https://arxiv.org/abs/2503.21460), 2025.
- Cao et al., [Large Language Models for Planning: A Comprehensive and Systematic Survey](https://arxiv.org/abs/2505.19683), 2025.
- Kang et al., [T1: Tool-integrated Self-verification](https://arxiv.org/abs/2504.04718), 2025.
- Chang et al., [Step-level Verifier-guided Hybrid Test-Time Scaling](https://arxiv.org/abs/2507.15512), 2025.
- Ateia and Kruschwitz, [Can Language Models Critique Themselves?](https://arxiv.org/abs/2508.05366), 2025.
- Åström and Murray, [Feedback Systems](https://fbswiki.org/wiki/index.php/Feedback_Systems:_An_Introduction_for_Scientists_and_Engineers), 2021.
- Sutton and Barto, [Reinforcement Learning: An Introduction](https://web.stanford.edu/class/psych209/Readings/SuttonBartoIPRLBook2ndEd.pdf), 2018.
- Simon, [A Behavioral Model of Rational Choice](https://cooperative-individualism.org/simon-herbert_a-behavioral-model-of-rational-choice-1955-feb.pdf), 1955.
