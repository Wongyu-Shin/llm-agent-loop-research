# LLM Agent Loop 연구 노트

부제: POMDP에서 OGIS·CEGIS로 이어지는 이론적 재정식화

- 작성일: 2026-07-22
- 상태: working synthesis v0.2
- 목적: 지금까지의 논의에서 살아남은 주장, 폐기한 주장, 근거 문헌, 남은 검증 과제를 한곳에 보존한다.
- 범위: LLM agent의 loop가 언제 왜 유용한지 설명한다. 모든 LLM 사용이 반드시 loop여야 한다는 보편명제는 다루지 않는다.

관련 문서:

- 초기 종합 보고서: `reports/M4b-agent-loop-necessity-research-report.md`
- 논문 초안 v0.1: `reports/M4b-agent-loop-necessity-paper-draft.md`
- LinkedIn 본문: `reports/linkedin-agent-loop-post/07-blog-post-final.md`
- 공동 수정 대기열: `reports/linkedin-agent-loop-post/30-revision-queue.md`

이 문서는 기존 문서를 대체하지 않는다. 이후 논문과 LinkedIn 글을 고칠 때 사용할 이론적 기준점이다.

## 1. 한 문장 결론

처음에는 이렇게 생각했다.

> LLM은 확률적으로 다음 token을 만들고 긴 출력에서는 오류가 누적되므로, agent는 반드시 loop로 고쳐야 한다.

지금의 결론은 다르다.

> 복잡하고 외부 검증이 가능한 과제에서 LLM agent의 loop는 단순 반복이 아니다. 모델이 후보를 만든다. 실행이나 검증에서 새 정보를 얻고 그 정보로 다음 후보의 분포를 바꾸는 적응적 탐색이다. loop의 필요성은 softmax 자체보다 행동 뒤에 생기는 정보와 그 정보의 의사결정 가치에서 나온다.

조금 더 엄밀히 말하면, LLM은 이 시스템에서 답을 보장하는 solver라기보다 후보를 제안하는 generator에 가깝다. harness는 후보를 실행해 외부 세계의 반응을 observation·score·counterexample로 바꾸고 다음 호출에 남길 상태를 관리한다.

이 관점에서 agent loop를 설명하는 단 하나의 수학 모형은 없다.

- POMDP는 부분적으로만 보이는 환경에서 agent가 관찰하고 행동하는 바깥 상호작용을 설명한다.
- OGIS와 CEGIS는 후보를 만들고 oracle 또는 counterexample으로 고치는 안쪽 합성 과정을 설명한다.
- scalar metric을 따라 개선하는 loop는 black-box optimization에 더 가깝다.
- 여러 미래를 분기하고 되돌아보는 loop는 tree search나 online planning의 언어가 더 잘 맞는다.

현재로서는 이 층들을 억지로 하나로 합치기보다, feedback의 종류에 따라 나누어 쓰는 편이 정확하다.

## 2. 원래 명제에서 남길 것과 버릴 것

| 원래 생각 | 현재 판정 | 이유 |
|---|---|---|
| LLM은 이전 context를 조건으로 다음 token의 확률분포를 낸다. | 유지 | 자기회귀 언어모델의 기본 분해다. |
| 모든 배포에서 token은 확률적으로 sampling된다. | 폐기 | 모델이 분포를 내는 것과 decoder가 sampling하는 것은 다르다. greedy·constrained decoding은 결정론적일 수 있다. |
| 긴 출력에서는 낮은 확률의 이상한 token이 반드시 나타난다. | 폐기 | decoding policy, truncation, 조건부 확률의 하한이 필요하다. 낮은 확률과 오류도 같은 개념이 아니다. |
| 초반 token 선택이 뒤의 생성 경로를 크게 바꿀 수 있다. | 조건부 유지 | prefix가 후속 생성을 조건화하는 것은 맞다. 다만 harness는 branch·rollback·요약·상태 삭제로 그 영향을 끊을 수 있다. |
| greedy token 선택은 global minimum을 보장하지 않는다. | 표현 교체 | token-level argmax가 sequence-level MAP을 보장하지 않는다는 말은 맞다. 그러나 task utility에는 보통 minimum이 정의되어 있지 않다. 세 목적함수를 분리한다. |
| loop는 한 번의 출력이 놓친 최적해를 찾는다. | 약화 | loop도 최적해를 보장하지 않는다. 제한된 budget 안에서 후보를 더 탐색하고 외부 feedback으로 선택을 개선할 뿐이다. |
| 모든 LLM agent 작업은 반드시 loop여야 한다. | 폐기 | 짧고 정적이며 낮은 위험의 과제에는 one-shot이 충분할 수 있다. 조건부 구조 명제로 좁혀야 한다. |

