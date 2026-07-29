# LLM Agent Loop를 폐루프 제어의 렌즈로 읽기

부제: 반복 횟수가 아니라 검증, 피드백, 도구, 상태 제어가 loop를 닫는다

요즘 어디서든 AI agent 이야기를 듣는다.

그런데 AI agent는 기존 LLM 챗봇과 무엇이 다를까?

ChatGPT나 Claude에서 익숙한 기본 경험은 대체로 `prompt -> answer`에 가깝다. 사용자가 묻고 모델이 답한다. 반면 agent형 도구는 목표를 받고, 도구를 호출하고, 결과를 관찰하고, 다시 다음 행동을 고른다.

차이는 모델만이 아니다. agent에는 harness가 붙는다. harness는 LLM을 tool, 권한, 작업 폴더, 실행 환경, evaluator, stop rule과 연결하는 바깥 구조다. 위험한 명령을 권한·샌드박스·확인 절차로 제한할 수 있고, 실행 결과를 다시 context로 돌려보낼 수 있다. 다만 harness가 LLM의 판단을 결정론적으로 완벽히 통제하는 것은 아니다.

loop도 마찬가지다. loop는 agent가 한 번의 답변보다 긴 작업을 맡게 해준다. 그렇다고 성능을 보장하지는 않는다. 사용자가 목표를 주면 agent가 수분에서 수시간 동안 파일을 읽고, 코드를 고치고, 테스트를 돌리고, 실패 로그를 보고, 다시 고친다. 경험은 확실히 달라졌다. 하지만 반복한다고 곧바로 좋아지는 것은 아니다.

이 글의 질문은 그래서 “agent가 loop인가?”가 아니다.

> 무엇이 loop를 닫고 있는가?

여기서 “loop를 닫는다”는 말은 성능 향상을 보장한다는 뜻이 아니다. 관찰, 판정, 피드백, 상태 갱신이 다음 행동에 연결되어 있다는 뜻이다.

모든 LLM task에 agent loop가 필요한 것도 아니다. 짧고 위험이 낮고 외부 상태를 바꾸지 않는 작업에는 one-shot으로 충분할 때가 많다. 다만 신뢰성이 중요하고, 작업이 길고, 외부 관찰·검증·수정·상태 회수가 과제 정의에 들어오는 경우에는 폐루프 설계를 검토할 이유가 생긴다.

더 짧게 줄이면 이렇다.

> 좋은 agent loop는 더 오래 말하는 시스템이 아니다.  
> 더 좋은 신호로 다음 행동을 바꾸는 시스템이다.

## 1. 챗봇과 agent 사이에는 harness와 loop가 있다

먼저 실제 사례를 보자. 챗봇을 한 번 묻고 한 번 답하는 도구로만 봤다면, agent의 loop는 조금 과해 보일 수 있다.

그런데 최근 주목받는 code agent와 research agent 중 상당수는 단발 답변보다 반복 실행에 가깝다.

OpenAI는 Codex CLI의 핵심을 agent loop라고 설명한다. 모델이 tool call을 요청하면 harness가 명령을 실행하고, 그 결과를 다시 prompt에 붙여 모델을 다시 호출한다. 이 과정은 모델이 더 이상 tool call을 내지 않고 사용자에게 답할 때까지 반복된다.

Anthropic의 tool use 문서도 비슷하다. client-side tool을 쓸 때는 애플리케이션이 loop를 돌린다. 모델이 도구 사용을 요청하고, 애플리케이션이 실행 결과를 돌려주고, 모델이 이어서 판단한다.

Claude Code의 `/goal`은 이 패턴을 더 길게 끌고 간다. 사용자가 완료 조건을 주면 Claude는 한 turn을 끝낸 뒤 별도 evaluator로 조건 충족 여부를 확인한다. 아직 끝나지 않았다고 판단되면 다음 turn을 시작한다.

Ralph loop는 이 아이디어를 더 직접적으로 드러낸다. 한 번 prompt를 던지고 끝내는 대신 agent를 반복 실행하고, task tracking, verification, session memory를 붙여 긴 작업을 밀고 간다.

