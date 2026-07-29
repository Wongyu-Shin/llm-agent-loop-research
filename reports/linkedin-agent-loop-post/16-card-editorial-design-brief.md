# Editorial Card Design Brief

## Objective

Raise the LinkedIn carousel from “readable generated cards” to a more deliberate editorial design system while preserving the existing argument and one-card-per-file output.

## Design Principles

1. Editorial hierarchy
   - Each card must have one dominant headline, one concise body block, one secondary footer note, and one visual idea.
   - The reader should understand the card by scanning headline -> body lead -> footer.

2. Grid and alignment
   - Use a consistent page margin and modular vertical rhythm.
   - Align visual elements, headline, and body to a shared grid rather than centering everything.

3. Contrast and readability
   - Use high-contrast dark/paper fields.
   - Keep Korean body text large enough for mobile feed scanning.
   - Avoid text over complex graphics.

4. Repetition with variation
   - Keep a stable masthead, card number, accent rail, footer rule, and color system.
   - Vary the top visual motif per card so the carousel does not feel like the same slide repeated.

5. Proximity and grouping
   - Related concepts should sit together: card number and section label in the dark masthead, argument text in the paper reading zone, source/summary note in the footer.

6. Negative space
   - Do not fill every available area.
   - Use whitespace as a pacing tool, especially between headline and body.

7. Sequence rhythm
   - Card 1 is a hook.
   - Cards 2-4 establish the thesis.
   - Card 5 provides empirical humility.
   - Cards 6-9 present the four control surfaces.
   - Card 10 closes with a compact design-review question.

## Output Contract

- Generate individual files `card-01.png` through `card-10.png`.
- Keep each card at `1080x1350`.
- Also generate a contact sheet for visual QA.
- Preserve alt text.
- Render from `data/M4b-linkedin-cardnews.json` as the single source of content truth.

