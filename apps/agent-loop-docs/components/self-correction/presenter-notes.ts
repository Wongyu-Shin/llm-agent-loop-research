export const SECONDS_PER_PRESENTER_NOTE = 8 as const;

export type SceneId =
  | "scene-01"
  | "scene-02"
  | "scene-03"
  | "scene-04"
  | "scene-05"
  | "scene-06"
  | "scene-07"
  | "scene-08";

export type ResearchPart = "paper" | "bridge" | "practice";

export type PresenterNote = {
  id: string;
  text: string;
};

export type SceneTiming = {
  id: SceneId;
  index: number;
  part: ResearchPart;
  sentenceBudget: number;
  speechSeconds: number;
  visualSeconds: number;
  totalSeconds: number;
  plannedStartSeconds: number;
  notes: readonly PresenterNote[];
  cutCandidates: readonly string[];
};

const notes = {
  "scene-01": [
    { id: "S01.01", text: "오늘 살펴볼 논문은 LLM이 답을 반복해서 고칠 때 정확도가 어떻게 변하는지를 확률 모형으로 설명하는 내용입니다." },
    { id: "S01.02", text: "논문의 제목중, scaling은 모델의 사이즈를 의미하는것이 아닌, 추론 시점의 수정 라운드, 즉 토큰 스케일링을 의미합니다." },
    { id: "S01.03", text: "흔히 생각하기로는 토큰을 쏟으면 쏟을수록 답이 계속 좋아질 것이라는 기대입니다. 이 때문에 token maxing 유행이 일어나기도 했었죠." },
    { id: "S01.04", text: "그러나 실제 agent 의 loop 의 itertaion 간에는 틀린 답이 맞아지는 동시에 맞던 답이 틀어질 수 있습니다." },
    { id: "S01.05", text: "따라서 반복 횟수가 증가한다고, 계속해 정확도가 올라갈지는 장담 하기 어렵습니다." },
    { id: "S01.06", text: "논문의 아이디어는 간단합니다. 오답에서 정답으로 들어오는 복구 유입과 정답에서 오답으로 빠져나가는 훼손 유출 비율을 가정하는 모델입니다." },
    { id: "S01.07", text: "그리고 두 흐름을 하나의 전이식으로 묶어 여러 라운드의 정확도 궤적을 설명합니다." },
    { id: "S01.08", text: "다음 슬라이드에서 보다 자세한 이야기들 말해볼게요" },
  ],
  "scene-02": [
    { id: "S02.01", text: "논문의 가정하는 상황은, 외부 피드백 없이 없이 자신의 이전 답을 다시 검토하는 상황입니다. 원문에서는 intrinsic self-correction이라고 부르더군요." },
    { id: "S02.02", text: "각 loop 의 iteration 간에는 이전 응답을 같은 수정 절차에 다시 넣어 다음 응답을 만듭니다." },
    { id: "S02.03", text: "여기서 말하는 외부 피드백은, 검색 결과와 코드 실행 로그, 사람의 피드백처럼 새로운 관측이 들어오는 절차는 직접 다루지 않습니다." },
    { id: "S02.04", text: "실제 우리가 사용하는 llm agent 의 동작하고는 아주 같다고는 할 수 없겠지만, 그래도 추상화 시켜서 이해하기 간단한 모델을 가정하고 이야기를 진행해보겠습니다." },
    { id: "S02.05", text: "분석 대상은 매 응답을 정답 또는 오답으로 판정할 수 있는 과제입니다." },
    { id: "S02.06", text: "이 판정에는 모델의 자기평가가 아니라 정답표나 테스트처럼 외부에서 확인한 기준이 필요합니다." },
    { id: "S02.07", text: "유용성과 안전성과 문체를 함께 보는 장문 산출물은 이 두 상태만으로 충분히 표현되지 않습니다." },
    { id: "S02.08", text: "논문은 라운드 t에서 전체 응답 중 정답인 비율을 Acc_t로 표기합니다." },
    { id: "S02.09", text: "CL_t는 현재 정답인 응답이 이번 라운드에서 수정된 뒤에도 정답으로 남을 조건부 확률입니다." },
    { id: "S02.10", text: "원래 명칭은 Confidence Level이지만 모델이 말로 보고한 자신감 점수를 뜻하지 않습니다." },
    { id: "S02.11", text: "CS_t는 현재 오답인 응답이 이번 라운드에서 수정된 뒤 정답으로 바뀔 조건부 확률입니다." },
    { id: "S02.12", text: "원래 명칭은 Critique Score이며 여기서는 의미를 드러내기 위해 오답 복구율로 읽습니다." },
    { id: "S02.13", text: "두 상태에는 정답에서 정답과 정답에서 오답과 오답에서 정답과 오답에서 오답의 네 전이가 있습니다." },
    { id: "S02.14", text: "현재 정답 집단에서 다음 라운드까지 보존되는 질량은 라운트 t 의 정확도에 정확도를 곱한 값 입니다." },
    { id: "S02.15", text: "현재 정답 집단에서 훼손되어 빠져나가는 질량은 라운트 t 의 정확도에 1 에서 정확도르 뺀 값을 곱한 값입니다." },
    { id: "S02.16", text: "현재 오답 집단에서 복구되어 들어오는 질량은 1 빼기 라운드 t 의 정확도에 복구 확률을 곱한 값입니다." },
    { id: "S02.17", text: "현재 오답 집단에서 계속 틀린 채 남는 질량은 이제 다 아시겠죠? 1 빼기 라운드 t 의 정확도에 1 에서 복구 확률을 뺀 값을 곱한 값입니다." },
    { id: "S02.18", text: "따라서 다음 정확도는 라운드 t 의 정확도에 정답이 남을 확률과, 회손된 정답이 복구될 확률을 더한뒤 곱한 값입니다." },
    { id: "S02.19", text: "이렇게 식을 정의하면, 이제 조건에 따라 어떤 상태로 전이 될지에 대한 모델을 세울 수 있습니다." },
    { id: "S02.20", text: "근데, CL_t와 CS_t를 어떻게 구할 수 있을까요? 이는 여러 응답에서 사후 계산한 집단의 조건부 전이율입니다." },
    { id: "S02.21", text: "실제 상황에서는 같은 모델이라도 데이터셋과 프롬프트와 샘플링 절차가 달라지면 두 전이율도 달라질 수 있는 점 유의하세요." },
  ],
  "scene-03": [
    { id: "S03.01", text: "이제 다음 질문은, loop 를 계속 반복할 때, 초기 조건에 따른 정확도의 상한을 알아보는겁니다." },
    { id: "S03.02", text: "CL과 CS가 라운드 동안 일정하다고 가정하면 궤적은 CS를 1 빼기 CL 더하기 CS로 나눈 고정점 Upp로 수렴합니다." },
    { id: "S03.03", text: "직관적으로 생각해봐도, 이 목적지는 CL과 CS만이 정하며 초기 정확도와는 무관합니다." },
    { id: "S03.04", text: "그래서 오른쪽 컴포넌트는 수렴 조건을 CL과 CS을 축으로 보여 줍니다." },
    { id: "S03.05", text: "화면의 색상이 밝을수록 정확도가 높고, 시안 색상의 선은 루프 시작시의 정확도를, 오른쪽은 마우스 호버한 위치에서 그래서 어디에 수렴하는지를 보여줍니다." },
    { id: "S03.06", text: "높은 적확도를 목표할수록 조건은 가혹해져서, 높은 목적지의 조합은 모서리 근처의 좁은 띠에 몰립니다." },
    { id: "S03.07", text: "예를 들어 목적지가 90퍼센트 이상인 조합은 전체 조건 공간의 약 5.6퍼센트뿐입니다." },
    { id: "S03.08", text: "논문이 Llama3-8B에서 측정한 여덟 데이터셋의 CL과 CS를 이 지도에 올리면 대부분 목적지 60에서 80퍼센트대 영역에 놓입니다." },
    { id: "S03.09", text: "목적지 90퍼센트 이상의 좁은 띠에 들어가는 실측 조합은 하나도 없습니다." },
    { id: "S03.10", text: "논문 스스로도 intrinsic self-correction의 Upp가 경험적으로 높지 않다고 논의합니다." },
    { id: "S03.11", text: "반복이 지금 이득인지는 현재 정확도와 목적지를 비교하는 경계선 하나로 판정됩니다." },
    { id: "S03.12", text: "시작 정확도가 50퍼센트일 때 개선 영역은 조건 공간의 절반입니다." },
    { id: "S03.13", text: "시작 정확도를 99퍼센트로 올리면 개선 영역은 약 0.5퍼센트로 무너집니다." },
    { id: "S03.14", text: "화면에서 페이더를 올리면 경계선이 모서리를 축으로 회전하며 실측 데이터셋이 하나씩 소등되는 것을 보실 수 있습니다." },
    { id: "S03.15", text: "흔히 말하는 손익분기, 예컨대 시작 99퍼센트에 CS 0.5일 때의 CL 99.49퍼센트는 이 경계선 위의 한 점입니다." },
    { id: "S03.16", text: "수렴 계수 α는 CL 빼기 CS이며 목적지까지의 거리가 라운드마다 줄어드는 속도만 정합니다." },
    { id: "S03.17", text: "그래서 빠른 수렴은 좋은 목적지를 보장하지 않고, 나쁜 목적지에 더 빨리 도착할 수도 있습니다." },
    { id: "S03.18", text: "모든 직선이 만나는 모서리, 즉 CL이 1인 변에서는 CS가 조금만 있어도 목적지가 100퍼센트가 됩니다." },
    { id: "S03.19", text: "기대를 충족하는 조건이 이렇게 좁다면, 질문은 반복 횟수가 아니라 어떻게 절차를 바꿔 이 지도를 다시 그릴 것인가가 됩니다." },
  ],
  "scene-04": [
    { id: "S04.01", text: "이제 이 논문에서 주장하는 모델이 실제 모델의 실행 결과를 얼마나 설명하는지 보겠습니다." },
    { id: "S04.02", text: "저자들은 질문마다 응답 다섯 개를 독립적으로 샘플링하고 각 응답에 다섯 라운드의 자기수정을 적용했습니다." },
    { id: "S04.03", text: "초기 정확도 Acc_0과 첫 수정 한 번에서 추정한 CL과 CS만으로 이후 라운드의 이론 곡선을 계산했습니다." },
    { id: "S04.04", text: "그리고 같은 절차를 실제로 반복해 얻은 궤적과 이론 곡선의 모양을 비교했습니다." },
    { id: "S04.05", text: "실험에는 오픈소스 모델 다섯 개와 Qwen-Max와 GPT-3.5 Turbo와 GPT-4 Turbo를 합친 여덟 모델이 포함되었습니다." },
    { id: "S04.06", text: "데이터셋은 여덟 종류였지만 가능한 64개 조합이 모두 실행되지는 않았습니다." },
    { id: "S04.07", text: "여기서 첫 수정 뒤 정확도 Acc_1은 같은 전이 데이터로 계산한 CL과 CS가 거의 그대로 결정합니다." },
    { id: "S04.08", text: "따라서 1라운드의 일치는 파라미터 보정이니," },
    { id: "S04.09", text: "이 모형의 실제 예측력은 보정에 쓰지 않은 2라운드부터 5라운드의 일치에서 판단해야 합니다." },
    { id: "S04.10", text: "그 구간에서 관찰된 곡선들은 상승과 포화의 형태가 이론 곡선과 정성적으로 비슷했습니다." },
    { id: "S04.11", text: "초기 정확도를 0부터 100퍼센트까지 인위적으로 바꿔도 서로 다른 시작점이 같은 고정점 방향으로 접근했습니다." },
    { id: "S04.12", text: "Llama3-8B에서는 다섯 라운드 동안 CL과 CS가 대체로 안정적이라는 정지 가정의 부분 근거도 확인했습니다." },
    { id: "S04.13", text: "정답을 찾으면 수정을 멈춰 CL을 1로 만든 보호 실험에서는 이론이 예측한 상승 곡선이 나타났습니다." },
    { id: "S04.14", text: "반대로 Are you sure 프롬프트는 CL과 고정점을 낮췄고 실제 정확도도 이론이 예측한 대로 하락했습니다." },
    { id: "S04.15", text: "다만 이 비교는 주로 곡선 모양의 시각적 일치이며 논문은 평균제곱근오차(RMSE)나 결정계수(R²)나 신뢰구간 같은 정량 적합도를 보고하지 않습니다." },
    { id: "S04.16", text: "정지 가정의 확인도 Llama3-8B 한 모델의 다섯 라운드에 한정되고 광범위한 정상성 검증은 아닙니다." },
    { id: "S04.17", text: "다섯 라운드를 넘는 반복이나 라운드 중간에 절차가 바뀌는 경우는 실험이 다루지 않았습니다." },
    { id: "S04.18", text: "2026년 현세대 frontier 모델과 reasoning 모델도 직접 실험 대상이 아니었습니다." },
    { id: "S04.19", text: "따라서 scaling theory라는 이름에 기대되는 보편적 경험 법칙 수준의 검증은 아직 없습니다." },
    { id: "S04.20", text: "하지만 이 로그에서 알 수 있듯이, verifier 가 없는 loop 는 복구와 유실 조건에 따른 점으로 수렴한다는 것을 알 수 있습니다." },
    { id: "S04.21", text: "처음에 이야기한 것 처럼, 모든 문제가 토큰을 부어서 점진적으로 개선될 수 있는것은 아니고," },
    { id: "S04.22", text: "심지어 로그 곡선을 그리며 수렴해, 매 iteration 이 진행될 수록, 정답률이 개선되는 속도도 줄어든다는것을 알 수 있습니다." },
  ],
  "scene-05": [
    { id: "S05.01", text: "다음 장면은 제가 실제 loop 를 설계하고, 운영할 때 생각하는 이미지를 시각화 해서 놓아봤습니다" },
    { id: "S05.02", text: "우리는 두 수조에서 복귀와 훼손 비율을 통해 오른쪽 수조의 수위를 최대한 높게 만들려 노력합니다." },
    { id: "S05.03", text: "이 설정에서 정확도는 복구 유입과 훼손 유출이 같아지는 수위, 즉 천장 Upp에서 평형을 이룹니다." },
    { id: "S05.04", text: "복구율 70%라는 나쁘지 않아 보이는 값에서도 훼손율이 40%면 도달할 수 있는 한계는 약 63.6%에 그칩니다." },
    { id: "S05.05", text: "한계점은 시작 정확도와 무관해서 90%에서 시작하면 반복이 오히려 수위를 끌어내립니다." },
    { id: "S05.06", text: "예제를 직접 조작하면서 확인할 수 있죠?." },
    { id: "S05.07", text: "평형에 도달한 뒤에도 흐름은 멈추지 않아서 이 예시값에서는 매 라운드 응답의 약 4분의 1이 자리만 바꿉니다." },
    { id: "S05.08", text: "그 순환에 쏟는 토큰은 수위를 올리지 못하는 비용입니다." },
    { id: "S05.09", text: "천장을 올리는 지렛대는 반복 횟수가 아니라 복구율을 높이고 훼손율을 낮추는 구조입니다." },
    { id: "S05.10", text: "맞고 그름을 판정하는 외부 verifier가 훼손 유출을 막으면 천장이 올라가고 완전한 acceptance gate는 천장을 없앱니다." },
    { id: "S05.11", text: "그래서 토큰 예산을 늘리기 전에 verifier가 있는지, 그리고 훼손을 어떻게 줄일지를 먼저 설계해야 합니다." },
    { id: "S05.12", text: "또한, llm agent 의 작업에서는 항상 정답 유실이 있다는점을 생각해야 합니다. 이는 앞으로 우리가 거대한 규모의 코드를 llm agent 로 운영하면서 보다 더 주의해야할 부분이라고 생각해요" },
  ],
  "scene-06": [
    { id: "S06.01", text: "이제 실무에서 llm loop 를 사용하는 상황을 알아보겠습니다. 가장 단순한 agent loop는 같은 프롬프트를 무한히 다시 넣는 방식입니다." },
    { id: "S06.02", text: "2025년 7월 Geoffrey Huntley가 이를 Ralph loop라 이름 붙였고 공식 Claude 플러그인으로도 구현되어 있습니다. goal 도 이와 비슷한 방식으로 동작하죠" },
    { id: "S06.03", text: "매 바퀴 컨텍스트는 초기화되고, 같은 프롬프트가 다시 들어가며, 남는 상태는 파일뿐입니다." },
    { id: "S06.04", text: "판정자도 agent 자신입니다 — 무엇이 끝났고 무엇이 좋아졌는지 스스로 판단하고, 걸러줄 gate가 없습니다." },
    { id: "S06.05", text: "같은 정책이 반복되고, 스스로 판정하니 논문의 두 상태 모형이 둔 가정과 정확히 겹칩니다." },
    { id: "S06.06", text: "따라서 Ralph loop는 논문의 모형과 가장 부합하는 예시이고, 논문의 결론이 이 loop의 예측이 됩니다." },
    { id: "S06.07", text: "성패를 정하는 것은 반복 횟수가 아니라 복구와 훼손의 동적 균형이고." },
    { id: "S06.08", text: "훼손이 verifier 없이 채택됩니다 — 망가진 상태가 그대로 다음 바퀴의 출발점이 됩니다." },
    { id: "S06.09", text: "따라서 반복을 늘려도 천장이 있습니다 — 화면의 궤적이 천장 선 아래에서 정체하고 진동합니다." },
    { id: "S06.10", text: "실제로 ralph loop 를 사용해보시면, 복잡한 요구사항을 잘 수행하지 못한다는 느낌을 받으셨을겁니다. goal 도 비슷하구요." },
    { id: "S06.11", text: "판정자가 agent 스스로면, agent가 믿는 진행과 실제 충족이 벌어지고 COMPLETE 선언은 자기 평가일 뿐입니다." },
    { id: "S06.12", text: "test를 붙이면 부분 external verifier가 생겨 천장이 올라가고 괴리가 줄지만, test가 못 보는 훼손은 여전히 채택됩니다." },
    { id: "S06.13", text: "그러므로 Ralph loop를 쓴다면 논문의 한계와 유의점이 그대로 agent 의 한계가 됩니다." },
    { id: "S06.14", text: "다음 장에서는 이 한계를 구조로 돌파한 공식 사례 autoresearch를 봅니다." },
  ],
  "scene-07": [
    { id: "S07.01", text: "앞 장 Ralph loop의 한계는 게으름이 아니라 구조의 결과였습니다 — 같은 정책의 반복, 자기 판정, gate 없음." },
    { id: "S07.02", text: "이번 장의 질문은 반대 방향입니다 — 구조를 바꾸면 그 한계가 실제로 사라지는가." },
    { id: "S07.03", text: "공식 사례가 karpathy의 autoresearch입니다 — nanoGPT의 train.py를 밤새 홀로 개선하는 overnight research loop입니다." },
    { id: "S07.04", text: "목표는 고정된 실행 시간 안에서 validation bits per byte, val_bpb를 낮추는 것 하나로 고정됩니다." },
    { id: "S07.05", text: "agent가 바꿀 수 있는 것은 train.py 하나뿐이고, 데이터와 evaluator가 담긴 prepare.py는 frozen harness로 잠급니다." },
    { id: "S07.06", text: "판정 규칙은 사람도 agent도 아닌 구조가 갖습니다 — 개선하면 keep, 같거나 나쁘면 discard와 revert, 실행 실패는 crash입니다." },
    { id: "S07.07", text: "모든 시도는 results.tsv ledger에 append되어 성공과 실패가 똑같이 기억되고 다음 제안의 memory가 됩니다." },
    { id: "S07.08", text: "Ralph에 없던 세 가지 — incumbent와 challenger의 분리, acceptance gate, append-only ledger — 가 정확히 이 지점에 들어와 있습니다." },
    { id: "S07.09", text: "첫 번째 돌파는 훼손 채택의 구조적 차단입니다." },
    { id: "S07.10", text: "재생 화면의 baseline은 수정하지 않은 train.py이고, 이를 통과한 revision이 비교 기준 incumbent가 됩니다." },
    { id: "S07.11", text: "첫 candidate는 learning rate를 올려 val_bpb를 낮췄고, gate는 keep을 선택해 incumbent가 전진합니다." },
    { id: "S07.12", text: "두 번째 candidate는 GELU 전환으로 metric이 나빠져 discard되고, 코드는 rollback되되 실패 기록은 ledger에 남습니다." },
    { id: "S07.13", text: "세 번째 candidate는 메모리 부족으로 실행조차 못 해 crash로 분류됩니다 — 유효한 측정이 없기 때문입니다." },
    { id: "S07.14", text: "공식 ledger는 crash를 영으로 기록하지만 화면에서는 최저 점수로 오해하지 않도록 측정 없음으로 표시합니다." },
    { id: "S07.15", text: "Ralph에서라면 이 훼손과 crash가 그대로 다음 바퀴의 출발점이 됐을 것입니다." },
    { id: "S07.16", text: "gate 토글을 꺼 보면 같은 네 시도가 걸러지지 않고 채택되어 궤적이 진동합니다 — 앞 장의 Ralph 궤적이 재현됩니다." },
    { id: "S07.17", text: "두 번째 돌파는 자기평가 괴리의 소거입니다 — 판정 근거가 agent의 believed가 아니라 frozen harness의 측정이기 때문입니다." },
    { id: "S07.18", text: "COMPLETE 선언 같은 자기 보고가 낄 자리가 없어, 앞 장에서 벌어졌던 believed와 actual 두 곡선이 하나로 합쳐집니다." },
    { id: "S07.19", text: "세 번째 돌파는 후퇴 없는 ratchet입니다 — incumbent는 검증된 개선에서만 교체되므로 system 궤적은 단조입니다." },
    { id: "S07.20", text: "campaign이 반환하는 것도 마지막 candidate가 아니라 검증된 best so far입니다." },
    { id: "S07.21", text: "논문의 언어로 옮기면 gate는 system 수준의 훼손을 0으로 눌러 CL_t를 1로 만드는 장치입니다." },
    { id: "S07.22", text: "수조 장면에서 본 완전 acceptance gate — 천장을 없애는 바로 그 구조가 여기서는 실제로 돌아갑니다." },
    { id: "S07.23", text: "이 등식을 전이 회계로 확인해 봅니다." },
    { id: "S07.24", text: "열두 기준 예시에서 candidate는 기존 통과 아홉 중 셋을 훼손하고 하나만 복구해 candidate 수준 CL_t는 9분의 6에 그칩니다." },
    { id: "S07.25", text: "gate가 이 candidate를 discard하면 채택된 system state는 그대로라 통과 아홉 개가 전부 보호됩니다." },
    { id: "S07.26", text: "생성 품질이 아니라 acceptance policy가 시스템의 실현 성능을 결정한다는 것이 이 표의 요지입니다." },
    { id: "S07.27", text: "단 이 회계에는 전제가 있습니다 — 기준별 통과와 실패 판정이 있어야 하며, val_bpb 같은 스칼라 하나로는 CL_t와 CS_t를 셀 수 없습니다." },
    { id: "S07.28", text: "네 번째 돌파는 끝의 구조화입니다." },
    { id: "S07.29", text: "Ralph의 끝은 agent의 COMPLETE 선언이었고, 공식 예시조차 사람이 멈출 때까지 돈다는 운영 정책을 씁니다." },
    { id: "S07.30", text: "실무 일반화에서는 한 trial의 timeout과 campaign 전체의 예산을 분리합니다." },
    { id: "S07.31", text: "그리고 success, safety, cycle, plateau, budget, human interrupt를 구조화된 stop reason으로 기록합니다." },
    { id: "S07.32", text: "여러 조건이 겹치면 안전과 harness 무결성이 성능 개선보다 먼저 평가됩니다." },
    { id: "S07.33", text: "종료할 때는 검증된 best so far와 남은 불확실성과 stop reason을 함께 반환합니다." },
    { id: "S07.34", text: "정리하면 Ralph의 네 한계 — 훼손 채택, 자기평가 괴리, 후퇴와 천장, 자의적 끝 — 이 구조물 하나씩으로 막혔습니다." },
    { id: "S07.35", text: "이 대응 역시 engineering transfer 해석입니다 — 공식 사례가 논문의 dynamics를 측정했다는 주장이 아닙니다." },
    { id: "S07.36", text: "그리고 이 구조 전체는 싸고 결정적이고 재현 가능한 외부 verifier 하나 위에 서 있습니다." },
    { id: "S07.37", text: "다음 장에서는 그 전제가 무너지는 대부분의 실무에서 이 구조를 어떻게 주의해서 옮길지 봅니다." },
  ],
  "scene-08": [
    { id: "S08.01", text: "마지막 장은 경고에서 시작합니다 — autoresearch의 돌파는 구조의 승리이기 전에 verifier의 승리입니다." },
    { id: "S08.02", text: "싸고 결정적이고 목표와 정렬된 스칼라 metric — 이 전제를 갖춘 실무 문제는 많지 않습니다." },
    { id: "S08.03", text: "첫 번째 주의: metric은 목표의 대리입니다 — val_bpb가 내려가도 실제 목표가 좋아졌는지는 별도 확인이 필요합니다." },
    { id: "S08.04", text: "proxy만 좋아지고 gold 기준이 나빠지는 metric alignment 실패는 gate가 있어도 잡히지 않습니다." },
    { id: "S08.05", text: "두 번째 주의: 현실의 verifier는 oracle이 아닙니다 — 오탐과 미탐을 따로 측정하고 훼손 차단이 완전하다는 가정을 감사해야 합니다." },
    { id: "S08.06", text: "세 번째 주의: CL_t와 CS_t와 천장은 같은 평가 집합의 집단 지표라 개별 요청의 성패를 말해 주지 않습니다." },
    { id: "S08.07", text: "네 번째 주의: 손익분기 판단에 쓰는 고정점은 장기 수렴점이 아니라 그 순간의 스냅샷입니다." },
    { id: "S08.08", text: "다섯 번째 주의: gate는 훼손을 막을 뿐 탐색을 만들어 주지 않습니다 — plateau와 반복 제안은 여전히 proposer의 문제입니다." },
    { id: "S08.09", text: "여섯 번째 주의: 외부 세계를 바꾸는 변경은 자동 keep 뒤에도 사람의 승인을 거쳐야 합니다." },
    { id: "S08.10", text: "이 주의들을 머리로 기억하는 대신 한 장의 loop policy card에 적어 둡니다." },
    { id: "S08.11", text: "첫 구역에는 실제 목표와 성공 조건을 적고, metric이 목표의 대리라는 사실을 명시합니다." },
    { id: "S08.12", text: "바꿀 artifact와 frozen harness를 분리하고, 한 trial과 campaign 전체의 예산을 따로 둡니다." },
    { id: "S08.13", text: "증거 구역에는 raw observation과 주 metric과 불확실성과 guard와 holdout을 적습니다." },
    { id: "S08.14", text: "채택 구역에는 keep과 discard와 crash와 rollback의 정확한 조건을 적습니다." },
    { id: "S08.15", text: "ledger와 memory를 구분하고, 성공·안전·정체·예산·human gate의 중단 규칙과 네 역할의 책임 분리가 뒤를 잇습니다." },
    { id: "S08.16", text: "synthetic 예시로 채워 보면 빈 구역이 곧 그 loop의 위험 목록이 됩니다." },
    { id: "S08.17", text: "논문은 반복 횟수가 아니라 정답 보존과 오답 복구의 균형을 보게 합니다." },
    { id: "S08.18", text: "Ralph에서 autoresearch까지의 거리는 모델이 아니라 verifier와 gate라는 구조가 만들었습니다." },
    { id: "S08.19", text: "좋은 agent loop는 많이 고치는 시스템이 아니라 증거 없는 변경을 채택하지 않는 시스템입니다." },
  ],
} as const satisfies Record<SceneId, readonly PresenterNote[]>;

