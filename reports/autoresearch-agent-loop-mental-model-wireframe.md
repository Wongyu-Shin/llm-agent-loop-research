---
title: "LLM 자기수정을 위한 확률적 추론 스케일링 이론"
titleEn: "A Probabilistic Inference Scaling Theory for LLM Self-Correction"
subtitle: "논문의 전이 모형에서 Autoresearch형 agent loop의 운영 원칙까지"
artifact: "greenfield MDX web app wireframe"
audience: "4~10년차 웹 프런트엔드·백엔드 소프트웨어 엔지니어"
duration: "25:00"
language: "ko"
status: "paper-first wireframe draft"
---

# LLM 자기수정을 위한 확률적 추론 스케일링 이론

*A Probabilistic Inference Scaling Theory for LLM Self-Correction*

> 논문의 전이 모형에서 Autoresearch형 agent loop의 운영 원칙까지

이 문서는 먼저 논문이 실제로 정의하고 검증한 내용을 설명한 뒤, 그 멘탈 모델을 실무의 Autoresearch형 loop에 옮길 때 유지할 것과 버릴 것을 분리하는 25분 발표용 MDX(Markdown·JSX 결합 형식) 와이어프레임이다.

발표의 서사 계약은 다음과 같다.

```text
Part I  논문 이해             11:40
Part II로 건너가는 전환        1:40
Part II Autoresearch 적용      11:40
                              ─────
전체                          25:00
```

핵심 결론도 두 단계로 나눈다.

> **논문의 결론:** 반복 자기수정의 성패는 오답 복구의 유입과 기존 정답 훼손의 유출 사이의 균형으로 결정된다.

> **실무 적용의 결론:** Autoresearch형 loop는 이 회계 원리를 candidate의 반복 생성에 직접 대입하는 대신, incumbent 보호·외부 검증·keep/discard·ledger·중단을 설계하는 진단 렌즈로 사용해야 한다.

## 0. 개편 원칙

### 0.1 서사 경계

1. Scene 1부터 Scene 4까지는 원 논문의 질문, 가정, 식, 실험, 주장 한계만 설명한다.
2. Scene 5에서 처음으로 논문의 모형과 Autoresearch형 loop 사이의 대응과 비대응을 선언한다.
3. Scene 6부터 Scene 8까지는 공식 autoresearch 사례와 범용 실무 loop의 구조를 구분해 설명한다.
4. 공식 구현의 사실과 이 발표가 제안하는 엔지니어링 일반화는 화면에서 서로 다른 label을 사용한다.
5. 논문의 정지 전이 모형을 adaptive agent policy의 장기 수렴 법칙으로 일반화하지 않는다.

### 0.2 분석 단위

| 구간 | 분석 단위 | 관찰 상태 | 선택 주체 |
| --- | --- | --- | --- |
| Part I | 같은 응답의 자기수정 라운드 | 정답 또는 오답 | 논문 실험 절차 |
| Part II | 격리된 artifact experiment | challenger와 incumbent | external harness와 controller |

Part I의 `정답→정답`, `정답→오답`, `오답→정답`, `오답→오답` 전이를 설명하기 전에 Part II의 keep/discard를 끌어오지 않는다. Part II에서는 반대로 binary correctness가 없는 연속형 metric에 `CL_t/CS_t`를 억지로 정의하지 않는다.

### 0.3 표기 보존 원칙

- 논문의 기호명은 원문 그대로 `a_{i,t}`, `Acc_t`, `Acc_0`, `CL_t`, `CS_t`, `CL`, `CS`, `Upp`, `α`를 사용한다.
- 라운드별 전이율을 설명할 때는 `CL_t`, `CS_t`를 쓰고, 전이율이 라운드와 무관한 상수라는 가정 뒤에만 `CL`, `CS`를 쓴다.
- 장면의 진행 방향 때문에 식의 인덱스를 재배열할 때는 원식의 번호와 재인덱싱 방향을 바로 옆에 밝힌다.
- 한국어 설명인 `정답 보존율`, `오답 복구율`, `정확도 수렴 상한`, `수렴 계수`는 뜻풀이이며 원문 기호를 대체하지 않는다.
- 논문 기호를 더 짧은 기호나 ASCII 이름으로 바꾸지 않는다.
- 실무 일반화에는 새 단문자 별칭을 만들지 않고 객체의 풀네임을 사용한다.
- `LLM`, `MDX`, `SVG`, `DOM`, `GPU`, `VRAM`, `RMSE`, `R²`처럼 논문명·표준 기술명·통용 측정명에 속하는 약어는 로컬 별칭과 구분한다.

## 1. 발표 시간 예산 계약

### 1.1 계산 규칙

발표자 노트 한 문장을 평균 8초에 낭독한다고 가정한다.

```text
발화 시간 = 발표자 노트 문장 수 × 8초
전체 시간 = 발화 시간 + 시각화 관찰·조작·장면 전환 시간

150문장 × 8초 = 1,200초
시각화·전환 예산 = 300초
전체 예산 = 1,500초 = 25분
```

발표자 노트의 각 bullet은 실제로 낭독할 한 문장이다. `visualSeconds`에는 수식이나 도표를 말없이 읽는 시간, SVG(Scalable Vector Graphics) 자동 재생, 사용자 조작, Part 전환이 포함되며 발화를 중복 배정하지 않는다.

### 1.2 장면별 고정 예산

| Part | Scene | 화면 질문 | 노트 문장 | 발화 | 시각·전환 | 장면 합계 | 누적 |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| I | 1 | 논문은 무엇을 묻는가 | 8 | 1:04 | 0:16 | 1:20 | 1:20 |
| I | 2 | 자기수정을 어떤 두 상태 전이로 줄였는가 | 21 | 2:48 | 0:32 | 3:20 | 4:40 |
| I | 3 | 기대를 충족하는 조건은 얼마나 넓은가 | 19 | 2:32 | 0:28 | 3:00 | 7:40 |
| I | 4 | 논문은 무엇을 어디까지 검증했는가 | 25 | 3:20 | 0:40 | 4:00 | 11:40 |
| 전환 | 5 | 논문에서 실무로 무엇을 옮길 수 있는가 | 10 | 1:20 | 0:20 | 1:40 | 13:20 |
| II | 6 | Autoresearch형 loop는 무엇을 고정하고 바꾸는가 | 22 | 2:56 | 1:04 | 4:00 | 17:20 |
| II | 7 | keep·discard·crash와 중단은 어떻게 상태를 통제하는가 | 30 | 4:00 | 1:10 | 5:10 | 22:30 |
| II | 8 | 실무 loop policy를 어떻게 한 장에 명세하는가 | 15 | 2:00 | 0:30 | 2:30 | 25:00 |
|  | **합계** |  | **150** | **20:00** | **5:00** | **25:00** |  |

### 1.3 Part별 합계

| 구간 | 문장 | 발화 | 시각·전환 | 합계 |
| --- | ---: | ---: | ---: | ---: |
| Part I · 논문 이해 | 73 | 9:44 | 1:56 | 11:40 |
| 전환 · 적용 경계 | 10 | 1:20 | 0:20 | 1:40 |
| Part II · Autoresearch 적용 | 67 | 8:56 | 2:44 | 11:40 |
| **전체** | **150** | **20:00** | **5:00** | **25:00** |

### 1.4 리허설 보정

```text
실측 전체 시간 = 150 × 실측 평균 문장 초 + 300
허용 문장 수 = floor((1,500 - 300) / 실측 평균 문장 초)
```

| 평균 문장 시간 | 예상 전체 | 조치 |
| ---: | ---: | --- |
| 7.5초 | 23:45 | 수식·SVG 관찰 시간을 최대 75초까지 늘린다 |
| 8.0초 | 25:00 | 현재 예산을 유지한다 |
| 8.5초 | 26:15 | 9문장을 Scene별 컷 후보 순서로 제외한다 |
| 9.0초 | 27:30 | 17문장을 줄이고 핵심 식과 최종 policy는 보존한다 |

Part I의 시간이 넘었다고 Part II를 빠르게 읽지 않는다. 각 Scene의 컷 후보를 사용하고, Part I의 주장 한계와 Part II의 적용 경계는 컷하지 않는다.

## 2. 웹앱 전역 구조

### 2.1 페이지 골격

```mdx
<PaperToPracticeDeck
  totalSeconds={1500}
  sentenceSeconds={8}
  parts={[
    { id: "paper", label: "Part I · 논문 이해", seconds: 700 },
    { id: "bridge", label: "전환 · 적용 경계", seconds: 100 },
    { id: "practice", label: "Part II · Autoresearch 적용", seconds: 700 }
  ]}
  modes={["발표", "읽기"]}
>
  <DeckTopBar
    titleKo="LLM 자기수정을 위한 확률적 추론 스케일링 이론"
    titleEn="A Probabilistic Inference Scaling Theory for LLM Self-Correction"
    progress="part + scene + elapsed + remaining + drift"
  />

  <main>
    <Part id="paper">
      <Scene01 />
      <Scene02 />
      <Scene03 />
      <Scene04 />
    </Part>
    <PartBoundary />
    <Part id="bridge">
      <Scene05 />
    </Part>
    <Part id="practice">
      <Scene06 />
      <Scene07 />
      <Scene08 />
    </Part>
  </main>

  <PresenterConsole />
</PaperToPracticeDeck>
```

### 2.2 전역 내비게이션

```text
┌────────────────────────────────────────────────────────────────────┐
│ Part I · 논문 이해  [●●●○] │ 전환 [○] │ Part II · 적용 [○○○]      │
│ Scene 03 / 08          06:14 elapsed          −00:06 drift          │
└────────────────────────────────────────────────────────────────────┘
```

- Part I은 청록색, 전환은 금색, Part II는 남색을 사용한다.
- Scene 번호와 함께 `논문`, `전환`, `적용` label을 항상 표시한다.
- 논문 직접 주장에는 `PAPER`, 발표의 해석에는 `INTERPRETATION`, 구현 권고에는 `PRACTICE` badge를 붙인다.
- 발표 모드에서는 한 Scene만 viewport를 채우고, 읽기 모드에서는 모든 Scene과 발표자 노트를 연속 문서로 보여 준다.
- 자동 재생은 viewport 최초 진입 시 한 번만 실행하고, 사용자 조작 또는 reduced-motion 설정 시 즉시 정지한다.

### 2.3 공통 접근성

- 모든 SVG는 장식용 렌더링으로 두고 동일한 수치와 상태를 실제 DOM(Document Object Model) table 또는 ordered list로 제공한다.
- 색과 badge만으로 출처 층을 구분하지 않고 `논문`, `해석`, `실무 권고` 텍스트를 병기한다.
- Play, Pause, Step, Replay, Reset을 keyboard로 조작할 수 있게 한다.
- live region은 수식 slider의 모든 중간값을 읽지 않고 verdict, net change sign, stop reason만 알린다.
- `prefers-reduced-motion`에서는 최종 상태와 단계 버튼을 먼저 보여 준다.

## Part I. 논문을 먼저 이해한다

## 3. Scene 1 — 논문은 “다시 생각하면 언제 좋아지는가”를 묻는다

**시간 계약:** 8문장 × 8초 = 64초, 시각·전환 16초, 합계 1분 20초.

### 3.1 실제 화면 본문

```mdx
<Scene
  id="scene-01"
  part="paper"
  sentenceBudget={8}
  speechSeconds={64}
  visualSeconds={16}
  totalSeconds={80}
>
  <BilingualPaperTitle>
    <h1>LLM 자기수정을 위한 확률적 추론 스케일링 이론</h1>
    <p lang="en">
      A Probabilistic Inference Scaling Theory for LLM Self-Correction
    </p>
  </BilingualPaperTitle>

  <PaperQuestion>
    같은 모델이 같은 답을 반복해서 수정할 때,
    정확도는 왜 상승하기도 하고 정체하거나 하락하기도 하는가?
  </PaperQuestion>

  <FlowPreview
    left="오답 → 정답 · 복구 유입"
    right="정답 → 오답 · 훼손 유출"
    autoplaySeconds={8}
  />

  <PersistentConclusion badge="PAPER">
    반복 횟수만으로는 개선 방향이 결정되지 않는다.
  </PersistentConclusion>
</Scene>
```