Karpathy의 `autoresearch`도 같은 계열이다. agent가 `train.py`를 수정하고, 5분짜리 훈련을 돌리고, metric을 확인하고, 개선 여부에 따라 유지하거나 버린 뒤 다음 실험으로 넘어간다.

이름을 몰라도 핵심은 같다. loop는 추상 유행어만은 아니다. 적어도 최근 주목받는 여러 agent 제품과 실험적 방법론에서 반복 실행은 중요한 패턴이다.

## 2. 그래도 “loop”라는 말은 너무 많은 것을 가린다

요즘 LLM agent 그림을 보면 거의 항상 화살표가 원을 그린다.

```text
plan -> act -> observe -> reflect -> plan ...
```

또는 이런 식이다.

```text
think -> tool -> observation -> revise ...
```

이 그림이 틀렸다는 말은 아니다. 실제로 쓸 만한 agent는 대개 반복한다. 코딩 agent는 파일을 읽고, 패치를 만들고, 테스트를 돌리고, 실패 로그를 본 뒤 다시 패치한다. 리서치 agent는 검색하고, 문서를 열고, 인용을 확인하고, 주장을 고친다. 운영 자동화 agent는 API를 호출하고, 상태를 확인하고, 실패하면 rollback해야 한다.

하지만 agent가 loop로 움직인다는 사실은 충분한 설명이 아니다.

용어를 먼저 나누면 이렇다.

- 단순 반복: 같은 생성 절차를 다시 실행한다.
- self-critique: 모델이 자기 출력을 다시 읽고 고친다.
- tool-using loop: 외부 도구로 관찰하거나 행동한다.
- closed-loop control: 관찰, 검증, feedback, state update가 다음 행동을 바꾼다.

이 글에서 말하는 loop는 마지막에 가깝다. 모델의 action이 환경이나 state를 바꾸고, observation과 verifier가 그 결과를 읽은 뒤 다음 action을 바꾸는 폐루프 구조다.

여기서 폐루프 제어는 엄밀한 동일시가 아니라 설계 렌즈다. 빌려오는 것은 관찰, 판정, 행동, 상태 갱신이 다음 행동을 바꾼다는 구조다.

나쁜 loop도 반복은 한다. 같은 모델에게 “다시 생각해 봐”라고 말하는 것도 반복이다. 틀렸다는 말만 던져주고 다시 답하게 하는 것도 반복이다. 정답 후보가 여러 개 있어도 빈 문자열이 아닌 첫 번째 답을 고르는 것도 반복이다.

이런 loop는 우리가 원하는 agent engineering이 아니다. 텍스트를 한 번 더 만드는 데 머물기 쉽다.

그래서 “LLM agent는 loop여야 한다”라는 문장은 너무 크다. 이렇게 좁히는 편이 낫다.

> 신뢰성이 중요하고 외부 관찰·검증·수정·상태 회수가 필요한 작업이라면 agent를 폐루프 제어 시스템처럼 검토할 만하다. 핵심은 반복 횟수가 아니라 verifier, actionable feedback, tool access, state control의 품질이다.

## 3. “softmax라서 loop가 필연”이라는 설명은 약하다

LLM은 이전 context를 보고 다음 token의 확률분포를 낸다.

```text
P(y_t | x, y_<t)
```

내가 처음 떠올린 설명은 이랬다.

> LLM은 확률적으로 토큰을 생성한다. 긴 작업에서는 낮은 확률의 이상한 토큰이 언젠가 나온다. 그러므로 agent는 반드시 loop로 고쳐야 한다.

이 문장을 그대로 뒷받침하는 정식 주장을 문헌에서 찾기는 어렵다. 다만 이 직관이 완전히 허공에서 나온 것도 아니다. neural text degeneration 연구는 sampling에서 확률분포의 덜 믿을 만한 tail을 다루는 문제가 있음을 보인다. exposure bias 연구도 autoregressive generation에서 오류가 누적될 수 있음을 다룬다. 긴 작업에서는 작은 오류가 뒤의 방향을 바꾸기도 한다. 한 번 context에 들어간 가정은 다음 생성에 영향을 준다.

하지만 이 설명을 설계 원칙으로 쓰기에는 약하다.

