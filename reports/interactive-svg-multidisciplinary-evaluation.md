# 인터랙티브 SVG 다학제 평가 메트릭

## 평가 단위

평가 단위는 본문의 핵심 주장 하나에 인접해 독립적으로 mount된 `figure.lab`과 그 안의 primary SVG 한 개다. 하나의 explorer 안에 mode가 여러 개 있어도 SVG 한 개로 센다. Lucide 아이콘, 장식 SVG, 정적 표는 primary SVG 수에 포함하지 않는다.

실제 문서는 페이지마다 6~7개 `Section`을 사용하므로, “페이지당 3문단” 요구는 다음 세 개의 semantic beat로 평가한다.

1. 구조·문제: 무엇을 구분하거나 관찰해야 하는가
2. 메커니즘·실험: 조작이 어떤 상태·값·후보를 바꾸는가
3. 경계·전이: 언제 이 설명이 성립하고 어디서 다른 모형으로 넘어가는가

각 beat에는 서로 다른 학습 목표를 가진 primary interactive SVG가 한 개 이상 있어야 한다.

## 멀티 에이전트 평가 프로토콜

세 reviewer agent가 여섯 전문 persona를 분담한다. 한 agent가 여러 persona를 맡더라도 각 축은 별도 근거와 점수로 독립 판정한다.

- 원문 claim·수식·예시와 구현 코드
- desktop, mobile 390px, light·dark 렌더
- keyboard interaction과 reset 경로
- accessible name, description, state, live feedback
- reduced-motion과 responsive overflow
- 전체 state transition 및 수학·도메인 invariant
- lint, typecheck, build, Playwright 결과

구현 agent 한 명의 판단만으로 통과시키지 않는다. 각 persona는 `0..4 점수`, 근거, fatal ID, 최우선 수정 한 개를 남기며, 수정 뒤 같은 reviewer가 실제 렌더를 다시 확인한다.

페이지 점수는 다음처럼 계산한다.

```text
PageScore = Σ(weight × personaScore / 4)
```

## Persona별 메트릭

| Persona | 가중치 | 0 | 1 | 2 | 3 | 4 |
| --- | ---: | --- | --- | --- | --- | --- |
| 정보디자인·데이터시각화 | 18 | 주장을 뒤집거나 오해를 유발 | 장식 중심이며 본문 없이는 해독 불가 | 일부 관계는 맞지만 hierarchy·legend·density가 방해 | encoding과 annotation이 정확하고 작은 모호성만 존재 | 첫 화면에서 핵심 관계가 보이고 변화가 위치·형태·문자로 중복 encoding됨 |
| 인지과학·교육 | 16 | 잘못된 mental model을 학습 | control은 움직이나 이유를 알 수 없음 | 정확하지만 split-attention 또는 scaffold 부족 | setup→action→feedback→reset이 설명과 연결 | 예측→조작→관찰→전이 질문을 progressive disclosure로 지원 |
| 프론트엔드 인터랙션 | 16 | crash, invalid state, 복구 불가 | click-only, state trap, affordance 불명 | happy path만 동작하거나 edge state·responsive 부족 | 모든 상태가 결정적이고 reset 가능하며 viewport에서 안정 | state transition 자동검증, direct manipulation과 native control parity, 안정적 paint·layout |
| 접근성 | 16 | keyboard·비시각 사용자가 핵심 정보에 접근 불가 | 심각한 name/role/value, contrast, trap 문제 | 대체 설명·키보드·reflow가 부분적 | WCAG 2.2 AA 수준의 keyboard, focus, contrast, non-color cue, 320px, reduced motion | 44px 권장 target, live state, 구조화된 동등 설명까지 제공 |
| 수학·도메인 정확성 | 18 | 수식·인과·모형 분류 오류 | 표시값과 계산·본문이 모순 | toy model은 대체로 맞지만 조건·범위·가정 누락 | 계산·조건·경계 문구가 맞고 overclaim 없음 | invariant, counterfactual, finite-vs-general 한계까지 시각 상태와 일치 |
| Figma식 디자인 시스템 | 16 | theme 파손 또는 가독 불가 | hard-coded 색·간격·타입이 산발적 | token은 쓰지만 hierarchy·alignment가 흔들림 | 4/8px rhythm, 6/8px radius, semantic tone, mono eyebrow, light/dark parity 유지 | 한 장의 slide 같은 focal composition과 negative space를 유지하며 전 페이지가 한 family로 보임 |

