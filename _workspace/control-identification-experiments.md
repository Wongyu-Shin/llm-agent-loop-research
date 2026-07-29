# Agent loop의 제어구조를 식별하는 반증 가능 실험

작성일: 2026-07-28  
상태: controlled diagnostic pilot 설계  
기반 문서: [`agent-loop-causal-diagnostic-protocol.md`](../reports/agent-loop-causal-diagnostic-protocol.md)  
목적: LLM과 harness의 결합이 어떤 제어구조로 작동하는지, 성능 비유가 아니라 개입 가능한 입출력 관계로 식별한다.

## 0. 결론

Agent loop를 제어이론으로 보는 가장 보수적인 출발점은 다음이다.

> LLM과 harness의 결합은 task environment를 대상으로 동작하는 **확률적·비선형·동적 output-feedback controller**일 수 있다. Harness의 summary, ledger, checkpoint, plan, budget, mode는 각각 observer state, controller memory, predictive model, integral-like accumulator, 또는 hybrid supervisor state의 후보이다.

여기서 중요한 제한은 세 가지다.

1. 외부 state가 존재한다는 사실만으로 observer, integral controller, MPC가 존재한다고 결론 내릴 수 없다. 그 state를 바꾸었을 때 예측된 입출력 signature가 나타나야 한다.
2. 제어이론의 `model`은 LLM 자체와 동의어가 아니다. 제어용 model은 action이 world state를 어떻게 바꿀지 예측하는 동역학 `\hat f`다. LLM weights, prompt state, harness simulator 중 어디에든 일부가 구현될 수 있고, 아예 없을 수도 있다.
3. 일반 agent는 LTI 시스템이 아니다. 선형성·시불변성 검사가 실패하면 고전 transfer function, gain margin, phase margin이라는 이름을 쓰지 않고 **조건부 causal response**와 **finite-budget robustness margin**만 보고한다.

따라서 이번 연구의 핵심 질문은 “agent가 controller처럼 보이는가?”가 아니다.

```text
어떤 state와 feedback channel을 개입했을 때
어떤 시간 지연을 두고
어떤 action과 world-state 변화가 발생하며,
그 관계가 어떤 제어구조의 고유 예측과 맞고
어떤 대안 설명을 배제하는가?
```

이를 위해 먼저 수치형 synthetic plant에서 signed error와 외생 disturbance를 만들고, 이후 finite DSL 또는 versioned transaction task에서 같은 signature가 재현되는지 확인한다.

---

## 1. 식별할 system boundary

### 1.1 최소 state-space 표현

한 agent step을 다음과 같이 둔다.

```text
x_(t+1) = f_(sigma_t)(x_t, u_exec,t, w_t; p_t)   # 실제 task/plant
o_t     = h_(sigma_t)(x_t) + v_t                  # tool/sensor observation
m_t     = M(o_t, xhat_t, u_exec,t)                # online metric/feedback

xhat_(t+1) = O(xhat_t, o_t, u_exec,t, m_t)        # observer/state updater
xi_(t+1)   = K_s(xi_t, r_t, xhat_t, e_t, mode_t) # controller memory
u_req,t    ~ K_a(r_t, xhat_t, xi_t, e_t, mode_t) # model+harness decision
u_exec,t   = A(u_req,t, constraints_t)            # parser/tool/actuator

mode_(t+1) = H(mode_t, guards_t)                  # branch/rollback/stop supervisor
e_t        = r_t - y_t                            # typed signed regulation error
```

| 기호 | Agent system에서의 대상 | 반드시 기록할 값 |
|---|---|---|
| `x_t` | 실제 repository, DB, browser, artifact, hidden task state | exact snapshot/hash와 gold state vector |
| `r_t` | 목표, acceptance contract, reference trajectory | canonical typed target |
| `y_t` | 목표와 직접 비교하는 regulated output | typed measurement 또는 gold-side projection |
| `o_t` | tool output, test result, counterexample, environment event | raw observation과 발생 시각 |
| `m_t` | observation을 score, pass/fail, critique로 바꾼 online feedback | metric fingerprint, raw score와 feedback |
| `xhat_t` | summary, retrieved memory, evidence ledger가 표현하는 상태 추정 | field별 값·provenance·version |
| `e_t` | 목표와 관측·평가 사이의 차이 | signed vector 또는 violated-constraint vector |
| `xi_t` | transcript, retry count, plan, accumulated failures 등 controller 내부 상태 | exact serialized state와 field diff |
| `u_req,t` | 모델 또는 harness가 요구한 action | tool name, typed parameter, candidate edit |
| `u_exec,t` | parser, permission, saturation 이후 실제 실행된 action | 요청–실행 차이와 거절 사유 |
| `w_t` | 외생적인 plant disturbance | 실험자가 주입한 impulse/step과 seed |
| `v_t` | observation noise | additive noise, label flip, omission, shuffle provenance |
| `mode_t` | PLAN, ACT, VERIFY, ROLLBACK, STOP 등의 supervisor mode | 실제 harness mode와 switch guard |
| `p_t` | 실제 plant parameter | task generator의 숨은 동역학 fingerprint |
| `\hat p_t` | controller가 받은 nominal model | prompt/simulator/model-card의 parameter |

이 분해에서 LLM과 harness는 하나의 controller `K=(O,K_s,K_a,H)`로 묶을 수 있다. 더 세밀한 실험에서는 observer, decision policy, actuator, supervisor를 하나씩 교체한다. 같은 LLM call이 summary와 action을 모두 생성하더라도 **호출의 기능적 역할**에 따라 분리한다.

### 1.2 state 하나가 여러 역할을 가질 수 있다

| Agent state | 가능한 제어 역할 | 그 역할을 지지하는 최소 signature |
|---|---|---|
| raw observation history | sensor history | observation impulse가 후속 action을 바꿈 |
| summary/retrieval | observer estimate | 같은 true state에서 estimation error가 줄고 downstream action이 개선됨 |
| violated-constraint ledger | controller memory 또는 integral-like state | 현재 observation을 고정해도 누적 과거가 action을 바꿈 |
| plan/rollout | predictive model state | predicted transition이 실제 action 선택을 설명하고 mismatch에 민감함 |
| best-so-far checkpoint | reference governor/anti-regression state | regression 직전 승격을 막거나 rollback을 일으킴 |
| retry count·failure count | integral-like accumulator 또는 단순 timer | error pulse 길이에 비례한 aftereffect가 있고 reset이 이를 제거함 |
| branch/rollback/stop flag | hybrid supervisor mode | guard 경계에서 mode별 transition law가 불연속적으로 전환됨 |
| budget·permission state | constraint/saturation state | `u_req != u_exec`를 예측하고 windup 방지 규칙을 작동시킴 |