첫 번째 문제는 decoding이다. 배포된 모델이 항상 stochastic sampling으로 동작하는 것은 아니다. greedy decoding, constrained decoding, temperature 0, top-k, top-p 같은 정책은 tail event를 줄이거나 없앨 수 있다. 그래서 “낮은 확률의 token이 언젠가 나온다”는 주장은 sampling policy를 명시할 때만 강해진다. temperature 0에서도 오류는 생기지만, 그 이유는 저확률 token의 출현이라기보다 모델 점수와 과제 효용의 불일치에 가깝다.

두 번째 문제는 낮은 확률의 token을 곧 오류로 보는 습관이다. 어떤 문제에서는 낮은 확률의 경로가 오히려 정답일 수 있다. 수학 문제의 우회로, 창의적 설계, 익숙하지 않은 API 사용법은 초반에 덜 그럴듯해 보인다.

세 번째 문제는 반복 자체를 개선으로 착각하는 것이다. 같은 편향을 가진 후보를 여러 번 만들거나, 약한 verifier로 그럴듯한 오답을 고르면 반복은 비용만 늘린다. best-of-n도 마찬가지다. 후보들이 서로 강하게 상관되어 있거나, 선택기가 과제 효용에 맞게 calibration되어 있지 않거나, signal-to-noise가 낮으면 n을 늘려도 같은 오류군을 더 많이 보게 된다.

내가 보기에 더 강한 설명은 이쪽이다.

> 문제는 확률 그 자체가 아니라 objective mismatch다.

모델이 잘하는 일과 우리가 맡기고 싶은 일이 다르다.

## 4. 세 개의 목적함수는 같지 않다

LLM agent loop를 이해하려면 세 층위를 떼어놓고 봐야 한다.

### 4.1 next-token objective는 local objective다

모델은 현재 prefix에서 다음 token의 분포를 낸다.

```text
P(y_t | x, y_<t)
```

이 목표는 local하다.

### 4.2 token-greedy는 sequence MAP을 보장하지 않는다

문장이나 답변 전체의 likelihood는 다른 문제다.

```text
P(y_1:T | x)
```

각 시점에서 가장 높은 확률의 token을 고른다고 해서 전체 sequence의 확률이 최대가 되는 것은 아니다.

작은 예를 보자.

```text
P(A | x) = 0.6
P(B | x) = 0.4
P(C | x, A) = 0.5
P(D | x, B) = 1.0
```

greedy는 먼저 A를 고르고, 그 다음 C를 고른다. 전체 확률은 0.30이다. 하지만 B 다음 D로 가면 전체 확률은 0.40이다. 매 순간의 best가 전체 sequence의 best를 보장하지 않는다.

### 4.3 sequence likelihood도 task utility가 아니다

그보다 더 중요한 층위가 있다.

우리가 실제로 원하는 것은 보통 task utility, 즉 과제 효용이다.

```text
U(output, state, cost, risk)
```

정답 여부, 테스트 통과, 안전성, 비용, 지연 시간, side effect, 인용 정확성 같은 항목이 여기에 들어간다.

실제 설계에서 목표는 보통 단일 출력의 점수가 아니라 기대 효용 E[U]를 높이는 것이다. verifier는 그 효용을 직접 재는 장치가 아니다. utility proxy, 즉 효용 대리 지표를 제공한다.

거칠게 쓰면 이렇다.

```text
verifier_signal = proxy(U) + noise + bias
```

그래서 verifier 설계의 핵심은 proxy가 무엇을 빠뜨리는지, noise가 얼마나 큰지, decision threshold가 어떤 false positive와 false negative를 만드는지 확인하는 일이다. proxy가 좁으면 loop는 과제를 푸는 대신 proxy를 맞출 수 있다.

sequence likelihood를 완벽히 최적화한다고 해도 task utility가 최대가 되는 것은 아니다.

번역에서 가장 높은 모델 점수를 받은 문장이 사람이 보기에 좋은 번역이 아닐 수 있다. 코딩에서 그럴듯한 패치가 hidden test를 통과하지 못할 수 있다. 리서치에서 유창한 단락이 실제 source를 잘못 인용할 수 있다.

그러니 논리 사슬을 세 단계로 끊어 읽어야 한다.