## Fatal hard fail

총점과 무관하게 다음 중 하나가 재현되면 실패다.

1. 페이지에 서로 다른 학습 목표의 primary interactive SVG가 3개 미만이다.
2. 원문 claim, 수식, 예시와 SVG state가 불일치하거나 인과를 뒤집는다.
3. hover 장식만 바뀌고 semantic relation, derived value, candidate set 중 아무것도 변하지 않는다.
4. 필수 state가 keyboard로 도달 불가하거나 의미가 색만으로 전달되며 동등한 텍스트 설명이 없다.
5. console/page error, `NaN`, empty invalid state, reset 불능, 필수 viewport·theme의 절단·겹침이 있다.
6. 모형 invariant를 위반한다.
   - MDP: outgoing probability 합이 1이 아니거나 Bellman 표시값이 계산과 다름
   - POMDP: posterior 합·분모·likelihood 표기가 잘못됨
   - OGIS: version space가 누적 evidence와 불일치하거나 query schema 밖 정보를 사용
   - CEGIS: 반례가 현재 candidate를 falsify하지 않거나 retained mode에서 `Cₜ₊₁ ⊄ Cₜ`
   - Overview: MDP/POMDP와 OGIS/CEGIS를 발전 단계로 표현

## 합격 기준

- 컴포넌트: 82/100 이상, 정보디자인·접근성·도메인 정확성 각각 3.0 이상, fatal 0
- semantic beat: primary SVG 1개 이상, claim→action→visible conclusion을 추적 가능, 조작 결과를 텍스트로도 피드백
- 페이지: primary SVG 3개 이상, 세 beat 전부 통과, 가중 점수 85/100 이상, 어떤 persona도 3.0 미만이 아니며 fatal 0

## 최종 3-beat 배치

| Route | 구조·문제 | 메커니즘·실험 | 경계·전이 |
| --- | --- | --- | --- |
| `/` | `IncidentEvidenceReplay` | `AgentLoopAnatomy` | `FrameworkCompass` |
| `/mdp` | `MdpStructureExplorer` | `MdpPlayground` | `MdpObservabilityBoundary` |
| `/pomdp` | `PomdpStructureExplorer` | `PomdpInformationValueExplorer` | `PomdpBeliefLab` |
| `/ogis` | `OgisProtocolExplorer` | `OgisOracleLab` | `OgisApplicabilityLens` |
| `/cegis` | `CegisLoopLab` | `CegisRetentionExplorer` | `CegisGuaranteeWorkbench` |

모든 route는 primary SVG를 정확히 3개씩, 총 15개 제공한다.

## 컴포넌트 단위 완료 감사

아래 점수는 수정 후 동일한 worktree와 localhost를 세 reviewer가 다시 검토한 최종 통합본이다. 인터랙션·접근성·도메인은 모든 컴포넌트가 `4.0`을 받았으며, 각 행의 가중 점수는 여섯 persona 가중치를 모두 적용한 결과다.

