# Blog Post Outline

Working title:
**LLM Agent는 왜 Loop가 되는가: 정답은 “반복”이 아니라 “폐루프 제어”다**

Alternative titles:

1. **LLM Agent Loop는 필연인가?**
2. **Self-Reflection은 Verifier가 아니다**
3. **좋은 Agent Loop의 네 가지 조건**

## Intended Reader Promise

이 글을 읽고 나면 독자는 “LLM agent는 loop여야 한다”라는 문장을 더 정교하게 말할 수 있어야 한다.

Before:

> LLM은 확률적으로 토큰을 생성하니, agent는 반드시 반복해야 한다.

After:

> LLM의 one-shot generation은 task utility, 외부 관찰, 상태 회수, 독립 검증을 내장하지 않는다. 따라서 장기·외부검증·부분관측 과제에서는 verifier, actionable feedback, tool access, state control을 갖춘 폐루프 구조가 필요해진다. 단, 짧고 낮은 위험의 과제에서는 one-shot으로 충분할 수 있고, 약한 loop는 오히려 나빠질 수 있다.

## Narrative Arc

### 1. Hook: “Loop”라는 단어가 너무 많은 일을 하고 있다

- 요즘 agent를 설명할 때 “plan-act-reflect”, “observe-think-act”, “self-correct” 같은 loop 그림이 흔하다.
- 이 그림은 틀린 것은 아니지만, 종종 원인을 잘못 설명한다.
- 문제는 “반복”이 아니다. 문제는 one-shot LLM call에 빠져 있는 control surface다.

### 2. The tempting but overstrong thesis

- 흔한 주장: LLM은 next-token generator이고 softmax 기반이므로 긴 작업에서는 오류가 쌓인다. 따라서 agent는 반드시 loop여야 한다.
- 방향은 맞지만 세 가지 이유로 과하다:
  1. decoding은 항상 stochastic sampling이 아니다.
  2. low-probability token이 곧 오류는 아니다.
  3. 반복한다고 task utility가 자동으로 좋아지지 않는다.

### 3. The stronger mathematical core

- Autoregressive LM은 `P(y_t | x, y_<t)`를 준다.
- Greedy token choice는 sequence-level optimum도 보장하지 않는다.
- sequence-level likelihood optimum도 task utility optimum이 아니다.
- 따라서 핵심은 “확률이라서 틀린다”가 아니라 “모델의 decoding objective와 우리가 원하는 task objective가 다르다”이다.

### 4. Why loops appear in real agents

- 장기 agent 작업은 텍스트 생성만이 아니다.
- 파일을 바꾸고, 테스트를 돌리고, 검색하고, API를 호출하고, 이전 결정을 되돌린다.
- 이 세계에서는 loop가 자연스럽다:
  `state -> model action -> tool/environment -> observation -> verifier -> state update`
- 하지만 이것은 “반복”이 아니라 feedback-control/search system이다.

### 5. The tiny pilot that broke the naive story

- 12개 synthetic deterministic task, `gpt-5.4-mini`, 5개 조건.
- 결과:
  - one-shot: 0.75
  - best-of-n + strong verifier: 0.75
  - self-reflection: 0.416667
  - pass/fail verifier loop: 0.75
  - weak-verifier stress: 0.666667
- 해석:
  - loop structure alone did not help.
  - self-reflection moved correct answers to wrong answers.
  - weak verifier selected plausible wrong answers.
  - pass/fail feedback was too weak for hard symbolic repairs.

### 6. The four control surfaces

The post’s central framework:

1. **Verifier**: final output or intermediate state is actually checked.
2. **Actionable feedback**: the agent receives useful error structure, not just “wrong.”
3. **Tool access**: the loop can observe reality outside the model distribution.
4. **State control**: the system can branch, rollback, record assumptions, and prevent context drift.

### 7. A practical architecture sketch

- Weak loop:
  `answer -> self-critique -> answer`
- Better loop:
  `generate -> act with tools -> verify -> produce diagnostic feedback -> update/rollback state -> retry under budget`
- Best loop is not infinite iteration. It is cost-normalized, stop-rule-aware, and stateful.

### 8. What this means for builders

- Do not ask “is my agent loop-based?”
- Ask:
  1. What is the verifier?
  2. What feedback does it produce?
  3. What tools can change the model’s information state?
  4. What state can be rolled back?
  5. What is the stopping rule?
- For coding agents: tests and diffs matter more than reflection prose.
- For research agents: retrieval provenance and citation checks matter more than confidence.
- For planning agents: state ledger and environment observations matter more than a longer plan.

### 9. Final claim boundary

Use the publishable thesis:

> Loop-based LLM agents are conditionally necessary for reliable long-horizon, externally grounded work because one-shot autoregressive decoding lacks global task-utility search, environmental feedback, reliable state revision, and verification. This conditional necessity weakens for short, deterministic, low-risk tasks and fails when loops lack informative feedback or robust state management.

### 10. Closing

- The right question is not “Do agents need loops?”
- The right question is “What closes the loop?”
- A loop without a verifier is just more text.
- A loop with tools, diagnostic feedback, and state control starts to look like engineering.
