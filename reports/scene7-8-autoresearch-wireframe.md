# Scene 7·8 와이어프레임 — Ralph의 한계를 구조로 돌파한 autoresearch, 그리고 그 용법

이 문서는 self-correction 발표 덱 Scene 7·8의 재설계 와이어프레임이다.
`reports/autoresearch-agent-loop-mental-model-wireframe.md` §9(LoopControlWorkbench)와
§10(LoopPolicyCard)을 **의도적으로 대체**한다. Scene 6이 Ralph loop 장면으로
재설계되면서(`reports/scene6-ralph-loop-wireframe.md`) 남은 두 가지 부채를 함께 정산한다:

1. **서사 구멍** — autoresearch를 소개하던 구 Scene 6(구 §8 구조 지도)이 빠졌는데,
   Scene 7은 여전히 `val_bpb` replay 데이터를 설명 없이 전제한다. Scene 6 마지막 문장
   S06.14("다음 장에서는 이 한계를 구조로 돌파한 공식 사례 autoresearch를 봅니다")의
   핸드오프가 미이행 상태다.
2. **시간 부채** — Scene 6 축소로 회수된 88초가 미배분이라 덱이 잠정 1412초다.
   이 문서로 25분(1500초)을 복원한다.

**재설계 방향(사용자 결정, 2026-07-30):**

- **Scene 7 전면 재설계** — 장면 전체가 "autoresearch의 구조가 왜 Ralph loop에 비해
  개선된 구조인가"를 설명한다. autoresearch 소개는 별도 씬이 아니라 이 장면의
  도입부가 된다.
- **Scene 8 정비** — "autoresearch도 완벽하지 않다"는 주의와 함께, 주의해서 쓰는
  용법(loop policy card)으로 덱을 정리한다. LoopPolicyCard의 구조는 유지하고
  서사·스타일·기존 결함만 고친다.

## 1. 두 장면의 메시지

**Scene 7 (구조 돌파):** Scene 6이 보인 Ralph의 네 한계 — ① 훼손 채택(gate 없음)
② 자기평가 괴리(COMPLETE 선언 vs actual) ③ 후퇴와 천장 ④ 자의적 끝 — 는 구조의
결과였다. autoresearch는 Ralph에 없던 세 구조물(incumbent/challenger 분리,
acceptance gate, append-only ledger)에 bounded stopping을 더해 네 한계를 하나씩
막는다. 논문의 언어로: **gate는 system 수준 훼손을 0으로 눌러 CL을 1로 만드는
장치**이고, Scene 5가 "완전 acceptance gate는 천장을 없앤다"고 예고한 그 구조의
실제 동작 사례다.

**Scene 8 (용법):** 그 돌파는 구조의 승리이기 전에 verifier의 승리다 — 싸고
결정적이고 목표와 정렬된 스칼라 metric(`val_bpb`)이 있었기에 frozen harness도
gate도 가능했다. 이 전제가 없는 대부분의 실무로 옮길 때의 여섯 가지 주의를 말하고,
그 주의를 한 장의 loop policy card에 적는 용법으로 덱을 닫는다.

서사 연결: S06.14의 핸드오프를 Scene 7 도입부가 이행하고, Scene 5의
"CS 부스트 없이 훼손 차단만" 설계가 깔아 둔 KEEP/DISCARD 복선을 Scene 7의 gate가
회수한다. Scene 6 자동 재생 마지막 단계의 "gate 실루엣 점선 예고"는 Scene 7
ring의 점등된 gate 검문소로 완성된다.

## 2. 시간 계약 — 25분 복원

회수분 88초(= 11문장 × 8초)를 Scene 7에 7문장, Scene 8에 4문장으로 배분한다.