```text
next-token objective
!= sequence likelihood optimum
!= task utility optimum
```

이 간극이 커질 때 control surface가 문제의 중심이 된다. 다만 여기서 말하는 요구는 모든 과제에 대한 논리적 필연이 아니다. task utility가 중요하고, 그 utility를 모델 내부 점수만으로 충분히 근사할 수 없을 때 생기는 조건부 설계 요구다.

loop가 도움 되는 조건은 무작위 오류를 씻어내는 데서 나오지 않는다. 과제 효용을 더 잘 근사하는 외부 선택, 검증, 관찰, 수정 절차를 넣을 수 있을 때 생긴다.

## 5. 텍스트 생성 문제는 어느 순간 시스템 문제가 된다

짧은 질문에는 one-shot으로 충분할 때가 많다.

```text
prompt -> answer
```

단순 요약, 낮은 위험의 분류, 형식 변환, 모델이 거의 확실히 아는 짧은 답변에는 굳이 agent loop를 붙이지 않아도 된다. loop는 비용과 latency를 만든다. 필요 없는 곳에 붙이면 과설계다.

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

여기서부터 agent는 단순한 text generator가 아니다. 제한된 budget 안에서 관찰하고, 선택하고, 검증하고, 상태를 업데이트하는 feedback-control 또는 search system에 가까워진다.

경계는 이렇게 잡을 수 있다.

| one-shot이 나은 경우 | loop 검토가 필요한 경우 |
|---|---|
| 짧고 낮은 위험 | 길고 실패 비용이 큼 |
| 외부 상태를 바꾸지 않음 | 파일, API, DB, 운영 상태를 바꿈 |
| 모델 내부 지식으로 충분 | 외부 관찰이 필요 |
| 검증 없이도 손실이 작음 | 검증, 복구, audit trail이 필요 |

## 6. Pilot note: 성능 비교가 아니라 실패 모드 관찰

이 글의 아이디어를 점검하려고 작은 파일럿을 하나 돌려봤다. 먼저 한계를 못 박아두자.

이 파일럿으로는 조건 간 우열을 말할 수 없다. 12개 합성 deterministic task, 단일 모델, 단일 run의 underpowered 점검 메모일 뿐이다. 일반적인 agent benchmark도 아니고, 통계적 효과를 추정하기에는 턱없이 부족하다.

그래서 본문에서는 숫자 표를 근거로 쓰지 않겠다. 이 글의 논지는 파일럿 결과가 아니라 objective mismatch와 control surface의 구조 위에 있다. 이 점검 메모가 보여주지 못하는 것은 성능 차이, 일반화 가능성, 특정 loop의 우열이다.

파일럿이 남긴 쓸모는 딱 하나다. 답이 아니라 질문을 남겼다.

- 후보는 충분히 다양한가?
- verifier는 생성 경로와 충분히 독립적인가?
- feedback은 다음 행동을 바꿀 만큼 수리 정보를 주는가?
- state는 검증된 사실과 가설을 나눠 보존하는가?

이 질문들은 실험 결론이 아니다. 설계 리뷰에서 확인해야 할 실패 모드 목록이다.

이것은 “loop가 효과 없다”는 증거도 아니고, 특정 loop가 더 낫다는 증거도 아니다. 작은 실패 로그를 읽고 얻은 경고에 가깝다. 이 메모에서 가져갈 수 있는 문장은 하나뿐이다. 이 설정에서는 loop 구조만으로 성능 향상을 말할 근거가 없었다.

## 7. 좋은 agent loop를 닫는 네 가지 면

먼저 역할을 분리하자.

| 면 | 역할 | 대표 실패 모드 |
|---|---|---|
| verifier | 판정한다 | false positive |
| actionable feedback | 수리 정보를 준다 | pass/fail-only |
| tool access | 외부를 관찰하거나 바꾼다 | 상관된 추측 |
| state control | 저장·복구·중단을 정한다 | 검증되지 않은 가정의 commit |

실무 구현에서는 하나의 컴포넌트가 판정과 오류 메시지를 함께 줄 수 있다. 예를 들어 테스트 러너는 pass/fail도 주고 stack trace도 준다. 그래도 설계 리뷰에서는 둘을 분리해서 봐야 한다. 판정할 수 있다는 것과 고칠 단서를 준다는 것은 다른 능력이다.

