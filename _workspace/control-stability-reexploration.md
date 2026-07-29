# LLM–harness agent loop의 제어이론적 재탐색

작성일: 2026-07-28  
성격: 기존 연구 보고서를 확장하는 제어이론 관점의 작업 노트

## 0. 결론

LLM과 harness가 결합된 agent loop는 분석 목적상 다음과 같은 **폐루프 확률적 이산사건·하이브리드 제어계**로 보는 것이 타당하다.

```text
goal/specification
        ↓
observer · memory · state estimator
        ↓
LLM proposal policy + harness supervisor
        ↓
parser · tool API · permission gate
        ↓
artifact · repository · browser · process · external service
        ↓
tool observation · verifier · metric
        └──────────────────────────────────────────┘
```

이 관점은 agent가 잘 작동하는 이유를 다음처럼 분해하게 해 준다.

- LLM은 상태에 조건화된 확률적 proposal 또는 control policy를 제공한다.
- harness는 관측 선택, 상태 보존, mode 전환, action gating, rollback, stopping을 담당한다.
- verifier는 현재 상태와 목표 사이의 오차를 관측하는 sensor이자 때로는 supervisor의 전환 신호다.
- repository·browser·DB 같은 외부 artifact가 plant state이고 transcript·ledger·budget·best-so-far가 controller state다.
- 전체 상태와 전이 규칙을 합치면 연구자가 사용할 수 있는 state-space realization이 생긴다.

그러나 여기서 바로 다음 결론으로 넘어가면 안 된다.

> 폐루프가 여러 작업에서 성공했다는 사실은 control-like한 기능적 구조가 작동한다는 증거지만, LLM 안에 명시적 plant model이 존재한다는 증거도 아니고, 그 폐루프가 안정적이라는 증명도 아니다.

특히 `model`은 다음 네 의미를 구분해야 한다.

1. **분석 모델**: 연구자가 전체 loop를 상태공간 전이로 표현한 것
2. **명시적 controller model**: harness가 유지하는 world model, dependency graph, belief state, simulator
3. **잠재적 predictive representation**: LLM activation이나 weights에 분산된 예측 관련 표현
4. **internal model principle의 internal model**: 특정 reference·disturbance를 robust하게 제거하기 위해 controller가 포함해야 하는 exosystem dynamics

첫 번째는 충분한 history를 state에 넣으면 구성할 수 있다. 두 번째는 구현을 보면 확인할 수 있다. 세 번째는 causal representation study가 필요하다. 네 번째는 robust perfect regulation과 구조적 전제 아래의 제어이론 명제다. 이 네 가지는 동의어가 아니다.

Agent loop에 맞는 핵심 목표도 일반적인 평형점 안정화보다는 다음 **reach–avoid–stay stochastic shortest-path** 문제다.

```text
목표 상태에 도달한다.
도달 전까지 unsafe state를 피한다.
도달한 valid artifact를 보존한다.
제한된 token · call · wall-clock · side-effect budget 안에 종료한다.
```

이를 위한 실체적 조건은 다음과 같다.

1. 목표가 action interface와 budget 아래에서 실질적으로 도달 가능해야 한다.
2. 목표 달성에 필요한 hidden difference가 observation과 diagnostic action으로 구분 가능해야 한다.
3. feedback이 다음 action distribution을 실제로 바꾸며, 평균적으로 gold progress를 만들어야 한다.
4. disturbance와 component 간 feedback gain이 안정 여유를 넘지 않아야 한다.
5. 올바른 상태가 absorbing 또는 protected best-so-far가 되어야 한다.
6. mode switching, delay, stale write, context loss가 progress를 되돌리지 않아야 한다.
7. metric은 baseline 분포뿐 아니라 loop가 만들어 내는 optimized distribution에서도 true utility와 정렬돼야 한다.
8. irreversible action은 safe set 밖으로 나가기 전에 shield·transaction·approval로 차단돼야 한다.

이 조건들은 agent loop의 성공을 설명하는 **후보 이론**이면서 동시에 실험으로 깨뜨릴 수 있는 engineering contract다.

---

## 1. 기존 연구에서 그대로 가져올 경계

기존 보고서의 다음 결론은 유지한다.

- 외부 log·memory·artifact state는 모델 내부 구성요소와 1:1 대응하지 않는다.
- 한 model call의 activation과 여러 agent step에 걸친 harness state는 시간척도가 다르다.
- feedback은 textual channel, world-state channel, controller channel로 전달된다.
- 정적 episodic task의 성공은 goal set에 대한 hitting event이며, termination·fixed point·proxy convergence와 다르다.
- 수렴 실패는 model, state, metric, policy, environment의 합성 결과다.

이번 재탐색의 추가점은 `합성된 state-space system`이라는 표현을 실제 제어 조건으로 더 세분하는 것이다.

### 1.1 “제어계로 표현 가능”과 “controller가 모델을 소유”는 다르다

어떤 process도 충분한 history를 state에 포함하면 다음 전이로 표현할 수 있다.

```text
z_(t+1) ~ P(z_(t+1) | z_t, a_t)
```

이것은 **연구자의 모델링 선택**이다. Controller 자체가 `P`를 명시적으로 저장하거나 추론한다는 뜻이 아니다.

예를 들어 다음 loop도 유효한 control-like selection loop다.

```text
repeat K times:
  candidate ~ P_theta(. | fixed prompt)
  score = verifier(candidate)
return first passing candidate or best score
```

한 번의 sample이 gold-valid일 확률이 `p`이고 sample이 독립이라면,

```text
P(success by K) = 1 - (1 - p)^K
```

이다. Harness의 반복·검증·정지가 성공률을 높이지만 generator가 environment transition model을 학습하거나 업데이트할 필요는 없다. 따라서 **loop 이득 자체는 internal world model의 존재에 대한 충분조건이 아니다.**

반대로 plan, simulation, counterfactual prediction을 명시적으로 유지하는 agent라면 model-based control과 더 가까운 기능을 수행할 수 있다. 그래도 해당 predictive state가 LLM의 어느 layer나 head에 위치하는지는 별도의 mechanistic claim이다.

---

## 2. Agent loop의 최소 제어 모델

### 2.1 전체 상태

총 폐루프 상태를 다음처럼 둔다.

```text
z_t = (
  x_t,       # environment / artifact state
  m_t,       # transcript, summary, memory, constraint ledger
  q_t,       # best-so-far, candidate set, branch state
  sigma_t,   # plan / act / verify / repair / rollback / stop mode
  b_t,       # calls, tokens, time, money, risk budget
  p_t        # pending tool jobs, locks, versions, asynchronous messages
)
```

여기서 model weights `theta`는 일반적인 inference loop에서는 동적 상태가 아니라 고정 parameter다. Provider model version이 실행 중 바뀔 수 있다면 `theta_t` 또는 provider fingerprint를 exogenous mode로 기록해야 한다. Online fine-tuning이나 test-time weight update가 있는 시스템만 weight state를 별도로 포함한다.

Harness가 model에 실제로 노출하는 information state는 전체 `z_t`가 아니다.

```text
i_t = SelectSerialize(
  goal,
  observations_(0:t),
  actions_(0:t-1),
  m_t,
  q_t,
  b_t
)
```

그다음 action은 다음 합성 policy에서 나온다.

```text
a_t ~ pi_(theta,harness)(. | i_t, sigma_t)
```

환경과 controller state는 서로 다른 update를 갖는다.

```text
x_(t+1) ~ P_env(. | x_t, a_t, d_t)
o_(t+1) ~ P_obs(. | x_(t+1), a_t, eta_t)

(m_(t+1), q_(t+1), sigma_(t+1), b_(t+1), p_(t+1))
  = H_update(
      previous controller state,
      a_t,
      o_(t+1),
      verifier result
    )
```

`d_t`는 environment drift·tool noise·concurrent mutation이고 `eta_t`는 observation loss·summary error·staleness·verifier noise다.