이 표는 대응을 선언하는 표가 아니라 **검사할 후보를 만드는 표**다.

### 1.3 경쟁 가설

| ID | 가설 | 지지하는 관찰 | 반증 또는 대안 설명 |
|---|---|---|---|
| `H_CL` | 실제 feedback control이 있다 | disturbance 이후 real feedback에서 action이 disturbance를 상쇄하고 output recovery가 open-loop보다 좋음 | feedback mask/shuffle과 real feedback이 동등하며 positive control은 민감함 |
| `H_OBS` | persistent state가 observer처럼 기능한다 | oracle state가 estimation error와 gold outcome을 함께 개선하고 stale state가 방향성 있게 악화 | state recall은 변해도 action/outcome이 변하지 않거나 policy swap만 효과 |
| `H_NEG` | 안정적인 negative feedback region이 있다 | plant mapping을 거친 action effect가 작은 output perturbation을 상쇄하고 error가 수축하며 bounded gain/delay/noise 영역이 존재 | action effect가 perturbation을 강화하거나 error가 지속 성장하거나 feedback polarity와 무관 |
| `H_MPC` | receding-horizon control과 유사한 구조가 있다 | 매 step 새 observation으로 horizon optimization을 다시 하고 첫 action만 실행; freeze-plan보다 disturbance recovery가 좋음 | 초기 plan suffix를 그대로 실행하거나 horizon/terminal condition이 action에 영향 없음 |
| `H_INT` | integral-like memory가 있다 | 같은 current state에서도 누적 error에 따라 action이 달라지고 reset·leak가 aftereffect를 예측대로 바꿈 | 전체 history 효과가 현재 observation 차이로 설명되거나 pulse duration 효과가 없음 |
| `H_AW` | anti-windup이 있다 | saturation 중 accumulator가 제한되고 release overshoot·recovery lag가 감소 | requested action이 막혀도 stale intent가 누적되고 release 후 과도 action |
| `H_HYB` | 기능적 hybrid mode switching이 있다 | mode별 transition model과 guard intervention이 out-of-sample behavior를 설명 | mode label만 바뀌고 action/world transition은 연속·동일 |

`H_*`는 mutually exclusive하지 않다. 하나의 agent가 observer, integral-like memory, receding-horizon planner와 hybrid supervisor를 동시에 가질 수 있다.

---

## 2. 최소 testbed

### 2.1 주 testbed: controllable vector regulator

Classical response를 추정하려면 signed input과 signed output이 필요하다. 다음 환경을 primary identification plant로 쓴다.

```text
x_(t+1) = A(p_t) x_t + B(p_t) sat(u_t) + w_t
y_t     = C x_t + v_t
goal    = ||W(x_t - r_t)|| <= epsilon 상태를 L step 유지한 뒤 STOP
```

권장 기본값:

- state dimension `2` 또는 `3`
- action은 JSON 숫자 vector와 `observe|act|verify|stop`
- `u_max`로 actuator saturation 가능
- `A(p), B(p)`는 stable, weakly unstable, coupled mode를 generator가 선택
- controller에는 nominal `A(\hat p), B(\hat p)`를 문서로 제공하거나 제공하지 않는 조건을 둠
- observation은 full, partial, delayed를 선택 가능
- hidden gold evaluator만 true `x_t`, `p_t`, disturbance를 봄
- surface form은 “server load 조정”, “inventory rebalance”, “parameter repair”처럼 바꾸되 latent dynamics는 보존

이 task는 feedback gain, delay, noise, mismatch, impulse response, windup을 정량화하기 위한 측정기다. 실제 agent 업무를 대표한다고 가정하지 않는다.

### 2.2 전이 검증 testbed: typed constraint repair

수치 task에서만 나타나는 artifact인지 확인하기 위해 finite DSL 또는 CEGIS task에 같은 구조를 옮긴다.

```text
x_t     = 아직 위반 중인 constraint의 bit vector
o_t     = verifier가 반환한 violated clause 또는 counterexample
u_t     = candidate edit 또는 clause-directed repair
e_t     = violation bit vector
success = exhaustive hidden evaluator에서 모든 bit가 0
```

여기서는 고전적인 스칼라 gain 대신 다음을 사용한다.

- feedback availability `alpha`: real feedback policy와 sham-feedback policy의 mixture
- constraint enforcement strength: soft reminder / selection penalty / hard rejection
- delay: counterexample을 `d` step 뒤 전달
- noise: clause omission, wrong-clause insertion, instance-matched shuffle

수치 testbed의 transfer function을 DSL task에 그대로 이식하지 않는다. 동일한 qualitative signature와 conditional impulse response만 비교한다.

### 2.3 공통 통제

- 모든 cell은 model calls, action/tool budget, wall-clock limit를 동일하게 둔다.
- open-loop에도 real feedback과 길이·형식이 같은 neutral sham payload를 넣어 token/compute 차이를 막는다.
- task instance, initial state, disturbance sequence, model fingerprint를 paired block으로 묶는다.
- online controller에는 gold state·treatment label을 노출하지 않는다.
- `temperature=0`을 결정성으로 간주하지 않는다. Hosted model은 각 checkpoint에서 baseline과 intervention을 같은 횟수로 재표집한다.
- 먼저 reference controller가 모든 feasible instance를 budget 안에서 푸는지 확인한다.

---

## 3. 구조별 개입

### 3.1 Open-loop와 closed-loop

단지 반복 호출한다는 이유로 closed loop라 부르지 않는다. 최소 네 cell이 필요하다.

| feedback | disturbance | 의미 |
|---|---|---|
| sham/masked | 없음 | 반복·compute만 있는 feedforward baseline |
| real | 없음 | feedback이 없어도 풀리는 task의 ceiling |
| sham/masked | randomized pulse | precommitted/open-loop disturbance response |
| real | 같은 randomized pulse | closed-loop disturbance rejection |

