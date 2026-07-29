# Blog Humanize Final Review

Date: 2026-05-29

Target: `07-blog-post-final.md`

Method: `im-not-ai` repository의 Korean humanizing 원칙을 적용했다. 의미 보존, 로컬 수정, 번역투 제거, 과도한 일반화 완화, 기계적 접속어와 장식적 문장 축소를 우선했다.

## What Changed

- 제목을 `폐루프 제어`의 직접 동일시에서 `폐루프 제어의 렌즈`로 낮췄다.
- 서두에 “loop를 닫는다”의 의미를 명시했다. 성능 보장이 아니라 관찰, 판정, 피드백, 상태 갱신이 다음 행동에 연결된다는 뜻으로 제한했다.
- `task utility`, `control surface`, `utility proxy`, `state boundary`는 첫 등장 시 한국어 풀이를 붙였다.
- 작은 pilot은 본문 근거가 아니라 underpowered 점검 메모로 격리했다. 숫자 표를 제거하고, 설계 질문만 남겼다.
- verifier는 task utility를 직접 재는 장치가 아니라 noisy proxy를 제공한다는 점을 수식으로 보강했다.
- best-of-n은 후보 다양성, 선택기 calibration, 후보 간 상관, 선택기 오류율에 좌우된다는 조건을 추가했다.
- self-reflection은 같은 생성 경로의 내부 의견이고, verifier는 독립 측정이어야 한다는 대비를 강화했다.
- weak verifier와 proxy hacking의 관계는 인과 단정 대신 취약성 설명으로 낮췄다.

## Verification

- `m4b_content_judge.py` blog judge 재실행:
  - `average_score`: 8.0
  - `min_score`: 8
  - `verdict_counts`: `pass: 1`, `revise: 4`
  - `all_pass`: false

남은 revise는 주로 “핵심 은유와 조건부 설계 주장이 아직 강하게 읽힐 수 있다”는 보수적 지적이다. 현재 본문은 그 리스크를 줄이기 위해 caveat를 추가했지만, 글의 중심 문장인 “무엇이 loop를 닫는가”는 유지했다.

## Remaining Editorial Choice

더 낮출 수 있는 방향은 있다. `loop를 닫는다`라는 표현을 거의 모두 `제어면을 구성한다`로 바꾸면 judge의 overclaim 우려는 더 줄어든다. 대신 글의 기억점과 문제 제기 힘은 약해진다.

현재 버전은 블로그/LinkedIn essay로는 주장성과 안전장치의 균형이 더 낫다고 판단한다.
