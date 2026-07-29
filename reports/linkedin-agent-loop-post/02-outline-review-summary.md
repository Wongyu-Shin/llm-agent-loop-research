# Outline Review Summary

LLM-as-judge run: `reports/linkedin-agent-loop-post/02-outline-multidisciplinary-review.json`

Summary:

- Average score: 8.0 / 10
- Minimum score: 8 / 10
- Verdicts: 1 pass, 4 revise

Main required changes:

1. Weaken the title and thesis from “필연” to “조건부 구조적 필요성.”
2. Treat the tiny pilot as an underpowered illustrative case, not proof.
3. Separate the mathematical chain:
   - next-token objective,
   - greedy/sequence MAP mismatch,
   - sequence likelihood vs task utility,
   - implication for control surfaces.
4. Define the four control surfaces with sharper boundaries:
   - verifier = 판정/측정,
   - actionable feedback = 수정 가능한 오류 구조,
   - tool access = 외부 관측/행동,
   - state control = 기억/분기/롤백/종료 규칙.
5. Add “when not to use a loop” and “when loop can hurt.”
6. Make the practical architecture section include state ownership, rollback semantics, and stopping rule.
7. End with a shorter, memorable thesis rather than a long paper-style sentence.
