# LinkedIn Card News Copy

## Card 1

Eyebrow: LLM Agent Engineering

Headline: 무엇이 loop를 닫는가?

Body:
질문은 “agent가 loop인가?”가 아니다.

verifier, feedback, tool, state가 다음 행동을 바꾸는가?

Footer: verifier · feedback · tools · state

Visual cue: 열린 원형 화살표가 네 개의 control surface로 닫히는 구성.

Alt text: LLM agent loop의 핵심 질문을 “무엇이 loop를 닫는가?”로 재정의하는 첫 카드.

## Card 2

Eyebrow: Conditional Necessity

Headline: 모든 작업에 loop가 필요하진 않다

Body:
외부 관찰·검증·수정·rollback이 필요한 장기 작업에서 조건부로 필요해질 수 있다.

내부 점수만으로 실제 성공 기준을 대신하기 어렵기 때문이다.

Footer: objective mismatch -> control surface

Visual cue: 흐릿한 반복 화살표 옆에 선명한 목표 함수 간극.

Alt text: LLM agent loop가 모든 작업의 필수 구조가 아니라 objective mismatch가 큰 작업에서 생기는 조건부 구조라는 카드.

## Card 3

Eyebrow: Core Argument

Headline: 모델 점수 ≠ 실제 성공

Body:
next-token objective

sequence likelihood

task utility

그럴듯함은 성공이 아니다.

Footer: likelihood is not utility

Visual cue: 세 층의 목적함수가 어긋난 계단형 다이어그램.

Alt text: next-token, sequence likelihood, task utility가 서로 다른 목적함수임을 보여주는 카드.

## Card 4

Eyebrow: System Boundary

Headline: 텍스트 문제는 시스템 문제가 된다

Body:
agent가 파일, source, API 상태를 바꾸면 문제는 답변 생성이 아니다.

state -> action -> observation -> verification -> update/rollback의 폐루프가 된다.

Footer: state -> action -> observe -> verify -> update

Visual cue: 단순 prompt-answer 선이 폐루프 시스템 다이어그램으로 확장된다.

Alt text: 장기 LLM agent 작업이 단순 텍스트 생성에서 폐루프 시스템 문제로 바뀌는 카드.

## Card 5

Eyebrow: Pilot Lesson

Headline: 작은 pilot은 증명이 아니다

Body:
12개 합성 과제, 단일 실행, 통계적 결론 불가.

효과 추정이 아니라 실패 모드 관찰이다.

이 설정에서는 반복만으로 개선을 확인하지 못했다.

Footer: proof가 아니라 failure mode

Visual cue: 같은 loop 아이콘 두 개 중 하나는 약한 신호, 하나는 강한 신호를 가진 대비.

Alt text: 작은 파일럿에서 단순 반복만으로는 성능 개선을 보장하지 못했다는 카드.

## Card 6

Eyebrow: Control Surface 1

Headline: Verifier: 판정, 아니면 echo

Body:
정의: utility proxy에 비춘 판정.

체크: false positive/negative를 줄이는가?

실패: false positive.

Footer: prevent false success

Visual cue: 출력 후보가 verifier 게이트를 통과하거나 차단되는 장면.

Alt text: verifier의 독립성, calibration, task utility 정렬이 중요하다는 카드.

## Card 7

Eyebrow: Control Surface 2

Headline: Feedback: 거절이 아니라 수리

Body:
정의: 다음 수정 위치를 주는 오류 구조.

체크: diff / counterexample / source mismatch?

실패: pass/fail-only.

Footer: turn rejection into repair

Visual cue: 빨간 X가 diagnostic report로 변하는 모습.

Alt text: 단순 실패 판정보다 수리 가능한 diagnostic feedback이 중요하다는 카드.

## Card 8

Eyebrow: Control Surface 3

Headline: Tool: 추측을 깨는 관찰

Body:
정의: prompt 밖을 관찰하고 바꾸는 행동.

체크: 가정을 반증하거나 상태를 확인하는가?

실패: correlated guessing, 같은 오류 공간 반복.

Footer: break internal correlation

Visual cue: 모델 내부 추측이 터미널, 브라우저, 데이터베이스와 연결된다.

Alt text: tool access가 LLM의 내부 추측을 외부 관측으로 검증하게 만든다는 카드.

## Card 9

Eyebrow: Control Surface 4

Headline: State: drift를 막는 경계

Body:
정의: 보존, 폐기, rollback, stop.

체크: ownership / provenance / rollback boundary?

실패: irreversible commit.

Footer: own · trace · rollback · stop

Visual cue: ledger, memory, rollback, stop 버튼이 하나의 상태판에 배치된다.

Alt text: state ownership, provenance, rollback, stopping rule이 agent loop에 필요하다는 카드.

## Card 10

Eyebrow: Design Review

Headline: 좋은 loop는 신호로 닫힌다

Body:
더 오래 말하는 것이 아니라, 더 좋은 신호가 다음 행동을 바꾸는가?

마지막 질문: 어떤 feedback이 어떤 state를 어떻게 바꾸는가?

stop rule은 success, latency, risk를 함께 보는 종료 정책이다.

Footer: what changes the next action?

Visual cue: 네 control surface가 하나의 닫힌 루프를 완성한다.

Alt text: 좋은 LLM agent loop는 더 오래 말하는 것이 아니라 더 좋은 신호로 행동을 바꾸는 시스템이라는 결론 카드.
