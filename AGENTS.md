# Piece Selector — Repository Instructions

These instructions apply to the entire repository. Read this file and `TASKS.md` before changing code. Treat the requirements and guardrails below as mandatory unless the user explicitly changes them.

## 1. Product objective

Build a mobile-first, local-first Progressive Web App named **Piece Selector** for a street band. It must run well as an installed Home Screen web app on a current iPhone and remain useful offline after its first successful load.

The MVP lets a user:

1. Select a folder exposed through the iOS Files picker, including a folder provided by the Nextcloud iOS app.
2. Build a score library from `.mscz` filenames formatted as `XX - name.mscz`.
3. Configure each score with:
   - membership in the `80s` repertoire;
   - whether it can start a set;
   - hotness from 1 through 5;
   - whether it has a drums intro;
   - whether it is enabled for generation.
4. Manually re-align the local database with a newly selected folder snapshot.
5. Generate `X` sets of `Y` distinct scores from either the **80s** or **Mix** preset.
6. Guarantee that a score occurs at most once across the whole generated performance.
7. Reopen the most recently generated performance after closing or relaunching the app.

## 2. Product assumptions

- The selected folder is the source of truth for which score files currently exist.
- IndexedDB is the source of truth for user-entered configuration.
- The score number is the primary logical matching key during folder reconciliation. Use an internal immutable ID in storage so a confirmed renumbering can retain configuration.
- The **80s** preset includes active, enabled, fully configured scores tagged `80s`.
- The **Mix** preset includes every active, enabled, fully configured score, including scores tagged `80s`.
- Uniqueness applies within one generated performance, across every set in that performance. It does not apply across different performances.
- Folder access is always initiated manually by the user. There is no background Nextcloud access or automatic synchronization in the MVP.
- The app uses file metadata only. It must not parse, upload, store, or transmit MuseScore file contents.

If an implementation decision would contradict one of these assumptions, stop and ask the user instead of silently changing the product model.

## 3. Non-goals for the MVP

Do not add any of the following unless the user explicitly expands the scope:

- Nextcloud WebDAV, Nextcloud credentials, or background synchronization.
- A server-side database, Cloudflare D1/KV/R2, authentication, or user accounts.
- Multi-user collaboration or cross-device synchronization.
- Parsing or rendering `.mscz` contents.
- CSV import.
- A custom domain.
- Analytics, advertising, telemetry, crash reporting, or third-party tracking.
- External web fonts or runtime CDN dependencies.
- PDF generation, score playback, or editing music notation.
- Incompatible-score pair rules.
- Automated deployment, repository administration, pull requests, releases, or GitHub Actions unless separately requested.

## 4. Required technical baseline

For a new repository, use this baseline:

- React with TypeScript and Vite.
- Strict TypeScript; avoid `any` except at a narrowly documented interoperability boundary.
- npm with a repository-owned `package-lock.json`; create the file locally but do not commit it or anything else.
- IndexedDB through Dexie.js.
- `vite-plugin-pwa` or an equivalently small Workbox-based integration.
- Vitest and Testing Library for unit/component tests.
- Vanilla CSS, CSS Modules, or another lightweight local styling approach. Do not introduce a large component framework for this MVP.
- Cloudflare Workers Static Assets configuration for an eventual `*.workers.dev` deployment. Cloudflare currently recommends Workers for new applications; Pages is not required.

Keep the application fully client-side. A Worker request handler is not needed for the MVP. Configure static assets and SPA fallback only.

Suggested source boundaries:

```text
src/
  app/                 application shell and routes
  domain/              domain types and pure rules
  data/                IndexedDB schema, repositories, migrations
  features/import/     folder selection, parsing, import preview
  features/library/    score list and score configuration
  features/generator/  presets and set-generation engine
  features/performance generated-performance UI and persistence
  pwa/                 install, offline, and update UX
```

Domain logic must not depend on React or browser UI components. Folder parsing, reconciliation, feasibility checks, and generation must be testable as pure functions with injected inputs.

## 5. Score filename contract

Only files whose final extension is `.mscz`, case-insensitively, are candidates. Parse the basename with the equivalent of:

```regex
^\s*(\d+)\s*-\s*(.+?)\s*\.mscz$
```

Rules:

- Preserve the number text for display, including leading zeroes.
- Also store its integer value for uniqueness checks and numeric sorting.
- Trim surrounding whitespace from the title.
- Require a non-empty title and a positive integer score number.
- Accept Unicode titles.
- Ignore non-`.mscz` files.
- Report malformed `.mscz` filenames under **Needs attention**; never silently import them.
- Detect duplicate numeric score numbers in the same folder snapshot and report every conflicting filename.
- Use `webkitRelativePath` when available so nested files can be identified.
- Do not call `text()`, `arrayBuffer()`, `stream()`, or another content-reading method on a selected `File`.
- Do not persist `File`, `FileList`, `Blob`, object URL, or file contents.

The visible primary action must be labelled **Import scores from this folder**. On unsupported browsers, offer a multiple-file `.mscz` selector as a fallback and explain that folder selection is unavailable.

