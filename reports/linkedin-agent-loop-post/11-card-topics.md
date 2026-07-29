# LinkedIn Card News Topic Outline

목표: 10장 이내의 LinkedIn carousel로, “LLM agent loop는 보편 필연이 아니라 조건부 구조적 필요성이다”라는 논지를 독립적으로 전달한다. 카드만 봐도 핵심을 이해할 수 있어야 하며, 블로그 본문으로 넘어갈 동기를 만들어야 한다.

## Card 1. Hook

제목: 무엇이 loop를 닫는가?

핵심: “agent가 loop인가?”보다 “verifier, feedback, tool, state가 다음 행동을 바꾸는가?”가 더 좋은 질문이다.

역할: 관심을 붙잡고 논점의 프레임을 바꾼다.

## Card 2. Conditional Necessity

제목: 모든 작업에 loop가 필요하진 않다

핵심: 외부 관찰·검증·수정·rollback이 필요한 장기 작업에서 조건부로 필요해질 수 있다. 내부 점수만으로 실제 성공 기준을 대신하기 어렵기 때문이다.

역할: 원래 아이디어를 더 논문/공학적으로 탄탄한 주장으로 재구성한다.

## Card 3. Objective Mismatch

제목: 모델 점수 ≠ 실제 성공

핵심: next-token objective, sequence likelihood, task utility는 같지 않다. 그럴듯함은 성공이 아니다.

역할: 수학적 근거의 중심축을 짧게 제시한다.

## Card 4. When Text Generation Becomes a System

제목: 어느 순간 텍스트 문제가 시스템 문제가 된다

핵심: agent가 파일, source, API 상태를 바꾸면 문제는 답변 생성이 아니다. state -> action -> observation -> verification -> update/rollback의 폐루프가 된다.

역할: 왜 agent engineering이 모델 호출을 넘어서는지 보여준다.

## Card 5. Pilot Lesson

제목: 작은 pilot은 증명이 아니다

핵심: 12개 합성 과제, 단일 실행이라 통계적 결론은 낼 수 없다. 효과 추정이 아니라 실패 모드 관찰이며, 이 설정에서는 반복만으로 개선을 확인하지 못했다.

역할: 과장된 주장 대신 실패 모드 중심의 경험적 근거를 제시한다.

## Card 6. Control Surface 1: Verifier

제목: Verifier: 판정, 아니면 echo

핵심: 정의는 utility proxy에 비춘 판정이다. 체크포인트는 false positive/negative를 줄이는가이고 실패 모드는 false positive다.

역할: 좋은 loop의 첫 번째 조건을 제시한다.

## Card 7. Control Surface 2: Actionable Feedback

제목: Feedback: 거절이 아니라 수리

핵심: 정의는 다음 수정 위치를 주는 오류 구조다. 체크포인트는 diff/counterexample/source mismatch이고 실패 모드는 pass/fail-only다.

역할: pass/fail-only loop의 한계를 설명한다.

## Card 8. Control Surface 3: Tool Access

제목: Tool: 추측을 깨는 관찰

핵심: 정의는 prompt 밖을 관찰하고 바꾸는 행동이다. 체크포인트는 가정을 반증하거나 상태를 확인하는가이고 실패 모드는 correlated guessing, 같은 오류 공간 반복이다.

역할: agent가 외부 관측을 가져야 하는 이유를 설명한다.

## Card 9. Control Surface 4: State Control

제목: State: drift를 막는 경계

핵심: 정의는 보존, 폐기, rollback, stop이다. 체크포인트는 ownership/provenance/rollback boundary이고 실패 모드는 irreversible commit이다.

역할: 장기 agent의 가장 위험한 실패 모드인 검증되지 않은 가정의 commit을 강조한다.

## Card 10. Closing Checklist

제목: 좋은 loop는 신호로 닫힌다

핵심: 좋은 loop는 더 오래 말하는 것이 아니라 더 좋은 신호로 다음 action을 바꾼다. 마지막 질문은 “어떤 feedback이 어떤 state를 어떻게 바꾸는가?”다.

역할: 실무자가 바로 사용할 수 있는 결론과 체크리스트로 마무리한다.
