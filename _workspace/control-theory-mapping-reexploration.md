# LLM agent loop의 제어이론적 재탐색

- 작성일: 2026-07-28
- 상태: control-theory mapping note v0.1
- 목적: LLM과 harness가 유지하는 여러 상태가 어떤 의미에서 제어계의 상태·관측·추정·제어 구조를 이루는지 분해하고, PID·MPC·적응제어·ILC·supervisory/hybrid control·POMDP belief control이라는 명칭을 붙일 수 있는 조건을 구분한다.
- 기준 문서: [LLM agent loop의 모델 대응과 수렴 조건](../reports/agent-loop-model-correspondence-and-convergence.md), [LLM Agent Loop 연구 노트](../reports/M4b-agent-loop-theory-reframing-note.md)
- 기본 범위: 추론 중 LLM weight를 갱신하지 않고, harness가 tool·environment와 반복 상호작용하는 agent를 기본 사례로 둔다.

## 0. 결론

사용자의 가설은 **시스템 수준에서는 맞다**. 다만 정확한 표현은 다음과 같다.

> LLM과 harness의 상태 조합은, 부분 관측된 환경에 대해 동작하는 비선형·확률적 **동적 출력피드백 controller**를 실현할 수 있다. Tool은 sensor와 actuator interface를 제공하고, harness는 controller memory·state estimator·mode supervisor를 제공하며, LLM은 이 controller 안의 조건부 policy 또는 proposal operator로 작동한다.

여기서 중요한 제한이 있다.

1. 이 명제는 **구조적 realization**에 관한 것이다. 이 구조를 갖췄다고 안정성·최적성·효율성이 자동으로 따라오지 않는다.
2. `plant`, `controller`, `observer`의 경계는 분석 목적에 따라 달라진다. 보편적인 component별 일대일 대응은 없다.
3. 일반적인 agent loop에 가장 강하게 대응하는 제어 모형은 `dynamic output feedback`과 `supervisory discrete-event control`이다.
4. `MPC`, `adaptive control`, `iterative learning control`, `PID`, `POMDP belief controller`는 각각 추가적인 구현 조건을 만족할 때만 성립한다.
5. agent의 성공은 흔히 점근적 안정화보다 **부분 관측 아래의 유한시간 goal-set reachability와 안전한 stopping** 문제다.

따라서 “agent loop가 효율적이니 내부적으로 제어기를 구현한다”보다 다음 문장이 더 정확하다.

> Harness가 외부 recurrence, 관측, 실행, 검증, mode 전환을 닫힌 경로로 연결하면 frozen LLM도 동적 output-feedback policy의 계산 블록으로 사용될 수 있다. 효율성은 그 폐루프의 관측성, 도달 가능성, estimator 품질, actuator fidelity, feedback delay, metric 정렬, robustness와 stopping에 달려 있다.

## 1. 먼저 경계를 고정한다

### 1.1 가장 유용한 system-control 경계

Agent가 repository, browser, service, user와 상호작용하는 문제에는 다음 경계가 가장 설명력이 높다.

```text
controller:
  LLM + prompt/state compiler + memory + selector + supervisor

sensor interface:
  read/search/test/query + parser + verifier measurement

actuator interface:
  write/execute/click/send/commit + permission/safety gate

plant:
  repository + process + browser + service + user-facing world
```

이 경계에서 LLM 자체는 plant가 아니다. LLM은 controller 내부에서 현재 reference, observation, controller memory를 action proposal로 바꾸는 비선형 확률적 계산 블록이다.

### 1.2 최소 상태공간 표현

다음 변수를 둔다.

| 기호 | 의미 |
| --- | --- |
| `x_t` | 실제 environment/plant state |
| `r_t` | 목표, 명세, 원하는 trajectory 또는 goal set |
| `o_t` | sensor·tool·verifier가 돌려준 raw observation |
| `b_t` | observer가 유지하는 plant state 또는 belief의 추정 |
| `m_t` | transcript, constraint ledger, best-so-far 등 controller memory |
| `q_t` | plan/act/test/rollback/stop 같은 supervisor mode |
| `v_t` | LLM이 제안하고 parser가 해석한 command |
| `u_t` | actuator가 실제 plant에 적용한 action |
| `d_t` | plant에 가해지는 외생 disturbance |
| `ν_t` | observation noise·누락·지연 |
| `ξ_t` | decoding·serving 등 controller 내부 확률성 |

Plant, controlled performance output, observation은 다음처럼 쓸 수 있다.

```text
x_(t+1) ~ F(x_t, u_t, d_t)
y^perf_(t+1) = G(x_(t+1))
o_(t+1) ~ H(x_(t+1), ν_(t+1))
```

`y^perf_t`는 실제로 제어하려는 결과이고, `o_t`는 controller가 볼 수 있는 측정값이다. 둘이 같지 않을 수 있다는 점이 agent의 proxy-metric 문제에서 중요하다.

Harness가 observer와 memory를 갱신한다.

```text
b_(t+1) = Est(b_t, u_t, o_(t+1))
m_(t+1) = Mem(m_t, r_t, o_(t+1), v_t, u_t, b_(t+1))
q_(t+1) = Sup(q_t, r_t, o_(t+1), b_(t+1), m_(t+1))
```

다음 model input과 action은 이 controller state의 일부를 선택해 계산한다.

```text
p_(t+1)
  = Serialize(Select(r_(t+1), o_(t+1), b_(t+1), m_(t+1), q_(t+1)))

model_text_(t+1)
  ~ P_theta(. | p_(t+1), ξ_(t+1))

v_(t+1)
  = Parse(model_text_(t+1))

u_(t+1)
  = Actuate(v_(t+1), q_(t+1), permissions, safety_constraints)
```

Controller state를 `c_t=(b_t,m_t,q_t)`로 합치면 표준적인 동적 출력피드백 형식과 같다.

```text
c_(t+1) ~ f_c(c_t, o_(t+1), r_(t+1); theta, ξ_(t+1))
u_(t+1) ~ g_c(c_(t+1), o_(t+1), r_(t+1); theta, ξ_(t+1))
```

충분한 state를 포함한 폐루프 상태는 다음이다.

```text
z_t = (x_t, c_t, actuator_internal_state_t)
z_(t+1) ~ F_closed_loop(z_t, r_t, d_t, ν_t, ξ_t)
```

