# Scene 6 와이어프레임 — 논문의 모형과 가장 가까운 실전 loop (Ralph loop)

이 문서는 self-correction 발표 덱 Scene 6의 재설계 와이어프레임이다.
`reports/autoresearch-agent-loop-mental-model-wireframe.md` §8(공식 Autoresearch 구조 지도)을
**의도적으로 대체**한다. 기존 §8의 내용(공식 사례 해부·범용 멘탈 모델)은 이후 장으로 이동하며,
그 재배치는 별도 세션에서 진행한다.

**대체 이유:** autoresearch는 frozen harness + 스칼라 `val_bpb` + 결정적 비교라는 거의 완벽한
외부 verifier를 갖춘 체제로, 외부 verifier 없는 intrinsic self-correction을 다룬 논문의 핵심
주제와 바로 잇기 어렵다. 논문의 모형에 구조적으로 가장 가까운 실전 loop인 Ralph loop를 먼저
보여 논문의 한계가 실무 구조로 상속되는 것을 확인한 뒤, 다음 장에서 그 한계를 구조로 돌파한
autoresearch를 보인다.

## 1. 장면의 메시지 (논증 순서)

1. **Ralph loop는 논문이 다룬 모형에 가장 가까운 실전 예시다.** 구조가 그렇기 때문이다 —
   같은 프롬프트를 매 바퀴 재투입(고정된 정책 = 논문의 정지 가정과 대응)하고, 판정자가
   agent 자신이며(intrinsic self-correction), 채택을 걸러줄 외부 gate가 없다.
2. **따라서 논문이 증명한 한계와 유의점을 구조적으로 가질 수밖에 없다**: 성패는 반복
   횟수가 아니라 복구·훼손의 균형이 결정하고, 훼손이 gate 없이 그대로 채택되며, 반복을
   늘려도 천장 Upp 위로 올라가지 못한다.
3. test backpressure는 부분 external verifier로 천장을 올리지만 완전한 gate는 아니다 →
   Ralph를 쓰려면 논문의 유의점이 곧 설계 체크리스트다 (다음 장: 한계를 구조로 돌파한
   autoresearch).

## 2. 시간 계약

14문장 × 8초 = 112초 발화 + 시각 40초 = **152초 (2:32)**.

기존 Scene 6 예산(240초) 대비 감소분 88초는 Part II 재배분에서 처리한다(별도 세션).
그때까지 덱 합계 계약은 잠정값(전체 1412초, practice 612초)으로 둔다.

## 3. 실제 화면 본문

```mdx
<Scene id="scene-06" part="practice" sentenceBudget={14} speechSeconds={112} visualSeconds={40}>
  <Title>
    <h2>논문의 모형과 가장 가까운 실전 loop</h2>
    <p>Ralph loop의 구조가 왜 논문의 한계를 그대로 물려받는지 본다.</p>
  </Title>

  <RalphFactsStrip badge="COMMUNITY PRACTICE" />

  <RalphLoopLab primary badge="ENGINEERING TRANSFER"
    backpressure={["none", "test"]} autoplay="two-modes" />

  <PersistentConclusion badge="PRACTICE">
    Ralph loop는 논문의 두 상태 모형에 가장 가까운 실전 구조다.
    그래서 천장과 훼손이라는 논문의 한계도 구조째 물려받는다.
  </PersistentConclusion>
</Scene>
```

## 4. RalphFactsStrip — 1차 출처 사실

| 구분 | 사실 |
| --- | --- |
| 정의 | `while :; do cat PROMPT.md \| claude ; done` — 같은 프롬프트 무한 재투입 |
| 상태 | 매 바퀴 컨텍스트 초기화, 지속되는 것은 파일과 git history뿐 |
| 단위 | 한 바퀴에 한 작업, 우선순위는 agent가 스스로 결정 |
| 판정 | agent 자기 평가 + 스스로 돌리는 compile·test·정적 분석("backpressure") |
| 문서화된 실패 | 컴파일 보상만 쫓는 placeholder 구현 · 깨진 codebase로 기상 → 수동 `git reset` |
| 없는 것 | incumbent/challenger 분리, acceptance gate, append-only ledger |
| 출처 | Geoffrey Huntley, 2025-07 (ghuntley.com/ralph) · 공식 Claude 플러그인 ralph-loop |

