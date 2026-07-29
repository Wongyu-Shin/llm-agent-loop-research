# Loop engineering을 위한 원인 식별 실험 설계

작성일: 2026-07-23  
상태: synthetic diagnostic pilot 제안  
목적: agent loop의 실패를 `task`, `metric`, `state`, `policy` 중 어느 기능층의 문제인지 인과적으로 구분한다.  
실증 근거: [LLM agent loop: 선행연구 기반 증거 종합](agent-loop-prior-research-synthesis.md)

## 0. 결론과 기존 연구에 대한 추가점

이 저장소의 기존 연구는 이미 다음을 갖고 있다.

- [`M4b-agent-loop-necessity-study-protocol.md`](../reports/M4b-agent-loop-necessity-study-protocol.md): one-shot, self-reflection, grounded feedback, verifier, rollback, memory 조건의 비교
- [`M4b-agent-loop-theory-reframing-note.md`](../reports/M4b-agent-loop-theory-reframing-note.md): POMDP, OGIS/CEGIS, verifier-guided adaptive search라는 이론적 프레임
- [`m4b_tiny_pilot_runner.py`](../scripts/m4b_tiny_pilot_runner.py): 후보별 exact-match verifier와 5개 조건의 실제 실행
- [`M4b-agent-loop-necessity-tiny-pilot-report.md`](../reports/M4b-agent-loop-necessity-tiny-pilot-report.md): pass/fail만 돌려준 grounded loop가 최초 실패를 고치지 못하고 self-reflection이 정답을 오답으로 바꿀 수 있다는 작은 관찰

그러나 현재 조건들은 한 번에 여러 요소를 바꾼다. 예를 들어 `C6`는 feedback, 반복 횟수, selection, state 사용 방식이 동시에 달라지므로 실패가 metric 때문인지, state update 때문인지, 다음 행동을 고르는 policy 때문인지 식별할 수 없다. 기존 로그도 후보와 최종 pass/fail은 보존하지만, 매 step의 정확한 환경 snapshot, model input, state field, metric response, stop/rollback 결정을 재구성하기에는 부족하다.

따라서 다음 empirical layer의 핵심은 더 큰 benchmark가 아니라 **개별 기능층을 교체해도 나머지는 그대로인 실험**이다.

> 먼저 planted ground truth가 있는 작은 환경에서 `2^4` 완전요인 실험으로 주효과와 상호작용을 찾고, 동일 checkpoint에서 paired forward replay를 실행해 해당 효과가 실제로 결과를 바꾸는지 확인한다. 성공을 판정하는 gold evaluator는 loop가 보는 online metric과 반드시 분리한다.

이 프로토콜은 agent system 수준의 기능적 원인을 식별한다. 이것만으로 transformer 내부의 특정 attention head, activation, 또는 학습된 algorithm이 그 기능을 구현한다고 결론 내릴 수는 없다. 그 주장은 별도의 activation intervention이 필요하다.

## 1. 원인 층의 조작적 정의

한 step을 다음처럼 둔다.

```text
e_t                    : 실제 환경 상태
x_t                    : harness가 보존한 외부 state
c_t = Serialize(x_t)   : 모델에 실제로 들어간 context
a_t ~ pi(c_t, r_<t)    : policy가 고른 action
e_(t+1) = F_T(e_t,a_t) : task/environment transition
o_t = G_T(e_(t+1))     : tool/environment observation
r_t = M(o_t, a_t, x_t) : loop가 보는 online metric/feedback
x_(t+1) = U(x_t,a_t,o_t,r_t)
Y* = Gold(T, trajectory, e_final)
```

| 층 | 이 실험에서의 경계 | 포함 | 포함하지 않음 |
|---|---|---|---|
| `Task T` | 목표, 허용 action/tool, 환경 transition·observation, horizon, 가역성 | 명세 모순, 필요한 정보의 관측 불가능, 지연된 효과, side effect 구조 | 평가기의 오판, state 유실, action 선택 오류 |
| `Metric M` | candidate·trace를 score, pass/fail, critique, counterexample로 바꾸는 함수 | false positive/negative, proxy-gold 불일치, feedback granularity·delay | raw tool output 자체, score를 이용하는 선택 규칙 |
| `State S` | 외부에서 지속되는 값과 그 update·projection | 목표/제약 ledger, observation, 환경·artifact version, best-so-far, rollback snapshot, budget, provenance | 동일한 serialized context를 보고 다음 action을 고르는 계산 |
| `Policy P` | 주어진 context와 feedback에서 proposal, tool call, selection, rollback, stop을 고르는 규칙 | model+prompt의 action distribution, search/selection/stop rule | 환경 transition, verifier의 정답 여부, 저장 값 자체 |
| `Gold Y*` | 실험자가 사후에만 보는 실제 utility | hidden exhaustive checker, final DB goal state, minefield, 비용·side effect | loop의 online stop 신호 |

같은 LLM이 state summary도 쓰고 action도 생성할 수 있다. 이 경우 weights가 아니라 **호출의 기능적 역할**로 나눈다. summary-writer call의 결과는 `State`, 그 summary를 입력받아 action을 내는 call은 `Policy`로 취급한다. 그래야 각각을 독립적으로 교체할 수 있다.

raw observation과 metric도 분리한다. 예를 들어 unit-test stack trace는 environment observation이고, 이를 `0.2점` 또는 `"line 17을 고쳐라"`로 변환하는 것은 metric이다.