| Route / 컴포넌트 | 정보 | 인지 | 인터랙션 | 접근성 | 도메인 | 시스템 | 가중 점수 | Fatal |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/` `IncidentEvidenceReplay` | 3.9 | 3.8 | 4.0 | 4.0 | 4.0 | 4.0 | **98.8** | 없음 |
| `/` `AgentLoopAnatomy` | 3.9 | 3.9 | 4.0 | 4.0 | 4.0 | 4.0 | **99.1** | 없음 |
| `/` `FrameworkCompass` | 3.8 | 3.7 | 4.0 | 4.0 | 4.0 | 4.0 | **97.9** | 없음 |
| `/mdp` `MdpStructureExplorer` | 3.8 | 3.7 | 4.0 | 4.0 | 4.0 | 3.9 | **97.5** | 없음 |
| `/mdp` `MdpPlayground` | 3.7 | 3.3 | 4.0 | 4.0 | 4.0 | 3.9 | **95.5** | 없음 |
| `/mdp` `MdpObservabilityBoundary` | 3.8 | 3.7 | 4.0 | 4.0 | 4.0 | 3.9 | **97.5** | 없음 |
| `/pomdp` `PomdpStructureExplorer` | 3.8 | 3.7 | 4.0 | 4.0 | 4.0 | 3.9 | **97.5** | 없음 |
| `/pomdp` `PomdpInformationValueExplorer` | 3.9 | 3.6 | 4.0 | 4.0 | 4.0 | 3.9 | **97.5** | 없음 |
| `/pomdp` `PomdpBeliefLab` | 3.9 | 3.8 | 4.0 | 4.0 | 4.0 | 3.9 | **98.3** | 없음 |
| `/ogis` `OgisProtocolExplorer` | 3.8 | 3.7 | 4.0 | 4.0 | 4.0 | 3.9 | **97.5** | 없음 |
| `/ogis` `OgisOracleLab` | 3.7 | 3.2 | 4.0 | 4.0 | 4.0 | 3.9 | **95.0** | 없음 |
| `/ogis` `OgisApplicabilityLens` | 3.9 | 3.6 | 4.0 | 4.0 | 4.0 | 3.9 | **97.5** | 없음 |
| `/cegis` `CegisLoopLab` | 3.8 | 3.6 | 4.0 | 4.0 | 4.0 | 3.9 | **97.1** | 없음 |
| `/cegis` `CegisRetentionExplorer` | 3.9 | 3.8 | 4.0 | 4.0 | 4.0 | 3.9 | **98.3** | 없음 |
| `/cegis` `CegisGuaranteeWorkbench` | 3.9 | 3.2 | 4.0 | 4.0 | 4.0 | 3.8 | **95.5** | 없음 |

모든 컴포넌트가 component gate를 통과했다. 최저 가중 점수는 `OgisOracleLab`의 95.0이며, 어떤 persona 축도 3.0 미만이 아니고 fatal은 0건이다.

## 최종 페이지 scorecard

페이지 점수는 각 route의 세 컴포넌트 persona 점수를 평균한 뒤 동일한 가중치로 합산했다.

| Route | 정보 18 | 인지 16 | 인터랙션 16 | 접근성 16 | 도메인 18 | 시스템 16 | 가중 점수 | Fatal |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/` | 3.9 | 3.8 | 4.0 | 4.0 | 4.0 | 4.0 | **98.6** | 없음 |
| `/mdp` | 3.8 | 3.6 | 4.0 | 4.0 | 4.0 | 3.9 | **96.8** | 없음 |
| `/pomdp` | 3.9 | 3.7 | 4.0 | 4.0 | 4.0 | 3.9 | **97.8** | 없음 |
| `/ogis` | 3.8 | 3.5 | 4.0 | 4.0 | 4.0 | 3.9 | **96.7** | 없음 |
| `/cegis` | 3.9 | 3.5 | 4.0 | 4.0 | 4.0 | 3.9 | **97.0** | 없음 |
| 평균 | 3.8 | 3.6 | 4.0 | 4.0 | 4.0 | 3.9 | **97.4** | 없음 |

모든 페이지가 page gate를 통과했다. `OgisOracleLab`과 `CegisGuaranteeWorkbench`는 다른 컴포넌트보다 정보 밀도가 높지만, clipping·overlap 없이 내부 scroll, status, explanation을 제공하므로 비차단 밀도 차이로 판정했다.

## 검증 증거

- `npm run check`: ESLint, TypeScript, Next.js static build 통과
- Playwright: 34개 interaction·layout·SVG contract 테스트 통과
- 최종 시각 감사: 5 route × 3 SVG × desktop/mobile × light/dark, 총 60 렌더 상태 통과
- 모든 route: SVG 3개, duplicate DOM ID 0, title/desc 누락 0, 깨진 ARIA reference 0
- 모든 interactive SVG node: `aria-pressed` 상태 제공
- interactive SVG는 `role="group"`, 비대화형 SVG는 `role="img"`로 분리
- 각 lab의 live region은 정확히 1개
- 15개 lab 모두 복합 state를 초기값으로 되돌리는 reset 경로 제공
- native button·range: 최소 높이 44px
- SVG hotspot: 모바일 최소 높이 45.11px
- mobile 390px: body overflow 0, lab별 좌우 탐색 guide 표시
- reduced motion: CEGIS 자동 실행 중지, 수동 합성·검증 경로 유지
- light·dark: token 기반 semantic tone과 contrast를 실제 렌더로 확인
- SVG text overlap·viewBox 외곽 이탈·header/action overlap: 0
- 정확성 재검토: EVSI와 Net VOI 분리, OGIS input 선택과 query 실행 분리, MDP p/r, POMDP 가정, CEGIS finite·universal 경계까지 15개 모두 domain 4.0, fatal 0