세 목적함수는 다음처럼 구분한다.

```text
next-token argmax
!= sequence-level MAP
!= task-utility optimum
```

첫 번째 부등식은 작은 반례로 보일 수 있다. 두 번째 부등식은 더 중요하다. 모델 likelihood가 높다고 해서 테스트 통과, 사실성, 안전성, 비용, 지연 시간까지 포함한 과제 효용이 높다는 보장은 없다.

이 연구의 중심 원인은 `확률성`이 아니라 다음 둘이다.

1. 모델이 직접 최적화하는 대리목표와 실제 과제 효용 사이의 불일치
2. 행동하기 전에는 context에 없던 정보가 실행·측정·검증 뒤에 생기는 상호작용 구조

## 3. 실행 뒤에만 얻는 정보의 공통점

실행 전에는 알 수 없다는 말은 세 경우를 뒤섞기 쉽다.

- 외부 상태를 관찰하지 않아 몰랐던 경우
- 원리상 계산할 수 있지만 비용이 너무 큰 경우
- 일반적으로 판정할 수 없는 경우

agent loop의 일반 근거는 세 번째 경우, 즉 undecidability 하나에 있지 않다. 더 넓고 실용적인 공통점은 이렇다. **현재 정보만으로 구분되지 않는 여러 세계가 있다. 그 세계마다 좋은 다음 행동이 다르다.**

초기 history를 `h_0`, 실제로는 가능하지만 아직 구분되지 않은 두 상태를 `s`와 `s'`라고 하자. 다음 조건이 함께 성립하면 관찰의 가치가 생긴다.

1. `h_0`만 봐서는 `s`와 `s'`를 구분할 수 없다.
2. `s`에서 좋은 행동과 `s'`에서 좋은 행동이 다르다.
3. 어떤 실행이나 측정 뒤에 얻는 observation `o`가 두 상태를 구분하는 데 도움을 준다.
4. agent가 `o`를 받아 다음 행동을 바꿀 수 있다.

정보의 의사결정 가치는 다음처럼 쓸 수 있다.

```text
V_info = E_o[max_a E[U(a,S) | h_0,o]]
         - max_a E[U(a,S) | h_0]
```

`V_info > 0`이면 관찰 뒤에 행동을 다시 고를 수 있는 정책이 관찰 없이 미리 하나를 고르는 정책보다 높은 기대 효용을 낼 여지가 있다. 이 식은 loop가 언제 도움이 되는지 말해 주지만 모든 loop가 실제로 도움 된다고 보장하지는 않는다. observation이 부정확하거나 update가 이를 무시하면 이득은 사라진다.

코드 실행, 검색, 실험, 사용자 검토에서 새로 얻는 정보는 겉모습이 달라도 구조가 비슷하다.

- 숨은 외부 상태에 관한 정보가 들어온다.
- 이전 후보의 구체적인 실패 지점이 드러난다.
- 성공 기준에 대한 대리 신호가 생긴다.
- 그 신호가 다음 후보를 제한하거나 우선순위를 바꾼다.

단순한 reasoning token은 계산 시간을 늘릴 수 있지만 그 자체로 외부 세계에 관한 새 evidence를 만들지는 않는다. 반면 test log, API response, source 문서, 사용자 판정은 초기 context에 없던 외부 evidence가 될 수 있다. 이 차이는 self-reflection과 grounded feedback을 구분할 때 중요하다.

## 4. Halting problem은 근거가 아니라 경계 사례다

프로그램의 정상 실행을 실행 전에 언제나 알 수 없다는 문장은 너무 넓다. 많은 구체적 프로그램은 정적 분석, 형식 검증, type system, 증명으로 성질을 확인할 수 있다.

Halting problem이 말하는 것은 더 제한적이고 강하다.

> 임의의 프로그램과 입력을 받아 그 실행이 끝나는지 항상 정확히 판정하는 일반 알고리즘은 존재하지 않는다.

Rice의 정리는 이 경계를 비자명한 프로그램 의미 속성으로 넓힌다. 그렇다고 모든 프로그램 성질을 실행 전에는 모른다는 뜻은 아니다. 특정 프로그램군에 제약을 두거나 충분한 증명을 제공하면 판정 가능한 경우가 많다.

실행과 검증의 역할도 다르다.

- 실행이 반환되면 그 한 번의 실행이 종료했다는 witness를 얻는다.
- 유한 시간 동안 반환되지 않았다는 사실만으로 영원히 종료하지 않는다고 증명할 수는 없다.
- test가 통과해도 모든 입력에 대한 정당성이 자동으로 증명되지는 않는다.
- sound하고 complete한 formal verifier가 있는 제한된 영역에서는 더 강한 보장이 가능하다.

