# LLM Agent Loop Research

이 저장소는 LLM agent가 실행 결과를 다시 입력으로 받아 작업을 이어 가는 이유를 조사합니다. 출발점은 "자동회귀 모델이므로 loop가 반드시 필요하다"는 가설이었습니다. 현재까지 확인한 결론은 그보다 좁습니다.

확률적으로 token을 생성한다는 사실만으로 loop의 필연성을 증명할 수는 없습니다. loop는 실행 전에 알 수 없던 정보가 관찰로 드러나고, 그 정보를 다음 선택에 반영할 수 있을 때 유용합니다. 검증기가 약하거나 feedback이 다음 행동을 바꾸지 못하면 반복만으로 성능이 좋아지지는 않습니다.

이 저장소에는 수학·통계·제어·프로그램 합성 관점의 조사 결과와 논문 초안, 실험 프로토콜, LinkedIn 게시물, 인터랙티브 웹 문서가 함께 들어 있습니다. 기존 `M4b` 파일명은 연구 이력과 내부 링크를 보존하려고 유지했습니다.

<!-- HUMANIZE-SUMMARY
run_id: 2026-07-23-003
metrics:
  char_in: 479
  char_out: 454
  change_rate: 9.8%
  self_check: 6/6
  grade: B
categories:
  A-1 번역투 '~에 대해': 1 -> 0
  A-2 번역투 '~를 통해': 1 -> 0
  A-10 가능형 남발: 2 -> 0
self_check:
  - 고유명사·수치·인용 보존: pass
  - 변경률 30% 이하: pass
  - 장르 이탈 없음: pass
  - register 보존: pass
  - S1 잔존 0건: pass
  - 인공 표현 추가 없음: pass
highlights:
  - id: A-2-001
    before: "그 정보를 다음 선택에 반영하는 구조를 통해 유용해질 수 있습니다"
    after: "그 정보를 다음 선택에 반영할 수 있을 때 유용합니다"
residual_findings: none
grade_reason: "S1 잔존과 자체검증 실패는 없으나 변경률이 A 등급 하한보다 낮다."
-->