## 2. 원인 판정에 필요한 최소 반사실

production 설정을 `T₁,M₁,S₁,P₁`, 결함이 없는 reference 설정을 `T₀,M₀,S₀,P₀`라고 하자. `T₀/T₁`은 쉬움/어려움 같은 모호한 label이 아니라 동일 latent solution에서 한 task property만 바꾼 twin이어야 한다.

각 모듈 `X`에 두 효과를 측정한다.

```text
Repair_X =
  E[Y*(production에서 X만 reference로 교체)]
  - E[Y*(all production)]

Break_X =
  E[Y*(all reference)]
  - E[Y*(all reference에서 X만 production으로 교체)]
```

- `Repair_X > 0`: 이 실패에서 `X`를 고치는 것이 충분한가?
- `Break_X > 0`: 다른 층이 정상일 때도 결함 있는 `X`가 성공을 깨는가?
- 둘 다 재현되면 `X`의 원인성이 강하다.
- 단일 repair는 작지만 `Repair_{X,Z}`가 크면 공동 원인 또는 상호작용이다.
- production 실패 run만 골라 계산한 rescue rate는 선택 편향이 있으므로 설명용으로만 쓰고, 전체 randomized unit의 paired effect를 1차 추정치로 쓴다.

### 판정표

| 의심 원인 | 반드시 고정할 것 | 최소 개입 | 원인 지지 패턴 | 원인 반증 패턴 |
|---|---|---|---|---|
| Task | `M₀,S₀,P₀`, latent solution, budget | base/stress twin 또는 tool/observation availability만 변경 | all-reference에서도 stress twin만 실패하거나 비용 하한을 넘음. 또는 `T × X` 상호작용이 반복됨 | reference policy와 완전한 정보·metric에서 두 twin이 모두 안정적으로 성공 |
| Metric | task, candidate set/trajectory, state, selector | proxy를 oracle gold 또는 calibrated feedback으로 교체 | 동일 후보 중 gold-success가 있었고 oracle metric이 선택·수정을 구함 | metric 교체 후에도 같은 action/outcome이고 policy 강제 개입만 구함 |
| State | task, metric, policy, checkpoint의 환경 | state field 하나를 oracle/null/stale 값으로 교체 | oracle field가 구하고 정상 field를 stale하게 만들면 깨짐 | exact same context에서 policy swap만 효과가 있음 |
| Policy | task, metric, exact serialized context, tools | reference policy 또는 oracle action을 해당 step에 삽입 | 동일 state에서 action distribution과 gold outcome이 개선됨 | policy를 바꿔도 metric 또는 state를 고치기 전에는 결과 변화 없음 |

중요한 추가 구분은 다음과 같다.

- stress task에서만 `Metric` 결함이 드러났다면 root cause를 무조건 `Task`라 부르지 않는다. 판정은 `Task × Metric interaction`이다.
- metric 점수는 맞지만 selector가 그 점수를 무시했다면 `Policy` 문제다.
- tool이 stale result를 반환하면 `Task/observation channel`, 정상 결과를 state update가 버리면 `State` 문제다.
- exhaustive solver로 목표가 불가능함을 증명할 수 있을 때만 `Task infeasible`이라고 한다. 단지 현재 model이 못 풀었다는 이유로 task 문제라 하지 않는다.

## 3. Stage 0 — replay가 믿을 만한지 먼저 검증

counterfactual replay 전에 원래 trajectory를 재구성하지 못하면 개입 효과와 replay noise를 구분할 수 없다.

### 저장·복원 불변식

1. task specification, initial environment, allowed tool schema를 content hash로 고정한다.
2. 매 model call 직전의 exact serialized messages와 tool definitions를 보존한다.
3. 매 tool call 전후의 environment snapshot과 artifact version을 보존한다.
4. state field별 raw value 또는 content-addressed blob과 hash를 보존한다.
5. model/provider/version, decoding parameter, prompt template hash, random seed를 보존한다.
6. 동일 prefix에서 아무 개입도 하지 않은 reconstruction replay를 실행한다.

### precondition

| 항목 | 통과 조건 | 실패 시 |
|---|---:|---|
| environment/state snapshot hash | deterministic field `100%` 일치 | attribution 중단, recorder 수정 |
| deterministic tool output | `100%` 일치 | tool mock/sandbox 또는 nondeterminism 모델링 |
| local seeded policy action match | `>= 0.98` | seed/config/context 누락 조사 |
| hosted policy action match | 값 자체를 보고하며 고정 임계치 없음 | 단일 replay 결론 금지, 양 branch를 반복해 분포 비교 |
| gold evaluator planted self-test | `100%` | 실험 중단 |

temperature `0`도 hosted provider의 완전한 결정성을 보장하지 않는다. action match가 낮으면 “원 trajectory와 반사실 trajectory 한 개”를 비교하지 않고 동일 checkpoint에서 baseline과 intervention을 각각 `K`번 다시 뽑는다.

## 4. Stage 1 — `2^4` 완전요인 screening

### 4.1 요인과 두 수준

| 요인 | `0`: reference | `1`: production/stress |
|---|---|---|
| `T` | base twin: 짧은 horizon, fully observed, reversible 중 해당 실험에서 정한 한 수준 | stress twin: 같은 latent solution에서 horizon, observability, reversibility 중 **하나만** 변경 |
| `M` | exhaustive gold-correlated verifier + actionable violated constraint | 현재 proxy, coarse pass/fail, 또는 planted noisy verifier |
| `S` | canonical typed state + version/provenance + best-so-far snapshot | 현재 summary/state policy 또는 planted field loss/staleness |
| `P` | deterministic reference controller/solver, 단 제공된 state와 metric만 사용 | target model+harness policy |