### 2.2 Hybrid라는 말의 정확한 의미

Agent loop는 보통 연속시간 물리계보다 **이산 event system**에 가깝다. 그래도 다음 이유로 hybrid 관점이 유용하다.

- `plan`, `execute`, `verify`, `rollback`, `wait`마다 다른 transition kernel과 action set을 쓴다.
- tool call은 asynchronous duration을 가지며 완료 시 world state가 jump한다.
- continuous resource인 wall-clock·cost와 discrete resource인 call count가 함께 변한다.
- human approval이나 external callback이 mode transition을 일으킨다.
- branch merge, deploy, send 같은 action은 불연속적이고 때로 비가역적이다.

이를 mode별 kernel로 쓰면 다음과 같다.

```text
z_(t+1) ~ P_(sigma_t)(. | z_t, a_t, d_t)
sigma_(t+1) = Gamma(sigma_t, o_(t+1), verifier, budget, policy)
```

`hybrid`라는 표현은 유용한 분석 추상화이지, agent trace에 연속 미분방정식이 실제로 내장돼 있다는 주장이 아니다.

### 2.3 구성요소 대응

| 제어계 역할 | Agent loop의 실체 | 중요한 경계 |
| --- | --- | --- |
| reference / specification | system prompt, task specification, acceptance criteria | 자연어 goal과 executable invariant는 동일하지 않다. |
| plant | repository, files, browser, DB, process, external service | 무엇을 controller state로 둘지는 system boundary에 따라 달라진다. |
| controller | LLM proposal policy와 harness selection·update policy의 합성 | LLM 단독을 controller로 보면 rollback·stop·branch를 놓친다. |
| observer / estimator | tool read, log capture, retrieval, summary, belief·ledger update | transcript는 raw state가 아니라 lossy observation일 수 있다. |
| sensor | test, checker, linter, monitor, human feedback | proxy sensor와 gold utility를 분리해야 한다. |
| actuator | parser, tool schema, API, permissioned action | text를 냈다는 사실과 action이 실행됐다는 사실은 다르다. |
| supervisor | mode selection, retry, branch, rollback, escalation, stop | hybrid switching 안정성을 결정한다. |
| controller memory | transcript, constraint ledger, best-so-far, budget, pending jobs | prompt에 보이는 memory와 실제 enforcement state는 다르다. |
| safety filter | permissions, schema validation, sandbox, transaction, approval | soft prompt 금지는 hard invariant가 아니다. |
| disturbance | sampling, tool failure, stale result, environment drift, provider change | random noise와 systematic bias를 분리해야 한다. |
| performance output | hidden utility, regression risk, cost-to-hit | visible metric이 true output을 완전히 관측하지 않을 수 있다. |

---

## 3. Agent task에 맞는 안정성과 수렴 정의

### 3.1 평형점보다 goal set

정적 episodic task에서는 다음 세 집합이 필요하다.

```text
G = gold-valid target states
K = allowed safe states
U = complement(K), unsafe states
```

목표 hitting time과 unsafe hitting time을 둔다.

```text
tau_G = inf { t >= 0 : z_t in G }
tau_U = inf { t >= 0 : z_t in U }
```

주요 outcome은 다음이다.

```text
P_reach_avoid(B)
  = P(tau_G <= B and tau_G < tau_U)

E[cost to hit G | reach before U]

P(regression after hit)
  = P(exists t > tau_G : z_t not in G)
```

성공적인 controller는 단지 `G`를 한 번 방문하는 것뿐 아니라 valid artifact를 보존한 terminal state로 만들어야 한다.

### 3.2 목표별로 다른 안정성 개념

| 작업 종류 | 적절한 제어 outcome | 부적절한 대체 지표 |
| --- | --- | --- |
| 정적 artifact 생성·수정 | reach–avoid–stay, cost-to-hit | 마지막 visible score |
| finite verification | stochastic shortest path, proper termination | budget exhaustion |
| 서비스 운영·모니터링 | invariant violation probability, recurrence | 한 점으로의 수렴 |
| 변하는 요구사항 추적 | tracking error, dynamic regret, switching cost | 정적 goal absorption |
| 반복 최적화 | practical stability, stationary distribution, best-so-far | candidate 문자열 fixed point |

### 3.3 유한 성공과 안정성 증명의 차이

벤치마크에서 `N`회 성공했다는 것은 지정된 초기상태 분포, budget, model version, harness policy에서 `success@B`를 추정한다. 다음은 증명하지 않는다.

- 모든 relevant initial state에서의 도달 가능성
- 작은 disturbance 아래의 robustness
- arbitrary mode switching 아래의 안정성
- 장기 실행에서의 boundedness
- 목표 도달 후 forward invariance
- distribution shift나 verifier exploitation에 대한 안전성
- LLM 내부의 특정 world-model representation

따라서 보고서에서는 `stable` 대신 먼저 범위를 붙인 표현을 써야 한다.

```text
이 controller는 task distribution D,
budget B,
disturbance family Delta,
version fingerprint V 아래에서
reach-avoid success probability와 regression risk가 이 범위였다.
```

---

## 4. 제어가능성보다 먼저 볼 것은 effective reachability다

Classical linear controllability rank test를 open-ended agent state에 바로 적용할 수는 없다. Agent loop에는 다음 두 정의가 더 실용적이다.

### 4.1 Budgeted safe reachability

초기상태 `z`에서 허용 action과 남은 budget을 사용해 goal에 안전하게 도달할 수 있는 최대 확률을 둔다.

```text
R_B(z)
  = sup_pi P_pi(
      tau_G <= B
      and tau_G < tau_U
      | z_0 = z
    )
```

필요조건은 운영 범위 `Z_0`에 대해 다음이 충분히 큰 것이다.

```text
inf_(z in Z_0) R_B(z) >= 1 - delta
```

여기에는 model capability만이 아니라 다음이 모두 포함된다.

- decoder와 candidate grammar
- parser가 받아들이는 action 표현
- tool permission과 API capability
- repository·browser·service의 현재 상태
- mode policy와 branching
- token·call·time·risk budget
- unsafe action을 제외한 뒤 남는 action set

Raw language-model support가 넓다는 사실은 `R_B`가 크다는 뜻이 아니다.

### 4.2 Stabilizability와 local corrective authority

모든 상태를 원하는 상태로 보낼 필요는 없다. 목표 관련 error를 줄일 수 있으면 된다.

실무에서 쓰기 좋은 강한 조건은 다음이다.

> 각 reachable nonterminal state에서 안전한 admissible policy continuation이 어떤 finite horizon `H` 안에 더 작은 gold-error sublevel set에 도달할 양의 확률을 가져야 한다.

한 step의 error 감소를 요구하면 detour·diagnostic action·exploration을 배제하므로 지나치게 강하다. 반대로 “조금이라도 개선될 확률이 있다”만으로도 수렴은 나오지 않는다. Uniform lower bound, 실패 시 recovery, 반복 후 progress 보존 같은 조건이 추가돼야 finite-time reachability로 이어진다.

이 조건이 깨지는 대표 상황은 다음이다.

- 필요한 dependency나 credential에 접근할 tool이 없다.
- parser가 필요한 multi-step atomic action을 표현하지 못한다.
- 이미 실행한 irreversible action 때문에 goal이 unreachable해졌다.
- remaining budget이 최소 repair cost보다 작다.
- safety gate가 모든 progress action을 막는다.
- model policy가 action을 생성할 수 있어도 decoder·selector가 계속 제거한다.

### 4.3 판별 실험

1. **Reference-solution injection**: 알려진 valid artifact를 동일 parser·tool path로 실행한다.
2. **Oracle action test**: 올바른 다음 action을 넣어도 environment가 progress하는지 확인한다.
3. **Candidate-pool test**: gold-valid candidate가 pool 안에 있을 때 selector가 고르는지 확인한다.
4. **Budget frontier**: budget을 단계적으로 늘려 `R_B` 또는 `success@B` 곡선을 그린다.
5. **Safe reachability test**: unsafe action을 금지한 뒤에도 valid path가 남는지 확인한다.

