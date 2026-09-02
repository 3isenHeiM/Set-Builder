# Piece Selector

Piece Selector is a mobile-first, local-first set builder for a street band. It turns a manually selected scores folder into a configurable on-device library, then generates complete performances with distinct pieces and a valid starter at the beginning of every set.

## What it reads

Only the metadata exposed by the file picker is used: filename and, where available, relative path. The app never calls a content-reading method on a selected file, and it does not keep the selected `File` or `FileList` after the scan.

Candidate filenames end in `.mscz` (case-insensitive) and follow:

```text
XX - name.mscz
01 - Take On Me.mscz
```

Whitespace and number width may vary. Leading zeroes are kept for display, while the positive integer value is used for matching and sorting. Malformed names and every file involved in a duplicate numeric number are shown under Needs attention and skipped.

## Local setup and scripts

Node 20 or newer and npm are required.

```bash
npm install
npm run dev
```

The repository-owned scripts are:

- `npm run dev` — start the local Vite development server.
- `npm run lint` — run strict ESLint checks.
- `npm run typecheck` — run strict TypeScript without emitting files.
- `npm test` — run the Vitest unit and component suite once.
- `npm run test:watch` — run Vitest in watch mode.
- `npm run build` — typecheck and make the production PWA in `dist/`.
- `npm run preview` — serve the production build locally through Vite.
- `npm run preview:cf` — serve the already-built static assets locally through Wrangler; this command is local-only and must not be changed to a remote preview.

## Import and manual re-alignment

The selected folder is the source of truth for which files currently exist. Every import starts with **Import scores from this folder** and every later alignment starts with **Re-align with scores folder**; both open the picker manually and show an unapplied preview.

Normal matching uses the numeric score number. A title change under the same number keeps the score’s immutable internal ID and configuration. Absent records become missing rather than being deleted; reappearing numbers restore them. A unique normalized-title match under a different number is only a suggestion. Choose **Treat as same score** to preserve identity while renumbering, or **Add as new** to keep the previous record missing and create a new pending record. Title normalization is Unicode NFKC followed by lower-casing and is never used to alter displayed text.

Applying a reviewed scan updates scores and its alignment record in one IndexedDB transaction. Scanning or cancelling does not mutate storage.

## Configuration and generation

New scores start active, enabled, and pending. `can start`, hotness 1–3, drums intro, and goes high must each have an explicit value before a score becomes complete. `80s` membership is optional. Missing, disabled, and pending scores cannot be generated.

The **Mix** preset uses every active, enabled, complete score. **80s** adds the fixed `80s` tag requirement. The documented UI limits are 1–12 sets and 1–30 scores per set. Generation checks the requested score and distinct-starter counts before doing work, reserves all starters first, samples the remaining scores without replacement using hotness as weight, places goes-high pieces at the beginning of their set immediately after its starter, and avoids adjacent drums intros when possible. A non-blocking warning is retained when that soft preference must be relaxed. The seed is stored so a result can be reproduced in tests.

The latest performance contains independent score snapshots and opens automatically after the app is relaunched. Later folder alignment does not rewrite that historical output.

## Data, offline behavior, and limitations

IndexedDB in the current browser profile is the source of truth for configuration, alignment records, and the last performance. Timestamps are UTC ISO-8601 strings. There is no account, server database, API, WebDAV access, telemetry, CDN, external font, or runtime third-party request. The production service worker caches only the same-origin app shell and static assets; selected `.mscz` files are never copied into the cache.

Use **Download app settings** on the About screen to save a versioned, human-readable JSON file. Each entry contains the numeric score number, piece name, and its 80s, opener, hotness, goes-high, drums-intro, and enabled settings. Files, relative paths, internal IDs, alignment state, and generated performances are deliberately excluded. **Re-import app settings** parses only an explicitly selected settings JSON, shows a preview, and updates matched pieces transactionally after confirmation. Matching uses the numeric score number; name differences are shown for review, pieces absent from the current library are skipped, and pieces absent from the backup keep their settings.

Open a successfully built app online at least once before relying on offline mode. Keep a downloaded settings JSON outside the browser profile: clearing site data, changing profiles, or uninstalling in some circumstances can erase local app data. Folder access remains manual, and availability of a Nextcloud-backed folder depends on the iOS Files provider.

The interface follows the device’s light or dark appearance automatically. Dark appearance uses glare-controlled near-black surfaces and high-contrast controls for reading set lists during evening and indoor performances.

## Install on iPhone

In Safari, open the deployed address, tap Share, choose **Add to Home Screen**, and enable **Open as Web App** if offered. Launch once while online. The in-app update notice provides a deliberate refresh path without replacing IndexedDB.

## Cloudflare Workers Static Assets (user-only deployment)

`wrangler.toml` points at `dist/` and configures the SPA fallback; it defines no Worker request handler, API, D1, KV, R2, secret, custom domain, or authentication.

Owner-only deployment process:

1. Manually commit and push the reviewed working tree to the intended private GitHub repository.
2. In the Cloudflare dashboard, create a Workers Builds/Git integration for only that repository, using `npm run build` and `dist/` as the output.
3. Trigger and verify the first deployment, then use the Cloudflare-provided `*.workers.dev` address.

These are user-only GitHub and Cloudflare actions; this repository does not automate or claim a deployment. The deployed app shell is public by default even when the source repository is private. Each visitor still starts with a separate empty library that stays in that browser profile.

## Cloudflare Pages alternative (user-only deployment)

Cloudflare Pages can host the same static PWA without changing the application or adding Pages Functions. The existing `wrangler.toml` is for the Workers alternative and is not needed by a Pages Git build.

1. Manually push the branch you want to publish. To deploy the current implementation directly, push `dev`; otherwise move it to your chosen production branch first.
2. In the Cloudflare dashboard, open **Workers & Pages**, choose **Create application** → **Pages** → **Import an existing Git repository**, and select only the intended private repository.
3. Configure the project:
   - Framework preset: **React (Vite)**.
   - Production branch: `dev` for the current implementation, or your chosen release branch.
   - Build command: `npm run build`.
   - Build output directory: `dist`.
   - Root directory: leave blank (repository root).
4. Do not configure Pages Functions, environment variables, credentials, or service bindings; this client-only app does not need them.
5. Choose **Save and Deploy**, wait for the owner-triggered build, and open the resulting `*.pages.dev` address in Safari once while online.

Pages treats a site without a top-level `404.html` as a single-page application and falls unmatched routes back to the root. Each pushed commit to the configured production branch triggers another deployment, while other pushed branches can produce preview deployments. These dashboard, push, and deployment actions are user-only. As with the Workers option, the built app shell is public while score metadata and performances stay local to each browser profile.

### Pages build reports a missing `package.json`

An `ENOENT` for `/opt/buildhome/repo/package.json` means Pages checked out a commit that does not contain the application at its repository root; it occurs before npm or Vite can build anything. The “No Wrangler configuration file found” line is informational for this dashboard-configured Pages deployment.

- Confirm the Pages **Production branch** is `dev`, not `main`, when deploying this implementation.
- Leave **Root directory** blank. Do not enter the branch name as a directory.
- Confirm the deployment log’s checked-out commit is the latest commit you pushed from `dev` and that the commit includes root `package.json`.
- Keep **Build command** as `npm run build` and **Build output directory** as `dist`, then retry the latest `dev` deployment.
