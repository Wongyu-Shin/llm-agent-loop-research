# Agent loop 수렴·비수렴의 원인 분해와 판별 실험

- 작성일: 2026-07-23
- 목적: LLM agent loop가 어떤 과제에서는 수렴하고 다른 과제에서는 수렴하지 않는 이유를 `작업 성격`, `관측 가능성`, `상태 표현`, `verifier/oracle/metric`, `탐색 정책`, `비정상성`, `context loss`, `확률성`으로 분해하고, 실행 로그만으로 관찰 가능한 실패 시그니처와 원인을 가르는 개입 실험을 제시한다.
- 범위: 추론 시점의 agent loop를 다룬다. 모델 가중치 학습의 수렴, 의식·인지에 관한 주장은 범위 밖이다.
- 적용 가정: 특정 agent 구현·benchmark·gold evaluator가 아직 지정되지 않았으므로 platform-agnostic 진단 설계를 제시한다. 실제 causal attribution에는 대상 loop의 state schema와 task별 독립 평가 기준을 먼저 고정해야 한다.
- 핵심 주의: 여기서 “수렴”은 하나의 현상이 아니다. 후보가 더 이상 바뀌지 않는 것, proxy 점수가 평평해지는 것, 올바른 답을 찾는 것, 올바른 답임을 알아보는 것, 외부 상태가 안정되는 것은 서로 다르다.

## 0. 결론

agent loop는 단지 `model -> log -> model`의 반복이 아니다. 다음의 결합된 확률 동역학계다.

```text
숨은 외부 상태
  -> 관측
  -> harness가 보존한 상태
  -> 모델에 렌더링된 context
  -> 모델의 proposal/action
  -> 환경 전이
  -> verifier의 proxy 신호
  -> 상태 갱신·선택·정지
```

따라서 “loop가 수렴하지 않는다”는 관찰만으로 모델 능력 부족을 결론 내릴 수 없다. 적어도 다음 네 가지를 먼저 분리해야 한다.

1. **생성 실패**: 올바른 후보가 후보 풀에 한 번도 등장하지 않는다.
2. **선택 실패**: 올바른 후보가 등장하지만 verifier가 선택하지 못한다.
3. **update 실패**: 유효한 feedback이 있지만 다음 proposal distribution이 실패 영역에서 벗어나지 않는다.
4. **정의 실패**: proxy의 향상과 실제 과제 효용의 향상이 다르거나, 환경·목표가 도중에 바뀌어 정적 수렴점 자체가 없다.

가장 중요한 실무적 구분은 다음과 같다.

> **작업이 어렵다**는 가설은 주로 oracle로 라벨링한 `Pass@K`, 즉 generator가 만든 후보 집합의 정답 포함률이 낮다는 예측을 낸다.  
> **metric이 잘못되었다**는 가설은 `Pass@K`는 높은데 production verifier가 고른 후보의 실제 성공률이 낮거나, proxy 점수는 오르는데 held-out utility가 하락한다는 예측을 낸다.

두 원인은 상호작용한다. verifier가 탐색 방향까지 바꾸는 online loop에서는 나쁜 metric이 이후 후보 분포 자체를 오염시킨다. 따라서 같은 고정 후보 풀에서 verifier만 바꾸는 **offline selection 실험**과, verifier가 다음 후보까지 바꾸는 **online adaptive 실험**을 따로 해야 한다.

## 1. 분석 대상의 최소 형식화

### 1.1 상태와 update를 분리한다

시점 `t`에서 다음을 둔다.

```text
x_t     : 실제 외부 상태
          (repository, filesystem, browser, user intent, dependency, hidden requirement)

h_t     : 지금까지의 원시 event history

m_t     : harness가 영속적으로 보존한 작업 상태
          (plan, constraint ledger, best-so-far, 실패 기록, memory, checkpoint)

c_t     : 모델에 실제로 렌더링된 context
          c_t = Render(g, m_t, selected(h_t))

y_t     : 모델 출력
          y_t ~ q_theta(. | c_t)

a_t     : parser/policy가 y_t에서 만든 외부 action

o_{t+1} : action 뒤에 얻은 observation

v_t     : production verifier/oracle/metric의 신호

u*_t    : 실제 목표에 대한 독립 평가
          (formal oracle, held-out test, human adjudication, 사후 ground truth)
```

전체 loop는 대략 다음과 같다.

```text
y_t       ~ q_theta(. | c_t)
a_t        = ParsePolicy(y_t, m_t)
x_{t+1}   ~ P_t(. | x_t, a_t)
o_{t+1}   ~ Z_t(. | x_{t+1}, a_t)
v_t        = V_t(g, y_t, a_t, o_{t+1}, x_{t+1})
m_{t+1}    = U(m_t, y_t, a_t, o_{t+1}, v_t)
c_{t+1}    = Render(g, m_{t+1}, selected(h_{t+1}))
```

여기서 base model의 parameter `theta`는 보통 loop 동안 고정된다. 달라지는 것은 `c_t`이고, 따라서 모델의 조건부 proposal distribution `q_theta(. | c_t)`가 달라진다. 이 현상을 곧바로 “모델이 학습했다”거나 “가중치가 수렴했다”고 부르면 안 된다.

### 1.2 세 상태를 혼동하지 않는다

| 상태 | 위치 | 전형적 실패 |
| --- | --- | --- |
| world state `x_t` | 외부 환경 | 아직 관측하지 못함, action으로 변함, 다른 actor가 변경 |
| harness state `m_t` | 파일·DB·메모리·checkpoint | 반례 누락, best-so-far 덮어쓰기, stale cache |
| rendered state `c_t` | 현재 model call의 입력 | truncation, 잘못된 요약, 검색 실패, lost-in-the-middle |

`h_t`에 정보가 “존재한다”는 사실은 모델이 그 정보를 사용할 수 있다는 뜻이 아니다. `m_t`에 보존되고, `Render`가 선택하고, context 안에서 접근 가능하며, 모델이 행동에 반영해야 한다.

## 2. 무엇의 수렴인지 먼저 선언한다

### 2.1 서로 다른 수렴 개념

| 수렴 대상 | 조작적 정의 | 거짓 양성 예 |
| --- | --- | --- |
| 성공 도달 | 예산 `B` 안에 성공 집합 `G`를 처음 방문할 확률 `P(tau_G <= B)` | 우연히 flaky test가 한 번 통과 |
| 최종 후보 정확도 | 정지 시 선택한 후보의 `u*` | 정지 규칙이 production score만 봄 |
| best-so-far proxy | `max_{i<=t} v_i`가 더 이상 오르지 않음 | metric plateau 또는 proxy exploitation |
| 후보 안정화 | `d(y_t, y_{t-1}) -> 0` 또는 동일 patch 반복 | 틀린 고정점, cycle의 한 상태 |
| 실제 효용 안정화 | 독립 evaluator의 `u*(best_t)`가 안정 | evaluator 자체가 불완전 |
| version-space 수축 | 모든 보존 반례와 일치하는 후보 집합 `C_t`가 단조 감소 | 반례가 sound하지 않거나 prompt가 이를 강제하지 않음 |
| closed-loop 안정성 | 외부 상태가 목표 집합 주변에 머물고 교란 뒤 복귀 | output 텍스트만 안정되고 실제 환경은 손상 |
| 동적 추적 | 변하는 최적점과의 dynamic regret가 작음 | 정적 “한 점 수렴”을 요구하는 것 자체가 잘못 |

### 2.2 정지, 정체, 수렴은 다르다

```text
terminated  != converged
stabilized  != correct
proxy up    != utility up
one pass    != reliable
```