각 latent instance에 16개 cell을 모두 실행한다. `2^(4-p)` fractional factorial은 싸지만 main effect와 중요한 2요인 interaction이 alias될 수 있다. 여기서는 `T×M`, `T×S`, `S×P`, `M×P`가 바로 연구 대상이므로 첫 screening에는 완전요인이 최소다.

reference policy가 정답을 미리 읽어서는 안 된다. production policy와 같은 tool·observation·state interface만 사용하되 synthetic task의 알려진 algorithm을 정확히 구현한다. 이 controller까지 실패하면 task generator, interface, budget, 또는 gold evaluator의 문제다.

### 4.2 실행 단위와 randomization

- 독립 단위: `latent_instance × seed`
- blocking: task family, latent instance, model version
- cell 실행 순서: block 내부 무작위화
- 공통 prefix가 있는 cell: initial state와 가능한 seed를 공유
- model/provider update 중간 혼입 방지: 한 block의 16 cell은 같은 짧은 시간 창에 실행
- retry: transport error만 동일 request id로 재시도하고, model failure를 retry로 지우지 않음
- budget: 모든 cell에 같은 hard action/tool/wall-time budget. reference controller가 더 싼 것은 그대로 cost metric에 반영

구조적으로 필요한 최소 cell 수는 instance당 16개다. replication 수는 미리 임의로 확정하지 말고 pilot variance로 power를 계산한다. 첫 diagnostic pilot 기본값은 task family당 `12 latent instances × 3 seeds × 16 cells = 576 runs`이다. 이는 출판용 검정력이 아니라 planted 원인을 회수하는 pipeline 검증용이다.

### 4.3 분석

binary gold success에는 instance random intercept가 있는 logistic model, normalized utility에는 linear mixed model을 쓴다.

```text
Y* ~ T + M + S + P
     + T:M + T:S + T:P + M:S + M:P + S:P
     + (1 | task_family/latent_instance)
     + (1 | seed_block)
```

주효과 평균만으로 root cause를 정하지 않는다. 다음 predeclared contrast를 우선한다.

| contrast | 질문 |
|---|---|
| all-reference vs `T₁,M₀,S₀,P₀` | 정상 infrastructure에서도 해당 task property가 성능을 낮추는가? |
| all-production vs `T₁,M₀,S₁,P₁` | metric만 고치면 production failure가 회복되는가? |
| all-production vs `T₁,M₁,S₀,P₁` | state만 고치면 회복되는가? |
| all-production vs `T₁,M₁,S₁,P₀` | policy만 고치면 회복되는가? |
| all-reference vs reference에서 모듈 하나만 production | 해당 결함의 break effect가 있는가? |
| single repair vs pair repair | 단일 원인인가, 공동 원인인가? |

`T`는 다른 세 모듈과 같은 “고칠 부품”이 아니다. all-reference에서의 task 효과와 `T×X`를 분리해 보고한다. 이 구분이 “작업 자체가 어려웠다”라는 사후 설명을 막는다.

## 5. Stage 2 — 기능별 ablation

factorial screening에서 효과가 보인 층만 세분화한다. 한 run 전체에서 여러 기능을 동시에 끄지 말고 동일 checkpoint의 한 field 또는 한 규칙만 바꾼다.

### 5.1 Task property ablation

동일 latent solution을 유지하면서 다음을 한 축씩 바꾼다.

| property | 수준 예 | 측정할 interaction |
|---|---|---|
| horizon | 필요한 commitment `2 / 6 / 12` | `horizon × state retention`, `horizon × stop policy` |
| observability | full state / informative query 필요 / 일부 비식별 | `observability × tool policy` |
| feedback delay | 즉시 / 3-step 지연 / final-only | `delay × metric granularity` |
| reversibility | free rollback / 비용 rollback / irreversible commit | `reversibility × checkpoint policy` |
| branching | 단일 경로 / 3개 동등 후보 / deceptive local optimum | `branching × exploration policy` |

task property는 한 번에 하나만 바꾼다. “long task”에 horizon, tool count, context size, verifier delay를 모두 함께 넣으면 어떤 성질이 moderator인지 알 수 없다.

### 5.2 Metric ablation

| ablation | 고정 | 교체 | 직접 지표 |
|---|---|---|---|
| correctness | exact same candidate set | oracle / calibrated noisy / adversarial proxy | selection regret, FP/FN |
| granularity | same truth value | scalar / pass-fail / violated clause / minimal counterexample | 다음 step constraint repair |
| coverage | same visible candidates | visible subset / exhaustive hidden checker | visible-hidden gap |
| delay | same feedback content | immediate / `d` step delayed / final-only | first-passage time, stale update |
| independence | same rubric | same-model judge / separate model / deterministic checker | correlated error, disagreement |

metric 실험의 가장 싼 조건은 **frozen-candidate reselection**이다. model을 다시 부르지 않고 같은 후보 집합을 proxy와 gold로 각각 선택한다. 여기서도 gold-success 후보가 없으면 generator/policy coverage 문제이지 metric selection 문제는 아니다.

### 5.3 State ablation