| Scene | 문장 | 발화 | 시각 | 합 | 비고 |
| --- | ---: | ---: | ---: | ---: | --- |
| scene-06 (기존 유지) | 14 | 112 | 40 | 152 | |
| scene-07 | 30 → **37** | 240 → **296** | 70 (유지) | 310 → **366** | 덱 최장 씬 |
| scene-08 | 15 → **19** | 120 → **152** | 30 (유지) | 150 → **182** | |
| **practice 합** | | | | 612 → **700** | 원 계약 복원 |
| **덱 전체** | 142 → **153** | 1136 → **1224** | 276 (유지) | 1412 → **1500** | 25:00 |

hard checkpoint: Part I 종료 700 / 전환 종료 800 / 전체 종료 **1500**.
시각 초는 두 씬 모두 유지하므로 docs.spec.ts의 scene-08 자동 재생 32초 타임아웃
계약은 그대로 성립한다.

## 3. Scene 7 — "돌파: Ralph의 한계를 구조로 막은 공식 사례"

### 3.1 실제 화면 본문

```mdx
<Scene id="scene-07" part="practice" sentenceBudget={37} speechSeconds={296} visualSeconds={70}>
  <Title>
    <h2>Ralph의 한계를 구조로 돌파한 공식 사례</h2>
    <p>autoresearch의 gate 구조가 훼손 채택·자기평가 괴리·후퇴·자의적 끝을 어떻게 막는지 본다.</p>
  </Title>

  <AutoresearchFactsStrip badge="OFFICIAL EXAMPLE" />   {/* OFFICIAL_EXAMPLE_FACTS 10행 재활용 */}

  <StructuralBreakthroughs />                            {/* 한계 4 ↔ 구조물 4 대응 표 */}

  <GateReplayLab primary badge="ENGINEERING TRANSFER"
    gate={["on", "off"]} autoplay />

  <PersistentConclusion badge="PRACTICE">
    gate는 system 수준 훼손을 0으로 눌러 CL을 1로 만든다.
    candidate의 실패는 ledger를 바꾸지만, incumbent를 후퇴시키지 않는다.
  </PersistentConclusion>
</Scene>
```

`AutoresearchFactsStrip`·`StructuralBreakthroughs`는 Scene 6의
`RalphFactsStrip`·`RalphCorrespondence`와 같은 문법으로 서사 컬럼
(`data-scene-prose`)에 렌더한다(lab당 1개 계약 유지).

### 3.2 AutoresearchFactsStrip — 1차 출처 사실

`loop-model.ts`의 `OFFICIAL_EXAMPLE_FACTS` 10행(goal/mutable/frozen/trial-budget/
metric/soft-constraint/baseline/decision/ledger/campaign-stop)을 그대로 재활용한다.
orphan인 `scene-06-loop-map.tsx`의 `OfficialExampleStrip` 마크업을 이관한 뒤 그
파일은 삭제한다. `campaign-stop` 행의 caveat 문구는 "Scene 7에서 bounded stopping으로
일반화"가 자기 자신을 가리키게 되므로 "이 장면 후반의 bounded stopping이 그 일반화"
취지로 갱신한다.

### 3.3 StructuralBreakthroughs — Scene 6과 짝을 이루는 대응 표

Scene 6 구조 대응 표(논문 가정 ↔ Ralph 구조)의 거울상. 4행:

| Ralph가 물려받은 한계 (Scene 6) | autoresearch의 구조물 |
| --- | --- |
| 훼손이 gate 없이 즉시 채택 | acceptance gate — 개선만 keep, 훼손은 discard + revert |
| 자기평가 괴리 — COMPLETE 선언 vs actual | frozen harness + 스칼라 metric — believed가 아니라 측정이 판정 |
| 후퇴·천장 — 궤적이 정체·진동 | incumbent/challenger 분리 — 검증된 개선에서만 교체되는 ratchet |
| 끝이 자기 선언 (깨진 아침 → git reset) | append-only ledger + bounded stopping — 구조화된 stop reason |

주장 강도: 이 대응은 engineering-transfer 해석이다(§7 출처 참조).

### 3.4 Primary SVG — `GateReplayLab`

