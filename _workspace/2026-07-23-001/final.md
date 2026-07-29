MDP를 적용하려면 의사결정에 필요한 정보를 state에 담아야 합니다. 결제 API 사례를 다음 TypeScript 타입으로 적어 봅니다.

이 실습에서 중요한 것은 반복 횟수가 아닙니다. 서로 다른 action의 transition과 장기 결과를 비교하는 일입니다.

Markov property는 과거를 버리라는 규칙이 아닙니다. 더 오래된 history 없이도 현재 state만으로 다음 state의 분포를 계산할 수 있다고 가정합니다.

이 식은 observation을 받은 뒤 고를 최선의 action과 observation 없이 고를 최선의 action을 비교합니다.

OGIS의 oracle은 막연한 전문가 비유가 아닙니다. Learner가 보낼 query와 oracle이 돌려줄 response type이 정해져 있습니다. Code agent에서는 다음 interface가 그 구조를 보여줍니다.

Loop 자체는 성능 보장이 아닙니다. 새 observation이 없거나 verifier가 잘못됐거나 이전 실패를 잊는다면 반복은 비용만 늘리거나 같은 오류를 강화할 수 있습니다.

<!-- HUMANIZE-SUMMARY
run_id: 2026-07-23-001
metrics:
  char_in: 586
  char_out: 551
  change_rate: 18.1%
  self_check: 6/6
  grade: A
categories:
  A-10 할 수 있다 남발: 2 -> 0
  A-15 추상 주어와 인지 동사: 1 -> 0
  C-12 쉼표 포함률: 2 -> 0
  I-2 형식명사 점: 1 -> 0
self_check:
  - 고유명사·수치·인용 보존: pass
  - 변경률 30% 이하: pass
  - 장르 이탈 없음: pass
  - register 보존: pass
  - S1 잔존 0건: pass
  - 인공 표현 추가 없음: pass
highlights:
  - id: I-2-01
    before: "여기서 loop의 장점은 반복 횟수가 아닙니다. action마다 다른 transition과 장기 결과를 비교할 수 있다는 점입니다."
    after: "이 실습에서 중요한 것은 반복 횟수가 아닙니다. 서로 다른 action의 transition과 장기 결과를 비교하는 일입니다."
residual_findings: none
grade_reason: "보호 span을 유지하면서 S2 번역투와 형식명사, 불필요한 쉼표를 제거했습니다."
-->