const cutCandidates = {
  "scene-01": ["S01.06"],
  "scene-02": ["S02.04", "S02.18"],
  "scene-03": ["S03.07", "S03.10"],
  "scene-04": ["S04.05", "S04.11", "S04.13"],
  "scene-05": [],
  "scene-06": ["S06.02", "S06.09"],
  "scene-07": ["S07.02", "S07.14", "S07.29", "S07.35"],
  "scene-08": [],
} as const satisfies Record<SceneId, readonly string[]>;

const sceneBlueprints = [
  { id: "scene-01", part: "paper", speechSeconds: 64, visualSeconds: 16 },
  { id: "scene-02", part: "paper", speechSeconds: 168, visualSeconds: 32 },
  { id: "scene-03", part: "paper", speechSeconds: 152, visualSeconds: 28 },
  // 2026-07-30 대본 윤문으로 scene-04는 25→22문장, scene-05는 10→12문장.
  { id: "scene-04", part: "paper", speechSeconds: 176, visualSeconds: 40 },
  { id: "scene-05", part: "bridge", speechSeconds: 96, visualSeconds: 20 },
  { id: "scene-06", part: "practice", speechSeconds: 112, visualSeconds: 40 },
  // Scene 7·8 재설계(reports/scene7-8-autoresearch-wireframe.md)로 Scene 6
  // 회수분 88초를 재배분했다.
  { id: "scene-07", part: "practice", speechSeconds: 296, visualSeconds: 70 },
  { id: "scene-08", part: "practice", speechSeconds: 152, visualSeconds: 30 },
] as const satisfies ReadonlyArray<{
  id: SceneId;
  part: ResearchPart;
  speechSeconds: number;
  visualSeconds: number;
}>;

