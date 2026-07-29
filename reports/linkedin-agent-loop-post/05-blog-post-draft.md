# LLM Agent Loop는 언제 필요한가

부제: 반복이 아니라 폐루프 제어로 봐야 하는 이유

요약:

LLM agent를 이야기할 때 우리는 너무 쉽게 “loop”라는 단어를 쓴다. 하지만 loop라는 말은 너무 많은 것을 한꺼번에 가린다. self-reflection도 loop이고, unit test를 돌리는 coding agent도 loop이고, browser로 근거를 확인하는 research agent도 loop다. 이들을 같은 단어로 묶으면 중요한 차이가 사라진다.

좋은 질문은 “agent가 loop인가?”가 아니다. 좋은 질문은 “무엇이 loop를 닫고 있는가?”다.

내 결론은 이렇다.

> LLM agent loop는 모든 작업에 필요한 보편 구조가 아니다. 하지만 신뢰성이 중요한 장기·외부검증·부분관측 작업에서는 조건부로 구조적 필요성이 생긴다. 이유는 softmax가 마법처럼 실패를 강제해서가 아니라, one-shot generation에는 검증, 외부 관찰, 수정 가능한 피드백, 상태 회수 장치가 없기 때문이다.

더 짧게 말하면 이렇다.

> verifier 없는 loop는 그냥 더 많은 텍스트다.  
> tool, diagnostic feedback, state control이 붙을 때 비로소 engineering이 된다.

## 1. “Loop”라는 말이 너무 많은 일을 하고 있다

요즘 LLM agent 그림을 보면 거의 항상 화살표가 원을 그린다.

```text
plan -> act -> observe -> reflect -> plan ...
```

또는 이렇게 말한다.

```text
think -> tool -> observation -> revise ...
```

이 그림은 틀리지 않았다. 실제로 쓸 만한 agent는 대개 반복한다. 코딩 agent는 파일을 읽고, 패치를 만들고, 테스트를 돌리고, 실패 로그를 보고, 다시 패치한다. 리서치 agent는 검색하고, 문서를 열고, 인용을 확인하고, 주장을 고친다. 운영 자동화 agent는 API를 호출하고, 상태를 확인하고, 실패하면 rollback한다.

그런데 “반복한다”는 사실만으로는 별로 설명한 것이 없다.

나쁜 loop도 반복한다. 같은 모델에게 “다시 생각해 봐”라고 말하는 것도 반복이다. 틀렸다는 말만 던져주고 다시 답하게 하는 것도 반복이다. 정답 후보가 셋 있는데, 빈 문자열이 아닌 첫 번째 답을 고르는 것도 반복이다.

이런 loop는 우리가 원하는 의미의 agent engineering이 아니다. 그저 한 번 더 텍스트를 생성한 것이다.

그래서 “LLM agent는 loop여야 한다”라는 문장은 반만 맞다. 더 정확한 문장은 이렇다.

> 신뢰성이 중요한 장기 작업에서는 agent가 폐루프 제어 시스템처럼 행동해야 한다. 이때 핵심은 반복 횟수가 아니라 verifier, actionable feedback, tool access, state control의 품질이다.

이 글은 그 차이를 설명한다.

## 2. “softmax라서 loop가 필연”이라는 설명은 약하다

LLM은 이전 토큰과 context를 보고 다음 토큰의 확률분포를 낸다. 대략 이런 형태다.

```text
P(y_t | x, y_<t)
```

그래서 다음과 같은 설명이 자주 나온다.

> LLM은 확률적으로 토큰을 생성한다. 긴 작업에서는 낮은 확률의 이상한 토큰이 언젠가 나온다. 그러므로 agent는 반드시 loop로 고쳐야 한다.

직관은 이해된다. 나도 처음에는 이 설명이 꽤 매력적이라고 생각했다. 긴 작업에서는 작은 오류가 누적되고, 초반의 잘못된 선택이 뒤의 방향을 바꾸며, 한 번 생성된 context는 다음 생성에 영향을 준다.

하지만 이 설명은 논문이나 설계 원칙으로 쓰기에는 너무 거칠다.