## 6. Minimum data model

The exact TypeScript names may vary, but preserve these semantics:

```ts
type Score = {
  id: string;                    // immutable internal ID
  scoreNumber: number;           // numeric identity used for matching/sorting
  displayNumber: string;         // preserves leading zeroes
  title: string;
  fileName: string;
  relativePath: string;
  availability: "active" | "missing";
  configuration: "pending" | "complete";
  canStart: boolean | null;
  hotness: 1 | 2 | 3 | 4 | 5 | null;
  drumsIntro: boolean | null;
  enabled: boolean;
  tags: string[];
  firstImportedAt: string;
  lastSeenAt: string;
  updatedAt: string;
};
```

Also persist:

- a folder-scan record with scan time and summary counts;
- the most recently generated performance, including its seed and score IDs;
- an explicit IndexedDB schema version and migrations.

Keep an unapplied import or reconciliation preview in memory. Scanning or cancelling a preview must not mutate IndexedDB; persist the scan record only when its accepted changes are applied successfully.

Never destroy an existing IndexedDB database merely because the schema changed. Add and test a migration.

## 7. Import and re-alignment rules

### Initial import

- Parse a folder snapshot without mutating the database.
- Show counts and details for valid new scores, malformed filenames, and duplicate numbers.
- Require review before applying changes.
- Create valid scores as active, enabled, and pending configuration.
- Do not allow malformed or duplicate entries to overwrite a valid score.
- Apply accepted changes in one IndexedDB transaction.

### Manual re-alignment

The visible action must be labelled **Re-align with scores folder**. It must require the user to select the folder again and must show a preview before applying changes.

Classify the new snapshot as follows:

| Folder/database comparison | Proposed action |
| --- | --- |
| Same numeric number and same parsed title | Unchanged; refresh last-seen metadata |
| Same numeric number and different parsed title | Rename while preserving internal ID and all configuration |
| New numeric number | Add as active and pending configuration |
| Existing database score absent from snapshot | Mark missing; preserve configuration and history |
| Previously missing score reappears with the same number | Restore active status and preserve configuration |
| Duplicate number in the snapshot | Conflict; do not apply either conflicting file automatically |
| Same normalized title under a different number | Suggest possible renumbering for explicit user resolution |
| Malformed `.mscz` filename | Needs attention; skip it |

Never hard-delete a score during import or re-alignment. A confirmed renumbering updates the existing record and preserves its immutable internal ID. Applying a preview must be transactional and repeatable: scanning the same unchanged folder twice must not create duplicates or configuration loss.

## 8. Configuration rules

- A newly imported score remains `pending` until `canStart`, `hotness`, and `drumsIntro` have explicit values.
- Tagging a score as `80s` is optional; use a fixed, case-normalized tag for the MVP.
- `enabled` defaults to `true` and gives the user a manual exclusion control independent of folder availability.
- Missing, disabled, or pending scores are never eligible for generation.
- Optimize the pending-configuration flow for one-handed phone use with **Save and next**.
- Preserve edits immediately or with an explicit save operation that cannot be lost through accidental navigation.

## 9. Generation contract

Inputs are preset, number of sets `X`, and scores per set `Y`.

Hard constraints:

1. `X` and `Y` are positive integers.
2. Every selected score is active, enabled, fully configured, and eligible for the selected preset.
3. Each set contains exactly `Y` scores.
4. The first score in each set has `canStart === true`.
5. A score appears no more than once anywhere in the performance.
6. Generation either returns a complete valid performance or a clear feasibility error; never return a partially valid result as success.

Validate at least:

- eligible score count is at least `X * Y`;
- distinct eligible starter count is at least `X`;
- requested values are within documented UI limits.

Reserve distinct starters for all sets before filling other positions so starter scores cannot accidentally be consumed too early.

MVP soft rules:

- Weighted random selection uses hotness as the weight: higher-hotness scores are more likely, but no eligible score has zero probability.
- Avoid consecutive scores with drums intros within a set when an alternative candidate exists.
- If the drums-intro preference must be relaxed, complete the performance and display a non-blocking warning.

Use a seeded pseudo-random source injected into the pure generator. Store the seed with the generated performance so failures are reproducible in tests. Do not use `Math.random()` directly inside domain logic.

## 10. Mobile and PWA requirements

- Design for iPhone portrait first, then adapt to wider screens.
- Use a bottom-level navigation or similarly reachable mobile navigation.
- Respect iOS safe-area insets.
- Interactive targets must be at least 44 by 44 CSS pixels.
- Do not rely on hover, right-click, keyboard-only commands, or drag-and-drop for essential actions.
- Provide visible focus, semantic labels, sufficient contrast, and screen-reader-friendly status messages.
- Include a valid web app manifest, `display: standalone`, theme/background colors, 192px and 512px icons, a maskable icon, and an Apple touch icon.
- Cache the application shell and local static assets for offline use. Never cache or copy selected `.mscz` files.
- The library, configuration, and last generated performance must work offline after installation.
- Provide an in-app explanation for installing through Safari’s **Add to Home Screen** flow.
- Handle service-worker updates without trapping the user on a permanently stale build.
- Avoid destructive database actions during an application update.