### 3.2 텍스트 와이어프레임

```text
┌──────────────────────────────────────────────────────────────┐
│ LLM 자기수정을 위한 확률적 추론 스케일링 이론                │
│ A Probabilistic Inference Scaling Theory for                 │
│ LLM Self-Correction                                          │
│                                                              │
│              같은 답을 더 고치면 더 좋아질까?                │
│                                                              │
│     오답 ── 복구 ──▶ 정답     정답 ── 훼손 ──▶ 오답          │
│                                                              │
│ [PAPER] 반복 횟수만으로는 개선 방향이 결정되지 않는다.       │
└──────────────────────────────────────────────────────────────┘
```

16초 시각 예산은 제목과 질문 정지 4초, 두 흐름 자동 재생 8초, 결론 정지 4초로 나눈다.

### 3.3 발표자 노트

<PresenterNotes scene="01" sentenceBudget={8} speechSeconds={64} visualSeconds={16}>

- S01.01 오늘 먼저 살펴볼 논문은 LLM이 답을 반복해서 고칠 때 정확도가 어떻게 변하는지를 확률 모형으로 설명합니다.
- S01.02 여기서 scaling은 모델을 더 크게 학습하는 일이 아니라 추론 시점의 수정 라운드를 늘리는 일을 뜻합니다.
- S01.03 흔한 직관은 다시 생각할 기회를 주면 답이 계속 좋아질 것이라는 기대입니다.
- S01.04 그러나 실제 자기수정에서는 틀린 답이 맞아지는 동시에 맞던 답이 틀어질 수 있습니다.
- S01.05 따라서 반복 횟수만으로는 다음 라운드의 정확도가 오를지 내릴지 결정할 수 없습니다.
- S01.06 논문은 오답에서 정답으로 들어오는 흐름과 정답에서 오답으로 빠져나가는 흐름을 따로 측정합니다.
- S01.07 그리고 두 흐름을 하나의 전이식으로 묶어 여러 라운드의 정확도 궤적을 설명합니다.
- S01.08 핵심 명제는 자기수정의 순효과가 복구 이득과 훼손 손실의 차이로 정해진다는 것입니다.

</PresenterNotes>

**컷 후보:** `S01.06`을 제외하고 FlowPreview 정지 시간을 8초 늘릴 수 있다.

## 4. Scene 2 — 자기수정을 두 상태 전이로 줄인다

**시간 계약:** 21문장 × 8초 = 168초, 시각·전환 32초, 합계 3분 20초.

### 4.1 실제 화면 본문

```mdx
<Scene
  id="scene-02"
  part="paper"
  sentenceBudget={21}
  speechSeconds={168}
  visualSeconds={32}
  totalSeconds={200}
>
  <Title>
    <h2>두 조건부 확률로 다음 정확도를 회계한다</h2>
    <p>정답 보존율 CL_t와 오답 복구율 CS_t를 분리한다.</p>
  </Title>

  <PaperScopeBand
    included="같은 모델 · 이전 답 재검토 · 외부 정보 없는 intrinsic self-correction"
    excluded="검색 · 코드 실행 · 사람 피드백 · tool-using agent 전체"
  />

  <TwoStateTransitionLab
    primary
    initialAccuracy={0.7}
    initialConfidenceLevel={0.9}
    initialCritiqueScore={0.4}
    autoplay="one-transition"
  />

  <PersistentConclusion badge="PAPER">
    다음 정확도는 살아남은 정답과 새로 복구된 정답의 합이다.
  </PersistentConclusion>
</Scene>
```

### 4.2 논문의 범위

| 포함 | 직접 포함하지 않음 |
| --- | --- |
| 추론 시점에 같은 답을 여러 라운드 수정 | 모델 parameter scaling |
| 같은 모델의 intrinsic self-correction | 검색·코드 실행·사람 피드백이 있는 일반 Agent |
| 외부 정답 판정으로 라운드별 정확도 측정 | 모델이 말한 confidence를 그대로 채점 |
| 성공·실패의 두 상태 | latency·비용·안전·외부 state의 다차원 효용 |

이 범위가 좁기 때문에 두 상태 모형을 명확하게 쓸 수 있다. 동시에 검색이나 도구 관찰이 추가되는 절차에는 이 모형을 그대로 대입할 수 없다.

### 4.3 두 상태와 회계식

논문은 라운드 `t`의 전체 정확도를 `Acc_t`로 표기한다.

| 기호 | 발표에서 부를 이름 | 조건부 의미 |
| --- | --- | --- |
| `CL_t` | 정답 보존율 | `P(pass at t+1 | pass at t)` |
| `CS_t` | 오답 복구율 | `P(pass at t+1 | fail at t)` |

논문의 원래 명칭은 Confidence Level과 Critique Score이지만, 둘은 모델이 텍스트로 출력한 자신감이나 critique 품질 점수가 아니다. 외부 정답 판정 뒤 사례 집합에서 계산한 전이확률이다.

논문 Eq. 6의 `t-1→t` 전이를 화면 진행 방향인 `t→t+1`로 재인덱싱하면 다음과 같다.

```text
Acc_{t+1} = Acc_t × CL_t + (1 - Acc_t) × CS_t
            └ 보존된 정답 ┘     └ 새로 복구된 정답 ┘
```

### 4.4 Primary SVG — `TwoStateTransitionLab`

#### 화면 구조

```text
입력 population: 100개

현재 정답 Acc_t = 70                       현재 오답 1-Acc_t = 30
┌────────────────────┐                    ┌────────────────────┐
│ 정답 70            │                    │ 오답 30            │
└──────┬─────────────┘                    └──────┬─────────────┘
       │ CL_t=.90                                │ CS_t=.40
       ├── 정답 유지 63                          ├── 정답 복구 12
       └── 오답 훼손  7                          └── 오답 유지 18

다음 정답 Acc_{t+1} = 63 + 12 = 75
```

#### 입력

- `Acc_t`: 0에서 1 사이 slider.
- `CL_t`: 0에서 1 사이 slider.
- `CS_t`: 0에서 1 사이 slider.
- `population`: 100 또는 1,000으로 바꾸되 확률값은 동일하게 유지.
- `보기`: count, probability, 2×2 transition table.

#### 출력

- 보존 정답 `Acc_t × CL_t`.
- 훼손 정답 `Acc_t × (1 - CL_t)`.
- 복구 정답 `(1 - Acc_t) × CS_t`.
- 잔여 오답 `(1 - Acc_t) × (1 - CS_t)`.
- 다음 정확도 `Acc_{t+1}`.

#### 자동 재생과 32초 시각 예산

1. 8초 동안 ScopeBand의 포함과 제외를 좌우로 읽는다.
2. 16초 동안 100개 점이 네 전이 셀로 이동한다.
3. 4초 동안 두 정답 셀이 합쳐져 `Acc_{t+1}`이 되는 모습을 보여 준다.
4. 4초 동안 다음 Scene의 수렴 지도로 전환한다.

#### 항상 보이는 결론

> 정확도 변화는 복구만이 아니라 보존과 훼손을 함께 세어야 보인다.

#### 접근성 DOM 대체

- slider마다 현재 값, 최소, 최대, step을 label에 포함한다.
- 네 전이 셀을 `현재 상태 / 다음 상태 / count / probability` 표로 제공한다.
- 식을 MathML 또는 읽을 수 있는 텍스트 `다음 정확도는 현재 정확도 곱하기 CL_t 더하기 현재 오답률 곱하기 CS_t`로 제공한다.
- slider 조작 중에는 live region을 갱신하지 않고 pointer release 또는 keyboard commit 때 다음 정확도만 알린다.

### 4.5 발표자 노트

<PresenterNotes scene="02" sentenceBudget={21} speechSeconds={168} visualSeconds={32}>

- S02.01 논문의 직접적인 연구 대상은 같은 모델이 외부 정보 없이 자신의 이전 답을 다시 검토하는 intrinsic self-correction입니다.
- S02.02 각 라운드에서는 이전 응답을 같은 수정 절차에 다시 넣어 다음 응답을 만듭니다.
- S02.03 검색 결과와 코드 실행 결과와 사람의 피드백처럼 새로운 관측이 들어오는 절차는 직접 다루지 않습니다.
- S02.04 따라서 이 연구의 inference scaling은 학습 파라미터나 모델 크기를 키우는 scaling과 구분해야 합니다.
- S02.05 분석 대상은 매 응답을 정답 또는 오답으로 판정할 수 있는 과제입니다.
- S02.06 이 판정에는 모델의 자기평가가 아니라 정답표나 테스트처럼 외부에서 확인한 기준이 필요합니다.
- S02.07 유용성과 안전성과 문체를 함께 보는 장문 산출물은 이 두 상태만으로 충분히 표현되지 않습니다.
- S02.08 논문은 라운드 t에서 전체 응답 중 정답인 비율을 Acc_t로 표기합니다.
- S02.09 CL_t는 현재 정답인 응답이 이번 라운드에서 수정된 뒤에도 정답으로 남을 조건부 확률입니다.
- S02.10 원래 명칭은 Confidence Level이지만 모델이 말로 보고한 자신감 점수를 뜻하지 않습니다.
- S02.11 CS_t는 현재 오답인 응답이 이번 라운드에서 수정된 뒤 정답으로 바뀔 조건부 확률입니다.
- S02.12 원래 명칭은 Critique Score이며 여기서는 의미를 드러내기 위해 오답 복구율로 읽습니다.
- S02.13 두 상태에는 정답에서 정답과 정답에서 오답과 오답에서 정답과 오답에서 오답의 네 전이가 있습니다.
- S02.14 현재 정답 집단에서 다음 라운드까지 보존되는 질량은 Acc_t 곱하기 CL_t입니다.
- S02.15 현재 정답 집단에서 훼손되어 빠져나가는 질량은 Acc_t 곱하기 1 빼기 CL_t입니다.
- S02.16 현재 오답 집단에서 복구되어 들어오는 질량은 1 빼기 Acc_t에 CS_t를 곱한 값입니다.
- S02.17 현재 오답 집단에서 계속 틀린 채 남는 질량은 1 빼기 Acc_t에 1 빼기 CS_t를 곱한 값입니다.
- S02.18 따라서 다음 정확도는 Acc_t 곱하기 CL_t 더하기 1 빼기 Acc_t에 CS_t를 곱한 값으로 계산됩니다.
- S02.19 이 식은 보존된 정답과 새로 복구된 정답을 더하는 확률 회계입니다.
- S02.20 CL_t와 CS_t는 개별 응답의 예언값이 아니라 여러 응답에서 사후 계산한 집단의 조건부 전이율입니다.
- S02.21 같은 모델이라도 데이터셋과 프롬프트와 샘플링 절차가 달라지면 두 전이율도 달라질 수 있습니다.

</PresenterNotes>

**컷 후보:** `S02.04`, `S02.18`을 제외하고 ScopeBand와 transition table 관찰 시간을 각각 8초 늘릴 수 있다.

## 5. Scene 3 — 기대를 충족하는 조건 공간은 좁다

**시간 계약:** 19문장 × 8초 = 152초, 시각·전환 28초, 합계 3분.

### 5.1 실제 화면 본문

```mdx
<Scene
  id="scene-03"
  part="paper"
  sentenceBudget={19}
  speechSeconds={152}
  visualSeconds={28}
  totalSeconds={180}
>
  <Title>
    <h2>수렴 지도 — 어떤 조건이 어디로 가는가</h2>
    <p>목적지 Upp는 CL과 CS만이 정하고, 기대를 충족하는 조합은 좁다.</p>
  </Title>

  <ConvergenceMapLab
    primary
    presets={["llama3-observed", "acc0-99", "oracle-edge"]}
    autoplay="boundary-sweep"
  />

  <PersistentConclusion badge="PAPER">
    목적지는 시작점이 아니라 절차가 정하며,
    기대를 충족하는 조건 공간은 생각보다 좁다.
  </PersistentConclusion>
</Scene>
```