Reference solution조차 action interface를 통과하지 못하면 LLM reasoning이나 metric을 먼저 고치는 것은 잘못된 순서다.

---

## 5. 관측가능성, detectability, identifiability

### 5.1 모든 state를 복원할 필요는 없다

관측가능성은 hidden state를 observation history에서 구분할 수 있는가의 문제다. Agent에게는 full observability보다 **goal-relevant detectability**가 더 적절하다.

두 hidden state `z`와 `z'`가 같은 prompt·log·summary를 만들더라도 필요한 안전 action이 같다면 구분할 필요가 없다. 반대로 다음 조건이면 구조적 한계가 생긴다.

```text
same observable histories
and
different mutually incompatible safe corrective actions
```

이 경우 observation schema나 diagnostic action을 바꾸지 않는 한 어떤 policy도 두 상태 모두에서 안정적으로 성공할 수 없다.

구체적인 state aliasing은 다음과 같다.

- 같은 test error이지만 하나는 code defect, 다른 하나는 stale binary다.
- 같은 file path지만 branch·commit·container가 다르다.
- 같은 `permission denied`지만 credential 부재와 policy denial이 섞인다.
- 같은 visible pass이지만 hidden holdout failure가 다르다.
- summary가 mutually exclusive한 두 failure cause를 하나의 표현으로 압축한다.

### 5.2 POMDP belief state와 harness memory

Partially observed control에서는 observation history에 조건화된 belief state가 information state 역할을 한다. Agent harness의 transcript·summary·ledger는 belief-state approximation으로 해석할 수 있다.

그러나 다음이 자동으로 보장되지는 않는다.

- summary가 다음 transition 예측에 충분한 statistic인가
- uncertainty가 보존되는가, 아니면 하나의 설명으로 조기 붕괴하는가
- state version과 observation source가 결합돼 있는가
- deleted context가 goal-relevant hidden state를 제거하지 않는가
- belief update가 verifier false positive·negative를 반영하는가

자연어 summary가 있다는 사실만으로 observer가 존재한다고 말할 수는 있지만, **정확하거나 sufficient한 observer**라고 말할 수는 없다.

### 5.3 Identifiability는 passive success log로 얻기 어렵다

Identifiability는 dynamics나 failure cause의 서로 다른 가설을 데이터로 구분할 수 있는가의 문제다. Closed-loop log에는 controller가 선택한 action만 나타나므로 selection bias가 있다. 성공 trajectory만 모으면 다음이 서로 구분되지 않을 수 있다.

- model이 정확한 transition을 예측했다.
- model은 틀렸지만 verifier와 rollback이 보정했다.
- 쉬운 초기상태만 선택됐다.
- harness가 lookup·template·cached answer를 사용했다.
- 여러 내부 realization이 같은 input–output behavior를 냈다.

따라서 internal model이나 plant dynamics를 식별하려면 다음이 필요하다.

- controlled intervention 또는 safe persistent excitation
- 동일 state에서의 alternative action replay
- counterfactual next-state prediction을 action 실행 전에 고정
- hidden-state pair를 의도적으로 구성한 observability test
- model·harness·verifier·environment를 하나씩 고정한 factorial replay

Closed-loop system identification 문헌도 feedback 아래의 dynamics 식별에는 parameterization, noise model, excitation과 asymptotic 조건을 별도로 요구한다. 단순한 폐루프 성능은 내부 구조 식별 자료와 동일하지 않다.

---

## 6. Lyapunov·수퍼마팅게일로 progress를 말하려면

### 6.1 가장 직접적인 sufficient condition

`V(z) >= 0`이고 `V(z)=0`을 goal set `G`에서만 만족한다고 하자. Goal에 도달하기 전 모든 reachable state에서

```text
E[
  V(z_(t+1)) - V(z_t)
  | history up to t
] <= -epsilon
```

가 성립하고 stopped process가 integrable하며 `G`가 absorbing이라고 하자. 그러면 표준 drift·optional-stopping 논리 아래

```text
E[tau_G] <= V(z_0) / epsilon
```

형태의 finite expected hitting-time bound를 얻을 수 있다.

중요한 점은 이 부등식이 다음을 요구한다는 것이다.

- 평균이 전체 task mixture가 아니라 relevant reachable state마다 성립한다.
- `V`가 prompt에 보이는 score가 아니라 실제 goal distance를 반영한다.
- transition에는 model sampling, tool, harness mode, rollback까지 모두 포함된다.
- rare catastrophic jump가 별도 safety constraint로 통제된다.
- state가 Markov-sufficient하지 않다면 history-conditioned drift를 사용한다.
- empirical estimate에는 finite-sample confidence bound가 붙는다.

Strict negative drift는 충분조건이지 일반 agent 성공의 필요조건은 아니다. 탐색을 위해 일시적으로 `V`가 증가하는 policy도 성공할 수 있다.

### 6.2 Practical stochastic stability

Persistent noise가 있으면 exact convergence보다 다음 부등식이 더 현실적이다.

```text
E[V(z_(t+1)) | history]
  <= rho V(z_t)
     + gamma(||d_t||)
     + c

0 <= rho < 1
```

그러면 disturbance가 bounded일 때 다음과 같은 steady error floor를 기대할 수 있다.

```text
limsup E[V(z_t)]
  <= (
       gamma(sup_t ||d_t||) + c
     ) / (1 - rho)
```

이것은 agent loop에서 다음을 뜻한다.

- temperature·tool noise가 남아 있으면 candidate 자체의 point convergence는 불필요할 수 있다.
- best-so-far나 accepted artifact가 보호되면 retained state는 안정적일 수 있다.
- noise가 큰데도 exact zero error를 요구하면 mode thrashing이 생길 수 있다.
- systematic verifier bias는 zero-mean noise가 아니라 persistent disturbance 또는 잘못된 feedback law다.

### 6.3 Input-to-state stability 관점

ISS는 초기 error의 영향이 줄고 bounded disturbance의 영향이 bounded gain으로 state에 나타나는 조건이다. Agent에서는 disturbance family를 명시해야 한다.

```text
d_t = (
  sampling perturbation,
  tool failure,
  delayed observation,
  stale context,
  concurrent edit,
  requirement drift,
  provider update,
  verifier noise
)
```

실험적으로는 disturbance 크기 `delta`를 단계적으로 주입하고 다음 gain curve를 측정한다.

```text
G(delta)
  = sup over tested states
      E[gold error after horizon H | disturbance <= delta]
```

작은 disturbance가 큰 branch divergence·unsafe action·unbounded retry를 만들면 local stability margin이 작다.

### 6.4 Interconnection과 small-gain 조건

LLM, harness, verifier, environment 각각이 단독으로 bounded하게 동작해도 feedback interconnection이 안정적이라고 결론 낼 수 없다.

개념적으로 다음 두 gain을 생각할 수 있다.

```text
gamma_A:
  observation / feedback perturbation
  -> action distribution perturbation

gamma_E:
  action perturbation
  -> next observation / state perturbation
```

Nonlinear small-gain 이론의 핵심 형태는 두 gain의 합성이 identity보다 작아야 폐루프 perturbation이 줄어든다는 것이다.

```text
gamma_E o gamma_A < Id
```

Agent에 이 식을 그대로 증명하기는 어렵지만 paired replay로 국소 incremental gain을 추정할 수 있다.

```text
same state
  + controlled feedback perturbation
  -> action distance
  -> state / gold-error distance after H steps
```

다만 text embedding distance나 edit distance를 state norm으로 임의 선택하면 의미 없는 contraction을 얻을 수 있다. Distance는 task invariant, failing constraint, unsafe risk, artifact semantics에 근거해야 한다.

### 6.5 사용할 수 있는 `V` 후보와 사용할 수 없는 후보