## 5. 구조 대응 표 ("가장 가깝다"의 근거)

| 논문 모형의 가정 | Ralph loop의 구조 |
| --- | --- |
| 같은 정책으로 매 라운드 재시도 (정지 가정, CS·CL 고정) | 같은 PROMPT.md를 매 바퀴 재투입, 컨텍스트 초기화 |
| 판정자 없음 — 모델이 스스로 고치고 스스로 망가뜨림 | agent 자기 평가가 유일한 판정, 외부 verifier 없음(기본형) |
| 이전 답이 다음 라운드의 입력 | working tree가 유일한 상태로 다음 바퀴에 상속 |
| 채택 gate 없음 — 전이가 그대로 상태가 됨 | KEEP/DISCARD 분리 없음, 훼손도 즉시 채택 |

**물려받는 한계 (논문 → Ralph 예측):** ① 성패는 반복 횟수가 아니라 복구/훼손 균형
② 훼손 채택 — "깨진 아침 → git reset"이 그 실물 ③ 천장 Upp — 궤적이 정체·진동
④ 자기평가 괴리 — COMPLETE 선언 vs 실제(placeholder 구현).

대응의 차이(주장 강도): 논문은 단일 문제의 답 교체, Ralph는 파일에 누적되는 다목적 작업 —
이 대응은 engineering-transfer 해석이며 동일 dynamics 주장이 아니다.

## 6. Primary SVG — `RalphLoopLab`

```text
┌───────────────┬──────────────────────────────────────────────┐
│  loop ring    │  궤적 무대: iteration × 충족 요구사항 수 (0–12)│
│               │                                              │
│  PROMPT.md    │  12 ┤        ╭────── believed (네온, 매끈)    │
│    │ 재투입    │     │      ╭─╯ ▒▒▒▒▒▒▒▒ ← 괴리 음영          │
│    ▼          │   7 ┤╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ 천장 Upp (해석)       │
│   agent       │     │ ╭──╮╱  ╭──╮  ✖ 후퇴(소등 전환)          │
│    │          │     │╭╯  ╰╮ ╭╯  ╰──── actual (들쭉날쭉)       │
│    ▼          │   0 └┴─┴─┴─┴─┴─┴─┴─┴─▶ iteration             │
│  working tree │                                              │
│  (유일한 상태) │  [backpressure: 없음 | test]  [▶ 재생]        │
└───────────────┴──────────────────────────────────────────────┘
status: believed 12/12 "COMPLETE 선언" · actual 7/12
```

- **좌측 loop ring**: 상시 회전하는 네온 dash(Scene 1·2 문법). PROMPT.md → agent →
  working tree 순환. 매 바퀴가 우측 궤적의 iteration 한 칸과 대응.
- **두 곡선**: `believed`(agent 자기 평가, 네온 점등, 매끈히 상승해 12/12에서 COMPLETE
  선언)와 `actual`(실제 충족 수, 들쭉날쭉). 후퇴 이벤트에서는 이미 점등된 요구사항 점이
  **소등 실루엣으로 전환** — 훼손이 그대로 채택되는 순간의 시각화.
- **천장 점선(Upp)**: `actual` 곡선이 정체하는 높이에 명시 표기 — Scene 5의 천장 선이
  실무 궤적 위에 재등장. `test` 모드에서 천장 선이 올라간다.
- **backpressure 토글 2단** (완전 gate는 의도적으로 없음 — 이 장의 요지):
  - `없음`: 괴리 최대(believed 12/12 vs actual 7/12), 후퇴 2회.
  - `test`: actual 천장 상승(10/12), 괴리 축소, 그러나 test가 못 보는 훼손으로 후퇴 1회
    잔존. 곡선은 crossfade로 연속 전환.
- 요구사항 총수 12는 Scene 7 fixture(`CRITERION_TRANSITION_EXAMPLE.totalCriteria = 12`)와
  일치. 궤적 수치는 synthetic 예시값(측정 아님).