```text
┌────────────────┬─────────────────────────────────────────────────┐
│   loop ring    │  궤적 무대: iteration × val_bpb (낮을수록 좋음)     │
│                │                                                 │
│  contract      │ 1.0050┤        ✕ discard c3d4e5f (소등 실루엣)     │
│   ↓ 가설        │       │       ╱ ╲    ⊘ crash d4e5f6g "측정 없음"  │
│  challenger    │ 0.9979┤ ●────╱   ╲  ╱                            │
│   ↓ 격리 실행    │       │  ╲       ╲╱   ← gate OFF 채택 궤적(소등)  │
│  harness 측정   │ 0.9932┤   ●━━━━━━━━━━━● incumbent 계단(네온, 단조) │
│   ↓            │       └┴────┴────┴────┴──▶ iteration 0..3        │
│ [GATE 검문소]■  │                                                 │
│   ↓ keep만 통과 │  [gate: ON | OFF(Ralph)]   [▶ 재생]              │
│  incumbent     │                                                 │
│   + ledger     │  status: incumbent b2c3d4e · best 0.9932        │
└────────────────┴─────────────────────────────────────────────────┘
```

- **좌측 loop ring**: Scene 6 ring과 같은 시각 문법(상시 회전 네온 dash, progress
  클록 공유 — 커서 1바퀴 = iteration 1칸, 중앙 카운터 `n / 4`). 단계 라벨은
  `LOOP_PHASES`(contract → incumbent → proposal → challenger → execution →
  verdict → ledger)를 축약해 재활용한다. **gate 검문소는 귀환 경로에 상시
  점등** — Scene 6에서 소등 점선(없음)/부분 점등(test)이던 그 검문소의 완성형.
- **궤적 무대**: y축이 `val_bpb`(낮을수록 좋음). 데이터는
  `CANONICAL_AUTORESEARCH_CAMPAIGN` 4행(baseline keep a1b2c3d 0.9979 → keep
  b2c3d4e 0.9932 → discard c3d4e5f 1.0050 → crash d4e5f6g 측정 없음) 그대로.
  candidate 시도는 점(keep 점등 green / discard 소등 실루엣 / crash ⊘ "측정
  없음"), **incumbent는 계단선**(네온 green, 검증된 개선에서만 내려가는 단조
  ratchet). believed/actual 이중 곡선은 없다 — 측정이 곧 사실이라는 것이
  Scene 6과의 시각적 대비다.
- **gate 토글 2단** (Scene 6 backpressure 토글의 짝):
  - `ON`(기본): 위 궤적. discard·crash 바퀴에서 ring 커서가 gate에 막혀 궤적에
    `차단` 마크, incumbent 계단은 흔들리지 않음.
  - `OFF`(Ralph counterfactual): 같은 네 시도가 걸러지지 않고 채택되어 채택
    궤적이 1.0050으로 튀고 crash 뒤 상태로 이어지는 진동 — Scene 6 궤적의
    재현. 소등 시각 언어(붉은 강조 금지), synthetic-example 라벨 명시.
  - 토글 시 Scene 6과 동일하게 캠페인을 3.6초로 재재생(정적 crossfade 아님).
- **부속 패널 2개** (lab 내부 secondary, 재생 단계에 맞춰 표시):
  - **전이 회계 패널**: `CRITERION_TRANSITION_EXAMPLE`(총 12 기준, incumbent
    통과 9, 보존 6·훼손 3·복구 1, candidate CL 6/9, verdict DISCARD,
    system-after-gate 9 유지). **totalCriteria 12는 Scene 6
    `RALPH_TOTAL_REQUIREMENTS`와 의도적으로 일치 — 값 변경 금지.**
    스칼라 하나(`val_bpb`)로는 CL/CS를 셀 수 없다는 전제 문구 포함.
  - **stop reason 패널**: 기존 stop mode를 축소 이관 — `determineStopReason`
    우선순위(safety/harness가 success보다 먼저), 토글·슬라이더 인터랙션 유지
    (44px + `aria-pressed`/`aria-valuetext` 계약 그대로).