Open-loop controller는 `r_t`, initial observation, time, budget만 보고 action sequence를 정하며 step별 output을 받지 않는다. Real feedback condition은 매 step의 observation을 받는다. 두 조건 모두 동일 횟수로 model을 호출한다.

추가로 donor closed-loop run에서 기록한 action sequence를 새 matched plant에 외생적으로 재생하는 `broken-loop replay`를 둔다. 이것은 plant response를 확인하는 조건이지 feedback의 가치를 추정하는 primary contrast는 아니다.

주요 효과:

```text
CL_advantage(B)
  = E[
      1 - sum_(ell=0)^B d_(t+ell, real)
          / sum_(ell=0)^B d_(t+ell, sham)
    ]
```

`H_CL`을 지지하려면 다음이 함께 나타나야 한다.

1. `do(observation_t = observation_t + delta)`가 후속 action distribution을 바꾼다.
2. forced-action으로 따로 추정한 plant mapping을 적용했을 때 action effect가 output disturbance를 상쇄한다.
3. gold-state recovery가 sham보다 좋아진다.
4. shuffled observation과 unrelated field negative control에서는 같은 효과가 없다.

성공률만 높고 1–3 중 하나가 없으면 feedback controller보다는 더 많은 context, lucky resampling, 또는 feedforward planning 설명이 남는다.

### 3.2 Observer ablation

True state `x_t`와 harness state `xhat_t`를 분리해 다음 네 수준을 paired replay한다.

| 수준 | intervention |
|---|---|
| normal | production summary/retrieval/state updater |
| oracle | 같은 schema에 canonical true task-relevant field만 삽입 |
| null | field를 길이 일치 neutral placeholder로 교체 |
| stale/corrupt | `t-d` state 또는 matched 다른 instance state 삽입 |

두 효과를 분리한다.

```text
estimation effect = Loss(x_t, xhat_t) 변화
control effect    = gold outcome과 action 변화
```

Observer 역할의 강한 증거는 oracle이 estimation error와 control outcome을 함께 개선하고, stale intervention이 state-version mismatch 방향으로 악화하며, exact same `xhat_t`에서 policy만 바꾼 조건으로 이 효과가 설명되지 않는 것이다.

Oracle state에는 그 시점에 존재하는 task state만 넣는다. 미래 disturbance, latent solution, gold success label, optimal action을 넣으면 observer repair가 아니라 solution leakage가 된다.

다음 probe를 매 step 수행한다.

- task-relevant latent field별 exact recall
- uncertainty 또는 confidence가 있으면 calibration
- observation impulse가 `xhat_(t+1)`에 반영되는 lag
- current raw observation을 고정한 state-history swap
- `do(xhat_t)` 이후 action과 world outcome의 forward replay

`xhat_t`가 true state를 닮았지만 action에 영향을 주지 않으면 이는 monitoring cache이지 control observer가 아니다.

### 3.3 Feedback gain, delay, noise

#### Gain의 두 구현

수치 plant에서는 동일 checkpoint와 common-random seed에서 feedback-conditioned corrective action을 다음처럼 분리할 수 있다.

```text
u_ff,t = action from sham-feedback branch
u_fb,t = action from real-feedback branch
u_req,t(k) = u_ff,t + k * (u_fb,t - u_ff,t)
```

이때 `k`는 agent 전체의 loop gain이 아니라 **관찰된 corrective component에 대한 harness gain**이다. `k ∈ {0, 0.5, 1, 2, 4}`를 먼저 시험하고 critical region에서 이분 탐색한다.

두 branch의 action을 같은 typed numeric space로 표현할 수 없으면 이 보간을 사용하지 않는다. 그 경우 symbolic task에서처럼 real/sham policy mixture 확률 `alpha` 또는 명시적인 selection-score weight만 조작하고 이를 classical gain이라고 부르지 않는다.

Controller가 typed numeric error를 직접 소비하는 경우에는 다음 channel도 별도로 시험한다.

```text
e_tilde_t = k * e_(t-d) + n_t
```

이 scaling을 LLM이 무시할 수 있으므로 실제 action sensitivity를 반드시 측정한다. 자연어 critique 반복 횟수를 gain이라고 부르지 않는다.

#### Delay

`d ∈ {0,1,2,4}` step을 사용한다.

- tagged delay: “step `t-d`의 observation”임을 명시
- untagged stale delay: 최신인 것처럼 전달

전자는 순수 latency 대응 능력, 후자는 version/provenance 안전성을 측정한다. 둘을 섞지 않는다.

#### Noise

`eta ∈ {0,0.1,0.3,0.5}`를 사용한다.

- numeric: gold-scale 대비 additive noise RMS
- binary/clause: label flip 또는 clause corruption probability
- omission: evidence component dropout
- shuffle: 동일 분포 다른 instance feedback

Noise seed는 baseline과 intervention에 공통으로 사용한다.

예상 signature:

- 작은 `k`에서는 느린 recovery 또는 steady-state error
- 안정 영역에서는 error 감소와 낮은 action effort
- 큰 `k` 또는 큰 `d`에서는 overshoot, sign alternation, cycle 증가
- 큰 `eta`에서는 action variance와 hidden utility variance 증가

단조롭지 않은 성능 곡선은 negative feedback의 증거가 될 수 있지만, 그것만으로 안정성을 증명하지 않는다.

### 3.4 Plant/model mismatch

제어용 nominal model과 실제 plant를 분리한다.

```text
mu = ||theta(P_actual) - theta(P_nominal)|| / scale
```

`mu ∈ {0, 0.25, 0.5, 1.0}`을 쓰고 다음 두 mode를 비교한다.

- plan-execute: initial nominal model로 만든 action suffix를 그대로 실행
- replan: 매 observation 뒤 nominal model과 current estimate로 다음 action을 다시 계산

필수 prediction probe:

```text
before action:
  predicted next state xhat_(t+1|t)
  predicted H-step cost
after observation:
  prediction residual
  revised model/state estimate
```

다음 패턴을 구분한다.

| 결과 | 해석 |
|---|---|
| mismatch가 커질수록 prediction residual과 cost가 함께 악화 | model-based action 가설 지지 |
| replan이 moderate mismatch를 회복 | feedback/receding-horizon robustness 지지 |
| correct plant description 교체가 prediction과 action을 함께 회복 | explicit model channel의 causal role |
| description은 바뀌지만 prediction/action은 불변 | nominal model이 기능적으로 사용되지 않음 |
| prediction은 정확하지만 action이 개선되지 않음 | model보다 optimizer/policy/actuator 병목 |

