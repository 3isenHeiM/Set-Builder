# Piece Selector MVP — Implementation Tasks

This is the ordered build plan for the MVP defined in `AGENTS.md`. Complete phases in order unless a later task is demonstrably independent. Keep this file updated, but do not use Git or GitHub mutations to record progress.

## Status rules

- `[ ]` Not started or not verified.
- `[x]` Implemented and its acceptance criteria pass.
- Add a short indented note beneath a blocked task with the reason and the safe next action.
- Do not mark manual iPhone or Cloudflare tasks complete without confirmation from the repository owner.
- No task authorizes a Git commit, push, pull, fetch, branch change, history change, GitHub action, or remote deployment.

## MVP decisions fixed for implementation

- App name: **Piece Selector**.
- Target: current iPhone Safari and installed Home Screen PWA; responsive desktop support is secondary.
- App model: fully client-side and local-first.
- Storage: IndexedDB through Dexie.js.
- Score files: `.mscz` only.
- Filename format: `XX - name.mscz`, parsed flexibly for whitespace and number width.
- Folder selection: manual `webkitdirectory` flow with multiple-file fallback.
- Re-alignment: manual, previewed, and transactional.
- Presets:
  - **80s** uses scores tagged `80s`.
  - **Mix** uses all eligible scores.
- A score may appear only once across all sets in one generated performance.
- First score of every set must be configured as able to start a set.
- Hotness is a weighted-selection input, not a hard quota.
- Consecutive drums-intro scores are avoided when possible, but this is a soft rule.
- Hosting target: Cloudflare Workers Static Assets on the provided `*.workers.dev` address.
- Source repository: private GitHub repository, managed and deployed only by the user.

## Definition of done

The MVP is code-complete when all non-user-only tasks below are checked and:

- a fresh local install can build and test the app;
- a folder snapshot can populate and later re-align the library without reading file contents;
- score configuration persists after reload and offline use;
- valid performances can be generated or rejected with a precise feasibility message;
- generated performances contain no repeated score across sets;
- the most recent performance persists after relaunch;
- the production build includes a valid installable/offline PWA;
- local lint, typecheck, tests, and production build succeed;
- deployment configuration exists, but no remote deployment has been performed by Codex.

---

## Phase 0 — Inspect and establish the project

- [x] Read `AGENTS.md`, this file, and any more-specific instruction files.
  - Acceptance: implementation notes acknowledge the Git and deployment prohibitions.

- [x] Inspect the existing working tree without changing Git state.
  - Acceptance: preserve existing code and user edits; use only permitted read-only Git commands if Git inspection is needed.

- [x] If the repository is empty, scaffold React, TypeScript, and Vite locally with npm.
  - Acceptance: no `git init`, commit, remote access, GitHub action, or deployment occurs.
  - Acceptance: only one package manager is used and `package-lock.json` exists.

- [x] Establish scripts for `dev`, `lint`, `typecheck`, `test`, `test:watch`, and `build`.
  - Acceptance: every script is documented in `README.md` and runs locally.

- [x] Create the feature-oriented source boundaries described in `AGENTS.md`.
  - Acceptance: domain modules do not import React components or IndexedDB implementations.

## Phase 1 — Domain model and local persistence

- [x] Define strict domain types for `Score`, `FolderScan`, reconciliation changes, preset, set, and generated performance.
  - Acceptance: nullable configuration fields represent newly imported scores without unsafe type assertions.
  - Acceptance: timestamps have one documented representation.

- [x] Create a versioned Dexie database and repository interfaces.
  - Acceptance: storage code is isolated from feature UI.
  - Acceptance: an immutable internal score ID is distinct from the editable numeric score number.

- [x] Implement the initial IndexedDB schema and at least one migration-test harness.
  - Acceptance: tests prove an older fixture can upgrade without losing score configuration.
  - Acceptance: no normal application path deletes the database to resolve a version mismatch.

- [x] Implement score CRUD operations needed by the MVP.
  - Acceptance: create, update configuration, bulk reconcile, list/sort/filter, and availability changes are covered.
  - Acceptance: bulk reconciliation uses one transaction.

- [x] Persist and retrieve the most recently generated performance.
  - Acceptance: it can be reconstructed after a repository/database instance is reopened.

## Phase 2 — Folder selection and filename parsing

