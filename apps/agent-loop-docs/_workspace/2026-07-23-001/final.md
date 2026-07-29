# 전체 지도

metadata: AI agent가 실행과 수정을 반복하는 이유
H1: AI agent가 한 번에 답하지 않고 실행과 수정을 반복하는 이유
lead: Code agent는 patch를 제안한 뒤 test를 실행하고, 실패 로그와 명세를 다음 판단에 반영합니다. 결제 API 버그 하나를 따라가며 test와 명세에서 얻은 정보가 다음 patch를 바꾸는 과정을 두 가지 의사결정 모형과 두 가지 합성 방식으로 나눠 보겠습니다.
H2 incident: 결제 금액을 0으로 보정한 patch는 단위 테스트를 통과했지만 API 계약을 어겼습니다
H2 claim: 테스트와 명세에서 얻은 정보가 다음 행동을 바꿀 때 loop가 one-shot보다 유리합니다
H2 one-turn: Agent loop는 후보 생성, 실행, 관찰, 상태 갱신을 반복합니다
H2 model-map: 다음 행동을 고르는 문제와 다음 patch를 만드는 문제는 다릅니다
H2 selection: State, observation, candidate, verifier 중 무엇이 구현에 있는지에 따라 설명 틀이 달라집니다
H2 boundary: Agent loop를 POMDP나 CEGIS로 설명할 수 있어도 agent가 그 알고리즘을 실행하는 것은 아닙니다

# MDP

metadata: MDP로 다음 행동의 장기 결과 비교하기
H1: MDP는 현재 작업 상태에서 다음 행동의 장기 결과를 비교하는 모형입니다
lead: 계약을 먼저 읽을지, 바로 patch할지를 정하려면 당장의 비용과 이후 회귀 위험을 함께 봐야 합니다. 결제 API 사례로 state, transition, reward가 행동 가치 계산에 어떻게 들어가는지 살펴봅니다.
H2 checkpoint: MDP state에는 다음 행동을 고르는 데 필요한 작업 정보를 담습니다
H2 lab: 계약 확인 비용과 성급한 patch의 회귀 위험을 함께 비교합니다
H2 markov: 현재 state만으로 다음 전이를 예측할 수 있어야 Markov 조건을 만족합니다
H2 formal-model: 결제 API 작업을 MDP 요소와 Bellman 식으로 표현합니다
H2 agent-boundary: Code agent는 실제 작업 state를 로그와 파일 일부로만 관찰합니다
TOC: 작업 state 정의 / 행동의 장기 가치 / Markov 조건 / MDP와 Bellman 식 / Code agent의 관측 한계 / 근거 문헌

# POMDP

metadata: POMDP로 테스트 결과에서 결함 원인 추정하기
H1: POMDP는 직접 볼 수 없는 결함 원인에 대한 확률을 테스트 결과로 갱신하는 모형입니다
lead: 음수 결제 금액의 원인이 계산식 오류인지 입력 검증 누락인지는 실패 로그 한 줄로 확정할 수 없습니다. POMDP는 실제 state, 관찰한 test 결과, 원인별 belief를 분리해 이런 불확실성을 표현합니다.
H2 checkpoint: 결함 원인은 hidden state이고 테스트 로그는 observation입니다
H2 information-value: 계산식 오류와 입력 검증 누락을 다르게 드러내는 테스트가 다음 행동을 바꿉니다
H2 lab: 같은 실패라도 어떤 테스트에서 나왔는지에 따라 belief update가 달라집니다
H2 formal-model: Hidden state, observation model, belief update를 수식으로 연결합니다
H2 planning-boundary: Belief update는 상태 추정이며 online planning에는 별도 탐색이 필요합니다
TOC: Hidden state와 observation / 테스트의 정보 가치 / Belief update 실습 / POMDP와 Bayes update / Belief update와 planning / 근거 문헌

# OGIS

metadata: OGIS 질의와 검증 응답으로 patch 후보 좁히기
H1: OGIS는 질의 형식과 검증 응답으로 patch 후보를 좁히는 귀납적 합성 방식입니다
lead: Clamp, 하한 검사, 양쪽 경계 검사처럼 가능한 수정안이 여러 개일 때 learner는 후보를 만들고 oracle에 정해진 형식으로 묻습니다. 응답을 evidence로 보존하면 다음 후보의 범위가 줄어듭니다.
H2 checkpoint: LLM이 patch 후보를 만들면 harness가 test와 compiler로 후보를 확인합니다
H2 oracle-interface: OGIS의 oracle은 query와 response type이 정해진 검증 interface입니다
H2 query-types: Boolean 판정, label, counterexample은 각각 제거할 수 있는 후보 범위가 다릅니다
H2 lab: 할인값을 질의할 때마다 계약과 모순되는 validation 후보가 탈락합니다
H2 formal-model: 누적 evidence와 일관된 후보만 version space에 남습니다
H2 agent-boundary: Candidate와 typed oracle query가 있을 때 OGIS 설명이 성립합니다
TOC: Patch 후보와 검증 / Typed oracle interface / 응답 형식별 정보 / 후보 제거 실습 / Evidence와 version space / OGIS 적용 조건 / 근거 문헌

