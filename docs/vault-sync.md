# Browser vault synchronization

Folder synchronization runs only while the ThinkBuddy website is open in a supported desktop browser. Use Chrome or Edge over HTTPS, select the Obsidian vault, and grant read/write access. No Obsidian plugin or background desktop service is installed.

Selecting a folder with **Connect & generate** (or reconnecting) immediately syncs notes and generates a second brain from the selected mission. Existing connections use **Sync & generate**. This also works for missions with no saved ThinkVault notes: discussion contributions become linked Markdown pages, with evidence status and sources preserved. Even an empty mission gets an overview and Canvas. Generation uses existing mission data locally, without an AI request or uploading the selected folder.

ThinkBuddy writes only to `ThinkBuddy/<mission-id>/` inside the selected folder. It ignores unrelated files and `.obsidian`. New notes use stable IDs in filenames and YAML properties; note title and Markdown body can be edited in Obsidian. Local file renames retain identity through `thinkbuddy_id`. Keep this property and `thinkbuddy_mission` intact. Custom YAML properties are retained on local rewrites but are not synchronized to cloud fields.

Open `ThinkBuddy/<mission-id>/Second Brain/Mission.md` in Obsidian for the linked overview, or `ThinkMap.canvas` in the same folder for the visual map. Generated discussion pages link back to the mission and related ideas. Existing ThinkVault notes are reused, including renamed files; unmapped notes also appear on the generated Canvas. The Obsidian ZIP bundle includes the same second-brain pages.

Generated pages are separate from editable two-way notes. Content hashes allow unchanged generated pages to refresh on sync. Locally modified or deleted generated pages are preserved and reported in the UI; export a fresh bundle to obtain a new version. Unrecognized files are never overwritten. Obsolete generated pages are retained, so no local material is silently deleted. Resolve note conflicts before generation resumes.

The UI calls `restoreVault()` on mount, `connectVault()` from a user click, then `syncVault(mission, saveNotes)` immediately after connecting. Manual refresh also generates; optional automatic sync runs on focus and every 15 seconds while visible. `saveNotes` must save with an expected cloud revision and throw if that revision changed. Prevent concurrent mission edits while a sync is in flight, or merge returned notes against the latest state.

`syncVault` returns updated notes, counters, and conflict objects. For `edited-both`, display both versions and pass either `local` or `remote` for the note ID on a subsequent call. For `deleted-local`, offer restoring the cloud version (`remote`) or explicitly deleting the cloud note (`delete-remote`). For `deleted-cloud`, offer importing the local note (`local`) or explicitly deleting the local file (`delete-local`). Never auto-resolve deletions. Duplicate IDs require fixing duplicate local files; synchronization leaves both untouched.

Permissions may expire or be revoked. Pause automatic sync on errors and show a Reconnect button invoking `reconnectVault()`. `disconnectVault()` removes the stored folder handle and stops access. IndexedDB stores handles and hash baselines locally, not server-side. A fresh folder connection uses a fresh baseline; different existing versions are reviewed instead of overwritten.

Cloud synchronization and including notes in model requests are separate choices. Folder access must not authorize sending all vault contents to an AI provider. Only selected/imported notes enter the workspace, and source-context permission must be controlled by the app.

The browser filesystem cannot offer atomic cross-device/cloud transactions. Changes are checked immediately before each file overwrite. Any failed operation leaves the baseline uncommitted, so the next pass rechecks the remaining differences. Cross-tab Web Locks prevent concurrent sync in the same browser. Keep both the application and Obsidian backups for important work.

Run the utility checks with `node --test tests/vault.test.mjs` after dependencies are installed. Tests write transpilation artifacts only under `.cache/vault-tests/`.