agent loop는 undecidability를 극복하지 않는다. 대개는 제한된 budget 안에서 반례를 찾아 관찰 가능한 실패를 고치고 충분히 좋은 후보를 선택한다. 논문의 주 논거를 Halting problem에 두면 과장된다. Halting과 Rice는 검증에도 원리적 한계가 있다는 경계 조건으로 쓰는 편이 맞다.

## 5. POMDP가 설명하는 것

부분 관측 마르코프 의사결정 과정(POMDP)은 agent와 환경의 반복 상호작용을 표현하는 자연스러운 모형이다. 보통 다음 요소를 둔다.

```text
(S, A, T, O, Z, R, gamma)
```

| POMDP 요소 | agent system에서의 대응 |
|---|---|
| hidden state `S` | 실제 repository·웹·사용자 요구·환경 상태와 아직 확인하지 않은 정답 조건 |
| action `A` | tool call, 파일 수정, 질의, 실험, 최종 답변 |
| transition `T` | action이 외부 상태를 바꾸는 규칙 |
| observation `O` | test log, API 결과, 검색 문서, 사용자 feedback |
| observation model `Z` | 실제 상태가 어떤 관측으로 드러나는지에 대한 불확실성 |
| reward 또는 utility `R` | 성공, 비용, 지연, 위험, side effect를 합친 과제 평가 |
| policy `pi` | history를 보고 다음 action을 고르는 LLM과 harness의 결합 |

이 대응은 **모델링 주장**으로는 무리가 없다. 상태를 충분히 크게 잡거나 history 전체를 상태에 포함하면 여러 agent loop를 순차 의사결정 과정으로 표현할 수 있다.

다만 여기서 곧바로 LLM 내부가 POMDP를 푼다고 말하면 단계가 하나 건너뛴다.

### 5.1 순전파와 agent loop는 시계가 다르다

자기회귀 생성에서는 이미 생성된 token이 다음 token 계산의 입력이 된다. 같은 model call 안에서도 token마다 forward computation이 반복된다. 하지만 tool을 실행하기 전까지는 외부 observation이 추가되지 않는다.

agent loop의 한 step은 더 크다.

```text
context_t
-> model generation
-> action or candidate
-> environment/tool/verifier
-> observation_t
-> context_(t+1)
```

외부 상태의 지속성은 transformer activation 자체보다 context, 파일, harness state, database, memory store에 놓이는 경우가 많다. activation은 호출 중 계산에 쓰이지만 다음 독립 호출까지 자동으로 보존되는 영속 상태가 아니다.

### 5.2 안전하게 말할 수 있는 수준

| 주장 수준 | 판정 |
|---|---|
| 전체 agent가 부분 관측 환경에서 history-conditioned policy로 동작한다. | 안전한 시스템 수준 모델링 |
| model activation이 과제에 필요한 latent state 일부를 표현할 수 있다. | 가능한 경험적 가설 |
| LLM이 순전파마다 명시적 Bayesian filtering을 수행한다. | 별도 증거 없이는 단정 불가 |
| LLM이 Bellman backup으로 POMDP의 최적 policy를 계산한다. | 표준 agent loop만으로는 지지되지 않음 |

online POMDP planning은 보통 belief update만 뜻하지 않는다. 현재 belief에서 여러 action과 가능한 observation을 미리 분기해 rollout 또는 simulator로 장기 가치를 추정한 뒤 value를 backup한다. POMCP가 대표적인 예다.

ReAct식 선형 loop는 관찰을 받아 계획을 바꾸므로 POMDP의 실행 구조와 닮았다. 그러나 explicit belief distribution, branching simulation, value backup이 없다면 POMCP 같은 online planner와 같다고 볼 수 없다. 여러 후보를 분기하고 simulator·verifier로 평가한 뒤 점수를 부모·상위 node로 되돌리는 설계라면 그때는 online planning이나 tree search에 더 가까워진다.

## 6. POMDP만으로 부족한 이유

POMDP는 무엇을 관찰했고 다음에 무엇을 할지를 설명하는 데 강하다. 반면 code patch나 계획 후보가 counterexample을 받을 때마다 어떻게 좁혀지는지는 잘 드러내지 않는다.

이론적으로는 후보, verifier 상태, 대화 history를 모두 거대한 POMDP state에 넣을 수 있다. 그렇게 하면 거의 모든 순차 시스템을 표현할 수 있다. 그러나 설명력이 약해진다. loop가 왜 개선되는지, 어떤 feedback이 후보 공간을 줄이는지, verifier가 어떤 보장을 주는지 보이지 않기 때문이다.

