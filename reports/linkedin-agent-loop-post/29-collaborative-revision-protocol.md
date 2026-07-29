# Collaborative Revision Protocol

Date: 2026-05-29

Target draft: `07-blog-post-final.md`

This document fixes the working method for the ongoing revision conversation. The revision continues until the user explicitly declares it finished.

## Research Basis

The revision plan is based on common writing-center guidance:

- Purdue OWL, Higher Order Concerns and Lower Order Concerns: revise thesis, purpose, audience, organization, and development before sentence-level cleanup.
- University of Nevada, Reno Writing & Speaking Center: revision is re-seeing the text, not quick cleanup; editing should usually come after higher-order changes.
- Kennesaw Writing Center, Reverse Outlining: after a draft exists, summarize each paragraph or section to check whether the paper is organized, balanced, and connected to its thesis.
- Purdue OWL, Instructor's Guide for Giving Feedback: focus feedback on a small number of major issues per round; interactive feedback works well for argument, organization, and idea development.

## Working Principle

User suggestions are not applied automatically.

Each proposed change should be examined through five questions:

1. Does it make the central claim more accurate?
2. Does it make the reader promise clearer?
3. Does it reduce overclaim without draining the essay's force?
4. Does it improve the argument's structure or evidence?
5. Does it improve Korean readability without losing technical precision?

## Response Pattern For Each User Suggestion

For every suggested change, respond in this order:

1. Classification: structure, logic, evidence, terminology, style, rhythm, or proofread.
2. Judgment: agree, partially agree, or disagree.
3. Reason: explain the reader effect and technical risk.
4. Alternative: keep original, apply user proposal, or propose a third version.
5. Edit: only modify the draft after the preferred direction is clear.

## Revision Order

1. Opening and conclusion
   - Confirm thesis, reader promise, and final takeaway.
   - Make sure "loop" is not read as universal necessity.

2. Reverse outline
   - Check whether each section has one job.
   - Remove or merge sections that repeat the same function.

3. Argument and overclaim
   - Audit claims around necessity, closed-loop control, self-reflection, verifier, and pilot.
   - Prefer conditional claims where evidence is conditional.

4. Evidence and source mapping
   - Connect each major claim to a source family.
   - Keep the pilot as a failure-mode note, not empirical proof.

5. Paragraph rhythm
   - Fix duplicated moves, weak transitions, and dense lists.
   - Preserve strong memorable sentences only if caveats are nearby.

6. Korean polish
   - Remove translationese and mechanical connective patterns.
   - Keep technical terms when they carry useful precision.

7. Final proofread
   - Check headings, links, terminology consistency, punctuation, and markdown readability.

## Current Draft Reverse Outline Seed

1. Opening: reframes the question from "is it a loop?" to "what closes the loop?"
2. Section 1: shows that current agent products and methods often use loop-shaped execution.
3. Section 2: separates simple repetition from closed-loop control.
4. Section 3: weakens the "softmax makes loop inevitable" argument.
5. Section 4: separates next-token objective, sequence likelihood, and task utility.
6. Section 5: shows when text generation becomes a system problem.
7. Section 6: isolates the pilot as an underpowered failure-mode note.
8. Section 7: defines four control surfaces: verifier, feedback, tool access, state control.
9. Section 8: contrasts weak loops and strong loops.
10. Section 9: turns the argument into design-review questions.
11. Section 10: lists cases where loops are unnecessary or harmful.
12. Section 11: restates that signal quality, not repetition, is the point.
13. Sources: maps source families to model objective, decoding/search, test-time compute, verifier, and agent engineering.

## Guardrails

- Do not turn the essay into a paper unless the user explicitly wants that.
- Do not over-flatten the central metaphor; "what closes the loop?" is a useful essay hook.
- Do not let the pilot carry the thesis.
- Do not accept user wording merely because it sounds sharper.
- Do not reject user wording merely because it is less cautious; first check whether the surrounding caveats already handle the risk.