| 후보 | 사용할 수 있는 조건 | 위험 |
| --- | --- | --- |
| gold constraint violation count | 각 violation의 의미와 severity가 고정 | 서로 다른 난이도·비가역성을 같은 1로 셈 |
| weighted semantic error | weight가 true loss와 검증됨 | weight 자체가 proxy |
| remaining shortest safe repair cost | transition model 또는 oracle가 충분히 정확 | 계산이 어렵고 model mismatch에 취약 |
| holdout failure probability | holdout가 deployment risk를 대표 | loop가 holdout를 간접 누설받으면 Goodhart |
| posterior entropy over failure causes | calibrated belief와 identifiability가 있음 | confidently wrong이면 감소해도 악화 |
| regression-adjusted best utility | best state가 immutable하고 gold evaluator가 있음 | evaluator blind spot |
| visible score | monotone relation이 optimized distribution에서도 유지 | 가장 흔한 잘못된 Lyapunov 후보 |
| model confidence | calibration과 goal alignment가 입증됨 | confidence 고착을 progress로 오인 |
| transcript 길이·iteration 수 | 일반적으로 없음 | 비용이지 progress가 아님 |

Visible metric이 매 step 좋아진다는 사실은 `V`가 감소한다는 증거가 아니다. 먼저 `V`와 true utility 사이의 관계를 loop가 방문하는 distribution에서 검증해야 한다.

### 6.6 Safety는 별도의 barrier가 필요하다

Progress function `V`가 감소해도 unsafe set을 통과할 수 있다. 안전은 barrier 또는 hard invariant로 별도 다룬다.

개념적 nonnegative stochastic barrier `B(z)`를 다음처럼 둔다.

```text
B(z) >= 0 everywhere
B(z) small on initial safe set
B(z) >= 1 on unsafe set U
E[B(z_(t+1)) | history] <= B(z_t)
```

적절한 measurability·integrability·stopping 조건 아래 supermartingale inequality로 unsafe hitting probability의 upper bound를 얻는 방식이다. Reach–avoid에는 progress와 barrier를 결합한 certificate가 필요하다.

Agent engineering에서 해당하는 실체는 다음이다.

- immutable protected files와 policy
- transaction boundary
- precondition·postcondition checker
- deployment or send 전 approval gate
- branch-local sandbox
- rollback 가능성 검증
- credential scope와 action allowlist

Soft natural-language instruction은 barrier certificate가 아니다.

---

## 7. Mode switching, dwell time, chattering

### 7.1 각 mode가 유용해도 arbitrary switching은 안전하지 않다

다음 mode들은 각각 국소적으로 합리적일 수 있다.

```text
plan -> execute -> verify -> repair -> rollback -> replan
```

그러나 mode마다 서로 다른 state summary, prompt, action set, objective를 사용하면 전환 자체가 progress를 잃게 만들 수 있다.

- planner는 broad rewrite를 요구하고 repairer는 minimal patch를 요구한다.
- verifier가 pass 직후 planner가 다시 artifact를 수정한다.
- rollback과 retry가 서로의 state version을 덮어쓴다.
- plan과 execute가 서로 다른 branch를 참조한다.
- mode 전환 때 summary compression으로 counterexample이 사라진다.

Switched-system 이론에서는 모든 mode가 개별적으로 안정적이어도 빠른 switching이 전체를 불안정하게 만들 수 있다. 공통 Lyapunov function이 모든 mode에서 감소한다면 arbitrary switching을 다루기 쉽다. Mode별 Lyapunov function만 있다면 switching penalty와 mode 안의 decay를 상쇄할 만큼 평균 dwell time이 길어야 한다.

일반적인 sufficient-condition 형태는 다음과 같다.

```text
within-mode decay rate: lambda
cross-mode Lyapunov jump bound: mu >= 1

average dwell time
  > log(mu) / lambda
```

이 식은 특정 switched-system 전제 아래의 예시이지 agent loop에 그대로 대입할 universal formula가 아니다. Agent에서는 wall-clock보다 `meaningful state transition`, token, tool call을 dwell 단위로 쓰는 편이 나을 수 있다.

### 7.2 Chattering과 Zeno를 구분한다

Agent의 흔한 문제는 다음과 같은 chattering 또는 limit cycle이다.

```text
add workaround
-> test B fails
-> remove workaround
-> test A fails
-> add workaround
-> ...
```

실제 API call에는 양의 시간이 걸리므로 무한 번의 transition이 유한시간에 일어나는 엄밀한 Zeno behavior는 보통 아니다. `Zeno`라는 말을 쓰려면 zero-duration internal transition이나 event scheduler semantics가 실제로 그런 execution을 허용해야 한다.

실무 대책은 다음이다.

- mode transition에 hysteresis 적용
- 새 evidence 또는 state hash 변화가 없으면 replan 금지
- minimum execution batch 뒤 verify
- successful candidate lock과 full regression gate
- `(mode, state hash, action hash)` cycle detection
- rollback 뒤 cooldown 또는 alternative branch 강제
- 동일 mode의 maximum residence도 설정해 unproductive lock-in 방지

빠른 switching만 막으면 되는 것도 아니다. Unstable mode에 너무 오래 머무르는 것 역시 실패하므로 mode별 유효 progress와 occupation time을 함께 기록한다.

---

## 8. Delay, staleness, asynchronous state

### 8.1 Delay는 observation noise가 아니라 state mismatch가 될 수 있다

Tool result가 생성된 state와 적용되는 state가 다르면 다음 현상이 생긴다.

```text
test starts on commit A
concurrent edit creates commit B
test result for A arrives
controller applies repair to B as if result were current
```

이것은 단순 noisy log가 아니라 causal identity가 틀린 observation이다.

엄밀하게는 pending jobs와 version을 state에 포함해야 Markov model에 가까워진다.

```text
p_t = {
  job_id,
  parent_state_hash,
  branch,
  tool_version,
  start_time,
  expected side effects,
  lock / transaction status
}
```

### 8.2 수렴을 위해 필요한 delay contract

일반적인 asynchronous algorithm 문헌에서도 convergence는 delay와 communication gap이 과도하지 않다는 조건을 둔다. 해당 정리는 gradient-like algorithm에 대한 것이므로 일반 agent loop의 정리가 아니다. 여기서는 그 전제를 engineering contract로 옮긴다.

- observation에는 source state hash와 causal parent가 있다.
- stale result의 maximum age가 정해져 있다.
- out-of-order result는 무조건 현재 state에 적용하지 않는다.
- write action은 optimistic concurrency control 또는 lock을 쓴다.
- asynchronous branch는 isolation되고 merge 시 재검증된다.
- model response가 도착한 뒤 precondition을 다시 확인한다.
- delay가 bound를 넘으면 discard·replay·escalate 중 하나를 명시한다.

### 8.3 실험

다음 delay sweep을 실행한다.

```text
0, 1, 2, 4, 8 logical-step delay
```

각 단계에서 측정할 것은 다음이다.

- gold progress drift
- stale-application rate
- rollback rate
- cycle probability
- unsafe action probability
- time/cost-to-hit

Bounded delay에서 완만히 악화하고 특정 임계점 뒤 붕괴하면 delay margin을 추정할 수 있다. 평균 latency만 기록하면 rare stale write를 놓친다.

---

## 9. Saturation과 budget은 동역학의 일부다

### 9.1 세 종류의 saturation

| 제약 | 제어계 해석 | Agent의 예 |
| --- | --- | --- |
| observation saturation | sensor bandwidth·compression | context window, truncation, lossy summary |
| action saturation | admissible input 제한 | tool permission, output cap, API grammar |
| rate/resource saturation | actuation·fuel·time 제한 | call cap, token budget, rate limit, wall-clock |

각각 다른 failure를 만든다.

- Context가 포화되면 old counterexample과 state identity가 사라진다.
- Action이 포화되면 올바른 plan을 알아도 실행할 수 없다.
- Rate budget이 포화되면 verify·rollback 전에 종료될 수 있다.