첫째, 배포된 decoding이 항상 stochastic sampling은 아니다. greedy decoding, constrained decoding, temperature 0, top-k, top-p 같은 정책은 tail event를 잘라낼 수 있다.

둘째, low-probability token이 곧 오류는 아니다. 어떤 문제에서는 낮은 확률의 경로가 오히려 정답일 수 있다. 창의적 사고나 수학적 우회로는 초반에 그럴듯하지 않아 보일 수 있다.

셋째, 반복이 task utility를 자동으로 높이지 않는다. 같은 편향을 가진 후보를 여러 개 만들거나, 약한 verifier로 그럴듯한 오답을 선택하면 반복은 비용만 늘린다.

따라서 더 강한 설명은 “확률이라서 언젠가 틀린다”가 아니다.

더 강한 설명은 이것이다.

> LLM의 기본 decoding objective와 우리가 원하는 task objective가 다르다.

이 차이가 loop를 공학적으로 필요하게 만든다.

## 3. 세 개의 목적함수는 같지 않다

LLM agent loop를 제대로 이해하려면 세 층위를 분리해야 한다.

첫 번째는 token objective다.

```text
P(y_t | x, y_<t)
```

모델은 현재 prefix에서 다음 token의 분포를 낸다.

두 번째는 sequence objective다.

```text
P(y_1:T | x)
```

한 문장이나 답변 전체의 likelihood다.

세 번째는 task utility다.

```text
U(output, state, cost, risk)
```

우리가 실제로 원하는 값이다. 정답 여부, 테스트 통과, 안전성, 비용, 지연 시간, side effect, 인용 정확성 같은 것이 여기에 들어간다.

이 셋은 같지 않다.

token greedy decoding은 sequence-level optimum도 보장하지 않는다. 아주 작은 예를 들 수 있다.

```text
P(A | x) = 0.6
P(B | x) = 0.4
P(C | x, A) = 0.5
P(D | x, B) = 1.0
```

greedy는 먼저 A를 고르고, 그 다음 C를 고른다. 전체 확률은 0.30이다. 하지만 B 다음 D로 가면 전체 확률은 0.40이다. 즉 각 시점의 local best가 전체 sequence의 best를 보장하지 않는다.

하지만 더 중요한 점은 따로 있다. 설령 sequence likelihood를 완벽히 최적화한다고 해도, 그것이 task utility의 최적화는 아니다.

번역에서 가장 높은 모델 점수를 받은 문장이 사람이 보기에 좋은 번역이 아닐 수 있다. 코딩에서 그럴듯한 패치가 hidden test를 통과하지 못할 수 있다. 리서치에서 유창한 단락이 실제 citation을 잘못 연결할 수 있다.

그러므로 LLM agent 설계의 핵심 문제는 이것이다.

```text
model score != task utility
```

loop가 유용해지는 이유는 무작위 오류를 씻어내기 위해서가 아니다. task utility를 더 잘 근사하는 외부 선택, 검증, 관찰, 수정 절차를 넣기 위해서다.

## 4. 텍스트 생성 문제는 어느 순간 시스템 문제가 된다

짧은 질문에는 one-shot이 충분할 수 있다.

```text
prompt -> answer
```

예를 들어 단순 요약, 낮은 위험의 분류, 형식 변환, 이미 모델이 거의 확실히 아는 짧은 답변은 굳이 agent loop를 붙이지 않아도 된다. loop는 비용과 latency를 만든다. 필요 없는 곳에 loop를 붙이면 architecture astronaut가 되기 쉽다.

하지만 agent 작업은 금방 다른 문제가 된다.

```text
state
-> model action
-> tool/environment
-> observation
-> verifier
-> state update
```

코딩 agent는 repository state를 바꾼다. 파일을 수정하고, 테스트를 돌리고, 실패 로그를 읽고, diff를 정리한다.

리서치 agent는 외부 문서를 확인한다. 검색 결과를 열고, 문장을 인용하고, source가 실제로 claim을 지지하는지 확인한다.

운영 agent는 환경을 바꾼다. API를 호출하고, 상태를 확인하고, 실패하면 rollback해야 한다.