# CEGIS

metadata: CEGIS로 실패 입력을 다음 patch의 제약으로 보존하기
H1: CEGIS는 실패한 입력을 다음 patch가 만족해야 할 제약으로 보존하는 합성 방식입니다
lead: Clamp patch가 주문 금액보다 큰 할인 요청에서 계약을 어겼다면 다음 후보는 그 입력을 거부해야 합니다. CEGIS는 learner와 verifier를 번갈아 실행하며 이런 counterexample을 누적합니다.
H2 checkpoint: 구체적인 실패 입력은 다음 validation rule이 만족해야 할 조건이 됩니다
H2 lab: 음수 할인과 주문 금액을 넘는 할인을 차례로 반례에 추가합니다
H2 progress: 모든 반례를 보존해야 candidate set이 단조롭게 줄어듭니다
H2 formal-model: 모든 결제 요청에서 계약을 만족하는 validation rule을 수식으로 정의합니다
H2 agent-mapping: 일반 code agent는 formal CEGIS보다 CEGIS-like로 설명하는 편이 정확합니다
H2 guarantees: 유한 test suite 통과는 모든 입력에 대한 correctness proof가 아닙니다
TOC: 실패 입력과 새 조건 / 반례 누적 실습 / Candidate set의 감소 / CEGIS specification / Code agent와 CEGIS-like / 보장 조건과 한계 / 근거 문헌

# 사이드바

MDP: 작업 상태와 장기 결과로 다음 행동을 비교
POMDP: 테스트 결과로 결함 원인 가설을 갱신
OGIS: 질의 형식과 응답으로 patch 후보를 축소
CEGIS: 실패 입력을 다음 patch의 제약으로 보존

# 인터랙티브 랩

Agent loop title: 실행 결과를 다음 판단에 반영하는 agent loop
Agent loop subtitle: 목표 설정부터 후보 생성, 실행, 관찰, state update까지 한 iteration에서 바뀌는 정보를 확인합니다.
MDP structure title: 결제 API 작업을 MDP 요소로 나누기
MDP structure subtitle: State, action, transition, reward와 Markov 조건이 수정 workflow에서 무엇을 가리키는지 확인합니다.
MDP value title: 계약 확인과 즉시 수정의 장기 가치 비교
MDP value subtitle: Bellman backup으로 조사 비용과 이후 회귀 위험을 함께 계산합니다.
POMDP structure title: 결함 원인과 테스트 결과를 분리하는 POMDP
POMDP structure subtitle: Hidden state에서 observation이 나오고 belief가 갱신된 뒤 planning으로 이어지는 경계를 확인합니다.
POMDP belief title: 테스트 결과에 따른 결함 가설 갱신
POMDP belief subtitle: 선택한 test와 pass/fail이 입력 검증 누락과 계산식 결함의 posterior를 어떻게 바꾸는지 계산합니다.
OGIS protocol title: Query와 response type으로 구성한 OGIS protocol
OGIS protocol subtitle: Membership, example, equivalence, correctness 질의가 각각 어떤 evidence를 남기는지 확인합니다.
OGIS lab title: 할인 validation 후보를 줄이는 oracle 질의
OGIS lab subtitle: Membership, example, equivalence 응답을 누적해 계약과 모순되는 후보를 제거합니다.
CEGIS loop title: 실패한 할인값을 보존하는 CEGIS loop
CEGIS loop subtitle: Validation rule을 합성하고 verifier가 찾은 counterexample을 다음 후보의 제약으로 추가합니다.
CEGIS retention title: 반례 보존 여부에 따른 candidate set 변화
CEGIS retention subtitle: 모든 반례를 누적할 때와 최신 반례만 남길 때 이전 실패가 다시 나타나는지 비교합니다.

<!-- HUMANIZE-SUMMARY
run_id: 2026-07-23-001
metrics:
  char_in: 4638
  char_out: 4704
  change_rate: 3.34%
  self_check: 6/6
  grade: B
categories:
  H-3 메타 진입·지시 대상 생략: 3 -> 0
  A-18 긴 좌향 수식: 2 -> 0
  F-4 추상 명사 누적: 1 -> 0
  A-10 가능형: 1 -> 0
self_check:
  - 고유명사·수치·인용 보존: pass
  - 변경률 30% 이하: pass
  - 장르 이탈 없음: pass
  - register 보존: pass
  - S1 잔존 0건: pass
  - 인공 표현 추가 없음: pass
highlights:
  - id: H-3-001
    before: "이 loop에서 새 정보가 어떤 역할을 하는지"
    after: "test와 명세에서 얻은 정보가 다음 patch를 어떻게 바꾸는지"
  - id: A-18-001
    before: "테스트 결과로 보이지 않는 결함 원인의 확률"
    after: "직접 볼 수 없는 결함 원인에 대한 확률을 테스트 결과로"
residual_findings: none
grade_reason: "제목 재설계안 자체가 이미 자연스러워 탐지 근거가 있는 일곱 구간만 손봤습니다. 변경률이 10% 미만이라 B로 평가합니다."
-->