- **raw drawer**: `rawLedgerRow`의 crash sentinel `0.000000`을 원형 보존, 화면
  표기는 "측정 없음" — 기존 e2e 계약(S07.07 → 새 S07.14) 유지.
- **폐기**: replay/diagnose/stop 3-탭 구조, `DIAGNOSTIC_CASES` 증상→고장층 6행
  표(고장 국소화 서사는 새 장면 범위 밖 — fixture 존치 여부는 구현 시 결정),
  `MODE_FOR_STEP` 자동 탭 전환.

### 3.5 자동 재생 — 시각 70초 (8단계)

1. 8초 — ring 한 바퀴 + contract 강조: 목표·mutable·frozen이 구조로 고정됨.
2. 10초 — iteration 1 keep: 측정 개선 → gate 통과 → incumbent 전진.
3. 10초 — iteration 2 discard: 훼손이 gate에 막힘, ledger에는 기록.
4. 8초 — iteration 3 crash: 측정 없음, incumbent 불변.
5. 12초 — gate `OFF` counterfactual 재생: 같은 시도가 채택돼 궤적 진동(Ralph 재현).
6. 8초 — 전이 회계 패널: candidate CL 6/9 vs system-after-gate 9/12 보호.
7. 10초 — stop reason 패널: COMPLETE 선언 대신 구조화된 종료.
8. 4초 — 결론 고정: incumbent 계단 + best-so-far 반환.

### 3.6 접근성 DOM 대체

- ledger 표 4행(challenger, `val_bpb`, memory, verdict, incumbent-after —
  crash는 "측정 없음") + raw drawer(sentinel 원형).
- gate ON/OFF 각각의 채택 궤적 표, 대응 표 4행, 전이 회계 표(스칼라 비활성
  사유 포함), stop 요약.
- 토글·핫스팟 44px 이상, SVG `<title>`/`<desc>` + aria 참조, live region은
  LabShell statusbar 1개만.

### 3.7 발표자 노트 (37문장)