### 7.1 Verifier: 판정 신호

verifier는 output이나 intermediate state가 utility proxy, 즉 효용 대리 지표에 맞는지 판정하는 측정 신호다. 경계는 분명하다. verifier는 판정한다. repair 방향을 알려주는 것은 feedback의 역할이다.

예를 들면 이런 것들이다.

- unit test
- compiler error
- exact-answer check
- theorem checker
- retrieval citation check
- human review
- reward model

좋은 verifier에는 조건이 붙는다.

가능한 한 독립적이어야 한다. 같은 모델에게 “내 답이 맞아?”라고 묻는 것은 verifier라기보다 echo에 가깝다.

오류율도 낮아야 한다. 적어도 calibration은 되어 있어야 한다. false positive가 많으면 loop는 틀린 답을 맞다고 믿고 다음 단계로 보낸다.

그리고 task utility의 proxy와 맞아야 한다. visible test만 통과하고 hidden test를 망치는 agent는 과제를 해결한 것이 아니라 verifier를 gaming한 것이다.

실패 모드는 false positive다. 틀린 답을 맞다고 판정하면 loop는 오답을 강화한다. calibration이 무너지면 proxy hacking도 쉬워진다. false negative가 많으면 고칠 필요가 없는 답을 계속 흔들게 된다. verifier가 없으면 반복은 검증 가능한 개선 없이 유창한 답을 더 많이 만들 위험이 크다.

### 7.2 Actionable feedback: 수정 가능한 오류 구조

verifier가 판정이라면 actionable feedback은 다음 행동을 바꾸는 오류 구조다.

“틀렸다”는 feedback이 아니다. 그것은 rejection signal에 가깝다.

좋은 feedback은 이런 정보를 준다.

- expected vs actual diff
- failing assertion
- stack trace
- counterexample
- violated constraint
- missing citation
- source does not support claim
- type error
- regression test name

coding agent에게 “테스트 실패”라고만 말하는 것과 “`test_user_can_reset_password`에서 expected 302, got 500; null token path에서 exception”이라고 말하는 것은 다르다.

전자는 다시 찍어보라는 말이다. 후자는 수리할 위치를 준다. 실패 모드는 pass/fail-only feedback이다. 거절은 할 수 있지만 수리는 못 한다.

### 7.3 Tool access: 외부 관측과 행동

tool access는 모델의 information state를 바꾼다.

LLM은 prompt 안의 정보로 답한다. tool은 prompt 밖의 세계를 관찰하거나 바꾸게 한다.

예를 들면 이런 것들이다.

- 테스트 실행
- 코드 실행
- 계산기
- 데이터베이스 query
- 브라우저
- API call
- grep/search
- static analyzer

tool이 없으면 agent는 내부 guess를 재활용한다. tool이 있으면 guess를 현실에 부딪혀 볼 수 있다. 실패 모드는 상관된 추측이다. 도구 없이 여러 후보를 뽑아도 같은 오류 공간을 맴돌 수 있다.

중요한 것은 tool이 많다는 사실이 아니다. 어떤 tool이 모델의 잘못된 가정을 반증할 수 있는지가 중요하다.

### 7.4 State control: ownership, rollback, stop rule

state control은 agent loop에서 가장 과소평가되는 부분이다. 경계도 분명하다. tool은 외부 세계를 관찰하거나 바꾸고, state control은 그 관찰과 변경을 시스템 안에서 어떻게 보존·폐기·되돌릴지 정한다.

좋은 loop는 context를 길게 가져가는 시스템이 아니다. 좋은 loop는 state의 소유권과 수명 주기를 정한다.

적어도 네 가지는 확인해야 한다.

먼저 state ownership이다. requirement ledger, assumption list, memory, patch branch를 누가 소유하는가?

다음은 memory provenance다. 어떤 memory가 어느 source나 observation에서 왔는가? 검증된 사실인가, 아직 가설인가?

rollback semantics도 필요하다. 실패하면 무엇을 되돌릴 수 있는가? 파일, commit, database transaction, API side effect 중 어디까지 reversible한가?

