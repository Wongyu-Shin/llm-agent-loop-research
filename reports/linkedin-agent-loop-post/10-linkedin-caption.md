LLM agent를 만들다 보면 질문이 금방 여기로 갑니다.

“loop를 넣어야 하나?”

제 답은 조금 다릅니다.

먼저 물어야 할 건 “무엇이 loop를 닫고 있는가?”입니다.

LLM의 next-token objective는 우리가 원하는 task utility와 다릅니다. 그래서 작업이 길고, 신뢰성이 중요하고, 외부 상태까지 바꾸는 경우에는 one-shot 답변만으로는 부족해집니다. 이때 agent는 폐루프 제어에 가까운 설계가 필요해질 수 있습니다.

다만 반복 자체가 답은 아닙니다.

좋은 agent loop를 보려면 네 가지를 따로 봐야 합니다.

1. 독립적이고 calibration된 verifier
2. 다음 행동을 바꾸는 actionable feedback
3. 추측을 현실에 부딪히게 하는 tool access
4. 상태의 소유권, provenance, rollback, stop rule

verifier 없는 loop는 더 많은 텍스트일 뿐입니다.

블로그 본문에서는 이 주장을 objective mismatch, 작은 pilot의 실패 모드, agent engineering 관점에서 더 길게 풀었습니다.