- [x] Implement a reusable `.mscz` filename parser as a pure function.
  - Acceptance: `01 - Take On Me.mscz` produces numeric number `1`, display number `01`, and title `Take On Me`.
  - Acceptance: whitespace variations, Unicode names, multi-digit numbers, and uppercase `.MSCZ` are tested.
  - Acceptance: zero/negative or absent numbers, empty titles, `.mscz.backup`, and malformed separators are rejected with typed reasons.

- [x] Convert a selected `FileList` into a metadata-only folder snapshot.
  - Acceptance: filtering is case-insensitive and only final `.mscz` extensions qualify.
  - Acceptance: `webkitRelativePath` is retained when present.
  - Acceptance: no file content-reading method is called and no `File`/`Blob` is persisted.

- [x] Detect duplicate numeric score numbers within a snapshot.
  - Acceptance: every conflicting filename is reported and conflicts cannot overwrite one another.

- [x] Build the **Import scores from this folder** control.
  - Acceptance: it uses a user-initiated directory input with `webkitdirectory` and `multiple`.
  - Acceptance: it requests `.mscz` files and still filters/validates in application code.
  - Acceptance: a multiple-file fallback is available when directory selection is unsupported.
  - Acceptance: cancelling the picker makes no database changes and leaves the UI usable.

- [x] Build the initial import preview.
  - Acceptance: show valid new, malformed, duplicate, and ignored counts before applying.
  - Acceptance: malformed and duplicate details are understandable on a phone screen.
  - Acceptance: applying creates only valid non-conflicting scores as active, enabled, and pending.

## Phase 3 — Manual database re-alignment

- [x] Implement reconciliation classification as a pure function.
  - Acceptance: classify unchanged, renamed, new, missing, reappeared, duplicate conflict, malformed, and possible renumbering.
  - Acceptance: comparison uses numeric score number as the normal logical key.
  - Acceptance: title normalization is documented and does not destroy the original display title.

- [x] Add tests for configuration preservation.
  - Acceptance: a rename under the same number retains internal ID, tags, hotness, starter flag, drums-intro flag, and enabled state.
  - Acceptance: missing then reappearing retains the same data.
  - Acceptance: confirmed renumbering retains the internal ID and configuration.

- [x] Prove reconciliation idempotency.
  - Acceptance: applying the same valid snapshot twice creates no duplicate, extra rename, or configuration reset.

- [x] Build the **Re-align with scores folder** action.
  - Acceptance: the action always asks the user to select a folder; it does not attempt background access.
  - Acceptance: scanning alone does not mutate IndexedDB.

- [x] Build a mobile reconciliation preview.
  - Acceptance: summary and expandable details show each proposed category.
  - Acceptance: preview includes **Cancel** and **Apply changes**.
  - Acceptance: duplicates and malformed entries are skipped and clearly reported.
  - Acceptance: database scores absent from the folder are proposed as missing, never deleted.

- [x] Implement explicit possible-renumbering resolution.
  - Acceptance: for the same normalized title under a new number, the user can choose **Treat as same score** or **Add as new**.
  - Acceptance: no heuristic silently renumbers a score.

- [x] Apply accepted reconciliation changes transactionally.
  - Acceptance: interruption or failure does not leave a partially applied snapshot.
  - Acceptance: the library records and displays the last successful alignment time and summary.

## Phase 4 — Library and score configuration UX

- [x] Build the empty-library/onboarding state.
  - Acceptance: the primary action is **Import scores from this folder** and the naming convention is explained with an example.

- [x] Build the score-library list optimized for iPhone portrait.
  - Acceptance: numeric sorting puts `2` before `10` regardless of leading zeroes.
  - Acceptance: each row shows display number, title, configuration status, and availability.
  - Acceptance: search and filters exist for pending, active, missing, disabled, and `80s` scores.

- [x] Build score configuration editing.
  - Acceptance: controls cover `80s`, can-start, hotness 1–5, drums intro, and enabled state.
  - Acceptance: all controls have accessible names, visible states, and touch targets of at least 44px.
  - Acceptance: user-entered changes survive navigation and reload.

- [x] Build the pending-configuration queue.
  - Acceptance: **Save and next** advances through new scores without returning to the library each time.
  - Acceptance: a score is marked complete only when can-start, hotness, and drums-intro values are explicit.
  - Acceptance: progress such as `3 of 12` is shown.

