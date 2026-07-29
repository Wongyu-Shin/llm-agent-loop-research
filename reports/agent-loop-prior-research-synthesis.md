# LLM agent loop: 선행연구 기반 증거 종합

- 작성일: 2026-07-28
- 상태: structured narrative review v0.2
- 문헌 기준일: 2026-07-28
- 질문: LLM과 harness가 유지하는 상태 중 무엇이 agent loop의 성능을 만들며, loop의 성공과 실패 조건에 관해 선행연구가 실제로 어디까지 입증했는가?
- 범위: peer-reviewed LLM-agent·self-correction·test-time search 연구를 중심으로 하고, POMDP·제어이론은 해석 경계를 정하는 보조 문헌으로만 사용한다.
- 관련 문서:
  - [제어이론적 해석 노트](agent-loop-control-theory-reformulation.md)
  - [모델 대응과 수렴 조건](agent-loop-model-correspondence-and-convergence.md)
  - [원인 식별 실험 프로토콜](agent-loop-causal-diagnostic-protocol.md)

## 0. 결론

선행연구가 가장 일관되게 지지하는 결론은 다음이다.

> Agent loop의 성능 단위는 LLM 단독이 아니라, 환경 관측, episode memory, planning·search state, tool interface, verifier와 selection rule이 결합된 시스템이다. 그러나 이 사실은 그 시스템 안에 명시적 world model, PID, MPC 또는 안정성이 구현되었다는 증거가 아니다.

구체적으로는 다음 다섯 가지가 비교적 강하게 지지된다.

1. **새로운 환경 관측은 다음 행동을 바꿀 수 있다.** ReAct는 reasoning과 environment action을 교차시키고, Inner Monologue는 success detection·scene feedback 같은 폐루프 언어 feedback이 embodied task completion을 개선함을 보였다.
2. **외부 memory의 내용과 갱신 방식이 행동을 바꾸지만, state의 양과 성능은 단조 관계가 아니다.** Reflexion의 episodic verbal memory, Generative Agents의 observation·reflection·planning memory, Voyager와 Agent Workflow Memory의 재사용 가능한 skill·workflow는 task-specific한 효과를 보였다. 반면 SWE-agent에서는 full history와 full-file view가 선택적으로 압축한 context보다 낮았다. Agent Workflow Memory에서는 NL state와 filtered HTML을 함께 넣어 context를 늘린 조건이 둘 중 하나만 넣은 조건보다 낮았고, 저자들은 irrelevant HTML과 online에서 잘못 유도된 workflow가 성능을 저하시킬 수 있다고 분석했다.
3. **Harness와 action interface는 모델과 별개의 성능 변수다.** SayCan은 language prior와 실행 가능성 값을 결합했고, SWE-agent는 agent-computer interface 설계가 동일 계열 모델의 repository navigation·editing·testing 능력에 큰 영향을 줄 수 있음을 보였다.
4. **반복의 이득에는 correction 이외의 mechanism이 있다.** Tree of Thoughts와 LATS는 search·selection을 사용한다. Agentless는 복잡한 autonomous loop 없이 localization–repair–validation pipeline으로 강한 coding 결과를 냈다.
5. **자기비평 자체는 일반적으로 신뢰할 수 없다.** Intrinsic self-correction은 reasoning 성능을 악화시키기도 하며, 비판적 종합 연구는 feedback source·검증 가능성·correction training을 분리해 판단해야 한다고 정리한다.

따라서 현재 문헌에 가장 가까운 설명은 다음이다.

```text
observed loop gain may come from one or more of
  {new-information correction,
   cross-step·cross-episode state reuse,
   action grounding,
   search·selection,
   learned correction}

and is conditioned by
  {evaluator reliability, task structure, compute·cost budget}
```

각 task가 이 mechanism을 모두 필요로 한다는 뜻은 아니다. 예를 들어 one-shot reasoning search에는 tool interface가 없을 수 있고, Agentless형 pipeline은 autonomous corrective loop 없이도 작동한다. 핵심은 반복 호출 횟수 자체가 아니라 **어떤 mechanism이 어떤 조건에서 이득을 냈는지** 분리하는 것이다.

또한 기존 연구가 말하는 `success`, `pass@1`, instruction completion은 대부분 유한 budget의 경험적 결과다. 이를 제어이론의 점근적 수렴이나 stability proof로 읽어서는 안 된다.

## 1. 문헌 검토 방법

### 1.1 검토 방식

이 문서는 PRISMA 절차를 수행한 systematic review가 아니라, 현재 연구 질문에 맞춘 **structured narrative review**다.

선정 우선순위는 다음과 같다.

1. peer-reviewed primary study의 component ablation·controlled comparison
2. peer-reviewed system paper의 end-to-end 비교
3. peer-reviewed critical survey 또는 evaluation methodology
4. 고전 이론의 원문
5. 2026년 preprint는 최근 방향을 보여 주는 보조 자료로만 사용

제품 blog, leaderboard 숫자, framework 문서는 핵심 결론의 근거로 사용하지 않았다. 한 연구의 benchmark 결과를 다른 task family의 일반 법칙으로 확장하지 않았다.

### 1.2 근거 유형

| 표기 | 의미 | 허용되는 주장 |
| --- | --- | --- |
| Direct | 관련 component를 제거·교체하거나 가까운 baseline과 비교한 peer-reviewed 실험 | 해당 model·task·평가 조건에서 component의 효과 |
| System | 여러 component를 결합한 peer-reviewed system 결과 | 결합 architecture의 유효성, 개별 component의 독립 효과는 아님 |
| Synthesis | peer-reviewed survey·critical review | 여러 연구에 걸친 경향과 평가상 주의점 |
| Evaluation | peer-reviewed benchmark·metric 연구 | 무엇을 어떻게 측정해야 하는지; agent mechanism의 독립 효과는 아님 |
| Transfer | POMDP·제어·시스템 식별의 원 이론 | 분석 언어와 필요조건; LLM agent에 대한 직접 실증은 아님 |
| Emerging | preprint 또는 아직 독립 검증이 제한된 최근 결과 | 후속 검증할 가설 |