LLM에 동역학 설명을 주었을 때 성능이 변했다는 사실만으로 LLM 내부에 stable world model이 있다고 결론 내리지 않는다.

### 3.5 Receding-horizon signature

MPC-like 구조를 주장하려면 “계획을 쓴다”보다 강한 조건이 필요하다.

1. current state estimate에서 horizon `H`의 future action과 cost를 계산한다.
2. 첫 action만 실행한다.
3. 새 observation을 받은 뒤 horizon을 앞으로 이동해 다시 계산한다.
4. constraint와 terminal condition이 action에 영향을 준다.

실험은 `H ∈ {1,3,6}`과 `plan-execute / replan`의 `3×2`다.

각 step에서 다음을 기록한다.

```text
planned actions: u_(t:t+H-1|t)
predicted states: xhat_(t+1:t+H|t)
executed action: u_t
next-step replanned suffix: u_(t+1:t+H|t+1)
```

세 가지 개입을 넣는다.

- unexpected plant disturbance: 최초 plan 뒤 `w_t` 주입
- terminal-cost boundary: horizon 끝에서만 보이는 penalty 위치를 이동
- model mismatch: horizon prediction만 틀리게 만드는 plant twin

MPC-like signature:

- `u_t`가 동일 정보의 reference finite-horizon solver 첫 action과 높은 일치
- disturbance가 없으면 shifted suffix와 replanned plan이 대체로 일치
- disturbance가 있으면 suffix를 버리고 current state에 맞게 재계산
- horizon/terminal boundary를 이동하면 predicted reach 안에서만 첫 action이 체계적으로 바뀜
- replan이 plan-execute보다 mismatch와 disturbance를 더 잘 회복

Plan text가 매 step 새로 생성돼도 action이 initial suffix와 같고 observation intervention에 반응하지 않으면 receding-horizon 구조는 반증된다.

### 3.6 Integral-like memory

Integral-like state의 최소 local model을 다음처럼 둔다.

```text
I_(t+1) = lambda * I_t + K_I * e_t
u_t     = K_P e_t + G(I_t, other_state)
```

Natural-language transcript 전체를 `I_t`로 부르지 않는다. 다음 pulse–reset 실험으로 기능을 확인한다.

1. constant signed bias `b`를 `L ∈ {1,4}` step 동안 observation에 넣되, history 생성 중에는 모든 branch에 같은 `u_exec`와 plant transition을 강제한다.
2. bias를 제거하고 true current `x_t,o_t`를 모든 branch에서 같게 만든다. Branch 사이에는 candidate memory만 다르게 남긴다.
3. memory를 `normal / reset / leak(lambda=0.5) / none`으로 바꾼다.
4. 이후 action aftereffect와 recovery를 측정한다.

강한 signature:

- 현재 `x_t,o_t`가 같아도 pulse duration 또는 누적 signed error에 따라 `u_t`가 달라짐
- pulse duration이 길수록 같은 방향 aftereffect가 커짐
- memory reset이 aftereffect를 즉시 제거
- leaky state가 aftereffect half-life를 예측 가능하게 줄임
- persistent constant disturbance의 steady-state error를 memory가 감소시킴

단순한 “지난 오류를 기억한다”는 integral action보다 약한 주장이다. 누적량과 action 사이의 dose–response, reset, leak가 모두 필요하다. 비선형·포화 signature만 보이면 `integral-like`라고 제한해서 부른다.

### 3.7 Windup과 anti-windup

Agent의 actuator saturation은 다음처럼 만든다.

- tool permission이 일시적으로 거부됨
- action parameter가 `u_max`로 clip됨
- write budget이 0이지만 observation은 계속 들어옴
- safety gate가 requested action을 실행하지 않음

반드시 `u_req`와 `u_exec`를 별도로 기록한다.

```text
saturation_t = 1[u_req,t != u_exec,t]
tracking_gap = u_exec,t - u_req,t
```

`saturation duration ∈ {0,4}`와 다음 세 controller를 `2×3`으로 비교한다.

| 조건 | accumulator 처리 |
|---|---|
| no anti-windup | error memory가 계속 누적 |
| conditional integration | saturation 중 같은 방향 누적을 동결 |
| back-calculation | `u_exec-u_req`를 memory update에 되먹임 |

Saturation 해제 뒤 측정한다.

- first action magnitude
- overshoot
- stale retry burst
- settling steps
- invalid/duplicate side effects
- cumulative action effort

Anti-windup의 evidence는 saturation이 없을 때 baseline 성능을 유지하면서, saturation이 있을 때 release overshoot와 recovery lag를 줄이는 것이다. 단순히 memory를 모두 삭제해 성능도 함께 잃으면 anti-windup이라기보다 reset이다.

### 3.8 Hybrid mode switching

Harness가 `PLAN → ACT → VERIFY → ROLLBACK/STOP`을 가진다면 mode label이 아니라 mode별 transition law를 식별한다.

최소 네 조건:

1. production guard와 mode
2. guard 바로 아래 `g=c-epsilon`
3. guard 바로 위 `g=c+epsilon`
4. hysteresis 또는 minimum dwell-time를 추가한 supervisor

추가 causal replay:

```text
do_mode(t, PLAN|ACT|VERIFY|ROLLBACK)
do_guard(t, c-epsilon|c+epsilon)
do_dwell(t, 0|2)
```

기능적 switching evidence:

- 같은 continuous state 근방에서 guard 개입만으로 mode와 action law가 함께 바뀜
- mode별로 fit한 response model이 단일 model보다 held-out prediction error가 낮음
- forced mode가 downstream outcome을 예측된 방향으로 바꿈
- hysteresis/dwell-time가 boundary chattering과 cycle을 줄임

모든 개별 mode가 안정적으로 보여도 switching sequence가 안정적이라는 뜻은 아니다. Switch rate, dwell-time, mode transition matrix, mode별 recovery를 함께 보고한다.

---

## 4. 최소 실험 매트릭스

다음은 전체 Cartesian product가 아니다. 각 구조를 반증하는 데 필요한 one-factor block이며 동일 baseline fingerprint는 재사용한다.