- [x] Make missing-score behavior safe and visible.
  - Acceptance: missing scores retain configuration, cannot be generated, and can be filtered/restored by a later scan.
  - Acceptance: no library UI offers permanent deletion as part of re-alignment.

## Phase 5 — Presets and generation engine

- [x] Implement preset eligibility as pure functions.
  - Acceptance: **80s** includes only complete, active, enabled scores with the normalized `80s` tag.
  - Acceptance: **Mix** includes all complete, active, enabled scores regardless of `80s` membership.

- [x] Implement a seedable pseudo-random source.
  - Acceptance: passing the same eligible input, options, and seed produces the same result.
  - Acceptance: domain code does not call `Math.random()` directly.

- [x] Implement pre-generation feasibility validation.
  - Acceptance: reject non-positive or out-of-range `X`/`Y` values.
  - Acceptance: reject when fewer than `X * Y` eligible scores exist.
  - Acceptance: reject when fewer than `X` distinct eligible starters exist.
  - Acceptance: messages state the requested and available counts and suggest a corrective action.

- [x] Implement the core performance generator.
  - Acceptance: reserve `X` distinct starter scores before filling other positions.
  - Acceptance: return exactly `X` sets containing exactly `Y` scores each.
  - Acceptance: the first score of every set can start.
  - Acceptance: no score ID appears twice anywhere in the performance.
  - Acceptance: selection is without replacement and weighted by hotness 1–5.

- [x] Implement the drums-intro soft rule.
  - Acceptance: consecutive drums-intro scores are avoided when a valid alternative is available.
  - Acceptance: relaxing the rule never relaxes hard uniqueness/starter rules and produces a visible warning.

- [x] Add property-style generator tests across many deterministic seeds and pool shapes.
  - Acceptance: every successful result satisfies all hard invariants.
  - Acceptance: edge cases include exactly enough scores, exactly enough starters, all starters, set size one, and infeasible requests.

- [x] Build the Generate screen.
  - Acceptance: the user selects **80s** or **Mix**, `X` sets, and `Y` scores per set.
  - Acceptance: show eligible-score and eligible-starter counts before generation.
  - Acceptance: prevent or explain infeasible generation without crashing.

## Phase 6 — Performance display and persistence

- [x] Build the generated-performance view.
  - Acceptance: sets are clearly separated and numbered.
  - Acceptance: each score shows display number and title; hotness and drums-intro metadata are legible but secondary.
  - Acceptance: the whole list is usable one-handed without horizontal scrolling.

- [x] Autosave the most recently generated performance.
  - Acceptance: closing/reloading the app restores it exactly, even if a score is later marked missing.
  - Acceptance: store a score snapshot sufficient to display the saved performance without corrupting historical output.

- [x] Provide a deliberate regenerate flow.
  - Acceptance: replacing the current performance requires a clear user action.
  - Acceptance: the new performance is revalidated and persisted.

- [x] Add a visible validation assertion in development/test builds.
  - Acceptance: duplicate IDs or invalid starters in a generated result fail loudly during development and tests.

## Phase 7 — PWA, offline behavior, and iPhone UX

- [x] Add the web app manifest and local icon assets.
  - Acceptance: include app name/short name, start URL, standalone display, theme/background colors, 192px icon, 512px icon, maskable icon, and Apple touch icon.
  - Acceptance: icons are original/generic and do not use third-party trademarks.

- [x] Add a service worker and offline app-shell caching.
  - Acceptance: a production build loads after network access is removed once the app has been loaded successfully.
  - Acceptance: selected `.mscz` files and their contents are never cached.
  - Acceptance: IndexedDB data remains available offline.

- [x] Add service-worker update handling.
  - Acceptance: users receive a clear, non-destructive refresh/update path when a new build is available.

- [x] Add iPhone installation guidance.
  - Acceptance: explain Safari Share → **Add to Home Screen** and that the user may need to enable **Open as Web App**.
  - Acceptance: guidance is dismissible and does not repeatedly obstruct installed users.

- [x] Complete mobile accessibility and layout checks.
  - Acceptance: safe-area insets, 44px targets, focus visibility, semantic headings, form labels, contrast, reduced-motion preference, and status announcements are addressed.
  - Acceptance: no essential action depends on hover, drag-and-drop, or a physical keyboard.