그래서 agent engineering에는 한 층을 더 두는 편이 낫다.

```text
바깥층: environment interaction / partial observability
안쪽층: candidate proposal / verification / refinement
```

바깥층에는 POMDP와 feedback control이 잘 맞는다. 안쪽층에는 OGIS와 CEGIS가 더 직접적이다.

## 7. OGIS와 oracle 대화

Oracle-Guided Inductive Synthesis(OGIS)는 learner가 oracle에 질의하고 답을 받아 후보를 고쳐 가는 형식 합성의 일반 틀이다. 여기서 oracle은 모든 것을 아는 초월적 존재가 아니다. 정의된 query에 명세된 형식의 답을 돌려주는 interface다.

일반화한 agent loop는 다음처럼 쓸 수 있다.

```text
candidate_t = Decode(P_theta(. | goal, H_t))
feedback_t  = Oracle(goal, candidate_t, state_t)
H_(t+1)     = Update(H_t, candidate_t, feedback_t)
```

모델 parameter `theta`가 바뀌지 않아도 `H_t`가 달라지면 다음 후보의 조건부 분포는 달라진다. in-context constraint, 실패 로그, best-so-far, 수정된 파일이 이 history에 들어간다.

OGIS가 agent loop에 유용한 까닭은 반복한다는 설명보다 더 구체적인 질문을 던지게 하기 때문이다.

- learner가 탐색하는 candidate class는 무엇인가?
- oracle은 어떤 query를 받고 어떤 답을 주는가?
- feedback은 새 후보를 실제로 제한하는가?
- 과거 evidence를 얼마나 기억하는가?
- accept의 의미는 test 통과인가, specification 만족인가, 단순 score 개선인가?

## 8. CEGIS와 반례 기반 후보 축소

Counterexample-Guided Inductive Synthesis(CEGIS)는 OGIS의 대표적인 특수형이다. learner가 후보를 만들고 verifier가 전체 specification에 비추어 검사한다. 틀렸다면 구체적인 counterexample을 돌려준다.

```text
p_t = Learn(E_t)

Verify(p_t, Phi) =
  ACCEPT
  or counterexample c_t

E_(t+1) = E_t union {c_t}
```

후보 집합을 명시하면 다음처럼 볼 수 있다.

```text
C_(t+1) = {p in C_t | Phi(p, c_t)}
```

이 update를 실제 learner에 강제하면 `C_(t+1)`은 `C_t`의 부분집합이 된다. `c_t`가 현재 후보 `p_t`의 위반을 드러냈다면 적어도 `p_t`는 다음 집합에서 빠진다. 이것이 CEGIS loop의 핵심 진전 신호다. “다시 생각해 봐”와 달리 다음 후보가 피해야 할 구체적인 영역이 생긴다.

### 8.1 code agent와의 대응

| CEGIS 개념 | code agent의 근사 대응 |
|---|---|
| specification `Phi` | 사용자 목표, acceptance criteria, API contract, hidden requirement |
| candidate `p_t` | patch, program, plan, invariant |
| learner | LLM + prompt + 작업 memory |
| verifier | compiler, unit test, SMT solver, theorem prover, static analyzer |
| counterexample `c_t` | failing input, stack trace, violated assertion, model-checking trace |
| evidence set `E_t` | context, issue ledger, 실패 기록, repository state |
| acceptance | verifier가 정의한 기준 통과 |

이 대응은 쓸모가 크지만 보통의 code agent를 그대로 CEGIS라고 부르면 안 된다.

- unit test는 전체 specification을 완전하게 대표하지 않을 수 있다.
- compiler error는 counterexample이라기보다 syntax·type feedback일 수 있다.
- 자연어 critique는 sound한 verifier가 아니다.
- visible test만 통과하면 overfitting이 생길 수 있다.
- verifier가 `ACCEPT`를 반환해도 실제 사용자 효용과 어긋날 수 있다.

formal verifier와 명세가 있는 경우에는 `CEGIS`, test와 log로 수정하는 일반 code agent에는 `CEGIS-like` 또는 `counterexample-guided refinement`라고 쓰는 편이 안전하다.

## 9. feedback에 따라 달라지는 이론 모형

하나의 모형을 모든 loop에 씌우기보다, 다음 표처럼 feedback의 형태를 먼저 보는 것이 좋다.