### 1.3 이번 개정에서 채택한 주장 규칙

- 논문이 보여 준 outcome과 domain을 같은 문장에 쓴다.
- `memory`, `reflection`, `planning`, `feedback`이라는 이름이 같아도 구현이 다르면 같은 mechanism으로 합치지 않는다.
- End-to-end 성능 향상을 특정 state 하나의 효과로 귀속하지 않는다.
- Agent 논문이 보고하지 않은 `stability`, `gain`, `world model`은 선행연구의 결론으로 쓰지 않는다.
- 긍정 결과와 부정 결과가 충돌하면 feedback source, task self-verifiability, model training, evaluator를 먼저 분해한다.

## 2. 선행연구가 정의하는 agent의 기본 단위

[Wang et al.의 peer-reviewed survey](https://doi.org/10.1007/s11704-024-40231-1)는 LLM-based autonomous agent를 profile, memory, planning, action module로 조직한다. 이 분류는 제어이론에서 나온 것이 아니라 agent 문헌 자체에서 정리된 architecture taxonomy다.

이 taxonomy에서 이미 중요한 점은 LLM output만으로 agent를 정의하지 않는다는 것이다.

```text
profile·instruction
      ↓
memory ↔ planning
      ↓
action interface ↔ environment
```

[ReAct](https://openreview.net/forum?id=WE_vluYUL-X)는 reasoning trace와 environment action·observation을 interleave한다. [SWE-agent](https://proceedings.neurips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html)는 model이 사용하는 computer interface 자체를 연구 대상으로 삼았다. 따라서 “같은 LLM이면 같은 agent”라는 가정은 선행연구의 architecture 단위와 맞지 않는다.

다만 이 문헌은 agent를 고전 제어기의 종류로 분류하지 않는다. `LLM+harness = dynamic output-feedback controller`라는 표현은 전체 system boundary를 분석하기 위한 **Transfer 수준의 해석**이다.

## 3. 핵심 claim–evidence matrix

| 연구 질문에 필요한 claim | 핵심 선행연구 | 직접 확인된 내용 | 적용 경계 | 근거 |
| --- | --- | --- | --- | --- |
| 환경 관측을 다음 reasoning·action에 넣으면 open-loop plan의 오류를 수정할 수 있다. | [ReAct, ICLR 2023](https://openreview.net/forum?id=WE_vluYUL-X) | Reasoning과 acting을 interleave하고 외부 source·environment에서 정보를 얻는 방식이 여러 language·interactive task에서 baseline을 개선했다. | ReAct prompt와 해당 benchmark; 일반 stability 결과가 아님 | Direct |
| Closed-loop language feedback가 embodied planning을 개선할 수 있다. | [Inner Monologue, CoRL 2022](https://proceedings.mlr.press/v205/huang23c.html) | Success detection, scene description, human interaction feedback를 받은 조건이 simulated·real robotic domains의 instruction completion을 개선했다. | 고수준 robotic planning; 빠른 low-level control과 다름 | Direct |
| 현재 state에서 실행 가능한 action을 별도 값으로 grounding하는 것이 중요하다. | [SayCan, 2022](https://research.google/pubs/do-as-i-can-not-as-i-say-grounding-language-in-robotic-affordances/) | Language-model score와 learned affordance·value를 결합해 semantic usefulness와 실행 가능성을 함께 선택했다. | 사전 정의된 robotic skill set | System |
| Episode 간 verbal reflection이 raw trajectory memory와 다른 효과를 낼 수 있다. | [Reflexion, NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/file/1b44b878bb782e6954cd888628510e90-Paper-Conference.pdf) | HotPotQA의 CoT(GT) 100문항 조건에서 최근 raw trajectory만 episodic memory에 넣은 조건보다 self-reflection을 추가한 조건이 accuracy를 8 percentage points 높였다. | 작은 HotPotQA subset의 in-context mechanism; 전체 Reflexion 결과는 evaluator·memory·reflection의 결합 효과 | Direct |
| Observation·reflection·planning memory가 행동 품질에 기여할 수 있다. | [Generative Agents, UIST 2023](https://doi.org/10.1145/3586183.3606763) | Architecture ablation에서 observation, reflection, planning component가 believable behavior 평가에 각각 기여했다. | 목표가 task correctness가 아니라 believability인 social simulation | Direct |
| Executable skill memory와 environment error를 결합하면 장기 능력 축적이 가능하다. | [Voyager, TMLR 2024](https://mlanthology.org/tmlr/2024/wang2024tmlr-voyager/) | Automatic curriculum, executable skill library, environment feedback·execution error·self-verification을 결합해 Minecraft exploration과 skill reuse를 개선했다. | 결합 system 결과이며 모든 component의 독립 효과를 뜻하지 않음 | System |
| 재사용 가능한 workflow를 유도·선택 제공하는 memory system은 web navigation을 개선할 수 있다. | [Agent Workflow Memory, ICML 2025](https://proceedings.mlr.press/v267/wang25bx.html) | 과거 trajectory에서 workflow를 유도해 선택적으로 제공하는 전체 AWM system이 Mind2Web·WebArena baseline을 개선했다. | Web navigation; induction·representation·selection이 결합되어 개별 효과는 분리되지 않음 | System |
| Tool·computer interface와 context selection은 base model과 별개의 성능 변수다. | [SWE-agent, NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html) | SWE-bench Lite ablation에서 기본 ACI는 18.0% resolved였고 full history는 15.0%, full-file view는 12.7%였다. Linting·편집·검색 방식도 결과를 바꿨다. | GPT-4 Turbo와 SWE-bench Lite의 300개 task | Direct |
| Tool-derived external feedback는 correction을 개선할 수 있다. | [CRITIC, ICLR 2024](https://proceedings.iclr.cc/paper_files/paper/2024/hash/fef126561bbf9d4467dbb8d27334b8fe-Abstract-Conference.html) | Search·code interpreter 같은 tool feedback을 이용한 verify–correct cycle이 QA, program synthesis, toxicity task를 개선했다. | 적절한 external tool이 정답성 signal을 제공하는 task | Direct |
| 같은 LLM의 self-feedback도 일부 task에서는 개선을 만들 수 있다. | [Self-Refine, NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/91edff07232fb1b55a505a9e9f6c0ff3-Abstract-Conference.html) | Generator·feedback provider·refiner를 같은 LLM으로 구성한 반복이 여러 생성 task에서 one-step generation을 개선했지만 GSM8K math reasoning 향상은 0–0.2 percentage point였고 유의 표시가 없었다. | Feedback+refinement bundle 대 same-base no-loop 효과; math 조건은 gold correctness label을 iteration gate에 사용해 purely intrinsic verifier 증거가 아님 | Direct |
| Prompt만으로 수행하는 intrinsic self-correction은 reasoning을 악화시킬 수도 있다. | [Huang et al., ICLR 2024](https://openreview.net/forum?id=IkmD3fKBPQ) | External feedback 없이 답을 재검토하게 한 조건에서 안정적 개선이 없고 일부 조건은 성능이 하락했다. | 연구가 사용한 reasoning task·model·prompt | Direct |
| Intrinsic verification도 검증 가능한 보조 문제로 바꾸면 개선될 수 있다. | [ProCo, EMNLP 2024](https://aclanthology.org/2024.emnlp-main.714/) | 질문의 핵심 조건을 가린 뒤 현재 답으로 그 조건을 복원하는 verification problem을 구성해 연구의 QA·산술·상식 추론 조건에서 일반 self-correct보다 개선했다. | 특정 key condition을 추출·복원할 수 있는 reasoning task | Direct |
| Self-correction의 성공 여부는 feedback source와 training을 분리해야 한다. | [Kamoi et al., TACL 2024](https://aclanthology.org/2024.tacl-1.78/) | Critical review는 reliable external feedback가 있는 task와 large-scale fine-tuning에서는 효과가 있지만 prompted feedback만의 일반 성공 근거는 약하다고 정리했다. | 2024년까지 공개된 연구에 대한 synthesis | Synthesis |
| Self-correction policy를 학습하면 frozen prompted correction과 다른 결과가 난다. | [SCoRe, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/871ac99fdc5282d0301934d23945ebaa-Abstract-Conference.html) | Model 자신의 correction trajectory distribution에서 multi-turn RL과 regularization을 사용해 self-correction 능력을 개선했다. | Training-time intervention; frozen-agent state update와 구별해야 함 | Direct |
| Self-correction은 오류 복구와 정답 보존의 두 전이로 나눠야 한다. | [Confidence vs. Critique, ACL 2025](https://aclanthology.org/2025.acl-long.203/) | 수정 전후 정답 여부를 분해해 correct→correct 보존과 wrong→correct 복구가 prompt·in-context intervention에서 trade-off를 보일 수 있음을 보고했다. | 연구의 reasoning benchmark와 model | Direct |
| Search frontier와 backtracking이 left-to-right generation보다 유리할 수 있다. | [Tree of Thoughts, NeurIPS 2023](https://proceedings.neurips.cc/paper/2023/hash/271db9922b8d1f4dd7aaef84ed5ac703-Abstract.html) | 여러 reasoning path를 생성·평가·backtrack하는 search가 세 planning·search task에서 baseline을 개선했다. | 실제 environment transition이 없는 reasoning search도 포함 | Direct |
| Environment state에서의 tree search도 agent 성능을 높일 수 있다. | [LATS, ICML 2024](https://proceedings.mlr.press/v235/zhou24r.html) | MCTS, LM value, reflection, external environment feedback를 결합해 coding·QA·web·math task에서 경쟁력 있는 결과를 냈다. | 여러 mechanism이 결합된 compute-intensive system | System |
| Search의 효과는 discriminator 정확도에 의해 제한된다. | [When is Tree Search Useful for LLM Planning?, ACL 2024](https://aclanthology.org/2024.acl-long.738/) | 연구의 text-to-SQL·math 조건에서는 advanced planning이 reranking보다 유의미하게 나으려면 discriminator 정확도가 적어도 90% 수준이어야 했고, LLM discriminator가 이를 충족하지 못하는 경우가 많았다. | 두 task와 사용한 generator·discriminator에 조건화 | Direct |
| Test-time compute의 최적 사용법은 task와 base model에 따라 다르다. | [Snell et al., ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/1b623663fd9b874366f3ce019fdfdd44-Abstract-Conference.html) | Revision과 process-verifier-guided search의 효율이 problem·base model에 따라 달라지며 adaptive allocation이 best-of-N보다 효율적일 수 있음을 보였다. | 주로 mathematical reasoning과 연구의 trained models | Direct |
| 복잡한 autonomous loop는 모든 coding task에 필요하지 않다. | [Agentless, FSE 2025](https://doi.org/10.1145/3715754) | LLM이 자율적으로 tool과 다음 action을 선택하지 않는 localization–repair–validation pipeline이 SWE-bench Lite에서 강한 성능과 낮은 비용을 보였다. | Software repair와 해당 benchmark; 다른 interactive task의 반증은 아님 | Direct |
| Accuracy만 보면 harness complexity의 원인을 잘못 귀속할 수 있다. | [AI Agents That Matter, TMLR 2025](https://mlanthology.org/tmlr/2025/kapoor2025tmlr-ai/) | Cost 누락, model developer와 downstream developer 평가의 혼합, holdout 부족, 재현성 부족을 agent benchmark의 핵심 문제로 지적했다. | Evaluation methodology에 관한 분석 | Synthesis |
| 한 번의 성공률은 반복 실행의 신뢰성을 나타내지 못한다. | [τ-bench, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/1b126cc38b8638e07bef37e7b2bb72bf-Abstract-Conference.html) | τ-retail 115 tasks에서 GPT-4o function-calling agent의 pass^1은 61.2%였지만, 같은 underlying task의 대화 변이를 `k`회 모두 성공할 확률을 task 평균한 pass^8은 25% 미만이었다. | GPT-4 user simulator를 사용한 retail 조건; mechanism ablation이 아니라 reliability metric | Evaluation |
| Terminal outcome만으로 stateful tool trajectory를 충분히 평가할 수 없다. | [ToolSandbox, NAACL Findings 2025](https://aclanthology.org/2025.findings-naacl.65/) | Stateful tool execution과 implicit dependency를 포함하고, arbitrary trajectory에서 반드시 일어나야 할 milestone과 일어나면 안 되는 minefield를 평가했다. | 연구가 정의한 tool-use task와 simulator | Evaluation |
| Agent trajectory의 실패 원인을 step intervention과 replay로 추정할 수 있다. | [Causal Agent Replay, 2026 preprint](https://arxiv.org/abs/2606.08275) | Agent run을 structural causal model로 놓고 한 step에 `do` intervention을 가한 뒤 같은 stochastic policy로 forward replay해 outcome distribution shift와 confidence interval을 계산했다. | Planted ground truth가 있는 synthetic SCM 검증; 실제 agent의 plant–controller 분리를 확립한 결과가 아님 | Emerging |

## 4. Harness state와 선행연구 구성요소의 대응

아래 표는 기존 제어 보고서의 state를 agent 문헌의 용어로 먼저 대응한 것이다. 제어 용어는 마지막 열에서만 보조적으로 사용한다.

이 대응은 Transformer 내부 부품과의 일대일 매핑이 아니다. Transcript·reflection·workflow가 token으로 직렬화되면 attention·MLP·residual stream 전체에 걸친 계산 입력이 된다. 선행 agent 연구는 “Reflexion memory가 특정 attention head의 역할을 한다” 같은 내부 대응을 입증하지 않았다.

| 실제 state 또는 mechanism | Agent 문헌에서의 구현 | 실제로 입증된 역할 | 제어 관점의 제한적 번역 |
| --- | --- | --- | --- |
| 최신 tool·environment observation | ReAct observation, Inner Monologue scene·success feedback | 다음 reasoning·action과 replanning의 입력 | measurement |
| 현재 prompt와 recent trajectory | ReAct scratchpad, short-term context | 현재 episode의 history-dependent policy 입력 | finite-memory controller state |
| 실패에 대한 verbal summary | Reflexion episodic reflection | 다음 trial의 context와 action을 변경 | cross-trial controller memory |
| observation·reflection·plan memory | Generative Agents memory stream | Retrieval과 planning을 통해 social behavior를 변경 | information-state candidate |
| 실행 가능한 skill code | Voyager skill library | 성공한 behavior의 재사용·조합 | procedural memory 또는 option library |
| 재사용 가능한 abstract workflow | Agent Workflow Memory | 과거 trajectory의 공통 routine을 다음 task에 선택적으로 제공 | cross-episode procedural state |
| available skill·tool schema | SayCan skill set, SWE-agent ACI | 실행 가능 action의 표현과 제약 | action space·actuator interface |
| tool result·test·search evidence | CRITIC external feedback | Output validation과 revision의 근거 | sensor·verifier signal |
| candidate tree와 value | ToT·LATS search frontier | Alternative 생성, 평가, backtracking | search state; MPC와 자동으로 같지 않음 |
| evaluator·discriminator | Tree-search discriminator, process verifier | Candidate ranking과 compute allocation | measurement·selection policy |
| budget·cost·stop | Test-time compute allocation, agent evaluation protocol | 성능–비용 frontier와 종료 조건 | resource state |
| model weight | 대부분의 inference-time agent에서는 고정, SCoRe에서는 학습 | Parametric prior·policy와 learned correction capability | controller parameter |

이 표가 지지하지 않는 것도 분명하다.

- Summary가 posterior belief라는 증거는 없다.
- Transcript가 world state의 충분통계라는 증거는 없다.
- Skill library가 plant dynamics model이라는 증거는 없다.
- Replanning이 있다는 이유만으로 MPC라고 부를 수 없다.
- Reflection text가 gradient 또는 adaptive-control parameter update라는 뜻은 아니다.

## 5. Loop 성능을 만드는 서로 다른 mechanism

### 5.1 Corrective feedback

ReAct, Inner Monologue, CRITIC이 가장 직접적으로 다룬 mechanism이다.

```text
action
→ environment·tool result
→ informative feedback
→ 다음 action 변경
```

이 mechanism을 주장하려면 real feedback가 sham·masked feedback보다 다음 action과 final outcome을 함께 개선해야 한다. 단지 model을 여러 번 호출한 효과와 분리해야 한다.

선행연구상 가장 안정적인 feedback는 compiler error, tool lookup, scene state, success detector처럼 **외부에서 검증 가능한 signal**이다. 자유형 self-critique는 같은 신뢰도를 자동으로 갖지 않는다.

### 5.2 Memory-mediated adaptation

Reflexion과 Generative Agents는 memory가 단순 log 저장소가 아니라 이후 prompt·retrieval·plan을 바꾸는 state임을 보여 준다. Voyager는 성공한 executable program을 skill memory로 승격한다.

그러나 세 연구의 memory는 서로 다르다.

| 연구 | 보존 단위 | lifetime | 평가 |
| --- | --- | --- | --- |
| Reflexion | 실패·feedback의 verbal reflection | 다음 trial | task success |
| Generative Agents | observation, reflection, plan | simulation lifetime | behavior believability |
| Voyager | 실행 가능한 code skill과 task progress | 여러 task·world | exploration·skill reuse |

따라서 “memory가 많을수록 수렴한다”는 일반 명제는 선행연구에서 나오지 않는다. 무엇을 어떤 retrieval rule로 다음 decision에 넣는지가 연구 대상이다.

이 반례는 직접 관측된다.

- SWE-agent의 SWE-bench Lite ablation에서는 최근 다섯 observation은 full form으로 두고 이전 observation을 각각 한 줄로 collapse한 조건이 18.0% resolved였지만 full history는 15.0%였다. 100-line file view는 18.0%, full file은 12.7%였다.
- Agent Workflow Memory에서는 rule-based로 추출한 non-abstract concrete workflow보다 LM이 유도한 abstract sub-routine 조건이 높았지만, induction 방식과 representation이 함께 달라진 비교다. 별도 representation ablation에서 NL-only의 step success rate는 34.6%, filtered-HTML-only는 33.8%, 둘을 함께 넣은 조건은 32.9%였다. 저자들은 irrelevant HTML과 online에서 잘못 유도된 workflow가 성능을 떨어뜨릴 수 있다고 분석했다.

즉 memory state의 핵심 변수는 volume이 아니라 **task-relevant abstraction, retrieval precision, freshness, conflict와 context cost**다.

### 5.3 Interface grounding

SayCan과 SWE-agent는 proposal quality만으로는 충분하지 않다는 근거다.

- SayCan은 언어적으로 그럴듯한 skill과 현재 robot state에서 실행 가능한 skill을 구분한다.
- SWE-agent는 file navigation, editing, test execution을 model이 다루기 쉬운 interface로 재설계한다.

이는 task failure가 model reasoning의 결함이 아니라 action representation·tool affordance·execution feedback의 결함일 수 있음을 뜻한다.

### 5.4 Search와 selection

ToT, LATS, test-time compute 연구는 하나의 proposal을 순차 수정하는 대신 여러 candidate를 생성하고 평가하는 mechanism을 다룬다.

```text
proposal distribution
→ multiple candidates or branches
→ evaluator·discriminator
→ selection·backtracking
```

이 경우 성능 향상은 controller가 error를 따라 한 방향으로 보정해서가 아니라 coverage와 selection 때문에 생길 수 있다. Agentless도 autonomous corrective loop 없이 structured decomposition과 patch validation만으로 강한 결과를 낼 수 있음을 보인다.

Tree search 연구가 주는 중요한 제한은 evaluator quality다. Discriminator가 약하면 branch를 늘려도 잘못된 candidate에 compute를 집중한다.

### 5.5 Learned correction

SCoRe는 prompt state만 바꾸는 Reflexion·Self-Refine과 다른 mechanism이다. Model이 자신의 correction trajectory에서 multi-turn policy를 학습한다.

따라서 다음을 구분해야 한다.

```text
inference state update
!= weight update
!= correction policy training
```

Frozen LLM의 transcript가 달라지는 현상을 adaptive learning이라고 부르면 SCoRe와 같은 training intervention을 구분할 수 없게 된다.

## 6. Self-correction 문헌의 긍정·부정 결과를 함께 읽는 법

Self-Refine은 같은 LLM이 feedback provider와 refiner를 맡아도 선택된 task에서 개선이 가능함을 보였다. 그러나 그 연구 안에서도 math reasoning 개선은 0–0.2 percentage point에 그쳤다. 성공·실패 사례 70개를 수작업 분석한 결과, 실패 사례 35개 중 33%는 잘못된 오류 위치, 61%는 부적절한 수정 제안 때문이었다. 즉 이 표본에서는 병목이 refiner보다 feedback diagnosis에 더 자주 있었다.

Reflexion의 code 실험도 같은 경계를 보인다. Self-generated test suite를 통과한 제출 중 hidden benchmark tests에는 실패한 조건부 비율 `P(gold tests fail | self-generated tests pass)`은 HumanEval Python 1.4%, MBPP Python 16.3%였다. Pass@1은 MBPP Python에서 GPT-4 base 80.1%에서 Reflexion 77.1%로 낮아졌다. False positive는 잘못된 terminal state를 성공으로 판정해 loop를 조기에 끝내므로 단순한 noise가 아니라 stopping error다.

반면 ProCo는 자유형 critique 대신 key condition을 복원하는 검증 가능한 보조 문제를 만들었고, SCoRe는 correction policy 자체를 학습했다. 따라서 Huang et al.의 부정 결과와 함께 읽으면 “모델 내부 feedback인가”라는 한 축만으로는 충분하지 않다. **무엇을 검증하게 했는지, 그 검증을 채점할 수 있는지, correction behavior를 학습했는지**가 별도 축이다. Kamoi et al.은 이 문헌을 다음 세 조건으로 재분류했다.

1. Feedback가 prompted LLM 내부 평가인가, reliable external source인가
2. Task가 정답을 검증하기 쉬운가
3. Model이 correction을 위해 별도로 훈련되었는가

따라서 두 결과를 “reflection은 된다/안 된다”로 평균내면 안 된다.

| 조건 | 문헌상 기대 |
| --- | --- |
| Compiler·test·retrieval처럼 외부 검증이 강함 | correction 가능성이 높아짐 |
| 동일 model의 자유형 critique만 있음 | 개선이 불안정하고 regression 가능 |
| Corrector가 오류 위치·방향을 받음 | 단순 재검토보다 유리 |
| 내부 검증을 정답 판정 가능한 보조 문제로 변환 | 자유형 critique보다 유리할 수 있음 |
| Model이 multi-turn correction을 학습함 | frozen prompt-only 조건과 다른 capability |
| Evaluator가 generator와 같은 blind spot을 공유함 | 잘못된 확신·selection 가능 |

이 구분은 loop engineering에서 `feedback strength`보다 `feedback epistemic quality`를 먼저 측정해야 함을 뜻한다.

## 7. 선행연구가 말하는 “수렴”의 실제 범위

대부분의 LLM-agent 연구는 다음을 보고한다.

- fixed episode budget의 success rate
- pass@1 또는 best-of-N
- instruction completion
- accumulated reward
- cost·token·tool-call

대부분은 다음을 증명하지 않는다.

- 무한 반복에서의 점근 수렴
- 모든 reachable state에서의 단조 개선
- Lyapunov stability
- unsafe state를 한 번도 지나지 않는 path safety
- 새로운 model·task distribution으로의 stability margin

따라서 이 연구에서는 `converged`를 다음처럼 제한해 사용한다.

> 사전 정의한 model–harness–task distribution과 budget에서 gold-valid terminal state에 도달하고, 도달 뒤 결과를 보존하거나 종료했다.

고전 수렴 증명이 필요한 경우에는 별도의 formal model과 전제가 필요하다. Agent benchmark의 평균 성공률로 대체하지 않는다.

평가도 최소 세 층으로 나눈다.

| 층 | 질문 | 선행 평가 방식 |
| --- | --- | --- |
| Terminal correctness | 마지막 state가 목표와 일치하는가 | gold database·test state |
| Repeat reliability | 같은 task를 반복해도 성공하는가 | τ-bench의 pass^k |
| Trajectory validity | 중간 prerequisite와 금지 event를 지켰는가 | ToolSandbox의 milestone·minefield |

`pass^k`는 `pass@k`와 다르다. 전자는 동일한 underlying task에서 environment와 agent memory를 초기화한 독립 반복 `k`개가 모두 성공할 신뢰성을 묻고, 후자는 `k`개 후보 중 적어도 하나가 성공하는 coverage를 묻는다. Cross-run memory를 유지하면 τ-bench식 pass^k가 아니라 sequential adaptation reliability로 별도 보고해야 한다.

Self-correction에서는 terminal correctness를 한 번의 수정 전이로 분해한다. Confidence vs. Critique의 표기대로 초기 정답 여부를 `C0`, 수정 후 정답 여부를 `C1`이라 하면 정답 보존은 `P(C1 | C0)`, 오류 복구는 `P(C1 | ¬C0)`, 정답 훼손은 `P(¬C1 | C0)`다. 이들을 terminal accuracy 하나로 합치면 더 공격적인 수정 policy가 복구를 늘리면서 이미 맞은 답을 깨는 trade-off가 보이지 않는다. 다회 loop의 step별 전이 또는 initial→final horizon metric은 이 프로젝트의 확장으로 따로 표시한다.

ToolSandbox의 milestone·minefield도 무오류 gold channel로 간주하지 않는다. 이 연구는 user simulator prompt를 보강한 뒤에도 simulator error가 남는다고 보고했다. 다른 task로 이식할 때는 simulator error와 milestone·minefield annotation error를 agent error와 분리해 감사해야 한다.

## 8. 어떤 조건에서 loop가 작동하거나 실패하는가

### 8.1 문헌에서 직접 유도되는 조건표

| 조건 | 작동할 가능성이 높은 경우 | 실패 가능성이 높은 경우 | 근거 |
| --- | --- | --- | --- |
| Task observability | Action 뒤 새 사실·오류가 드러남 | Feedback가 초기 prompt의 반복일 뿐임 | ReAct, Inner Monologue |
| Feedback reliability | Test, tool, grounded state가 방향을 줌 | Intrinsic critique가 같은 blind spot을 공유 | CRITIC, Huang, Kamoi |
| Action feasibility | Skill·tool interface가 실행 가능성을 표현 | Proposal은 맞지만 tool grammar·affordance가 없음 | SayCan, SWE-agent |
| State retention | 실패·constraint·skill을 다음 decision에 선택적으로 재사용 | Relevant state 누락 또는 irrelevant memory retrieval | Reflexion, Generative Agents, Voyager |
| Context selectivity | 짧고 관련성 높은 관측·workflow를 제공 | Full history, 중복 표현, 잘못 유도된 memory | SWE-agent, Agent Workflow Memory |
| Search evaluation | Discriminator가 branch quality를 구분 | Evaluator가 약해 search가 noise를 확대 | ToT, LATS, Shi et al. |
| Model capability | Feedback를 action 변화로 해석 가능 | Oracle feedback를 줘도 correct action을 생성하지 못함 | Self-correction·test-time compute 연구 |
| Compute allocation | Task difficulty에 맞게 revision·search budget 배분 | 무조건 iteration을 늘려 비용과 regression 증가 | Snell et al., AI Agents That Matter |
| Baseline choice | Simple pipeline·best-of-N과 비교 | Complex loop만 one-shot과 비교 | Agentless, AI Agents That Matter |

### 8.2 Task 문제와 metric 문제를 구분하는 문헌 기반 진단

| 관찰 | 우선 의심할 원인 | 다음 비교 |
| --- | --- | --- |
| Real feedback와 sham feedback가 같은 성능 | 새 정보가 없거나 policy가 feedback를 사용하지 못함 | ReAct-style observation masking |
| External tool feedback는 개선하지만 self-critique는 악화 | Intrinsic evaluator 결함 | CRITIC condition 대 Huang-style intrinsic condition |
| Oracle action·state에서도 실패 | Task infeasibility 또는 generator·action-space 한계 | SayCan-style affordance·oracle policy |
| 후보 수를 늘리면 개선하지만 feedback 교체는 무효 | Correction보다 coverage·selection 효과 | Best-of-N·Agentless baseline |
| Search depth를 늘려도 개선 없음 | Discriminator 또는 value estimate 결함 | Oracle discriminator, reranking baseline |
| 같은 model인데 harness별 성능 차이가 큼 | Interface·state·tool orchestration 차이 | SWE-agent-style ACI ablation |
| Visible score는 오르지만 held-out success는 하락 | Metric overfitting·benchmark leakage | Held-out evaluator와 cost-aware evaluation |
| 성공 뒤 추가 iteration이 결과를 깨뜨림 | Stop·retention policy 결함 | Controller-visible verifier로 고른 checkpoint와 stop ablation; gold-selected checkpoint는 oracle upper bound로 분리 |
| pass@1은 높지만 pass^k가 급락 | Stochastic policy의 반복 신뢰성 결함 | τ-bench-style repeated-run evaluation |
| Terminal state는 맞지만 금지 action·중간 prerequisite 위반 | Trajectory metric 누락 | ToolSandbox-style milestone·minefield evaluation |

이 표는 선행결과로부터 우선 진단과 다음 비교를 유도한 synthesis다. τ-bench의 pass^k와 ToolSandbox의 milestone·minefield처럼 직접 가져온 평가법도 있지만, 새로운 task의 reset·annotation·validator에 이식하는 일은 별도 adaptation이다. 각 행의 paired intervention 전체를 해당 논문이 그대로 수행했다는 뜻도 아니다.

## 9. 제어이론은 어디까지 사용해야 하는가

### 9.1 직접 근거와 이론 전이를 분리한다

| 명제 | 근거 수준 |
| --- | --- |
| Agent가 environment observation을 받아 다음 action을 바꾼다. | LLM-agent 직접 실증 |
| Memory·interface·search state가 system performance에 영향을 준다. | LLM-agent 직접 실증 또는 system evidence |
| 이 합성 system을 dynamic output-feedback 형태로 외부에서 기술할 수 있다. | 제어이론적 model transfer |
| Summary가 belief state다. | 미입증 |
| Agent 안에 plant prediction model이 있다. | 별도 counterfactual-prediction 실험 필요 |
| Agent가 MPC·PID·adaptive control을 구현한다. | 해당 algorithmic signature 없이는 미입증 |
| Benchmark success는 stability를 뜻한다. | 지지되지 않음 |

[Kaelbling et al.의 표준 POMDP formulation과 synthesis](https://doi.org/10.1016/S0004-3702(98)00023-X)는 latent Markov state, action, transition·observation kernel, reward가 정의된 부분관측 문제에서 history 또는 belief가 decision state가 될 수 있는 이론적 기반을 제공한다. 그러나 Reflexion summary나 transcript가 posterior belief라는 실증은 아니다.

[Subramanian et al.의 approximate information state](https://www.jmlr.org/papers/v23/20-1165.html)는 history 압축이 reward와 다음 information state의 예측에 충분한지 정의하고, 명시된 approximation 조건을 policy loss bound와 연결한다. 이는 harness summary를 “얼마나 잘 요약했는가”보다 downstream decision에 충분한지 시험할 이론적 근거지만, 자연어 memory가 그 조건을 만족한다는 직접 증거는 아니다.

이 문서에서 `plant/world prediction model`은 대안 action 아래의 counterfactual next state·outcome을 예측하고, 그 예측이 action 선택에 실제 사용되는 representation을 뜻한다. Transcript, skill library, verifier의 존재만으로는 이를 입증하지 않는다.

[Conant–Ashby good-regulator theorem](https://doi.org/10.1080/00207727008920220)과 [Francis–Wonham internal model principle](https://doi.org/10.1016/0005-1098(76)90006-6)은 각각 특정 조건의 regulator mapping과 robust output regulation에 관한 원 이론이다. LLM agent의 높은 benchmark success에서 explicit world model을 역추론하는 근거로 사용할 수 없다.

### 9.2 현재 가장 방어적인 제어 해석

선행연구와 충돌하지 않는 최소 해석은 다음이다.

```text
LLM
  = stochastic proposal·reasoning component

harness memory·planner·selector
  = finite-memory decision architecture

tool·environment feedback
  = observation channel

action interface·affordance·permission
  = executable action constraint

전체 loop
  = history-dependent closed-loop decision process
```

`Controller`, `observer`, `plant`라는 말은 이 관계를 분석하는 유용한 번역이지만, agent 논문이 해당 고전 algorithm을 구현했다고 말하는 것은 아니다.

## 10. 후속 연구는 새로운 이론보다 재현·분해부터 시작한다

### 10.1 기존 실험 아이디어의 선행근거 상태

| 이 프로젝트의 실험 아이디어 | 가장 가까운 선행연구 | 현재 판정 |
| --- | --- | --- |
| Real observation 대 sham·masked observation | ReAct, Inner Monologue, CRITIC | Feedback 이득은 선행 실증됨. Length-matched paired sham은 이 프로젝트의 식별 강화안 |
| Memory full·null·selective·stale ablation | Reflexion, SWE-agent, Agent Workflow Memory | Raw trajectory 대 reflection, full history 대 older-observation compression, workflow 유무·표현 방식의 부분 비교는 있으나 통일된 factorial 근거는 없음. 통합 비교와 stale 조작은 후속 실험 |
| Action interface 고정 모델 ablation | SayCan, SWE-agent | 선행근거가 가장 직접적인 재현 과제 |
| Correction 대 retry·best-of-N·reranking | Self-Refine, [self-consistency](https://arxiv.org/abs/2203.11171), ToT, Agentless, AI Agents That Matter | Mechanism 혼동이 선행문헌에 제기됨. 동일 compute의 완전한 분해는 task별 재검증 필요 |
| Verifier false-positive와 premature stop | Reflexion, tree-search discriminator 연구 | 현상은 직접 근거가 있음. Noise×depth response surface는 후속 가설 |
| pass^k·전이별 correction·trajectory 평가 | τ-bench, Confidence vs. Critique, ToolSandbox | 개별 metric 정의는 직접 근거. 새 task의 reset·horizon·milestone·minefield annotation은 adaptation이며, 다회 joint dashboard는 후속 설계 |
| Feedback delay·noise의 safe region | 직접 대응하는 LLM-agent 실증이 부족함 | 독자 가설; 앞선 재현 뒤에만 수행 |
| Causal impulse response와 plant–controller 분리 | [Closed-loop system identification](https://doi.org/10.1016/S0005-1098(99)00022-9), [Causal Agent Replay](https://arxiv.org/abs/2606.08275) | CAR는 step intervention·stochastic replay를 synthetic SCM에서 검증한 Emerging 근거. 실제 agent impulse response와 plant–controller 분리는 여전히 후속 가설 |
| PID·anti-windup·MPC·adaptive·ILC signature | 일부 기능적 유사 사례만 존재 | 고전 algorithm 대응을 검증하는 탐색 연구이며 확립된 agent mechanism이 아님 |
| LTI·주파수 응답·gain/phase margin | 직접 LLM-agent 근거 없음 | Typed numeric local regime이 확인되기 전에는 보류 |

이 표의 목적은 새로운 실험을 없애는 것이 아니라 순서를 바꾸는 것이다. 직접 근거가 있는 component effect를 먼저 재현하고, 그 결과로 설명되지 않는 잔차에만 독자적 제어 실험을 적용한다.

### 10.2 Phase 1A. 선행결과 직접 재현

1. ReAct·Inner Monologue의 feedback-enabled 조건과 논문에 보고된 baseline을 원 task에서 재현한다.
2. Reflexion의 raw trajectory 대 verbal reflection과 code verifier false-positive 결과를 재현한다.
3. SWE-agent의 context·viewer·editor·search ACI ablation을 model 고정 상태에서 재현한다.
4. Agent Workflow Memory의 workflow 유무와 NL·HTML representation ablation을 재현한다.
5. Self-Refine, Huang et al., ProCo의 correction 조건을 각각 원 task·stop rule에서 재현한다.
6. ToT·LATS와 tree-search discriminator 결과를 원 search task에서 재현한다.
7. τ-bench pass^k, Confidence vs. Critique의 한 번 전이, ToolSandbox milestone·minefield를 원 평가 환경에서 재현한다.

### 10.3 Phase 1B. 선행결과를 같은 조건에서 식별 비교

서로 다른 논문의 숫자를 바로 비교하지 않는다. 같은 task·model·budget에서 다음을 새로 맞춘다.

1. CRITIC식 external tool feedback와 Huang식 intrinsic critique
2. Memory null·selective·full 조건
3. Correction, independent retry, best-of-N, reranking
4. ToT·LATS식 search와 Agentless형 structured pipeline
5. Terminal success, 한 번 correction transition, pass^k, milestone·minefield, cost와 repeated-run variance

이 단계는 선행연구의 직접 복제가 아니라, 서로 충돌하는 결과의 mechanism을 구분하기 위한 **prior-motivated harmonized comparison**이다.

### 10.4 Phase 2. 문헌의 빈칸만 확장

Phase 1A의 결과가 재현되고 Phase 1B에서 mechanism이 분리된 뒤에만 다음을 추가한다.

- Real observation과 length-matched sham observation의 paired 차이는 무엇인가
- Typed canonical state가 raw transcript보다 좋은가
- Null·selective·full 비교를 넘어 stale state와 version provenance가 correction에 필요한가
- Selection 효과와 causal correction 효과의 상대 기여는 얼마인가
- Verifier error가 loop depth에 따라 어떻게 증폭되는가
- Controller-visible verifier로 고른 stop·checkpoint가 regression을 줄이는가; gold-selected oracle upper bound와 차이는 얼마인가
- Causal Agent Replay의 step intervention이 실제 tool agent에서도 planted cause를 회복하는가

이 항목들은 현재 선행연구를 바탕으로 한 후속 가설이지, 이미 확립된 사실이 아니다.

### 10.5 Phase 3. 제어이론적 formalization

다음이 모두 식별된 task에만 formal control model을 적용한다.

- typed state와 action
- 명시적 transition 또는 repeatable simulator
- controller-visible error와 evaluator-only gold outcome의 분리
- feedback delay·noise intervention
- stable terminal·unsafe set

그 전에는 `MPC`, `gain margin`, `Lyapunov function` 대신 `replanning`, `feedback sensitivity`, `finite-budget robustness`라는 경험적 용어를 사용한다.

## 11. 연구 방향 결정

이 프로젝트의 주 근거 문서는 이제 이 문헌 종합이다. 제어이론적 해석 노트는 다음 역할로 제한한다.

1. 선행연구에서 관측된 architecture를 하나의 system boundary로 표현
2. 비슷해 보이는 PID·MPC·adaptive·ILC 용어의 오용 방지
3. 문헌이 아직 답하지 않은 식별 실험을 설계

즉 연구 순서는 다음으로 바뀐다.

```text
prior empirical result
→ scope와 limitation 확인
→ 동일 mechanism 재현
→ component 분해
→ 그 뒤에만 control-theoretic extension
```

이 순서를 지키면 “agent가 잘 되니 내부에 제어 model이 있을 것”이라는 역추론 대신, 어떤 observation·memory·interface·verifier가 어떤 조건에서 실제 효과를 냈는지를 먼저 확인할 수 있다.