### 5.2 정지 가정과 고정점

한 라운드의 순변화식은 Scene 2의 회계식에서 유도가 끝난 내용이므로 화면에 수식으로만 표시하고 발표자 노트는 낭독하지 않는다.

```text
Acc_{t+1} - Acc_t
  = (1 - Acc_t) × CS_t     - Acc_t × (1 - CL_t)
    └─── 복구 이득 ───┘      └─── 훼손 손실 ───┘
```

`CL_t`와 `CS_t`가 라운드와 무관한 상수 `CL`, `CS`라고 가정하면 복구 유입과 훼손 유출이 같아지는 고정점이 나온다. 정확도, 수렴 상한, 수렴 계수는 논문의 `Acc_t`, `Upp`, `α` 표기를 그대로 쓴다.

```text
Upp = CS / (1 - CL + CS)      (단, 1 - CL + CS > 0)
α = CL - CS
Acc_t = Upp - α^t × (Upp - Acc_0)
```

| 값 | 의미 |
| --- | --- |
| `Upp` | 논문이 정확도 수렴 상한이라고 부르는 값이며, 복구 유입과 훼손 유출이 같아지는 점근적 고정점 |
| `α` | 고정점에서 떨어진 거리가 라운드마다 남는 비율 |
| `|α|` | 고정점까지 접근하는 속도 |

논문이 경험적으로 관찰한 `0<α<1` 구간에서는 `Acc_0<Upp`이면 평균적으로 상승하고, `Acc_0>Upp`이면 평균적으로 하락하며, `Acc_0=Upp`이면 변화가 없다. 빠르게 수렴하는 것과 높은 정확도로 수렴하는 것은 같은 말이 아니다.

`CL=1`, `CS=0`이면 분모가 0이고 모든 초기 정확도가 그대로 유지되므로 하나의 `Upp`로 요약할 수 없다. `α<0`이면 고정점 양쪽을 오가며 접근할 수 있고, 논문의 주된 설명은 경험적으로 관찰한 `0<α<1` 구간에 놓인다.

### 5.3 조건 공간의 기하와 실측점

같은 목적지 `Upp=c`로 수렴하는 (CL, CS) 조합은 직선 `CS = c/(1-c) × (1-CL)`이며, c와 무관하게 모두 `(CL=1, CS=0)` 모서리를 지난다. 목적지가 높을수록 직선이 가팔라져, 높은 기대를 충족하는 조합은 모서리 근처의 좁은 쐐기에 몰린다.

| 기대 | 조건 | 단위 정사각형에서의 넓이 |
| --- | --- | ---: |
| 목적지 90% 이상 | `CS ≥ 9(1-CL)` | 약 5.6% |
| 목적지 95% 이상 | `CS ≥ 19(1-CL)` | 약 2.6% |
| `Acc_0=50%`에서 반복이 개선 | `Upp > 0.5` | 50% |
| `Acc_0=99%`에서 반복이 개선 | `Upp > 0.99` | 약 0.5% |

개선과 훼손을 가르는 경계선은 `Upp = Acc_0` 등고선이다. 99% 시작·`CS=0.5`에서의 손익분기 `CL` 약 99.49%는 별도의 공식이 아니라 이 경계선 위의 한 점이다. 위 넓이 수치는 전이식에서 도출한 수학적 계산이며 논문의 실험 측정값이 아니다.

논문 Figure 1·2에서 눈으로 읽은 Llama3-8B의 데이터셋별 (CL, CS) 근사값은 대체로 CL 0.90~0.97, CS 0.1~0.3 영역에 몰리고(목적지 약 60~80%), 목적지 90% 이상 쐐기에 들어가는 실측 조합은 없다. 논문 §F(Discussion)도 intrinsic self-correction의 `Upp`가 경험적으로 높지 않다고 논의한다. 이 실측 좌표는 그림에서 읽은 근사값이므로 fixture와 화면 fallback에 근사 출처를 명시한다.

### 5.4 Primary SVG — `ConvergenceMapLab`

#### 화면 구조

```text
┌─ 수렴 지도 (CL × CS 조건 공간) ──────────┬─ 목적지 게이지 ─┐
│ CS 1┤╲     ╲      ╲                      │ 100%┤          │
│     │  ╲    ╲   99%╲  ← Upp 등고선(금색, │     │ ◉ Upp 75%│
│     │   ╲ 90%╲      ╲   점선이 코너로    │     │ ▲ 펄스   │
│     │ 75%╲    ╲      ╲   흐르는 상시     │     │ ● Acc₀   │
│     │  ●GSM8k  ╲╲     ╲  애니메이션)     │   0%┤   70%    │
│     │     ●MMLU… ╲╲    ╲╲ ← 실측 8점     ├────────────────┤
│ 점등(개선, ~8% 틴트) ══╲╲══╲╲■ ←경계선   │ Acc₀ 페이더    │
│ 소등(훼손, 빗금 실루엣)     (1,0)코너    │ [──●────] 70%  │
│    0└──────────────────────┘             │ 개선 조합 50%  │
│     0         CL          1              │ (실시간 넓이)  │
└──────────────────────────────────────────┴────────────────┘
```

#### 레이어와 조작

- **부챗살 등고선**: 목적지 50/75/90/99% 직선이 `(1,0)` 코너에서 방사. dash-offset이 코너 방향으로 흐르는 상시 애니메이션(ease-in 램프, reduced-motion 시 정지). 축은 [0,1] 전체 — 높은 기대 쐐기의 얇음 자체가 메시지이므로 확대하지 않는다.
- **실측 8점**: Llama3-8B×8 데이터셋의 (CL, CS) 근사 좌표. ≥8px 마커 + 2px 표면 링, 보이지 않는 44px 핫스팟(`role='button'`), focus·hover 시 데이터셋명·CL·CS·Upp·현재 방향을 상태바에 출력.
- **경계선**(`Upp=Acc_0`, 강한 네온): 개선 영역은 점등(~8% green 틴트), 훼손 영역은 소등(검정+빗금 실루엣).
- **Acc₀ 페이더**: 올리면 경계선이 `(1,0)` 코너를 축으로 회전. 경계선이 실측점을 지나는 값마다 soft-lock detent가 있고, 그 순간 해당 데이터셋이 점등→소등으로 꺼진다(순차 소등). "개선 조합 %" readout이 실시간으로 넓이를 표시(50%→0.5%).
- **그리드 커서**: 화살표 키로 스냅 이동, 선택 지점의 `Upp`를 목적지 게이지에 반영.
- **목적지 게이지**: 세로 0~100% 스트립에 `Acc_0` 마커와 `Upp` 마커를 표시하고, 펄스가 `Acc_0`에서 `Upp`로 반복 이동(상승/하락 방향을 시간축 없이 암시). `CL=1`·`CS=0` 퇴화 사례는 값 대신 boundary message.
- preset: Llama3-8B 실측 배치, `Acc_0=99%` 붕괴 상태, oracle 변(`CL=1`).

#### 자동 재생과 28초 시각 예산

1. 6초 동안 등고선이 코너에서 전개되고 영역이 점등/소등으로 갈린다.
2. 6초 동안 실측 8점이 순차 착지한다(glow bloom).
3. 12초 동안 `Acc_0`을 50%에서 99%로 스윕 — 경계선 회전, 데이터셋 순차 소등, 개선 조합 50%→0.5% 카운트다운.
4. 4초 동안 `(1,0)` 코너와 `CL=1` 변을 강조("탈출구")한 뒤 검증 화면으로 전환한다.

#### 항상 보이는 결론

> 기대를 충족하는 (CL, CS) 조합은 좁은 쐐기이고, 실측된 intrinsic self-correction은 그 밖에 있다.

#### 접근성 DOM 대체

- 실측 8점의 데이터셋명·CL·CS·Upp·현재 방향을 데이터 표로 제공한다(근사 출처 병기).
- 기대별 넓이(90%+/95%+/Acc₀ 50%/Acc₀ 99%)를 표로 제공한다.
- 점등/소등은 색뿐 아니라 `개선`, `훼손` text로 구분한다.
- 페이더 조작 중 live region은 갱신하지 않고 데이터셋의 점등/소등 전환 시에만 알린다.

### 5.5 발표자 노트

<PresenterNotes scene="03" sentenceBudget={19} speechSeconds={152} visualSeconds={28}>

- S03.01 남은 질문은 같은 수정 절차를 계속 반복하면 정확도가 어디까지 가는지입니다.
- S03.02 CL과 CS가 라운드 동안 일정하다고 가정하면 궤적은 CS를 1 빼기 CL 더하기 CS로 나눈 고정점 Upp로 수렴합니다.
- S03.03 논문의 따름정리에 따르면 이 목적지는 CL과 CS만이 정하며 초기 정확도와는 무관합니다.
- S03.04 그래서 이 화면은 반복의 운명을 시간 축이 아니라 CL과 CS의 조건 공간으로 보여 줍니다.
- S03.05 같은 목적지로 수렴하는 조합들은 지도 위에서 직선을 이루고, 모든 직선은 CL이 1이고 CS가 0인 오른쪽 아래 모서리를 지납니다.
- S03.06 목적지가 높을수록 그 직선은 가팔라져서, 높은 목적지의 조합은 모서리 근처의 좁은 띠에 몰립니다.
- S03.07 예를 들어 목적지가 90퍼센트 이상인 조합은 전체 조건 공간의 약 5.6퍼센트뿐입니다.
- S03.08 논문이 Llama3-8B에서 측정한 여덟 데이터셋의 CL과 CS를 이 지도에 올리면 대부분 목적지 60에서 80퍼센트대 영역에 놓입니다.
- S03.09 목적지 90퍼센트 이상의 좁은 띠에 들어가는 실측 조합은 하나도 없습니다.
- S03.10 논문 스스로도 intrinsic self-correction의 Upp가 경험적으로 높지 않다고 논의합니다.
- S03.11 반복이 지금 이득인지는 현재 정확도와 목적지를 비교하는 경계선 하나로 판정됩니다.
- S03.12 시작 정확도가 50퍼센트일 때 개선 영역은 조건 공간의 절반입니다.
- S03.13 시작 정확도를 99퍼센트로 올리면 개선 영역은 약 0.5퍼센트로 무너집니다.
- S03.14 화면에서 페이더를 올리면 경계선이 모서리를 축으로 회전하며 실측 데이터셋이 하나씩 소등되는 것을 보실 수 있습니다.
- S03.15 흔히 말하는 손익분기, 예컨대 시작 99퍼센트에 CS 0.5일 때의 CL 99.49퍼센트는 이 경계선 위의 한 점입니다.
- S03.16 수렴 계수 α는 CL 빼기 CS이며 목적지까지의 거리가 라운드마다 줄어드는 속도만 정합니다.
- S03.17 그래서 빠른 수렴은 좋은 목적지를 보장하지 않고, 나쁜 목적지에 더 빨리 도착할 수도 있습니다.
- S03.18 모든 직선이 만나는 모서리, 즉 CL이 1인 변에서는 CS가 조금만 있어도 목적지가 100퍼센트가 됩니다.
- S03.19 기대를 충족하는 조건이 이렇게 좁다면, 질문은 반복 횟수가 아니라 어떻게 절차를 바꿔 이 지도를 다시 그릴 것인가가 됩니다.

</PresenterNotes>

**컷 후보:** `S03.07`, `S03.10`을 제외하고 경계선 스윕과 코너 강조 정지 시간을 각각 8초 늘릴 수 있다.

## 6. Scene 4 — 곡선 일치의 예측력을 비판적으로 읽는다

**시간 계약:** 25문장 × 8초 = 200초, 시각·전환 40초, 합계 4분.

### 6.1 실제 화면 본문