state를 한 덩어리 context length로 보지 말고 다음 field를 개별 조작한다.

| field | null intervention | corrupt/stale intervention | oracle intervention |
|---|---|---|---|
| goal/acceptance contract | field 제거 | 조건 하나 반전 | canonical spec 복원 |
| observation/evidence | 최근 결과 제거 | 다른 instance 결과 삽입 | raw verified result 복원 |
| constraint/hypothesis ledger | 실패 제약 제거 | 이미 반증된 가설을 active로 표시 | complete typed ledger |
| environment/artifact version | version 제거 | `t-1` snapshot id | current snapshot |
| best-so-far/proof | candidate 제거 | worse candidate를 best로 표시 | gold-best visible candidate와 proof |
| action/side-effect ledger | call 제거 | success/failure bit 반전 | exact transaction log |
| budget/termination state | budget 제거 | 남은 budget 오기 | exact remaining budget |

null ablation만으로는 “field가 없어서”와 “context가 짧아져서”를 구분하기 어렵다. 길이가 같은 neutral placeholder control을 함께 둔다. source trajectory의 field를 target trajectory에 이식하는 state-swap은 값의 causal role을 강하게 시험하지만, schema와 task phase가 같은 pair에서만 수행한다.

### 5.4 Policy ablation

exact serialized context를 고정하고 다음 decision module을 한 번에 하나씩 교체한다.

| module | production | reference intervention |
|---|---|---|
| proposal | 현재 decoding/search | enumerated valid actions 또는 oracle proposal 포함 |
| tool/query choice | model 선택 | value-of-information가 최대인 query |
| feedback interpretation | free-form revision | violated constraint를 typed update로 변환 |
| candidate selection | 현재 selector | gold-blind calibrated selector; metric score 규칙 준수 |
| rollback | model 판단 | verified regression이면 best checkpoint 복구 |
| stopping | model/harness 규칙 | predeclared success/plateau/cycle/budget rule |

oracle proposal을 후보 집합에 추가했는데도 선택하지 못하면 selection/metric 문제다. oracle action을 해당 step에 강제한 뒤 production policy가 downstream에서 성공하면 그 step의 policy decision이 causal bottleneck이다.

## 6. Stage 3 — paired replay와 counterfactual intervention

### 6.1 두 replay mode를 섞지 않는다

| mode | 용도 | downstream |
|---|---|---|
| frozen-trace replay | metric, evaluator, selector만 검사 | 기록된 candidate/trajectory를 그대로 사용; model/tool 재실행 없음 |
| forward counterfactual replay | state, observation, action, policy의 결과 효과 검사 | intervention 시점 이후 action과 observation을 새로 생성 |

state를 바꾼 뒤 과거의 downstream tool result를 그대로 붙이면 존재할 수 없는 trajectory가 된다. forward replay에서는 prefix만 고정하고 개입 이후 환경을 실제로 전개한다.

### 6.2 한 checkpoint의 실행 절차

1. baseline trajectory에서 의심 step `k` 직전 checkpoint를 복원한다.
2. task, prefix, environment, budget, policy/metric version을 고정한다.
3. baseline branch에는 원래 값, intervention branch에는 단 하나의 대체 값을 넣는다.
4. 가능한 경우 동일 seed/common random numbers로 두 branch를 pair한다.
5. 두 branch 모두 `k` 이후를 끝까지 재실행한다.
6. stochastic policy이면 seed당 한 path를 원인으로 보지 않고 `K`개의 outcome distribution을 비교한다.
7. `k+1`에도 같은 종류의 intervention을 해 effect가 이미 commitment 이후 사라지는지 확인한다.
8. single-step effect가 없는데 interaction이 의심되면 두 field/step의 joint intervention과 budget-bounded Shapley estimate를 추가한다.

paired causal effect는 다음처럼 계산한다.

```text
Delta_X(k) = (1/K) * sum_j [
  Y*_(j)(do(X_k = reference))
  - Y*_(j)(do(X_k = production))
]
```

baseline observed outcome 하나를 여러 counterfactual sample과 직접 빼지 않는다. baseline도 같은 checkpoint에서 다시 sample한다.

### 6.3 지원해야 할 intervention

```text
do_metric(k, feedback_or_score)
do_state(k, json_pointer, replacement)
do_observation(k, replacement_tool_result)
do_action(k, forced_tool_call_or_answer)
do_policy(k, policy_fingerprint)
do_stop(k, continue_or_stop)
do_rollback(k, checkpoint_id)
```

각 replacement는 `oracle`, `null`, `stale`, `corrupt`, `source_run`, `reference_policy` 중 provenance를 가져야 한다. “프롬프트를 더 좋게 바꿈”처럼 여러 token과 규칙을 동시에 바꾼 intervention은 탐색에는 쓸 수 있지만 원인 식별 실험에는 쓰지 않는다.

### 6.4 root-cause label 규칙

1. gold outcome의 paired `Repair_X`와 `Break_X`를 계산한다.
2. proxy score만 좋아지고 gold가 좋아지지 않으면 repair로 세지 않는다.
3. single-module repair가 practical threshold를 넘으면 그 층을 candidate root로 둔다.
4. corresponding break와 negative control이 통과하면 `causal` label을 준다.
5. 두 module의 joint repair만 유효하면 `X×Z` joint cause로 둔다.
6. all-reference도 실패하면 exhaustive feasibility와 interface reachability를 확인한다.
7. 증거가 부족하면 가장 큰 점추정치에 label을 붙이지 않고 `inconclusive`로 남긴다.