이 시점부터 agent는 단순한 text generator가 아니다. 제한된 budget 안에서 관찰하고, 선택하고, 검증하고, 상태를 업데이트하는 bounded feedback-control/search system에 가까워진다.

그렇다면 loop라는 단어보다 더 중요한 질문이 생긴다.

> 어떤 신호가 다음 행동을 바꾸는가?

이 질문에 답하려면 네 개의 control surface를 봐야 한다.

## 5. 작은 pilot이 보여준 것: 증명이 아니라 경고등

이 주장을 확인하기 위해 작은 파일럿을 하나 돌려봤다. 이 실험은 publication-grade evidence가 아니다. 표본은 작고, synthetic deterministic task 12개, 모델 하나, 실행 한 번이다. 통계적 결론을 내기에는 부족하다.

그래도 실패 모드를 보여주는 경고등으로는 유용했다.

조건은 다섯 개였다.

| 조건 | 설명 | 성공률 |
|---|---|---:|
| C0 | one-shot | 0.75 |
| C3 | best-of-n + strong verifier | 0.75 |
| C4 | self-reflection | 0.416667 |
| C6 | pass/fail verifier loop | 0.75 |
| C7 | weak-verifier stress | 0.666667 |

이 숫자에서 “loop는 효과 없다” 같은 결론을 끌어내면 안 된다. 이 실험은 너무 작다.

하지만 세 가지 경고는 분명했다.

첫째, 이 설정에서는 loop structure alone이 one-shot보다 나은 결과를 만들지 못했다.

둘째, self-reflection은 independent verifier처럼 행동하지 않았다. 몇몇 경우에는 첫 답이 맞았는데, reflection 뒤의 답이 틀렸다.

셋째, weak verifier는 그럴듯한 오답을 걸러내지 못했다. 정답 후보가 뒤에 있어도, 앞의 plausible wrong answer가 선택될 수 있었다.

여기서 중요한 교훈은 loop가 나쁘다는 것이 아니다.

중요한 교훈은 이렇다.

> loop의 단위는 “반복”이 아니라 “신호의 품질”이다.

## 6. 좋은 agent loop의 네 가지 control surface

### 6.1 Verifier: 무엇을 맞다고 판정하는가?

verifier는 측정과 선택의 신호다. 어떤 출력이나 중간 상태가 task objective에 가까운지 판정한다.

예를 들면:

- unit test
- compiler error
- exact-answer check
- theorem checker
- retrieval citation check
- human review
- reward model

좋은 verifier는 세 가지 성질을 가져야 한다.

첫째, 충분히 독립적이어야 한다. 같은 모델에게 “내 답이 맞아?”라고 묻는 것은 verifier가 아니라 echo에 가깝다.

둘째, 오류율이 낮거나 최소한 calibration되어야 한다. false positive가 많으면 loop는 그럴듯한 오답을 강화한다.

셋째, task utility의 proxy로 정렬되어야 한다. visible test만 통과하고 hidden test를 망치는 agent는 verifier를 최적화했을 뿐, 과제를 해결한 것이 아니다.

verifier가 없으면 loop는 유창한 답을 더 많이 만들 뿐이다.

### 6.2 Actionable feedback: 무엇을 어떻게 고쳐야 하는가?

verifier가 판정이라면 actionable feedback은 수정 가능한 오류 구조다.

“틀렸다”는 feedback이 아니다. 그것은 rejection signal이다. 다음 시도를 어디로 옮겨야 할지 알려주지 않는다.

좋은 feedback은 이런 형태다.

- expected vs actual diff
- failing assertion
- stack trace
- counterexample
- violated constraint
- missing citation
- source does not support claim
- type error
- regression test name

coding agent에게 “테스트 실패”라고만 말하는 것과 “`test_user_can_reset_password`에서 expected 302, got 500; null token path에서 exception”이라고 말하는 것은 완전히 다르다.

전자는 다시 찍어보라는 말이다. 후자는 수리할 위치를 준다.

### 6.3 Tool access: 모델 바깥 현실을 관찰하거나 바꿀 수 있는가?