- budget 소진은 **중단**이지 수렴 증거가 아니다.
- 같은 답 반복은 **정체** 또는 **주기**일 수 있다.
- elitist selection으로 `best proxy`를 보존하면 그 값은 구조상 단조 증가하지만, true utility의 단조성은 따르지 않는다.
- sound하고 complete한 formal verifier의 `ACCEPT`는 강한 종결 증거가 될 수 있다. unit test 통과, LLM judge의 고득점, 자연어 “looks good”은 같은 수준의 증거가 아니다.
- nonzero-temperature sampling이나 의도적 persistent exploration을 유지하면 candidate sequence는 한 점으로 수렴하지 않는 것이 정상일 수 있다. 이때는 candidate 안정화보다 `best-so-far`, 성공 집합의 hitting probability, regret를 측정해야 한다.
- finite-budget trace 몇 개로 asymptotic convergence를 입증할 수 없다. 실증 연구가 직접 추정할 수 있는 것은 주어진 budget과 task distribution 아래의 성공·정체·주기 확률이다.

### 2.3 이 문서의 기본 outcome

실증 연구에서는 다음 세 개를 동시에 보고하는 편이 안전하다.

```text
1. success@B:
   예산 B 안에 실제 성공 후보가 한 번이라도 생성된 비율

2. selected-success@B:
   loop가 최종 선택한 후보가 실제 성공한 비율

3. cost-to-success:
   성공까지의 model tokens, tool calls, wall time, side effects
```

첫째와 둘째의 차이는 generator와 verifier를 가르는 핵심 정보다.

## 3. 이론 프레임워크가 실제로 보장하는 것과 보장하지 않는 것

### 3.1 MDP/POMDP: 관측과 상태 추정의 층