## 7. 측정 지표

### 7.1 primary outcome

online metric과 독립인 `Y*`를 1차 outcome으로 한다.

```text
gold_utility =
  gold_task_success
  - lambda_cost * normalized_cost
  - lambda_side_effect * side_effect_count
  - lambda_regression * verified_regression_count
```

가중치는 결과를 본 뒤 정하지 않는다. binary success와 각 penalty component도 별도로 보고해 가중합이 실패를 숨기지 않게 한다.

### 7.2 원인 식별 지표

| 지표 | 정의 | 진단 |
|---|---|---|
| paired gold effect | `E[Y*(do X₀)-Y*(do X₁)]` | 모듈 repair/break 효과 |
| rescue rate | baseline failure 중 intervention success 비율 | 설명용; 1차 ATE 아님 |
| harm rate | baseline success 중 intervention failure 비율 | regression 유발 |
| selection regret | `max_c Y*(c) - Y*(selected_M)` | metric/selector 손실 |
| oracle-candidate coverage | candidate set에 gold-success가 존재한 비율 | proposal policy vs selection 분리 |
| metric FP/FN/calibration | gold label 대비 online accept/score | metric 정확도 |
| state-field causal sensitivity | field별 paired gold effect | 필요한 state 최소집합 |
| action recovery | oracle action 강제 후 downstream success | policy의 pivotal decision |
| interaction effect | joint intervention effect minus single effects | 공동 원인 |

상관계수 하나는 metric quality가 아니다. candidate의 상위 tail을 반복 선택할 때 생기는 error가 중요하므로 calibration, top-1 regret, optimization depth별 proxy-gold curve를 함께 본다.

### 7.3 수렴·신뢰성·비용 지표

| 지표 | 정의 |
|---|---|
| first-passage step | gold-success state에 처음 도달한 step; online loop에는 숨김 |
| best-so-far retention | 이전 verified-best보다 나빠지지 않은 step 비율 |
| regression-after-revision | revision 뒤 gold criterion이 깨진 비율 |
| constraint retention | 이미 받은 violated constraint를 이후 후보가 다시 위반하지 않는 비율 |
| cycle rate | 동일 `(env_hash,state_hash,artifact_hash,pending_goal)` 재방문 비율 |
| progress slope | iteration에 따른 gold와 proxy 각각의 변화 |
| proxy-gold divergence | proxy는 상승하지만 gold는 하락하는 run 비율 |
| reliability `pass^k` | 같은 task의 `k`번 시도가 모두 성공할 확률 |
| replay action-match | no-op replay가 원 action을 재현한 비율 |
| cost | input/output token, model/tool call, wall time, external API cost |
| side effect | minefield, 중복 commit, 허용되지 않은 state change |

평균 success가 같아도 `pass^k`가 낮으면 반복 운영에 필요한 신뢰성이 없다. 반대로 loop가 success를 높였더라도 비용 Pareto frontier에서 지배되면 engineering 선택으로는 부적합하다.

## 8. 최소 로그 스키마

JSONL 한 행을 event로 저장하고 큰 payload는 content-addressed blob으로 분리한다. 최소 스키마는 다음과 같다.

```json
{
  "schema_version": "loop-causal-v1",
  "run": {
    "run_id": "uuid",
    "pair_id": "same-latent-instance-and-seed",
    "parent_run_id": null,
    "task_family": "versioned_kv",
    "latent_instance_id": "vk-001",
    "task_spec_hash": "sha256:...",
    "latent_answer_hash": "sha256:...",
    "initial_environment_hash": "sha256:...",
    "tool_schema_hash": "sha256:...",
    "task_variant": {"T": 1, "horizon": 8},
    "treatment": {"M": 1, "S": 0, "P": 1},
    "randomization_block": "family-instance-model-version",
    "seed": 17,
    "budget": {"actions": 12, "tool_calls": 12, "wall_seconds": 120},
    "model_fingerprint": "provider/model/version/decoding-hash",
    "policy_fingerprint": "prompt+harness+selector+stop-hash",
    "metric_fingerprint": "verifier+rubric+feedback-hash",
    "state_policy_fingerprint": "schema+update+serializer-hash"
  },
  "event": {
    "event_id": "uuid",
    "parent_event_id": "uuid|null",
    "step": 4,
    "logical_time": 7,
    "event_type": "model_call|tool_call|metric|state_update|select|rollback|stop",
    "checkpoint_before": "sha256:...",
    "environment_before": "sha256:...",
    "state_fields_before": {
      "goal": "sha256:...",
      "observations": "sha256:...",
      "constraints": "sha256:...",
      "artifact_version": "sha256:...",
      "best_so_far": "sha256:...",
      "side_effect_ledger": "sha256:...",
      "budget": "sha256:..."
    },
    "serialized_model_input": "blob:sha256:...",
    "provider_request_id": "string|null",
    "sampling": {
      "seed_requested": 17,
      "seed_honored": true,
      "temperature": 0,
      "top_p": 1
    },
    "raw_model_output": "blob:sha256:...",
    "provider_response_id": "string|null",
    "parsed_action": {"name": "write", "arguments": {"key": "x", "value": 3}},
    "tool_observation": "blob:sha256:...",
    "online_metric": {
      "score": 0.5,
      "accepted": false,
      "feedback": "blob:sha256:...",
      "feedback_type": "scalar|pass_fail|clause|counterexample"
    },
    "state_update_diff": "blob:sha256:...",
    "state_fields_after": "sha256:...",
    "checkpoint_after": "sha256:...",
    "environment_after": "sha256:...",
    "candidate_set_id": "sha256:...",
    "candidate_id": "sha256:...",
    "candidate_artifact": "sha256:...",
    "decision": {
      "selected": false,
      "rollback_to": null,
      "stop_reason": null,
      "decision_basis": "blob:sha256:..."
    },
    "usage": {"input_tokens": 0, "output_tokens": 0, "latency_ms": 0},
    "error": null
  },
  "intervention": {
    "branch_id": "baseline|cf-01",
    "at_step": 4,
    "type": "do_state",
    "target": "/constraints/2",
    "baseline_hash": "sha256:...",
    "replacement_hash": "sha256:...",
    "replacement_provenance": "oracle|null|stale|corrupt|source_run",
    "coupled_seed": 17
  },
  "outcome": {
    "online_stop": "metric_accept|plateau|cycle|budget|safety",
    "online_final_score": 0.9,
    "gold_success": false,
    "gold_utility": -0.2,
    "gold_evaluator_fingerprint": "code+config+hidden-set-hash",
    "gold_criteria": "blob:sha256:...",
    "side_effects": [],
    "selection_regret": 1.0
  }
}
```

