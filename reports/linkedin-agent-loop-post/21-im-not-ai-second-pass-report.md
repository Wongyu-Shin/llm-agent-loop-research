# im-not-ai Second Pass Report

## Source Method

Applied the public `epoko77-ai/im-not-ai` Korean humanizing method as a proofreading checklist, not as a claim-changing rewrite.

Relevant rules used:

- Meaning fidelity: facts, claims, numbers, proper nouns, and citations preserved.
- Locality: only detected AI-tell spans were edited.
- Tone match: technical blog / LinkedIn carousel tone preserved.
- Over-polish guard: edits stayed surgical, with no genre shift.
- Main target categories: translationese, mechanical enumeration, rigid connective flow, excess formal nouns, and unnecessary English where Korean reads cleaner.

Reference: `https://github.com/epoko77-ai/im-not-ai`

## Edited Files

- `reports/linkedin-agent-loop-post/07-blog-post-final.md`
- `reports/linkedin-agent-loop-post/10-linkedin-caption.md`
- `reports/linkedin-agent-loop-post/11-card-topics.md`
- `reports/linkedin-agent-loop-post/13-card-copy.md`
- `data/M4b-linkedin-cardnews.json`

## Main Findings And Fixes

| Pattern | Examples found | Fix style |
|---|---|---|
| Mechanical enumeration | `첫째/둘째/셋째/넷째` blocks | Replaced with varied prose: `우선`, `다음`, `마지막`, direct topic starts |
| Rigid connective flow | `따라서`, `그러므로` in explanatory prose | Replaced or deleted where inference was already clear |
| Translationese / formal nouns | `필요성`, `대체하기`, `요약:` | Rephrased to `설계 요구`, `대신하기`, `짧게 말하면` |
| Unnecessary English in public-facing copy | `underpowered synthetic single-run pilot`, `weak verifier` | Rephrased to Korean while preserving technical meaning |
| Slogan-like card copy | Some cards read like compact system prompts | Rebalanced into readable Korean card copy without losing technical terms |

## Fidelity Check

Preserved:

- Central thesis: loop is not universally mandatory; it becomes conditionally useful/necessary under reliability, long-horizon work, external observation, verification, repair, and state recovery.
- Mathematical argument: next-token objective, sequence likelihood, and task utility are distinct.
- Pilot caveat: the pilot is not publication-grade evidence.
- Card structure: 10-card LinkedIn carousel, individual PNG output, same deck sequence.
- Technical terms where replacing them would blur meaning: `verifier`, `feedback`, `rollback`, `state`, `task utility`, `objective mismatch`, `false positive`, `correlated guessing`.

## Result

The text now keeps the technical argument but reads less like a generated outline. The main visible changes are smoother Korean rhythm, fewer mechanical transitions, less English in LinkedIn-facing copy, and cleaner card phrasing.