```mdx
<Scene
  id="scene-04"
  part="paper"
  sentenceBudget={25}
  speechSeconds={200}
  visualSeconds={40}
  totalSeconds={240}
>
  <Title>
    <h2>곡선 일치는 어디까지가 예측인가</h2>
    <p>실험 절차, 검증 사례, 주장의 경계를 순서대로 읽는다.</p>
  </Title>

  <PredictionReplayLab
    primary
    stage="case-replay"
    shelf="all-paper-figures"
    autoplay="three-cases-once"
  />

  <PersistentConclusion badge="PAPER">
    논문은 제한된 intrinsic self-correction에서 유용한 최소 모형을 보였지만,
    모든 최신 Agent가 같은 고정 곡선을 따른다고 입증하지 않았다.
  </PersistentConclusion>
</Scene>
```

### 6.2 첫 라운드는 예측이 아니라 보정이다

논문의 검증은 첫 수정 한 번에서 추정한 `Acc_0`, `CL`, `CS`로 이후 라운드의 이론 곡선을 계산하고 실측 궤적과 비교한다. 이때 첫 수정 뒤의 정확도 `Acc_1`은 같은 전이 데이터에서 계산한 `CL`과 `CS`가 거의 구성적으로 결정한다. 따라서 `Acc_1`의 일치는 독립적인 미래 예측이 아니라 파라미터 보정에 가깝고, 이론의 실제 예측력은 보정에 쓰지 않은 2~5라운드의 일치에서 판단해야 한다.

### 6.3 논문의 실험 절차

| 항목 | 논문에서 한 일 |
| --- | --- |
| 응답 | 질문마다 5개 응답을 독립적으로 샘플링 |
| 반복 | 각 응답에 5회의 자기수정 라운드 |
| 모형 추정 | 첫 전이에서 `Acc_0`, `CL`, `CS` 추정 |
| 예측 | 같은 값을 고정해 2~5라운드 정확도 궤적 계산 |
| 비교 | 실제 곡선과 이론 곡선의 상승·포화·하락 형태 비교 |
| 범위 | 8개 모델과 8개 데이터셋을 사용하되 가능한 64개 조합 전체를 실행하지 않음 |

모델은 Llama3-8B, Qwen2.5-7B, DeepSeek-LLM-7B, Mistral-7B-v3, GLM4-9B, Qwen-Max, GPT-3.5 Turbo, GPT-4 Turbo를 포함한다. 데이터셋은 GSM8K, HumanEval, IFEval, MMLU, BoolQ, CommonsenseQA, PIQA, HotpotQA를 포함한다.

### 6.4 검증 사례와 관찰

| 검증 사례 | 실험 방법 | 관찰 | 해석 경계 |
| --- | --- | --- | --- |
| 서로 다른 시작점 | 초기 정확도를 0~100%로 인위적으로 구성 | 서로 다른 시작점이 같은 고정점 방향으로 접근 | 고정 `CL`, `CS` 가정 아래의 corollary 검증이다 |
| 전이율 정지성 | Llama3-8B에서 1~5라운드 전이율 재측정 | 확인한 구간에서는 대체로 안정적 | 한 모델·다섯 라운드에 한정되며 광범위한 정상성 검증이 아니다 |
| 완전 보호 `CL=1` | 정답 발견 뒤 수정 중단 또는 정답→정답 전이 강제 | 이론이 예측한 상승 곡선과 유사 | 현실 verifier의 성능을 뜻하지 않는다 |
| 유도된 훼손 | Llama3-8B·GSM8K에 “Are you sure?” 프롬프트 | `CL`과 고정점이 낮아지고 실제 정확도도 하락 | 특정 모델·과제·프롬프트의 실패 사례다 |

### 6.5 주장 강도

| 수준 | 안전한 해석 | 넘어서는 해석 |
| --- | --- | --- |
| 수학 | 고정 `CL/CS` 아래 궤적과 고정점을 정확히 계산 | 실제 policy가 stationary하다고 자동 결론 |
| 실험 | 제한된 설정에서 곡선 형태가 대체로 일치 | 모든 모델·데이터셋 조합에서 정량 법칙 확립 |
| 진단 | 복구와 훼손을 분리해 실패 원인을 본다 | `Upp`를 모든 최신 Agent의 장기 효용으로 사용 |

논문은 주로 곡선의 시각적 일치를 제시하며 RMSE(평균제곱근오차), `R²`(결정계수), 신뢰구간 같은 정량 적합도와 불확실성 지표를 보고하지 않는다. 따라서 “scaling theory”는 유용한 구조적 모형으로 읽되 보편적 경험 법칙으로 과장하지 않는다.

### 6.6 Primary SVG — `PredictionReplayLab`

#### 화면 구조 — 리플레이 무대 + 데이터 선반

원문 matplotlib 패널을 복제하지 않는다. 케이스마다 "이론이 먼저 예측하고, 실측이 라운드마다 도착해 채점받는" 리플레이 무대로 변환한다.

```text
┌─ 무대: GSM8k · Llama3-8B ───────────────────────────────┐
│ Acc │·············································· Upp ─│ ← 목적지 선(금색, Scene 3 토큰)
│     │      ╭───────────  ← 이론 예측(보라, 먼저 그어짐)  │
│     │   ◉╱ ◉   ◉    ◉   ← 실측(청록)이 한 라운드씩 착지 │
│     │ ◉╱            halo = 분산(아웃라인, 채움 없음)     │
│     │▓▓│                                                │
│     └──┴──────────────────────────                      │
│      0  1    2    3    4    5  round                    │
│     [보정]  [────── 예측 ──────]  ← 구간 톤·라벨 분리    │
│ ┌미니 수렴지도┐  verdict: 이론이 상승·포화를 맞춤        │
│ │ · ←이 케이스│  (CL, CS, Upp 수치 병기)                 │
└─┴─────────────┴─────────────────────────────────────────┘
┌─ 데이터 선반 (그룹별 44px 스파크라인 칩, 가로 스크롤) ───┐
│ [Llama3-8B×8]  ∿GSM8k ∿HumanEval ∿IFEval ∿BoolQ …       │
│ [GLM4-9B×8]    ∿… │ [모델×BoolQ] ∿GPT-4Turbo↓ ∿Deepseek↓│
│ [따름정리]     ∿팬차트 ∿α비교 ∿CL=1 │ [실패] ∿Are you…↓ │
└──────────────────────────────────────────────────────────┘
```

#### 리플레이 안무 (케이스당)

1. `Upp` 목적지 선이 먼저 켜진다 — Scene 3 수렴 지도에서 온 시각 토큰.
2. 라운드 0→1 구간이 `보정` neutral 밴드로 표시되고, 보정점에서 이론 곡선(2px)이 5라운드까지 그어진다.
3. 실측 점이 라운드 순서대로 착지한다(glow bloom + 위상 crossfade). 분산은 halo 아웃라인으로 표현하고 면을 채우지 않는다.
4. verdict 칩이 케이스를 채점한다: `상승·포화 적중`, `하락까지 적중`, `Upp 돌파 — CL=1 특수 사례` 등. 예측 구간에서 이론과 실측의 간극이 곧 채점이다.

#### 데이터 선반 — 모든 데이터, 한 화면 금지

- 원문 전 곡선(Figure 1·3·4·5·6·7·8·9·10, 약 40개)을 그룹별 스파크라인 칩으로 수록: Llama3-8B×8 데이터셋, GLM4-9B×8, 모델×BoolQ 8종, 따름정리(팬차트·α 비교·CL=1), 실패 사례(Are you sure).
- 칩은 44px 목표 크기, 자체 `overflow-x` 컨테이너, click/Enter로 무대에 로드. 하락 케이스 칩에는 방향 글리프(↓)를 병기해 색 없이도 구분한다.
- 미니 수렴 지도 inset: 무대 좌하단에 Scene 3 그리드 축소판을 두고 현재 케이스의 (CL, CS) 위치가 맥동한다. 좁은 viewport에서는 inset을 숨기고 수치만 남긴다.
- 모든 실측 좌표는 fixture에 `paper-observation` provenance와 근사 여부(figure 눈읽기/원문 명시값)를 필드로 남긴다.

#### 자동 재생과 40초 시각 예산

1. 8초 동안 무대 구조를 소개한다 — 목적지 선, 보정/예측 구간, 실측·이론의 구분.
2. 10초 동안 GSM8k 상승·포화 케이스를 리플레이한다.
3. 8초 동안 Are you sure 하락 케이스를 리플레이한다.
4. 6초 동안 CL=1 oracle 돌파 케이스를 리플레이한다.
5. 4초 동안 `직접 도출 / 실험이 지지 / 아직 미검증` 세 열 overlay를 강조한다.
6. 4초 동안 Part I 종료 문장과 PartBoundary를 표시한다.

팬차트(시작점 무관 수렴)와 α 비교는 자동 재생에 넣지 않고 따름정리 그룹 칩으로 수동 탐색하게 둔다.

#### 항상 보이는 결론

> 곡선 일치의 예측력은 보정에 쓰지 않은 2~5라운드에서만 판단한다.

#### 접근성 DOM 대체

- 무대의 각 케이스는 라운드별 실측·이론 `Acc_t` 값과 근사 출처를 담은 데이터 표로 제공한다.
- 보정·예측 구간은 색뿐 아니라 text label로 구분하고, verdict는 text로 병기한다.
- 선반 그룹은 실제 heading 아래 list로 제공하고, 칩은 keyboard로 순회·선택할 수 있다.
- claim-boundary 카드는 실제 heading과 list로 제공하고 badge만으로 근거 수준을 구분하지 않는다.
- live region은 케이스 로드와 verdict 확정 시에만 알린다.

### 6.7 발표자 노트

<PresenterNotes scene="04" sentenceBudget={25} speechSeconds={200} visualSeconds={40}>

- S04.01 이제 이 닫힌식이 실제 모델의 반복 궤적을 얼마나 설명하는지 논문의 검증 절차를 보겠습니다.
- S04.02 저자들은 질문마다 응답 다섯 개를 독립적으로 샘플링하고 각 응답에 다섯 라운드의 자기수정을 적용했습니다.
- S04.03 초기 정확도 Acc_0과 첫 수정 한 번에서 추정한 CL과 CS만으로 이후 라운드의 이론 곡선을 계산했습니다.
- S04.04 그리고 같은 절차를 실제로 반복해 얻은 궤적과 이론 곡선의 모양을 비교했습니다.
- S04.05 실험에는 오픈소스 모델 다섯 개와 Qwen-Max와 GPT-3.5 Turbo와 GPT-4 Turbo를 합친 여덟 모델이 포함되었습니다.
- S04.06 데이터셋은 GSM8K와 HumanEval과 MMLU 등을 포함한 여덟 종류였지만 가능한 64개 조합이 모두 실행되지는 않았습니다.
- S04.07 여기서 첫 수정 뒤 정확도 Acc_1은 같은 전이 데이터로 계산한 CL과 CS가 거의 그대로 결정합니다.
- S04.08 따라서 1라운드의 일치는 미래 예측이 아니라 파라미터 보정에 가깝습니다.
- S04.09 이 모형의 실제 예측력은 보정에 쓰지 않은 2라운드부터 5라운드의 일치에서 판단해야 합니다.
- S04.10 그 구간에서 관찰된 곡선들은 상승과 포화의 형태가 이론 곡선과 정성적으로 비슷했습니다.
- S04.11 초기 정확도를 0부터 100퍼센트까지 인위적으로 바꿔도 서로 다른 시작점이 같은 고정점 방향으로 접근했습니다.
- S04.12 Llama3-8B에서는 다섯 라운드 동안 CL과 CS가 대체로 안정적이라는 정지 가정의 부분 근거도 확인했습니다.
- S04.13 정답을 찾으면 수정을 멈춰 CL을 1로 만든 보호 실험에서는 이론이 예측한 상승 곡선이 나타났습니다.
- S04.14 반대로 Are you sure 프롬프트는 CL과 고정점을 낮췄고 실제 정확도도 이론이 예측한 대로 하락했습니다.
- S04.15 다만 이 비교는 주로 곡선 모양의 시각적 일치이며 논문은 평균제곱근오차(RMSE)나 결정계수(R²)나 신뢰구간 같은 정량 적합도를 보고하지 않습니다.
- S04.16 정지 가정의 확인도 Llama3-8B 한 모델의 다섯 라운드에 한정되고 광범위한 정상성 검증은 아닙니다.
- S04.17 다섯 라운드를 넘는 반복이나 라운드 중간에 절차가 바뀌는 경우는 실험이 다루지 않았습니다.
- S04.18 2026년 현세대 frontier 모델과 reasoning 모델도 직접 실험 대상이 아니었습니다.
- S04.19 따라서 scaling theory라는 이름에 기대되는 보편적 경험 법칙 수준의 검증은 아직 없습니다.
- S04.20 정리하면 수학 수준에서는 고정 CL과 CS 아래의 궤적과 고정점이 정확히 도출됩니다.
- S04.21 실험 수준에서는 제한된 설정에서 상승과 포화와 하락의 곡선 형태가 지지됩니다.
- S04.22 그러나 모든 모델과 데이터셋에서 성립하는 정량 법칙이나 실제 policy의 정상성은 입증되지 않았습니다.
- S04.23 검색과 도구와 사람 피드백이 있는 tool-using Agent가 같은 고정 곡선을 따른다는 주장도 이 실험 밖에 있습니다.
- S04.24 그래서 이 모형은 반복 자기수정의 보편 법칙이 아니라 복구와 훼손을 분리해 보는 유용한 일차 근사로 받아야 합니다.
- S04.25 여기까지가 논문의 직접 범위이며 다음 화면부터는 이 렌즈를 실무 loop에 옮기는 발표의 해석입니다.