마지막은 stopping rule이다. 언제 더 돌리지 않을 것인가? 성공률, 비용, latency, side effect 위험을 어떤 기준으로 trade off할 것인가?

state control이 없으면 early mistake가 context drift가 된다. 더 나쁘면 실제 환경의 side effect가 된다. 실패 모드는 검증되지 않은 가정을 commit하는 것이다.

## 8. 약한 loop와 강한 loop

약한 loop는 대개 이렇게 생겼다.

```text
answer -> self-critique -> revised answer
```

이 구조가 항상 쓸모없다는 뜻은 아니다. 문장 다듬기나 간단한 sanity check에는 도움이 된다.

그래도 이것을 verifier라고 부르기는 어렵다. 같은 생성 경로에서 나온 자기평가는 독립성이 약하고, 측정 오차를 충분히 줄이지 못한다.

짧게 말하면, self-reflection은 같은 생성 경로에서 나온 내부 의견이고 verifier는 독립 측정이어야 한다.

독립성이 중요한 이유는 단순하다. 평가자와 생성자가 같은 오류 상관을 공유하면 같은 착각을 반복할 수 있다. 그러면 false positive와 false negative가 실제로 줄었다고 보기 어렵다. calibration도 따로 잡기 어렵고, observation channel도 분리되어 있지 않다. 그래서 self-reflection은 feedback처럼 쓸 수는 있어도, 신뢰할 만한 verifier로 취급하기는 어렵다.

강한 loop는 다르게 생겼다.

```text
generate candidate
-> act with tools
-> observe result
-> verify against a calibrated utility proxy
-> produce diagnostic feedback
-> update or rollback state
-> stop when the utility/cost frontier says stop
```

차이는 선명하다.

- 외부 관찰이 있다.
- 판정 신호가 있다.
- 다음 행동을 바꾸는 diagnostic feedback이 있다.
- state ownership과 rollback boundary가 있다.
- 종료 조건이 있다.

강한 loop는 더 많이 생각하는 loop가 아니다. 더 좋은 정보로 다음 행동을 바꾸는 loop다.

## 9. Agent 설계 리뷰에서 물어야 할 질문

“loop가 있나요?”는 약한 질문이다.

대신 이런 질문을 던지는 편이 낫다.

1. verifier는 정확히 무엇인가?
2. verifier는 task utility의 좋은 proxy인가?
3. false positive와 false negative는 어떻게 다루는가?
4. feedback은 diagnostic한가, pass/fail뿐인가?
5. 어떤 tool이 모델의 가정을 반증할 수 있는가?
6. state ledger는 누가 소유하는가?
7. memory write에는 provenance가 있는가?
8. rollback 단위는 무엇인가?
9. irreversible side effect는 어떻게 막는가?
10. stopping rule은 무엇인가?
11. success, latency, cost, risk를 어떤 utility로 trade off하는가?

도메인별로 바꾸면 더 선명하다.

coding agent라면 self-reflection prose보다 test output, diff, rollback이 중요하다.

research agent라면 confidence보다 citation provenance와 source-grounded verification이 중요하다.

planning agent라면 더 긴 plan보다 assumption ledger와 environment observation이 중요하다.

customer-support agent라면 친절한 답변보다 policy verifier, escalation rule, audit log가 중요하다.

## 10. 언제 loop가 필요 없거나 해로운가

loop는 공짜가 아니다.

loop가 필요 없는 경우도 있다.

- 짧은 정보 추출
- deterministic formatting
- 낮은 위험의 classification
- 이미 one-shot이 포화된 과제
- 외부 상태를 바꾸지 않는 간단한 질의

반대로 해로운 경우도 있다.

### 10.1 False-positive verifier

틀린 답을 맞다고 판정하면 loop는 오답을 더 자신 있게 밀어붙인다.

weak verifier가 위험한 이유는 세 가지다. false positive가 많으면 틀린 후보가 다음 state로 넘어간다. 후보들이 correlated되어 있으면 여러 번 뽑아도 같은 오류를 반복한다. proxy가 좁으면 agent는 과제를 푸는 대신 proxy를 맞춘다. 셋은 따로 움직이지 않는다. 약한 판정기가 상관된 후보를 통과시키면, loop는 proxy hacking에 더 취약해질 수 있다.