- S07.01 앞 장 Ralph loop의 한계는 게으름이 아니라 구조의 결과였습니다 — 같은 정책의 반복, 자기 판정, gate 없음.
- S07.02 이번 장의 질문은 반대 방향입니다 — 구조를 바꾸면 그 한계가 실제로 사라지는가.
- S07.03 공식 사례가 karpathy의 autoresearch입니다 — nanoGPT의 train.py를 밤새 홀로 개선하는 overnight research loop입니다.
- S07.04 목표는 고정된 실행 시간 안에서 validation bits per byte, val_bpb를 낮추는 것 하나로 고정됩니다.
- S07.05 agent가 바꿀 수 있는 것은 train.py 하나뿐이고, 데이터와 evaluator가 담긴 prepare.py는 frozen harness로 잠급니다.
- S07.06 판정 규칙은 사람도 agent도 아닌 구조가 갖습니다 — 개선하면 keep, 같거나 나쁘면 discard와 revert, 실행 실패는 crash입니다.
- S07.07 모든 시도는 results.tsv ledger에 append되어 성공과 실패가 똑같이 기억되고 다음 제안의 memory가 됩니다.
- S07.08 Ralph에 없던 세 가지 — incumbent와 challenger의 분리, acceptance gate, append-only ledger — 가 정확히 이 지점에 들어와 있습니다.
- S07.09 첫 번째 돌파는 훼손 채택의 구조적 차단입니다.
- S07.10 재생 화면의 baseline은 수정하지 않은 train.py이고, 이를 통과한 revision이 비교 기준 incumbent가 됩니다.
- S07.11 첫 candidate는 learning rate를 올려 val_bpb를 낮췄고, gate는 keep을 선택해 incumbent가 전진합니다.
- S07.12 두 번째 candidate는 GELU 전환으로 metric이 나빠져 discard되고, 코드는 rollback되되 실패 기록은 ledger에 남습니다.
- S07.13 세 번째 candidate는 메모리 부족으로 실행조차 못 해 crash로 분류됩니다 — 유효한 측정이 없기 때문입니다.
- S07.14 공식 ledger는 crash를 영으로 기록하지만 화면에서는 최저 점수로 오해하지 않도록 측정 없음으로 표시합니다.
- S07.15 Ralph에서라면 이 훼손과 crash가 그대로 다음 바퀴의 출발점이 됐을 것입니다.
- S07.16 gate 토글을 꺼 보면 같은 네 시도가 걸러지지 않고 채택되어 궤적이 진동합니다 — 앞 장의 Ralph 궤적이 재현됩니다.
- S07.17 두 번째 돌파는 자기평가 괴리의 소거입니다 — 판정 근거가 agent의 believed가 아니라 frozen harness의 측정이기 때문입니다.
- S07.18 COMPLETE 선언 같은 자기 보고가 낄 자리가 없어, 앞 장에서 벌어졌던 believed와 actual 두 곡선이 하나로 합쳐집니다.
- S07.19 세 번째 돌파는 후퇴 없는 ratchet입니다 — incumbent는 검증된 개선에서만 교체되므로 system 궤적은 단조입니다.
- S07.20 campaign이 반환하는 것도 마지막 candidate가 아니라 검증된 best so far입니다.
- S07.21 논문의 언어로 옮기면 gate는 system 수준의 훼손을 0으로 눌러 CL을 1로 만드는 장치입니다.
- S07.22 수조 장면에서 본 완전 acceptance gate — 천장을 없애는 바로 그 구조가 여기서는 실제로 돌아갑니다.
- S07.23 이 등식을 전이 회계로 확인해 봅니다.
- S07.24 열두 기준 예시에서 candidate는 기존 통과 아홉 중 셋을 훼손하고 하나만 복구해 candidate 수준 CL은 9분의 6에 그칩니다.
- S07.25 gate가 이 candidate를 discard하면 채택된 system state는 그대로라 통과 아홉 개가 전부 보호됩니다.
- S07.26 생성 품질이 아니라 acceptance policy가 시스템의 실현 성능을 결정한다는 것이 이 표의 요지입니다.
- S07.27 단 이 회계에는 전제가 있습니다 — 기준별 통과와 실패 판정이 있어야 하며, val_bpb 같은 스칼라 하나로는 CL과 CS를 셀 수 없습니다.
- S07.28 네 번째 돌파는 끝의 구조화입니다.
- S07.29 Ralph의 끝은 agent의 COMPLETE 선언이었고, 공식 예시조차 사람이 멈출 때까지 돈다는 운영 정책을 씁니다.
- S07.30 실무 일반화에서는 한 trial의 timeout과 campaign 전체의 예산을 분리합니다.
- S07.31 그리고 success, safety, cycle, plateau, budget, human interrupt를 구조화된 stop reason으로 기록합니다.
- S07.32 여러 조건이 겹치면 안전과 harness 무결성이 성능 개선보다 먼저 평가됩니다.
- S07.33 종료할 때는 검증된 best so far와 남은 불확실성과 stop reason을 함께 반환합니다.
- S07.34 정리하면 Ralph의 네 한계 — 훼손 채택, 자기평가 괴리, 후퇴와 천장, 자의적 끝 — 이 구조물 하나씩으로 막혔습니다.
- S07.35 이 대응 역시 engineering transfer 해석입니다 — 공식 사례가 논문의 dynamics를 측정했다는 주장이 아닙니다.
- S07.36 그리고 이 구조 전체는 싸고 결정적이고 재현 가능한 외부 verifier 하나 위에 서 있습니다.
- S07.37 다음 장에서는 그 전제가 무너지는 대부분의 실무에서 이 구조를 어떻게 주의해서 옮길지 봅니다.

**컷 후보:** S07.02, S07.14, S07.29, S07.35 (수사·표기 규약·일화·주장 강도 문장 —
빼도 논리 유지).