let plannedStartSeconds = 0;

export const SCENE_TIMINGS: readonly SceneTiming[] = sceneBlueprints.map(
  (scene, index) => {
    const sceneNotes = notes[scene.id];
    const totalSeconds = scene.speechSeconds + scene.visualSeconds;
    const timing: SceneTiming = {
      ...scene,
      index: index + 1,
      sentenceBudget: sceneNotes.length,
      totalSeconds,
      plannedStartSeconds,
      notes: sceneNotes,
      cutCandidates: cutCandidates[scene.id],
    };
    plannedStartSeconds += totalSeconds;
    return timing;
  },
);

export const SCENE_TIMING_BY_ID = Object.fromEntries(
  SCENE_TIMINGS.map((scene) => [scene.id, scene]),
) as Record<SceneId, SceneTiming>;

export const PART_LABELS: Record<ResearchPart, string> = {
  paper: "Part I · 논문 이해",
  bridge: "전환 · 적용 경계",
  practice: "Part II · Autoresearch 적용",
};

// 2026-07-30 대본 윤문(scene-04 -24초, scene-05 +16초)으로 1500→1492초.
export const PART_TOTAL_SECONDS: Record<ResearchPart, number> = {
  paper: 676,
  bridge: 116,
  practice: 700,
};

export const HARD_CHECKPOINTS = [
  { afterScene: "scene-04", label: "Part I 종료", seconds: 676 },
  { afterScene: "scene-05", label: "전환 종료", seconds: 792 },
  { afterScene: "scene-08", label: "전체 종료", seconds: 1492 },
] as const;

