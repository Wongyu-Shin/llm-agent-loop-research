# LLM Agent Loop Research

이 저장소는 LLM agent가 실행 결과를 다시 입력으로 받아 작업을 이어 가는 이유를 조사합니다. 출발점은 "자동회귀 모델이므로 loop가 반드시 필요하다"는 가설이었습니다. 현재 연구는 LLM-agent·self-correction·test-time search의 선행 실증을 먼저 종합하고, 제어이론은 그 결과를 해석하고 후속 식별 실험을 설계하는 보조 틀로 사용합니다.

확률적으로 token을 생성한다는 사실만으로 loop의 필연성을 증명할 수는 없습니다. loop는 실행 전에 알 수 없던 정보가 관찰로 드러나고, 그 정보를 다음 선택에 반영할 수 있을 때 유용합니다. 검증기가 약하거나 feedback이 다음 행동을 바꾸지 못하면 반복만으로 성능이 좋아지지 않습니다. Full history나 중복된 state를 더 넣는 일도 성능을 보장하지 않으므로, state의 양보다 선택·갱신·검증 방식을 조사합니다.

## 먼저 읽을 문서

- [선행연구 기반 증거 종합](reports/agent-loop-prior-research-synthesis.md): 관측·memory·interface·verifier·search가 실제로 보인 효과와 적용 경계, 부정 결과, 후속 연구 우선순위
- [제어이론적 해석 노트](reports/agent-loop-control-theory-reformulation.md): 선행연구의 architecture를 폐루프 시스템으로 번역하고 PID·MPC·적응제어·ILC가 성립하려면 필요한 추가 조건을 구분
- [모델 대응과 수렴 조건](reports/agent-loop-model-correspondence-and-convergence.md): 외부 state가 Transformer 계산에 들어가는 경로와 task·metric·state·policy 원인 분리
- [원인 식별 실험 프로토콜](reports/agent-loop-causal-diagnostic-protocol.md): 완전요인 실험, paired replay, 로그 schema, stopping rule, planted synthetic task
- [이론 재정립 노트](reports/M4b-agent-loop-theory-reframing-note.md): 현재 연구 명제와 주장 범위
- [종합 연구 보고서](reports/M4b-agent-loop-necessity-research-report.md): 수학·통계·제어·프로그램 합성 관점의 근거
- [논문 초안](reports/M4b-agent-loop-necessity-paper-draft.md): 학술 논문 형식으로 정리한 초안
- [실험 프로토콜](reports/M4b-agent-loop-necessity-study-protocol.md): one-shot과 여러 loop 조건의 비교 설계
- [LinkedIn 본문](reports/linkedin-agent-loop-post/07-blog-post-final.md): 웹앱 엔지니어를 위한 설명
- [Agent Loop Field Guide](apps/agent-loop-docs/README.md): MDP, POMDP, OGIS, CEGIS를 비교하는 인터랙티브 문서

## 디렉터리

```text
apps/agent-loop-docs/  GitHub Pages용 Next.js 문서
data/                  근거 목록, 실험 manifest와 결과
reports/               연구 보고서, 논문 초안, 게시물 편집 이력
scripts/               수학 예제, pilot, 평가와 카드 생성 도구
outputs/               LinkedIn 카드 이미지
_workspace/            한국어 윤문 감사 기록
```

기존 `M4b` 파일명은 연구 이력과 내부 링크를 보존하려고 유지했습니다. 이 프로젝트는 원래 저장소의 milestone 체계나 실행 환경에 의존하지 않습니다.

## 실행

Python 실험은 대부분 표준 라이브러리만 사용합니다. 카드 이미지를 다시 만들 때는 Pillow가 필요합니다.

```bash
python3 -m pip install -r requirements.txt
npm run m4b:math-demo
npm run m4b:pilot-sim
npm run cards:render
```

실제 provider를 호출하는 tiny pilot에는 `OPENAI_API_KEY`가 필요합니다. 먼저 연결 상태와 dry run을 확인합니다.

```bash
npm run m4b:tiny-pilot:check
npm run m4b:tiny-pilot:dry-run
npm run m4b:tiny-pilot:run
npm run m4b:tiny-pilot:analyze
```

웹 문서는 다음 명령으로 실행하고 검증합니다.

```bash
npm run site:install
npm run site:dev
npm run site:check
npm run site:test
```

## GitHub Pages

`.github/workflows/deploy-agent-loop-docs.yml`은 `main` 브랜치의 웹앱 변경을 검사한 뒤 정적 사이트를 배포합니다. 현재 저장소 이름은 `llm-agent-loop-research`로 가정하며, 공개 주소는 <https://wongyu-shin.github.io/llm-agent-loop-research/>입니다.