Bounded actuator를 가진 제어계에서는 unconstrained controller를 단순 clipping한 것이 global stabilization을 보장하지 않는다. Agent에서도 unlimited-budget policy를 마지막에 자르는 방식은 동일하게 위험하다.

### 9.2 Budget-augmented state

Budget은 termination rule만이 아니라 state다.

```text
b_(t+1) = b_t - cost(z_t, a_t)
```

남은 budget이 줄면 admissible policy와 reachable set도 변한다.

```text
feasible(z_t, b_t)
  = minimum expected safe repair cost from z_t
    <= b_t
```

`feasible=false`인 상태에서 같은 retry를 계속하는 것은 controller windup과 유사한 증상을 낸다.

### 9.3 Proper policy와 terminal semantics

Stochastic shortest-path 문제에서 proper policy는 terminal state에 finite expected time 안에 도달하는 정책이다. Agent에서는 terminal을 최소 세 종류로 나눠야 한다.

```text
SUCCESS
SAFE_ABORT
BUDGET_EXHAUSTED / FAILURE
```

Strict budget은 모든 run을 끝내지만 task convergence를 보장하지 않는다. 반대로 termination cost가 없고 retry가 무료로 모델링되면 controller는 indefinitely cycle할 수 있다.

실무 정책은 다음을 포함해야 한다.

- exploration, implementation, verification, rollback budget을 분리
- 다음 iteration의 expected value와 risk를 추정
- minimum verification reserve를 보존
- remaining budget으로 safe completion이 불가능하면 early safe abort
- context compression 뒤 retained constraint recall test
- 동일 failure당 retry cap과 branch diversification

---

## 10. Model mismatch와 robustness

### 10.1 명시적 planning model이 있는 경우

Controller가 next-state model `P_hat`으로 plan한다고 하자.

```text
predicted: z_(t+1) ~ P_hat(. | z_t, a_t)
actual:    z_(t+1) ~ P(. | z_t, a_t)
```

작은 mismatch를 feedback으로 보정할 수 있으려면 다음이 필요하다.

- mismatch가 운영 region에서 bounded다.
- controller가 mismatch에 비해 충분한 stability margin을 가진다.
- state observation과 replan이 충분히 빠르다.
- hard constraint에는 uncertainty buffer가 있다.
- terminal·safe set이 robust invariant하다.

Nominal prediction이 평균적으로 정확하다는 사실만으로 rare unsafe transition을 막을 수 없다. Robust MPC가 disturbance-invariant tube와 constraint tightening을 사용하는 이유와 같은 구조다.

### 10.2 명시적 model이 없는 경우

LLM agent가 counterfactual transition을 말할 수 있어도 controller가 그것을 일관된 `P_hat`으로 사용한다는 뜻은 아니다. 다음 기능을 분리해 측정해야 한다.

1. action 전 next-state prediction
2. calibrated uncertainty
3. alternative action의 counterfactual prediction
4. observation 뒤 prediction residual update
5. 새로운 initial state와 intervention으로의 generalization
6. plan choice가 prediction에 causal하게 의존하는지

이 중 일부가 없더라도 reactive policy, data-driven controller, verifier-guided search는 성공할 수 있다.

### 10.3 Mismatch instrumentation

매 action마다 다음을 기록한다.

```text
predicted effects
predicted invariants
predicted failure modes
predicted confidence
actual effects
actual violations
prediction residual
model / prompt / tool / environment fingerprint
```

Residual이 생겼을 때 controller가 바뀌는지도 본다.

```text
residual observed
-> belief / summary update
-> action distribution change
-> future residual 감소
```

Residual이 계속 누적되는데 같은 plan을 유지하면 model mismatch보다 update policy 또는 observability가 병목일 수 있다.

---

## 11. Goodhart와 proxy feedback은 sensor defect를 넘어선다

### 11.1 Metric이 feedback loop 안에 들어오면 분포가 변한다

True utility를 `U(z)`이고 visible metric을 `M(z)`라고 하자.

```text
controller chooses actions to increase M
but desired outcome is increase U
```

Baseline sample에서 `M`과 `U`가 상관돼 있어도 loop가 `M`을 반복 최적화하면 visited-state distribution이 바뀐다. 그 분포에서 metric error가 커질 수 있다.

```text
selection regret
  = max_candidate U(candidate)
    - U(argmax_candidate M(candidate))
```

중요한 failure는 다음 두 종류다.

- **measurement error**: 같은 state의 `M`이 `U`를 잘못 측정
- **policy-induced exploitation**: controller가 `M`의 blind spot이 큰 state로 이동

두 번째는 verifier를 더 자주 호출하는 것으로 해결되지 않는다. 같은 proxy에 대한 optimization pressure만 커질 수 있다.

### 11.2 Metric을 Lyapunov function으로 쓰기 위한 조건

Visible metric `M`을 progress certificate로 쓰려면 최소 다음이 필요하다.

- goal-relevant state에서 ordering consistency가 있다.
- optimized occupancy에서도 calibration이 유지된다.
- false positive가 unsafe·irreversible state에서 충분히 낮다.
- controller가 metric implementation을 수정하거나 우회할 수 없다.
- metric update와 artifact update가 atomic하게 versioned된다.
- holdout 또는 independent evaluator로 selection regret를 감시한다.

Gao et al.의 synthetic reward-model 실험은 proxy를 더 강하게 최적화할수록 gold score가 악화될 수 있음을 보였다. 이 결과를 모든 agent loop에 보편화할 수는 없지만, **proxy-driven selection pressure가 metric defect를 증폭할 수 있다**는 직접 사례다.

### 11.3 Engineering guard

- generation metric과 final acceptance metric 분리
- public test와 hidden holdout 분리
- metric implementation과 artifact write 권한 분리
- verifier disagreement와 abstention 기록
- pass 후 canary·regression·semantic invariant 실행
- `M` 상승과 `U` 하락을 찾는 adversarial metric test
- metric FPR/FNR을 production-like optimized candidate에서 재측정

---

## 12. Irreversible action과 safe set

### 12.1 Rollback 가능성을 가정하면 안 된다

File edit는 snapshot으로 되돌릴 수 있지만 다음 action은 완전 복구가 어려울 수 있다.

- email·message 전송
- production deploy
- database destructive migration
- purchase·payment
- credential 공개
- external account·resource 삭제
- 사람이나 다른 system이 이미 소비한 output

이 경우 `실패하면 rollback`은 안전 조건이 아니다.

### 12.2 Viability와 reach–avoid

Safe set `K` 안에서 영원히 머무를 수 있는 초기상태 집합을 viability kernel 관점으로 볼 수 있다.

```text
Viab(K)
  = {
      z in K :
      exists admissible policy
      that keeps future state in K
    }
```

Goal까지 가는 path가 존재해도 현재 action이 `Viab(K)` 밖으로 나가면 이후 안전을 보장할 policy가 없을 수 있다.

따라서 action 전 다음을 묻는다.

```text
1. 이 action의 precondition이 최신 state에서 성립하는가?
2. 가능한 outcome 전체가 safe envelope 안에 있는가?
3. 실패 후에도 safe recovery policy가 존재하는가?
4. irreversible boundary라면 독립 승인·검증이 있는가?
5. side effect와 verifier가 같은 transaction에 묶이는가?
```

### 12.3 Safety shield의 우선순위

```text
hard invariant / permission
  > transactional precondition
  > independent verifier
  > controller prompt instruction
  > model self-critique
```

Prompt에 “삭제하지 마라”가 있어도 tool이 unrestricted delete를 허용하면 safe set은 forward invariant하지 않다.

### 12.4 Stability와 safety는 서로 대체하지 않는다

- 안정적으로 unsafe equilibrium에 수렴할 수 있다.
- 안전하게 계속 cycle하며 목표에 도달하지 못할 수 있다.
- 목표에 빨리 도달하지만 중간에 unsafe state를 거칠 수 있다.