이 표현은 넓은 의미에서 정확한 **system realization**이다. 그러나 `Est`, `Mem`, `Sup`, `P_theta`가 잘 설계되었다는 뜻은 아니다. 잘못된 summary와 잘못된 verifier를 가진 agent도 같은 형식으로 표현된다.

### 1.3 경계가 바뀌면 대응도 바뀐다

| 분석 목적 | plant로 두는 것 | controller로 두는 것 | 유용성 | 주의점 |
| --- | --- | --- | --- | --- |
| 실제 tool agent 제어 | repository·service·browser·user world | LLM+harness | 권장 기본 경계 | 세계 state와 prompt state를 분리할 수 있다. |
| artifact 반복 개선 | 현재 candidate artifact와 평가 과정 | proposal·edit·selection loop | optimization/CEGIS 분석에 유용 | 실제 외부 world 일부를 생략한다. |
| prompt·decoder 최적화 | LLM API를 input-output plant처럼 취급 | prompt optimizer·selector | model elicitation 실험에 유용 | task environment 제어와는 다른 폐루프다. |

따라서 “LLM이 plant인가 controller인가”에는 문맥 없는 단일 답이 없다. 사용자의 문제처럼 **LLM과 harness 상태의 조합이 외부 작업을 제어하는 방식**을 연구할 때는 `LLM+harness = controller`, `environment = plant`가 가장 일관된다.

## 2. 제어 구성요소의 기능적 대응

| 제어 구성요소 | LLM agent에서의 주 대응 | 실제 기능 | 동일시하면 안 되는 것 |
| --- | --- | --- | --- |
| plant | 파일·DB·browser·API·process·사용자와 현재 artifact | action을 받아 world state가 전이되는 대상 | LLM weight 또는 prompt 자체 |
| controlled output | 최종 artifact, DB state, test result, 사용자 효용, 안전 invariant | 제어가 원하는 방향으로 움직여야 하는 양 | verifier score 하나 |
| sensor / observation | read/search/test/API response, compiler log, user feedback, verifier output | 숨은 plant state의 일부를 측정 | plant state 전체 |
| observer / state estimator | structured world model, summary, retrieved facts, hypothesis set, version map, belief state | `u`와 `o`의 history에서 의사결정에 필요한 latent state를 추정 | transcript 원문이나 context window 자체 |
| controller | LLM policy + prompt compiler + selector + update rule | reference와 관측·추정 state로 command를 고름 | LLM 한 번의 forward pass만 |
| actuator | parser, tool executor, browser driver, patch applier, API client | proposed command를 실제 world transition으로 변환 | tool schema를 prompt에 보여 주는 것 |
| reference | 사용자 목표, acceptance criteria, desired output/trajectory, safety constraint | controller가 추적하거나 도달해야 할 기준 | 학습 loss 또는 token likelihood |
| disturbance | concurrent edit, API 변화, network failure, user requirement 변경, 외부 서비스 변동 | controller가 직접 명령하지 않은 plant 변화 | sampling noise 전체 |
| controller memory | transcript, typed observations, constraint ledger, best-so-far, budget, branch, previous command | history-dependent controller를 동적으로 만드는 내부 state | plant의 실제 상태 |
| supervisor | plan/act/test/rollback/stop mode, permission gate, budget rule, branch selector | 사용할 inner policy와 허용 action을 전환 | 자연어 “계획” text만 |

### 2.1 sensor, verifier, metric은 같은 것이 아니다

하나의 test runner가 여러 역할을 동시에 할 수 있으므로 interface보다 **기능**으로 구분해야 한다.

```text
raw sensor:
  exit code, stdout, stack trace, changed file hash

state estimator:
  "dependency mismatch가 현재 failure cause다"라는 추정

performance output:
  acceptance criteria 7개 중 5개 통과

metric:
  위 성능 출력을 하나의 scalar 0.71로 압축

supervisor guard:
  safety test 실패이므로 rollback mode로 전환
```

Verifier가 `pass/fail`만 내면 저대역폭 성능 sensor다. 구체적인 failing input을 내면 state estimation과 correction에 더 유용한 innovation을 제공한다. Harness가 verifier 결과를 읽지 않거나 action에 사용하지 않으면 측정은 있어도 feedback loop는 닫히지 않는다.

### 2.2 tool은 명칭이 아니라 호출별로 sensor 또는 actuator다

| tool action | 제어 역할 |
| --- | --- |
| `read_file`, `search`, `GET`, test 관찰 | sensor |
| `write_file`, `POST`, click, execute, commit | actuator |
| state를 읽고 동시에 바꾸는 transactional API | sensor + actuator |
| 허용되지 않은 command를 차단하는 wrapper | actuator constraint + supervisor |

Tool declaration이나 JSON schema는 actuator가 아니다. 그것은 controller가 사용할 수 있는 action alphabet과 argument contract를 알려 주는 interface description이다. 실제 execution과 그 결과 확인이 있어야 actuation이 완성된다.

### 2.3 disturbance와 noise를 위치별로 분리한다

| 불확실성 | 위치 | 예 |
| --- | --- | --- |
| plant disturbance `d_t` | 실제 환경 전이 | concurrent commit, API state change, 사용자 요구 변경 |
| measurement noise `ν_t` | sensor·serialization | truncated log, stale read, judge error, retrieval omission |
| controller noise `ξ_t` | action 계산 | token sampling, serving nondeterminism |
| actuator uncertainty | command와 실제 적용 사이 | partial write, parser mismatch, timeout 후 중복 실행 |
| model mismatch | estimator·planner 내부 모델과 plant 사이 | 잘못 추론한 API semantics, 오래된 repository map |

모든 실패를 “LLM stochasticity”로 묶으면 feedback design이 불가능해진다. 같은 output text가 나와도 actuator가 다르게 적용될 수 있고, 같은 plant state도 sensor가 다르게 관찰할 수 있다.

## 3. LLM과 harness의 상태는 제어계에서 무엇인가

