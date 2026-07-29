# Blog Post Outline v2

Title:
**LLM Agent Loop는 언제 필요한가: 반복이 아니라 폐루프 제어로 봐야 하는 이유**

Subtitle:
**Self-reflection은 verifier가 아니고, pass/fail은 actionable feedback이 아니다. 좋은 agent loop는 네 개의 control surface를 갖춘다.**

## Reader Promise

이 글은 “LLM agent는 loop여야 한다”라는 유행어를 더 쓸모 있는 엔지니어링 문장으로 바꾼다.

Bad version:

> LLM은 확률적으로 토큰을 생성하니 긴 작업에서는 반드시 loop가 필요하다.

Better version:

> 장기·외부검증·부분관측 과제에서 one-shot LLM call은 task utility, 외부 관찰, 상태 회수, 독립 검증을 내장하지 않는다. 그러므로 신뢰성이 중요하면 verifier, actionable feedback, tool access, state control을 갖춘 폐루프 구조가 필요해진다.

Boundary:

- short deterministic task에서는 one-shot이 충분할 수 있다.
- loop는 충분조건이 아니다.
- 약한 verifier, 빈약한 feedback, 상태 drift가 있으면 loop는 더 나빠질 수 있다.

## 1. Hook: “Loop”라는 말이 가리는 것

- 요즘 agent 글에는 거의 항상 loop 그림이 나온다.
- 문제는 그림이 아니라 해석이다.
- loop라는 단어는 반복 횟수, self-reflection, tool use, verifier, memory, rollback을 한 덩어리로 묶어버린다.
- 이 글의 질문:
  - “agent가 loop인가?”가 아니라
  - “무엇이 loop를 닫고 있는가?”

## 2. Overclaim: softmax라서 loop가 필연이라는 설명은 약하다

Explain carefully:

- LLM은 next-token distribution을 낸다.
- 하지만 deployment decoding은 항상 stochastic sampling이 아니다.
- low-probability token이 곧 error는 아니다.
- long run에서 위험이 누적된다는 주장은 별도의 hazard assumption이 있어야 한다.
- 따라서 “확률적 생성이라서 loop”가 아니라 “task objective와 model objective가 달라서 control surface가 필요”하다고 말해야 한다.

## 3. Mathematical core: 세 개의 목적함수는 같지 않다

Step-by-step:

1. Token objective:
   `P(y_t | x, y_<t)`
2. Sequence objective:
   `P(y_1:T | x)`
3. Task utility:
   `U(output, state, cost, risk)`

Key claims:

- token-greedy decoding은 sequence MAP도 보장하지 않는다.
- sequence MAP도 task utility optimum이 아니다.
- 그러므로 반복의 이유는 “무작위 오류 제거”가 아니라 “task utility를 근사할 외부 선택·검증·수정 절차”다.

## 4. System shift: 텍스트 생성 문제가 아니라 시스템 문제가 된다

One-shot call:

```text
prompt -> answer
```

Agent task:

```text
state -> model action -> tool/environment -> observation -> verifier -> state update
```

Why this matters:

- coding agent는 repository, test, diff, error log를 다룬다.
- research agent는 retrieval, citation, provenance를 다룬다.
- planning agent는 assumptions, environment change, rollback을 다룬다.
- 이 순간 agent는 문장 생성기가 아니라 bounded feedback-control/search system이 된다.

## 5. Tiny pilot: 증명이 아니라 경고등

Positioning:

- This is a tiny pilot, not publication-grade evidence.
- 12 synthetic deterministic tasks, one model, one run.
- Use it as a cautionary example, not as proof.

Observed results:

- `C0` one-shot: 0.75
- `C3` best-of-n + strong verifier: 0.75
- `C4` self-reflection: 0.416667
- `C6` pass/fail verifier loop: 0.75
- `C7` weak-verifier stress: 0.666667

Safe interpretation:

- loop structure alone did not improve accuracy in this setup.
- self-reflection did not behave like an independent verifier.
- weak verification failed to filter plausible wrong answers.
- pass/fail feedback lacked enough diagnostic structure for several repairs.

## 6. The four control surfaces

### 6.1 Verifier: 무엇이 맞고 틀렸는지 판정하는가?

Definition:
Verifier is a measurement/selection signal.

Examples:
- unit tests,
- compiler errors,
- exact answer checks,
- theorem checker,
- retrieval citation check,
- human review.

Failure if missing:
The loop keeps producing fluent text without knowing whether utility improved.

### 6.2 Actionable feedback: 무엇을 어떻게 고쳐야 하는지 알려주는가?

Definition:
Actionable feedback is error structure that can guide the next state update.

Examples:
- failing assertion,
- expected vs actual diff,
- counterexample,
- citation gap,
- test trace,
- violated constraint.

Failure if missing:
“Wrong” only says reject; it does not say repair.

### 6.3 Tool access: 모델 바깥 현실을 관찰하거나 바꿀 수 있는가?

Definition:
Tool access changes the model’s information state through external action/observation.

Examples:
- run tests,
- execute code,
- query database,
- browse source,
- call API,
- use calculator.

Failure if missing:
The loop can only recycle internal guesses.

### 6.4 State control: 무엇을 기억하고, 버리고, 되돌릴 수 있는가?

Definition:
State control governs assumption ledger, memory writes, branch selection, rollback, and stopping rule.

Examples:
- requirement ledger,
- patch branch,
- rollback boundary,
- memory provenance,
- stop rule,
- budget policy.

Failure if missing:
Early wrong commitments become context drift or side effects.

## 7. Weak loop vs strong loop

Weak loop:

```text
answer -> self-critique -> revised answer
```

Strong loop:

```text
generate candidate
-> act with tool
-> observe result
-> verify against utility proxy
-> produce actionable feedback
-> update or rollback state
-> stop when utility/cost frontier says stop
```

Important:
The strong loop is not “more iterations.” It is better information flow.

## 8. Practical checklist for builders

Ask these before shipping an agent:

1. What exactly is the verifier?
2. Is feedback diagnostic or merely pass/fail?
3. What tool can falsify the model’s guess?
4. Who owns the state ledger?
5. What is the rollback unit?
6. What stops the loop?
7. What metric trades off success, latency, cost, and side effects?

Applied examples:

- Coding agent: unit tests + diff + rollback beat self-reflection prose.
- Research agent: retrieval provenance + citation checks beat confidence.
- Planning agent: assumption ledger + environment observation beat longer plans.

## 9. When a loop is unnecessary or harmful

Unnecessary:

- short extraction,
- deterministic formatting,
- low-risk classification,
- tasks already saturated by one-shot performance.

Harmful:

- weak verifier with high false positives,
- correlated candidates,
- self-reflection without independent signal,
- irreversible tool side effects,
- state drift,
- no stopping rule.

## 10. Closing thesis

Short memorable version:

> A loop without a verifier is just more text.  
> A loop with tools, diagnostic feedback, and state control starts to look like engineering.

Publishable version:

> LLM agent loops are conditionally necessary for reliable long-horizon, externally grounded work. Not because softmax magically forces failure, but because one-shot generation lacks the control surfaces needed to search, observe, verify, repair, and revise state.