</PresenterNotes>

**컷 후보:** `S04.05`, `S04.11`, `S04.13`을 제외하고 procedure와 claim-boundary 관찰 시간을 각각 8초 늘릴 수 있다.

## 전환. 논문에서 실무로 적용 경계를 긋는다

## 7. Scene 5 — 그대로 옮기지 말고 적용 경계를 먼저 긋는다

**시간 계약:** 10문장 × 8초 = 80초, 시각·전환 20초, 합계 1분 40초.

### 7.1 실제 화면 본문

```mdx
<Scene
  id="scene-05"
  part="bridge"
  sentenceBudget={10}
  speechSeconds={80}
  visualSeconds={20}
  totalSeconds={100}
>
  <PartBoundary>
    <p>여기까지는 논문의 직접 범위다.</p>
    <p>여기부터는 이 발표의 엔지니어링 적용이다.</p>
  </PartBoundary>

  <Title>
    <h2>고정 곡선이 아니라 복구와 훼손을 묻는 습관을 옮긴다</h2>
  </Title>

  <TheoryToLoopBridge autoplay="once" />

  <PersistentConclusion badge="INTERPRETATION">
    candidate의 변화와 gate 이후 system state의 변화를 분리한다.
  </PersistentConclusion>
</Scene>
```

### 7.2 가져올 것, 번역할 것, 가져오지 않을 것

| 논문 | 전환 조건 | Autoresearch형 loop에서의 해석 |
| --- | --- | --- |
| 정답/오답 상태 | 사례별 pass/fail criterion이 있어야 함 | criterion별 보존·훼손·복구 전이 |
| 외부 정답 판정 | evaluator가 agent 제안과 분리돼야 함 | frozen harness, metric, guards, gold check |
| `CL_t/CS_t` 회계 | 같은 평가 단위와 조건을 유지해야 함 | candidate와 system-after-gate를 별도 측정 |
| 같은 답의 수정 | 수정 범위와 baseline을 명시해야 함 | isolated challenger와 incumbent 비교 |
| 라운드별 결과 | 모든 결과가 관찰 가능해야 함 | append-only experiment ledger |
| 고정 `CL/CS` | adaptive proposal에서는 대체로 깨짐 | 라운드별 `CL_t/CS_t` 또는 직접 transition history |
| 고정점 `Upp` | stationary policy에서만 해석 가능 | campaign utility나 stop target으로 직접 사용하지 않음 |

연속형 scalar metric 하나만 있는 경우에는 사례별 전이 정보가 없으므로 `CL_t/CS_t`를 만들지 않는다. 그때는 candidate와 incumbent의 metric delta, uncertainty, guard regression, gold/holdout을 직접 비교한다.

### 7.3 `TheoryToLoopBridge`

```text
PAPER MODEL                                      ENGINEERING TRANSFER

a_{i,t} ─ self-correct ─▶ a_{i,t+1}              incumbent at iteration t
  │ external correctness                           │ propose bounded diff
  ▼                                                ▼
pass / fail                                      challenger at iteration t
  │ count four transitions                         │ frozen harness
  ▼                                                ▼
CL_t / CS_t over evaluation cohort i             evidence + verdict
                                                   │
                                      keep ────────┴────── discard
                                       ▼                      ▼
                               challenger becomes        incumbent remains
                                  next incumbent             unchanged
```

20초 시각 예산은 PartBoundary 정지 4초, 왼쪽 논문 모형 4초, 8초 morph, 적용 경고 정지 4초로 나눈다.

### 7.4 발표자 노트

<PresenterNotes scene="05" sentenceBudget={10} speechSeconds={80} visualSeconds={20}>

- S05.01 지금까지는 논문이 직접 다룬 intrinsic self-correction의 두 상태 전이 모형만 설명했습니다.
- S05.02 이제부터 그 모형을 실제 Autoresearch형 agent loop의 멘탈 모델로 옮겨 보겠습니다.
- S05.03 다만 논문의 정답과 오답 두 상태를 적응형 산출물 탐색과 같은 시스템으로 직접 동일시하지는 않습니다.
- S05.04 논문은 같은 수정 절차와 고정된 전이율을 가정하지만 agent loop는 관측과 기록에 따라 다음 제안 자체를 바꿉니다.
- S05.05 따라서 가져올 것은 하나의 고정 곡선이 아니라 복구와 훼손을 따로 세는 전이 회계의 질문입니다.
- S05.06 산출물에 사례별 통과 기준이 있다면 채택 전후의 보존율과 복구율을 측정할 수 있습니다.
- S05.07 연속형 점수만 있는 경우에는 CL_t와 CS_t를 억지로 만들지 않고 점수와 회귀 검사를 따로 봅니다.
- S05.08 후보가 만든 변화와 게이트를 통과한 시스템 상태의 변화를 구분하는 것이 첫 번째 적용 규칙입니다.
- S05.09 공식 Autoresearch는 이 규칙을 살펴볼 running example이며 이어지는 구조화는 발표가 제안하는 일반화입니다.
- S05.10 이제 무엇을 고정하고 무엇을 바꾸며 어떤 증거로 상태를 전진시킬지 보겠습니다.

</PresenterNotes>

**컷 후보:** 적용 경계를 담은 Scene이므로 문장을 자르지 않고 이전 Scene의 컷 후보를 사용한다.

## Part II. Autoresearch형 loop를 구조화한다

## 8. Scene 6 — 공식 사례에서 Autoresearch형 loop의 구조를 꺼낸다

**시간 계약:** 22문장 × 8초 = 176초, 시각·전환 64초, 합계 4분.

### 8.1 실제 화면 본문

```mdx
<Scene
  id="scene-06"
  part="practice"
  sentenceBudget={22}
  speechSeconds={176}
  visualSeconds={64}
  totalSeconds={240}
>
  <Title>
    <h2>무엇을 고정하고, 무엇을 바꾸고, 누가 채택하는가</h2>
    <p>공식 예시와 범용 멘탈 모델을 한 화면에서 분리한다.</p>
  </Title>

  <OfficialExampleStrip badge="OFFICIAL AUTORESEARCH EXAMPLE" />

  <AutoresearchLoopMap
    primary
    badge="ENGINEERING TRANSFER"
    lenses={["contract", "roles", "state", "memory"]}
    autoplay="one-iteration"
  />

  <PersistentConclusion badge="PRACTICE">
    Autoresearch형 loop의 단위는 생각 한 번이 아니라
    고정된 계약 아래 실행하고 되돌릴 수 있는 실험 한 건이다.
  </PersistentConclusion>
</Scene>
```

### 8.2 공식 running example

아래 행은 공식 README와 `program.md`가 직접 명시한 기본 사례다.

| 구분 | 공식 사례 |
| --- | --- |
| 목표 | 고정된 실행 시간 안에서 `val_bpb`라는 validation bits per byte를 낮춤 |
| mutable | agent가 `train.py` 하나를 수정 |
| frozen | `prepare.py`의 data, runtime utility, evaluator |
| trial budget | startup·compile을 제외한 training wall clock 5분 |
| metric | `val_bpb` 또는 validation bits per byte, lower is better |
| soft constraint | 최대 GPU 메모리인 VRAM(video random access memory)과 complexity |
| baseline | 첫 run은 수정하지 않은 `train.py` |
| decision | 개선하면 keep, 같거나 나쁘면 discard와 revert, 실행 실패는 crash |
| ledger | `results.tsv`에 commit, metric, memory, status, description |
| campaign stop | 기본 지침은 사람이 중단할 때까지 계속 실행 |

마지막 stop 항목은 overnight autonomous research라는 공식 예시의 운영 정책이다. 범용 실무 loop에 그대로 적용하는 불변식이 아니며, Scene 7에서 bounded stopping으로 별도 일반화한다.

### 8.3 범용 멘탈 모델

#### 세 층

| 층 | 고정하거나 수행하는 일 |
| --- | --- |
| Research contract | goal, mutable scope, frozen harness, metric, constraints, trial budget, campaign policy |
| Experiment transaction | incumbent → hypothesis → challenger → run → observation → verdict |
| Learning and control | ledger → compressed memory → next proposal → continue/stop |

#### 네 지속 객체

| 객체 | 내용 | 불변식 |
| --- | --- | --- |
| Research contract | 목표, 변경 범위, 평가, 예산, 권한 | 변경 시 새 version을 만든다 |
| Incumbent at current iteration | accepted artifact, score, revision, provenance | gate 전에는 덮어쓰지 않는다 |
| Challenger at current iteration | hypothesis와 bounded diff가 반영된 격리 상태 | discard와 rollback이 가능하다 |
| Experiment ledger | hypothesis, diff, raw observation, metric, verdict, reason | 실패도 지우지 않는 append-only 기록이다 |

Derived memory는 experiment ledger에서 다음 제안에 필요한 패턴을 압축한 파생 객체다. 공식 `program.md`는 제안과 실행 방식을 규정하는 proposal policy이고, `results.tsv`는 실험 행을 보존하는 raw ledger이므로 둘을 derived memory 자체와 동일시하지 않는다.

#### 역할

| 역할 | 책임 |
| --- | --- |
| Proposer / model | incumbent와 memory에서 testable hypothesis와 bounded change 제안 |
| Executor / environment | challenger 실행과 raw observation 생성 |
| Evaluator | observation을 metric, guard, uncertainty로 변환 |
| Controller / loop runtime | 비교, keep/discard/crash, rollback, continue/stop |

한 프로세스가 여러 역할을 수행할 수 있지만 로그와 화면에서는 제안, 관찰, 평가, 선택의 책임을 분리한다.

### 8.4 `AutoresearchLoopMap`

```text
┌────────────────────── Research contract ───────────────────────┐
│ goal │ mutable │ frozen harness │ metric/guards │ trial budget│
└────────────────────────────────────────────────────────────────┘

Incumbent + Derived memory
        │
        ├─ Propose hypothesis + bounded diff
        ▼
Isolated Challenger
        │ Execute in frozen harness
        ▼
Raw Observation ──▶ Metric + Guards ──▶ Verdict
                                                │
                ┌───────────────────────────────┴──────────────┐
                ▼                                              ▼
             KEEP                                          DISCARD/CRASH
   Challenger becomes next                           Incumbent remains
          Incumbent                                      unchanged
                └───────────────────┬──────────────────────────┘
                                    ▼
                    append Experiment ledger
                    → update Derived memory
```

