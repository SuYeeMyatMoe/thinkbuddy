# ThinkBuddy: focused critical-thinking MVP

Status: implementation plan; application behavior has not changed.

## Purpose

Help students, vibe coders, and hackathon teams understand who needs their project, why someone would choose it, and which assumptions need testing. The outcome is a better-supported decision and a visible record of learning.

## One complete journey

Add a project → state your reasoning → review three risky assumptions → answer one perspective challenge → attach/check evidence → revise a decision → save the learning map.

1. Ask for the idea, intended user, user problem, and current alternative. Keep resources and deadline optional. Reuse the existing attachment pipeline for a screenshot or README; do not add website crawling to the MVP.
2. Before revealing AI suggestions, ask: “Why would someone choose this over what they already use?” Save the builder's answer. Offer “I'm not sure yet” so the step is useful without becoming a barrier.
3. Suggest up to three explicit, editable assumptions about need, switching, or continued use. Show why each matters and what would disprove it. These are hypotheses, not discoveries about actual users.
4. Let the builder choose one assumption. Reveal up to two short, distinct mascot challenges for that assumption. Offer Answer, Challenge, and Mark for testing. Avoid generating a full round of council discussion for each interaction.
5. Link a source or uploaded feedback to that assumption. Let the builder inspect the excerpt, context, and limitations before accepting the link.
6. Ask: “What do you think now, and why?” Save the revised decision with the evidence used, the previous view, and one next test. “Still uncertain” is a valid result.

## Reuse and changes

| Feature | Reuse today | Required change |
| --- | --- | --- |
| Project brief | Landing/start form, mission brief, uploads | Add problem and current alternative; save the initial reasoning before revealing suggestions. |
| Assumption finder | Structured AI output and mission persistence | Store assumptions as editable records with stable IDs, rationale, disconfirming observation, and next test. Let the builder choose the priority. |
| Perspective challenges | MascotStage, targeted replies, question answers | Anchor each challenge to an assumption. Keep two short sentences visible, with detail on card hover/tap. Bodies and names continue selecting mascots. |
| Evidence workspace | Sources panel, source research, upload extraction | Link supporting, conflicting, or inconclusive material to assumptions; retain provenance, excerpt/reference, research date, and limitations. |
| Learning map | ThinkMap, themed notes, Obsidian bundle/sync | Generate linked assumption → evidence → decision nodes. Preserve decision history and export the same reasoning chain to Markdown and Canvas. |

## Main screen

- Preserve the responsive mascot artwork and familiar visual style.
- Make the primary workspace an assumption board, with one selected assumption and its challenges. Keep discussion history available as secondary detail.
- Limit the visible result to four cards: Who needs it; Why choose it; Biggest uncertainty; Next test.
- Show one clear primary action for the current step. Keep the existing composer for answers and uploads.
- Use progressive disclosure: short cards first, explanations on speech-card hover, keyboard focus, or tap. Mobile must support the same actions without hover.

## Data and trust

Add an optional, versioned project-review object to Mission rather than reinterpreting existing statements or deleting old data. It should contain:

- Project context and the builder's initial reasoning.
- Assumptions with stable IDs and builder edits.
- Challenges referencing an assumption and mascot, plus builder responses.
- Evidence records referencing assumptions and their original sources or uploaded messages. Relations are supports, conflicts, or inconclusive; they are not proof labels.
- Append-only decision revisions with previous/current reasoning, referenced evidence IDs, timestamp, and next test.

Keep observations from user feedback separate from external research and AI-generated hypotheses. Interview excerpts represent the people interviewed, not an entire audience. Do not count mascot agreement as independent evidence, assign unsupported confidence scores, or claim to eliminate bias. Edited assumptions retain their earlier wording so evidence links can be reviewed for relevance.

Missions already store their payload as JSON, so the initial storage approach can remain. Update server validation, request/output schemas, guest persistence, demo fixtures, map generation, and exports together. Existing saved missions continue opening with their current workspace; they are not silently converted or regenerated.

## Delivery order

1. **Brief and reasoning gate:** persist draft context and initial answer; revise onboarding copy for young project builders.
2. **Assumption board and challenges:** generate/edit three assumptions, select one, answer/challenge/mark for testing, and show the four-card result. Replace generic long council prompts with bounded review actions.
3. **Evidence links:** research only the chosen assumption on request; reuse uploads and let users confirm extracted feedback links. Failed research stays visibly unknown and retryable.
4. **Learning loop:** save a decision revision, update map and notes, and export an Obsidian bundle that preserves links. Reopen the project to continue from the unresolved assumption.

Ship these as one narrow end-to-end MVP. Keep task management, broad planning, speculative scenarios, voice expansion, website crawling, and external action execution outside the primary flow. Preserve existing saved data and access to older tools.

## Acceptance checks

- The first review does not reveal AI answers before the builder answers or chooses “I'm not sure yet.”
- A builder can correct an assumption, answer a challenge, attach real feedback, inspect its evidence link, and revise a decision without navigating multiple tool modals.
- AI-created perspectives are visibly hypotheses. Contradictory and inconclusive evidence remain visible; failed research never appears verified.
- Each decision revision shows what changed and why. Previous reasoning survives edits, reloads, and later reviews.
- ThinkMap and the Obsidian bundle retain the assumption/evidence/decision relationships and valid file paths.
- Old missions still load; guest isolation, ownership checks, save-conflict protection, and server-only secrets remain intact.
- Keyboard and mobile users can complete the same journey. Card details do not block mascot selection.

Validate value with actual young builders: can they explain a previously hidden assumption, identify what evidence would change their mind, and carry out the proposed user test? Track completed learning loops and useful decision changes rather than message counts.