## 11. Privacy and security guardrails

- Score filenames, relative paths, tags, and generated performances remain on the device in IndexedDB.
- Do not transmit selected file metadata to Cloudflare, Nextcloud, GitHub, analytics services, logs, or any third party.
- Do not log the complete score library in production.
- Do not add runtime network calls beyond loading same-origin application assets.
- Do not add secrets to source files, fixtures, documentation, environment files, or logs.
- Do not request the user’s GitHub, Cloudflare, or Nextcloud credentials.
- Bundle runtime dependencies; do not load code, fonts, icons, or styles from a CDN.
- Treat all filenames and titles as untrusted text. Render them through normal React escaping and never inject them as HTML.

## 12. Git, GitHub, and history guardrails

These rules are absolute. Completing a task does **not** imply permission to commit, push, publish, deploy, or modify repository history.

### Permitted Git use

Git may be used only for local, read-only inspection. Examples:

```text
git status --short
git status --short --branch
git diff
git diff -- <paths>
git diff --cached
git log [read-only options]
git show [read-only revision]
git ls-files
git branch --show-current
git rev-parse --show-toplevel
git remote -v
```

Prefer `rg` and ordinary filesystem reads over Git when either works.

### Prohibited Git operations

Do not run, invoke through another program, or script any of the following:

- `git add`, `git commit`, `git commit --amend`, or any operation that writes the index or creates a commit.
- `git push`, `git pull`, `git fetch`, `git clone`, `git ls-remote`, or any other networked Git operation, including read-only remote queries.
- `git checkout`, `git switch`, `git restore`, `git reset`, `git clean`, or commands that can overwrite working-tree changes.
- `git merge`, `git rebase`, `git cherry-pick`, `git revert`, `git am`, or `git apply --index`.
- `git branch` creation/deletion/rename, `git tag`, `git stash`, `git notes`, `git replace`, or ref manipulation.
- `git init`, `git config`, remote modification, submodule operations, worktree operations, garbage collection, reflog expiration, filter-branch, or filter-repo.
- Direct writes anywhere under `.git/`.
- Changing history through an IDE, library, GitHub CLI, API, MCP connector, or other indirect mechanism.

Do not use `gh` or any GitHub API/connector. Do not create or edit issues, pull requests, releases, repository settings, deploy keys, secrets, branches, or tags. Do not open a browser to perform GitHub actions.

If requested work appears to require a prohibited operation, finish the safe local work, stop, and tell the user exactly which manual Git/GitHub action remains. Do not ask for credentials or attempt a workaround.

## 13. Deployment and external-action guardrails

Codex may create and validate local Cloudflare configuration, but it must not perform a remote deployment or account action.

Do not run:

- `wrangler login`, `wrangler deploy`, `wrangler versions upload/deploy`, or any command that writes to Cloudflare;
- Cloudflare API mutations or dashboard actions;
- `npm publish` or package-registry publication;
- a deploy hook, webhook, or CI workflow dispatch;
- any command whose purpose is to make the application externally accessible.

Local-only commands such as the Vite development server, tests, builds, and an explicitly local Workers preview are allowed. Dependency installation from the npm registry is allowed when needed, but do not install global packages or dependencies sourced from Git URLs.

The repository owner will connect the private GitHub repository to Cloudflare and deploy it manually. The expected initial public address is a Cloudflare-provided `*.workers.dev` URL; no domain registration is required.

The deployed app shell is public by default even though its source repository is private. The MVP stores no score library on Cloudflare: each visitor receives an empty, device-local database. Do not add authentication without an explicit scope change.

## 14. Working-tree safety

- Inspect the repository and existing instructions before editing.
- Preserve user changes and unrelated files.
- Do not delete or mass-rewrite files outside the task.
- Do not run destructive cleanup commands.
- Keep dependency additions minimal and explain non-obvious additions.
- Do not weaken tests, linting, TypeScript strictness, accessibility, or privacy behavior to make a check pass.
- Do not change the chosen architecture without documenting the reason and obtaining user approval when it changes scope or data behavior.

## 15. Verification and task reporting

Before declaring an implementation task complete, run the relevant local checks. The final repository should expose at least:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Add focused tests for:

- filename parsing and invalid filenames;
- duplicate score numbers;
- reconciliation classifications and idempotency;
- configuration preservation on rename, disappearance, reappearance, and confirmed renumbering;
- IndexedDB migrations;
- generator feasibility errors;
- uniqueness across all sets for many deterministic seeds;
- starter placement for every set;
- preset eligibility;
- persistence of the last performance;
- essential import and configuration UI states.

Maintain `TASKS.md` as work progresses. Mark a checkbox complete only after its acceptance criteria and automated checks pass. Never mark user-only Cloudflare or physical-iPhone validation complete without evidence supplied by the user.

## 16. Reference documentation

- [Directory selection with `webkitdirectory`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Workers Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