| loop에서 돌아오는 신호 | 잘 맞는 모형 | 핵심 질문 |
|---|---|---|
| 환경 observation | POMDP, feedback control, MPC | 숨은 상태에 대한 belief와 다음 action은 어떻게 바뀌는가? |
| pass/fail + 구체적 counterexample | CEGIS | 반례가 candidate space를 얼마나 줄이는가? |
| 여러 종류의 query-response | OGIS | oracle interface가 어떤 정보를 제공하는가? |
| scalar metric | black-box optimization, Bayesian optimization, evolutionary search | score를 높이기 위해 어디를 탐색할 것인가? |
| 분기한 후보와 rollout value | tree search, MCTS, online planning | 어느 branch에 compute를 더 배분할 것인가? |
| 여러 독립 후보와 selector | best-of-n, verifier-guided selection | 후보 다양성과 selector 정확도가 충분한가? |
| 외부 evidence 없는 self-critique | iterative refinement | 새 정보 없이 같은 편향을 반복하는 것은 아닌가? |
| 시간이 늘수록 중간 답을 개선 | anytime algorithm | 언제 멈춰도 쓸 수 있는 best-so-far가 있는가? |

이 표에서 현재 연구의 상위 표현은 `verifier-guided adaptive search` 또는 더 넓게 `oracle-guided adaptive search`다. OGIS/CEGIS는 그 표현에 형식적 뼈대를 제공하지만 모든 agent loop가 formal synthesis라는 뜻은 아니다.

## 10. loop가 성능을 높이는 세 경로

loop의 이득을 한 덩어리로 세지 않고 세 갈래로 나눈다.

### 10.1 추가 계산

모델이 더 많은 reasoning token과 후보를 만들 수 있다. 외부 정보가 없어도 탐색 폭이나 계산 깊이는 늘어난다. 다만 같은 오류가 강하게 상관되어 있으면 반복 이득은 빨리 포화된다.

### 10.2 새 observation

도구와 환경이 초기 context에 없던 evidence를 제공한다. 이때 loop는 단순한 test-time compute보다 정보 획득 과정에 가깝다.

### 10.3 검증과 선택

후보마다 task utility의 proxy를 측정해 실패 후보를 버리거나 고친다. 성능 개선은 생성 횟수보다 verifier의 정렬도와 독립성에 크게 좌우된다.

각 시도에서 이전 실패를 조건으로 보더라도 성공 확률이 최소 `epsilon > 0`이라고 하자.

```text
P(no success by T) <= (1 - epsilon)^T
```

이 bound에는 독립성보다 약한 조건으로도 충분하지만 모든 agent에 자동으로 적용되지는 않는다. 실제로는 `epsilon`의 양의 하한이 없을 수 있고 feedback이 후보를 더 나쁘게 만들 수도 있다. 또한 성공을 정확히 알아보는 selector가 필요하다.

## 11. loop가 실패하는 조건

loop는 다음 조건을 갖춰야 진전할 가능성이 커진다.

1. generator가 허용 가능한 해를 낼 가능성이 0이 아니다.
2. verifier가 실제 목표와 충분히 상관된 신호를 준다.
3. feedback이 다음 proposal distribution을 바꾼다.
4. 검증된 진전과 best-so-far를 보존한다.
5. 같은 실패를 반복하지 않도록 탐색 다양성과 제약 memory가 있다.
6. rollback, side-effect control, stopping rule이 있다.

반대로 다음 상황에서는 반복이 성능을 떨어뜨릴 수 있다.

- self-critique가 독립적인 evidence 없이 최초 답의 편향을 되풀이한다.
- verifier가 false positive를 내거나 좁은 proxy만 최적화한다.
- visible test에 과적합한다.
- 실패 로그가 context에서 지워지거나 잘못 요약된다.
- 이미 맞는 후보를 불필요하게 고쳐 regression을 만든다.
- 비가역 action을 여러 번 실행한다.
- compute 비용이 기대 효용의 개선보다 크다.

loop가 성능을 보장한다는 문장은 현재 연구에서도 사용하지 않는다. 강한 loop는 보장 장치가 아니라 좋은 feedback을 이용할 수 있게 만든 시스템 구조다.

## 12. 문헌에서 확인한 직접 연결

### 12.1 출판된 직접 근거

| 문헌 | 이 연구와의 연결 | 한계 |
|---|---|---|
| Jha & Seshia, *A Theory of Formal Synthesis via Inductive Learning*, Acta Informatica 2017 | OGIS를 oracle에 반복 질의하는 합성의 일반 틀로 정식화하고 CEGIS를 중요한 instance로 둔다. | LLM agent를 직접 다루지 않는다. |
| Jha et al., *Neuro Symbolic Reasoning for Planning*, MILCOM 2023 | LLM을 inductive learner, Z3를 deductive verifier로 두고 counterexample을 prompt에 다시 넣는다. | block-world planning 중심의 제한된 실험이다. |
| Bhatia et al., *Verified Code Transpilation with LLMs*, NeurIPS 2024 | 논문 자체가 방법을 `LLM-based OGIS`라고 부른다. LLM이 summary와 invariant 후보를 만들고 verifier가 확인한다. | domain-specific transpilation과 formal verification에 초점이 있다. |
| Orvalho et al., *Counterexample Guided Program Repair*, AAAI 2025 | LLM patch를 test suite로 검사하고 실패 counterexample을 다음 합성에 넣는 explicit CEGIS loop다. | 교육용 프로그램 repair와 주어진 test suite 범위의 결과다. |