tool access는 모델의 information state를 바꾼다.

LLM은 prompt 안의 정보로 답한다. tool은 prompt 밖의 세계를 관찰하게 한다.

예를 들면:

- 테스트 실행
- 코드 실행
- 계산기
- 데이터베이스 query
- 브라우저
- API call
- grep/search
- static analyzer

tool이 없으면 agent는 내부 guess를 재활용한다. tool이 있으면 guess를 현실에 부딪혀 볼 수 있다.

여기서 중요한 것은 tool이 많다는 사실이 아니다. 어떤 tool이 모델의 잘못된 가정을 반증할 수 있는지가 중요하다.

### 6.4 State control: 무엇을 기억하고, 버리고, 되돌릴 수 있는가?

state control은 agent loop에서 가장 과소평가되는 부분이다.

좋은 loop는 단순히 context를 길게 가져가지 않는다. 무엇을 state로 인정할지, 누가 그 state를 소유할지, 언제 commit할지, 어디까지 rollback할 수 있을지 정한다.

실무적으로는 이런 질문이다.

- requirement ledger는 어디에 있는가?
- 어떤 assumption이 검증되었고 어떤 것은 가설인가?
- memory write에는 provenance가 있는가?
- patch는 branch로 격리되는가?
- 실패 시 rollback 단위는 파일인가, commit인가, database transaction인가?
- tool side effect는 reversible한가?
- loop는 언제 멈추는가?

state control이 없으면 early mistake가 context drift가 된다. 더 나쁘면 실제 환경의 side effect가 된다.

## 7. 약한 loop와 강한 loop

약한 loop는 대개 이렇게 생겼다.

```text
answer -> self-critique -> revised answer
```

이 구조가 항상 나쁘다는 뜻은 아니다. 간단한 문장 다듬기나 빠른 sanity check에는 도움이 될 수 있다. 하지만 이것을 verifier라고 부르면 안 된다.

강한 loop는 다르게 생겼다.

```text
generate candidate
-> act with tools
-> observe result
-> verify against a calibrated utility proxy
-> produce diagnostic feedback
-> update or rollback state
-> stop when utility/cost frontier says stop
```

여기에는 몇 가지 중요한 차이가 있다.

첫째, 외부 관찰이 있다.

둘째, 판정 신호가 있다.

셋째, 다음 행동을 바꾸는 diagnostic feedback이 있다.

넷째, state ownership과 rollback boundary가 있다.

다섯째, 종료 조건이 있다.

강한 loop는 무한 반복이 아니다. 정보 흐름이 좋은 반복이다.

## 8. Agent를 만들 때 물어야 할 질문

agent 설계 리뷰에서 “loop가 있나요?”라고 묻는 것은 너무 약한 질문이다.

대신 이렇게 물어야 한다.

1. verifier는 정확히 무엇인가?
2. verifier는 task utility의 좋은 proxy인가?
3. feedback은 diagnostic한가, 아니면 pass/fail뿐인가?
4. 어떤 tool이 모델의 가정을 반증할 수 있는가?
5. state ledger는 누가 소유하는가?
6. memory write에는 provenance가 있는가?
7. rollback 단위는 무엇인가?
8. irreversible side effect는 어떻게 막는가?
9. stopping rule은 무엇인가?
10. success, latency, cost, risk를 어떤 utility로 trade off하는가?

도메인별로 바꾸면 더 선명해진다.

coding agent라면 self-reflection prose보다 test output, diff, rollback이 중요하다.

research agent라면 confidence보다 citation provenance와 source-grounded verification이 중요하다.

planning agent라면 더 긴 plan보다 assumption ledger와 environment observation이 중요하다.

customer-support agent라면 친절한 답변보다 policy verifier, escalation rule, audit log가 중요하다.

## 9. 언제 loop가 필요 없거나 해로운가

loop는 공짜가 아니다.

loop가 필요 없는 경우가 있다.

- 짧은 정보 추출
- deterministic formatting
- 낮은 위험의 classification
- 이미 one-shot이 포화된 과제
- 외부 상태를 바꾸지 않는 간단한 질의