| Block | nominal cells | factor | primary outcome | 구조 지지 signature | 구조 반증 signature |
|---|---:|---|---|---|---|
| `E0` integrity | 별도 | no-op replay, evaluator self-test, positive/negative control | replay fidelity | exact state/tool 복원과 known intervention 회수 | 복원이 안 되거나 gold self-test 실패 |
| `E1` closure | `2×2=4` | feedback real/sham × pulse on/off | recovery area, action response | pulse가 있을 때만 real feedback 우위 | real–sham equivalence, positive control은 작동 |
| `E2` observer | `4` | normal/oracle/null/stale | state loss, gold utility | oracle repair + stale break | recall만 변하고 action/outcome 불변 |
| `E3` robustness | `11` | gain 5, delay 4, noise 4; baseline 공유 | contraction, overshoot, cycles | bounded stable region과 critical boundary | polarity·크기·delay에 무관 |
| `E4` mismatch | `4×2=8` | mismatch × plan-execute/replan | prediction residual, recovery | mismatch dose–response와 replan recovery | nominal model change가 prediction/action에 무영향 |
| `E5` horizon | `3×2=6` | `H` × plan-execute/replan | oracle-MPC action agreement | shifted-horizon·terminal-boundary signature | plan suffix 고정, horizon 무영향 |
| `E6` integral | `4×2=8` | memory mode × pulse duration | aftereffect, steady-state offset | accumulation–reset–leak dose response | current observation만으로 모두 설명 |
| `E7` anti-windup | `3×2=6` | anti-windup mode × saturation | release overshoot, lag | saturation에서만 recovery 개선 | no-windup과 동등 또는 baseline 훼손 |
| `E8` hybrid | `4` | guard below/above, production, dwell | mode/action transition, chatter | guard와 mode별 dynamics의 causal effect | label만 변하고 law는 동일 |

Nominally `51` cells이지만 baseline을 공유해 manifest에서 동일한 configuration fingerprint를 deduplicate한다. 이 숫자는 구조적 cell 수이지 통계적 표본 수가 아니다.

### 실행 순서

```text
E0
 -> E1 closure
 -> E2 observer
 -> E3 gain/delay/noise boundary
 -> E4 mismatch
 -> E5 receding horizon
 -> E6 integral
 -> E7 anti-windup
 -> E8 hybrid switching
```

- `E1`이 feedback influence positive control에도 실패하면 이후 gain/delay 실험은 중단한다.
- `E2`에서 target state가 action에 영향을 주지 않으면 integral 후보로 같은 field를 쓰지 않는다.
- `E4`에서 prediction probe 자체가 무의미하면 `E5` 결과를 MPC가 아니라 generic replanning으로만 해석한다.
- `E6`에서 accumulation signature가 없으면 `E7`을 windup이라고 부르지 않고 saturation recovery 실험으로만 보고한다.

기존 진단 프로토콜의 default를 따라 primary contrast당 최소 `36` paired instance-seed unit으로 시작하고 pilot variance로 power를 다시 계산한다. 한 checkpoint의 stochastic forward replay는 branch당 `K=20`으로 시작해 최대 `100`까지 늘린다.

---

## 5. System identification과 causal response

### 5.1 자연 로그의 회귀만으로는 부족하다

Closed loop에서는 controller action `u_t`가 observation noise와 disturbance에 반응하므로 `u_t`와 disturbance가 상관된다. 따라서 자연 trajectory의 `y_(t+1) ~ u_t` 회귀는 plant causal effect가 아니다.

다음 외생 excitation을 별도 randomization한다.

| excitation | intervention | 식별 대상 |
|---|---|---|
| plant disturbance | `do(w_t = +delta|-delta|0)` | closed-loop disturbance response |
| observation impulse | `do(o_t = o_t + delta)` | controller/observer response |
| forced action | `do(u_exec,t = u_t + delta)` | plant response |
| state impulse | `do(xhat_t[field] = value+delta)` | state field의 controller effect |
| mode/guard | `do(mode_t)` 또는 `do(guard_t)` | hybrid transition law |

Excitation sequence는 sign, amplitude, time을 randomized하고 controller에게 treatment label을 숨긴다. Input window의 Hankel/design matrix rank와 condition number를 기록해 excitation이 부족한 run에서 model order를 주장하지 않는다. Persistently exciting하지 않은 입력에서 unobserved mode를 식별할 수 없다는 점은 고전 system identification과 같다.

### 5.2 추정할 impulse response

Typed numeric feature `phi(u)`와 gold output `y`를 사용한다.

```text
h_(u<-o)(ell; delta)
  = E[phi(u_(t+ell)) | do(o_t=o_t+delta)]
    - E[phi(u_(t+ell)) | do(o_t=o_t)]

h_(y<-u)(ell; delta)
  = E[y_(t+ell) | do(u_exec,t=u_t+delta)]
    - E[y_(t+ell) | do(u_exec,t=u_t)]

h_(e<-w)(ell; delta)
  = E[e_(t+ell) | do(w_t=delta)]
    - E[e_(t+ell) | do(w_t=0)]

h_(xhat<-o)(ell; delta)
  = E[xhat_(t+ell) | do(o_t=o_t+delta)]
    - E[xhat_(t+ell) | do(o_t=o_t)]
```

이것들은 finite-horizon generalized causal impulse response다. Mode, state region, task family를 conditioning variable로 남긴다. Action embedding을 primary input으로 쓰지 않는다. 가능하면 tool type, parameter vector, edit delta, constraint bit처럼 의미가 고정된 typed feature를 쓴다.

Binary success에는 output impulse 대신 cumulative hitting response를 쓴다.

```text
H_success(ell)
  = P(tau_G <= t+ell | do(input_t=treated))
    - P(tau_G <= t+ell | do(input_t=control))
```

### 5.3 Transfer-function을 보고할 수 있는 조건

Local impulse response가 있을 때 truncated transfer estimate를 만들 수 있다.

```text
H_hat(z) = sum_(ell=0)^L h_hat(ell) z^(-ell)
```

그러나 다음 세 검사를 먼저 통과해야 한다.

```text
homogeneity:
  h(2*delta) ~= 2*h(delta)

additivity:
  response(delta_1 + delta_2)
    ~= response(delta_1) + response(delta_2)

time-shift invariance:
  h_t(ell) ~= h_(t+s)(ell)
  # same mode/state region에서만 비교
```

정규화 오차는 예를 들어 다음처럼 계산한다.