따라서 최소 세 지표를 동시에 본다.

```text
reach probability
unsafe hitting probability
regression probability after reach
```

---

## 13. “성공 사례가 내부 모델을 증명한다”는 주장 검토

### 13.1 Conant–Ashby good regulator theorem이 실제로 말하는 것

Conant와 Ashby의 1970년 논문은 흔히 “모든 좋은 regulator는 system의 model이어야 한다”로 인용된다. 원 논문의 formal setting은 다음과 같이 더 구체적이다.

- reguland event `S`, regulator event `R`, outcome `Z`와 mapping `psi: R × S -> Z`를 둔다.
- `p(S)`와 conditional distribution `p(R|S)`를 둔다.
- 성공을 outcome entropy `H(Z)`의 최소화로 정의한다.
- 같은 최소 entropy를 내는 optimal regulator class에서 가장 단순한 deterministic mapping을 고른다.
- 그 simplest optimal regulator가 `h: S -> R`인 mapping으로 표현됨을 보인다.
- proof에서는 optimal distributions가 같은 unique `p(Z)`를 만든다는 단순화도 둔다.

원 논문이 말하는 `model`은 regulator action이 reguland event의 mapped version이라는 넓은 의미다. 논문 자체도 model·isomorphism 정의가 매우 다양해질 수 있음을 논의한다.

따라서 agent benchmark success에서 다음을 바로 도출할 수 없다.

- LLM이 명시적 causal world model을 유지한다.
- 그 model이 Transformer의 특정 layer에 위치한다.
- model이 counterfactual intervention에 calibrated하다.
- finite task success가 entropy-minimal simplest optimal regulation이다.
- observed harness가 가능한 optimal regulator 중 가장 단순하다.
- task distribution과 dynamics가 stationary하다.

Good regulator theorem은 “model”이라는 구조적 해석의 동기를 제공하지만, LLM 내부 mechanism을 식별하는 판독 도구는 아니다.

### 13.2 Internal model principle이 실제로 말하는 것

Francis–Wonham 계열의 internal model principle은 더 좁고 강하다.

> Internal stability와 asymptotically zero regulation error가 plant perturbation에도 robust하게 유지되려면, feedback loop 안에 controller가 처리해야 하는 reference·disturbance의 dynamic structure를 적절히 복제한 internal model이 필요하다.

여기서 internal model은 일반적인 “세상에 대한 이해”가 아니라 **exogenous signal generator의 dynamics**다. 일정 set-point에는 integral action, sinusoidal disturbance에는 해당 frequency dynamics가 대표적이다.

일회성 code repair 성공이나 finite benchmark success는 다음 전제를 만족하지 않는다.

- asymptotically zero tracking error
- 정의된 exosystem class
- plant family perturbation에 대한 robust regulation
- controller의 internal stability

따라서 internal model principle을 근거로 “agent가 성공했으므로 LLM 안에 world model이 있다”고 말하는 것은 범위를 넘는다.

### 13.3 안정화는 explicit identified model 없이도 가능하다

Data-driven control 연구에는 plant matrix를 명시적으로 식별하지 않고 data로 stabilization 조건과 controller를 구성하는 방법이 있다. Feedback, stored data, local approximation, high-rate observation만으로도 제한된 system class에서 안정화가 가능하다.

Agent에서도 다음 메커니즘이 explicit world model 없이 성능을 낼 수 있다.

- independent sampling과 verifier selection
- reactive error-to-action mapping
- test failure lookup table
- template repair
- rollback을 포함한 trial-and-error
- external solver가 계산하고 LLM은 interface만 담당
- harness가 constraint를 강제하고 LLM은 proposal만 제공

따라서 “성공에는 어떤 task-relevant information structure가 필요하다”와 “controller 내부에 인간이 읽을 수 있는 predictive model이 존재한다”를 분리해야 한다.

### 13.4 성공이 stability도 증명하지 않는 이유

유한 success trace는 다음 대안 설명과 양립한다.

- 작은 basin of attraction 안에서만 성공
- rare disturbance에서 붕괴
- budget이 끝나기 전에 우연히 hit
- metric을 exploit해 proxy만 통과
- 성공 뒤 한 번 더 수정하면 regression
- slow switching에서는 성공하지만 fast mode change에서 cycle
- current model·tool version에서만 성공
- irreversible side effect가 benchmark에서 관측되지 않음

Stability claim에는 적어도 state domain, disturbance set, switching policy, delay bound, budget, safety set, probability level, time horizon을 붙여야 한다.

---

## 14. 실체적인 충분조건 묶음

다음은 정적 episodic agent task에서 reach–avoid–stay를 주장하기 위한 **강하지만 검사 가능한 sufficient-condition template**다.

### 14.1 구조 조건

1. Logged state `z_t`가 next transition과 decision에 필요한 goal-relevant history를 보존한다.
2. Model, harness, tool, verifier, environment version이 고정되거나 state에 포함된다.
3. Pending asynchronous work와 state version이 명시된다.
4. Goal `G`, safe set `K`, unsafe set `U`, terminal semantics가 executable하게 정의된다.

### 14.2 Reachability 조건

5. 지정된 initial set에서 안전 admissible policy의 budgeted reach probability가 threshold 이상이다.
6. 남은 budget이 줄어들 때도 verification과 safe termination을 위한 reserve가 있다.
7. Goal 도달 전에 irreversible trap state로 강제되는 initial state는 scope에서 제외되거나 별도 처리된다.

### 14.3 Observation 조건

8. 서로 다른 safe corrective action을 요구하는 hidden states는 observation 또는 diagnostic action으로 구분된다.
9. Observation은 source state·branch·version과 causal하게 결합된다.
10. Summary·retrieval이 goal-relevant constraint recall 기준을 만족한다.

### 14.4 Progress와 robustness 조건

11. Goal 밖 reachable region에서 gold-grounded progress function의 conditional drift가 음수다.
12. Disturbance가 남으면 practical ISS bound 또는 error floor가 정량화된다.
13. Component interconnection의 empirical perturbation gain이 operating region에서 amplification하지 않는다.
14. Model mismatch residual이 bounded하고 residual 후 update가 future error를 줄인다.

### 14.5 Hybrid·termination 조건

15. Mode별 progress 또는 common progress certificate가 있다.
16. Switching에는 hysteresis·cycle detection·dwell contract가 있다.
17. Delay·staleness에는 maximum age와 discard·replay rule이 있다.
18. Goal state는 absorbing하거나 immutable best-so-far와 promotion gate로 보호된다.
19. Policy는 success, safe abort, failure 중 하나로 finite expected time에 종료한다.

### 14.6 Metric·safety 조건

20. Metric은 loop가 만든 optimized candidate distribution에서 gold evaluator와 검증된다.
21. Metric implementation과 artifact mutation 사이의 tampering path가 차단된다.
22. Unsafe boundary에는 prompt가 아닌 hard safety filter가 있다.
23. Irreversible action에는 two-phase commit 또는 independent approval가 있다.
24. Reach probability, unsafe hitting probability, post-hit regression을 각각 측정한다.

이 모든 조건이 일반 agent에 자동으로 성립한다고 기대할 수는 없다. 이 목록의 목적은 “loop가 똑똑해서 수렴한다”를 검사 가능한 subsystem contract로 바꾸는 것이다.

---

## 15. 권장 실험

### 15.1 첫 번째: 제어계로서의 state sufficiency

같은 logged `z_t`를 복원한 paired replay에서 과거 history의 추가 부분을 달리한다.

```text
P(z_(t+1) | z_t, extra_history_A)
vs
P(z_(t+1) | z_t, extra_history_B)
```

차이가 크면 `z_t`가 information state로 불충분하다. 단, finite sample에서 차이가 작다고 Markov sufficiency를 증명할 수는 없다.

### 15.2 두 번째: reachability와 selection 분리

```text
Pass@K
SelectedSuccess@K
SafeSelectedSuccess@K
```