## 4. Scene 8 — "용법: autoresearch도 만능이 아니다"

### 4.1 실제 화면 본문

```mdx
<Scene id="scene-08" part="practice" sentenceBudget={19} speechSeconds={152} visualSeconds={30}>
  <Title>
    <h2>autoresearch도 만능이 아니다 — 주의해서 쓰는 용법</h2>
    <p>돌파의 전제(verifier)를 확인하고, 여섯 주의를 loop policy 한 장에 적는다.</p>
  </Title>

  <CautionBand />                                        {/* 여섯 주의 — 서사 컬럼 */}

  <LoopPolicyCard primary mode="blank-plus-synthetic-example" />   {/* 구조 유지 */}

  <FinalTakeaway>
    1. 논문은 반복 횟수가 아니라 정답 보존과 오답 복구의 균형을 보게 한다.
    2. Ralph에서 autoresearch까지의 거리는 모델이 아니라 verifier와 gate라는 구조가 만들었다.
    3. 좋은 agent loop는 많이 고치는 시스템이 아니라 증거 없는 변경을 채택하지 않는 시스템이다.
  </FinalTakeaway>
</Scene>
```

### 4.2 CautionBand — 여섯 주의 (서사 컬럼, lab 아님)

1. metric은 목표의 대리 — proxy 상승 ≠ 목표 달성 (metric alignment).
2. 현실 verifier는 oracle이 아님 — 오탐·미탐을 따로 측정, 훼손 차단 완전성 감사.
3. CL·CS·천장은 집단 지표 — 개별 요청의 성패를 말해 주지 않음.
4. 손익분기 고정점은 순간 스냅샷 — 장기 수렴점으로 읽지 말 것.
5. gate는 훼손을 막을 뿐 탐색을 만들지 않음 — plateau·반복 제안은 proposer의 문제.
6. 외부 세계를 바꾸는 변경은 자동 keep 뒤에도 human gate.

(3·4번의 근거는 `reports/llm-self-correction-scaling-report-draft.md`의 집단 지표
한계·순간 손익분기점 문장 — 재설계에서도 반드시 보존해야 하는 주장 강도 제한이다.)

### 4.3 LoopPolicyCard 정비 목록 (구조 유지)

- **기존 결함 수정**: 구역은 실제 8개(goal/scope/budget/evidence/transition/
  memory/stop/owners)인데 주석·docstring·fallback 문구가 "일곱 구역"으로 남아
  있음(`loop-model.ts` LOOP_POLICY_SECTIONS docstring, `scene-08-policy-card.tsx`
  주석·fallback) → "여덟 구역"으로 통일. 8번째 구역(owners, y 407~448)이 y 446
  footnote와 겹침 → viewBox 높이 확장 또는 footnote 이동으로 해소.
- **스타일 정합**: 활성 구역 강조를 덱 공통 네온 언어(다층 feGaussianBlur glow,
  아웃라인 중심, 내부 ~8% 틴트)로. 구역 전환은 crossfade(한 프레임 점프 금지).
- **유지**: blank/synthetic 2탭, `fill-example` 단계 자동 synthetic 전환, YAML
  복사 + 토스트, 재생 30초(8구역 16초 → synthetic 채움 10초 → 세 문장 4초),
  synthetic checkout 예시("실제 운영 수치가 아니다" 문구 포함).
- FinalTakeaway 3문장은 위 4.1 문안으로 교체(`data-final-takeaways` 3 li 계약 유지).

### 4.4 발표자 노트 (19문장)