[Kaelbling, Littman, Cassandra (1998)](https://www.sciencedirect.com/science/article/pii/S000437029800023X)는 POMDP에서 history로부터 계산한 belief state를 의사결정의 충분통계로 사용한다. 이 틀은 agent loop의 바깥 상호작용을 설명하기 좋다.

```text
숨은 상태 x_t
  -> observation o_t
  -> belief 또는 history-dependent internal state
  -> action a_t
```

하지만 일반 LLM agent의 text context가 정확한 Bayesian belief state라는 뜻은 아니다. 다음 조건이 깨질 수 있다.

- observation model을 모른다.
- 로그가 state를 식별하기에 부족하다.
- 중요한 history가 context에서 누락된다.
- 자연어 요약이 충분통계가 아니다.
- 같은 `c_t`가 서로 다른 hidden state를 alias한다.

[Chrisman (AAAI 1992)](https://aaai.org/Papers/AAAI/1992/AAAI92-029.pdf)은 즉시 관측이 같은데 서로 다른 action이 필요한 perceptual aliasing이 reinforcement learning을 저해하는 현상을 구체적으로 다뤘다. agent loop에서 같은 현상은 “같아 보이는 error message지만 원인은 서로 다른 상태”로 나타난다.

[POMCP](https://proceedings.neurips.cc/paper/2010/hash/edfbe1afcf9246bb0d40eb4d8027d90f-Abstract.html)의 수렴 정리는 좋은 비교 기준이다. Silver와 Veness는 finite-horizon POMDP에서 적절한 exploration constant와 방문 횟수 증가 아래 PO-UCT value가 optimal value에 확률수렴함을 보였다. 이 정리는 다음을 **가정**한다.

- POMDP를 sampling할 수 있는 올바른 black-box simulator
- tree의 relevant history-action 방문이 계속 증가
- UCT식 명시적 exploration
- 정의된 reward와 finite horizon

선형적인 `생성 -> 실행 -> 로그 -> 재생성` loop에는 tree, simulator rollout, value backup, 무한 방문이 보통 없다. 따라서 “POMDP처럼 보인다”는 것과 “POMCP의 수렴 보장을 갖는다”는 것은 다르다.

[Watkins & Dayan (1992)](https://www.gatsby.ucl.ac.uk/~dayan/papers/wd92.html)의 tabular Q-learning 수렴도 모든 state-action pair가 반복적으로 sampling된다는 조건을 둔다. 이는 agent engineering에서 다음의 직접적인 경고를 준다.

> 초기에 score가 좋았던 한 전략만 계속 수정하는 loop는 탐색을 중단하므로, RL의 고전적 수렴 조건조차 만족하지 않는다.

### 3.2 OGIS/CEGIS: 후보·반례·기억의 층

[Jha & Seshia (2017)](https://people.eecs.berkeley.edu/~sseshia/pubs/b2hd-jha-acta17.html)는 learner가 oracle에 반복 질의하는 OGIS를 정식화하고 CEGIS를 그 중요한 instance로 분석했다.

CEGIS의 이상형은 다음과 같다.

```text
p_t = Learn(E_t)

Verify(p_t, Phi) =
  ACCEPT
  또는 sound counterexample c_t

E_{t+1} = E_t union {c_t}
C_{t+1} = {p in C_t | p가 c_t에서 Phi를 만족}
```

다음 네 조건이 동시에 성립할 때에만 “반례가 올 때마다 진전한다”는 해석이 안전하다.

1. 반례가 실제 specification 위반을 증명한다.
2. 반례가 이후에도 보존된다.
3. learner가 다음 후보에서 모든 누적 반례를 강제로 만족한다.
4. verifier의 `ACCEPT` 의미가 목표와 일치한다.

자연어 prompt에 과거 오류를 붙이는 것은 3번을 보장하지 않는다. 모델은 반례를 무시하거나, 하나를 고치며 이전 반례를 재도입할 수 있다.

Jha와 Seshia의 결과에서 특히 중요한 경계는 다음이다.

- finite candidate class에서는 적절한 OGIS 절차의 termination을 구성할 수 있지만, 필요한 counterexample 수와 계산 복잡도는 여전히 클 수 있다.
- infinite concept class에서는 일반 CEGIS의 termination이 자동으로 보장되지 않는다.
- 논문의 `identification in the limit`는 일정 시점 뒤 올바른 concept를 계속 출력한다는 뜻이며, learner가 “수렴했음을 알아차리고 정지한다”는 뜻과 다르다.
- bounded memory와 unbounded memory는 learnable class와 counterexample oracle의 상대적 힘을 바꿀 수 있다.

따라서 context compaction으로 과거 반례가 사라지는 현상은 단순 구현 문제가 아니다. oracle-guided learning의 수렴 가정 중 **evidence memory**를 직접 깨뜨린다.

LLM과 formal feedback을 실제로 결합한 예도 있다.

- [Bhatia et al., *Verified Code Transpilation with LLMs*, NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/hash/48bb60a0c0aebb4142bf314bd1a5c6a0-Abstract-Conference.html)는 LLM proposal과 equivalence proof/verification을 결합한다.
- [Orvalho et al., AAAI 2025](https://ojs.aaai.org/index.php/AAAI/article/view/32046)는 LLM patch를 test suite로 검사하고 실패 counterexample을 다음 synthesis에 다시 넣는 명시적 CEGIS loop를 1,431개 학생 프로그램에 평가했다.

이 사례들은 강한 verifier가 있을 때의 가능성을 보여 주지만, test suite 밖의 실제 명세까지 보장하지는 않는다.

### 3.3 Control: feedback의 존재와 안정성은 다르다

폐루프라는 사실만으로 안정성이 생기지 않는다. control에서는 plant dynamics, controller, delay, gain, disturbance, constraints를 함께 놓고 Lyapunov 감소나 invariant set 같은 조건을 증명한다.

[Mayne et al. (2000)](https://www.sciencedirect.com/science/article/pii/S0005109899002149)의 constrained MPC 정리는 finite-horizon 문제를 매 step 다시 푼다는 형식만으로 안정성을 주장하지 않는다. terminal cost/set, feasibility, model과 실제 plant의 관계 등 구체적 조건이 필요하다.

agent loop에 대응시키면 다음과 같다.

| control 개념 | agent loop 대응 | 실패 |
| --- | --- | --- |
| plant state | repo·browser·사용자·외부 서비스 | 모델이 일부만 관측 |
| controller | model + harness policy | delay·잘못된 gain·비선형 update |
| reference | acceptance criteria | 모호하거나 도중 변경 |
| sensor | tool/log/verifier | noisy·biased·incomplete |
| actuator | tool action·patch | 비가역 side effect |
| Lyapunov candidate | 감소해야 할 오류·위반량 | 실제로 단조 감소하는지 미확인 |

실무적으로는 매 iteration마다 `v_t`가 좋아지는지만 볼 것이 아니라, **누적 constraint violation**, **regression 수**, **외부 상태의 boundedness**, **rollback 가능성**을 별도 측정해야 한다.

### 3.4 Optimization: scalar metric은 정적 목적함수일 때만 단순하다

scalar score를 높이는 loop는 black-box optimization과 닮았지만, 다음 조건이 필요하다.

- 같은 후보는 같은 objective 의미를 갖는다.
- score noise를 추정할 수 있다.
- 탐색 정책이 유망 영역과 미탐색 영역을 균형 있게 방문한다.
- score가 실제 utility와 정렬된다.
- 목적함수가 loop 도중 변하지 않는다.

[Robbins & Monro (1951)](https://projecteuclid.org/journals/annals-of-mathematical-statistics/volume-22/issue-3/A-Stochastic-Approximation-Method/10.1214/aoms/1177729586.full)는 noisy observation으로 root를 찾는 확률근사법을 제시했지만, 수렴에는 noise·step-size·함수 형태에 대한 조건이 있다. LLM에게 매번 “조금 더 고쳐라”라고 하는 update에는 감소 step size, unbiased gradient, convexity가 없다.

[Wolpert & Macready (1997)](https://doi.org/10.1109/4235.585893)의 no-free-lunch 결과는 모든 가능한 objective를 평균하면 어떤 optimizer도 보편적으로 우월하지 않음을 보인다. agent loop에 필요한 것은 반복 그 자체가 아니라, **작업군의 구조에 맞는 prior·proposal·verifier·search policy**다.

### 3.5 Non-stationarity: 한 점으로의 수렴 대신 추적 문제

다음이 도중에 바뀌면 `P_t`, `Z_t`, `V_t`, `u*_t`가 시간에 의존한다.

- repository나 dependency가 다른 actor에 의해 변경
- 웹·API 응답·권한·rate limit 변화
- user requirement 변경
- tool/model version 변경
- visible test·LLM judge prompt·metric version 변경
- agent 자신의 action이 다음 평가 분포를 변화

이때 어제의 optimum과 오늘의 optimum이 다를 수 있으므로 정적 수렴은 잘못된 목표다. [Abbasi-Yadkori, György, Lazić (JMLR 2023)](https://jmlr.org/papers/v24/22-0387.html)은 non-stationary bandit에서 시점별 최적 action과의 **dynamic regret**를 사용한다. [Zhao et al. (JMLR 2023)](https://jmlr.org/beta/papers/v24/22-0218.html)은 memory와 switching cost까지 포함한 dynamic policy regret를 다룬다.

agent 실험에서는 최소한 고정 snapshot에서의 수렴과 live environment에서의 tracking을 분리해야 한다.

### 3.6 Process reward와 verifier: 더 조밀한 신호는 유용하지만 oracle은 아니다

[Lightman et al., *Let's Verify Step by Step*, ICLR 2024](https://iclr.cc/virtual/2024/poster/17549)는 연구한 MATH 설정에서 process supervision이 outcome supervision보다 나았고 PRM800K를 공개했다. 이것은 조밀한 step-level feedback이 credit assignment와 selection에 도움을 줄 수 있다는 강한 실증 근거다. 모든 domain의 PRM이 sound하다는 근거는 아니다.

세 가지 후속 결과가 그 경계를 보여 준다.

1. [Gao, Schulman, Hilton, ICML 2023](https://proceedings.mlr.press/v202/gao23h.html)은 proxy reward model을 더 강하게 최적화할수록 synthetic gold reward가 결국 악화될 수 있는 reward-model overoptimization을 정량화했다.
2. [ProcessBench, ACL 2025](https://aclanthology.org/2025.acl-long.50/)에서는 기존 PRM들이 GSM8K·MATH보다 어려운 수학 문제의 오류 위치 식별로 일반화하지 못하는 경우가 관찰됐다.
3. [Weaver, NeurIPS 2025](https://openreview.net/forum?id=dRjt4vlYVQ)는 `Pass@K - selected success`를 generation-verification gap으로 명시한다. 올바른 답이 후보 안에 있어도 imperfect verifier가 못 고를 수 있다.

또한 외부 근거가 없는 self-correction과 grounded feedback을 구분해야 한다.

- [Huang et al., ICLR 2024](https://openreview.net/forum?id=IkmD3fKBPQ)는 연구한 reasoning 설정에서 외부 feedback 없는 intrinsic self-correction이 개선되지 않거나 악화되는 경우를 보였다. 논문의 범위를 모든 task로 일반화하면 안 된다.
- [CRITIC, ICLR 2024](https://proceedings.iclr.cc/paper_files/paper/2024/hash/fef126561bbf9d4467dbb8d27334b8fe-Abstract-Conference.html)는 검색·코드 interpreter 같은 외부 tool feedback을 사용한 correction이 연구한 여러 과제에서 개선을 보였다.
- 최신 [ReflecTool-Bench, Findings of ACL 2026](https://aclanthology.org/2026.findings-acl.86/)는 12개 모델 평가에서 third-party critique보다 자신의 tool-use 오류를 탐지·수정하는 self-reflection이 더 어려우며, 특히 assistant-originated error에서 약하다고 보고한다.

같은 모델이 generator와 verifier를 겸하면 오류가 상관될 수 있다. 독립 verifier 또는 다른 정보원은 단순 ensemble 수보다 중요한 개입 변수다.

## 4. 여덟 가지 비수렴 축: 메커니즘, 시그니처, 판별 실험

아래 축은 상호 배타적이지 않다. 한 failure episode에 여러 원인이 동시에 있을 수 있다. 표의 “판별 실험”은 다른 축을 가능한 한 고정한 개입이다.

| 축 | 깨진 조건 | 실행 로그에서 보이는 시그니처 | 가장 강한 판별 실험 |
| --- | --- | --- | --- |
| 작업 성격 | 해가 너무 희박·불가능, horizon/branching가 예산 초과, feedback가 너무 늦음 | oracle로 봐도 후보 풀에 정답 없음, horizon에 따라 success 급락, 마지막에만 오류 드러남 | 고정 budget의 oracle-labeled `Pass@K`, horizon·branching·feedback latency sweep |
| 관측 가능성 | 서로 다른 hidden state가 같은 observation/context로 alias | 같은 `c_t,a_t`인데 outcome이 체계적으로 갈림, 필요한 정보 획득 action을 하지 않음 | hidden state reveal, sensor 추가, observation mask/shuffle, 정보 수집 action 강제 |
| 상태 표현 | 정보는 있으나 잘못 요약·구조화·렌더링 | 로그에는 근거가 있지만 행동이 반영하지 않음, 위치·순서 변경에 결과 민감, 상충 state | lossless canonical state, schema/pinned ledger, context 위치 permutation |
| verifier/oracle/metric | false accept/reject, 목표 불일치, credit 부족, optimizer에 exploitable | proxy 상승 + held-out utility 하락, visible pass + hidden fail, judge 반복 판정 불안정 | 같은 후보 풀에 gold oracle/production verifier 교체, adaptive optimization pressure test |
| 탐색 정책 | support 부족, premature exploitation, 후보 상관, rollback 없음 | 거의 동일한 후보 반복, 같은 반례 재발, `Pass@K` 조기 plateau, seed에 따라 성패 양극화 | restart·temperature·diverse proposer·tree branching·forced alternative ablation |
| non-stationarity | 상태·tool·목표·metric 분포가 시간에 따라 변경 | 같은 후보의 결과가 시간순으로 drift, 이전 fix가 외부 변경 뒤 재실패, changepoint | frozen snapshot replay vs live replay, version pin, timestamped A/A rerun |
| context loss | 과거 반례·제약·결정이 eviction/compaction/retrieval에서 사라짐 | compaction 직후 이전 실패 반복, evidence age가 클수록 위반률 증가, recall probe 절벽 | no-compaction/full-history, oracle retrieval, constraint ledger pinning, evidence-distance sweep |
| stochasticity | generator·tool·verifier·환경 noise를 단일 관측으로 판단 | 동일 snapshot·candidate의 pass/fail 뒤집힘, score rank reversal, lucky stop | nested replication으로 model/tool/verifier variance 분해, fixed seed, repeated evaluation |

### 4.1 작업 성격

“작업 성격”을 한 단어인 난이도로 두지 말고 최소 다음 축으로 기록한다.

| 작업 속성 | loop 수렴에 미치는 영향 | 측정 방법 |
| --- | --- | --- |
| feasible-solution prior mass | generator가 유효 해를 낼 확률 | oracle-labeled `Pass@K` curve |
| horizon | 중간 commitment·오류·state burden 증가 | 필요한 인간 step 또는 최소 tool-call 수별 success |
| branching factor | 탐색해야 할 대안 수 증가 | state별 legal/meaningful action 수 |
| decomposability | 부분 목표를 독립 검증할 수 있는지 | subgoal별 oracle와 합성 성공률 |
| feedback density/latency | credit assignment의 해상도 | 오류 발생 시점과 최초 탐지 시점 거리 |
| verifiability | cheap·sound oracle 존재 여부 | false accept/reject와 평가 비용 |
| reversibility | 잘못된 action을 되돌릴 수 있는지 | rollback 가능률·side-effect 비용 |
| constraint coupling | 하나를 고치며 다른 제약이 깨지는 정도 | fix-induced regression matrix |
| objective topology | plateau·local optimum·deception | local edit 이웃에서 proxy/utility 변화 |

#### 관찰 가능한 실패 시그니처

- `Pass@K`가 `K` 증가에도 낮다: generator support 또는 search budget 문제.
- short-horizon stratum은 성공하고 long-horizon에서만 급락한다: state retention, delayed feedback, compounding interaction을 의심한다.
- 각 subtask는 통과하지만 integration에서만 실패한다: constraint coupling 또는 state composition 문제다.
- 모든 candidate가 동일한 final verifier에서만 실패한다: sparse/delayed feedback 가능성이 높다.
- formal solver나 exhaustive search로 feasible set이 비어 있음이 확인된다: loop 문제가 아니라 specification infeasibility다.

#### 판별 실험

1. production verifier를 사용하지 않고 `K`개 후보를 생성한다.
2. 독립 gold evaluator로 전부 라벨링한다.
3. `Pass@K`를 그린다.
4. 같은 task를 horizon, branching, feedback latency, solution density로 층화한다.
5. gold process feedback을 중간 step에 주는 조건과 final-only 조건을 비교한다.

gold feedback에서도 `Pass@K`가 낮으면 metric보다 proposal/task fit 문제다. gold process feedback에서만 상승하면 task가 본질적으로 불가능한 것이 아니라 credit assignment가 병목이다.

METR의 최신 공개 측정은 human expert task duration이 agent success와 강하게 연관된다는 실증적 정황을 제공한다. 다만 [METR time-horizon 자료는 2026-05-08 갱신](https://metr.org/time-horizons/)된 연구기관 기술 자료이며, task duration이 단일 인과 원인이라는 peer-reviewed 증거로 취급하면 안 된다.

### 4.2 관측 가능성

부분관측 실패의 핵심 조건은 다음이다.

```text
서로 다른 hidden state x와 x'가 같은 rendered state c를 만들지만,
좋은 action은 서로 다르다.
```

이때 memory가 아무리 커도 필요한 sensor나 query가 없으면 해결되지 않는다.

#### 시그니처

- prompt/context hash가 같은데 환경 snapshot별 최적 action이 다르다.
- error message는 같지만 root cause별 수정 방향이 정반대다.
- agent가 실행 전에 확신하지만, 실제 성공은 관측하지 않은 변수에 강하게 조건화된다.
- 정보 수집 action을 허용하면 성공하고 바로 수정하게 하면 실패한다.
- observation을 shuffle해도 성능이 거의 변하지 않는다. 이는 loop가 feedback을 실제로 사용하지 않는다는 신호다.

#### 판별 실험: paired-state alias test

1. hidden state만 다른 두 environment snapshot `x`, `x'`를 만든다.
2. production `Render` 결과가 같거나 거의 같음을 확인한다.
3. 두 상태에서 올바른 action이 다르도록 task를 고른다.
4. hidden discriminating variable을 가린 조건과 공개한 조건을 비교한다.
5. 공개했을 때 성공률이 크게 오르면 모델 일반 능력보다 observation channel이 병목이다.

#### 판별 실험: information intervention

```text
real observation
vs masked observation
vs shuffled observation
vs oracle-complete observation
```

같은 token/tool budget으로 비교한다. `real > shuffled`이면 feedback에 정보 가치가 있다. `oracle-complete >> real`이면 sensor/observation coverage가 병목이다. `real ≈ shuffled`이면 update가 observation을 사용하지 않거나, observation 자체가 무정보다.

### 4.3 상태 표현

관측 가능성은 정보가 **들어오는가**의 문제이고, 상태 표현은 들어온 정보를 다음 decision에 쓸 수 있는 형태로 **보존·요약·주소화하는가**의 문제다.

#### 시그니처

- raw log에는 정답 단서가 있는데 final context에는 없다.
- 같은 facts를 표·JSON·constraint list로 바꾸면 행동이 달라진다.
- 중요한 evidence를 context 앞·끝으로 옮기면 성능이 오르고 가운데 두면 떨어진다.
- 동일 entity의 stale/new 값이 함께 존재하고 최신성 규칙이 없다.
- “이미 확인한 사실”과 “가설”이 동일한 자연어 bullet로 섞인다.
- best-so-far와 current candidate가 구분되지 않아 좋은 후보를 덮어쓴다.

[Lost in the Middle, TACL 2024](https://aclanthology.org/2024.tacl-1.9/)는 관련 정보의 context 내 위치만 바꿔도 long-context QA와 key-value retrieval 성능이 크게 달라지는 현상을 보였다. [Minerva, ICML 2025](https://proceedings.mlr.press/v267/xia25c.html)는 memory 사용을 search, recall, edit, match, compare, state maintenance 같은 원자 능력으로 나누어 테스트한다. 이 결과들은 “context 안에 있다”와 “decision에 사용 가능하다”를 분리해야 함을 지지한다.

#### 판별 실험

- **lossless-state arm**: 원시 event를 canonical structured state로 변환하되 요약 손실 없이 제공한다.
- **pinned-ledger arm**: goal, accepted constraints, counterexamples, best-so-far, open hypotheses를 분리해 항상 context의 고정 위치에 둔다.
- **position permutation**: 동일 evidence의 위치만 앞/중간/끝으로 바꾼다.
- **schema ablation**: free-form log, typed JSON, compact table을 비교한다.
- **state probe**: 매 iteration 행동과 독립적으로 “현재 목표, 이미 반증된 가설, best candidate, 미해결 제약”을 구조화해 출력하게 하고 ground truth와 비교한다.

probe는 모델에게 추가 힌트를 주어 실제 policy를 바꿀 수 있으므로, main run과 별도의 shadow call로 수행하는 편이 낫다.

### 4.4 verifier/oracle/metric

metric 결함은 최소 여섯 종류로 분리한다.

| 결함 | 뜻 | 전형적 시그니처 | 측정 |
| --- | --- | --- | --- |
| construct misalignment | 측정 대상이 실제 목표와 다름 | proxy 상승, held-out utility 하락 | proxy-utility curve |
| coverage/incompleteness | 중요 요구를 보지 않음 | visible pass, hidden fail | held-out requirement별 recall |
| unsound false accept | 틀린 후보를 승인 | accepted candidate의 사후 실패 | false-accept rate |
| over-rejection | 맞는 후보를 거절 | `Pass@K` 높고 selected success 낮음 | false-reject/selection regret |
| noise/miscalibration | 같은 후보의 판정이 흔들림 | rank reversal, stop instability | repeated score distribution, ECE/Brier |
| poor credit assignment | pass/fail은 맞지만 어디를 고칠지 모름 | 매 retry가 무관한 수정 | process localization accuracy |
| exploitability/endogeneity | optimizer가 blind spot을 학습 | 반복할수록 proxy-gold gap 증가 | optimization pressure sweep |
| delay | 원인 step보다 늦게 신호 | 넓은 수정, 책임 step 오판 | detection latency |

#### 가장 중요한 고정 후보 풀 실험

후보 집합 `Y={y_1,...,y_K}`를 한 번 생성한 뒤 다음을 계산한다.

```text
Coverage_K
  = 1[후보 중 u*(y)=1인 것이 하나라도 있음]

SelectedSuccess_K(V)
  = u*(argmax_y V(y))

GenerationVerificationGap_K
  = Coverage_K - SelectedSuccess_K(V)
```

- `Coverage_K`가 낮다: generator/search/task 문제.
- `Coverage_K`는 높은데 gap이 크다: verifier/selector 문제.
- production verifier를 oracle로 바꾸면 gap이 사라진다: 강한 verifier 병목 증거.
- offline gap은 작지만 online loop가 나쁘다: verifier가 adaptive search를 잘못 이끄는 문제가 의심된다.

#### optimization pressure test

동일 proxy에 대해 탐색 budget `K` 또는 iteration을 늘리며 다음을 함께 그린다.

```text
proxy(best_t)
heldout_utility(best_t)
false_accept_rate(best_t)
```

처음에는 함께 오르다가 proxy만 계속 오르고 held-out utility가 꺾이면 Goodhart/reward hacking 시그니처다. verifier를 고정 후보 분포에서만 평가하면 이 실패를 놓친다. **optimizer가 만든 on-policy candidate distribution**에서도 calibration해야 한다.

#### process verifier를 평가할 때

최종 answer selection accuracy만 보고 PRM 품질을 결론 내리지 않는다.

- earliest-error localization
- step-level false accept/false reject
- 완전히 맞는 trace에 대한 과잉 rejection
- correct answer이지만 flawed process인 trace 처리
- domain/horizon shift generalization
- search에 넣었을 때의 downstream utility

를 분리한다.

### 4.5 탐색 정책

generator가 한 번이라도 정답을 낼 가능성이 있어도 search가 그 support를 방문하지 않으면 finite budget에서 실패한다.

#### 시그니처

- candidate 간 edit/semantic distance가 매우 작다.
- seed를 바꾸지 않은 sequential refinement가 같은 patch를 왕복한다.
- 같은 counterexample ID가 반복된다.
- 초반 한 branch의 점수가 우연히 높으면 이후 모든 compute가 그 branch에 몰린다.
- `Pass@K`가 이상적인 독립 표본의 `1-(1-p)^K`보다 훨씬 빨리 plateau한다.
- high-temperature/restart에서는 성공 후보가 나오지만 production low-temperature에서는 나오지 않는다.
- oracle selector를 써도 `Pass@K`가 낮다.

#### 측정

```text
unique_candidate_ratio
semantic/edit diversity
branch coverage
counterexample recurrence rate
novel counterexample rate
Pass@K curve
seed-to-seed variance
time since last best-so-far improvement
```

표본의 성공 indicator가 exchangeable하고 pairwise correlation을 `rho`로 근사할 수 있다면, 후보 수 `K`의 정보량은 거칠게

```text
ESS ≈ K / (1 + (K - 1)rho)
```

처럼 줄어든다. 이는 진단용 근사이지 일반 정리가 아니다.

#### 판별 실험

- same model sequential refinement
- independent restart
- temperature/top-p sweep
- 서로 다른 proposer ensemble
- explicit tree branching + rollback
- novelty constraint
- oracle-guided branch allocation
- production verifier-guided branch allocation

을 같은 compute budget에서 비교한다.

[Snell et al., ICLR 2025](https://iclr.cc/virtual/2025/poster/31024)는 PRM search와 adaptive revision의 효율이 문제 난이도에 따라 달라지고, difficulty-adaptive allocation이 고정 best-of-N보다 연구한 수학 설정에서 4배 이상 효율적일 수 있음을 보였다. 이는 탐색 정책을 task difficulty와 분리해 고정할 수 없다는 근거다.

### 4.6 Non-stationarity

non-stationarity와 stochastic noise는 로그에서 비슷하게 보이지만 다르다.

- noise: 같은 분포에서 무작위 변동
- drift: 분포 자체가 시간에 따라 변함
- changepoint: 특정 시점에 regime이 바뀜

#### 시그니처

- 같은 candidate를 시간순으로 재평가할수록 평균 score가 이동한다.
- 실패가 특정 deployment/tool/model version 이후 급증한다.
- reset된 snapshot에서는 재현되지 않고 live state에서만 재현된다.
- 최근 observation에 맞춘 수정이 과거 snapshot에서는 regression이다.
- loop가 optimum을 따라가지만 안정된 한 후보로 고정되지 않는다.

#### 판별 실험

1. exact environment snapshot, dependency, tool version, model version을 pin한다.
2. candidate와 action sequence를 event-sourced replay한다.
3. frozen run과 live run을 같은 seed로 비교한다.
4. 동일 candidate의 평가를 시간 순서와 무작위 순서로 반복한다.
5. score residual에 changepoint test를 적용한다.
6. 목표가 바뀐 경우 static success 대신 dynamic regret와 switching cost를 보고한다.

같은 snapshot에서 반복 variance가 크면 stochasticity 쪽이고, snapshot/time regime별 평균이 이동하면 non-stationarity 쪽이다.

### 4.7 Context loss

context loss는 상태 표현의 시간적 특수형이지만, agent loop에서는 독립 축으로 계측할 가치가 있다.

#### 손실 위치

```text
raw event 생성
  -> persistent memory write
  -> summary/compaction
  -> retrieval/index
  -> context selection
  -> prompt position
  -> model uptake
```

각 단계에서 다른 실패가 난다.

#### 시그니처

- 정확히 compaction 직후 예전에 해결한 오류가 재발한다.
- counterexample의 age 또는 context distance가 커질수록 재위반 hazard가 오른다.
- memory store에는 있으나 retrieval 결과에 없다.
- retrieval 결과에는 있으나 context 중간에 묻혀 행동에 반영되지 않는다.
- 요약 후 “왜 이 결정을 했는지”가 사라지고 결론만 남아 조건이 바뀌어도 stale 결론을 유지한다.
- 같은 failure가 일정 주기로 반복된다.

[LongMemEval, ICLR 2025](https://openreview.net/forum?id=pZiyCaVuti)는 sustained interaction에서 commercial assistant와 long-context model의 memory 정확도가 약 30% 하락하는 결과를 보고하고, extraction·multi-session reasoning·temporal reasoning·knowledge update·abstention을 분리한다. 이 수치는 chat-memory benchmark의 결과이며 일반 code agent의 정확한 감소율로 이전하면 안 된다.

#### 판별 실험

```text
production compaction
vs no compaction/full history
vs oracle summary
vs oracle retrieval
vs pinned immutable constraint ledger
```

그리고 반례 생성 뒤 `d` iteration 후 같은 위반을 유도하는 probe를 넣어 `retention(d)`를 그린다.

CEGIS-like loop에서는 다음을 직접 측정한다.

```text
RetainedConstraintRate_t
  = 과거 sound counterexample 중 y_t가 여전히 만족하는 비율

RepeatCEXRate_t
  = 이전에 이미 본 counterexample이 다시 나오는 비율
```

`RetainedConstraintRate`가 compaction 뒤 급락하면 generator 일반 능력보다 memory/update channel의 결함이 강하게 지지된다.

### 4.8 확률성

확률성은 비수렴의 동의어가 아니다. exploration을 가능하게 하는 장점도 있다. 문제는 어떤 noise source가 얼마나 크고, 정지 규칙이 이를 감안하는가다.

#### noise source

- model sampling
- serving nondeterminism
- parser/tool routing randomness
- test flakiness
- network/API variability
- LLM judge variability
- environment randomness
- human evaluator disagreement

#### 시그니처

- exact same candidate가 pass/fail을 반복한다.
- verifier가 후보 순위를 자주 뒤집는다.
- 한 번의 lucky high score 뒤 loop가 조기 종료한다.
- seed별 결과 분포가 bimodal이다.
- 평균은 개선되지만 variance가 커져 reliability threshold를 못 넘는다.

#### nested variance decomposition

다음 순서로 반복한다.

```text
task instance
  × generator seed
    × fixed candidate
      × tool/environment replay
        × verifier repeat
```

mixed-effects model 또는 계층 bootstrap으로 variance를 분해한다.

- candidate를 고정해도 흔들리면 tool/verifier/environment noise다.
- candidate 사이 변동이 주이고 같은 candidate는 안정적이면 generator/search variance다.
- verifier score는 흔들리지만 gold outcome은 안정적이면 verifier noise다.
- 모든 것을 고정했는데 serving output이 다르면 model-serving nondeterminism이다.

정지 규칙은 single pass보다 다음 중 하나를 사용한다.

- sound deterministic verifier
- repeated evaluation의 confidence interval
- sequential probability ratio 또는 신뢰 하한
- flaky test quarantine
- success와 별개인 budget-exhausted/inconclusive 상태

## 5. 로그에서 바로 계산할 진단 지표

### 5.1 generation과 selection

```text
Pass@K
  = P(후보 K개 중 gold-success가 하나 이상)

SelectedSuccess@K
  = P(production selector가 고른 후보가 gold-success)

GenerationVerificationGap@K
  = Pass@K - SelectedSuccess@K

SelectionRegret
  = max_i u*(y_i) - u*(argmax_i v(y_i))
```

### 5.2 feedback의 실제 이용

```text
FeedbackValue
  = E[u* | real feedback] - E[u* | shuffled/masked feedback]

CounterexampleAvoidance
  = P(다음 후보가 직전 counterexample을 해결)

AllConstraintRetention
  = P(다음 후보가 누적 counterexample 전부를 만족)

NovelCEXRate
  = 새 counterexample 수 / 전체 failure 수
```

`직전 반례 해결률`만 높고 `누적 반례 유지율`이 낮으면 local repair는 되지만 state retention/constraint coupling이 실패한 것이다.

### 5.3 진전과 주기

```text
best-so-far improvement interval
candidate hash recurrence
environment state hash recurrence
2-cycle / k-cycle frequency
regression rate
rollback rate
side-effect count
```

동일 candidate hash만으로 cycle을 찾으면 표현만 바꾼 의미적 반복을 놓친다. AST diff, test-failure signature, semantic embedding을 함께 사용한다.

### 5.4 verifier 건전성

```text
false accept / false reject
calibration error
pairwise ranking accuracy
earliest-error localization accuracy
score repeatability
proxy-gold correlation
proxy-gold curve under increasing optimization pressure
```

random IID validation set과 adaptive on-policy candidate set을 분리해 보고한다.

### 5.5 state와 context

```text
goal recall
accepted-constraint recall
counterexample recall by age
best-so-far identity accuracy
stale-state rate
retrieval recall
context position sensitivity
compaction-boundary failure hazard
```

## 6. 원인을 가르는 최소 진단 프로토콜

### Step 1. 성공의 gold definition을 production metric과 분리한다

명세의 타당성과 적용 범위가 독립적으로 확인됐다는 전제 아래, 보통 다음 순서로 더 강한 판정 증거를 얻을 수 있다.

```text
formal specification / proof checker
> held-out deterministic tests
> blinded human adjudication with rubric
> independent high-quality evaluator
> production LLM judge
```

이 순서는 보편적 서열이 아니다. 잘못 쓴 formal specification은 올바른 human judgment보다 약하고, 인간 평가도 rubric·전문성·상호 합의에 따라 달라진다. 완전한 gold가 없으면 여러 evaluator의 불일치를 그대로 불확실성으로 남긴다. production verifier를 gold로 재사용하면 metric 결함을 발견할 수 없다.

### Step 2. 모든 run을 replay 가능하게 기록한다

최소 event schema:

```text
run_id, task_id, iteration, timestamp
model/provider/version, decoding config, seed
environment snapshot/version/dependency
raw goal and acceptance criteria
rendered context hash, token count, evidence positions
harness state before/after and diff
candidate/output/action hash
raw observation and parsed observation
verifier type/version/raw output/score
gold outcome (offline 가능)
counterexample ID and lineage
best-so-far ID
stop reason
cost, latency, side effects
```

### Step 3. fixed candidate pool로 generator와 verifier를 분리한다

각 task에서 production search와 무관하게 `K`개 candidate를 만들고 전부 gold-label한다.

```text
Pass@K 낮음
  -> generator support, task fit, search budget를 먼저 조사

Pass@K 높음 + selected success 낮음
  -> verifier/selector를 먼저 조사
```

이 단계가 “작업 성격인가 metric 결함인가”를 가장 직접적으로 가른다.

### Step 4. feedback 정보 가치를 randomization으로 검증한다

```text
real
masked
shuffled across tasks
counterfactual/wrong
oracle-complete
```

를 같은 compute로 비교한다.

- real과 shuffled가 같으면 feedback가 무정보이거나 update가 무시한다.
- oracle만 좋아지면 observation/verifier quality가 병목이다.
- wrong feedback에 강하게 끌리면 update gain이 너무 크거나 verifier 의존성이 높다.

### Step 5. full-state와 production-state를 비교한다

hidden state reveal, lossless canonical state, pinned constraint ledger를 차례로 추가한다.

```text
hidden reveal 효과
  -> observability bottleneck

lossless representation 효과
  -> state representation bottleneck

pinned history 효과
  -> context loss / retention bottleneck
```

### Step 6. oracle verifier를 online loop에 넣는다

fixed pool에서의 oracle selection과 별개로, oracle feedback이 다음 proposal까지 바꾸게 한다.

- offline oracle만 효과: selection 병목
- online oracle에서 추가 효과: search guidance/credit assignment 병목
- oracle도 효과 없음: generator support, task infeasibility, state/observation 문제

### Step 7. exploration을 조작한다

restart, diversity, tree branching, temperature, proposer ensemble을 compute-matched로 비교한다. oracle-labeled `Pass@K`가 늘면 search policy 문제다. 후보 다양성만 늘고 `Pass@K`가 늘지 않으면 task-relevant prior가 부족한 것이다.

### Step 8. snapshot replay로 drift와 noise를 분리한다

frozen deterministic snapshot에서 candidate를 반복 평가하고, 그 뒤 live environment에서 시간순으로 반복한다.

- frozen 내 variance: stochasticity
- frozen 간 평균 차이: snapshot/state 차이
- live time drift: non-stationarity

### Step 9. optimization pressure test를 한다

iteration/budget을 늘려 proxy와 held-out utility를 동시에 그린다. proxy만 좋아지는 turning point가 있으면 더 긴 loop가 오히려 metric exploit을 키운다.

## 7. 실패 시그니처에서 원인으로 가는 판별표

| 관찰 | 1차 가설 | 혼동 가능한 원인 | 다음 실험 |
| --- | --- | --- | --- |
| score가 일정하고 후보도 동일 | local optimum/low exploration | context가 update되지 않음 | context diff 확인 후 restart/diversity |
| score는 오르나 hidden success 하락 | proxy misalignment/exploitation | hidden evaluator noise | repeated gold eval + pressure sweep |
| 올바른 후보가 생성됐지만 선택 안 됨 | verifier false reject/ranking failure | final parser가 후보를 바꿈 | fixed pool oracle selector + parser audit |
| 같은 실패가 반복 | counterexample 미보존 | generator가 제약을 못 따름 | pinned ledger vs explicit constrained decoder |
| compaction 직후 regression | context loss | 동시에 모델/tool version 변경 | no-compaction frozen replay |
| 동일 context에서 결과가 상태별로 다름 | partial observability/state aliasing | tool stochasticity | paired-state reveal + repeated tool run |
| seed 하나만 성공 | search variance/high correlation | flaky verifier | 후보 gold label + fixed-candidate repeats |
| iteration이 길수록 악화 | overoptimization, regression, drift | hard tasks가 더 오래 도는 selection bias | fixed-budget randomized stopping / task stratification |
| visible test 모두 통과, 배포 실패 | verifier coverage gap | environment shift | held-out requirement matrix + frozen deployment replay |
| 외부 feedback을 shuffle해도 동일 | feedback 미사용/무정보 | shuffle이 의미를 보존 | adversarial counterfactual feedback |
| 매번 다른 부분을 대규모 수정 | credit assignment 부족 | state representation 혼란 | error localization oracle + minimal-edit constraint |
| 정답 후보는 많지만 final answer가 불안정 | selector/noisy verifier | stochastic final synthesis | deterministic selection + repeated judge |
| frozen 환경에서는 안정, live에서 진동 | non-stationarity | hidden concurrent actor | event-sourced state diff + changepoint |
| 후보는 안정, 외부 상태는 악화 | output-level false convergence | stale observation | state invariant monitor |

## 8. 권장 실험 설계

### 8.1 기본 factorial

비용이 허용되면 다음 요인의 부분 요인 또는 순차 요인 실험을 한다.

```text
O: production observation vs oracle-complete observation
M: production memory/render vs lossless pinned state
V: production verifier vs gold oracle
E: exploitative sequential refinement vs diverse exploration
N: live/noisy environment vs frozen/repeated environment
```

단일 ablation의 평균 효과뿐 아니라 상호작용을 본다.

- `V × E`: verifier가 탐색을 잘못 이끄는지
- `O × M`: 정보는 들어오지만 표현에서 잃는지
- `M × horizon`: 긴 task에서만 memory가 병목인지
- `V × budget`: overoptimization이 compute와 함께 커지는지
- `N × stopping`: noise가 false stop을 만드는지

### 8.2 task stratification

task를 최소 다음 기준으로 사전 층화한다.

```text
short / medium / long horizon
fully / partially observable
formal / test / judge / human verifiable
dense / sparse feedback
reversible / irreversible actions
stationary / live-changing environment
low / high feasible-solution density
weakly / strongly coupled constraints
```

전체 평균만 보고하면 loop가 어떤 task family에서 유효한지 사라진다.

### 8.3 통계

- task instance를 분석 단위로 하고 seed를 독립 task처럼 세지 않는다.
- task와 model을 random effect로 둔 계층 모형 또는 hierarchical bootstrap을 사용한다.
- success는 이항 결과, cost-to-success는 censoring을 포함한 survival/hitting-time 분석이 적절하다.
- 여러 iteration 중 최고 score를 고르면 optimizer's selection bias가 생기므로 held-out evaluator는 마지막에 한 번 또는 blind schedule로 사용한다.
- 조기 정지 run과 budget 소진 run을 같은 “실패”로만 합치지 않는다.
- 평균 accuracy와 함께 variance, worst-quantile, false-accept, side effect를 보고한다.

### 8.4 권장 stop state

```text
VERIFIED_SUCCESS
PROVISIONAL_SUCCESS
BUDGET_EXHAUSTED
STAGNATED
CYCLING
ENVIRONMENT_DRIFT
VERIFIER_UNCERTAIN
INFEASIBLE_OR_UNRESOLVED
```

모든 종료를 `done` 하나로 표현하면 수렴 진단이 불가능하다.

## 9. loop engineering에 대한 직접적 함의

### 9.1 CEGIS-like loop를 원한다면

- 반례를 안정된 ID와 함께 영속 저장한다.
- 다음 후보가 모든 누적 반례를 만족하는지 model 외부에서 재검사한다.
- 직전 반례만 고치는 대신 full regression suite를 매번 실행한다.
- sound counterexample과 heuristic critique를 별도 type으로 둔다.
- `ACCEPT`의 보장 범위를 UI에 명시한다.
- candidate class가 사실상 무한하면 iteration limit을 “증명된 수렴”으로 표현하지 않는다.

### 9.2 optimization loop를 원한다면

- production proxy와 held-out utility를 분리한다.
- exploration budget과 exploitation budget을 분리한다.
- best-so-far는 보존하되 주기적으로 oracle/holdout audit한다.
- 같은 후보의 score noise를 추정한다.
- budget 증가에 따른 proxy-gold divergence를 모니터링한다.

### 9.3 partially observable control loop를 원한다면

- action 전에 필요한 정보와 action 뒤에만 얻을 수 있는 정보를 구분한다.
- 정보 수집 action을 명시적으로 허용하고 비용을 기록한다.
- raw observation, inferred belief/hypothesis, committed fact를 다른 state field로 둔다.
- hidden-state alias test를 benchmark에 포함한다.
- irreversible action 전에는 state uncertainty와 verifier confidence threshold를 둔다.

### 9.4 긴 context loop를 원한다면

- goal, hard constraints, sound counterexamples, best-so-far는 append-only chat history와 분리한다.
- compaction 전후에 state invariant를 자동 비교한다.
- memory write, retrieval, context insertion, model uptake를 각각 계측한다.
- old evidence의 age-distance retention curve를 지속적으로 본다.
- summary는 결론뿐 아니라 조건·근거·반증 가능성을 보존한다.

### 9.5 noisy/live loop를 원한다면

- idempotent action, checkpoint, rollback, dry run을 기본으로 한다.
- replay 가능한 environment snapshot을 남긴다.
- flaky verifier는 반복 평가와 confidence-aware stopping을 사용한다.
- drift가 감지되면 과거 best를 맹목적으로 유지하지 말고 revalidate한다.
- static convergence와 dynamic tracking KPI를 분리한다.

## 10. 가장 작은 결정 트리

```text
Q1. gold evaluator로 봤을 때 후보 K개 중 성공이 존재하는가?
  아니오 -> task/generator/search/observability를 조사
  예
   |
   Q2. production verifier가 그 성공 후보를 고르는가?
     아니오 -> verifier/metric/selector 결함
     예
      |
      Q3. 실제 online loop에서도 다음 후보가 누적 evidence를 보존하는가?
        아니오 -> state update/context loss/constraint coupling
        예
         |
         Q4. frozen snapshot에서 반복하면 안정적인가?
           아니오 -> stochasticity/verifier flakiness
           예
            |
            Q5. live 환경에서만 깨지는가?
              예 -> non-stationarity/drift
              아니오 -> stopping, side effect, gold definition을 재검토
```

이 결정 트리는 원인을 완전히 증명하지는 않지만, “모델이 부족하다” 또는 “metric이 나쁘다”는 모호한 결론을 계측 가능한 하위 문제로 바꾼다.

## 11. 근거 수준과 1차 출처 기록

근거 수준:

- **T**: 논문에 명시된 정리·형식 결과. 가정 밖 일반화 금지.
- **E**: peer-reviewed 1차 실험. 연구한 model/task/setup에 직접 적용.
- **B**: peer-reviewed benchmark·기술적 측정. 인과보다는 현상·측정 근거.
- **R**: 연구기관 보고서 또는 preprint. 최신 정황이며 잠정적.
- **S**: 이 문서의 이론 연결·진단 제안. 실험으로 검증해야 함.

| 출처 | 상태 | 이 문서에서 사용하는 근거 | 수준·한계 |
| --- | --- | --- | --- |
| [Kaelbling et al., Planning and Acting in POMDPs](https://www.sciencedirect.com/science/article/pii/S000437029800023X) | Artificial Intelligence, 1998 | belief/history를 통한 부분관측 의사결정 | T; LLM context가 exact belief라는 증거는 아님 |
| [Chrisman, Perceptual Aliasing](https://aaai.org/Papers/AAAI/1992/AAAI92-029.pdf) | AAAI 1992 | 같은 관측이 다른 action을 요구하는 aliasing | E; 단순 simulated domain |
| [Silver & Veness, POMCP](https://proceedings.neurips.cc/paper/2010/hash/edfbe1afcf9246bb0d40eb4d8027d90f-Abstract.html) | NeurIPS 2010 | 적절한 exploration과 방문 증가 아래 PO-UCT 수렴 | T+E; generic linear agent loop에 자동 이전 불가 |
| [Watkins & Dayan, Q-learning](https://www.gatsby.ucl.ac.uk/~dayan/papers/wd92.html) | Machine Learning, 1992 | 모든 state-action 반복 sampling 등 수렴 조건 | T; tabular stationary setting |
| [Jha & Seshia, OGIS/CEGIS theory](https://people.eecs.berkeley.edu/~sseshia/pubs/b2hd-jha-acta17.html) | Acta Informatica, 2017 | finite/infinite class, bounded memory, identification과 termination 차이 | T; formal synthesis setting |
| [Bhatia et al., Verified Code Transpilation](https://proceedings.neurips.cc/paper_files/paper/2024/hash/48bb60a0c0aebb4142bf314bd1a5c6a0-Abstract-Conference.html) | NeurIPS 2024 | LLM proposal과 formal verification 결합 사례 | E; domain-specific lifting |
| [Orvalho et al., Counterexample Guided Program Repair](https://ojs.aaai.org/index.php/AAAI/article/view/32046) | AAAI 2025 | LLM repair에 test counterexample을 재투입한 CEGIS 사례 | E; 교육용 프로그램·test 범위 |
| [Mayne et al., Constrained MPC](https://www.sciencedirect.com/science/article/pii/S0005109899002149) | Automatica, 2000 survey paper | 반복 재계획과 stability guarantee의 조건 차이 | T/종합; LLM agent 직접 연구 아님 |
| [Robbins & Monro, Stochastic Approximation](https://projecteuclid.org/journals/annals-of-mathematical-statistics/volume-22/issue-3/A-Stochastic-Approximation-Method/10.1214/aoms/1177729586.full) | Annals of Mathematical Statistics, 1951 | noisy iterative update의 수렴에 조건이 필요 | T; LLM natural-language update 직접 모델 아님 |
| [Wolpert & Macready, No Free Lunch](https://doi.org/10.1109/4235.585893) | IEEE TEC, 1997 | task distribution과 무관한 보편 optimizer 부재 | T; 실제 task prior가 있는 경우의 상대 성능을 부정하지 않음 |
| [Abbasi-Yadkori et al., Dynamic Regret](https://jmlr.org/papers/v24/22-0387.html) | JMLR, 2023 | non-stationary 목표에서는 dynamic regret 사용 | T+E; bandit setting |
| [Zhao et al., Online Learning with Memory and Control](https://jmlr.org/beta/papers/v24/22-0218.html) | JMLR, 2023 | memory·switching cost·non-stationarity 결합 | T+E; convex/control assumptions |
| [Lightman et al., Let's Verify Step by Step](https://iclr.cc/virtual/2024/poster/17549) | ICLR 2024 | 연구한 MATH 설정에서 process supervision의 효용 | E; 수학·해당 model/data에 한정 |
| [Gao et al., Reward Model Overoptimization](https://proceedings.mlr.press/v202/gao23h.html) | ICML 2023 | proxy 최적화 압력이 gold reward를 악화시킬 수 있음 | E; synthetic gold reward setup |
| [Huang et al., Intrinsic Self-Correction](https://openreview.net/forum?id=IkmD3fKBPQ) | ICLR 2024 | 외부 feedback 없는 self-correction의 제한 | E; 제한된 reasoning tasks와 model |
| [Gou et al., CRITIC](https://proceedings.iclr.cc/paper_files/paper/2024/hash/fef126561bbf9d4467dbb8d27334b8fe-Abstract-Conference.html) | ICLR 2024 | tool-grounded critique loop의 개선 사례 | E; 선택한 QA/code/toxicity 설정 |
| [ProcessBench](https://aclanthology.org/2025.acl-long.50/) | ACL 2025 | PRM의 harder-math error localization 일반화 부족 | B+E; 수학 process 오류 중심 |
| [Snell et al., Test-Time Compute](https://iclr.cc/virtual/2025/poster/31024) | ICLR 2025 | search/revision 효율이 task difficulty에 의존 | E; 수학 reasoning 중심 |
| [Weaver](https://openreview.net/forum?id=dRjt4vlYVQ) | NeurIPS 2025 | generation-verification gap과 weak verifier 결합 | E; 연구한 reasoning/math datasets |
| [Liu et al., Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/) | TACL 2024 | evidence 위치에 따른 long-context 사용 저하 | E; QA/retrieval에서의 위치 효과 |
| [Xia et al., Minerva](https://proceedings.mlr.press/v267/xia25c.html) | ICML 2025 | memory 사용 능력의 원자적·합성적 측정 | B+E; synthetic programmable tests |
| [Wu et al., LongMemEval](https://openreview.net/forum?id=pZiyCaVuti) | ICLR 2025 | long-term memory 능력 분해와 지속 대화의 정확도 저하 | B+E; chat assistant 중심 |
| [Liu et al., ReflecTool-Bench](https://aclanthology.org/2026.findings-acl.86/) | Findings of ACL 2026 | tool error에서 critique와 self-reflection의 격차 | B+E; 968 annotated dialogues |
| [METR Task-Completion Time Horizons](https://metr.org/time-horizons/) | 2026-05-08 갱신 기술 자료 | task horizon과 success의 경험적 상관 | R; 비 peer-reviewed, 인과 주장 아님 |

## 12. 현재 가장 강하게 말할 수 있는 명제

### 확립에 가까운 것

1. partial observability에서는 현재 observation만으로 action을 정하면 state aliasing 때문에 최적 행동을 구분하지 못할 수 있다.
2. CEGIS의 진전은 sound counterexample의 보존과 강제에 의존하며, infinite candidate class에서 termination은 자동으로 보장되지 않는다.
3. feedback controller라는 형식만으로 closed-loop stability는 보장되지 않는다.
4. verifier-guided search의 성능은 generator coverage와 verifier selection accuracy를 분리해야 한다.
5. proxy를 강하게 최적화하면 proxy와 gold utility가 벌어질 수 있다.
6. long context에 evidence가 존재해도 위치·retrieval·state operation 실패 때문에 행동에 사용되지 않을 수 있다.
7. stationary convergence 정리는 non-stationary environment에 그대로 적용할 수 없다.

### 이 프로젝트의 종합

> agent loop의 수렴은 base model 한 구성요소의 단일 성질이 아니라, `정보가 들어오는가 -> 충분한 상태로 보존되는가 -> 후보 support가 있는가 -> 탐색이 그 support를 방문하는가 -> verifier가 실제 utility를 식별하는가 -> update가 evidence를 누적하는가 -> 환경과 평가가 안정적인가 -> stop이 불확실성을 처리하는가`의 연쇄 조건이다.

### 아직 실험해야 하는 가설

1. counterexample의 정보량보다 **누적 반례 유지율**이 장기 code-agent 성공을 더 잘 예측할 수 있다.
2. `Pass@K`와 selected success를 함께 측정하면 task difficulty와 verifier defect의 상당 부분을 실용적으로 분리할 수 있다.
3. compaction-boundary failure hazard는 단순 token length보다 context loss를 더 민감하게 포착할 수 있다.
4. 동일 모델 self-verifier의 오류 상관이 independent verifier를 쓸 때보다 generation-verification gap을 키울 수 있다.
5. live agent에서는 정적 success보다 dynamic regret + switching/side-effect cost가 더 적합한 KPI일 수 있다.

## 13. 해석의 경계

- 이 진단은 black-box system component를 국소화한다. 특정 transformer head, layer, activation이 원인임을 증명하지 않는다.
- oracle arm이 성능을 높여도 production에서 구현 가능한 oracle이라는 뜻은 아니다. 그것은 병목의 상한을 보여 준다.
- 하나의 ablation이 좋아졌다고 단일 원인으로 확정하지 않는다. 상호작용과 distribution shift를 확인한다.
- formal theorem은 해당 논문의 가정 아래에서만 사용한다.
- benchmark 결과는 연구한 task/model에 직접 적용하고, general-purpose agent 전체로의 확장은 별도 가설로 둔다.