- `Pass@K`가 낮으면 generator·interface·budget·reachability를 의심한다.
- `Pass@K`는 높고 `SelectedSuccess@K`가 낮으면 verifier·selector를 의심한다.
- 둘 다 높고 unsafe rate가 크면 safe-set enforcement를 의심한다.

### 15.3 세 번째: 관측가능성 반례

Visible observation은 같지만 올바른 action이 다른 hidden-state pair를 만든다.

```text
same serialized prompt
different branch / binary / credential / hidden test condition
```

Oracle state identifier를 추가했을 때 회복되면 observation aliasing의 causal evidence다.

### 15.4 네 번째: empirical Lyapunov drift

Candidate `V`에 대해 state stratum별 one-step 또는 `H`-step drift를 측정한다.

```text
Delta_H V
  = V(z_(t+H)) - V(z_t)
```

평균뿐 아니라 다음을 본다.

- worst relevant stratum
- upper confidence bound
- tail quantile
- mode별 drift
- delay·budget·disturbance level별 drift
- goal hit 이후 regression drift

전체 평균이 음수여도 hard states에서 양수면 uniform stability claim을 할 수 없다.

### 15.5 다섯 번째: ISS gain sweep

Disturbance family를 하나씩 통제한다.

```text
feedback token corruption
tool result noise
logical delay
concurrent edit
verifier flip
requirement perturbation
sampling temperature
```

각 크기에서 gold error, unsafe probability, recovery time을 측정한다. 여러 disturbance를 동시에 넣기 전에 single-source gain을 구한다.

### 15.6 여섯 번째: switching·delay margin

- fixed schedule
- common-state supervisor
- low dwell
- high dwell
- hysteresis on/off
- stale result accept/discard

를 비교한다. Mode transition 전후 `V` jump와 constraint recall loss를 기록한다.

### 15.7 일곱 번째: budget viability frontier

각 state checkpoint에서 remaining budget을 줄여 가며 다음을 추정한다.

```text
minimum budget for:
  safe repair
  verification
  rollback
  final acceptance
```

이 frontier를 controller가 모르고 있으면 verification reserve를 소진하는지 확인한다.

### 15.8 여덟 번째: model claim을 위한 별도 시험

Internal predictive model을 주장하려면 task success와 별도로 다음을 측정한다.

1. action 전 next-state prediction 정확도
2. counterfactual action outcome ranking
3. uncertainty calibration
4. intervention generalization
5. prediction residual에 따른 belief update
6. prediction state를 제거·교란했을 때 plan과 success의 변화
7. harness model과 LLM latent representation의 기여 분리

이 증거가 있어도 특정 Transformer component와의 대응은 causal tracing·activation intervention 단계가 추가로 필요하다.

---

## 16. 판정표

| 관찰 | 우선 원인 | 제어이론적 해석 | 다음 실험 |
| --- | --- | --- | --- |
| Gold-valid candidate가 거의 생성되지 않음 | reachability·action authority | target이 effective reachable set 밖 | reference action, budget frontier |
| 같은 log에서 상반된 repair가 필요 | observability | state aliasing | hidden-state pair, oracle state |
| Feedback을 바꿔도 action이 같음 | actionability | controller gain이 거의 0 | masked·shuffled feedback replay |
| 작은 log perturbation이 큰 branch divergence를 만듦 | robustness | high incremental gain | ISS perturbation sweep |
| 각 mode는 괜찮지만 전환할 때 regression | switching | mode Lyapunov jump | dwell·hysteresis sweep |
| 오래된 tool result에서만 실패 | delay | delayed-state mismatch | causal version gate |
| budget 직전 verification을 못 함 | resource saturation | terminal reachability 상실 | budget-augmented policy |
| visible score는 오르지만 gold utility는 하락 | metric | Goodhart·proxy exploitation | fixed pool oracle metric |
| pass 뒤 다시 수정해 실패 | non-absorption | goal set not invariant | immutable best, promotion gate |
| rollback 불가능한 side effect | unsafe transition | viability kernel 이탈 | hard shield, two-phase commit |
| benchmark success는 높지만 perturbation에 취약 | local basin | empirical success ≠ robustness | initial-state·disturbance sweep |
| 예측은 틀리지만 verifier retry로 성공 | mismatch compensated | reactive correction, not model proof | prediction residual test |

---

## 17. 연구 명제의 업데이트

이번 재탐색 뒤 중심 명제는 다음처럼 쓰는 것이 정확하다.

> LLM agent loop는 LLM의 확률적 proposal policy와 harness의 observation, memory, supervisory switching, verification, action gating, rollback, stopping이 결합된 output-feedback stochastic hybrid control system으로 모델링할 수 있다. Loop의 효과는 task-relevant state가 관측·보존되고, 안전한 action으로 goal set이 budget 안에 도달 가능하며, feedback interconnection이 disturbance와 delay를 증폭하지 않고, proxy metric이 optimized distribution에서도 true utility를 추적하며, goal과 safe set이 보존될 때 설명된다.

그리고 다음 제한을 함께 둬야 한다.

> 이 기능적 모델은 agent의 성공과 실패를 분석하는 외부 realization이다. 성공 사례만으로 LLM 내부의 명시적 world model, 특정 mechanistic representation, robust stability, 또는 보편적 수렴을 도출할 수 없다.

### 17.1 검증 가능한 가설

| ID | 가설 | 필요한 intervention |
| --- | --- | --- |
| C1 | Goal-relevant state가 sufficient할수록 loop의 progress drift가 안정적으로 음수가 된다. | summary·ledger sufficiency ablation |
| C2 | Effective reachability가 낮은 task에서는 metric 개선보다 action interface·budget 개선의 효과가 크다. | oracle action·budget factorial |
| C3 | Observational aliasing이 큰 task에서는 loop length보다 diagnostic action이 성공률을 더 높인다. | oracle state·diagnostic tool |
| C4 | Mode-specific prompt가 많고 shared invariant가 약할수록 switching regression이 증가한다. | common ledger·dwell sweep |
| C5 | Delay가 state version과 결합되지 않으면 bounded latency에서도 stale-action failure가 증가한다. | source hash gate on/off |
| C6 | Proxy selection pressure가 커질수록 metric–gold gap이 커지는 task가 존재한다. | fixed pool, selection intensity sweep |
| C7 | Best-so-far 보호와 promotion gate는 post-hit regression을 낮춘다. | absorption mechanism ablation |
| C8 | Success가 동일해도 explicit prediction accuracy와 residual adaptation은 agent architecture별로 다르다. | predictive-model battery |
| C9 | 작은 disturbance에 대한 empirical closed-loop gain이 큰 task는 seed·tool 변동에 민감하다. | paired ISS sweep |
| C10 | Irreversible boundary 앞 hard shield가 prompt-only rule보다 unsafe hitting을 낮춘다. | safe sandbox red-team |

---

## 18. 1차 문헌

아래 문헌은 제어 개념의 원래 범위와 이번 agent-loop 적용의 경계를 확인하기 위해 사용했다.

### 제어가능성·관측가능성·부분관측