```text
challenger = propose(incumbent, derived_memory, research_contract)
raw_observation = execute_in_frozen_harness(
  challenger,
  research_contract,
  random_seed
)
verdict = evaluate_and_gate(
  raw_observation,
  incumbent_evaluation,
  research_contract
)
next_incumbent = challenger if verdict == KEEP else incumbent
next_experiment_ledger = append(
  experiment_ledger,
  {hypothesis, diff, raw_observation, metric, verdict, reason}
)
next_derived_memory = compress(next_experiment_ledger)
```

이 의사코드는 research agent LLM의 weight update가 아니라 외부 artifact와 experiment state의 갱신을 나타낸다.

### 8.5 자동 재생과 64초 시각 예산

1. 16초 동안 공식 사례의 `fixed / mutable / metric / ledger`를 순차 강조한다.
2. 8초 동안 구체 파일명을 범용 contract 필드로 morph한다.
3. 32초 동안 한 iteration을 `incumbent → proposal → run → evidence → keep → ledger` 순서로 재생한다.
4. 4초 동안 `program.md / ledger / memory` 경계를 고정한다.
5. 4초 동안 Scene 7의 experiment history로 전환한다.

### 8.6 접근성 DOM 대체

- 공식 사례와 일반화는 별도 heading과 table로 제공한다.
- loop phase를 ordered list로 제공하고 현재 phase의 `changed / persisted / owner / evidence`를 definition list로 보여 준다.
- contract와 state 객체를 keyboard로 선택하면 owner, lifetime, mutable, rollback 속성을 읽을 수 있게 한다.
- final verdict만 live region으로 알린다.

### 8.7 발표자 노트

<PresenterNotes scene="06" sentenceBudget={22} speechSeconds={176} visualSeconds={64}>

- S06.01 공식 Autoresearch 저장소는 GPU(graphics processing unit) 한 개에서 작은 언어 모델 학습 코드를 에이전트가 반복 개선하도록 구성합니다.
- S06.02 공식 구현에서 데이터 준비와 평가를 담은 prepare.py는 고정되고 에이전트는 train.py 하나만 수정합니다.
- S06.03 이 제한은 탐색 범위를 작게 만들고 변경 차이를 검토 가능한 크기로 유지합니다.
- S06.04 각 학습 실행에는 시작과 컴파일을 제외한 벽시계 기준 5분이 똑같이 주어집니다.
- S06.05 공식 주 지표는 검증 데이터의 바이트당 비트 수인 val_bpb이며 값이 낮을수록 좋습니다.
- S06.06 고정된 시간과 평가기는 서로 다른 구조와 하이퍼파라미터를 같은 시험대에서 비교하게 합니다.
- S06.07 첫 실행은 수정하지 않은 코드의 baseline을 세워 비교 기준을 만듭니다.
- S06.08 에이전트는 실험 아이디어로 코드를 바꾸고 변경을 commit한 뒤 같은 절차로 실행합니다.
- S06.09 실행 뒤에는 metric과 peak memory와 상태와 시도 내용을 tab-separated ledger에 기록합니다.
- S06.10 metric이 낮아지면 공식 규칙은 commit을 keep하고 branch를 새 incumbent로 전진시킵니다.
- S06.11 metric이 같거나 나빠지면 candidate를 discard하고 시작했던 commit으로 되돌립니다.
- S06.12 실행이 무너지면 쉬운 오류는 고쳐 다시 돌리고 근본적으로 깨진 아이디어는 crash로 기록합니다.
- S06.13 공식 지침은 실험 loop가 시작되면 사람이 중단할 때까지 계속 실행하도록 요구합니다.
- S06.14 여기까지가 저장소에 명시된 running example이고 지금부터는 이를 재사용 가능한 구조로 해부한 발표의 일반화입니다.
- S06.15 첫 층인 research contract는 목표와 mutable scope와 frozen harness와 metric과 trial budget을 고정합니다.
- S06.16 두 번째 층인 experiment loop는 incumbent에서 가설을 만들고 격리된 candidate를 실행해 observation을 얻습니다.
- S06.17 proposer는 가능성을 만들고 executor는 실행하며 evaluator는 관측을 비교 가능한 evidence로 바꿉니다.
- S06.18 controller는 evidence와 constraint를 읽고 keep이나 discard나 crash라는 verdict를 내립니다.
- S06.19 keep일 때만 candidate가 다음 incumbent가 되고 나머지 판정에서는 기존 incumbent가 남습니다.
- S06.20 모든 시도의 hypothesis와 diff와 observation과 verdict는 append-only ledger에 누적됩니다.
- S06.21 공식 에이전트 지침 문서는 proposal policy이고 results.tsv는 experiment ledger이므로 둘 다 압축된 memory와는 다릅니다.
- S06.22 이 contract와 역할 구분을 다시 정의하면 같은 구조를 코드와 문서와 데이터 탐색에도 적용할 수 있습니다.

</PresenterNotes>

**컷 후보:** `S06.03`, `S06.12`를 제외하고 official strip과 state boundary 관찰 시간을 각각 8초 늘릴 수 있다.

## 9. Scene 7 — 실험 결과와 system state를 분리해 통제한다

**시간 계약:** 30문장 × 8초 = 240초, 시각·전환 70초, 합계 5분 10초.

### 9.1 실제 화면 본문

```mdx
<Scene
  id="scene-07"
  part="practice"
  sentenceBudget={30}
  speechSeconds={240}
  visualSeconds={70}
  totalSeconds={310}
>
  <Title>
    <h2>keep·discard·crash 뒤에 무엇이 실제로 바뀌는가</h2>
    <p>같은 ledger로 replay, diagnose, stop을 전환한다.</p>
  </Title>

  <LoopControlWorkbench
    primary
    modes={["replay", "diagnose", "stop"]}
    dataset="official-illustrative-results"
    autoplay="three-cases-once"
  />

  <PersistentConclusion badge="PRACTICE">
    candidate의 실패는 ledger를 바꾸지만,
    gate를 통과하기 전에는 incumbent를 후퇴시키지 않는다.
  </PersistentConclusion>
</Scene>
```

### 9.2 canonical replay data

다음 값은 새 측정 결과가 아니라 공식 `program.md`의 illustrative `results.tsv`를 재생 fixture로 옮긴 것이다.

| iteration | revision | `val_bpb` ↓ | peak memory | outcome | description | incumbent after |
| ---: | --- | ---: | ---: | --- | --- | --- |
| 0 | `a1b2c3d` | 0.997900 | 44.0 GB | keep | baseline | `a1b2c3d` |
| 1 | `b2c3d4e` | 0.993200 | 44.2 GB | keep | increase learning rate to 0.04 | `b2c3d4e` |
| 2 | `c3d4e5f` | 1.005000 | 44.0 GB | discard | switch to Gaussian Error Linear Unit activation | `b2c3d4e` |
| 3 | `d4e5f6g` | 측정 없음 | 측정 없음 | crash | double model width, out of memory | `b2c3d4e` |

공식 raw ledger는 crash에 `0.000000`과 `0.0` sentinel을 쓰지만, 화면에서는 실제 최저 점수로 오해하지 않도록 `측정 없음`으로 표시하고 raw drawer에서 원형을 보존한다.

### 9.3 Replay mode

```text
baseline revision a1b2c3d · 0.997900
  ├─ challenger revision b2c3d4e · 0.993200 ─ KEEP ───▶ incumbent b2c3d4e
  ├─ challenger revision c3d4e5f · 1.005000 ─ DISCARD ▶ incumbent b2c3d4e
  └─ challenger revision d4e5f6g · 측정 없음 ─ CRASH ─▶ incumbent b2c3d4e
```

기본 gate는 `valid observation → required guards → improvement beyond uncertainty → independent verify if required → keep` 순서다. 공식 예시보다 넓은 guard와 holdout은 `ENGINEERING TRANSFER` badge를 붙인다.

### 9.4 Diagnose mode

#### candidate와 system transition

사례별 pass/fail criterion이 있을 때만 Part I의 전이 회계를 다시 사용한다.

```text
Candidate view
  incumbent pass → candidate fail   = candidate damage
  incumbent fail → candidate pass   = candidate recovery

System-after-gate view
  discarded candidate              = incumbent retained
  kept candidate                   = accepted transitions become system state
```

따라서 훼손이 큰 candidate를 정확히 discard하면 candidate 수준 `CL_t`는 낮아도 system 수준의 정답 보존은 유지될 수 있다. 반대로 scalar metric 하나만 있다면 `CL_t/CS_t` 대신 metric delta, variance, guard, holdout을 보여 준다.

#### 증상에서 고장 층으로

| 증상 | 먼저 볼 층 | 확인할 evidence |
| --- | --- | --- |
| 비슷한 candidate 반복 | proposer 또는 memory | hypothesis similarity, memory input, ledger cursor |
| crash 집중 | executor 또는 resource | exit code, stack trace, environment hash |
| observation 누락·요동 | instrumentation 또는 evaluator | raw log, repeated measure, data version과 evaluator version |
| proxy 상승·gold 하락 | metric alignment | proxy/gold pair, criterion transitions |
| 더 나쁜 candidate 채택 | selector | baseline id, threshold, verdict reason |
| evaluator 변경 뒤 개선 | mutable scope 또는 integrity | contract version, harness hash |

### 9.5 Stop mode

```ts
type StopReason =
  | "SUCCESS_PREDICATE_MET"
  | "SAFETY_VIOLATION"
  | "HARNESS_INVALID"
  | "HUMAN_GATE"
  | "CYCLE_DETECTED"
  | "PLATEAU"
  | "CAMPAIGN_BUDGET_EXHAUSTED"
  | "BLOCKED"
  | "MANUAL_INTERRUPT";
```

한 trial의 timeout은 candidate 하나를 끝내는 국소 시계이고, campaign budget은 전체 탐색을 끝내는 전역 시계다. 공식 기본 예시는 manual interrupt까지 계속하지만 범용 실무 policy는 success, safety, cycle, plateau, budget, blocked, human gate를 명시한다.

```text
continue only if
  no manual interrupt
  ∧ success predicate not met
  ∧ harness valid
  ∧ no safety or permission block
  ∧ campaign budget remains
  ∧ no cycle or plateau
  ∧ at least one testable hypothesis remains
```

종료할 때 마지막 candidate가 아니라 검증된 best-so-far, 남은 불확실성, stop reason을 함께 반환한다.

### 9.6 최소 telemetry

```json
{
  "contract_version": "research-contract-version-3",
  "iteration": 12,
  "incumbent_revision": "b2c3d4e",
  "challenger_revision": "e5f6g7h",
  "hypothesis_id": "hypothesis-012",
  "changed_scope": ["train.py:optimizer"],
  "harness_revision": "evaluator-version-7",
  "observation_ref": "runs/012/raw.log",
  "metric": { "name": "val_bpb", "value": 0.9928, "direction": "lower" },
  "guards": [{ "name": "peak_gpu_memory_gigabytes", "status": "pass" }],
  "verdict": "KEEP",
  "verdict_reason": "metric improved and guards passed",
  "campaign_budget_remaining": 28800,
  "stop_reason": null
}
```

### 9.7 자동 재생과 70초 시각 예산

1. baseline과 contract를 6초 동안 고정한다.
2. keep, discard, crash를 각 10초씩 총 30초 재생한다.
3. candidate와 system-after-gate 전이를 12초 동안 비교한다.
4. diagnose mode의 두 failure를 8초 동안 재생한다.
5. plateau와 safety stop을 10초 동안 비교한다.
6. 4초 동안 best-so-far와 stop reason을 고정한다.

### 9.8 접근성 DOM 대체

- replay chart와 같은 canonical record를 iteration table로 제공한다.
- mode 선택은 tablist로 제공하고 각 panel의 heading을 유지한다.
- transition view는 raw count가 있는 2×2 table을 제공하며 scalar metric에서는 비활성 이유를 설명한다.
- stop history에는 candidate, incumbent, delta, guard, verdict, remaining budget, stop reason을 모두 표시한다.
- reduced-motion에서는 각 scenario의 final state를 먼저 보여 주고 이전·다음 버튼으로 탐색한다.

