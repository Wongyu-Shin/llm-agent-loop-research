# Agent loop의 외부 상태는 Transformer의 무엇에 대응하는가

- 조사 기준일: 2026-07-23
- 대상: 주로 decoder-only Transformer LLM을 고정된 가중치로 호출하는 일반적인 agent loop
- 질문: prompt, 이전 출력, 실행 로그, tool result, memory, metric, 평가 신호가 모델 계산의 어느 부분에 들어가며 무엇을 실제로 바꾸는가
- 근거 원칙: 논문과 공식 구현 문서를 우선하고, 기능적 비유와 물리적 동일성을 구분한다

## 0. 결론

가장 중요한 결론은 다음과 같다.

> Agent loop에 존재하는 상태의 대부분은 모델 구성요소가 아니다. repository, transcript, tool result, metric history, memory store에 있는 **외부 시스템 상태**다. harness가 그중 일부를 선택하고 직렬화해 다음 호출의 input token으로 넣을 때, 비로소 embedding·attention·MLP를 거치는 **context-conditioned activation**으로 변환된다.

표준적인 frozen-weight LLM agent에서는 매 iteration마다 보통 다음이 바뀐다.

1. 외부 환경 상태: 파일, 웹, 데이터베이스, 실행 프로세스
2. 외부 agent 상태: transcript, scratchpad, 실패 ledger, best-so-far, memory
3. 모델 입력: 다음 prompt의 token sequence
4. 입력에 의해 계산되는 hidden activation, attention weight, key/value tensor
5. 생성 결과와 decoder의 탐색 경로

보통 다음은 바뀌지 않는다.

1. 학습된 model parameter `θ`
2. attention projection과 MLP의 learned weight
3. tokenizer vocabulary와 architecture

