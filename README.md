# ThinkBuddy

A focused builder workspace with a mascot council, editable problem breakdowns, action planning, simulated research, and a final thinking receipt.

## Run locally

Use Node 22.13 or newer, then run `npm ci` and `npm run dev`.

Guest missions are stored in this browser. Signed-in missions use owner-scoped D1 records with optimistic revision checks. Existing mission data remains compatible.

## Builder experience

- **Discuss:** answer an individual agent or the whole mission using text, attachments, voice, or a poll popup. After a reply, review key points and choose whether to continue.
- **Breakdown:** edit the problem, audience, desired outcome, known information, constraints, and smaller issues. Choose a focus, merge issues, and adopt suggested actions with completion criteria.
- **Research:** prepare polls, surveys, or prototype tasks, preview questions, explicitly launch a simulated test, inspect source-linked sample responses, review each agent’s suggestions alongside their evidence and limitations, and record decisions and next actions.
- **Thinking receipt:** summarize at any time, record an optional decision, finish, and explicitly resume later. The receipt preserves conclusions and uncertainties without exposing hidden model reasoning.

Research responses, budgets, and payments are always simulated in this release, including when live AI is configured. No recruitment, real spending, participant accounts, or payouts occur. Respondent previews do not become evidence. USD is the illustrative budget currency.

## AI, voice, and uploads

Configure `OPENAI_API_KEY` as a server-side runtime secret to enable live council discussion, problem decomposition, action suggestions, research drafting, source checks, transcription, and PDF/image reading. Without a key, conversations and research use explicitly labeled illustrative demos. Never put credentials in browser code.

Guest/demo voice uses browser speech recognition where available; live voice uses the authenticated transcription endpoint. Browser recognition may use the browser vendor's service. Every transcript is editable before sending. Replies can be read aloud with play/pause/stop controls. Text input remains available if speech or microphone access fails.

Uploads support up to 3 files, 5 MB each, 10 MB total. Demo mode reads TXT, Markdown, CSV, and JSON locally. Live mode also reads PDFs and PNG/JPEG/WebP images. Original binary files and recorded audio are not retained; extracted content and metadata stay with the discussion. Attachments are user-supplied context, not independently verified evidence.

## Notes and second brain

Notebook, ThinkVault, ThinkMap, Obsidian sync, and automatic note capture have been removed from the active interface. Existing saved note/map payloads and legacy utilities remain for compatibility; new discussions and decisions do not create notes. Existing local vault-sync changes have not been discarded.

## Checks

    npx tsc --noEmit
    node --test tests/*.test.mjs
    npm run build

Tests cover legacy compatibility, upload validation, persistence conflicts, focused breakdowns, suggested action adoption, simulated research validation and idempotency, poll answers, decision history, and receipt persistence.

## Publication

The existing Sites identity is retained in `.openai/hosting.json`. Publication requires access to that existing Site; do not create a replacement or change its audience silently. Local preview and production build can be verified independently of hosting access.