- [x] Verify privacy behavior through code inspection and tests.
  - Acceptance: no runtime analytics, CDN, remote font, API call, file-content read, or score-metadata transmission exists.

## Phase 8 — Cloudflare-ready local configuration

- [x] Add a local Cloudflare Workers Static Assets configuration.
  - Acceptance: it points to the Vite production output and uses SPA fallback.
  - Acceptance: it is suitable for a Cloudflare-provided `*.workers.dev` URL with no custom domain.
  - Acceptance: no server API, D1, KV, R2, secrets, or authentication is introduced.

- [x] Validate the Cloudflare configuration locally only.
  - Acceptance: use a local preview/build path; do not authenticate or make any remote Cloudflare call.
  - Acceptance: do not run `wrangler deploy`, `wrangler login`, a deploy hook, or a remote preview.

- [x] Document owner-performed deployment in `README.md`.
  - Acceptance: explain that the owner connects the private GitHub repository in Cloudflare and uses the resulting `*.workers.dev` address.
  - Acceptance: explain that the app shell is public by default even though the repository is private, while every score library remains local to its browser profile.
  - Acceptance: label every dashboard, GitHub, push, and deploy step as user-only.
  - Acceptance: do not claim the app is deployed.

## Phase 9 — Quality gate and handoff

- [x] Add/finish unit and component tests for every critical rule.
  - Acceptance: parser, reconciliation, persistence/migrations, presets, feasibility, generator invariants, and core UI states are covered.

- [x] Run the full local quality gate.
  - Acceptance: `npm run lint` passes.
  - Acceptance: `npm run typecheck` passes.
  - Acceptance: `npm test` passes.
  - Acceptance: `npm run build` passes.

- [x] Inspect the production bundle for accidental remote dependencies or secrets.
  - Acceptance: no credentials, private URLs, source maps containing secrets, analytics endpoint, or unexpected outbound request is present.

- [x] Finish `README.md`.
  - Acceptance: include product purpose, filename contract, local setup, scripts, data/privacy model, import/re-alignment behavior, preset rules, offline limitations, iPhone install steps, backup limitation, and user-only deployment steps.

- [x] Review the working-tree diff without staging or committing.
  - Acceptance: only intended project files changed.
  - Acceptance: no `.git` data, credentials, local database, build output, or user score files are included.

- [x] Provide a handoff summary.
  - Acceptance: list implemented features, local checks and results, known limitations, and exact user-only validation/deployment steps.
  - Acceptance: explicitly state that Codex did not commit, push, change history, access GitHub remotely, or deploy.

---

## User-only acceptance and deployment checklist

Codex must leave these unchecked unless the user reports completion. These actions are not delegated to Codex by this file.

- [ ] On a current iPhone, open the local/staged site in Safari and select the Nextcloud-backed scores folder.
- [ ] Confirm that the Nextcloud Files provider permits folder selection and returns all expected `.mscz` names.
- [ ] Confirm malformed and duplicate filenames are reported correctly with real data.
- [ ] Configure several scores, close the app, reopen it, and confirm the configuration remains.
- [ ] Re-align after adding, renaming, renumbering, and removing test files in the folder.
- [ ] Generate multiple sets and visually confirm there are no repeated scores across the performance.
- [ ] Install through Safari’s **Add to Home Screen** and confirm standalone launch.
- [ ] Enable airplane mode after one successful load and confirm library/generation/current-performance behavior.
- [ ] Create or use the private GitHub repository and manually commit/push the reviewed working tree.
- [ ] In the Cloudflare dashboard, connect only the intended private repository and configure Workers Builds/Static Assets.
- [ ] Perform the first deployment and verify the Cloudflare-provided `*.workers.dev` URL.
- [ ] Reopen the deployed URL on iPhone, reinstall/update the Home Screen app if required, and repeat the critical smoke tests.

## Deferred ideas (not MVP tasks)

- Nextcloud WebDAV synchronization with revocable app credentials.
- Multiple saved-performance history and performance naming.
- Locking individual scores or sets before partial regeneration.
- JSON backup/restore for the local configuration database.
- Cross-device synchronization and band-member accounts.
- Custom preset editor and additional repertoire tags.
- Explicit incompatible-score pairs.
- Sharing or exporting a formatted set list.
