# M4b Agent Loop Necessity Mathematical Appendix

Date: 2026-05-27
Status: deterministic appendix
Script: `scripts/m4b_loop_math_demo.py`
Result: `data/M4b-agent-loop-necessity-math-demo.json`

## Purpose

This appendix gives reproducible calculations for the mathematical part of the conditional loop-necessity thesis. It does not call an LLM. The point is narrower: fix the formal claims that are independent of any particular model provider.

The script demonstrates five claims:

1. Token-level greedy decoding can miss sequence-level MAP.
2. Horizon risk increases under explicit nonzero hazard assumptions.
3. Best-of-n improves oracle success only when success can be selected.
4. Verifier quality determines whether repeated sampling helps, plateaus, or hurts.
5. Cost creates a finite optimum, so "loop forever" is not justified.

## Demo 1: Token-Greedy Can Miss Sequence MAP

The demo uses this toy distribution:

```text
P(A | x) = 0.6
P(B | x) = 0.4
P(C | x,A) = 0.5
P(D | x,B) = 1.0
```

Greedy chooses `A C`:

```text
P(A C | x) = 0.6 * 0.5 = 0.30
```

The sequence MAP path is `B D`:

```text
P(B D | x) = 0.4 * 1.0 = 0.40
```

This supports the user's intuition that locally plausible early tokens can close off better later trajectories. It does not yet prove that loops solve the problem; it only proves that local decoding is not globally reliable even under the model's own probability objective.

## Demo 2: Horizon Risk Requires Explicit Assumptions

The hazard calculation uses:

```text
P(any failure by T) = 1 - (1 - epsilon)^T
```

For `epsilon = 0.01`, the generated result is:

| horizon | probability of at least one failure |
|---:|---:|
| 10 | 0.0956 |
| 100 | 0.6340 |
| 1,000 | 0.99996 |
| 10,000 | approximately 1 |
| 100,000 | approximately 1 |

This supports a horizon-risk argument: small unrepaired hazards become large in long tasks. But it also clarifies the condition. The argument requires an unrepaired harmful-commitment event with nonzero lower-bounded probability. It is not a theorem that low-probability tokens must appear under every decoding policy.

## Demo 3: Best-Of-N With Perfect Selection

The idealized best-of-n formula is:

```text
P(success among n) = 1 - (1 - p)^n
```

For `p = 0.05`, the demo gives:

| n | success probability |
|---:|---:|
| 1 | 0.0500 |
| 2 | 0.0975 |
| 4 | 0.1855 |
| 8 | 0.3366 |
| 16 | 0.5599 |
| 32 | 0.8063 |
| 64 | 0.9625 |
| 128 | 0.9986 |

This is the clean mathematical basis for repeated sampling, self-consistency, and test-time scaling. It is also too optimistic because it assumes a perfect selector or verifier.

## Demo 4: Verifier Quality Is The Bottleneck

The script computes exact expected selected-success probability under a noisy verifier.

Selection rule:

1. Generate `n` candidates.
2. The verifier labels successful candidates as pass with true positive rate `TPR`.
3. The verifier labels failed candidates as pass with false positive rate `FPR`.
4. If anything passes, choose uniformly among passing candidates.
5. If nothing passes, choose uniformly among all candidates.

Base candidate success probability is `p = 0.10`.

| verifier | TPR | FPR | n=1 | n=8 | n=32 | n=64 |
|---|---:|---:|---:|---:|---:|---:|
| strong | 0.95 | 0.05 | 0.1000 | 0.4773 | 0.6732 | 0.6785 |
| moderate | 0.75 | 0.25 | 0.1000 | 0.2376 | 0.2500 | 0.2500 |
| weak | 0.55 | 0.45 | 0.1000 | 0.1193 | 0.1196 | 0.1196 |
| adversarial | 0.35 | 0.65 | 0.1000 | 0.0565 | 0.0565 | 0.0565 |

Interpretation:

1. Strong verifiers convert more candidates into large gains.
2. Moderate verifiers plateau.
3. Weak verifiers barely improve.
4. Adversarial verifiers make more sampling worse than one-shot.

This directly supports the paper's boundary condition: loops are not sufficient. A loop without reliable selection can waste compute or degrade utility.

## Demo 5: Cost Creates A Finite Stopping Point

The script uses:

```text
net_utility(n) = P(success among n) - 0.01 * n
```

with `p = 0.05`.

The best `n` in the searched range is:

```json
{
  "n": 32,
  "success": 0.8062885155414992,
  "net_utility": 0.48628851554149916
}
```

This supports budgeted stopping rules. Even when more samples increase raw success, cost can make unbounded looping irrational.

## Implications For The Main Thesis

These calculations support the conditional thesis but not the universal thesis.

| original intuition | appendix result |
|---|---|
| Greedy local choices can miss better global paths. | Supported by Demo 1. |
| Long runs accumulate error risk. | Supported only under explicit hazard assumptions in Demo 2. |
| Repeating attempts can improve success. | Supported under ideal selection in Demo 3. |
| Looping is not enough by itself. | Supported by verifier-quality results in Demo 4. |
| Loop depth should be bounded. | Supported by cost-normalized optimum in Demo 5. |

The appendix therefore reinforces the corrected thesis:

> LLM agent loops are conditionally justified as bounded search and feedback control, not as unlimited repetition and not as a universal requirement for every LLM task.

## Reproduction

Run:

```sh
python3 scripts/m4b_loop_math_demo.py
jq . data/M4b-agent-loop-necessity-math-demo.json >/dev/null
```

The script is deterministic and uses only the Python standard library.