이 네 문헌으로 OGIS나 CEGIS를 LLM 기반 반복 합성에 적용한 선례가 있음을 확인할 수 있다. 다만 여기서 곧바로 모든 general-purpose agent가 CEGIS라는 결론은 나오지 않는다.

### 12.2 최근 preprint가 보여 주는 방향

2026년 7월 22일 현재의 preprint에서는 연결이 더 노골적으로 나타난다.

- *Counterexample Guided Learning in the Large using Reasoning Agents*는 regex induction에서 LLM learner와 counterexample teacher를 두고 reflection·repair loop를 비교한다.
- *OPINE-World*는 상호작용으로 world model을 배우는 LLM agent를 CEGIS와 replay verification의 언어로 설명한다.
- *CIll*은 model checking에서 counterexample to induction을 LLM에 돌려주어 invariant를 반복 합성한다.
- *AutoSpec*은 LLM agent의 safety rule을 labeled trace의 false positive·false negative counterexample로 고친다.

이 문헌들은 현재 방향과 매우 가깝지만 아직 preprint다. 핵심 명제의 유일한 근거로 쓰지 않고 확장되는 연구 흐름을 보여 주는 보조 자료로 취급한다.

### 12.3 간접 근거

- POMDP 문헌은 history, belief, value of information, partial observation을 다루는 바깥 이론을 제공한다.
- POMCP는 belief update만이 아니라 branching simulation과 value backup이 online planning에 필요하다는 비교 기준을 준다.
- ReAct는 reasoning과 action을 교차시키고 action으로 외부 정보를 얻는 agent loop의 대표 사례다.
- intrinsic self-correction 연구는 외부 feedback 없는 반복이 오히려 성능을 낮출 수 있음을 보여 준다.

## 13. 현재 연구 명제

논문에서 검토할 중심 명제는 다음처럼 정리한다.

> 장기적이고 외부 상태와 상호작용하며 중간 결과를 검증할 수 있는 과제에서, LLM agent는 one-shot text generator보다 stochastic proposal generator가 들어간 verifier-guided adaptive search로 보는 편이 정확하다. loop의 기대 이득은 확률적 token 오류의 필연성에서 나오지 않는다. 행동 뒤에 얻는 정보의 가치, verifier의 목표 정렬도, feedback이 후보 공간을 줄이는 정도, 그리고 진전을 보존하는 state update에서 나온다.

이 명제는 다음 하위 명제로 분해한다.

**P1. 목적함수 불일치**

token-level decoding, sequence likelihood, task utility는 일반적으로 서로 다른 목적함수다.

**P2. feedback 가치**

초기 정보로 구분되지 않는 상태들이 서로 다른 최적 행동을 요구하고 관찰이 이를 구분한다면, observation-conditioned policy에는 양의 정보 가치가 생길 수 있다.

**P3. 외부 evidence의 차별성**

같은 token budget이라도 독립적인 외부 evidence를 주는 loop와 self-reflection-only loop는 같은 메커니즘이 아니다.

**P4. counterexample의 진전성**

sound한 counterexample을 보존하고 다음 후보가 그 반례 입력에서 명세를 만족하도록 강제하면, 명세와 일관된 candidate set은 줄어든다. 일반 agent에서는 이 조건이 자주 깨지므로 CEGIS-like라는 표현이 필요하다.

**P5. 조건부 구조 필요성**

과제 성공에 필요한 observation이 action 뒤에만 생기고 one-shot policy가 그 observation에 조건화할 수 없다면, 목표 reliability를 달성하려는 시스템에는 둘 이상의 의사결정 시점이 필요하다.

**P6. 비충분성**

loop만으로는 성능 향상을 보장할 수 없다. verifier, feedback, state retention, exploration, stopping 조건이 따로 필요하다.

## 14. 검증 가능한 연구 가설