- S08.01 마지막 장은 경고에서 시작합니다 — autoresearch의 돌파는 구조의 승리이기 전에 verifier의 승리입니다.
- S08.02 싸고 결정적이고 목표와 정렬된 스칼라 metric — 이 전제를 갖춘 실무 문제는 많지 않습니다.
- S08.03 첫 번째 주의: metric은 목표의 대리입니다 — val_bpb가 내려가도 실제 목표가 좋아졌는지는 별도 확인이 필요합니다.
- S08.04 proxy만 좋아지고 gold 기준이 나빠지는 metric alignment 실패는 gate가 있어도 잡히지 않습니다.
- S08.05 두 번째 주의: 현실의 verifier는 oracle이 아닙니다 — 오탐과 미탐을 따로 측정하고 훼손 차단이 완전하다는 가정을 감사해야 합니다.
- S08.06 세 번째 주의: CL과 CS와 천장은 같은 평가 집합의 집단 지표라 개별 요청의 성패를 말해 주지 않습니다.
- S08.07 네 번째 주의: 손익분기 판단에 쓰는 고정점은 장기 수렴점이 아니라 그 순간의 스냅샷입니다.
- S08.08 다섯 번째 주의: gate는 훼손을 막을 뿐 탐색을 만들어 주지 않습니다 — plateau와 반복 제안은 여전히 proposer의 문제입니다.
- S08.09 여섯 번째 주의: 외부 세계를 바꾸는 변경은 자동 keep 뒤에도 사람의 승인을 거쳐야 합니다.
- S08.10 이 주의들을 머리로 기억하는 대신 한 장의 loop policy card에 적어 둡니다.
- S08.11 첫 구역에는 실제 목표와 성공 조건을 적고, metric이 목표의 대리라는 사실을 명시합니다.
- S08.12 바꿀 artifact와 frozen harness를 분리하고, 한 trial과 campaign 전체의 예산을 따로 둡니다.
- S08.13 증거 구역에는 raw observation과 주 metric과 불확실성과 guard와 holdout을 적습니다.
- S08.14 채택 구역에는 keep과 discard와 crash와 rollback의 정확한 조건을 적습니다.
- S08.15 ledger와 memory를 구분하고, 성공·안전·정체·예산·human gate의 중단 규칙과 네 역할의 책임 분리가 뒤를 잇습니다.
- S08.16 synthetic 예시로 채워 보면 빈 구역이 곧 그 loop의 위험 목록이 됩니다.
- S08.17 논문은 반복 횟수가 아니라 정답 보존과 오답 복구의 균형을 보게 합니다.
- S08.18 Ralph에서 autoresearch까지의 거리는 모델이 아니라 verifier와 gate라는 구조가 만들었습니다.
- S08.19 좋은 agent loop는 많이 고치는 시스템이 아니라 증거 없는 변경을 채택하지 않는 시스템입니다.

**컷 후보:** 없음 — 결론 Scene이므로 이전 Scene의 컷 후보를 사용한다(기존 규약 유지).

## 5. 코드·fixture 재배치 계획

- `scene-06-loop-map.tsx`(orphan): `OfficialExampleStrip` 마크업을
  `AutoresearchFactsStrip`으로 이관 후 **삭제**. `AutoresearchLoopMap`은 폐기
  (세 층/네 객체 지도는 새 서사에 없음 — ring 단계 라벨로만 압축 계승).
- `loop-model.ts`:
  - 유지: `OFFICIAL_EXAMPLE_FACTS`(caveat 문구만 갱신), `LOOP_PHASES`(ring 라벨),
    `CANONICAL_AUTORESEARCH_CAMPAIGN`, `CRITERION_TRANSITION_EXAMPLE`(**12 고정** —
    Scene 6 `RALPH_TOTAL_REQUIREMENTS`와 결합), `TELEMETRY_SAMPLE`(raw drawer),
    `determineStopReason`·`StopInputs`, `foldCampaign`.
  - 신설: gate `OFF` counterfactual 채택 궤적(4 iteration, synthetic-example).
  - 화면 제외: `DIAGNOSTIC_CASES`(fixture 존치 여부는 구현 시 결정).
- provenance: 미사용으로 남아 있던 `official-autoresearch-example` 배지를
  facts strip·replay 데이터에 사용. counterfactual 궤적·전이 회계는
  `synthetic-example`, Ralph↔autoresearch 대응·bounded stopping·policy card는
  `engineering-transfer`.
