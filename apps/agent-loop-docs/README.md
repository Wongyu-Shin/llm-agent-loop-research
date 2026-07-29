# Agent Loop Field Guide

LLM 에이전트의 반복 구조를 MDP, POMDP, OGIS, CEGIS와 나란히 놓고 살펴보는 한국어 문서입니다. 각 개념 페이지에는 수식과 함께 직접 조작할 수 있는 SVG 실험실이 들어 있습니다.

## 로컬 실행

Node.js 20.9 이상이 필요합니다.

```bash
npm install
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

## 검증

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

`npm run check`는 ESLint, TypeScript, 정적 내보내기를 차례로 실행합니다. Playwright 브라우저 설치는 처음 한 번만 필요합니다. 결과물은 `out/`에 생성됩니다.

## GitHub Pages 배포

`main` 브랜치에서 이 앱이나 배포 워크플로가 바뀌면 `.github/workflows/deploy-agent-loop-docs.yml`이 실행됩니다. 워크플로는 `/llm-agent-loop-research`를 기준 경로로 설정해 정적 사이트를 빌드합니다.

저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 한 번 지정해야 합니다. 배포가 끝나면 다음 주소에서 문서를 확인할 수 있습니다.

<https://wongyu-shin.github.io/llm-agent-loop-research/>