loop가 해로운 경우도 있다.

약한 verifier는 false positive를 만든다. 틀린 답을 맞다고 판정하면, loop는 오답을 더 자신 있게 밀어붙인다.

상관된 후보는 best-of-n을 약하게 만든다. 같은 사고 경로에서 나온 후보 셋은 독립적인 후보 셋이 아니다.

proxy가 잘못되면 reward hacking이 생긴다. visible test만 통과하거나, citation 형식만 맞추거나, confidence 표현만 좋아지는 식이다.

tool side effect가 irreversible하면 재시도가 위험해진다. 운영 환경에서 잘못된 API call을 반복하는 agent는 똑똑한 것이 아니라 위험하다.

stopping rule이 없으면 loop는 비용을 먹는다. 더 긴 reasoning이 항상 더 좋은 것은 아니다. 어느 순간부터는 utility보다 latency와 cost가 더 빨리 오른다.

state control이 없으면 context가 오염된다. 틀린 가정이 “이미 확인된 사실”처럼 다음 prompt에 남는다.

그러므로 좋은 agent engineering은 “loop를 붙이자”가 아니다.

좋은 agent engineering은 이렇게 묻는다.

> 어떤 feedback이 어떤 state를 어떻게 바꾸는가?

## 10. 결론: 무엇이 loop를 닫는가

LLM agent loop는 우연히 등장한 UI 패턴이 아니다. 장기 작업에서 자주 필요해지는 구조적 이유가 있다.

하지만 그 이유는 “LLM이 확률적이기 때문”만은 아니다.

더 정확히는 이렇다.

one-shot generation은 다음 token 또는 sequence likelihood를 다룬다. 우리가 원하는 것은 task utility다. 둘 사이에는 간극이 있다. 장기 과제에서는 그 간극이 외부 관찰, 검증, 수리, rollback, 비용 관리의 문제로 커진다.

그래서 loop가 필요해진다.

다만 아무 loop나 되는 것은 아니다.

verifier 없는 loop는 더 많은 텍스트다.

actionable feedback 없는 loop는 같은 벽에 다시 부딪히는 일이다.

tool access 없는 loop는 내부 추측의 재활용이다.

state control 없는 loop는 실수를 history로 굳히는 장치다.

반대로 이 네 가지가 갖춰지면 agent loop는 훨씬 더 공학적인 물건이 된다. 모델이 생각을 더 많이 하는 것이 아니라, 시스템이 더 좋은 신호를 이용해 다음 행동을 바꾼다.

마지막 문장은 이것으로 충분하다.

> 좋은 agent loop는 반복이 아니라 폐루프 제어다.  
> 무엇이 loop를 닫는지가 성능을 결정한다.

## Sources and Further Reading

- Yoshua Bengio et al., “A Neural Probabilistic Language Model,” 2003.
- Ashish Vaswani et al., “Attention Is All You Need,” 2017.
- Ari Holtzman et al., “The Curious Case of Neural Text Degeneration,” 2019.
- Felix Stahlberg and Bill Byrne, “On NMT Search Errors and Model Errors,” 2019.
- Bryan Eikema and Wilker Aziz, “Sampling-Based Approximations to Minimum Bayes Risk Decoding,” 2021.
- Xuezhi Wang et al., “Self-Consistency Improves Chain of Thought Reasoning in Language Models,” 2022.
- Shunyu Yao et al., “ReAct: Synergizing Reasoning and Acting in Language Models,” 2022.
- Shunyu Yao et al., “Tree of Thoughts,” 2023.
- Noah Shinn et al., “Reflexion: Language Agents with Verbal Reinforcement Learning,” 2023.
- Hunter Lightman et al., “Let’s Verify Step by Step,” 2023.
- Jie Huang et al., “Large Language Models Cannot Self-Correct Reasoning Yet,” 2023.
- John Yang et al., “SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering,” 2024.
- Charlie Snell et al., “Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters,” 2024.

Note:
The small pilot described above is intentionally presented as a cautionary case, not as a publication-grade empirical result. It is useful because it shows how easily “loop” can be confused with “better feedback.”