```text
D_hom =
  ||h(2*delta) - 2*h(delta)||
  / (2*||h(delta)|| + epsilon)

D_add =
  ||h(delta_1+delta_2) - h(delta_1) - h(delta_2)||
  / (||h(delta_1)|| + ||h(delta_2)|| + epsilon)

D_shift =
  ||h_t - h_(t+s)||
  / (0.5*(||h_t|| + ||h_(t+s)||) + epsilon)
```

각 normalized deviation의 95% upper bound가 pilot predeclared tolerance `0.10` 이하일 때만 해당 local region에서 LTI approximation을 보고한다. 실패하면 transfer function 대신 sign·amplitude·mode별 conditional causal response를 보고한다.

Closed-loop response 하나만으로 plant와 controller를 유일하게 분해하지 않는다. Plant는 forced-action intervention, controller는 observation intervention으로 따로 식별한다. 개입이 불가능하면 randomized disturbance를 instrument로 사용하는 간접 추정을 하되 assumption을 명시한다.

### 5.4 Finite-budget 대체지표

Agent task에서는 asymptotic stability보다 다음 지표가 직접 측정 가능하다.

```text
d_t = normalized gold distance to goal

DisturbanceRejection(B)
  = 1 - sum_(ell=0)^B d_(t+ell, closed)
          / sum_(ell=0)^B d_(t+ell, open)

rho_local(ell)
  = E[d_(t+ell+1) | perturbed]
    / E[d_(t+ell) | perturbed]
  # denominator가 0보다 큰 lag에서만 계산

IAE_B = sum_(t=0)^B ||e_t||
Effort_B = sum_(t=0)^B ||u_exec,t||
```

함께 보고할 값:

- time-to-first-valid와 `success@B`
- `epsilon` band에 들어간 뒤 `m` step 유지하는 settling time
- first correction 뒤 최대 gold-distance overshoot
- response sign alternation과 cycle probability
- valid-state regression rate
- disturbance-rejection area
- action/tool/token cost
- safety·irreversible side-effect rate
- observer estimation error와 state-version mismatch
- requested/executed action gap
- mode별 dwell-time와 switching rate

`rho_local`의 95% upper bound가 `1`보다 작으면 해당 perturbation region에서 expected contraction evidence다. Lower bound가 `1`보다 크면 local divergence evidence다. Interval이 `1`을 가로지르면 inconclusive다. 이 결과를 전역 또는 asymptotic 안정성으로 확대하지 않는다.

---

## 6. Empirical stability margins

고전 gain/phase margin은 LTI open-loop transfer `L(j omega)`를 식별했을 때만 계산한다. 대부분의 agent에는 다음 finite-budget margin이 더 정직하다.

```text
S = {
  success_LCB >= s_min,
  normalized_IAE <= q_max,
  cycle_rate_UCB <= c_max,
  safety_violations == 0
}

gain interval K_safe
  = connected interval containing k=1 where S holds

delay margin d*
  = max d where S holds

noise margin eta*
  = max eta where S holds

mismatch margin mu*
  = max mu where S holds
```

Pilot default:

- `s_min`: no-disturbance reference success의 `0.8`배와 absolute `0.70` 중 큰 값
- `q_max`: baseline real-feedback normalized IAE의 `1.25`배
- `c_max`: `0.10`
- safety invariant: 한 번이라도 위반하면 해당 cell은 unsafe

이 값은 출판 전 domain risk에 맞게 사전 등록해 교체한다. 결과를 보고 임계값을 움직이지 않는다.

Boundary 탐색은 coarse grid 뒤 이분 탐색을 사용한다. 각 critical point에서 perturbation sign과 seed를 바꿔 재현한다.

### Phase-like delay signature

LTI approximation을 통과하지 못해도 delay가 oscillation을 유발하는지는 측정할 수 있다.

```text
sign_alternation =
  mean_t 1[sign(e_t) != sign(e_(t-1))]

delay_failure_curve =
  P(cycle or regression or budget_failure | d)
```

Delay가 커질수록 correction의 방향이 stale error를 따라가고 alternation·overshoot가 함께 증가하면 phase-lag-like instability evidence다. 이를 classical phase margin degree로 환산하지 않는다.

---

## 7. Causal replay 절차

기존 프로토콜의 frozen replay와 forward replay 구분을 유지한다.

### 7.1 한 impulse의 실행

1. baseline step `t` 직전의 environment, state, mode, budget을 복원한다.
2. no-op branch를 `K`번 실행해 replay distribution을 확인한다.
3. intervention branch에서 `w_t`, `o_t`, `xhat_t`, `u_t`, `mode_t` 중 하나만 바꾼다.
4. 같은 disturbance/noise seed와 model sampling block을 사용한다.
5. intervention 이후 tool과 model을 실제로 다시 실행한다.
6. horizon `L` 동안 typed state/action/output을 기록한다.
7. 반대 부호 impulse와 unrelated-field negative control을 실행한다.
8. baseline과 intervention의 outcome distribution과 response curve를 비교한다.

State나 mode intervention은 schema-valid value와 같은 task phase의 source trajectory를 우선 사용한다. Off-manifold 조합이 불가피하면 별도 flag를 남기고, 그 branch의 효과만으로 production mechanism을 단정하지 않는다.

### 7.2 필요한 intervention API

```text
do_disturbance(t, channel, amplitude, duration)
do_observation(t, field, delta_or_replacement)
do_observer_state(t, json_pointer, replacement)
do_feedback_channel(t, gain, delay, noise)
do_action_requested(t, typed_action)
do_action_executed(t, typed_action)
do_plant_parameter(t, parameter, value)
do_nominal_model(t, parameter, value)
do_plan_horizon(t, H)
do_memory(t, reset|leak|freeze|backcalculate)
do_mode(t, mode)
do_guard(t, guard_id, value)
```

각 event에는 intervention provenance, pair ID, exact model input, `u_req`, `u_exec`, `x`, `xhat`, `e`, mode, plan predictions, gold outcome을 남긴다.

### 7.3 상호작용

Single intervention이 작고 joint intervention이 클 수 있다.

```text
Interaction_(observer, policy)
  = Delta_(observer+policy)
    - Delta_observer
    - Delta_policy
```

특히 다음 joint effect를 사전 등록한다.

- observer quality × feedback delay
- mismatch × replanning
- integral memory × saturation
- gain × delay
- switching guard × dwell-time