| ID | 가설 | 반증 또는 지지에 필요한 비교 |
|---|---|---|
| H1 | 외부 feedback의 정보 가치가 큰 과제일수록 loop의 이득이 커진다. | observation을 정상 제공한 조건과 mask·shuffle한 조건 비교 |
| H2 | 같은 inference budget에서 grounded feedback loop가 self-reflection-only보다 안정적이다. | 동일 모델·token·호출 예산, 외부 evidence만 ablation |
| H3 | counterexample의 구체성이 높을수록 재시도당 후보 제약 위반이 더 빠르게 줄어든다. | pass/fail, 오류 위치, failing input, full trace를 단계별 비교 |
| H4 | 검증된 제약과 best-so-far를 명시적으로 보존하면 regression과 cycle이 줄어든다. | memory·rollback·constraint ledger ablation |
| H5 | 짧고 정적이며 fully observed인 과제에서는 loop overhead가 이득을 상쇄한다. | one-shot을 negative control로 포함 |
| H6 | verifier가 실제 utility와 어긋날수록 반복 횟수가 늘어도 hidden success는 정체되거나 하락한다. | visible proxy와 held-out evaluator를 분리 |

가장 중요한 실험은 단순한 `loop vs no loop`가 아니다. 다음 조건을 분리해 비교한다.

```text
one-shot
vs more internal compute
vs repeated candidates + selector
vs external observation loop
vs counterexample-guided repair
vs full loop + rollback/state control
```

비용을 맞춘 비교와 비용을 맞추지 않은 최대 성능 비교를 함께 보고한다. accuracy 하나가 아니라 success·latency·token·tool call·side effect의 Pareto frontier가 필요하다.

## 15. 현재 진행도

### 정리된 부분

- softmax와 tail-token inevitability를 핵심 근거에서 제외했다.
- greedy decoding, sequence likelihood, task utility를 분리했다.
- 실행 뒤에 얻는 정보를 positive value of information 조건으로 정리했다.
- Halting problem과 실무적 불확실성을 분리했다.
- POMDP의 시스템 수준 설명력과 순전파 메커니즘 주장 사이에 선을 그었다.
- OGIS/CEGIS를 agent candidate-refinement loop에 직접 연결한 출판 문헌을 확인했다.
- 모든 loop를 CEGIS로 부르지 않도록 feedback taxonomy를 만들었다.
- universal necessity 대신 conditional structural necessity를 유지했다.

### 아직 미흡한 부분

- 모든 general-purpose agent를 포괄하는 단일 정리는 없다. 현재는 층별 모형이 더 정직하다.
- `V_info > 0`과 실제 LLM agent 성능 향상을 잇는 대규모 실험이 없다.
- 기존 tiny pilot은 표본이 작고 synthetic deterministic task 중심이라 중심 명제를 지지하지 못한다.
- formal CEGIS의 수렴 조건을 noisy LLM generator와 incomplete verifier에 맞게 옮긴 이론이 아직 부족하다.
- counterexample이 proposal distribution을 얼마나 바꾸는지 측정할 지표가 정해지지 않았다.
- LinkedIn 글에 넣을 Codex·Claude Code의 `/goal`, Ralph loop, `autoresearch` 사례는 제품·plugin·개인 workflow의 경계를 포함해 별도 source audit가 필요하다.
- 현재 LinkedIn 본문은 폐루프 제어를 중심 은유로 쓴다. 다음 개정에서 OGIS/CEGIS를 얼마나 전면에 둘지 결정이 남았다.

## 16. LinkedIn 글에 옮길 때의 구조

독자는 agent를 처음 듣는 사람부터 연구자까지 넓다. 본문은 다음 순서가 자연스럽다.

1. 챗봇과 agent가 사용자에게 어떻게 다르게 보이는지 짧게 설명한다.
2. code agent가 `수정 -> 실행 -> 로그 확인 -> 재수정`을 반복하는 장면을 보여 준다.
3. “확률적 token이 언젠가 틀리므로 loop가 필요하다”는 처음의 직관을 솔직히 소개하고 바로 한계를 밝힌다.
4. 핵심을 현실의 반응이 다음 행동을 바꾼다는 설명으로 옮긴다.
5. POMDP는 관찰과 행동을, OGIS/CEGIS는 후보와 검증을 설명한다고 나눈다.
6. verifier 없는 반복과 counterexample이 있는 반복의 차이를 보여 준다.
7. loop가 필요 없는 과제와 loop가 실패하는 조건도 함께 쓴다.
8. 마지막에는 반복 횟수보다 feedback의 품질을 설계하자는 문장으로 닫는다.

대중을 위한 모토는 다음 두 문장 중 하나를 기준으로 삼는다.

> 좋은 agent는 같은 답을 오래 되풀이하지 않는다. 답을 현실에 시험해 본다. 돌아온 증거로 다음 행동을 바꾼다.

또는 더 짧게:

> agent의 힘은 반복이 아니라, 현실의 반응으로 다음 선택을 바꾸는 데 있다.