### 10.2 Correlated candidates

같은 사고 경로에서 나온 후보 셋은 독립적인 후보 셋이 아니다. best-of-n은 후보 다양성이 있고, 선택기의 calibration이 충분하고, 후보 사이의 효용 차이가 verifier의 판정 오차보다 충분히 클 때 의미가 생긴다. 이 비교는 같은 척도로 보정된 proxy 위에서만 가능하다.

후보 오류가 강하게 상관되어 있으면 n을 늘려도 “적어도 하나는 맞을” 확률이 독립 표본처럼 올라가지 않는다. 선택기의 false-positive rate가 높으면 후보를 더 많이 만드는 일이 오히려 그럴듯한 오답을 고를 기회를 늘릴 수도 있다.

### 10.3 Proxy hacking

visible test만 통과하거나, citation 형식만 맞추거나, confidence 표현만 좋아지는 식의 최적화가 생길 수 있다.

### 10.4 Irreversible side effects

운영 환경에서 잘못된 API call을 반복하는 agent는 똑똑한 것이 아니라 위험하다.

### 10.5 State drift

검증되지 않은 가정이 “이미 확인된 사실”처럼 context에 남으면, loop는 오류를 고치는 장치가 아니라 오류를 보존하는 장치가 된다.

### 10.6 No stopping rule

더 긴 reasoning이 항상 더 좋은 것은 아니다. 어느 순간부터는 utility보다 latency와 cost가 더 빨리 오른다.

그래서 좋은 agent engineering의 질문은 “loop를 붙이자”가 아니다.

질문은 이쪽에 가깝다.

> 어떤 feedback이 어떤 state를 어떻게 바꾸는가?

## 11. 결론: 무엇이 loop를 닫는가

LLM agent loop는 우연히 등장한 UI 패턴이 아니다. 장기 작업에서 검토할 이유가 있다.

하지만 그 이유는 “LLM이 확률적이기 때문”만은 아니다.

one-shot generation은 다음 token 또는 sequence likelihood를 다룬다. 우리가 원하는 것은 task utility다. 둘 사이에는 간극이 있다. 장기 과제, 외부 상태 변경, 검증 가능한 목표, 되돌릴 수 있는 실행 단위가 들어오면 그 간극은 외부 관찰, 검증, 수리, rollback, 비용 관리의 문제로 커진다.

짧고, 위험이 낮고, 외부 상태를 바꾸지 않는 작업에는 one-shot이 더 나을 수 있다. 반대로 신뢰성, 외부 상태, 검증 가능성, 복구 가능성이 중요한 작업에서는 폐루프 설계가 검토 대상이 된다.

다만 아무 loop나 되는 것은 아니다.

분석 단위는 loop의 존재 여부가 아니라 control surface다. 무엇을 관찰하고, 무엇으로 판정하고, 어떤 state를 바꾸며, 언제 멈추는가.

verifier가 없는 반복은 검증 가능한 개선 없이 텍스트만 늘릴 위험이 크다.

actionable feedback 없는 loop는 같은 벽에 다시 부딪히는 일이다.

tool access 없는 loop는 내부 추측의 재활용이다.

state control 없는 loop는 실수를 history로 굳히는 장치다.

반대로 이 네 가지가 갖춰지면 agent loop는 공학적으로 검토할 수 있는 구조가 된다. 목적은 loop 자체가 아니다. 관찰, 판정, 수정, 상태 전이가 폐루프를 이루고, 시스템이 더 나은 근거로 다음 행동을 고를 수 있게 만드는 것이다.

앞의 작은 pilot도 이 주장을 증명하지 않는다. 다만 한 가지는 조심스럽게 말할 수 있다. loop를 붙였다는 사실보다 어떤 신호가 loop를 닫는지가 더 중요하다.

그러니 설계 순서는 이렇게 잡는 편이 낫다. loop를 붙일지 말지를 먼저 묻지 말고, 어떤 verifier와 state boundary, 즉 상태 경계를 둘지부터 정하라.

마지막 체크리스트는 짧다.

