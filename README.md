# ThinkBuddy

A private, mascot-first thinking workspace built with React, Vinext, Sites, D1, Motion, and XYFlow.

## Run locally

Use Node 22.13 or newer. Install dependencies with npm ci, then npm run dev. The local Sites preview supplies a development-only sign-in flow. Production uses ChatGPT sign-in.

The D1 schema is defined in db/schema.ts. Generate migrations with npm run db:generate. Build the project, then apply generated migrations with:

    node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_initial.sql

Use the actual generated SQL filename. Never replay an already applied migration. Sites applies hosted migrations on publication.

## OpenAI

Without OPENAI_API_KEY, the application explicitly runs illustrative demo conversations. These are not real model responses or verified research. To enable live mode, configure OPENAI_API_KEY as a Sites runtime secret and redeploy. Optional runtime settings are OPENAI_MODEL (default gpt-5.4) and OPENAI_TRANSCRIBE_MODEL (default gpt-transcribe). Use the OpenAI Developers secure key workflow. Never put a key in browser code.

Voice input records up to 60 seconds, sends audio to server-side transcription, and lets the user review before submitting. Audio is not persisted.

## Data and sync

Missions are owner-scoped D1 records with optimistic revision checks. Council command IDs prevent accidental duplicate execution. Interrupted generation preserves the last saved mission. Failed requests remain visible and are never silently replaced with demo output.

Obsidian sync uses desktop Chrome/Edge directory permissions. Only managed notes inside ThinkBuddy/<mission-id> are read or written. Sync preserves both sides of conflicting edits until the user chooses a resolution. Deletions require explicit selection. The browser connection and last synchronized hashes are device-local. Import and export support Markdown and ZIP plus JSON Canvas. Synced notes are not automatically sent to AI.

## Checks

    npx tsc --noEmit
    node --test tests/*.test.mjs
    npm run build

## Current boundaries

Live API calls require a configured key. The generated character atlas supplies six consistent reusable appearances; identities and priorities are mission-generated in live mode. Speech uses short anchored bubbles with detailed explanations on demand. No external action is executed by ThinkPath. Simulations are qualitative and explicitly hypothetical.

Assets: public/mascots.png was generated using the built-in image-generation tool. See docs/character-design.md for the fixed art direction and prompt.
