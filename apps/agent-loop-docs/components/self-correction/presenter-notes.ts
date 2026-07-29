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
    { id: "S01.01", text: "오늘 먼저 살펴볼 논문은 LLM이 답을 반복해서 고칠 때 정확도가 어떻게 변하는지를 확률 모형으로 설명합니다." },
    { id: "S01.02", text: "여기서 scaling은 모델을 더 크게 학습하는 일이 아니라 추론 시점의 수정 라운드를 늘리는 일을 뜻합니다." },
    { id: "S01.03", text: "흔한 직관은 다시 생각할 기회를 주면 답이 계속 좋아질 것이라는 기대입니다." },
    { id: "S01.04", text: "그러나 실제 자기수정에서는 틀린 답이 맞아지는 동시에 맞던 답이 틀어질 수 있습니다." },
    { id: "S01.05", text: "따라서 반복 횟수만으로는 다음 라운드의 정확도가 오를지 내릴지 결정할 수 없습니다." },
    { id: "S01.06", text: "논문은 오답에서 정답으로 들어오는 흐름과 정답에서 오답으로 빠져나가는 흐름을 따로 측정합니다." },
    { id: "S01.07", text: "그리고 두 흐름을 하나의 전이식으로 묶어 여러 라운드의 정확도 궤적을 설명합니다." },
    { id: "S01.08", text: "핵심 명제는 자기수정의 순효과가 복구 이득과 훼손 손실의 차이로 정해진다는 것입니다." },
  ],
  "scene-02": [
    { id: "S02.01", text: "논문의 직접적인 연구 대상은 같은 모델이 외부 정보 없이 자신의 이전 답을 다시 검토하는 intrinsic self-correction입니다." },
    { id: "S02.02", text: "각 라운드에서는 이전 응답을 같은 수정 절차에 다시 넣어 다음 응답을 만듭니다." },
    { id: "S02.03", text: "검색 결과와 코드 실행 결과와 사람의 피드백처럼 새로운 관측이 들어오는 절차는 직접 다루지 않습니다." },
    { id: "S02.04", text: "따라서 이 연구의 inference scaling은 학습 파라미터나 모델 크기를 키우는 scaling과 구분해야 합니다." },
    { id: "S02.05", text: "분석 대상은 매 응답을 정답 또는 오답으로 판정할 수 있는 과제입니다." },
    { id: "S02.06", text: "이 판정에는 모델의 자기평가가 아니라 정답표나 테스트처럼 외부에서 확인한 기준이 필요합니다." },
    { id: "S02.07", text: "유용성과 안전성과 문체를 함께 보는 장문 산출물은 이 두 상태만으로 충분히 표현되지 않습니다." },
    { id: "S02.08", text: "논문은 라운드 t에서 전체 응답 중 정답인 비율을 Acc_t로 표기합니다." },
    { id: "S02.09", text: "CL_t는 현재 정답인 응답이 이번 라운드에서 수정된 뒤에도 정답으로 남을 조건부 확률입니다." },
    { id: "S02.10", text: "원래 명칭은 Confidence Level이지만 모델이 말로 보고한 자신감 점수를 뜻하지 않습니다." },
    { id: "S02.11", text: "CS_t는 현재 오답인 응답이 이번 라운드에서 수정된 뒤 정답으로 바뀔 조건부 확률입니다." },
    { id: "S02.12", text: "원래 명칭은 Critique Score이며 여기서는 의미를 드러내기 위해 오답 복구율로 읽습니다." },
    { id: "S02.13", text: "두 상태에는 정답에서 정답과 정답에서 오답과 오답에서 정답과 오답에서 오답의 네 전이가 있습니다." },
    { id: "S02.14", text: "현재 정답 집단에서 다음 라운드까지 보존되는 질량은 Acc_t 곱하기 CL_t입니다." },
    { id: "S02.15", text: "현재 정답 집단에서 훼손되어 빠져나가는 질량은 Acc_t 곱하기 1 빼기 CL_t입니다." },
    { id: "S02.16", text: "현재 오답 집단에서 복구되어 들어오는 질량은 1 빼기 Acc_t에 CS_t를 곱한 값입니다." },
    { id: "S02.17", text: "현재 오답 집단에서 계속 틀린 채 남는 질량은 1 빼기 Acc_t에 1 빼기 CS_t를 곱한 값입니다." },
    { id: "S02.18", text: "따라서 다음 정확도는 Acc_t 곱하기 CL_t 더하기 1 빼기 Acc_t에 CS_t를 곱한 값으로 계산됩니다." },
    { id: "S02.19", text: "이 식은 보존된 정답과 새로 복구된 정답을 더하는 확률 회계입니다." },
    { id: "S02.20", text: "CL_t와 CS_t는 개별 응답의 예언값이 아니라 여러 응답에서 사후 계산한 집단의 조건부 전이율입니다." },
    { id: "S02.21", text: "같은 모델이라도 데이터셋과 프롬프트와 샘플링 절차가 달라지면 두 전이율도 달라질 수 있습니다." },
  ],
  "scene-03": [
    { id: "S03.01", text: "한 라운드의 순변화는 다음 정확도에서 현재 정확도를 빼면 드러납니다." },
    { id: "S03.02", text: "정리하면 순변화는 1 빼기 Acc_t에 CS_t를 곱한 값에서 Acc_t에 1 빼기 CL_t를 곱한 값을 뺀 결과입니다." },
    { id: "S03.03", text: "첫 항은 기존 오답 가운데 이번 수정으로 되찾은 복구 이득입니다." },
    { id: "S03.04", text: "둘째 항은 기존 정답 가운데 이번 수정으로 잃은 훼손 손실입니다." },
    { id: "S03.05", text: "평균 정확도가 오르려면 복구 이득이 훼손 손실보다 커야 합니다." },
    { id: "S03.06", text: "화면에서는 복구 이득과 훼손 손실의 대소가 바뀌는 순간을 손익분기로 표시합니다." },
    { id: "S03.07", text: "CL_t에 대한 손익분기값은 현재 정확도와 CS_t를 넣어 바로 계산할 수 있습니다." },
    { id: "S03.08", text: "초기 정확도가 높아질수록 복구할 오답의 몫은 작아지고 보호해야 할 정답의 몫은 커집니다." },
    { id: "S03.09", text: "그래서 강한 초기 응답일수록 작은 훼손률도 복구 이득을 쉽게 상쇄할 수 있습니다." },
    { id: "S03.10", text: "이제 현재 정확도가 99퍼센트이고 CS_t가 0.5인 예를 보겠습니다." },
    { id: "S03.11", text: "전체 응답에서 남아 있는 오답은 1퍼센트입니다." },
    { id: "S03.12", text: "그 오답의 절반을 복구해도 전체 정확도의 이득은 0.5퍼센트포인트입니다." },
    { id: "S03.13", text: "반면 기존 정답의 훼손 손실은 0.99 곱하기 1 빼기 CL_t입니다." },
    { id: "S03.14", text: "이득을 내려면 0.005가 0.99 곱하기 1 빼기 CL_t보다 커야 합니다." },
    { id: "S03.15", text: "따라서 손익분기 정답 보존율은 약 99.49퍼센트입니다." },
    { id: "S03.16", text: "이는 기존 정답의 약 0.51퍼센트만 훼손해도 복구 이득이 사라진다는 뜻입니다." },
    { id: "S03.17", text: "정확히 손익분기점에서는 수정 전후의 평균 정확도가 같습니다." },
    { id: "S03.18", text: "예를 들어 CL_t가 99퍼센트라면 다음 정확도는 98.51퍼센트로 0.49퍼센트포인트 내려갑니다." },
    { id: "S03.19", text: "이 수치는 특정 모델의 측정 결과가 아니라 전이식의 위험 구조를 보여주는 계산 예시입니다." },
  ],
  "scene-04": [
    { id: "S04.01", text: "여러 라운드의 닫힌식을 얻으려면 CL과 CS가 반복 동안 일정하다고 추가로 가정해야 합니다." },
    { id: "S04.02", text: "이 가정 아래 다음 정확도는 CL 빼기 CS에 현재 정확도를 곱한 뒤 CS를 더한 값입니다." },
    { id: "S04.03", text: "논문이 Upp로 쓰는 정확도 수렴 상한은 CS를 1 빼기 CL 더하기 CS로 나눈 값입니다." },
    { id: "S04.04", text: "다만 CL이 1이고 CS가 0이면 분모가 0이므로 단일 고정점 공식을 적용하지 않습니다." },
    { id: "S04.05", text: "Upp에서는 오답 복구 이득과 정답 훼손 손실이 정확히 균형을 이룹니다." },
    { id: "S04.06", text: "논문이 주로 다루는 α가 0과 1 사이인 구간에서는 현재 정확도가 Upp보다 낮으면 평균 궤적이 Upp를 향해 올라갑니다." },
    { id: "S04.07", text: "같은 구간에서 현재 정확도가 Upp보다 높으면 평균 궤적은 오히려 Upp를 향해 내려갑니다." },
    { id: "S04.08", text: "논문은 Upp를 upper bound라고 부르지만 수학적으로는 점근적 고정점이라고 읽는 편이 정확합니다." },
    { id: "S04.09", text: "따라서 Upp는 모델의 절대 능력 상한이 아니라 특정 데이터와 프롬프트와 수정 절차가 만드는 목적지입니다." },
    { id: "S04.10", text: "수렴 계수 α는 CL 빼기 CS로 정의됩니다." },
    { id: "S04.11", text: "논문의 닫힌식은 Acc_t가 Upp에서 α의 t제곱과 Upp 빼기 Acc_0을 곱한 값을 뺀 결과라고 씁니다." },
    { id: "S04.12", text: "고정점까지의 편차는 라운드마다 α배가 되므로 α의 절댓값이 수렴 속도를 정합니다." },
    { id: "S04.13", text: "작은 α의 절댓값은 더 빠른 접근을 뜻할 뿐 더 높은 고정점을 보장하지 않습니다." },
    { id: "S04.14", text: "α가 0과 1 사이면 단조롭게 접근하지만 음수면 고정점 양쪽을 오갈 수 있습니다." },
    { id: "S04.15", text: "저자들은 초기 정확도 Acc_0과 첫 수정에서 얻은 CL과 CS로 이후 정확도 곡선을 계산했습니다." },
    { id: "S04.16", text: "그리고 같은 reask 절차를 실제로 다섯 라운드까지 반복해 예측한 2회차부터 5회차의 궤적과 비교했습니다." },
    { id: "S04.17", text: "각 질문에서는 응답 다섯 개를 독립적으로 샘플링하고 평균 정확도를 사용했습니다." },
    { id: "S04.18", text: "실험에는 오픈소스 모델 다섯 개와 Qwen-Max와 GPT-3.5 Turbo와 GPT-4 Turbo를 합친 여덟 모델이 포함되었습니다." },
    { id: "S04.19", text: "데이터셋은 GSM8K와 HumanEval과 MMLU 등을 포함해 생성 과제와 분류 과제를 섞은 여덟 종류였습니다." },
    { id: "S04.20", text: "다만 여덟 모델과 여덟 데이터셋이 만드는 64개 조합을 모두 실행한 것은 아닙니다." },
    { id: "S04.21", text: "Llama3-8B에서는 다섯 라운드 동안 CL과 CS가 대체로 안정적인 사례도 확인했습니다." },
    { id: "S04.22", text: "여러 설정의 상승과 포화 모양은 이론 곡선과 정성적으로 비슷했고 Are you sure 프롬프트의 하락 사례도 설명되었습니다." },
    { id: "S04.23", text: "첫 수정 뒤의 Acc_1은 같은 전이 데이터에 맞춰지므로 미래 예측력은 주로 2회차 이후에서 판단해야 합니다." },
    { id: "S04.24", text: "논문은 곡선을 시각적으로 비교했지만 평균제곱근오차(RMSE), 결정계수(R²), 신뢰구간 같은 정량 적합도 지표는 보고하지 않았습니다." },
    { id: "S04.25", text: "결과는 다섯 라운드의 유용한 일차 근사를 지지할 뿐 보편 법칙이나 이후 반복을 입증하지 않습니다." },
  ],
  "scene-05": [
    { id: "S05.01", text: "실행 로그나 웹 서치, 휴먼 피드백 같은 외부 검증이 없는 loop는 논문이 직접 다룬 intrinsic self-correction 설정 그 자체입니다." },
    { id: "S05.02", text: "이 설정에서 정확도는 복구 유입과 훼손 유출이 같아지는 수위, 즉 천장 Upp에서 평형을 이룹니다." },
    { id: "S05.03", text: "복구율 70%라는 나쁘지 않아 보이는 값에서도 훼손율이 40%면 천장은 약 63.6%에 그칩니다." },
    { id: "S05.04", text: "천장은 시작 정확도와 무관해서 90%에서 시작하면 반복이 오히려 수위를 끌어내립니다." },
    { id: "S05.05", text: "이 수치는 논문 실험의 측정 결과가 아니라 전이식에 값을 넣은 수학적 예시입니다." },
    { id: "S05.06", text: "평형에 도달한 뒤에도 흐름은 멈추지 않아서 이 예시값에서는 매 라운드 응답의 약 4분의 1이 자리만 바꿉니다." },
    { id: "S05.07", text: "그 순환에 쏟는 토큰은 수위를 올리지 못하는 비용입니다." },
    { id: "S05.08", text: "천장을 올리는 지렛대는 반복 횟수가 아니라 복구율을 높이고 훼손율을 낮추는 구조입니다." },
    { id: "S05.09", text: "정오를 자동 판정하는 외부 verifier가 훼손 유출을 막으면 천장이 올라가고 완전한 acceptance gate는 천장을 없앱니다." },
    { id: "S05.10", text: "그래서 토큰 예산을 늘리기 전에 verifier가 있는지, 그리고 훼손을 어떻게 줄일지를 먼저 설계해야 합니다." },
  ],
  "scene-06": [
    { id: "S06.01", text: "공식 Autoresearch 저장소는 GPU(graphics processing unit) 한 개에서 작은 언어 모델 학습 코드를 에이전트가 반복 개선하도록 구성합니다." },
    { id: "S06.02", text: "공식 구현에서 데이터 준비와 평가를 담은 prepare.py는 고정되고 에이전트는 train.py 하나만 수정합니다." },
    { id: "S06.03", text: "이 제한은 탐색 범위를 작게 만들고 변경 차이를 검토 가능한 크기로 유지합니다." },
    { id: "S06.04", text: "각 학습 실행에는 시작과 컴파일을 제외한 벽시계 기준 5분이 똑같이 주어집니다." },
    { id: "S06.05", text: "공식 주 지표는 검증 데이터의 바이트당 비트 수인 val_bpb이며 값이 낮을수록 좋습니다." },
    { id: "S06.06", text: "고정된 시간과 평가기는 서로 다른 구조와 하이퍼파라미터를 같은 시험대에서 비교하게 합니다." },
    { id: "S06.07", text: "첫 실행은 수정하지 않은 코드의 baseline을 세워 비교 기준을 만듭니다." },
    { id: "S06.08", text: "에이전트는 실험 아이디어로 코드를 바꾸고 변경을 commit한 뒤 같은 절차로 실행합니다." },
    { id: "S06.09", text: "실행 뒤에는 metric과 peak memory와 상태와 시도 내용을 tab-separated ledger에 기록합니다." },
    { id: "S06.10", text: "metric이 낮아지면 공식 규칙은 commit을 keep하고 branch를 새 incumbent로 전진시킵니다." },
    { id: "S06.11", text: "metric이 같거나 나빠지면 candidate를 discard하고 시작했던 commit으로 되돌립니다." },
    { id: "S06.12", text: "실행이 무너지면 쉬운 오류는 고쳐 다시 돌리고 근본적으로 깨진 아이디어는 crash로 기록합니다." },
    { id: "S06.13", text: "공식 지침은 실험 loop가 시작되면 사람이 중단할 때까지 계속 실행하도록 요구합니다." },
    { id: "S06.14", text: "여기까지가 저장소에 명시된 running example이고 지금부터는 이를 재사용 가능한 구조로 해부한 발표의 일반화입니다." },
    { id: "S06.15", text: "첫 층인 research contract는 목표와 mutable scope와 frozen harness와 metric과 trial budget을 고정합니다." },
    { id: "S06.16", text: "두 번째 층인 experiment loop는 incumbent에서 가설을 만들고 격리된 candidate를 실행해 observation을 얻습니다." },
    { id: "S06.17", text: "proposer는 가능성을 만들고 executor는 실행하며 evaluator는 관측을 비교 가능한 evidence로 바꿉니다." },
    { id: "S06.18", text: "controller는 evidence와 constraint를 읽고 keep이나 discard나 crash라는 verdict를 내립니다." },
    { id: "S06.19", text: "keep일 때만 candidate가 다음 incumbent가 되고 나머지 판정에서는 기존 incumbent가 남습니다." },
    { id: "S06.20", text: "모든 시도의 hypothesis와 diff와 observation과 verdict는 append-only ledger에 누적됩니다." },
    { id: "S06.21", text: "공식 에이전트 지침 문서는 proposal policy이고 results.tsv는 experiment ledger이므로 둘 다 압축된 memory와는 다릅니다." },
    { id: "S06.22", text: "이 contract와 역할 구분을 다시 정의하면 같은 구조를 코드와 문서와 데이터 탐색에도 적용할 수 있습니다." },
  ],
  "scene-07": [
    { id: "S07.01", text: "재생 화면의 시작점은 baseline을 통과해 현재 비교 기준이 된 incumbent입니다." },
    { id: "S07.02", text: "첫 candidate가 더 낮은 주 metric과 허용 가능한 peak memory 사용량을 보이면 gate는 keep을 선택합니다." },
    { id: "S07.03", text: "이때 branch와 incumbent는 candidate revision으로 함께 전진합니다." },
    { id: "S07.04", text: "두 번째 candidate가 실행에는 성공해도 metric이 나빠지면 verdict는 discard입니다." },
    { id: "S07.05", text: "discard 뒤에는 코드를 이전 incumbent로 rollback하되 실패 기록은 ledger에 남깁니다." },
    { id: "S07.06", text: "세 번째 candidate가 메모리 부족으로 실행되지 않으면 유효한 성능 측정 없이 crash로 분류합니다." },
    { id: "S07.07", text: "공식 crash sentinel은 영이지만 화면에서는 최고 점수로 오해하지 않도록 측정 없음으로 표시합니다." },
    { id: "S07.08", text: "세 결과의 공통점은 candidate의 운명과 incumbent의 상태를 별도로 기록한다는 것입니다." },
    { id: "S07.09", text: "그러므로 campaign이 반환할 대상은 마지막 candidate가 아니라 검증된 best so far입니다." },
    { id: "S07.10", text: "이제 논문의 CL_t와 CS_t를 적용하려면 먼저 평가 단위마다 통과와 실패를 판정할 수 있는지 확인합니다." },
    { id: "S07.11", text: "candidate 수준 CL_t는 incumbent가 통과하던 기준 중 candidate에서도 계속 통과한 비율입니다." },
    { id: "S07.12", text: "candidate 수준 CS_t는 incumbent가 실패하던 기준 중 candidate에서 새로 통과한 비율입니다." },
    { id: "S07.13", text: "candidate가 새 실패를 많이 만들면 복구가 있어도 candidate 수준 훼손 손실이 커질 수 있습니다." },
    { id: "S07.14", text: "gate가 그 candidate를 discard하면 채택된 system state는 바뀌지 않아 기존 통과 항목이 보호됩니다." },
    { id: "S07.15", text: "반대로 keep된 candidate의 보존과 복구 전이만 다음 system state의 CL_t와 CS_t에 반영됩니다." },
    { id: "S07.16", text: "이 구분은 생성 성능보다 acceptance policy가 시스템의 실현 성능을 결정한다는 점을 보여 줍니다." },
    { id: "S07.17", text: "다만 연속형 metric 하나는 사례별 전이표를 제공하지 않으므로 CL_t와 CS_t를 계산할 충분한 정보가 아닙니다." },
    { id: "S07.18", text: "또한 다음 제안이 ledger와 memory에 따라 달라지므로 고정된 CL과 CS의 고정점 Upp를 campaign 예측값으로 쓰지 않습니다." },
    { id: "S07.19", text: "결과가 나쁘면 먼저 proposer와 executor와 evaluator와 controller 중 어느 경계가 실패했는지 국소화합니다." },
    { id: "S07.20", text: "비슷한 candidate가 반복되면 proposer의 탐색 폭과 memory 입력을 점검합니다." },
    { id: "S07.21", text: "crash가 몰리면 가설의 품질보다 실행 환경과 dependency와 자원 한도를 먼저 확인합니다." },
    { id: "S07.22", text: "관측이 비거나 흔들리면 instrumentation과 평가 분산과 데이터 버전을 조사합니다." },
    { id: "S07.23", text: "proxy metric만 좋아지고 gold 기준이 나빠지면 metric alignment 실패로 분류합니다." },
    { id: "S07.24", text: "더 나쁜 candidate가 incumbent를 덮어쓰면 selector와 비교 기준이 고장 난 것입니다." },
    { id: "S07.25", text: "폐기한 실험이 반복되면 raw ledger가 다음 proposal memory로 전달되는 경로를 추적합니다." },
    { id: "S07.26", text: "candidate가 frozen harness까지 바꿀 수 있다면 개선보다 contract 무결성 위반을 먼저 의심합니다." },
    { id: "S07.27", text: "공식 예시는 사람의 interrupt까지 계속 돌지만 실무 일반화에서는 한 trial의 timeout과 전체 campaign의 stopping budget을 분리합니다." },
    { id: "S07.28", text: "campaign은 success와 safety와 cycle과 plateau와 budget과 human interrupt를 구조화된 stop reason으로 기록합니다." },
    { id: "S07.29", text: "여러 종료 조건이 겹치면 안전과 하네스 무결성을 성능 개선보다 먼저 평가합니다." },
    { id: "S07.30", text: "종료할 때는 검증된 best so far와 남은 불확실성과 stop reason을 함께 반환합니다." },
  ],
  "scene-08": [
    { id: "S08.01", text: "최종 화면은 우리가 운영할 loop policy를 한 장의 contract card로 압축합니다." },
    { id: "S08.02", text: "첫 줄에는 실제 목표와 그 목표를 대신 관측할 주 metric을 나란히 적습니다." },
    { id: "S08.03", text: "목표와 metric이 다르다는 사실을 명시해야 proxy 개선을 최종 성공으로 오인하지 않습니다." },
    { id: "S08.04", text: "다음 줄에는 바꿀 수 있는 artifact와 절대 바꾸지 않을 harness를 구분합니다." },
    { id: "S08.05", text: "baseline과 incumbent의 revision과 score와 provenance를 함께 저장해 비교 기준을 고정합니다." },
    { id: "S08.06", text: "proposal rule에는 사용할 evidence와 허용된 diff 범위와 금지된 변경을 적습니다." },
    { id: "S08.07", text: "execution rule에는 격리 방식과 재현 조건과 trial timeout과 비용 한도를 적습니다." },
    { id: "S08.08", text: "evaluation rule에는 raw observation과 metric 계산과 guard test와 gold regression check를 분리해 둡니다." },
    { id: "S08.09", text: "selection rule에는 keep과 discard와 crash와 rollback의 정확한 조건을 적습니다." },
    { id: "S08.10", text: "ledger schema에는 hypothesis와 revision과 observation과 verdict와 비용과 stop reason을 남깁니다." },
    { id: "S08.11", text: "memory policy에는 어떤 기록을 압축하고 언제 원문 ledger로 돌아갈지 정합니다." },
    { id: "S08.12", text: "campaign policy에는 성공과 안전과 반복과 정체와 예산과 human interrupt 종료를 둡니다." },
    { id: "S08.13", text: "고위험 외부 변경에는 자동 keep 뒤에도 별도의 사람 승인을 요구합니다." },
    { id: "S08.14", text: "논문의 멘탈 모델은 이 정책에서 복구 이득과 훼손 손실을 분리해 acceptance gate를 진단하게 합니다." },
    { id: "S08.15", text: "실무형 agent loop의 지능은 후보 수보다 비교 가능한 실험과 보수적 채택과 실패의 기억에 있습니다." },
  ],
} as const satisfies Record<SceneId, readonly PresenterNote[]>;