- verifier는 과제 효용을 충분히 잘 재는가?
- feedback은 다음 행동을 바꿀 만큼 diagnostic한가?
- tool은 모델의 가정을 반증할 수 있는가?
- state boundary와 rollback rule은 분명한가?

마지막 문장은 이것으로 충분하다.

> 좋은 agent loop는 더 오래 말하는 시스템이 아니다.  
> 더 좋은 신호로 검증 가능한 상태 전이를 만드는 시스템이다.

## Sources and Further Reading

이 글의 근거는 이렇게 나눠 읽으면 좋다.

- 모델 형식: Bengio와 Vaswani는 next-token objective와 Transformer의 기본 배경이다.
- decoding/search mismatch: Holtzman, Arora et al., Stahlberg와 Byrne, Eikema와 Aziz는 unreliable tail, exposure bias, greedy 선택과 sequence-level search가 다르다는 배경이다.
- test-time compute와 verifier: Wang, Yao, Shinn, Lightman, Huang, Snell은 샘플링, reasoning, self-correction, verifier-guided reasoning의 가능성과 한계를 보여준다.
- agent engineering: OpenAI Codex, Claude Code, Anthropic tool use, Ralph loop, Karpathy의 `autoresearch`, SWE-agent는 tool, observation, state, verifier가 실제 agent 실행 구조와 어떻게 연결되는지 보여주는 사례다.

- Yoshua Bengio et al., [“A Neural Probabilistic Language Model”](https://jmlr.org/papers/v3/bengio03a.html), 2003.
- Ashish Vaswani et al., [“Attention Is All You Need”](https://arxiv.org/abs/1706.03762), 2017.
- OpenAI, [“Unrolling the Codex agent loop”](https://openai.com/index/unrolling-the-codex-agent-loop/), 2026.
- Anthropic, [“How tool use works”](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works), accessed 2026-05-29.
- Anthropic, [“Keep Claude working toward a goal”](https://code.claude.com/docs/en/goal), accessed 2026-05-29.
- Ralph, [“Ralph loop”](https://ralph-cli.dev/docs/core-concepts/ralph-loop/), accessed 2026-05-29.
- Andrej Karpathy, [“autoresearch”](https://github.com/karpathy/autoresearch), accessed 2026-05-29.
- Ari Holtzman et al., [“The Curious Case of Neural Text Degeneration”](https://arxiv.org/abs/1904.09751), 2019.
- Kushal Arora et al., [“Why Exposure Bias Matters: An Imitation Learning Perspective of Error Accumulation in Language Generation”](https://arxiv.org/abs/2204.01171), 2022.
- Felix Stahlberg and Bill Byrne, [“On NMT Search Errors and Model Errors”](https://aclanthology.org/D19-1331/), 2019.
- Bryan Eikema and Wilker Aziz, [“Sampling-Based Approximations to Minimum Bayes Risk Decoding”](https://arxiv.org/abs/2108.04718), 2021.
- Xuezhi Wang et al., [“Self-Consistency Improves Chain of Thought Reasoning in Language Models”](https://arxiv.org/abs/2203.11171), 2022.
- Shunyu Yao et al., [“ReAct: Synergizing Reasoning and Acting in Language Models”](https://arxiv.org/abs/2210.03629), 2022.
- Shunyu Yao et al., [“Tree of Thoughts”](https://arxiv.org/abs/2305.10601), 2023.
- Noah Shinn et al., [“Reflexion: Language Agents with Verbal Reinforcement Learning”](https://arxiv.org/abs/2303.11366), 2023.
- Hunter Lightman et al., [“Let’s Verify Step by Step”](https://arxiv.org/abs/2305.20050), 2023.
- Jie Huang et al., [“Large Language Models Cannot Self-Correct Reasoning Yet”](https://arxiv.org/abs/2310.01798), 2023.
- John Yang et al., [“SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering”](https://arxiv.org/abs/2405.15793), 2024.
- Charlie Snell et al., [“Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters”](https://arxiv.org/abs/2408.03314), 2024.

Note:
위의 작은 파일럿은 출판급 실험이 아니라 failure mode를 보여주는 사례다. 이 글의 주장은 파일럿 하나가 아니라 objective mismatch, feedback control, verifier quality, state management라는 구조적 논리 위에 있다.