- `page.mdx`: 씬 7·8 본문·콜아웃 교체. 하단 출처 밴드의 autoresearch
  README·program.md 항목은 이제 근거가 실제 사용되므로 유지.

## 6. 계약 변경 목록 (구현 시 함께 갱신)

- `presenter-notes.ts`: S07 37문장·S08 19문장 교체, blueprints
  scene-07 `{speech 296, visual 70}`·scene-08 `{speech 152, visual 30}`,
  cutCandidates `{scene-07: [S07.02, S07.14, S07.29, S07.35], scene-08: []}`,
  `PART_TOTAL_SECONDS.practice = 700`, `HARD_CHECKPOINTS` 전체 종료 1500,
  `TOTAL_SENTENCE_BUDGET 153 / TOTAL_SPEECH_SECONDS 1224 / TOTAL_VISUAL_SECONDS
  276 / TOTAL_DECK_SECONDS 1500`, "잠정 계약" 주석 2곳 제거.
  (이 파일은 모듈 로드 시 timing assertion이 throw하므로 반드시 한 커밋에서 동시 갱신.)
- `tests/deck-contracts.spec.ts`: sentenceBudget `[8,21,19,25,10,14,37,19]`,
  visualSeconds 유지 `[16,32,28,40,20,40,70,30]`, 합계 153/1224/276/1500,
  part `{paper 700, bridge 100, practice 700}`, checkpoint `[700, 800, 1500]`,
  expectedCuts 갱신. scene 7 모델 계약 4건(fold incumbent 체인·bestSoFar·
  crash sentinel·stop 우선순위·전이 항등식)은 fixture 불변이므로 그대로 유효.
- `tests/docs.spec.ts`:
  - 덱 계약: `data-total-seconds` 1500, `data-speech-seconds` 1224,
    `[data-presenter-note]` 153, sceneNotes `[8,21,19,25,10,14,37,19]`.
  - 씬 7 테스트 재작성: ledger 4행·"측정 없음"·raw drawer `0.000000` 계약은
    유지하고, 3-탭 단언 대신 gate ON/OFF 토글(OFF → counterfactual 채택 궤적
    표시), 전이 회계 "incumbent 보호" 문구, stop 패널(plateau End → PLATEAU,
    safety → SAFETY_VIOLATION) 단언으로 교체.
  - 씬 8 테스트: 기존 단언(synthetic YAML·takeaway 3 li·복사 토스트) 유지 +
    "여덟 구역"·CautionBand 존재 단언 추가. 자동 재생 32초 타임아웃 계약은
    visual 30초 유지로 그대로.
  - 씬 6 테스트 불변(fixture 12 결합 유지 확인).
- 공통 계약 유지: 씬 수 8, lab당 live region 1개·fallback 1개, SVG
  `<title>`/`<desc>`·aria, 44px 핫스팟, 콘솔 에러 0, 390px 오버플로우 금지.

## 7. 출처와 주장 강도

- **official-autoresearch-example**: facts strip 10행, replay 4행(`results.tsv`
  illustrative 값), crash sentinel 규약 — karpathy/autoresearch README·program.md가
  직접 지원.
- **community-practice**: Ralph 쪽 대응 근거는 Scene 6 출처(ghuntley.com/ralph +
  공식 ralph-loop 플러그인)를 그대로 참조.
- **synthetic-example**: gate OFF counterfactual 궤적, 12기준 전이 회계, checkout
  policy 예시 — 측정치가 아닌 예시값.
- **engineering-transfer**: Ralph↔autoresearch 구조 대응, "gate가 CL을 1로
  만든다"는 논문 언어 번역, bounded stopping, policy card — 이 발표의 해석이며
  공식 사례가 논문의 dynamics를 측정했다는 주장이 아니다.
- 논문 쪽 한계 문장(집단 지표·순간 손익분기점)은
  `reports/llm-self-correction-scaling-report-draft.md`의 명시적 제한을 따르며
  Scene 8 CautionBand에 보존된다.
