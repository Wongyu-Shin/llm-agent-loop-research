# Revision Queue

Date: 2026-05-29

Target draft: `07-blog-post-final.md`

This is a live queue for the collaborative revision. It does not prescribe edits. It lists likely discussion points so that future user suggestions can be evaluated consistently.

## Priority 1: Opening And Reader Promise

Current job:

- Reframe the question from "is an agent a loop?" to "what closes the loop?"
- Establish that loop is conditional, not universal.
- Preserve the memorable hook.

Likely tension:

- The phrase "loop를 닫는다" is strong and memorable, but it can sound like a control-theory claim stronger than the essay intends.
- The opening already contains several caveats. Too many caveats can weaken the hook before the reader is invested.

Default stance:

- Do not remove the hook unless the replacement is equally memorable.
- Prefer nearby definitions and caveats over flattening the metaphor.

Questions to ask during edits:

- Does the first page still answer why the reader should care?
- Is "closed loop" clearly a design lens rather than a performance guarantee?
- Can the sentence "verifier가 없는 반복은..." stay, or should it move later after more evidence?

## Priority 1A: Reader Background And Agent Examples

Current job:

- Help LinkedIn readers who do not already know agent internals.
- Show that Codex, Claude Code, Anthropic tool use, Ralph loop, and Karpathy's `autoresearch` are loop-shaped without turning the essay into a product survey.

Likely tension:

- Too little context makes the later control-surface argument feel abstract.
- Too much context makes the opening feel like a catalog of tools.

Default stance:

- Keep each example to one or two sentences.
- Use examples to motivate the problem, not to prove the whole thesis.

Questions to ask during edits:

- Does the section help non-agent readers enter the essay?
- Does any example need to be cut or moved to Sources?
- Are product names doing explanatory work, or just adding noise?

## Priority 2: Section 2 And The Softmax Argument

Current job:

- Reject the naive "probabilistic token generation makes loops inevitable" argument.
- Replace it with objective mismatch.

Likely tension:

- The section is technically safer now, but it may feel slightly defensive.
- The best-of-n paragraph contains several technical conditions in one sentence.

Default stance:

- Keep the distinction between sampling policy and objective mismatch.
- Consider splitting the best-of-n sentence if a user flags readability.

Questions to ask during edits:

- Is the math doing real work, or just signaling rigor?
- Does the section clearly preserve the user's original intuition while correcting it?

## Priority 3: Section 3 Objective Mismatch

Current job:

- Separate next-token objective, sequence likelihood, and task utility.
- Establish why external verification and state control become relevant.

Likely tension:

- This is the conceptual core, but it may be dense for a LinkedIn reader.
- The utility proxy equation is precise but slightly paper-like.

Default stance:

- Keep the three-level distinction.
- Be willing to trim notation only if the surrounding prose remains exact.

Questions to ask during edits:

- Does a non-research engineer understand the difference after one read?
- Is "verifier_signal = proxy(U) + noise + bias" worth its cost?

## Priority 4: Section 5 Pilot Note

Current job:

- Keep the pilot as a failure-mode note, not proof.
- Prevent the pilot from carrying the thesis.

Likely tension:

- If too weak, the reader asks why it is included.
- If too strong, it sounds like an empirical claim.

Default stance:

- Keep it short and explicitly underpowered.
- Use it to motivate design questions, not conclusions.

Questions to ask during edits:

- Would the essay lose anything essential if this section became a footnote?
- Does this section strengthen the essay, or just defend earlier research labor?

## Priority 5: Section 6 Four Control Surfaces

Current job:

- Define verifier, actionable feedback, tool access, and state control.
- Keep the roles separate even if implementations combine them.

Likely tension:

- The role table is useful but can feel textbook-like.
- Each subsection is clear, but the combined section is long.

Default stance:

- Preserve the four-part framework.
- If cutting, reduce examples before cutting definitions.

Questions to ask during edits:

- Is each surface necessary to the final argument?
- Are verifier and feedback sufficiently distinct?
- Does state control deserve earlier placement?

## Priority 6: Sections 7-9 Weak/Strong Loop And Failure Modes

Current job:

- Show that self-reflection is not independent verification.
- List cases where loops can be unnecessary or harmful.

Likely tension:

- Sections 7 and 9 partially overlap.
- Failure modes are useful, but many small headings can fragment the essay.

Default stance:

- Keep the self-reflection distinction.
- Consider merging repeated failure-mode material if the user wants a tighter essay.

Questions to ask during edits:

- Should weak/strong loop come before the four control surfaces or after?
- Are "correlated candidates" and "weak verifier" explained once too many times?

## Priority 7: Conclusion

Current job:

- Reassert that loop itself is not the goal.
- End with a memorable design principle.

Likely tension:

- The conclusion repeats caveats from the opening.
- The final checklist is useful but slightly instructional.

Default stance:

- Preserve the final line unless a stronger line appears.
- Trim repeated caveats before trimming the central takeaway.

Questions to ask during edits:

- Does the conclusion add compression, or merely repeat?
- Should the checklist move to section 8 and let the conclusion end cleaner?

## Priority 8: Korean Style And Terminology

Current job:

- Make the article natural in Korean while preserving technical precision.

Likely tension:

- Terms such as verifier, feedback, state, rollback, utility proxy, and control surface are useful but visually dense.
- Over-Koreanizing them may make the essay less legible to the target technical audience.

Default stance:

- Keep core engineering terms in English if Korean translations are awkward.
- Add Korean glosses on first use, then use the shorter technical term.

Questions to ask during edits:

- Is this term something the target reader already uses?
- Does the English term carry precision, or is it just habit?

## Suggested Next Conversation Move

Ask the user to propose the first concrete edit. Evaluate it using the protocol in `29-collaborative-revision-protocol.md`.