필수 불변식은 다음과 같다.

- `serialized_model_input`은 재구성한 요약이 아니라 provider에 보낸 exact payload다.
- metric feedback, raw observation, state update diff를 서로 다른 field로 둔다.
- `selected`, `rollback`, `stop`을 model text에서 추론하지 않고 harness decision으로 기록한다.
- `event_id`, `parent_event_id`, `candidate_set_id`로 branch와 selection 대상 집합을 복원할 수 있어야 한다.
- task, initial environment, tool schema, gold evaluator의 version/hash를 run과 outcome에 각각 고정한다.
- state diff만 믿지 않고 `checkpoint_after`와 전체 state hash도 남겨 reconstruction을 검증한다.
- treatment label, branch id, gold hash는 model input에 넣지 않는다. 개입으로 실제 바뀌어야 하는 content만 policy에 보인다.
- gold outcome은 run 종료 후 join하고 online context에 유출하지 않는다.
- task의 latent answer는 별도 권한의 evaluator store에 두고 hash만 run log에 남긴다.
- model/provider가 seed나 logprob를 지원하지 않으면 `null`과 capability flag를 기록하고 값을 꾸며내지 않는다.

## 9. stopping criteria

### 9.1 개별 agent run

production loop는 hidden gold를 보고 멈추면 안 된다. 기본 rule은 다음 순서다.

1. online hard acceptance가 모두 통과하고 독립적인 regression check가 통과하면 `metric_accept`
2. minefield 또는 irreversible safety violation이면 즉시 `safety`
3. 동일 `(env,state,artifact,pending_goal)`을 두 번째 재방문하면 `cycle`
4. 최근 3 iteration 동안 score 개선, 새 observation, 새 constraint가 모두 없으면 `plateau`
5. action/tool/token/wall-time 중 하나의 hard budget을 쓰면 `budget`

best-so-far는 매 step 보존하되 final answer를 마지막 candidate로 강제하지 않는다. metric이 결함인 실험에서도 이 stopping rule은 그대로 두고 gold 평가에서 잘못 멈춘 사실을 드러낸다.

### 9.2 replay attribution

- 각 branch 최소 `K=20` continuation으로 시작한다.
- binary outcome의 paired 95% interval이 practical threshold의 어느 쪽인지 결정하지 못하면 `K=50`, 최대 `K=100`까지 늘린다.
- baseline reconstruction과 intervention을 같은 횟수로 실행한다.
- effect가 작은데 branch action-match noise가 큰 경우 원인 label을 강제하지 않는다.
- environment side effect를 sandbox로 되돌릴 수 없으면 해당 intervention은 실행하지 않는다.

### 9.3 실험 수집

아래 숫자는 diagnostic pilot의 predeclared default이며 pilot variance를 얻은 뒤 power analysis로 교체한다.

- practical effect: gold success probability `0.10` 또는 normalized gold utility `0.10`
- primary contrast당 최소 `36` paired instance-seed units
- 12-unit batch 단위로 추가
- 최소 표본 이후 cluster bootstrap 95% CI half-width가 `<= 0.05`이면 precision stop
- 최대 `200` paired units에서 여전히 넓으면 `inconclusive`
- 유의확률이 원하는 방향으로 나왔다는 이유로 조기 종료하지 않음

causal root label은 다음을 모두 요구한다.

1. gold outcome의 repair effect가 practical threshold 이상이고 interval이 `0`을 제외
2. 대응하는 break effect가 같은 방향
3. unrelated field를 바꾼 negative control의 절대 효과가 `0.03` 미만
4. planted synthetic root label 회수 정확도 `>= 0.90`
5. task family 하나에만 나타난 효과는 family-specific이라고 표시

이 조건을 통과하지 못한 결과는 `no effect`가 아니라 `inconclusive`일 수 있다.

## 10. 대표 synthetic task

모든 task는 가능한 state/action 공간을 작게 만들어 exhaustive solver로 feasibility, optimal policy, gold outcome을 계산할 수 있어야 한다. 자연어 surface form은 여러 개 만들되 latent program은 보존한다.