| agent/model state | 가장 가까운 제어 역할 | 수명 | 정확한 해석 |
| --- | --- | --- | --- |
| model weights `θ` | controller의 고정 parameter와 학습된 prior/model | deployment 동안 느림 | 일반 inference loop에서는 state가 아니라 transition law의 parameter다. |
| system/user prompt | reference·constraint와 초기 observation의 encoding | 호출 단위 | 원하는 상태 자체가 아니라 controller input 표현이다. |
| 현재 context token | observation·reference·memory를 합친 encoded controller input | 호출 단위 | plant state와 같지 않다. |
| activation | controller 계산의 transient internal state | forward pass | 외부 loop의 persistent controller memory가 아니다. |
| KV cache | autoregressive controller evaluation cache | generation/request | task semantics를 가진 observer state가 아니다. |
| model output | proposed control command 또는 plan | step 단위 | actuator가 적용하기 전에는 plant action이 아니다. |
| transcript | raw measurement/action history | harness가 보존하는 동안 | observer의 입력 자료이며, 그 자체로 state estimate는 아니다. |
| summary | 압축된 finite-memory state 또는 근사 state estimate | 여러 step | 충분통계·unbiased estimate라는 보장은 없다. |
| retrieved memory | controller가 선택한 과거 observation/prior | step·session | 선택되지 않은 memory는 현재 controller input에 없다. |
| constraint ledger | reference/feasibility memory와 supervisor guard의 근거 | 여러 step | 단순 누적 text는 PID의 integral state가 아니다. |
| best-so-far snapshot | backup state와 monotone-selection 기준 | 여러 step | plant state를 직접 안정화하지 않지만 regression을 제한한다. |
| branch/checkpoint | controller search state와 reversible actuation support | 여러 step | physical plant가 되돌릴 수 있다는 뜻은 아니다. |
| iteration/budget | controller clock·resource state | run 동안 | plant state 또는 reference error가 아니다. |
| plan/act/test/stop mode | discrete supervisor state `q_t` | event 간 | hybrid/discrete-event 구조를 만드는 핵심 state다. |
| repository/browser/DB | plant state `x_t` | 외부 시스템 수명 | prompt에 설명된 replica와 실제 state를 구분해야 한다. |

핵심은 state의 **양**보다 update law다.

```text
같은 transcript를 저장함
!= 필요한 latent state를 추정함
!= 추정 state에 따라 action을 바꿈
!= action이 plant에 의도대로 적용됨
```

Harness state가 유효한 controller state가 되려면 적어도 identity, freshness, provenance, relevance, update semantics가 보존되어야 한다.

## 4. 왜 폐루프가 one-shot보다 효율적일 수 있는가

Agent loop의 장점은 “LLM이 스스로 반복한다”보다 다음 다섯 경로에서 나온다.

### 4.1 출력피드백이 open-loop model mismatch를 수정한다

One-shot action sequence는 실행 전 추정한 world model에 의존한다. 폐루프는 각 action 뒤 실제 observation을 다시 받아 예측 오차를 수정한다.

```text
innovation_(t+1)
  = observed_output_(t+1)
    - predicted_output_(t+1)
```