따라서 loop의 feedback은 기본적으로 **training signal**이 아니라 **conditioning signal**이다. 점수나 로그가 loss/reward로 변환되고 gradient/optimizer step을 실제로 통과할 때만 model weight update가 된다. GPT-3의 in-context learning은 과제 예시를 text로 조건화하되 gradient update나 fine-tuning 없이 동작한다고 정의되었다([Brown et al., 2020](https://arxiv.org/abs/2005.14165)). 반면 InstructGPT의 RLHF는 사람의 순위를 reward model로 만들고 PPO로 policy를 fine-tune하므로 실제 parameter update다([Ouyang et al., 2022](https://arxiv.org/abs/2203.02155)).

이 구분은 loop 수렴을 설명할 때 결정적이다. frozen model의 loop는 model 자체가 매번 더 좋은 model로 변하는 과정이 아니다. **같은 model이 달라진 evidence와 state를 조건으로 다른 분포를 내고, harness가 그 후보를 실행·선택·보존하는 폐루프 시스템**이다.

## 1. 용어에서 먼저 제거해야 할 혼동

### 1.1 `feed forward`, FFN, feedback, backpropagation은 서로 다르다

| 용어 | 뜻 | agent loop에서의 위치 |
|---|---|---|
| forward pass / inference | 고정된 parameter와 현재 입력으로 activation과 output distribution을 계산 | 매 model call과 autoregressive token step |
| feed-forward network, FFN/MLP | Transformer layer 안의 position-wise learned sublayer | attention 뒤에서 hidden representation을 변환 |
| feedback | tool·environment·evaluator 결과를 다음 의사결정에 반영 | model 밖 loop의 `observation → next context` 경로 |
| backpropagation | loss의 gradient를 parameter 방향으로 전파 | training/fine-tuning을 명시적으로 수행할 때만 존재 |

“출력과 로그를 다시 feed forward한다”는 말은 **로그를 새 input으로 넣어 다시 forward pass한다**는 뜻으로는 맞다. 그러나 그것은 backpropagation도 아니고 FFN weight update도 아니다.

### 1.2 세 종류의 대응을 구분한다

이 문서의 표에서 대응은 다음 세 수준 중 하나다.

- `=` 물리적 동일성: 실제로 그 tensor나 parameter다.
- `→` interface 변환: 외부 객체가 serialization/tokenization을 거쳐 모델 입력이 된다.
- `≈` 기능적 유사성: 역할은 닮았지만 구현과 보장은 다르다.

“대화 기록은 working memory다”는 `≈` 수준의 표현이다. 대화 기록 자체는 문자열이나 database row이고, 모델 안의 recurrent memory cell과 동일하지 않다.

## 2. 전체 계산 경계

### 2.1 frozen-weight agent loop의 최소 모형

iteration `t`에서:

```text
외부 상태 z_t
  = {goal, transcript, repository, tool state, memory, metric history, budget}

선택·검색·요약·직렬화
  x_t = Serialize(Select(z_t))

고정된 모델의 순전파
  y_t ~ Decode(p_θ(. | x_t)),  θ는 고정

외부 실행과 평가
  (o_t, environment_{t+1}) = Execute(Parse(y_t), environment_t)
  m_t = Evaluate(y_t, o_t, environment_{t+1})

외부 상태 갱신
  z_{t+1} = Update(z_t, y_t, o_t, m_t)
```

여기서 모델 내부에 있는 것은 `p_θ(. | x_t)`를 계산하는 부분뿐이다. `Select`, `Serialize`, `Execute`, `Evaluate`, `Update`는 보통 harness, runtime, test runner, retriever, database에 있다. ReAct는 reasoning trace와 action을 교대로 생성하고 action으로 외부 source에서 새 정보를 얻는 구조를 보여 준다([Yao et al., 2022](https://arxiv.org/abs/2210.03629)). 이 논문의 “reasoning/action/observation trajectory”도 전체가 하나의 Transformer activation으로 계속 살아 있는 것이 아니라, 다음 호출에 보존된 text trajectory로 조건화되는 시스템 설계다.

### 2.2 text가 모델 계산으로 들어가는 순간

prompt `x_t = (token_1, ..., token_n)`가 주어지면 단순화한 decoder Transformer의 각 layer에서:

```text
h_i^0 = TokenEmbedding(token_i) + PositionEncoding(i)

q_i^ℓ = h_i^ℓ W_Q^ℓ
k_j^ℓ = h_j^ℓ W_K^ℓ
v_j^ℓ = h_j^ℓ W_V^ℓ

α_ij^ℓ = softmax_j(q_i^ℓ · k_j^ℓ / sqrt(d) + causal_mask)
a_i^ℓ = Σ_j α_ij^ℓ v_j^ℓ

h_i^(ℓ+1) = Residual/Norm/MLP(h_i^ℓ, a_i^ℓ)

p_θ(token_(n+1) | x_t) = softmax(W_U h_n^L)
```

원래 Transformer는 self-attention과 position-wise FFN을 쌓고, decoder mask로 미래 position을 보지 못하게 한다([Vaswani et al., 2017](https://arxiv.org/abs/1706.03762)). 이 식에서 외부 로그나 memory에 전용으로 할당된 보편적 부품은 없다.

- 로그의 각 조각은 token과 position이 된다.
- attention은 현재 query가 어떤 이전 position의 value를 얼마나 혼합할지 입력마다 다시 계산한다.
- MLP는 attention으로 모인 표현을 learned parameter를 이용해 변환한다.
- residual path를 따라 여러 layer의 표현이 합성된다.
- output head와 decoder가 다음 token 또는 structured tool call을 선택한다.

즉, `test failed at line 42`라는 log가 항상 특정 “error neuron”이나 attention head에 들어가는 것이 아니다. 그 의미는 많은 token position, layer, head, MLP activation에 분산될 수 있으며 model과 prompt에 따라 달라진다. 일부 연구는 in-context task가 중간 layer의 소수 attention head를 통해 compact “function vector”로 전달되는 사례를 causal intervention으로 보였지만, 이는 특정 model/task에서 찾은 mechanism이지 모든 agent state의 보편적 address가 아니다([Todd et al., 2023](https://arxiv.org/abs/2310.15213)).

## 3. 외부 객체에서 모델 구성요소까지의 대응표

| Agent loop의 객체 | 실제 저장 위치 | 모델에 들어가는 형식 | 가장 가까운 모델 기능 | 동일하지 않은 것 | 수명 |
|---|---|---|---|---|---|
| goal, system instruction, policy | prompt builder·API message | special token/role marker를 포함한 token sequence | activation을 task·style·constraint에 조건화 | weight, optimizer objective | context에 포함된 동안 |
| 이전 model output | transcript·response object | 다시 보낸 assistant token 또는 유지된 prefix | 다음 token의 autoregressive prefix | 자동으로 영속하는 hidden thought | 재전송·보존된 동안 |
| scratchpad, plan, reflection | text/file/database | 선택된 text token | `≈` 외부화된 working memory; attention으로 재읽음 | RNN hidden state, weight update | harness가 보존하는 동안 |
| tool call | model output item/JSON | output token 또는 constrained structure | output head와 decoder가 만든 action proposal | tool 실행 그 자체 | runtime이 parse할 때까지 |
| tool result, API response | 외부 runtime | tool-role message나 text/multimodal input | 새 observation을 조건으로 activation 재계산 | 모델이 직접 획득한 지식, gradient | 다음 context에 남은 동안 |
| compiler/test execution log | process stdout/stderr·artifact | 선택·절단·요약된 token | failure mode를 나타내는 contextual evidence | verifier logic, model parameter | state policy에 따라 |
| scalar metric `0.72` | evaluator·DB | 숫자 token/label로 넣으면 contextual cue | score 의미를 학습한 경우 후보 분포를 조건화 | loss, reward gradient | context에 남은 동안 |
| metric에 의한 candidate 선택 | harness | 선택된 candidate만 후속 context에 남음 | 모델 밖 search/control | attention, softmax training | search tree/state 동안 |
| best-so-far, issue ledger | file·DB·agent state | 검색·요약 후 token | `≈` episodic/working memory | KV cache, model weight | 명시적 삭제 전까지 |
| vector DB·document store | 외부 storage | retriever가 고른 passage token | `≈` non-parametric memory | Transformer self-attention 자체 | DB retention 동안 |
| repository·browser·OS 상태 | environment | tool로 관찰한 일부만 token화 | 부분 관측을 제공하는 environment | model context나 activation | 외부 시스템 수명 |
| input token의 hidden activation | accelerator memory | tensor `h_i^ℓ` | 현재 입력에 대한 transient representation | 원문 log, 영속 memory | forward/request 동안 |
| attention weight `α_ij^ℓ` | accelerator memory | 입력에서 계산된 tensor | position 간 정보 선택·혼합 | learned parameter `W_Q/W_K/W_V` | 해당 forward 동안 |
| KV cache | serving memory | 각 layer의 과거 token key/value tensor | 과거 prefix 계산 재사용, incremental attention | semantic memory DB, 학습된 지식, optimizer state | request/cache TTL·eviction까지 |
| learned MLP/attention weight | model checkpoint | parameter `θ` | pretraining/fine-tuning에서 획득한 parametric computation·knowledge | 현재 transcript나 실행 log | checkpoint가 교체될 때까지 |
| optimizer state·gradient | training system | gradient, moment estimate | parameter update | 일반 inference context | training step/checkpoint 동안 |

핵심은 “저장되어 있다”만으로 같은 memory가 되지 않는다는 점이다. text log, KV tensor, hidden activation, vector index, weight, optimizer state는 모두 저장될 수 있지만 **주소 방식, update rule, lifetime, 학습 가능성, 정보 손실**이 서로 다르다.

## 4. 구성요소별로 본 정확한 역할

### 4.1 prompt와 message history: 모델의 memory가 아니라 input

system/user/assistant/tool message는 API나 harness 수준에서는 서로 다른 typed object다. 모델 구현은 role marker, special token, position 등의 형태로 이를 sequence에 encode할 수 있다. 정확한 encoding은 model family마다 다르지만, 일반적인 architecture 수준에서는 모두 **현재 forward pass의 입력 position**이다.

history가 behavior를 바꾸는 경로는 다음과 같다.

```text
외부 문자열/객체
→ tokenizer와 role serialization
→ embedding activation
→ layer별 self-attention과 MLP activation
→ 다음 token logits
```

따라서:

- history에 있지만 prompt builder가 누락한 state는 모델이 볼 수 없다.
- summary만 넣으면 원본이 아니라 summary가 조건이다.
- 동일한 사실도 위치, label, formatting, 주변 distractor에 따라 다른 activation을 만든다.
- context window가 길다는 사실은 모든 token을 신뢰성 있게 이용한다는 보장이 아니다. 관련 정보가 긴 context 중간에 있을 때 성능이 크게 하락할 수 있다는 실험이 있다([Liu et al., 2023](https://arxiv.org/abs/2307.03172)).
- few-shot example의 순서만 바꿔도 성능이 random guess 수준에서 높은 수준까지 달라진 사례가 있다([Lu et al., 2021](https://arxiv.org/abs/2104.08786)).

“context에 기록했다”와 “model이 다음 결정에 유효하게 사용했다”는 별도 검증 항목이다.

### 4.2 self-attention: state를 저장하는 곳이라기보다 현재 계산에서 읽는 방법

self-attention은 query와 context의 key/value를 이용해 이전 position의 정보를 혼합한다. 그래서 context token은 attention이 읽을 수 있는 working set처럼 기능한다. 그러나 다음 제한이 있다.

1. attention weight는 입력마다 계산되는 activation이다. learned projection weight와 다르다.
2. text field별로 고정 주소나 강제 접근이 없다.
3. 높은 attention weight가 곧 인과적 사용이나 올바른 추론을 뜻하지 않는다.
4. 긴 context에서는 position·distractor·훈련 분포 때문에 필요한 evidence를 놓칠 수 있다.
5. 한 layer/head의 attention만으로 전체 computation을 설명할 수 없다. MLP와 residual composition도 관여한다.

Induction head 연구는 `[A][B] ... [A] → [B]` 같은 pattern completion을 수행하는 attention circuit과 in-context learning onset의 관계를 보였다. 작은 attention-only model에서는 강한 causal evidence가 있지만, 큰 MLP model에서는 주로 correlational evidence라고 저자들이 범위를 제한했다([Olsson et al., 2022](https://arxiv.org/abs/2209.11895)). 그러므로 “agent loop의 feedback은 induction head가 처리한다”는 일반화는 근거가 없다.

### 4.3 MLP/FFN: learned parametric memory라는 해석과 그 한계

Geva et al.은 Transformer FFN의 첫 matrix를 textual pattern과 대응하는 key, 두 번째 matrix를 vocabulary distribution을 유도하는 value로 분석해 FFN이 key-value memory처럼 동작한다고 보였다([Geva et al., 2020](https://arxiv.org/abs/2012.14913)).

이 결과가 뜻하는 것은:

- pretraining/fine-tuning으로 형성된 MLP weight가 pattern-dependent output tendency를 저장할 수 있다.
- 현재 prompt activation이 어떤 learned pattern을 활성화하는지가 output을 바꾼다.

뜻하지 않는 것은:

- 실행 log가 FFN weight에 즉시 써진다.
- 각 memory cell이 사람이 읽을 수 있는 한 개의 사실과 일대일 대응한다.
- agent의 vector DB나 transcript와 동일한 memory 구조다.

보통 loop 중 MLP **activation**은 매번 달라지지만 MLP **weight**는 고정이다.

### 4.4 hidden activation: 현재 state의 내부 표현이지만 영속 state는 아니다

hidden activation은 현재 input을 처리하며 생기는 tensor다. goal, example, log가 model 내부에서 어떤 latent representation으로 합성되는지는 activation에 나타날 수 있다. in-context task의 compact function representation이나 implicit predictor가 activation에 encode될 수 있다는 연구가 그 가능성을 보여 준다([Akyürek et al., 2022](https://arxiv.org/abs/2211.15661); [Todd et al., 2023](https://arxiv.org/abs/2310.15213)).

그러나 표준 stateless inference에서 activation은 호출이 끝난 뒤 자동으로 다음 독립 호출에 전달되지 않는다. 다음 호출이 같은 상태를 “기억”하는 이유는 보통 다음 중 하나다.

- transcript token을 다시 보냈다.
- server가 같은 sequence state를 보존했다.
- KV/prefix cache를 재사용했다.
- 별도 memory system이 관련 record를 검색해 넣었다.
- architecture에 명시적 recurrent memory가 있다.

이 경로를 확인하지 않고 “activation이 session memory로 남았다”고 가정하면 안 된다.

### 4.5 output head와 decoding: 후보 생성과 선택의 경계

Transformer는 context-conditioned logits를 낸다. 실제 token은 greedy, sampling, beam search, constrained decoding, grammar, logit bias 등 decoder 정책으로 선택된다. agent에서는 structured tool call schema가 가능한 output을 제한할 수 있다.

외부 metric으로 `N`개 후보 중 최고를 고르는 best-of-N은 model weight를 바꾸지 않는다.

```text
y_i ~ p_θ(. | x),  i = 1..N
y* = argmax_i Metric(y_i)
```

여기서 metric은 **외부 selector**다. 선택된 `y*`를 다음 context에 넣으면 다음 분포가 간접적으로 바뀌지만, `p_θ`의 parameter가 학습된 것은 아니다. 반대로 metric이 differentiable loss나 RL reward로 사용되고 optimizer가 `θ`를 갱신하면 training이다.

## 5. KV cache, recurrent state, external memory를 엄격히 구분하기

### 5.1 KV cache

autoregressive generation에서 과거 prefix token의 layer별 key/value projection은 변하지 않으므로 이를 매 token마다 다시 계산하지 않고 보존할 수 있다. PagedAttention 논문은 request마다 커지고 줄어드는 KV cache를 GPU memory block으로 관리하고, prompt·beam 사이에서 공유해 serving throughput을 높이는 문제를 다룬다([Kwon et al., 2023](https://arxiv.org/abs/2309.06180)).

KV cache의 정확한 성격은 다음과 같다.

- learned weight가 아니라 입력과 weight로부터 계산된 activation cache다.
- raw text나 symbolic fact table가 아니라 layer별 numerical key/value tensor다.
- 일반적으로 모든 hidden activation을 보존하는 것이 아니라, 후속 attention에 필요한 key/value projection을 보존한다.
- 이미 계산된 prefix를 효율적으로 연장하기 위한 inference state다.
- cache hit은 원칙적으로 같은 prefix 계산을 재사용하는 최적화이지, model에 새 지식을 학습시키는 과정이 아니다.
- prefix 중간을 수정하면 그 뒤의 cached tensor는 보통 그대로 재사용할 수 없다.
- context token이 cache에 존재해도 model이 필요한 정보를 올바르게 attend한다는 보장은 없다.
- cache eviction, quantization, compression, sliding window는 사용 가능한 과거 정보에 영향을 줄 수 있지만 implementation-specific이다.

tool result가 도착했을 때 같은 generation state를 연장하는 구현이라면 기존 prefix의 KV는 유지하고 tool-result token의 KV를 새로 계산할 수 있다. 독립 request로 전체 transcript를 다시 보내는 구현이라면 KV를 처음부터 다시 계산할 수 있다. **동일한 token prefix를 조건으로 한다는 의미론과 계산 재사용 여부는 구분해야 한다.**

2026년의 공식 context-caching 문서도 이 경계를 명시적으로 보여 준다. Gemini의 공식 문서는 cached content가 prompt prefix이며 model은 cached token과 regular input token을 구분하지 않는다고 설명한다([Google, Context caching](https://ai.google.dev/gemini-api/docs/generate-content/caching)). 이는 특정 provider의 구현 문서지만, prompt cache를 “새로운 semantic memory”로 해석하면 안 된다는 좋은 운영 사례다.

`key-value`라는 같은 표현이 네 가지 다른 대상을 가리킬 수 있으므로 특히 주의해야 한다.

| 표현 | 실제 대상 | update 방식 | loop state와의 관계 |
|---|---|---|---|
| attention key/value | 현재 layer activation에 learned projection을 적용한 tensor | forward pass마다 입력에서 계산 | context token을 attention으로 읽는 계산 재료 |
| KV cache | 과거 token의 attention key/value tensor 복사본 | token이 append될 때 새 K/V를 추가 | prefix 계산을 재사용하는 serving state |
| FFN key-value memory 해석 | MLP의 learned matrix와 그 activation에 대한 분석 관점 | weight는 training에서, activation은 inference에서 변화 | parametric pattern memory에 대한 기능적 해석 |
| 외부 key-value store | application의 database record | harness/tool의 명시적 read/write | 검색해 prompt에 넣기 전에는 model이 접근 불가 |

### 5.2 표준 Transformer와 recurrent state

원래 Transformer는 recurrence를 제거한 architecture로 제안되었다([Vaswani et al., 2017](https://arxiv.org/abs/1706.03762)). autoregressive generation이 token마다 반복되더라도, vanilla Transformer에는 LSTM처럼 고정 크기 hidden state를 time step마다 갱신하는 동일한 recurrence가 없다. 과거 token prefix 또는 그 KV projection을 attention 대상으로 유지한다.

반면 다음은 실제로 architecture-level recurrence를 도입한 예외다.

- **Transformer-XL**: 이전 segment의 hidden state sequence를 고정·cache하고 다음 segment의 extended context로 재사용하는 segment-level recurrence다([Dai et al., 2019](https://arxiv.org/abs/1901.02860)).
- **Recurrent Memory Transformer**: special memory token을 segment 사이에 전달하도록 학습한다([Bulatov et al., 2022](https://arxiv.org/abs/2207.06881)).
- **TTT layer**: hidden state 자체를 linear model이나 MLP로 두고, test sequence에서 self-supervised learning step으로 갱신하는 architecture다([Sun et al., 2024](https://arxiv.org/abs/2407.04620)).

이 예외는 “모든 LLM API session에 recurrent state가 있다”는 증거가 아니다. 사용 model과 serving protocol이 어느 mechanism을 구현하는지 별도로 확인해야 한다.

### 5.3 external memory

외부 memory는 model parameter 밖에 있고 별도 read/write policy를 가진다.

- Neural Turing Machine은 neural controller를 differentiable external memory에 결합했다([Graves et al., 2014](https://arxiv.org/abs/1410.5401)).
- RAG는 pretrained generator의 **parametric memory**와 dense vector index의 **non-parametric memory**를 구분하고 retriever가 고른 passage에 generation을 조건화한다([Lewis et al., 2020](https://arxiv.org/abs/2005.11401)).
- MemGPT는 context window보다 큰 정보를 여러 memory tier 사이에서 이동시키는 virtual context management를 agent system으로 구현했다([Packer et al., 2023](https://arxiv.org/abs/2310.08560)).
- Reflexion은 weight를 update하지 않고 linguistic reflection을 episodic memory buffer에 저장해 다음 trial의 prompt에 사용한다([Shinn et al., 2023](https://arxiv.org/abs/2303.11366)).

일반 agent의 file, vector DB, key-value store는 NTM처럼 end-to-end differentiable하지 않을 수 있다. model은 retriever가 context로 가져오지 않은 record를 직접 읽을 수 없다. 외부 memory의 성능은 최소한 다음의 곱으로 봐야 한다.

```text
write quality
× retrieval recall/precision
× serialization fidelity
× model utilization
```

### 5.4 비교표

| Mechanism | 매 iteration 변하는 것 | 지속 위치 | gradient 필요 | standard frozen Transformer agent인가 | 정확한 해석 |
|---|---|---|---|---|---|
| in-context learning | input-dependent activation과 output distribution | context token, 호출 중 activation | 아니오 | 예 | inference-time conditioning |
| KV cache | 과거 token의 layer별 K/V tensor가 append됨 | serving memory | 아니오 | 흔한 최적화 | prefix computation reuse |
| RNN/Transformer-XL recurrent state | architecture가 정의한 hidden/memory tensor | model runtime | 보통 inference 중 아니오 | 아니오, model-specific | learned recurrent dynamics |
| external episodic/vector memory | text, record, embedding index | file/DB/service | 아니오 | agent-specific | non-parametric state |
| fine-tuning/RLHF | learned parameter `θ` | checkpoint/adapter | 예 | 일반 online loop에는 없음 | actual model learning |
| TTT/fast-weight 계열 | architecture가 정의한 fast state 또는 test-time model | runtime | update rule에 따라 | 아니오, explicit exception | inference 중 learned state update |

선형화한 attention을 fast-weight programmer와 수학적으로 연결한 연구도 있다([Schlag et al., 2021](https://arxiv.org/abs/2102.11174)). 그러나 그 등가는 **linearized attention**에 관한 결과다. 일반 softmax Transformer의 모든 context use를 literal weight update라고 부를 근거가 되지 않는다.

## 6. In-context learning은 무엇이 “학습”되는가

### 6.1 행동 수준의 정의

in-context learning에서는 demonstration, instruction, feedback을 input에 추가했을 때 같은 fixed-weight model의 behavior가 달라진다. GPT-3 연구는 이를 “gradient update나 fine-tuning 없이 text interaction만으로” 수행했다고 명시한다([Brown et al., 2020](https://arxiv.org/abs/2005.14165)).

따라서 loop에서 다음이 가능하다.

```text
p_θ(candidate | goal, old_history)
≠
p_θ(candidate | goal, old_history, failure_log, counterexample)
```

하지만 두 분포에 동일한 `θ`가 사용된다.

### 6.2 내부 mechanism에 대한 현재 증거와 한계

ICL의 내부 mechanism은 하나로 확정되지 않았다.

| 연구 방향 | 1차 문헌의 주장 | 적용 한계 |
|---|---|---|
| implicit Bayesian inference | coherent pretraining document의 latent concept inference가 ICL로 이어질 수 있음을 mixture-of-HMM setting에서 보임([Xie et al., 2021](https://arxiv.org/abs/2111.02080)) | synthetic generative assumption; 모든 agent task의 실제 mechanism이라는 뜻이 아님 |
| implicit regression/learning algorithm | Transformer가 linear regression에서 GD, ridge, least-squares predictor를 구현·근사하고 관련 quantity가 activation에 encode될 수 있음을 보임([Akyürek et al., 2022](https://arxiv.org/abs/2211.15661)) | 주로 controlled linear problem |
| forward-pass GD analogy | linear self-attention과 한 번의 GD data transformation의 equivalence 및 simple regression 실험([von Oswald et al., 2022](https://arxiv.org/abs/2212.07677)) | simple/self-attention-only setting 중심; 실제 weight가 update되는 것은 아님 |
| induction head | repeated pattern continuation circuit과 ICL onset의 연관성([Olsson et al., 2022](https://arxiv.org/abs/2209.11895)) | large MLP model에는 correlational evidence가 중심 |
| function vector | 일부 attention head가 demonstrated task의 compact causal representation을 전달([Todd et al., 2023](https://arxiv.org/abs/2310.15213)) | 검증된 model/task의 mechanism; universal state slot 아님 |

따라서 가장 안전한 표현은 다음이다.

> In-context feedback은 parameter를 바꾸지 않고 context-dependent activation을 통해 behavior를 적응시킨다. 일부 task/model에서는 activation이 implicit predictor, latent concept, function vector, optimizer-like computation을 구현한다는 증거가 있지만, 일반적인 agent loop 전체를 “Transformer가 내부 SGD를 수행한다”로 동일시할 수는 없다.

## 7. tool use에서 모델과 runtime의 경계

Toolformer는 model이 어느 API를 언제 호출하고 어떤 argument를 쓰며 result를 이후 token prediction에 어떻게 포함할지를 학습하는 방법을 제안했다([Schick et al., 2023](https://arxiv.org/abs/2302.04761)). 여기서도 계산기, 검색, 번역기는 외부 API다.

일반 function calling의 실제 순서는 다음과 같다.

```text
1. harness가 tool schema를 모델 input에 제공
2. model이 tool name과 arguments를 output
3. application/runtime이 function을 실행
4. application이 result를 model에 다시 전달
5. model이 result를 조건으로 다음 output 생성
```

Google의 2026년 공식 function-calling 문서도 “model은 function을 실행하지 않고 application이 실행한 뒤 result를 다시 보낸다”고 명시한다([Google, Function calling](https://ai.google.dev/gemini-api/docs/function-calling)). built-in code execution처럼 provider가 runtime orchestration을 숨기더라도 개념 경계는 같다.

따라서:

- tool schema는 input context다.
- tool call은 model output/action proposal이다.
- execution은 environment transition이다.
- tool result는 새 observation이다.
- observation을 다음 context에 넣은 뒤 생기는 activation이 model-side update다.

tool result가 정확해도 model이 잘못 해석할 수 있고, model이 올바른 call을 제안해도 runtime permission이나 environment state 때문에 실패할 수 있다. 두 실패는 같은 model defect가 아니다.

## 8. metric과 평가 신호: 같은 숫자도 배선에 따라 완전히 다른 역할을 한다

`score = 0.72`가 있을 때 네 경우를 구분해야 한다.

### 8.1 prompt에 넣는다

```text
Previous score: 0.72. Improve the answer.
```

- 숫자는 token이 된다.
- model이 score의 의미와 개선 방향을 추론해야 한다.
- activation과 다음 output distribution이 달라질 수 있다.
- weight는 바뀌지 않는다.

이 경우 scalar는 대개 방향 정보가 약하다. “0.72”만으로 어떤 constraint가 깨졌는지 식별되지 않으면 같은 score를 만드는 여러 failure mode를 구분할 수 없다.

### 8.2 harness가 후보를 고르는 데 쓴다

```text
keep candidate if score(candidate) > score(best)
```

- metric은 외부 search·selection signal이다.
- model이 metric 값을 보지 않아도 loop trajectory가 달라질 수 있다.
- best-so-far retention은 regression을 막을 수 있지만 proxy overfitting은 막지 못한다.

### 8.3 decoder를 직접 제한한다

grammar, verifier-guided decoding, logit bias, rejection sampling처럼 score가 token/candidate 선택에 직접 관여할 수 있다. 이것은 inference algorithm의 update지만 model weight update는 아니다.

### 8.4 loss/reward로 학습한다

```text
θ_(t+1) = θ_t - η ∇_θ L(θ_t; feedback)
```

또는 reward model과 PPO/DPO 등으로 policy를 fine-tune하면 실제 parameter update다. InstructGPT는 demonstration으로 SFT하고, preference ranking으로 reward model을 학습한 뒤 PPO로 model을 fine-tune했다([Ouyang et al., 2022](https://arxiv.org/abs/2203.02155)). 이 경로가 없다면 “reward가 model을 강화했다”는 표현은 기능적 비유일 뿐이다. Reflexion이 논문 제목에 verbal reinforcement learning을 쓰면서도 weight를 update하지 않고 linguistic feedback과 episodic buffer를 사용한다고 명시한 것이 좋은 대조다([Shinn et al., 2023](https://arxiv.org/abs/2303.11366)).

## 9. 한 iteration의 실체적 추적: code agent 예시

목표가 “음수 total 요청은 HTTP 400을 반환해야 한다”라고 하자.

### 9.1 첫 호출 전

외부 상태:

```text
goal
repository files
current diff
selected code excerpts
tool descriptions
previous issue ledger
```

harness가 일부를 prompt로 직렬화한다. 이 시점까지 repository 자체는 model component가 아니다.

### 9.2 첫 model call

1. prompt가 tokenized된다.
2. 각 token의 embedding과 position representation이 만들어진다.
3. self-attention이 goal, code, tool schema의 관계를 layer별로 혼합한다.
4. MLP와 residual path가 hidden activation을 변환한다.
5. output head가 patch와 `run_tests` call의 logits를 낸다.
6. decoder가 실제 token/structured call을 선택한다.

변한 것: activation, attention weight, KV cache, output.

변하지 않은 것: `θ`.

### 9.3 외부 실행

runtime이 patch를 file system에 적용하고 test를 실행한다.

```text
unit test: PASS
contract test: FAIL
expected 400, received 200
```

이때 repository/process state가 바뀌고 observation이 생긴다. Transformer 내부 계산은 test를 실행하지 않았다.

### 9.4 state update와 두 번째 호출

harness가 다음을 보존한다고 하자.

```text
current patch
failed contract assertion
expected/actual pair
"clamp가 아니라 validation이 필요"라는 reflection
```

이 text가 두 번째 input에 포함되면:

- failed assertion은 새 token/key/value/activation이 된다.
- attention이 새 evidence와 goal·code를 연결할 수 있다.
- 다음 candidate distribution이 달라진다.
- cached prefix를 재사용할 수는 있어도 새 tool-result token의 representation은 새로 계산해야 한다.
- 여전히 `θ`는 동일하다.

### 9.5 어디에서 수렴이 생기는가

두 번째 candidate가 validation을 추가하고 contract test가 통과했다면 진전은 다음의 합성 결과다.

```text
diagnostic test
→ informative observation
→ faithful state retention
→ prompt serialization
→ model의 context utilization
→ 적절한 patch proposal
→ 외부 execution
→ accept/retention rule
```

어느 한 단계라도 끊기면 같은 frozen model이 있어도 loop가 수렴하지 않을 수 있다.

## 10. 수렴/비수렴을 구성요소별로 진단하는 법

### 10.1 전체 loop가 실제 최적화하는 것은 model loss가 아니다

frozen agent loop의 dynamics는 다음 합성 함수에 가깝다.

```text
z_(t+1) = U(z_t, Decode(p_θ(. | Serialize(Select(z_t)))), Execute, Evaluate)
```

수렴 성질은 `p_θ` 하나가 아니라 다음 전체에 달려 있다.

- environment의 관측 가능성과 비정상성
- evaluator/metric의 진실성·분해능·분산
- state update와 evidence retention
- retrieval·summary·serialization의 손실
- context 위치와 model utilization
- model capability와 instruction-following prior
- decoder/search budget
- accept, rollback, stopping rule

“model output이 안정된다”, “proxy metric이 plateau에 도달한다”, “true task utility가 만족된다”도 서로 다른 수렴 정의다.

### 10.2 실패 위치별 판별표

| 실패 층 | 실제 결함 | 관찰되는 증상 | model 구성요소와의 관계 | 분리 실험 |
|---|---|---|---|---|
| environment/observation | 실행하지 않았거나 필요한 state를 관측 못함 | feedback이 없거나 현실과 불일치 | 모델 밖 | oracle observation을 직접 제공 |
| evaluator/metric | proxy가 true utility와 불일치 | score는 오르지만 실제 품질 악화 | 모델 밖 selector 또는 text input | hidden test·human rubric과 상관 측정 |
| evaluator resolution | 서로 다른 failure가 같은 scalar를 냄 | 같은 score에서 무작위 수정 반복 | input 정보량 부족 | scalar 대신 counterexample·per-criterion score 제공 |
| state retention | 이전 반례·constraint를 버림 | 이미 고친 오류가 재발 | 외부 memory/update defect | append-only failure ledger와 비교 |
| retrieval/summary | 관련 evidence가 누락·왜곡 | 원본 log가 있으면 해결, summary만 있으면 실패 | context 생성 전 defect | oracle retrieval/raw log ablation |
| serialization | role·field·경계가 모호 | tool output과 instruction 혼동 | tokenization/input schema | typed schema와 explicit labels 비교 |
| context utilization | evidence는 들어갔지만 무시 | 위치를 바꾸면 결과 급변 | attention/activation-level limitation 가능 | evidence 위치 permutation, distractor ablation |
| model capability | evidence를 주어도 올바른 update를 생성 못함 | oracle context에서도 실패 | learned parameter/architecture 한계 | stronger model·fine-tuned model과 비교 |
| decoding/search | 좋은 candidate 확률은 있으나 선택 못함 | sample 간 variance가 큼 | output head 이후 inference policy | temperature, best-of-N, constrained decoding 비교 |
| tool policy/runtime | call/argument/permission 오류 | reasoning은 맞지만 action 실패 | output proposal 또는 외부 executor | gold call 실행, runtime trace 비교 |
| acceptance/rollback | 나쁜 candidate가 good state를 덮어씀 | metric oscillation·regression | harness control defect | best-so-far/transactional rollback 적용 |
| stopping | noisy score를 성공으로 오판 | premature stop 또는 endless loop | harness decision | confidence interval·patience·independent verifier |

### 10.3 metric defect를 더 정확히 나누기

metric 문제를 단순히 “metric이 나쁘다”로 묶지 말고 다음을 분리한다.

1. **Validity**: true task utility와 같은 대상을 재는가.
2. **Identifiability**: 낮은 점수의 원인을 다음 행동이 달라질 정도로 구분하는가.
3. **Sensitivity**: 의미 있는 개선에 score가 반응하는가.
4. **Specificity**: 무관한 surface change에 쉽게 반응하지 않는가.
5. **Variance**: 같은 candidate의 반복 평가가 안정적인가.
6. **Coverage**: hidden requirement와 위험을 빠뜨리지 않는가.
7. **Exploitability**: 실제 목적 없이 score만 올릴 수 있는가.
8. **Directionality**: counterexample, violated constraint, gradient-like local information을 주는가.
9. **Retention compatibility**: 얻은 failure evidence를 다음 iteration에 강제할 수 있는가.
10. **Stopping calibration**: threshold가 실제 acceptance 확률과 맞는가.

scalar metric은 ranking에는 충분할 수 있지만 repair direction에는 부족할 수 있다. 반대로 stack trace나 failing input은 원인 위치를 알려 주지만 전체 utility ranking에는 부족할 수 있다. 따라서 loop가 요구하는 feedback type과 metric output type을 맞춰야 한다.

## 11. loop engineering을 위한 최소 실험

아래 실험은 “모델 문제”, “state 문제”, “metric 문제”를 분해하는 데 직접적이다.

### 11.1 state 전달 audit

각 iteration마다 다음을 별도로 기록한다.

```text
external_state_before
selected_state
serialized_model_input
model_output
tool_call
raw_tool_result
evaluation
external_state_after
```

raw log가 존재했다는 사실보다 **serialized_model_input에 어떤 형태로 실제 포함되었는지**를 확인한다.

### 11.2 KV cache 대 semantic memory 대조

동일한 token prefix에 대해:

- KV/prompt cache를 재사용한 호출
- cache 없이 prefix를 다시 계산한 호출

을 deterministic decoding 또는 logprob로 비교한다. 의미론이 달라지면 단순 cache 최적화 외의 state, model version, quantization, random seed, provider behavior가 개입했을 가능성을 조사한다. cache on/off가 아니라 prefix content 변경이 품질을 바꾼다면 원인은 context다.

### 11.3 feedback informativeness ablation

같은 failure에 대해 다음 조건을 비교한다.

1. `score = 0`
2. pass/fail label
3. criterion별 score
4. natural-language critique
5. raw stack trace
6. minimal failing input/counterexample
7. gold diagnosis

다음 candidate가 바뀌는 정도와 실제 repair rate를 각각 측정한다. feedback이 output distribution을 바꾸지만 utility가 안 오르면 model utilization보다 metric alignment 또는 action quality 문제일 수 있다.

### 11.4 position과 distractor 실험

동일한 counterexample을 prompt 앞·중간·끝에 배치하고, 관련 없는 log 양을 변화시킨다. 성능이 크게 달라지면 “memory에 저장했는가”보다 **attention-accessible serialization**이 병목이다. 긴 context 이용의 position sensitivity는 1차 문헌에서도 반복 관찰되었다([Liu et al., 2023](https://arxiv.org/abs/2307.03172)).

### 11.5 retention 실험

- full transcript
- rolling summary
- append-only constraint/counterexample ledger
- retriever-selected memory
- best-so-far + rollback

을 비교한다. 같은 failure 재발률과 evidence recall을 측정하면 recurrent-state 부족이 아니라 external update policy의 결함인지 판별할 수 있다.

### 11.6 model-capability upper bound

oracle diagnosis, 최소 관련 code, 정답에 필요한 모든 constraint를 한 번에 제공해도 model이 올바른 candidate를 못 만들면 observation이나 memory보다 `θ`가 학습한 capability가 병목일 가능성이 높다. 이때 더 많은 동일 loop보다 model 교체, fine-tuning, specialized solver, constrained synthesis가 맞는 개입일 수 있다.

## 12. 사용하면 안 되는 동일시

| 부정확한 표현 | 더 정확한 표현 |
|---|---|
| “로그가 model memory에 저장됐다.” | “로그를 외부 state에 저장했고, 선택된 부분을 다음 context token으로 넣었다.” |
| “KV cache가 과거 경험을 학습했다.” | “과거 prefix의 layer별 key/value activation을 계산 재사용용으로 보존했다.” |
| “feedback으로 model을 fine-tune했다.” | “feedback을 prompt conditioning 또는 candidate selection에 사용했다.” 실제 optimizer step이 있다면 그때 fine-tuning이다. |
| “ICL은 내부 gradient descent다.” | “일부 controlled setting에서 optimizer-like computation과 equivalence/근사 증거가 있다. 실제 parameter는 고정이다.” |
| “attention이 agent memory다.” | “self-attention은 현재 context position의 정보를 선택·혼합한다. 영속성은 context/cache/harness가 제공한다.” |
| “tool을 model이 실행했다.” | “model이 call을 제안했고 runtime이 실행한 result를 model에 돌려줬다.” |
| “긴 context면 모든 state를 기억한다.” | “입력에는 존재하지만 retrieval·position·distractor 때문에 사용 실패가 가능하다.” |
| “반복할수록 model이 좋아진다.” | “외부 state와 후보 selection이 좋아질 수 있다. update가 정보 보존·활용을 못하면 반복해도 개선되지 않는다.” |
| “stateful API이므로 weight가 갱신된다.” | “provider가 transcript, reasoning item, cache 또는 opaque application state를 보존할 수 있다. weight update 여부는 별도다.” |

## 13. 설계 원칙

1. **state의 물리적 위치를 먼저 적는다.** token, tensor, file, DB row, process, parameter, optimizer state를 구분한다.
2. **모델에 들어가는 최종 serialization을 관측 가능하게 만든다.** memory write보다 context inclusion이 먼저다.
3. **metric의 배선을 적는다.** prompt cue, selector, decoder constraint, training reward 중 무엇인지 명시한다.
4. **scalar와 diagnostic feedback을 분리한다.** ranking signal과 repair direction은 같은 기능이 아니다.
5. **반례와 constraint를 누적 보존한다.** summary가 실패 조건을 지우면 같은 state를 순환한다.
6. **KV cache를 품질 mechanism으로 세지 않는다.** 동일 prefix의 latency/cost 최적화와 semantic state update를 분리한다.
7. **context utilization을 ablation으로 검증한다.** 존재 여부, 위치, 순서, distractor에 대한 민감도를 측정한다.
8. **frozen-weight 한계를 upper-bound test로 찾는다.** oracle context에서도 실패하면 loop plumbing보다 model capability를 의심한다.
9. **수렴 기준을 proxy와 true utility로 이중화한다.** score plateau, candidate stability, 실제 acceptance를 구분한다.
10. **architecture-specific state를 확인한다.** Transformer-XL, RMT, TTT, stateful provider API를 vanilla Transformer의 보편 속성으로 일반화하지 않는다.

## 14. 1차 출처별 핵심 주장과 해석 한계

| 출처 | 이 문서에서 사용하는 핵심 주장 | 이 출처로 말할 수 없는 것 |
|---|---|---|
| [Vaswani et al., *Attention Is All You Need*](https://arxiv.org/abs/1706.03762) | Transformer의 attention·FFN·residual·masked decoder 계산, 원 architecture가 recurrence를 제거함 | 현대 proprietary agent의 전체 내부 구조 |
| [Brown et al., *Language Models are Few-Shot Learners*](https://arxiv.org/abs/2005.14165) | text demonstration에 의한 ICL이 gradient update/fine-tuning 없이 가능 | 모든 ICL의 mechanistic explanation |
| [Dai et al., *Transformer-XL*](https://arxiv.org/abs/1901.02860) | 이전 segment hidden state cache를 재사용하는 명시적 recurrence | 일반 KV cache나 모든 chat session이 같은 recurrence라는 주장 |
| [Kwon et al., *PagedAttention*](https://arxiv.org/abs/2309.06180) | KV cache가 request별로 커지는 serving memory이며 공유·paging이 throughput에 중요 | KV cache가 semantic episodic memory라는 주장 |
| [Geva et al., *Transformer FFN Layers Are Key-Value Memories*](https://arxiv.org/abs/2012.14913) | FFN weight와 activation을 key-value memory 관점으로 분석 가능 | 외부 log가 inference 중 FFN weight에 기록된다는 주장 |
| [Olsson et al., *In-context Learning and Induction Heads*](https://arxiv.org/abs/2209.11895) | induction circuit과 ICL onset의 causal/correlational evidence | 모든 large-model ICL을 한 circuit으로 설명 |
| [Akyürek et al., *What learning algorithm is in-context learning?*](https://arxiv.org/abs/2211.15661) | linear task에서 Transformer가 standard estimator를 구현·근사하고 implicit model quantity를 activation에 encode | 자연어 agent loop가 실제 SGD로 weight를 update한다는 주장 |
| [von Oswald et al., *Transformers learn in-context by gradient descent*](https://arxiv.org/abs/2212.07677) | simple regression에서 linear self-attention computation과 GD transformation의 관계 | 일반 softmax frontier model과 임의 작업에 대한 보편 등가 |
| [Xie et al., *ICL as Implicit Bayesian Inference*](https://arxiv.org/abs/2111.02080) | mixture-of-HMM setting에서 latent concept inference로 ICL emergence 설명 | 모델이 명시적 Bayesian belief state를 보존한다는 주장 |
| [Todd et al., *Function Vectors in LLMs*](https://arxiv.org/abs/2310.15213) | 일부 model/task에서 attention head가 compact task representation을 전달 | agent state field마다 고정 function vector가 있다는 주장 |
| [Lewis et al., *Retrieval-Augmented Generation*](https://arxiv.org/abs/2005.11401) | parametric memory와 dense-index non-parametric memory의 구분 | retrieved fact를 generator가 반드시 올바르게 사용한다는 보장 |
| [Graves et al., *Neural Turing Machines*](https://arxiv.org/abs/1410.5401) | neural controller와 differentiable external memory의 결합 | 보통의 file/vector DB agent가 end-to-end differentiable하다는 주장 |
| [Packer et al., *MemGPT*](https://arxiv.org/abs/2310.08560) | context window 밖 memory tier를 관리하는 agent-system design | model weight 자체가 장기 session memory로 변한다는 주장 |
| [Yao et al., *ReAct*](https://arxiv.org/abs/2210.03629) | reasoning, action, external observation을 interleave하는 trajectory | reasoning trace가 faithful internal computation이라는 보장 |
| [Schick et al., *Toolformer*](https://arxiv.org/abs/2302.04761) | API call 시점·argument·result incorporation을 학습 가능 | model이 external tool implementation을 내부에서 실행한다는 주장 |
| [Shinn et al., *Reflexion*](https://arxiv.org/abs/2303.11366) | weight update 없이 linguistic feedback과 episodic buffer로 다음 trial을 조건화 | linguistic reflection이 실제 RL parameter update라는 주장 |
| [Ouyang et al., *InstructGPT*](https://arxiv.org/abs/2203.02155) | demonstration SFT와 preference reward/PPO가 실제 fine-tuning 경로임 | online agent의 scalar prompt가 자동으로 RLHF가 된다는 주장 |
| [Sun et al., *Learning to (Learn at Test Time)*](https://arxiv.org/abs/2407.04620) | hidden state를 model로 두고 test-time learning rule로 갱신하는 TTT layer | 표준 Transformer API가 이런 update를 수행한다는 주장 |
| [Liu et al., *Lost in the Middle*](https://arxiv.org/abs/2307.03172) | context 내 정보의 위치와 길이가 utilization에 큰 영향을 줄 수 있음 | 모든 최신 model에 동일한 U-shape 수치가 유지된다는 주장 |
| [Google, *Function calling with the Gemini API*](https://ai.google.dev/gemini-api/docs/function-calling) | 2026년 공식 구현에서도 app이 function을 실행하고 result를 model에 돌려주는 경계 | 모든 provider의 내부 orchestration 세부사항 |
| [Google, *Context caching*](https://ai.google.dev/gemini-api/docs/generate-content/caching) | cached content는 prompt prefix이며 model은 cached/regular token을 구분하지 않음 | 모든 provider가 동일한 cache format·TTL을 사용한다는 주장 |

## 15. 최종 요약

Agent loop의 state는 하나가 아니다.

```text
환경 state        : repository, browser, process, database
agent 외부 state  : transcript, memory, ledger, score, best-so-far
model input state : serialized token sequence
model 계산 state  : hidden activation, attention weight, KV tensor
model 장기 state  : learned parameter θ
training state    : gradient, optimizer moment, checkpoint
```

일반 frozen-weight loop의 주 경로는 다음이다.

```text
외부 evidence
→ 선택·요약·직렬화
→ context token
→ attention/MLP activation
→ output distribution
→ decoded action
→ 외부 실행·평가
→ 다음 외부 state
```

따라서 수렴하지 않을 때 “model이 feedback을 학습하지 못했다”라고 한 문장으로 결론 내리면 원인을 잃는다. 먼저 observation이 충분히 진단적인지, state가 보존됐는지, 실제 model input에 들어갔는지, model이 context에서 사용했는지, candidate를 생성할 capability가 있는지, decoder와 accept rule이 진전을 보존하는지를 순서대로 분리해야 한다. 이 분해가 metric defect, memory defect, context-use defect, model-capability defect를 구별하는 loop engineering의 출발점이다.