- R. E. Kalman, “Contributions to the Theory of Optimal Control,” 1960. Controllability와 observability를 도입한 고전적 출발점. [원문 PDF](https://boletin.math.org.mx/pdf/2/5/BSMM%282%29.5.102-119.pdf)
- R. D. Smallwood and E. J. Sondik, “The Optimal Control of Partially Observable Markov Processes over a Finite Horizon,” *Operations Research*, 1973. Hidden state와 observation을 분리한 finite-horizon POMDP. [DOI](https://doi.org/10.1287/opre.21.5.1071)
- U. Forssell and L. Ljung, “Closed-loop Identification Revisited,” *Automatica*, 1999. Feedback 아래 system identification의 parameterization·noise-model·asymptotic 조건을 다룬다. [DOI](https://doi.org/10.1016/S0005-1098(99)00022-9)

### 종료·도달·확률적 progress

- D. P. Bertsekas and J. N. Tsitsiklis, “An Analysis of Stochastic Shortest Path Problems,” *Mathematics of Operations Research*, 1991. Terminal state, policy, expected cost를 다룬다. [저자 PDF](https://www.mit.edu/~jnt/Papers/J034-91-berts-SSP.pdf)
- H. Robbins and D. Siegmund, “A Convergence Theorem for Non Negative Almost Supermartingales and Some Applications,” 1971. Almost-supermartingale convergence의 고전적 근거. [DOI](https://doi.org/10.1016/B978-0-12-604550-5.50015-8)
- S. Prajna, A. Jadbabaie, and G. J. Pappas, “A Framework for Worst-Case and Stochastic Safety Verification Using Barrier Certificates,” *IEEE TAC*, 2007. Hybrid·stochastic system의 unsafe reach probability를 barrier certificate로 bound한다. [DOI](https://doi.org/10.1109/TAC.2007.902736)
- Đ. Žikelić, M. Lechner, T. A. Henzinger, and K. Chatterjee, “Learning Control Policies for Stochastic Systems with Reach-Avoid Guarantees,” *AAAI*, 2023. Reach-avoid supermartingale certificate를 제시한다. [AAAI 원문](https://ojs.aaai.org/index.php/AAAI/article/view/26407)

### ISS·interconnection·model mismatch

- E. D. Sontag and Y. Wang, “New Characterizations of Input-to-State Stability,” *IEEE TAC*, 1996. Input disturbance와 state bound를 연결하는 ISS characterization. [DOI](https://doi.org/10.1109/9.536498)
- Z.-P. Jiang, A. R. Teel, and L. Praly, “Small-Gain Theorem for ISS Systems and Applications,” *Mathematics of Control, Signals and Systems*, 1994. Interconnected subsystem의 nonlinear small-gain 조건. [저자 PDF](https://web.ece.ucsb.edu/~teel/ECE236/jiang-teel-praly-1994.pdf)
- D. Q. Mayne, M. M. Seron, and S. V. Raković, “Robust Model Predictive Control of Constrained Linear Systems with Bounded Disturbances,” *Automatica*, 2005. Disturbance-invariant set과 robust constrained control. [DOI](https://doi.org/10.1016/j.automatica.2004.08.019)
- C. De Persis and P. Tesi, “Formulas for Data-Driven Control: Stabilization, Optimality, and Robustness,” *IEEE TAC*, 2020. 명시적 system-matrix identification 없이 data-dependent stabilization을 구성한다. [DOI](https://doi.org/10.1109/TAC.2019.2959924)

### Switching·delay·saturation

- J. P. Hespanha and A. S. Morse, “Stability of Switched Systems with Average Dwell-Time,” *CDC*, 1999. Slow-on-average switching 아래 exponential stability 조건을 제시한다. [DOI](https://doi.org/10.1109/CDC.1999.831330)
- J. Zhang, K. H. Johansson, J. Lygeros, and S. Sastry, “Zeno Hybrid Systems,” *International Journal of Robust and Nonlinear Control*, 2001. Hybrid system의 Zeno execution을 엄밀히 다룬다. [DOI](https://doi.org/10.1002/rnc.592)
- J. N. Tsitsiklis, D. P. Bertsekas, and M. Athans, “Distributed Asynchronous Deterministic and Stochastic Gradient Optimization Algorithms,” *IEEE TAC*, 1986. Communication delay와 update gap이 제한될 때의 asynchronous convergence를 분석한다. [DOI](https://doi.org/10.1109/TAC.1986.1104412)
- A. R. Teel, “Global Stabilization and Restricted Tracking for Multiple Integrators with Bounded Controls,” *Systems & Control Letters*, 1992. Bounded control과 saturation 아래 stabilizer 설계가 별도 문제임을 보여 준다. [DOI](https://doi.org/10.1016/0167-6911(92)90001-9)

### Safety·safe set

- A. D. Ames, X. Xu, J. W. Grizzle, and P. Tabuada, “Control Barrier Function Based Quadratic Programs for Safety Critical Systems,” *IEEE TAC*, 2017. Safe set의 forward invariance와 performance objective를 분리·결합한다. [DOI](https://doi.org/10.1109/TAC.2016.2638961)
- I. M. Mitchell, A. M. Bayen, and C. J. Tomlin, “A Time-Dependent Hamilton–Jacobi Formulation of Reachable Sets for Continuous Dynamic Games,” *IEEE TAC*, 2005. Uncertainty와 adversarial input 아래 reachable set을 계산한다. [DOI](https://doi.org/10.1109/TAC.2005.851439)
- J.-P. Aubin, “A Survey of Viability Theory,” *SIAM Journal on Control and Optimization*, 1990. State constraint 안에 머무를 수 있는 viability kernel과 controlled invariance를 정식화한다. [DOI](https://doi.org/10.1137/0328044)

### Proxy objective

- L. Gao, J. Schulman, and J. Hilton, “Scaling Laws for Reward Model Overoptimization,” *ICML*, 2023. Synthetic gold reward와 proxy reward를 분리해 optimization pressure에 따른 proxy–gold divergence를 측정한다. [PMLR 원문](https://proceedings.mlr.press/v202/gao23h.html)
- J. Skalse, N. H. R. Howe, D. Krasheninnikov, and D. Krueger, “Defining and Characterizing Reward Hacking,” 2022. Proxy reward 증가가 true reward를 악화시키지 않는 조건이 매우 강함을 형식화한다. [원문](https://arxiv.org/abs/2209.13085)

### “좋은 regulator는 model인가”의 원래 범위

- R. C. Conant and W. R. Ashby, “Every Good Regulator of a System Must Be a Model of That System,” *International Journal of Systems Science*, 1970. Entropy-minimal regulation과 simplest optimal mapping 아래의 good-regulator theorem. [원문 PDF](https://governance.foundation/assets/frameworks/other/Conant_Ashby%20Every%20Good%20Regulator%20of%20a%20system%20must%20be%20a%20model%20of%20that%20system.pdf)
- B. A. Francis and W. M. Wonham, “The Internal Model Principle of Control Theory,” *Automatica*, 1976. Robust output regulation과 exogenous-signal dynamics의 internal model을 연결한다. [DOI](https://doi.org/10.1016/0005-1098(76)90006-6)
- W. M. Wonham, “Towards an Abstract Internal Model Principle,” *IEEE Transactions on Systems, Man, and Cybernetics*, 1976. Abstract automata의 feedback·observability 조건에서 exosystem model을 다룬다. [DOI](https://doi.org/10.1109/TSMC.1976.4309444)

---

## 19. 최종 요약

LLM과 harness의 state 조합이 control-theoretic structure를 기능적으로 이룬다는 관점은 강력하다. 특히 다음을 설명한다.

```text
왜 log만 다시 넣는 것으로 부족한가
왜 best-so-far와 rollback이 필요한가
왜 metric 결함이 반복에서 증폭되는가
왜 stale state와 mode switching이 cycle을 만드는가
왜 budget과 permission이 capability 일부인가
왜 성공 뒤에도 absorption과 safe set이 필요한가
```

하지만 이 관점을 강하게 만들려면 “제어계처럼 보인다”에서 멈추지 않고 다음을 측정해야 한다.

```text
effective safe reachability
goal-relevant observability
conditional gold-progress drift
disturbance-to-error gain
switching and delay margin
budget viability frontier
proxy-to-gold selection regret
unsafe hitting and post-hit regression
```

그리고 internal model claim은 별도 증거가 필요하다.

```text
task success
  != explicit transition model
  != calibrated counterfactual model
  != specific Transformer representation
  != robust stability certificate
```

가장 생산적인 다음 단계는 기존 causal diagnostic protocol에 `V` drift, disturbance gain, dwell·delay sweep, budget viability, safe-set violation을 추가하고, synthetic task에서 planted control defect를 정확히 되찾는지 검증하는 것이다.