## 7. 자동 재생 — 시각 40초

1. 8초 — loop ring 한 바퀴 강조: 같은 프롬프트 재투입, 파일만 남는 상태.
2. 12초 — `없음` 모드 궤적 재생: 괴리 음영 확장 + 후퇴 2회(소등 전환).
3. 4초 — COMPLETE 선언 vs actual 7/12 대비 정지.
4. 12초 — `test` 모드로 crossfade: 천장 상승·괴리 축소, 후퇴 1회 잔존.
5. 4초 — 결론 문장 고정 + 다음 장 gate 실루엣이 점선으로 예고.

## 8. 접근성 DOM 대체

- 두 곡선을 iteration별 표(believed / actual, 두 모드)로 제공, 후퇴·COMPLETE 선언
  이벤트는 ordered list.
- backpressure 토글은 44px 이상 + `aria-pressed`, SVG는 `<title>`/`<desc>` +
  `aria-labelledby`/`aria-describedby`.
- 모드 전환 결과 요약만 live region으로 알림.

## 9. 발표자 노트 (14문장)

- S06.01 실무에서 가장 단순한 agent loop는 같은 프롬프트를 무한히 다시 넣는 bash 한 줄입니다.
- S06.02 2025년 7월 Geoffrey Huntley가 이를 Ralph loop라 이름 붙였고 공식 Claude 플러그인으로도 구현되어 있습니다.
- S06.03 매 바퀴 컨텍스트는 초기화되고, 같은 프롬프트가 다시 들어가며, 남는 상태는 파일뿐입니다.
- S06.04 판정자도 agent 자신입니다 — 무엇이 끝났고 무엇이 좋아졌는지 스스로 판단하고, 걸러줄 gate가 없습니다.
- S06.05 같은 정책의 반복, 자기 판정, gate 없음 — 이 세 가지가 논문의 두 상태 모형이 둔 가정과 정확히 겹칩니다.
- S06.06 그래서 Ralph loop는 논문의 모형과 가장 가까운 실전 예시이고, 논문의 결론이 이 loop의 예측이 됩니다.
- S06.07 첫 번째 예측: 성패를 정하는 것은 반복 횟수가 아니라 복구와 훼손의 균형입니다.
- S06.08 두 번째 예측: 훼손이 gate 없이 채택됩니다 — 망가진 상태가 그대로 다음 바퀴의 출발점이 됩니다.
- S06.09 실제 운용 기록의 "아침에 깨진 codebase로 일어나 수동 git reset"이 바로 그 실물입니다.
- S06.10 세 번째 예측: 반복을 늘려도 천장이 있습니다 — 화면의 궤적이 천장 선 아래에서 정체하고 진동합니다.
- S06.11 판정자가 자신뿐이면 관측도 흔들립니다 — agent가 믿는 진행과 실제 충족이 벌어지고 COMPLETE 선언은 자기 평가일 뿐입니다.
- S06.12 test를 붙이면 부분 external verifier가 생겨 천장이 올라가고 괴리가 줄지만, test가 못 보는 훼손은 여전히 채택됩니다.
- S06.13 그러므로 Ralph loop를 쓴다면 논문의 한계와 유의점이 그대로 설계 체크리스트가 됩니다.
- S06.14 다음 장에서는 이 한계를 구조로 돌파한 공식 사례 autoresearch를 봅니다.

**컷 후보:** S06.02, S06.09 (역사·일화 문장 — 빼도 논리 유지).

## 10. 출처와 주장 강도

- **community-practice** (신규 provenance 종류): bash loop 정의, backpressure, 실패 양상 —
  [ghuntley.com/ralph](https://ghuntley.com/ralph/) (2025-07) + 공식 Claude 플러그인
  ralph-loop README가 직접 지원.
- **synthetic-example**: 궤적 수치(요구사항 12개, 후퇴 횟수·시점, 천장 높이)는 예시값이며
  측정치가 아니다.
- **engineering-transfer**: Ralph ↔ 논문 대응은 이 발표의 해석이며, 동일한 dynamics나
  인과효과를 주장하지 않는다.