export const TOTAL_SENTENCE_BUDGET = 152;
export const TOTAL_SPEECH_SECONDS = 1216;
export const TOTAL_VISUAL_SECONDS = 276;
export const TOTAL_DECK_SECONDS = 1492;

function assertPresentationTimingContract() {
  const sentenceBudget = SCENE_TIMINGS.reduce(
    (sum, scene) => sum + scene.sentenceBudget,
    0,
  );
  const speechSeconds = SCENE_TIMINGS.reduce(
    (sum, scene) => sum + scene.speechSeconds,
    0,
  );
  const visualSeconds = SCENE_TIMINGS.reduce(
    (sum, scene) => sum + scene.visualSeconds,
    0,
  );
  const totalSeconds = SCENE_TIMINGS.reduce(
    (sum, scene) => sum + scene.totalSeconds,
    0,
  );
  const partSeconds = SCENE_TIMINGS.reduce<Record<ResearchPart, number>>(
    (totals, scene) => ({
      ...totals,
      [scene.part]: totals[scene.part] + scene.totalSeconds,
    }),
    { paper: 0, bridge: 0, practice: 0 },
  );
  const invalidScene = SCENE_TIMINGS.find(
    (scene) =>
      scene.speechSeconds !==
        scene.sentenceBudget * SECONDS_PER_PRESENTER_NOTE ||
      scene.totalSeconds !== scene.speechSeconds + scene.visualSeconds,
  );

  if (
    invalidScene ||
    sentenceBudget !== TOTAL_SENTENCE_BUDGET ||
    speechSeconds !== TOTAL_SPEECH_SECONDS ||
    visualSeconds !== TOTAL_VISUAL_SECONDS ||
    totalSeconds !== TOTAL_DECK_SECONDS ||
    partSeconds.paper !== PART_TOTAL_SECONDS.paper ||
    partSeconds.bridge !== PART_TOTAL_SECONDS.bridge ||
    partSeconds.practice !== PART_TOTAL_SECONDS.practice
  ) {
    throw new Error("Presenter-note and Scene timing contract is inconsistent.");
  }
}

assertPresentationTimingContract();

export function getSceneTiming(sceneId: SceneId) {
  return SCENE_TIMING_BY_ID[sceneId];
}

export function isSceneId(value: string): value is SceneId {
  return Object.hasOwn(SCENE_TIMING_BY_ID, value);
}
