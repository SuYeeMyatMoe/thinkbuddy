# ThinkBuddy

A private, mascot-first thinking workspace built with React, Vinext, Sites, D1, Motion, and XYFlow.

Public access: the homepage uses optional identity and opens without signing in when Site sharing is public. Anonymous visitors use a clearly labeled demo and store missions only in browser localStorage. Personal D1 mission APIs and paid OpenAI requests still require authentication. Guest data is not automatically uploaded or merged into an account. Clearing browser data removes guest missions; export notes to keep a copy.

## Run locally

Use Node 22.13 or newer. Install dependencies with npm ci, then npm run dev. The local Sites preview supplies a development-only sign-in flow. Production uses ChatGPT sign-in.

The D1 schema is defined in db/schema.ts. Generate migrations with npm run db:generate. Build the project, then apply generated migrations with:

    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_initial.sql

Use the actual generated SQL filename. Never replay an already applied migration. Sites applies hosted migrations on publication.

## OpenAI

Without OPENAI_API_KEY, the application explicitly runs illustrative demo conversations. These are not real model responses or verified research. To enable live mode, configure OPENAI_API_KEY as a Sites runtime secret and redeploy. Optional runtime settings are OPENAI_MODEL (default gpt-5.4) and OPENAI_TRANSCRIBE_MODEL (default gpt-transcribe). Use the OpenAI Developers secure key workflow. Never put a key in browser code.

Voice input records up to 60 seconds, sends audio to server-side transcription, and lets the user review before submitting. Audio is not persisted.

## Data and sync

The mission workspace presents the original responsive mascot board beside a Result, Notes, and Sources panel. Hover over a character or speech bubble for its explanation, question, and sources; click/tap to pin the card, or use keyboard focus and Escape. Discussion history is expandable below the board. Companions respond in parallel from the same context; validated contributions stream as each finishes. Buddy synthesizes the discussion into qualitative options and a measurable experiment, and adds editable notes organized by theme. Two key contributions per discussion receive automatic evidence reviews. Source cards show actual search citations, AI-generated source summaries, review dates, and limitations; companion agreement never counts as independent confirmation. Failed research leaves the contribution unverified and can be retried.

Question cards and the reply composer accept supporting attachments: up to 3 files, 5 MB per file, 10 MB total. TXT, Markdown, CSV, and JSON are read as UTF-8; live AI also reads PDFs and PNG/JPEG/WebP images. Files are processed only when the reply is sent. Extracted content and file metadata remain with the saved message and selected question answers; original binary files are not stored. Long text is explicitly marked as an excerpt. Uploaded material is treated as user-supplied context, never as independent verification. The API authenticates uploads, bounds request sizes, validates supported formats and file signatures, and does not execute uploaded content. Demo mode supports text attachments locally.

Users can address the whole council or use @name, answer selected questions together, reopen answer mappings, and queue up to five follow-ups while a turn is running. Saving a takeaway is independent of generating a plan. Optional mission briefs and outcome reviews provide context for subsequent replies. Existing missions remain compatible and acquire a working result when their discussion continues. Mobile views expose the same conversation, result, notes, and sources through tabs.

Missions are owner-scoped D1 records with optimistic revision checks. Council command IDs prevent accidental duplicate execution. Interrupted generation preserves the last saved mission. Failed requests remain visible and are never silently replaced with demo output.

Obsidian sync uses desktop Chrome/Edge directory permissions. Only managed notes inside ThinkBuddy/<mission-id> are read or written. Sync preserves both sides of conflicting edits until the user chooses a resolution. Deletions require explicit selection. The browser connection and last synchronized hashes are device-local. Import and export support Markdown and ZIP plus JSON Canvas. Synced notes are not automatically sent to AI.

## Checks

    npx tsc --noEmit
    node --test tests/*.test.mjs
    npm run build

## Current boundaries

Live API calls require a configured key. The generated character atlas supplies six consistent reusable appearances; identities and priorities are mission-generated in live mode. Speech uses short anchored bubbles with detailed explanations on demand. No external action is executed by ThinkPath. Simulations are qualitative and explicitly hypothetical.

Assets: public/mascots.png was generated using the built-in image-generation tool. See docs/character-design.md for the fixed art direction and prompt.