### 9.9 발표자 노트

<PresenterNotes scene="07" sentenceBudget={30} speechSeconds={240} visualSeconds={70}>

- S07.01 재생 화면의 시작점은 baseline을 통과해 현재 비교 기준이 된 incumbent입니다.
- S07.02 첫 candidate가 더 낮은 주 metric과 허용 가능한 peak memory 사용량을 보이면 gate는 keep을 선택합니다.
- S07.03 이때 branch와 incumbent는 candidate revision으로 함께 전진합니다.
- S07.04 두 번째 candidate가 실행에는 성공해도 metric이 나빠지면 verdict는 discard입니다.
- S07.05 discard 뒤에는 코드를 이전 incumbent로 rollback하되 실패 기록은 ledger에 남깁니다.
- S07.06 세 번째 candidate가 메모리 부족으로 실행되지 않으면 유효한 성능 측정 없이 crash로 분류합니다.
- S07.07 공식 crash sentinel은 영이지만 화면에서는 최고 점수로 오해하지 않도록 측정 없음으로 표시합니다.
- S07.08 세 결과의 공통점은 candidate의 운명과 incumbent의 상태를 별도로 기록한다는 것입니다.
- S07.09 그러므로 campaign이 반환할 대상은 마지막 candidate가 아니라 검증된 best so far입니다.
- S07.10 이제 논문의 CL_t와 CS_t를 적용하려면 먼저 평가 단위마다 통과와 실패를 판정할 수 있는지 확인합니다.
- S07.11 candidate 수준 CL_t는 incumbent가 통과하던 기준 중 candidate에서도 계속 통과한 비율입니다.
- S07.12 candidate 수준 CS_t는 incumbent가 실패하던 기준 중 candidate에서 새로 통과한 비율입니다.
- S07.13 candidate가 새 실패를 많이 만들면 복구가 있어도 candidate 수준 훼손 손실이 커질 수 있습니다.
- S07.14 gate가 그 candidate를 discard하면 채택된 system state는 바뀌지 않아 기존 통과 항목이 보호됩니다.
- S07.15 반대로 keep된 candidate의 보존과 복구 전이만 다음 system state의 CL_t와 CS_t에 반영됩니다.
- S07.16 이 구분은 생성 성능보다 acceptance policy가 시스템의 실현 성능을 결정한다는 점을 보여 줍니다.
- S07.17 다만 연속형 metric 하나는 사례별 전이표를 제공하지 않으므로 CL_t와 CS_t를 계산할 충분한 정보가 아닙니다.
- S07.18 또한 다음 제안이 ledger와 memory에 따라 달라지므로 고정된 CL과 CS의 고정점 Upp를 campaign 예측값으로 쓰지 않습니다.
- S07.19 결과가 나쁘면 먼저 proposer와 executor와 evaluator와 controller 중 어느 경계가 실패했는지 국소화합니다.
- S07.20 비슷한 candidate가 반복되면 proposer의 탐색 폭과 memory 입력을 점검합니다.
- S07.21 crash가 몰리면 가설의 품질보다 실행 환경과 dependency와 자원 한도를 먼저 확인합니다.
- S07.22 관측이 비거나 흔들리면 instrumentation과 평가 분산과 데이터 버전을 조사합니다.
- S07.23 proxy metric만 좋아지고 gold 기준이 나빠지면 metric alignment 실패로 분류합니다.
- S07.24 더 나쁜 candidate가 incumbent를 덮어쓰면 selector와 비교 기준이 고장 난 것입니다.
- S07.25 폐기한 실험이 반복되면 raw ledger가 다음 proposal memory로 전달되는 경로를 추적합니다.
- S07.26 candidate가 frozen harness까지 바꿀 수 있다면 개선보다 contract 무결성 위반을 먼저 의심합니다.
- S07.27 공식 예시는 사람의 interrupt까지 계속 돌지만 실무 일반화에서는 한 trial의 timeout과 전체 campaign의 stopping budget을 분리합니다.
- S07.28 campaign은 success와 safety와 cycle과 plateau와 budget과 human interrupt를 구조화된 stop reason으로 기록합니다.
- S07.29 여러 종료 조건이 겹치면 안전과 하네스 무결성을 성능 개선보다 먼저 평가합니다.
- S07.30 종료할 때는 검증된 best so far와 남은 불확실성과 stop reason을 함께 반환합니다.

</PresenterNotes>

**컷 후보:** `S07.07`, `S07.20`, `S07.25`, `S07.28`을 제외하고 replay·diagnose·stop의 정지 시간을 각각 8초 늘릴 수 있다.

## 10. Scene 8 — 논문의 렌즈를 loop policy 한 장에 고정한다

**시간 계약:** 15문장 × 8초 = 120초, 시각·전환 30초, 합계 2분 30초.

### 10.1 실제 화면 본문

```mdx
<Scene
  id="scene-08"
  part="practice"
  sentenceBudget={15}
  speechSeconds={120}
  visualSeconds={30}
  totalSeconds={150}
>
  <Title>
    <h2>목표·변경·증거·채택·기억·중단을 한 장에 쓴다</h2>
  </Title>

  <LoopPolicyCard mode="blank-plus-synthetic-example" />

  <FinalTakeaway>
    논문은 자기수정의 정확도 변화를 보존과 복구의 전이 회계로 설명한다.
    실무에서는 이 렌즈로 challenger의 복구와 훼손을 측정하되,
    evidence gate가 incumbent 교체를 통제하게 한다.
  </FinalTakeaway>
</Scene>
```

### 10.2 blank policy template

```yaml
loop_policy:
  goal:
  success_predicate:

  mutable_artifact:
  frozen_harness:

  trial_budget:
  campaign_budget:

  evidence:
    raw_observation:
    primary_metric:
    uncertainty:
    guards:
    gold_or_holdout:

  transition:
    keep:
    discard:
    crash:
    rollback:

  ledger:
  memory:

  stop:
    success:
    safety:
    cycle:
    plateau:
    budget:
    human_gate:

  owners:
    proposer:
    evaluator:
    selector:
    external_commit:
```

### 10.3 synthetic example의 첫 화면

```yaml
goal: "checkout 결제 성공률을 안전하게 높인다"
mutable_artifact: ["checkout/**", "tests/checkout/**"]
frozen_harness: "checkout-evaluator-version-7 + holdout-2026-07"
primary_metric: "checkout_success_rate, higher is better"
guards: ["all_tests_pass", "latency_95th_percentile_milliseconds<=baseline", "no_new_permission"]
keep: "checkout_success_rate_gain_percentage_points>0.3 && guards_pass && holdout_no_regression"
rollback: "restore incumbent revision and isolated environment"
stop:
  success: true
  plateau_iterations: 5
  time_budget_hours: 6
  cost_budget_usd: 40
  safety: true
  human_gate: true
```

이 예시는 화면 구조를 보여 주기 위한 synthetic policy이며 실제 운영 수치가 아니다.

### 10.4 최종 세 문장

1. 논문은 반복 횟수보다 정답 보존과 오답 복구의 균형을 보게 한다.
2. 적용할 때는 candidate의 전이와 system-after-gate의 전이를 분리한다.
3. 좋은 agent loop는 많이 고치는 시스템이 아니라 증거 없는 변경을 채택하지 않는 시스템이다.

### 10.5 30초 시각 예산

1. 16초 동안 blank policy의 일곱 구역을 위에서 아래로 강조한다.
2. 10초 동안 synthetic example이 각 구역을 채우는 모습을 보여 준다.
3. 4초 동안 최종 세 문장을 정지 화면으로 유지한다.

### 10.6 접근성 DOM 대체

- policy card는 heading과 definition list로 제공한다.
- blank template과 example을 tab으로 전환하고 YAML 복사 결과를 text toast로 알린다.
- presenter mode에서도 최종 세 문장은 정적으로 남긴다.

### 10.7 발표자 노트

<PresenterNotes scene="08" sentenceBudget={15} speechSeconds={120} visualSeconds={30}>

- S08.01 최종 화면은 우리가 운영할 loop policy를 한 장의 contract card로 압축합니다.
- S08.02 첫 줄에는 실제 목표와 그 목표를 대신 관측할 주 metric을 나란히 적습니다.
- S08.03 목표와 metric이 다르다는 사실을 명시해야 proxy 개선을 최종 성공으로 오인하지 않습니다.
- S08.04 다음 줄에는 바꿀 수 있는 artifact와 절대 바꾸지 않을 harness를 구분합니다.
- S08.05 baseline과 incumbent의 revision과 score와 provenance를 함께 저장해 비교 기준을 고정합니다.
- S08.06 proposal rule에는 사용할 evidence와 허용된 diff 범위와 금지된 변경을 적습니다.
- S08.07 execution rule에는 격리 방식과 재현 조건과 trial timeout과 비용 한도를 적습니다.
- S08.08 evaluation rule에는 raw observation과 metric 계산과 guard test와 gold regression check를 분리해 둡니다.
- S08.09 selection rule에는 keep과 discard와 crash와 rollback의 정확한 조건을 적습니다.
- S08.10 ledger schema에는 hypothesis와 revision과 observation과 verdict와 비용과 stop reason을 남깁니다.
- S08.11 memory policy에는 어떤 기록을 압축하고 언제 원문 ledger로 돌아갈지 정합니다.
- S08.12 campaign policy에는 성공과 안전과 반복과 정체와 예산과 human interrupt 종료를 둡니다.
- S08.13 고위험 외부 변경에는 자동 keep 뒤에도 별도의 사람 승인을 요구합니다.
- S08.14 논문의 멘탈 모델은 이 정책에서 복구 이득과 훼손 손실을 분리해 acceptance gate를 진단하게 합니다.
- S08.15 실무형 agent loop의 지능은 후보 수보다 비교 가능한 실험과 보수적 채택과 실패의 기억에 있습니다.

</PresenterNotes>

**컷 후보:** 결론 Scene이므로 문장을 자르지 않고 이전 Scene의 컷 후보를 사용한다.

## 11. 발표자 console과 시간 드리프트

### 11.1 console 와이어프레임

```text
┌──────────────────── Presenter Console ─────────────────────┐
│ Part I · 논문 이해        Scene 04 / 08                    │
│ Part 09:28 / 11:40        전체 09:28 / 25:00              │
│ drift +00:07              rolling mean 8.1s                │
│                                                           │
│ NOW  S04.05 실험에는 오픈소스 모델 다섯 개와…             │
│ NEXT S04.06 데이터셋은 GSM8K와 HumanEval과…                │
│                                                           │
│ [문장 완료] [컷 후보] [visual hold +5s] [이전] [다음]      │
└───────────────────────────────────────────────────────────┘
```

### 11.2 timer 규칙

- Scene 진입 시 `speechSeconds + visualSeconds` countdown을 시작한다.
- `문장 완료` 입력으로 실제 낭독 시간을 기록하고 전체와 Part별 rolling mean을 계산한다.
- drift는 `actual elapsed - planned elapsed`이며 양수는 예산 초과를 뜻한다.
- Part I 종료 시 11분 40초, Scene 5 종료 시 13분 20초, Part II 종료 시 25분을 hard checkpoint로 표시한다.
- rolling mean이 8.5초를 넘으면 다음 Scene의 지정된 컷 후보만 제안하며 자동 삭제하지 않는다.
- 적용 경계인 Scene 5와 최종 결론인 Scene 8의 note는 컷 대상으로 제안하지 않는다.
- reload 뒤 current part, scene, note ID, elapsed를 session storage에서 복원한다.

## 12. 구현 계약

### 12.1 provenance contract

```ts
type ClaimProvenance =
  | "paper-definition"
  | "paper-mathematical-consequence"
  | "paper-observation"
  | "critical-reading"
  | "official-autoresearch-example"
  | "engineering-transfer"
  | "synthetic-example";
```