모든 상호작용을 사후 탐색하지 않는다. 위 다섯 개만 primary로 두고 나머지는 exploratory로 표시한다.

---

## 8. 판정 규칙

### 8.1 먼저 실험 자체의 실패를 판정한다

다음 중 하나면 구조 판정을 중단한다.

- deterministic snapshot/hash 복원이 `100%`가 아님
- deterministic tool replay가 `100%`가 아님
- gold evaluator planted self-test가 `100%`가 아님
- treatment가 exact model input 밖의 hidden channel로 누출됨
- positive control이 expected action/output change를 만들지 못함
- paired branch의 budget·tool schema·environment가 달라짐
- excitation design matrix가 target local order에 필요한 rank를 갖지 못함

Hosted model action-match가 낮은 것은 자동 중단 사유가 아니다. 대신 branch별 outcome distribution을 충분히 반복하고 interval을 넓게 보고한다.

### 8.2 구조 가설의 `supported / refuted / inconclusive`

각 구조는 최소 하나의 `repair`, 하나의 `break`, 하나의 negative control을 요구한다.

```text
practical threshold:
  binary gold success = 0.10
  normalized utility/recovery = 0.10

equivalence band:
  binary gold success = [-0.05, +0.05]
  normalized response = [-0.05, +0.05]
```

| 판정 | 조건 |
|---|---|
| `supported in tested regime` | repair와 break가 모두 예측 방향으로 practical threshold를 넘고 95% interval이 `0`을 제외; negative control은 equivalence band 안 |
| `refuted in tested regime` | positive control과 sensitivity가 통과했는데 targeted effect의 95% interval 전체가 equivalence band 안, 또는 effect가 반복해서 반대 방향 |
| `inconclusive` | interval이 넓음, intervention이 다른 변수도 바꿈, excitation 부족, effect가 threshold 경계, interaction만 가능 |

한 task family에서만 지지되면 family-specific이라고 쓴다. `supported`도 model, harness version, state region, budget 범위 밖으로 일반화하지 않는다.

### 8.3 Stability failure

서로 다른 failure label을 합치지 않는다.

| label | 판정 규칙 |
|---|---|
| `unsafe` | safety 또는 irreversible invariant를 한 번이라도 위반 |
| `locally divergent` | perturbation 뒤 두 개 이상의 연속 lag에서 `rho_local`의 95% lower bound가 `1`보다 큼 |
| `cyclic` | error/action hash cycle이 두 번 이상 재방문하고 budget 내 탈출하지 못함 |
| `non-absorbing` | valid state 도달 뒤 regression rate의 95% lower bound가 pilot threshold `0.10`보다 큼 |
| `outside empirical safe set` | `success_LCB`, `IAE`, `cycle_rate` 중 하나가 Section 6의 safe set을 벗어남 |
| `failed-to-settle within B` | budget 안에 settling condition을 충족하지 못했지만 위 divergence/cycle 증거는 없음 |

Budget exhaustion 하나만으로 수학적 불안정이라고 하지 않는다. `outside empirical safe set`도 해당 budget과 tested perturbation 범위의 공학적 판정이지 전역 불안정성 증명이 아니다.

### 8.4 MPC, integral, hybrid에 대한 과잉 주장 방지

- horizon effect만 있고 explicit prediction/action agreement가 없으면 `lookahead-sensitive`, MPC라고 하지 않음
- memory reset effect만 있고 cumulative signed-error dose response가 없으면 `history-dependent`, integral이라고 하지 않음
- mode label별 성능 차이만 있고 guard/action transition effect가 없으면 `staged workflow`, hybrid controller라고 하지 않음
- gain/delay curve가 있어도 local linearity 검사를 통과하지 않으면 classical gain/phase margin을 보고하지 않음

---

## 9. 필요한 추가 로그

기존 `loop-causal-v1` schema에 다음 control-identification extension을 붙인다.

```json
{
  "control": {
    "reference": [0.0, 0.0],
    "gold_state": "evaluator-only-blob",
    "observed_output": [0.3, -0.1],
    "observer_state": "typed-state-blob",
    "signed_error": [-0.3, 0.1],
    "requested_action": [0.5, 0.0],
    "executed_action": [0.2, 0.0],
    "saturation": true,
    "saturation_reason": "u_max",
    "disturbance": [0.0, 0.2],
    "observation_noise": [0.0, 0.0],
    "feedback_channel": {
      "gain": 1.0,
      "delay_steps": 0,
      "noise_level": 0.0,
      "source_step": 4
    },
    "plant": {
      "actual_fingerprint": "hidden-evaluator-hash",
      "nominal_fingerprint": "controller-visible-hash",
      "mismatch_level": 0.25
    },
    "prediction": {
      "horizon": 3,
      "state_rollout": "blob",
      "action_rollout": "blob",
      "predicted_cost": 1.2,
      "residual_after_observation": null
    },
    "memory": {
      "candidate_integral_field": "constraint_pressure",
      "value": "blob",
      "update_mode": "normal|reset|leak|freeze|backcalculate"
    },
    "supervisor": {
      "mode": "PLAN|ACT|VERIFY|ROLLBACK|STOP",
      "guard_values": {"acceptance_score": 0.8},
      "switch_reason": "guard-id",
      "dwell_steps": 2
    }
  }
}
```

`gold_state`와 `actual_fingerprint`는 evaluator store에 두고 model-facing trace에는 hash만 남긴다.

---

## 10. 구현 우선순위

1. controllable vector regulator와 exhaustive reference controller
2. `u_req/u_exec`, plant disturbance, gold-state recorder
3. no-op checkpoint replay
4. `E1` open/closed disturbance rejection
5. observer field intervention과 response logger
6. gain/delay/noise manifest와 safe-region estimator
7. nominal/actual plant twin과 prediction probe
8. horizon freeze/replan controller
9. accumulator reset/leak와 saturation/anti-windup wrapper
10. hybrid guard/mode intervention
11. generalized impulse response와 cluster bootstrap report
12. finite DSL/CEGIS confirmatory transfer

첫 milestone은 “제어이론 용어를 모두 시각화하는 것”이 아니라 다음 세 결과를 재현하는 것이다.

```text
1. real feedback가 randomized disturbance를 sham보다 잘 제거한다.
2. oracle/stale observer state가 예상 방향의 repair/break effect를 만든다.
3. gain 또는 delay sweep에서 bounded operating region과 failure boundary가 나타난다.
```