| family | task | 조절 가능한 planted factor | 주로 식별하는 원인 | gold |
|---|---|---|---|---|
| Versioned KV transaction | dependency가 있는 key를 읽고 순서대로 갱신한 뒤 commit. stale version write는 거부 | horizon, stale observation, version field drop, premature stop | `Task×State`, rollback/stop `Policy` | final DB exact state + invalid commit minefield |
| CEGIS constraint recovery | 후보 vector를 내면 verifier가 violated clause를 하나 반환. 모든 clause 만족 시 성공 | pass/fail vs clause/counterexample, ledger field loss, repeated candidate | `Metric`, constraint `State`, update `Policy` | 전체 clause exhaustive check |
| Finite DSL repair | 작은 프로그램을 고쳐 truth table을 만족. visible tests는 불완전 | visible/hidden coverage, counterexample specificity, candidate coverage | proxy `Metric` vs proposal `Policy` | 전체 finite input enumeration |
| Irreversible key-door world | key·door·battery 상태를 query하고 제한 횟수 안에 goal 도달. 잘못 commit하면 복구 불가 | observability, rollback cost, map/budget state, query policy | `Task×State`, value-of-information `Policy` | terminal state, cost, forbidden action |
| Deceptive proxy hill-climb | 후보 `x`를 반복 수정. proxy는 특정 구간에서 계속 증가하지만 gold는 peak 뒤 하락 | proxy noise/Goodhart 강도, search depth, early stop | `Metric×Policy` | analytic gold function |
| Candidate selection tray | 고정된 후보 집합에 proxy score와 hidden gold label을 부여 | FP/FN, calibration, selector rule | 순수 `Metric` vs selection `Policy` | exact candidate labels |

### planted failure 예

1. **State-only**: CEGIS task의 production state writer가 step 3의 clause만 삭제한다. metric과 policy는 정상이다. `do_state(/constraints/3, oracle)`가 성공을 구하고 정상 all-reference에 clause 삭제를 넣으면 실패해야 한다.
2. **Metric-only**: candidate tray에 gold-success 후보가 있지만 proxy가 false positive 후보를 최고점으로 둔다. 동일 후보 set에서 oracle reselection만 성공을 구해야 한다.
3. **Policy-only**: exact state와 score는 충분하지만 selector가 first-passing candidate를 택한다. metric 값은 그대로 두고 argmax-safe selector만 바꾸면 구해야 한다.
4. **Task-only**: 현재 timestamp를 얻는 tool이 없는데 exact timestamp가 필요한 명세를 준다. exhaustive reachability가 불가능을 증명해야 하며 model을 바꾸어도 해결되면 안 된다.
5. **Interaction**: stale version field는 short horizon에서는 우연히 문제없지만 delayed observation이 있는 stress twin에서만 실패한다. label은 `Task×State`다.

### 가장 작은 실행 순서

1. Candidate selection tray로 metric/selector 경계를 검증한다.
2. CEGIS constraint recovery로 actionable feedback와 state retention을 검증한다.
3. Versioned KV로 environment state, stale observation, rollback을 추가한다.
4. Deceptive proxy task로 iteration 증가에 따른 proxy-gold divergence와 stopping을 검증한다.
5. 위 네 family에서 planted root 회수율이 기준을 넘은 뒤에만 real code/web/research task로 확장한다.

실제 task에서는 exhaustive oracle이 없으므로 synthetic에서 검증된 intervention과 log pipeline을 그대로 쓰되 root label의 확신 수준을 낮춰야 한다.

### 최소 causal isolation 세트

아래 다섯 검사는 서로 대체되지 않는다. 하나라도 빠지면 해당 두 원인을 분리할 수 없다.

| 검사 | 정확히 같은 것으로 고정 | A/B 차이 | 식별하는 경계 |
|---|---|---|---|
| frozen candidate reselection | task, 후보 set, gold labels, selector rule | proxy metric / oracle metric | `Metric` vs proposal coverage |
| selector swap | task, 후보 set, 모든 metric score | production selector / reference selector | `Metric` vs selection `Policy` |
| checkpoint state-field replay | environment, serialized context의 다른 field, metric, policy, seed | 한 state field production / oracle | `State` vs `Policy` |
| exact-context policy swap | exact serialized input, metric, tools, budget | production policy / reference policy | `Policy` 자체 |
| all-reference task twin | `M₀,S₀,P₀`, latent solution, surface template | base property / stress property | `Task` 효과와 `Task×X` moderator |

이 다섯 검사를 통과한 뒤 16-cell factorial을 붙이면 단일 원인뿐 아니라 `Task×State`, `Metric×Policy` 같은 interaction도 unaliased하게 추정할 수 있다.

## 11. 구현 우선순위

현재 runner를 곧바로 16-condition benchmark로 키우기보다 다음 순서가 오류를 줄인다.

1. `trajectory.jsonl + blob store + checkpoint` recorder
2. deterministic synthetic environment와 hidden gold evaluator
3. frozen-candidate metric reselection
4. no-op reconstruction replay
5. `do_state`, `do_metric`, `do_action`, `do_policy` forward replay
6. factorial manifest generator와 paired analysis
7. confidence interval, negative control, planted-label recovery report
8. 마지막에 실제 provider/model matrix