논문용 문장에서는 `현실`을 observation, verifier feedback, counterexample로 풀어 쓴다.

## 17. 참고문헌

### 형식 합성·OGIS·CEGIS

- Jha, S. & Seshia, S. A., [A Theory of Formal Synthesis via Inductive Learning](https://people.eecs.berkeley.edu/~sseshia/pubs/b2hd-jha-acta17.html), *Acta Informatica* 54(7), 2017.
- Jha, S. K. et al., [Counterexample Guided Inductive Synthesis Using Large Language Models and Satisfiability Solving](https://nusci.csl.sri.com/publication/milcom23b/), MILCOM 2023.
- Jha, S. et al., [Dehallucinating Large Language Models Using Formal Methods Guided Iterative Prompting](https://nusci.csl.sri.com/publication/icaa23c/), ICAA 2023.
- Bhatia, S. et al., [Verified Code Transpilation with LLMs](https://proceedings.neurips.cc/paper_files/paper/2024/hash/48bb60a0c0aebb4142bf314bd1a5c6a0-Abstract-Conference.html), NeurIPS 2024.
- Orvalho, P., Janota, M. & Manquinho, V. M., [Counterexample Guided Program Repair Using Zero-Shot Learning and MaxSAT-based Fault Localization](https://ojs.aaai.org/index.php/AAAI/article/view/32046), AAAI 2025.

### 순차 의사결정·online planning

- Kaelbling, L. P., Littman, M. L. & Cassandra, A. R., [Planning and Acting in Partially Observable Stochastic Domains](https://people.smp.uq.edu.au/YoniNazarathy/Control4406_2014/resources/KaelblingLittmanCassandra1998.pdf), *Artificial Intelligence* 101, 1998.
- Silver, D. & Veness, J., [Monte-Carlo Planning in Large POMDPs](https://papers.nips.cc/paper_files/paper/2010/hash/edfbe1afcf9246bb0d40eb4d8027d90f-Abstract.html), NeurIPS 2010.

### LLM agent와 feedback

- Yao, S. et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629), ICLR 2023.
- Shinn, N. et al., [Reflexion: Language Agents with Verbal Reinforcement Learning](https://papers.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html), NeurIPS 2023.
- Huang, J. et al., [Large Language Models Cannot Self-Correct Reasoning Yet](https://proceedings.iclr.cc/paper_files/paper/2024/hash/8b4add8b0aa8749d80a34ca5d941c355-Abstract-Conference.html), ICLR 2024.
- Yao, S. et al., [Tree of Thoughts: Deliberate Problem Solving with Large Language Models](https://arxiv.org/abs/2305.10601), 2023.

### 계산 가능성의 경계

- Turing, A. M., [On Computable Numbers, with an Application to the Entscheidungsproblem](https://londmathsoc.onlinelibrary.wiley.com/doi/10.1112/plms/s2-42.1.230), *Proceedings of the London Mathematical Society*, 1937.
- Rice, H. G., [Classes of Recursively Enumerable Sets and Their Decision Problems](https://www.ams.org/journals/tran/1953-074-02/S0002-9947-1953-0053041-6/S0002-9947-1953-0053041-6.pdf), *Transactions of the AMS* 74(2), 1953.

### 2026 preprint 출판 상태 재확인 필요

- Liu, H. et al., [Counterexample Guided Learning in the Large using Reasoning Agents](https://arxiv.org/abs/2606.11521), arXiv, 2026.
- Courtis, D., Li, W. & Sanner, S., [OPINE-World: Programmatic World Modeling with Ontology-error-Prioritized Interactive Exploration](https://arxiv.org/abs/2607.01531), arXiv, 2026.
- Su, Y. et al., [CIll: CTI-Guided Invariant Generation via LLMs for Model Checking](https://arxiv.org/abs/2602.23389), arXiv, 2026.
- Ma, P. et al., [AutoSpec: Safety Rule Evolution for LLM Agents via Inductive Logic Programming](https://arxiv.org/abs/2606.24245), arXiv, 2026.

## 18. 이 문서를 읽는 규칙

- `확립`: 출판 문헌이나 명시적 수학 조건으로 뒷받침되는 내용
- `종합`: 여러 이론을 agent engineering에 맞게 연결한 이 프로젝트의 해석
- `가설`: 실험 전에는 결론으로 쓰지 않을 내용
- `미해결`: source audit, 이론, 실험이 더 필요한 내용

현재 핵심 명제는 `종합`이다. OGIS·CEGIS와 LLM을 직접 연결한 선례는 `확립`에 가깝지만 이를 general-purpose agent 전체의 보편 이론으로 확장하는 일은 아직 `가설`이다.