const cutCandidates = {
  "scene-01": ["S01.06"],
  "scene-02": ["S02.04", "S02.18"],
  "scene-03": ["S03.07", "S03.15"],
  "scene-04": ["S04.11", "S04.17", "S04.21"],
  "scene-05": [],
  "scene-06": ["S06.03", "S06.12"],
  "scene-07": ["S07.07", "S07.20", "S07.25", "S07.28"],
  "scene-08": [],
} as const satisfies Record<SceneId, readonly string[]>;

const sceneBlueprints = [
  { id: "scene-01", part: "paper", speechSeconds: 64, visualSeconds: 16 },
  { id: "scene-02", part: "paper", speechSeconds: 168, visualSeconds: 32 },
  { id: "scene-03", part: "paper", speechSeconds: 152, visualSeconds: 28 },
  { id: "scene-04", part: "paper", speechSeconds: 200, visualSeconds: 40 },
  { id: "scene-05", part: "bridge", speechSeconds: 80, visualSeconds: 20 },
  { id: "scene-06", part: "practice", speechSeconds: 176, visualSeconds: 64 },
  { id: "scene-07", part: "practice", speechSeconds: 240, visualSeconds: 70 },
  { id: "scene-08", part: "practice", speechSeconds: 120, visualSeconds: 30 },
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

export const PART_TOTAL_SECONDS: Record<ResearchPart, number> = {
  paper: 700,
  bridge: 100,
  practice: 700,
};

export const HARD_CHECKPOINTS = [
  { afterScene: "scene-04", label: "Part I 종료", seconds: 700 },
  { afterScene: "scene-05", label: "전환 종료", seconds: 800 },
  { afterScene: "scene-08", label: "전체 종료", seconds: 1500 },
] as const;

export const TOTAL_SENTENCE_BUDGET = 150;
export const TOTAL_SPEECH_SECONDS = 1200;
export const TOTAL_VISUAL_SECONDS = 300;
export const TOTAL_DECK_SECONDS = 1500;

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