현재 [`m4b_tiny_pilot_runner.py`](../scripts/m4b_tiny_pilot_runner.py)의 `candidate_record`는 model usage, latency, strong/weak verifier를 이미 기록하므로 유지할 수 있다. 다만 `run_condition`의 branch별 custom logic을 일반화해 `TaskEnv`, `Metric`, `StateUpdater`, `Policy`, `StopRule` interface로 분리해야 factorial cell과 intervention이 같은 code path를 공유한다.

## 12. 관련 1차 문헌

아래 문헌은 이 설계의 직접 근거만 남겼다.

- Shah, J., [Causal Agent Replay: Counterfactual Attribution for LLM-Agent Failures](https://arxiv.org/abs/2606.08275), arXiv v1, 2026. Agent step에 `do` intervention을 하고 downstream을 재실행해 outcome distribution과 confidence interval로 원인을 추정한다. 본 프로토콜의 paired forward replay와 single/joint intervention에 가장 직접적이다. 다만 2026-07-23 현재 peer-reviewed publication이 아닌 최신 preprint이므로 독립 검증 대상으로 취급한다. [공개 구현](https://github.com/jaineet17/causal-agent-replay)
- Geiger, A. et al., [Inducing Causal Structure for Interpretable Neural Networks](https://proceedings.mlr.press/v162/geiger22a.html), ICML 2022. high-level variable와 neural representation의 대응을 단순 상관이 아니라 interchange intervention으로 검사한다. system-state intervention 결과를 곧바로 model-internal mechanism으로 과장하지 않아야 한다는 경계를 제공한다.
- Gao, L., Schulman, J. & Hilton, J., [Scaling Laws for Reward Model Overoptimization](https://arxiv.org/abs/2210.10760), 2022. proxy reward를 더 최적화할수록 gold reward가 처음 상승한 뒤 하락할 수 있음을 synthetic gold/proxy 분리로 측정한다. proxy-gold curve와 optimization-depth sweep의 근거다.
- Uesato, J. et al., [Solving Math Word Problems with Process- and Outcome-Based Feedback](https://arxiv.org/abs/2211.14275), 2022. final-answer error와 reasoning-trace error를 분리하고 process/outcome feedback을 비교한다. final pass만으로 trajectory quality를 대표하지 말아야 한다는 근거다.
- Lu, J. et al., [ToolSandbox: A Stateful, Conversational, Interactive Evaluation Benchmark for LLM Tool Use Capabilities](https://arxiv.org/abs/2408.04682), NAACL Findings 2025. state dependency와 arbitrary trajectory의 intermediate milestone/minefield 평가를 함께 둔다. versioned state task와 side-effect log 설계에 직접 연결된다.
- Yao, S. et al., [`τ`-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains](https://arxiv.org/abs/2406.12045), ICLR 2025. final database state를 annotated goal과 비교하고 반복 reliability를 `pass^k`로 측정한다.
- Huang, J. et al., [Large Language Models Cannot Self-Correct Reasoning Yet](https://proceedings.iclr.cc/paper_files/paper/2024/hash/8b4add8b0aa8749d80a34ca5d941c355-Abstract-Conference.html), ICLR 2024. 외부 feedback 없는 intrinsic self-correction을 별도 조건으로 분리해야 함을 뒷받침한다.
- Gou, Z. et al., [CRITIC: Large Language Models Can Self-Correct with Tool-Interactive Critiquing](https://proceedings.iclr.cc/paper_files/paper/2024/hash/fef126561bbf9d4467dbb8d27334b8fe-Abstract-Conference.html), ICLR 2024. tool-interactive critique를 사용하므로 intrinsic reflection과 external observation 조건을 구분하는 비교 근거다.
- Shinn, N. et al., [Reflexion: Language Agents with Verbal Reinforcement Learning](https://proceedings.neurips.cc/paper_files/paper/2023/hash/1b44b878bb782e6954cd888628510e90-Abstract-Conference.html), NeurIPS 2023. feedback source·형태와 episodic memory의 ablation을 보고한다. feedback와 persistent state를 별도 factor로 유지해야 하는 근거다.

factorial 구현 시 interaction alias를 점검하는 실무 참조로는 [NIST/SEMATECH e-Handbook의 experimental design 장](https://www.itl.nist.gov/div898/handbook/pri/section3/pri3.htm)을 사용할 수 있다. 이는 위 1차 연구 목록과 구분한 방법론 안내서다.

## 13. 이 설계가 답할 수 있는 것과 없는 것

답할 수 있는 것:

- loop 실패가 어느 기능층의 값을 바꾸었을 때 실제 gold outcome이 회복되는가
- task property가 metric/state/policy 결함을 언제 증폭하는가
- 같은 candidate와 같은 context에서 score, stored state, action rule 중 무엇이 병목인가
- iteration 증가가 실제 수렴인지 proxy exploitation인지

이 설계만으로 답할 수 없는 것:

- 특정 transformer layer·head·activation이 외부 state field와 동형인가
- open-ended real-world utility의 완전한 gold evaluator
- 아직 실행하지 않은 production distribution 전체의 실패율
- 모델 weights, prompt, provider update가 장기간 동일하다는 보장

따라서 첫 목표는 보편적 “agent loop 수렴 이론”을 선언하는 것이 아니라, planted 원인을 높은 정확도로 되찾는 diagnostic harness를 만드는 것이다. 그 harness가 통과한 뒤에 실제 실패 trajectory에 같은 intervention을 적용해야 한다.