- Part I의 수식 정의는 `paper-definition` 또는 `paper-mathematical-consequence`를 사용한다.
- 논문의 실험 결과는 `paper-observation`, 미보고 지표와 일반화 한계는 `critical-reading`을 사용한다.
- 공식 저장소의 파일·metric·budget·ledger 규칙은 `official-autoresearch-example`을 사용한다.
- 범용 contract, guard, holdout, stopping, human gate는 `engineering-transfer`를 사용한다.
- checkout policy 수치는 `synthetic-example`을 사용한다.
- 논문 그림에서 눈으로 읽은 근사 수치는 `paper-observation`을 사용하되, fixture와 화면 fallback에 근사 출처(figure 눈읽기/원문 명시값)를 병기한다.

### 12.2 Scene props

```ts
type SceneProps = {
  id: `scene-0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  part: "paper" | "bridge" | "practice";
  sentenceBudget: number;
  speechSeconds: number;
  visualSeconds: number;
  totalSeconds: number;
  children: React.ReactNode;
};
```

런타임 invariant는 다음과 같다.

```text
speechSeconds === sentenceBudget × 8
totalSeconds === speechSeconds + visualSeconds

sum(sentenceBudget) === 150
sum(speechSeconds) === 1,200
sum(visualSeconds) === 300
sum(totalSeconds) === 1,500

sum(Part I totalSeconds) === 700
Scene 5 totalSeconds === 100
sum(Part II totalSeconds) === 700
```

### 12.3 paper model state

```ts
type PaperModelState = {
  accuracyAtRound: number; // UI notation: Acc_t
  confidenceLevelAtRound: number; // UI notation: CL_t
  critiqueScoreAtRound: number; // UI notation: CS_t
  round: number;
  stationary: boolean;
};

const nextAccuracy = ({
  accuracyAtRound,
  confidenceLevelAtRound,
  critiqueScoreAtRound,
}: PaperModelState) =>
  accuracyAtRound * confidenceLevelAtRound +
  (1 - accuracyAtRound) * critiqueScoreAtRound;

const recoveryGain = ({
  accuracyAtRound,
  critiqueScoreAtRound,
}: PaperModelState) =>
  (1 - accuracyAtRound) * critiqueScoreAtRound;

const damageLoss = ({
  accuracyAtRound,
  confidenceLevelAtRound,
}: PaperModelState) =>
  accuracyAtRound * (1 - confidenceLevelAtRound);
```

UI의 `Upp`는 `confidenceLevelAtRound === 1 && critiqueScoreAtRound === 0`일 때 계산하지 않고 boundary message를 반환한다. slider는 화면 표시를 반올림하되 계산에는 원래 값을 사용한다.

### 12.4 loop experiment state

```ts
type ExperimentRecord = {
  campaignId: string;
  iteration: number;
  contractVersion: string;
  incumbentBefore: Revision;
  challenger: Revision;
  hypothesis: { id: string; statement: string };
  changedScope: string[];
  harnessRevision: string;
  observation: {
    valid: boolean;
    rawRef: string;
    exitStatus: "ok" | "crash" | "timeout";
  };
  metrics: Array<{
    name: string;
    value: number | null;
    direction: "higher" | "lower";
    evaluatorVersion: string;
  }>;
  guards: Array<{ name: string; status: "pass" | "fail" | "unknown" }>;
  verdict: "KEEP" | "DISCARD" | "CRASH" | "PENDING" | "BLOCKED";
  verdictReason: string;
  incumbentAfter: Revision;
  stopReason: StopReason | null;
};
```

`AutoresearchLoopMap`과 `LoopControlWorkbench`는 같은 canonical `ExperimentRecord` fixture를 사용한다. chart, branch graph, ledger table, live announcement가 서로 다른 판정 로직을 중복 구현하지 않게 pure reducer 하나를 둔다.

### 12.5 playback contract

```ts
type PlaybackState = {
  status: "idle" | "playing" | "paused" | "completed";
  step: number;
  speed: 0.5 | 1 | 1.5 | 2;
  hasUserInteracted: boolean;
  reducedMotion: boolean;
};
```

- autoplay는 viewport 최초 진입, `hasUserInteracted=false`, reduced-motion 비활성일 때만 시작한다.
- seeded fixture를 사용해 발표 때마다 같은 수치와 verdict가 나온다.
- 사용자 입력 시 현재 step에서 멈추고 control을 사용자에게 넘긴다.
- SVG animation의 상태와 DOM table의 상태는 하나의 reducer에서 파생한다.

### 12.6 반응형 배치

| viewport | 배치 |
| --- | --- |
| ≥ 1200px | 설명·입력 35% + SVG 65%, evidence/ledger 하단 full width |
| 768–1199px | 제목 → SVG → controls → 설명 → table |
| < 768px | 결론 → 입력 → 세로 stepper → compact SVG → table |

모바일에서는 SVG를 단순 축소하지 않고 두 상태 전이와 experiment lane을 세로 stepper로 재배치한다.

## 13. 구현 완료 조건

### 13.1 서사

- Scene 1부터 Scene 4까지는 논문이 직접 다룬 내용만 발표자에게 읽히며 Autoresearch 적용 주장을 하지 않는다.
- Scene 3이 정지 가정 아래의 수학적 귀결을, Scene 4가 실험 관찰과 비판적 한계를 설명한 뒤 Scene 5가 full-width 경계를 표시한다.
- Scene 5 이후 공식 autoresearch 사례와 발표의 범용 일반화가 provenance badge로 구분된다.
- 결론은 논문의 결과와 실무 적용을 두 문장으로 나눠 과장 없이 연결한다.

### 13.2 내용

- Part I에 `Acc_t`, `CL_t`, `CS_t`, `CL`, `CS`, 순변화, 99% 예시, `Upp`, `α`, 실험 절차, 주장 한계가 모두 있다.
- 논문의 표시 기호와 발표자 노트는 원문의 표기를 그대로 사용하며 별도의 축약 기호를 만들지 않는다.
- `CL_t/CS_t`와 정지 가정 뒤의 `CL/CS`가 모델 confidence나 critique text score가 아니라 외부 판정 뒤 계산한 조건부 전이율임을 밝힌다.
- Part II에서 candidate와 system-after-gate transition을 구분한다.
- 연속형 metric 하나에 `CL_t/CS_t`를 억지로 적용하지 않는다.
- adaptive proposal policy에 stationary `Upp`를 장기 utility로 사용하지 않는다.
- Part II의 contract, incumbent, challenger, observation, verdict, ledger, memory에는 새 단문자 별칭을 붙이지 않는다.
- goal/metric, observation/score, trial/campaign budget, ledger/memory를 각각 분리한다.

### 13.3 시간과 발표자 노트

- 발표자 노트가 정확히 150문장이고 Scene별 개수는 `8, 21, 19, 25, 10, 22, 30, 15`다.
- 각 bullet은 실제 낭독 가능한 한 문장이고 `S01.01`부터 Scene별로 연속된 ID를 가진다.
- 발화 1,200초, 시각·전환 300초, 전체 1,500초가 정확히 일치한다.
- Part I 700초, Scene 5 전환 100초, Part II 700초가 정확히 일치한다.
- presenter console이 rolling mean과 전체·Part·Scene drift를 표시한다.

### 13.4 인터랙션과 접근성

- `TwoStateTransitionLab`, `ConvergenceMapLab`, `PredictionReplayLab`, `AutoresearchLoopMap`, `LoopControlWorkbench`가 서로 다른 학습 목표를 가진다.
- 모든 SVG에 동등한 DOM table 또는 ordered list가 있다.
- autoplay는 한 번 뒤 멈추고 사용자 조작 시 즉시 중단한다.
- keyboard, reduced-motion, 색 외 상태 표현, verdict-only live region을 지원한다.
- crash sentinel은 성능 0으로 표시하지 않고 `측정 없음`으로 읽는다.

### 13.5 안전과 무결성

- mutable artifact와 frozen harness가 별도 필드다.
- contract version과 evaluator revision이 experiment record마다 남는다.
- discard와 crash 뒤 incumbent와 격리 환경을 복원한다.
- 고위험 external action은 verified state 뒤에도 human gate를 통과한다.
- raw observation은 permission-aware reference로 보존하고 화면에는 secret-redacted summary만 노출한다.

## 14. 출처와 근거

### 14.1 논문

- [Yang et al. (2025), *A Probabilistic Inference Scaling Theory for LLM Self-Correction*, EMNLP 2025](https://aclanthology.org/2025.emnlp-main.685/): 제목, 수렴식, single-round parameter estimation, empirical curve comparison의 1차 근거.
- [원 발표 초안](/Users/wongyushin/.codex/attachments/3f50141d-2656-4767-97da-b8a5cd0b1686/pasted-text.txt): 논문의 `CL_t/CS_t`와 정지 가정 뒤 `CL/CS` 정의, 실험 범위, 99% 예시, 발표용 비판적 읽기의 근거.
- [논문 기반 상세 리포트](/Users/wongyushin/personal/llm-agent-loop-research/reports/llm-self-correction-scaling-report-draft.md): 식의 경계 사례, 실험 절차, 주장 강도 검토의 로컬 근거.

### 14.2 공식 Autoresearch 사례

- [karpathy/autoresearch README](https://github.com/karpathy/autoresearch): fixed `prepare.py`, mutable `train.py`, 5분 budget, `val_bpb`의 1차 근거.
- [karpathy/autoresearch program.md](https://github.com/karpathy/autoresearch/blob/master/program.md): baseline, experiment branch, `results.tsv`, keep/discard/crash, revert, manual interrupt 정책의 1차 근거.

### 14.3 범용 loop 일반화

- [Agent loop theory reframing note](/Users/wongyushin/personal/llm-agent-loop-research/reports/M4b-agent-loop-theory-reframing-note.md): loop를 추가 계산, 새 observation, 검증과 선택을 포함한 adaptive search로 읽는 근거.
- [Agent loop causal diagnostic protocol](/Users/wongyushin/personal/llm-agent-loop-research/reports/agent-loop-causal-diagnostic-protocol.md): task, metric, state, policy 분리와 replay, best-so-far, stop reason의 근거.
- [Agent loop model correspondence and convergence](/Users/wongyushin/personal/llm-agent-loop-research/reports/agent-loop-model-correspondence-and-convergence.md): model/external state, observability, verifier validity, retention, stopping 경계의 근거.

### 14.4 주장 강도

- Part I의 논문 설명은 EMNLP 2025 논문과 원 발표 초안의 비판적 검토에 근거한다.
- Part II의 공식 파일, metric, budget, 기본 verdict는 공식 저장소가 직접 지원한다.
- 세 층, 네 객체, provenance schema, bounded stopping, policy card는 이 발표가 제안하는 엔지니어링 일반화다.
- 두 상태 모형과 adaptive artifact loop 사이의 대응은 설계·진단용 해석이며 동일한 dynamics나 인과효과를 주장하지 않는다.

## 부록 A. 초기 구현 순서

1. Scene data와 150개 presenter note를 정적 schema로 만들고 시간 invariant test를 먼저 작성한다.
2. Part label, provenance badge, read/present mode, presenter timer를 구현한다.
3. `PaperModelState` reducer와 paper fixtures를 구현한다.
4. `TwoStateTransitionLab`, `ConvergenceMapLab`, `PredictionReplayLab`와 DOM 대체를 구현한다. 논문 그림의 실측 곡선 fixture(근사 출처 필드 포함)를 먼저 만든다.
5. `TheoryToLoopBridge`와 PartBoundary를 구현한다.
6. canonical `ExperimentRecord` reducer와 official illustrative fixture를 구현한다.
7. `AutoresearchLoopMap`, `LoopControlWorkbench`, `LoopPolicyCard`와 DOM 대체를 구현한다.
8. keyboard, reduced-motion, screen reader, mobile, print를 검증한다.
9. 25분 리허설을 두 번 기록하고 actual rolling mean에 따라 지정된 컷 후보만 조정한다.

이 문서는 구현 독립적인 와이어프레임이다. 실제 host MDX app의 route, import, component registry는 구현 단계에서 확인하고 기존 화면 구조를 재사용하지 않는다.
