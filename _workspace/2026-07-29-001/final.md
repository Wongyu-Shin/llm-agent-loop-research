[윤문 범위]
apps/agent-loop-docs/app/self-correction-scaling/page.mdx의 장면별 상세 본문, callout, 최종 takeaways

[scene-01]
같은 모델이 같은 답을 거듭 고친다고 해서 정확도가 늘 오르는 건 아닙니다. 좋아질 수도 있지만, 그대로이거나 오히려 나빠질 수도 있습니다. 논문은 이 차이를 두 흐름으로 나눠서 봅니다. 하나는 오답이 정답으로 들어오는 복구 유입이고, 다른 하나는 정답이 오답으로 빠져나가는 훼손 유출입니다.

먼저 붙잡을 결론
몇 번 반복했는지만으로는 결과가 좋아질지 알 수 없습니다.

[scene-02]
논문이 직접 다루는 것은 외부 정보 없이 같은 모델이 이전 응답을 다시 살펴보는 intrinsic self-correction입니다. 라운드 t의 정답 비율은 Acc_t입니다. 현재 정답이 다음에도 정답으로 남을 확률은 CL_t, 현재 오답이 정답으로 복구될 확률은 CS_t입니다. 이 값들은 모델이 스스로 말한 자신감이나 critique 점수가 아닙니다. 외부 판정이 끝난 뒤 응답 집단에서 계산한 조건부 전이율입니다.

확률 회계
다음 정확도는 살아남은 정답과 새로 복구된 정답의 합입니다.

[scene-03]
한 라운드에서 정확도가 얼마나 달라지는지는 두 항의 차이로 볼 수 있습니다. (1 - Acc_t) × CS_t는 복구 이득이고, Acc_t × (1 - CL_t)는 훼손 손실입니다. 현재 정확도가 99%이고 CS_t=0.50이면 손익분기 CL_t는 약 99.49%입니다. 따라서 남은 오답의 절반을 고쳐도 기존 정답을 약 0.51%보다 많이 훼손하면 전체 정확도는 오히려 내려갑니다.

위험 구조
출발 정확도가 높을수록 작은 훼손률도 큰 비용이 됩니다.

[scene-04]
수렴 궤적을 얻으려면 한 가지 가정이 필요합니다. 논문은 CL_t와 CS_t가 라운드와 무관한 상수 CL, CS라고 둡니다. 그런 다음 첫 전이에서 Acc_0, CL, CS를 추정해 2회차부터 5회차의 실제 곡선과 비교합니다. 하지만 가능한 모델·데이터셋 조합 전체나 RMSE·R²·신뢰구간은 보고하지 않았습니다. 따라서 이 결과를 모든 최신 agent에 통하는 장기 법칙으로 넓혀서는 안 됩니다.

적용 한계
Upp는 주어진 데이터·프롬프트·수정 절차가 만드는 점근적 고정점입니다. 빨리 수렴한다고 해서 정확도가 높다는 뜻은 아닙니다.

[scene-05]
논문이 분석하는 단위는 같은 응답을 다시 고치는 한 라운드입니다. 반면 실무 loop가 다루는 단위는 격리된 artifact experiment입니다. 그러므로 정답·오답을 challenger와 incumbent에 바로 대응시켜서는 안 됩니다. 사례별 pass/fail 기준이 있을 때만 CL_t와 CS_t를 계산할 수 있습니다. 연속형 metric 하나뿐이라면 metric delta·불확실성·guard·holdout을 직접 비교해야 합니다.

전환 규칙
candidate가 만든 변화와 evidence gate를 통과한 뒤의 system state 변화는 따로 봐야 합니다.

[scene-06]
공식 Autoresearch 예시에서는 prepare.py의 data·runtime utility·evaluator를 고정하고 train.py 하나만 바꿉니다. startup·compile을 제외한 5분 학습 뒤에는 낮을수록 좋은 val_bpb로 challenger를 비교합니다. 이 구조를 실무로 넓히려면 research contract, incumbent, isolated challenger, raw observation, verdict, append-only experiment ledger, derived memory를 별도 객체로 분리해 둬야 합니다. 그리고 KEEP 판정을 받은 challenger만 다음 incumbent가 되게 합니다.

실험 단위
Autoresearch형 loop의 한 번은 생각 한 번을 뜻하지 않습니다. 고정된 계약 아래 실행하고 되돌릴 수 있는 실험 한 건입니다.

[scene-07]
KEEP이면 challenger와 incumbent가 함께 전진합니다. DISCARD나 CRASH이면 incumbent는 그대로 두고 실패 증거만 ledger에 추가합니다. 이 구분을 먼저 지켜야 합니다. 그런 다음 proposer·executor·evaluator·controller의 경계를 나눠서 진단합니다. 한 trial의 timeout과 전체 campaign의 성공·안전·cycle·plateau·예산·human gate 종료도 서로 다른 시계로 관리해야 합니다. 그래야 마지막 candidate가 아니라 검증된 best-so-far를 반환할 수 있습니다.

시스템 보존
candidate가 실패하면 ledger는 바뀝니다. 하지만 gate를 통과하기 전에는 incumbent를 후퇴시키지 않습니다.

[scene-08]
loop policy를 쓸 때는 실제 goal과 proxy metric, mutable artifact와 frozen harness, trial budget과 campaign budget, raw observation과 score, experiment ledger와 derived memory를 각각 분리합니다. 여기에 KEEP·DISCARD·CRASH·rollback, 구조화된 stop reason, 고위험 external action의 human gate를 명시합니다. 이 구성을 갖추면 복구 이득과 훼손 손실이라는 논문의 렌즈를 실무의 보수적인 acceptance policy로 옮길 수 있습니다.

논문은 반복 횟수보다 정답 보존과 오답 복구의 균형을 먼저 보게 합니다.
실무에 적용할 때는 candidate의 전이와 system-after-gate의 전이를 따로 봐야 합니다.
좋은 agent loop는 많이 고치는 시스템이 아닙니다. 증거 없는 변경을 채택하지 않는 시스템입니다.

<!-- HUMANIZE-SUMMARY: 변경률 21.5% | 등급 A | S1 0건 | S2 0건 | 자체검증 6/6 통과 -->
