# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 성격

"LLM agent에 왜 loop가 필요한가"를 조사하는 연구 저장소. 코드보다 연구 문서(reports/)가 중심 산출물이다. 모든 문서와 커뮤니케이션은 한국어를 기본으로 하되 기술 용어는 영어를 유지한다.

핵심 연구 명제(주의): 초기 가설 "자동회귀 모델이므로 loop가 필수"는 **폐기**되었다. 현재 입장은 "loop의 가치는 verifier 신뢰성, actionable feedback, 도구 접근, 상태 제어에 조건부"이다. 문서를 수정하거나 새로 쓸 때 폐기된 초기 명제를 사실처럼 서술하지 말 것. 명제의 범위는 `reports/M4b-agent-loop-theory-reframing-note.md` 참조.

`M4b` 파일명 접두사는 원 저장소의 milestone 이력을 보존하기 위한 것으로, 새 파일에 붙일 필요 없다.

## 자주 쓰는 명령

루트에서 (Python 실험 — 대부분 표준 라이브러리, 카드 렌더링만 Pillow 필요):

```bash
python3 -m pip install -r requirements.txt
npm run m4b:math-demo          # 수학 예제 재생성
npm run m4b:pilot-sim          # 시뮬레이션 pilot
npm run m4b:tiny-pilot:check   # provider 연결 확인 (OPENAI_API_KEY 필요)
npm run m4b:tiny-pilot:dry-run
npm run m4b:tiny-pilot:run     # 실제 API 호출 — 비용 발생, 실행 전 사용자 확인
npm run m4b:tiny-pilot:analyze
npm run cards:render           # LinkedIn 카드 이미지 → outputs/
```

웹앱 (`apps/agent-loop-docs/`, Node >= 20.9):

```bash
npm run site:install                 # 루트에서: npm ci --prefix apps/agent-loop-docs
npm run site:dev                     # dev 서버 (localhost:3000)
npm run site:check                   # lint + typecheck + 정적 빌드 (out/ 생성)
npm run site:test                    # Playwright e2e 전체

# 단일 테스트 (apps/agent-loop-docs/ 안에서):
npx playwright install chromium      # 최초 1회
npx playwright test -g "테스트 이름 일부"
```

## 아키텍처

### 웹앱: apps/agent-loop-docs (Next.js 16, App Router, 정적 export)

- `output: "export"` + `basePath: /llm-agent-loop-research` (GitHub Pages 서브패스). 절대 경로 asset·링크를 추가할 때 basePath를 깨지 않도록 주의.
- 페이지는 전부 MDX: `app/{mdp,pomdp,ogis,cegis,self-correction-scaling}/page.mdx`. 수식은 remark-math + rehype-katex, 코드 강조는 Shiki.
- 문서 공통 UI는 `components/doc-ui.tsx`, 내비게이션 순서는 `lib/navigation.ts`.
- 인터랙티브 시각화는 `components/visualizations/*.tsx`(개념 페이지용)와 `components/self-correction/*`(25분 발표 deck: presentation-shell + paper-visuals + loop-visuals + presenter-notes).
- e2e 테스트(`tests/docs.spec.ts`)가 강한 계약을 강제한다. 시각화 컴포넌트를 수정할 때 다음이 깨지기 쉽다:
  - 모든 SVG에 `<title>`/`<desc>` + `aria-labelledby`/`aria-describedby`, 문서 내 중복 id 금지
  - 인터랙티브 컨트롤과 SVG 핫스팟(`[role='button']`)은 최소 44px, `aria-pressed` 상태 필수
  - 콘솔 에러 0건, 390px 모바일 뷰포트에서 오버플로우 금지
  - self-correction deck은 presenter note 개수·타이밍 합계까지 검증됨

### 연구 파이프라인 (문서 간 의존 관계)

- `reports/` 이론 체계는 순서가 있다: 선행연구 종합(`agent-loop-prior-research-synthesis.md`) → 제어이론 해석(`agent-loop-control-theory-reformulation.md`) → 모델 대응·수렴(`agent-loop-model-correspondence-and-convergence.md`) → 실험 프로토콜(`agent-loop-causal-diagnostic-protocol.md`). 상위 문서를 고치면 하위 문서와 README의 요약도 정합성을 확인할 것.
- `scripts/` ↔ `data/`: 각 스크립트가 `data/M4b-*.json`을 생성·소비한다. 결과 JSON을 손으로 고치지 말고 스크립트를 재실행한다.
- `reports/linkedin-agent-loop-post/`: 번호(00~32)가 편집 파이프라인 순서다. 새 단계는 다음 번호로 추가하고 기존 파일은 이력으로 보존. 활성 개정 항목은 `30-revision-queue.md`.
- `_workspace/날짜-NNN/`: 한국어 윤문 감사 세션 기록(01_input → 02_findings → final → summary). 같은 형식을 유지한다.

### .codex/ (읽기 전용 이력)

OpenAI Codex CLI 시절 report-mdx-publisher 파이프라인의 실행 로그·아티팩트. 실행 스크립트 본체는 이 repo에 없다(구 `~/.codex/skills/report-mdx-publisher`). 참조용으로만 두고 수정하지 말 것. 시나리오 중 privacy/network/bad-config 실패는 게이트 검증용 의도적 실패다.

## 배포

`.github/workflows/deploy-agent-loop-docs.yml`: main 브랜치에서 `apps/agent-loop-docs/**` 또는 워크플로 파일이 바뀔 때만 실행. lint → typecheck → e2e → build → GitHub Pages 배포. 공개 주소: <https://wongyu-shin.github.io/llm-agent-loop-research/>. reports/나 data/만 바뀐 커밋은 배포를 트리거하지 않는다.