이 세 결과가 없으면 더 복잡한 MPC·integral·hybrid 해석으로 가지 않는다.

---

## 11. 1차 문헌과 공개 종합 참조

### Feedback, stability, system identification

- Nyquist, H., [Regeneration Theory](https://doi.org/10.1002/j.1538-7305.1932.tb02344.x), *Bell System Technical Journal*, 1932. 선형 feedback loop의 안정성 분석을 frequency-domain loop relation으로 정식화한 고전적 출발점이다.
- Bode, H. W., [Relations Between Attenuation and Phase in Feedback Amplifier Design](https://doi.org/10.1002/j.1538-7305.1940.tb00839.x), *Bell System Technical Journal*, 1940. Gain–phase tradeoff의 고전적 근거다. 본 설계는 LTI 검사를 통과한 경우에만 이 용어를 적용한다.
- Van den Hof, P. M. J. & Schrama, R. J. P., [An Indirect Method for Transfer Function Estimation from Closed Loop Data](https://doi.org/10.1016/0005-1098(93)90015-L), *Automatica*, 1993. Closed-loop data에서 plant transfer를 단순 회귀로 식별할 때 생기는 문제와 간접 식별의 근거다.
- Willems, J. C., Rapisarda, P., Markovsky, I. & De Moor, B., [A Note on Persistency of Excitation](https://doi.org/10.1016/j.sysconle.2004.09.003), *Systems & Control Letters*, 2005. 유한 trajectory가 system behavior를 span하기 위한 excitation 조건의 근거다.

### Observer와 internal model

- Luenberger, D. G., [Observing the State of a Linear System](https://doi.org/10.1109/TME.1964.4323124), *IEEE Transactions on Military Electronics*, 1964. 측정 가능한 input/output으로 내부 state를 재구성하는 observer 개념의 직접 근거다.
- Kalman, R. E., [A New Approach to Linear Filtering and Prediction Problems](https://doi.org/10.1115/1.3662552), *Journal of Basic Engineering*, 1960. 순차 state estimation과 uncertainty update의 고전적 원전이다.
- Francis, B. A. & Wonham, W. M., [The Internal Model Principle of Control Theory](https://doi.org/10.1016/0005-1098(76)90006-6), *Automatica*, 1976. Robust regulation을 위해 reference/disturbance dynamics가 feedback path에 반영되어야 한다는 근거다. 자연어 memory가 곧 internal model이라는 뜻은 아니다.

### MPC, windup, hybrid control

- Mayne, D. Q., Rawlings, J. B., Rao, C. V. & Scokaert, P. O. M., [Constrained Model Predictive Control: Stability and Optimality](https://doi.org/10.1016/S0005-1098(99)00214-9), *Automatica*, 2000. Receding horizon, constraint, terminal condition과 stability 전제의 직접 근거다.
- Åström, K. J. & Rundqwist, L., [Integrator Windup and How to Avoid It](https://doi.org/10.23919/ACC.1989.4790464), *American Control Conference*, 1989. Saturation 중 integrator state가 누적되는 현상과 anti-windup 설계의 고전적 근거다.
- Branicky, M. S., [Multiple Lyapunov Functions and Other Analysis Tools for Switched and Hybrid Systems](https://doi.org/10.1109/9.664150), *IEEE Transactions on Automatic Control*, 1998. Mode별 안정성과 switching 전체의 안정성을 구분해야 한다는 근거다.
- Hespanha, J. P. & Morse, A. S., [Stability of Switched Systems with Average Dwell-Time](https://doi.org/10.1109/CDC.1999.831330), *IEEE Conference on Decision and Control*, 1999. 각 mode와 별개로 switching 속도와 dwell-time가 안정성에 영향을 준다는 근거다.

### Agent causal replay

- Shah, J., [Causal Agent Replay: Counterfactual Attribution for LLM-Agent Failures](https://arxiv.org/abs/2606.08275), arXiv v1, 2026. Agent checkpoint에서 `do` intervention 뒤 stochastic policy를 forward replay해 outcome distribution을 비교하는 직접적인 선행 설계다. 2026-07-28 현재 peer-reviewed publication이 아닌 최신 preprint이므로 독립 검증 대상으로 취급한다.

### 공개 종합 참조

- Åström, K. J. & Murray, R. M., [Feedback Systems: An Introduction for Scientists and Engineers](https://www.cds.caltech.edu/~murray/books/AM08/pdf/am08-complete_20Feb10.pdf), 2008 electronic edition. Feedback, state-space, robustness, frequency response를 같은 notation으로 연결하는 공개 교과서다. 위 1차 논문의 대체 근거가 아니라 구현 시 용어와 계산을 맞추는 참조로 사용한다.

---

## 12. 이 실험으로 말할 수 있는 것과 없는 것

말할 수 있는 것:

- 특정 model+harness/task/budget에서 feedback이 실제 disturbance rejection을 만드는가
- 어떤 외부 state가 observer, dynamic controller memory, predictive plan, supervisor mode로 기능하는가
- gain, delay, noise, plant mismatch에 대한 finite-budget safe region은 어디인가
- planning이 open-loop suffix 실행인지 observation-conditioned receding horizon인지
- cumulative error memory와 saturation이 windup-like failure를 만드는가
- switching guard와 dwell-time가 cycle과 recovery에 인과적으로 관여하는가

이 실험만으로 말할 수 없는 것:

- 특정 transformer head나 MLP가 observer 또는 controller를 구현한다는 주장
- 자연어 memory가 control-theoretic 충분통계라는 보장
- local finite-horizon contraction에서 전역 asymptotic stability로의 일반화
- synthetic numeric plant에서의 margin이 real code/web/research task에 그대로 적용된다는 주장
- LTI 검사를 통과하지 않은 agent의 classical transfer function 또는 phase margin

최종 산출물은 하나의 controller label이 아니라 다음과 같은 **구조별 증거표**여야 한다.

```text
feedback closure: supported/refuted/inconclusive
observer role: supported/refuted/inconclusive
negative-feedback region: [identified bounds]
receding-horizon signature: supported/refuted/inconclusive
integral-like memory: supported/refuted/inconclusive
anti-windup: supported/refuted/inconclusive
hybrid switching: supported/refuted/inconclusive
scope: model + harness + task family + state region + budget
```