실제 agent observer가 선형 Kalman innovation을 계산한다는 뜻은 아니다. 구조적으로 `예상과 실제의 차이`가 다음 state estimate와 action을 바꾸는지가 핵심이다. Observer가 input과 output에서 state를 재구성한다는 고전적 구분은 [Luenberger의 state observer](https://doi.org/10.1109/TME.1964.4323124)와 [Kalman의 filtering formulation](https://doi.org/10.1115/1.3662552)에 직접 나타난다.

### 4.2 harness memory가 frozen LLM을 동적 controller로 만든다

독립된 model call은 persistent task state를 자동으로 보유하지 않는다. Harness가 `m_t`를 저장하고 다음 input을 바꾸면 전체 controller는 동적 시스템이 된다.

```text
fixed P_theta + changing controller memory
  => changing closed-loop policy
```

이 변화는 weight adaptation이 아니다. Controller parameter가 고정되어 있어도 controller state가 변하면 dynamic output-feedback law는 다른 action을 낼 수 있다.

### 4.3 grounded observation이 identifiability를 높인다

초기 prompt에서 구분되지 않던 여러 가능한 plant state가 test, read, query로 갈라지면 적절한 action을 선택할 수 있다. 기존 보고서의 `observability/identifiability` 조건은 제어이론에서 관측으로 내부 state를 구별할 수 있는지 묻는 문제와 연결된다.

그러나 observability는 boundary와 model class에 의존한다. 모든 stack trace가 충분한 observation은 아니며, harness가 중요한 field를 버리면 원래 sensor가 informative해도 controller에는 unobservable해진다.

### 4.4 supervisor가 비가역적 실패와 regression을 제한한다

Permission gate, hard validator, checkpoint, rollback, stop rule은 LLM의 natural-language 판단과 별도로 action space와 mode transition을 제한한다. 이 층은 안전한 set을 유지하고 잘못된 inner policy를 차단할 수 있다.

### 4.5 재계획은 긴 open-loop horizon을 짧게 만든다

멀리까지 한 번에 명령하는 대신 한두 action을 실행하고 다시 관측하면 model error가 장기간 누적되는 것을 줄일 수 있다. 다만 매번 다음 action만 고른다는 이유로 곧바로 MPC는 아니다. MPC에는 예측 모형과 유한 horizon 최적화가 추가로 필요하다.

### 4.6 기존 수렴 조건과 제어 개념의 연결

| 기존 loop 조건 | 가까운 제어 개념 | 정확한 경계 |
| --- | --- | --- |
| 유효 행동의 reachability | controllability·viability·reachability | 비선형·이산 agent에는 고전적 선형 controllability보다 goal-set reachability가 안전하다. |
| observation의 정보성 | observability·state estimation | log가 존재하는 것과 필요한 state가 reconstructible한 것은 다르다. |
| feedback의 actionability | feedback gain·control authority | prompt에 feedback을 넣어도 policy가 무시하면 gain이 사실상 0이다. |
| verifier validity | sensor calibration·performance output validity | proxy score는 실제 controlled output과 다를 수 있다. |
| retention과 enforcement | controller memory·constraint handling | 기억된 constraint가 actuator/supervisor에서 강제되지 않을 수 있다. |
| stability와 reversibility | robust stability·invariant set·recoverability | software task는 비가역 side effect와 discrete jump가 많다. |
| stopping과 absorption | terminal set·supervisory guard | 점근 안정화보다 valid set 도달 후 안전 종료가 흔한 목표다. |

즉 많은 상태의 조합이 효율을 만드는 것이 아니라 다음 닫힌 경로가 효율을 만든다.

```text
plant change
-> informative measurement
-> adequate state estimate
-> reference-conditioned action
-> faithful actuation
-> new plant change
```

## 5. 어떤 제어 유형과 언제 같은가

분류 강도를 세 수준으로 구분한다.

| 표기 | 의미 |
| --- | --- |
| `R` | broad realization: 정의를 넓게 적용하면 실제 구조로 표현 가능 |
| `C` | conditional correspondence: 명시한 구현 조건을 만족할 때 구조적으로 대응 |
| `A` | analogy only: 직관은 비슷하지만 핵심 연산이나 보장이 없음 |

### 5.1 Dynamic output-feedback control — `R`

다음 두 식을 구현하면 동적 출력피드백 controller로 표현할 수 있다.

```text
c_(t+1) = f_c(c_t, o_t, r_t)
u_t     = g_c(c_t, o_t, r_t)
```

Harness memory가 `c_t`, tool/verifier 결과가 `o_t`, LLM+harness action rule이 `g_c`에 해당한다. 대부분의 stateful tool agent는 이 수준의 realization을 만족한다.

하지만 다음은 따라오지 않는다.

- `c_t`가 plant의 충분한 state estimate라는 보장
- `f_c`, `g_c`가 안정화 controller라는 보장
- estimator와 controller를 독립적으로 설계해도 된다는 separation principle
- reference를 최적으로 추적한다는 보장

특히 LLM agent는 비선형·비매끄러운 policy, proxy metric, correlated model/judge error를 가질 수 있다. 선형 stochastic control에서의 separation theorem은 특정 가정 아래의 결과이며, 일반 agent에 자동 적용되지 않는다. 고전적 근거는 [Wonham의 stochastic separation theorem](https://doi.org/10.1137/0306023)이다.

### 5.2 PID control — 일반 agent에는 `A`, 명시적 오차 controller에는 `C`

이산 PID는 대략 다음 연산을 요구한다.

```text
e_t = r_t - y_t

u_t =
  K_P e_t
  + K_I sum_(k=0)^t e_k
  + K_D (e_t - e_(t-1))
```

Agent가 다음을 **명시적으로** 구현할 때만 PID 또는 PID-like controller라 부를 수 있다.

- 측정 가능한 동일 차원의 reference `r_t`와 output `y_t`
- 현재 error에 비례하는 correction
- 누적 error state
- error 변화율에 대한 correction
- gain과 saturation/anti-windup 규칙

자연어 critique가 현재 오류를 언급한다고 `P`가 되는 것은 아니다. Constraint ledger가 누적된다고 `I`가 되는 것도 아니고, score trend를 읽는다고 `D`가 되는 것도 아니다. 전형적인 LLM loop는 다변수·비선형·event-driven policy이므로 PID보다 general dynamic output feedback에 가깝다.

PID의 공식적 구성과 실무적 제한은 Åström과 Hägglund의 [공식 PID 소개](https://www.isa.org/getmedia/fb0e41bc-e4f3-422a-9f67-b9bd31340e16/Advanced-PID-Control_AstromHagglund_Chapter1-Introduction.pdf)에서 확인할 수 있다.

### 5.3 MPC / receding-horizon control — 조건을 만족하면 `C`

MPC의 식별 조건은 다음 네 개다.

1. 현재 plant state 또는 estimate를 initial state로 둔다.
2. 내부 dynamics model 또는 simulator로 horizon `H`의 결과를 예측한다.
3. state/action constraint 아래에서 action sequence를 최적화한다.
4. 최적 sequence의 첫 action만 적용한 뒤 새 observation에서 다시 푼다.

```text
u*_(t:t+H-1)
  = argmin J(x_hat_t, u_(t:t+H-1))
    subject to predicted dynamics and constraints

apply u*_t only
observe x_hat_(t+1)
solve again
```

이 정의는 [Mayne, Rawlings, Rao & Scokaert의 constrained MPC 정리](https://doi.org/10.1016/S0005-1098(99)00214-9)에 명시되어 있다.

Agent별 판정은 다음과 같다.

| agent 구조 | 판정 |
| --- | --- |
| 한 tool action을 생성하고 결과를 보고 다음 action 생성 | receding interaction이지만 MPC는 아님 |
| 여러 future action sequence를 simulator/tool sandbox에서 rollout하고 constraint·cost로 평가한 뒤 첫 action만 실행 | MPC-like |
| 자연어 plan 전체를 만들지만 미래 state를 예측·평가하지 않음 | plan generation이지 MPC가 아님 |
| branch search 뒤 한 branch 전체를 한 번에 실행 | finite-horizon planning이지만 receding-horizon 여부는 재계획 방식에 달림 |
| belief state에서 action-observation tree를 rollout | belief-space MPC 또는 online POMDP planning에 가까움 |

LLM의 내부 next-token prediction을 plant dynamics model이라고 간주해서는 안 된다. Task-relevant transition prediction이 action sequence 평가에 실제 사용되었는지 관찰 가능해야 한다.

### 5.4 Adaptive control — online identification과 controller 재설계가 있으면 `C`

적응제어는 단순히 다음 step에서 action이 바뀌는 것이 아니다. Unknown plant parameter를 observation으로 추정하고, 그 parameter estimate에 따라 controller law 또는 gain을 갱신하는 구조가 핵심이다.

```text
lambda_hat_(t+1)
  = Identify(lambda_hat_t, u_t, o_(t+1))

controller_parameter_(t+1)
  = Tune(lambda_hat_(t+1))
```

Åström과 Wittenmark의 self-tuning regulator는 least-squares estimator와 추정 model에서 계산한 minimum-variance regulator를 결합한다. [원 논문과 공식 서지](https://portal.research.lu.se/en/publications/on-self-tuning-regulators-2/)가 이 구분을 잘 보여 준다.

| agent 변화 | 적응제어인가 |
| --- | --- |
| 새 log를 prompt에 넣어 다음 action을 바꿈 | 아니오. controller state feedback이다. |
| transcript를 요약함 | 아니오. estimator/memory update다. |
| API latency·failure parameter를 온라인 추정해 timeout/retry gain을 바꿈 | adaptive-control-like |
| 사용자 preference model을 갱신하고 action policy parameter를 조정 | adaptive-control-like |
| online fine-tuning·adapter update로 controller parameter를 바꿈 | 넓은 의미의 adaptive policy일 수 있으나 안정성·식별 조건을 별도 검증해야 함 |
| model provider가 배포 중 몰래 version을 변경 | controller adaptation이 아니라 controller drift다. |

따라서 fixed-weight agent의 상태 변화와 adaptive control을 동일시하면 controller state와 controller parameter를 혼동한다.

### 5.5 Iterative learning control — 반복 trial 축이 있을 때만 `C`

ILC에는 두 시간축이 있다.

```text
j = 반복 trial index
k = 한 trial 내부의 time index

u_(j+1)(k)
  = u_j(k) + L(e_j(k))
```

동일하거나 충분히 반복 가능한 finite-duration task를 초기 상태로 reset하고, 이전 trial의 time-aligned error trajectory를 사용해 다음 trial의 input trajectory를 개선한다. Arimoto, Kawamura & Miyazaki의 원 논문은 이전 operation data로 다음 operation input을 개선하고 수렴 조건을 분석한다. [Bettering operation of Robots by learning](https://doi.org/10.1002/rob.4620010203)을 참고할 수 있다.

| agent 구조 | ILC 판정 |
| --- | --- |
| 한 run 안에서 patch → test → patch 반복 | 일반 feedback refinement; ILC가 아님 |
| 동일 workflow를 매일 같은 초기 조건에서 수행하고 step별 error를 다음 run의 action sequence에 반영 | ILC-like |
| 서로 다른 task를 episodic memory로 학습 | transfer/meta-learning일 수 있으나 전형적 ILC는 아님 |
| Reflexion text를 다음 trial에 전달 | 반복 task와 time alignment가 명확할 때만 느슨한 ILC analogy |
| environment가 trial마다 크게 달라짐 | repeatability 가정이 깨져 ILC 수렴 논리를 적용하기 어려움 |

Agent 연구에서 “iterative”라는 단어만 보고 ILC라고 부르면 가장 흔한 category error가 생긴다.

### 5.6 Supervisory control과 hybrid control — harness에 가장 강한 `C`

Harness가 mode와 guard를 명시하면 다음 switching structure가 생긴다.

```text
q_t in {
  inspect,
  plan,
  act,
  verify,
  rollback,
  ask_user,
  stop
}

q_(t+1)
  = Delta(q_t, observation, verifier_result, budget, safety_event)
```

각 `q_t`에서 사용할 prompt, model, tool, decoder, permission이 달라질 수 있다. 이 구조는 다음 두 계열과 대응한다.

- **Discrete-event supervisory control:** plant event 중 허용·차단할 event를 specification에 따라 정한다.
- **Hybrid/switching control:** discrete mode와 각 mode 안의 연속·확률·시간 dynamics를 함께 다룬다.

Ramadge와 Wonham은 discrete·asynchronous·nondeterministic process를 formal language generator로 모델링하고 target language를 만족하도록 supervisor를 구성한다. [원 논문](https://doi.org/10.1137/0325013)을 참고할 수 있다. Alur et al.은 discrete program과 연속 dynamics가 결합된 hybrid system을 finite automaton과 variables로 모델링한다. [원문 PDF](https://www.cis.upenn.edu/~alur/TCS95.pdf)를 참고할 수 있다.

정확한 분류 경계는 다음과 같다.

| harness 구조 | 판정 |
| --- | --- |
| mode, guard, 허용 tool, stop/rollback transition이 명시됨 | supervisory controller 또는 switching controller |
| 모든 transition이 discrete event이고 forbidden event를 wrapper가 차단 | Ramadge–Wonham-like supervisor |
| discrete mode와 latency·cost·continuous score·physical dynamics가 함께 있음 | hybrid-system model이 유용 |
| 단지 prompt에 “먼저 계획하고 실행하라”고 적음 | 명시적 supervisor라고 보기 어려움 |
| LLM이 언제나 permission을 우회할 수 있음 | hard supervisor가 아니라 advisory policy |

일반 agent harness에는 이 층이 MPC나 PID보다 더 직접적으로 존재한다.

### 5.7 POMDP history policy와 belief controller — 전자는 `R`, 후자는 `C`

Plant state가 직접 보이지 않고 observation만 확률적으로 주어질 때 POMDP로 모델링할 수 있다.

```text
POMDP = (S, A, T, O, Z, R, gamma)
```

Belief controller는 observation history를 state 확률분포로 압축하고 갱신한다.

```text
b_(t+1)(s')
  proportional_to
  Z(o_(t+1) | s', u_t)
  sum_s T(s' | s, u_t) b_t(s)

u_(t+1) = pi(b_(t+1))
```

부분 관측 Markov process와 관측 output의 관계는 [Smallwood & Sondik의 finite-horizon POMDP 원 논문](https://doi.org/10.1287/opre.21.5.1071)에 명시되어 있다. History policy, belief state, finite-memory controller의 구분은 [Kaelbling, Littman & Cassandra](https://doi.org/10.1016/S0004-3702(98)00023-X)에서 확인할 수 있다.

Agent별 판정은 다음과 같다.

| agent state | 판정 |
| --- | --- |
| transcript 전체를 조건으로 다음 action 선택 | POMDP의 history-dependent output-feedback policy로 모델링 가능 |
| summary 하나를 다음 prompt에 넣음 | finite-memory controller 또는 approximate information state |
| 가능한 root cause별 확률과 observation likelihood를 갱신 | explicit belief-controller-like |
| 자연어로 “아마 원인은 X”라고 씀 | latent-state hypothesis이지만 Bayesian belief라는 증거는 없음 |
| belief에서 action-observation tree를 simulator로 검색 | online POMDP planner에 가까움 |

POMCP는 Monte-Carlo belief update와 Monte-Carlo tree search를 결합한다. [Silver & Veness의 원 논문](https://papers.neurips.cc/paper_files/paper/2010/hash/edfbe1afcf9246bb0d40eb4d8027d90f-Abstract.html)을 기준으로 보면, 선형 ReAct loop는 branching simulation과 value backup이 없으므로 POMCP와 같지 않다.

### 5.8 Internal model principle — 제한된 regulation 문제에서만 `C`

제어이론의 internal model principle은 일반적인 “controller가 world model을 가진다”는 문장보다 훨씬 좁다. 특정 reference·disturbance signal class를 작은 plant 변화에도 정확히 추적·제거하려는 robust output regulation 문제에서, controller의 feedback path가 그 외생 signal dynamics의 적절한 model을 포함해야 한다는 결과다. [Francis & Wonham의 원 논문](https://doi.org/10.1016/0005-1098(76)90006-6)을 기준으로 해야 한다.

Agent에 적용할 때는 다음처럼 제한해야 한다.

| agent 구조 | 판정 |
| --- | --- |
| 반복되는 reference 변화나 disturbance pattern을 명시적으로 모델링하고 steady-state error를 제거 | internal-model-like regulation |
| 목표 text를 매 prompt에 다시 넣음 | reference injection일 뿐 internal model principle의 model은 아님 |
| LLM weight에 일반 world knowledge가 있음 | parametric prior이며 formal internal model이라는 근거는 없음 |
| constraint ledger가 과거 오류를 저장 | reference/constraint memory이며 disturbance generator model과 같지 않음 |

따라서 이 원리는 “성공한 LLM에는 세상의 완전한 model이 있다”는 근거가 아니다. 반복적으로 제거해야 할 reference/disturbance structure를 controller가 어떤 형태로 구현해야 하는지 묻는 제한된 설계 원리다.

### 5.9 한눈에 보는 판정표

| 제어 유형 | 일반 agent와의 기본 판정 | 성립에 필요한 추가 구조 |
| --- | --- | --- |
| dynamic output feedback | `R` | persistent controller state, observation-dependent action |
| PID | `A` | explicit error, P/I/D state와 gain |
| MPC / receding horizon | `C` | dynamics model, horizon optimization, constraints, first-action execution, replanning |
| adaptive control | `C` | online parameter identification과 controller parameter update |
| iterative learning control | `C` | repeatable reset trial, 두 시간축, cross-trial trajectory update |
| supervisory control | `C`에 가까움 | explicit modes, guards, controllable event/action restriction |
| hybrid control | `C` | discrete mode와 mode별 continuous/stochastic/time dynamics |
| POMDP history controller | `R` | partial observation과 history-conditioned policy |
| POMDP belief controller | `C` | explicit or validated information-state update와 belief-based policy |

## 6. 전체 agent를 가장 정확히 부르면 무엇인가

일반 tool-using agent의 최소 설명은 다음이다.

> 부분 관측된 비선형·확률적 plant에 대해 동작하는 finite-memory dynamic output-feedback controller

Mode, rollback, permission, stop이 명시되면 다음이 더 정확하다.

> supervisory switching layer가 감싼 partially observed stochastic output-feedback controller

Rollout model과 horizon optimizer까지 있으면 다음처럼 확장된다.

> supervisor + approximate observer/belief state + receding-horizon planner + LLM proposal policy

이 계층 구조에서 한 구성요소가 여러 역할을 공동 수행할 수 있다.

```text
reference/specification
          |
          v
supervisor q_t
  | mode · guard · permission · stop · rollback
  v
observer / memory (b_t, m_t)
  ^                         |
  | raw observation         | estimated information state
sensor/tools                v
  ^                 LLM + selector policy
  |                         |
plant x_t <--- actuator <---+ proposed command
```

LLM 하나가 observation 해석, latent-state 추정, 계획, action 생성을 한 forward generation에서 뒤섞어 수행할 수 있다. 따라서 diagram의 블록은 **기능적 분해**이지 neural module의 물리적 분해가 아니다.

## 7. 단순 비유가 깨지는 지점

### 7.1 “성공한 regulator는 world model을 가진다”를 과장하면 안 된다

Conant와 Ashby의 good-regulator theorem은 특정 optimality·simplicity 설정에서 regulator와 regulated system 사이의 model 관계를 논한다. [원 논문](https://doi.org/10.1080/00207727008920220)이 “exact assumptions”를 전제로 한다.

Agent가 좋은 성능을 냈다는 관찰만으로 다음을 결론낼 수 없다.

- LLM activation 안에 명시적 state-space model이 있다.
- harness summary가 plant와 isomorphic하다.
- model이 causal transition kernel을 정확히 학습했다.
- 모든 성공 agent가 explicit simulator를 사용한다.

Reactive policy도 task-relevant regularity를 이용해 성공할 수 있고, 외부 tool·repository 자체가 필요한 정보를 보관할 수 있다. “model을 가진다”는 말은 task-relevant input-output regularity를 구현한다는 기능적 수준과 명시적 world-state simulator를 구분해야 한다.

### 7.2 observer와 controller를 임의로 분리할 수 없다

선형 시스템의 observer-based control에서는 특정 조건 아래 estimator와 state-feedback controller를 분리 설계할 수 있다. 일반 LLM agent에서는 다음 문제가 있다.

- estimator와 policy가 같은 LLM과 prompt를 공유한다.
- verifier와 generator가 같은 bias를 공유할 수 있다.
- summary error가 다음 query 자체를 바꿔 future observation distribution을 바꾼다.
- action은 world를 바꾸는 동시에 무엇을 관찰할지도 바꾼다.
- nonlinear, nonstationary, partially known plant에 classical separation principle이 자동 적용되지 않는다.

따라서 observer accuracy를 단독 metric으로 높였다고 closed-loop utility가 반드시 좋아지지 않는다. State representation은 downstream control value로 평가해야 한다.

### 7.3 agent goal은 흔히 numeric setpoint가 아니다

자연어 목표는 다목적·계층적·불완전 specification일 수 있다.

```text
correctness
+ safety
+ style
+ latency
+ cost
+ user preference
```

이것을 scalar reference 하나로 압축하면 trade-off와 hidden constraint가 사라진다. 제어 분석에서는 scalar tracking error보다 goal set, temporal logic constraint, viability, reach-avoid objective가 더 적합할 수 있다.

### 7.4 verifier score는 physical sensor와 다르다

온도 sensor는 측정 noise가 있어도 대체로 같은 physical variable을 겨냥한다. LLM judge나 test suite는 실제 utility의 일부만 측정하고 최적화에 의해 exploit될 수 있다.

```text
high proxy score
!= correct plant state
!= user utility
!= safety
```

Agent loop에서는 sensor noise뿐 아니라 **measurement construct 자체의 validity**가 문제다. 이는 기존 보고서의 metric defect와 직접 연결된다.

### 7.5 context는 Markov state라는 보장이 없다

State-space 분석은 선택한 state가 future evolution에 충분하다고 가정한다. Transcript·summary·retrieval은 다음 이유로 Markov하지 않을 수 있다.

- 중요한 environment variable이 한 번도 관측되지 않음
- summary가 provenance와 version을 삭제함
- hidden tool session이 prompt에 없음
- provider·service behavior가 시간에 따라 바뀜
- branch가 섞여 같은 serialized context가 다른 실제 world를 가리킴

`z_t`를 충분히 크게 정의하면 수학적으로 Markovization할 수 있어도 실제 harness가 그 state를 관측·복원할 수 있다는 뜻은 아니다.

### 7.6 고전적 안정성과 task completion은 다르다

제어의 안정성은 작은 perturbation에 대한 boundedness나 equilibrium 주변 수렴을 뜻할 수 있다. Agent task는 보통 다음 목표다.

```text
finite budget 안에 valid goal set에 도달
+ forbidden set 회피
+ valid artifact 보존
+ stop
```

따라서 같은 답을 반복하는 fixed point는 틀린 상태의 안정화일 수 있다. 반대로 성공 후 stop한 finite trace는 점근적 안정성을 정의할 필요가 없다.

### 7.7 event-driven software plant는 시간과 action이 불규칙하다

- tool latency가 variable하고 observation이 delayed될 수 있다.
- action이 discrete, typed, non-differentiable하다.
- side effect가 비가역적일 수 있다.
- action space가 tool schema와 permission에 따라 바뀐다.
- user가 중간에 reference를 바꿀 수 있다.

연속시간 LTI intuition을 그대로 옮기기보다 discrete-event, hybrid, stochastic reachability가 더 적합하다.

### 7.8 actuator mismatch가 model reasoning failure처럼 보일 수 있다

LLM이 올바른 command를 제안해도 parser, cwd, credential, transaction, retry가 다르게 적용하면 plant가 예상과 다르게 변한다.

```text
proposed command v_t
!= applied action u_t
!= realized transition x_(t+1)
```

제어 관점에서 세 값을 따로 기록하지 않으면 controller, actuator, plant model의 실패를 구분할 수 없다.

### 7.9 feedback delay와 gain의 직관은 유용하지만 수치 증명이 필요하다

긴 log delay, stale summary, 매 critique마다 전체 artifact를 다시 쓰는 high-gain policy는 oscillation과 regression을 만들 수 있다. 그러나 “agent가 진동한다”는 관찰만으로 control-theoretic pole이나 gain margin을 주장할 수는 없다. Replay에서 delay·feedback intensity를 조작해 closed-loop response를 측정해야 한다.

## 8. Loop engineering에 바로 적용할 진단 변수

기존 instrumentation에 다음 제어 분해를 명시하면 원인 식별력이 높아진다.

```json
{
  "reference": {
    "goal_hash": "sha256:...",
    "constraint_set_hash": "sha256:...",
    "reference_version": 3
  },
  "plant": {
    "state_before_hash": "sha256:...",
    "state_after_hash": "sha256:...",
    "exogenous_event_ids": ["d-17"]
  },
  "sensor": {
    "raw_observation_blob": "blob:sha256:...",
    "observed_at": "logical-time",
    "plant_version_observed": 12
  },
  "observer": {
    "estimated_state_blob": "blob:sha256:...",
    "belief_or_hypothesis_ids": ["h1", "h2"],
    "prediction_blob": "blob:sha256:...",
    "innovation_blob": "blob:sha256:..."
  },
  "controller": {
    "memory_hash": "sha256:...",
    "mode": "verify",
    "serialized_input_blob": "blob:sha256:...",
    "proposed_command_blob": "blob:sha256:..."
  },
  "actuator": {
    "parsed_command_blob": "blob:sha256:...",
    "applied_action_blob": "blob:sha256:...",
    "execution_receipt_blob": "blob:sha256:..."
  },
  "performance": {
    "proxy_output": 0.81,
    "gold_output": null,
    "stop_guard": "continue"
  }
}
```

특히 다음 세 차이를 보존해야 한다.

```text
raw observation
!= estimated state

proposed command
!= applied action

proxy output
!= gold controlled outcome
```

## 9. 제어 유형을 실증적으로 판정하는 최소 검사

| 주장 | 관측하거나 조작할 것 | 반증 조건 |
| --- | --- | --- |
| output feedback다 | 같은 controller state에서 observation만 바꾼 paired replay | observation 변화가 action distribution에 인과 효과가 없음 |
| observer가 있다 | prediction, measurement residual, estimated latent state를 별도 기록 | 저장된 값이 raw transcript 복사이고 latent-state prediction력이 없음 |
| PID다 | `e`, P/I/D term, gain, saturation을 log | 해당 연산이 없고 자연어 critique만 존재 |
| MPC다 | dynamics rollout, horizon objective, constraints, optimized sequence, first applied action | 미래 state 예측·sequence optimization 없이 다음 action만 생성 |
| adaptive control이다 | plant parameter estimate와 controller parameter update를 분리 기록 | action만 변하고 parameter estimate/controller parameter는 고정 |
| ILC다 | trial `j`와 within-trial `k`, reset condition, cross-trial update 기록 | 같은 run의 단일 time axis만 존재 |
| supervisor다 | mode, guard, enabled/disabled action set, hard enforcement 기록 | mode가 자연어 text일 뿐 action availability를 바꾸지 않음 |
| POMDP belief controller다 | normalized belief/hypothesis weights와 observation-conditioned update | transcript·summary만 있고 belief semantics·calibration이 없음 |

이 검사는 명칭을 붙이기 위한 최소 조건이다. 해당 조건을 통과해도 안정성·성능 theorem의 추가 가정은 별도 검증해야 한다.

## 10. 이 재탐색이 제시하는 연구 방향

### 10.1 첫 연구 단위는 “state 수”가 아니라 폐루프 channel이다

다음 channel을 각각 끊거나 교체한다.

1. plant → sensor: raw observation의 coverage·delay·noise
2. sensor → observer: summary·belief·version state의 추정 오차
3. observer → controller: state field가 action을 바꾸는 인과 효과
4. controller → actuator: proposal과 actual action의 fidelity
5. actuator → plant: transition model mismatch와 side effect
6. performance output → supervisor: accept·rollback·stop의 정렬

### 10.2 가장 먼저 할 paired experiment

```text
A. exact same plant checkpoint + exact same controller memory
B. observation만 production / oracle / stale / masked로 교체
C. proposed command와 applied action을 모두 기록
D. 동일 continuation budget으로 gold goal-set hitting을 비교
```

이 실험은 `sensor defect`, `observer defect`, `controller utilization defect`, `actuator defect`를 기존의 task/metric/state/policy 분류보다 더 물리적인 channel로 세분한다.

### 10.3 이후 제어별 실험

| 질문 | 실험 |
| --- | --- |
| 짧은 폐루프가 open-loop plan보다 나은가 | action batch horizon `1,2,4,8` sweep; model error와 cost-to-go 비교 |
| stale feedback이 진동을 만드는가 | observation delay를 인위적으로 `0,1,2,4` step 삽입 |
| observer state가 충분한가 | full history, summary, structured belief, oracle state 비교 |
| supervisor가 regression을 막는가 | rollback·hard guard·best-so-far 각각 ablation |
| MPC-like rollout이 필요한가 | 동일 proposal model에서 rollout horizon과 simulator fidelity factorial |
| adaptation인가 단순 memory인가 | controller parameter freeze/update와 controller state freeze/update를 교차 |
| ILC 조건이 있는가 | 동일 task reset trial과 nonrepeatable task를 분리해 cross-trial error 감소 비교 |

### 10.4 성공 판정

Agent task에는 다음 지표가 고전적 steady-state error 하나보다 적합하다.

```text
goal-set hitting probability by budget
time/cost to first valid state
forbidden-set reach probability
regression after first valid state
observer prediction error
command-to-actuation mismatch
feedback delay sensitivity
reference-change tracking error
```

## 11. 최종 명제

현재 근거로 가장 방어 가능한 명제는 다음이다.

> LLM agent loop의 실용적 효율은 LLM 내부에 고전적 controller가 독립 module로 존재해서라기보다, harness가 model inference를 observation-dependent action law로 감싸고 외부 memory·tool sensing·actuation·verification·supervision을 연결하여 동적 output-feedback system을 구성하기 때문에 발생할 수 있다.

그리고 분류는 다음 순서가 안전하다.

```text
기본:
  dynamic output feedback

부분 관측과 state 추정이 핵심:
  finite-memory / approximate belief controller

mode·permission·rollback·stop이 핵심:
  supervisory or switching control

미래 rollout과 첫 action 재계획이 있음:
  MPC-like / online planning

plant parameter를 추정해 controller를 바꿈:
  adaptive control

같은 finite-horizon task를 reset 반복해 trajectory를 학습:
  ILC-like

명시적 P/I/D error law가 있음:
  PID
```

따라서 다음 단계의 loop engineering은 prompt 기법 비교가 아니라 `plant–sensor–observer–controller–actuator–supervisor` channel별로 state identity와 인과 효과를 계측하는 방향으로 가야 한다.

## 12. 1차 문헌과 공식 원문

### 상태공간, observer, output feedback

- Kalman, R. E. (1960), [A New Approach to Linear Filtering and Prediction Problems](https://doi.org/10.1115/1.3662552), *Journal of Basic Engineering* 82(1), 35–45.
- Luenberger, D. G. (1964), [Observing the State of a Linear System](https://doi.org/10.1109/TME.1964.4323124), *IEEE Transactions on Military Electronics* 8(2), 74–80.
- Wonham, W. M. (1968), [On the Separation Theorem of Stochastic Control](https://doi.org/10.1137/0306023), *SIAM Journal on Control* 6(2), 312–326.

### Predictive, adaptive, iterative control

- Mayne, D. Q., Rawlings, J. B., Rao, C. V. & Scokaert, P. O. M. (2000), [Constrained Model Predictive Control: Stability and Optimality](https://doi.org/10.1016/S0005-1098(99)00214-9), *Automatica* 36(6), 789–814.
- Åström, K. J. & Wittenmark, B. (1973), [On Self-Tuning Regulators](https://portal.research.lu.se/en/publications/on-self-tuning-regulators-2/), *Automatica* 9(2), 185–199.
- Arimoto, S., Kawamura, S. & Miyazaki, F. (1984), [Bettering Operation of Robots by Learning](https://doi.org/10.1002/rob.4620010203), *Journal of Robotic Systems* 1(2), 123–140.

### Supervisory, hybrid, regulation

- Ramadge, P. J. G. & Wonham, W. M. (1987), [Supervisory Control of a Class of Discrete Event Processes](https://doi.org/10.1137/0325013), *SIAM Journal on Control and Optimization* 25(1), 206–230.
- Alur, R. et al. (1995), [The Algorithmic Analysis of Hybrid Systems](https://www.cis.upenn.edu/~alur/TCS95.pdf), *Theoretical Computer Science* 138(1), 3–34.
- Francis, B. A. & Wonham, W. M. (1976), [The Internal Model Principle of Control Theory](https://doi.org/10.1016/0005-1098(76)90006-6), *Automatica* 12(5), 457–465.
- Conant, R. C. & Ashby, W. R. (1970), [Every Good Regulator of a System Must Be a Model of That System](https://doi.org/10.1080/00207727008920220), *International Journal of Systems Science* 1(2), 89–97.

### Partial observability와 online planning

- Smallwood, R. D. & Sondik, E. J. (1973), [The Optimal Control of Partially Observable Markov Processes over a Finite Horizon](https://doi.org/10.1287/opre.21.5.1071), *Operations Research* 21(5), 1071–1088.
- Kaelbling, L. P., Littman, M. L. & Cassandra, A. R. (1998), [Planning and Acting in Partially Observable Stochastic Domains](https://doi.org/10.1016/S0004-3702(98)00023-X), *Artificial Intelligence* 101(1–2), 99–134.
- Silver, D. & Veness, J. (2010), [Monte-Carlo Planning in Large POMDPs](https://papers.neurips.cc/paper_files/paper/2010/hash/edfbe1afcf9246bb0d40eb4d8027d90f-Abstract.html), *NeurIPS 23*, 2164–2172.
