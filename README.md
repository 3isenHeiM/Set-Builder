# Piece Selector

Piece Selector is a mobile-first, authenticated set builder for a street band. It turns a manually selected scores folder into a configurable library, synchronizes it through Cloudflare D1, and generates complete performances with distinct pieces and a valid starter at the beginning of every set.

## What it reads

Only the metadata exposed by the file picker is used: filename and, where available, relative path. The app never calls a content-reading method on a selected MuseScore file, and it does not keep the selected `File` or `FileList` after the scan. Accepted filenames and relative paths are synchronized to the password-protected D1 library; MuseScore contents are never uploaded.

Candidate filenames end in `.mscz` (case-insensitive) and follow:

```text
XX - name.mscz
01 - Take On Me.mscz
```

Whitespace and number width may vary. Leading zeroes are kept for display, while the positive integer value is used for matching and sorting. Malformed names and every file involved in a duplicate numeric number are shown under Needs attention and skipped.

## Local setup and scripts

Node 22 or newer and npm are required.

```bash
npm install
npm run dev
```

The repository-owned scripts are:

- `npm run dev` — start the local Vite UI using device storage, without the Cloud API.
- `npm run lint` — run strict ESLint checks.
- `npm run typecheck` — run strict TypeScript without emitting files.
- `npm test` — run the Vitest unit and component suite once.
- `npm run test:watch` — run Vitest in watch mode.
- `npm run build` — typecheck and make the production PWA in `dist/`.
- `npm run preview` — serve only the production static bundle; use the Cloudflare preview for API-backed testing.
- `npm run db:migrate:local` — apply D1 migrations to Wrangler's local database.
- `npm run preview:cf` — apply local D1 migrations and serve the already-built Worker locally. Authentication fails closed until its two local secret bindings are supplied.

## Import and manual re-alignment

The selected folder is the source of truth for which files currently exist. Every import starts with **Import scores from this folder** and every later alignment starts with **Re-align with scores folder**; both open the picker manually and show an unapplied preview.

Normal matching uses the numeric score number. A title change under the same number keeps the score’s immutable internal ID and configuration. Absent records become missing rather than being deleted; reappearing numbers restore them. A unique normalized-title match under a different number is only a suggestion. Choose **Treat as same score** to preserve identity while renumbering, or **Add as new** to keep the previous record missing and create a new pending record. Title normalization is Unicode NFKC followed by lower-casing and is never used to alter displayed text.

Applying a reviewed scan updates scores and its alignment record in one D1 state write when connected. Scanning or cancelling does not mutate storage.

On iPhone with Safari 18.4 or newer, tap the folder action, navigate inside the intended folder in Files, then tap **Open**. Do not select each document separately. The directory input intentionally has no file-type filter; Piece Selector filters the returned metadata to `.mscz` locally, which keeps third-party Files providers available. Older iOS versions and failed provider flows can use **Select .mscz files instead** for an explicit multi-file selection.

## Configuration and generation

New scores start active, enabled, and pending. `can start`, hotness 1–3, drums intro, and goes high must each have an explicit value before an enabled score becomes complete; a disabled score may leave these values unset. `80s` membership is optional. Missing, disabled, and pending scores cannot be generated.

The **Mix** preset uses every active, enabled, complete score. **80s** adds the fixed `80s` tag requirement. The documented UI limits are 1–12 sets and 1–30 scores per set. Generation checks the requested score and distinct-starter counts before doing work, reserves all starters first, samples the remaining scores without replacement using hotness as weight, places goes-high pieces at the beginning of their set immediately after its starter, and avoids adjacent drums intros when possible. A non-blocking warning is retained when that soft preference must be relaxed. The seed is stored so a result can be reproduced in tests.

Every generated performance becomes a saved set list containing independent score snapshots, and the most recently opened list opens automatically after relaunch. Set-list and individual-set names are editable. Arrow controls can reorder whole sets and pieces; the starter remains first and goes-high placement stays valid. Later folder alignment does not rewrite this historical output.

## Data, authentication, and offline behavior

Authenticated D1 storage is the source of truth whenever the service is reachable. The shared band password unlocks one shared D1 state document containing filenames, relative paths, settings, alignment summary, and saved set lists.

IndexedDB holds a cache for installed/offline use and at most one latest deferred state write. When connectivity returns, that deferred write is copied to D1. Avoid simultaneous edits on several devices: the last complete state received by D1 wins. An existing local-only installation is migrated automatically only when the shared D1 library is empty and that browser has never connected successfully; once D1 exists it wins over a stale browser cache.

The Worker accepts only a correctly signed, unexpired, 30-day session cookie before reading or changing D1. The login is protected by a per-network-location rate limit of ten attempts per minute. The password is represented only by its SHA-256 digest in an encrypted Worker Secret, and the independent session-signing key is another encrypted secret. The static application shell is public and contains no library data or credentials. There is no Zero Trust account, account database, WebDAV access, telemetry, CDN, external font, or runtime third-party request. The production service worker caches only the same-origin app shell and static assets; selected `.mscz` files are never copied into the cache.

Use **Download app settings** on the About screen to save a versioned, human-readable JSON file. Each entry contains the numeric score number, piece name, and its 80s, opener, hotness, goes-high, drums-intro, and enabled settings. Files, relative paths, internal IDs, alignment state, and generated performances are deliberately excluded. **Re-import app settings** parses only an explicitly selected settings JSON, shows a preview, and updates matched pieces after confirmation. Matching uses the numeric score number; name differences are shown for review, pieces absent from the current library are skipped, and pieces absent from the backup keep their settings.

Use **Export set list** on the Sets screen to save the current named list as a separate, versioned JSON file. It includes set names, order, source generation details, score names and ordering, and the score metadata needed to display it independently of the library. **Import set list** validates an explicitly selected JSON file and saves it with fresh local IDs, so an import cannot overwrite another list. This set-list file remains separate from the app-settings backup.

Sign in successfully at least once before relying on offline mode. Use **Sign out** to remove the server session on that browser. Keep a downloaded settings JSON outside the browser profile as a recovery copy. Folder access remains manual, and availability of a Nextcloud-backed folder depends on the iOS Files provider.

The interface follows the device’s light or dark appearance automatically. Dark appearance uses glare-controlled near-black surfaces and high-contrast controls for reading set lists during evening and indoor performances.

## Install on iPhone

In Safari, open the deployed address, tap Share, choose **Add to Home Screen**, and enable **Open as Web App** if offered. Launch once while online. The in-app update notice provides a deliberate refresh path without replacing IndexedDB.

## Signed-cookie authentication + D1 deployment (owner actions)

`wrangler.toml` bundles the D1 API Worker with the static PWA, invokes it for `/api/*`, binds D1 as `DB`, and rate-limits login requests. It contains no authentication credentials.

1. In Cloudflare's D1 dashboard, create a database named `piece-selector` and place its ID in `wrangler.toml` as `database_id`. The CLI equivalent is `npx wrangler d1 create piece-selector`.
2. Apply `migrations/0001_cloud_state.sql` to that database. The CLI equivalent is `npx wrangler d1 migrations apply piece-selector --remote`.
3. In **Workers & Pages → piece-selector → Settings → Variables and Secrets**, create encrypted secrets named `AUTH_PASSWORD_HASH` and `SESSION_SIGNING_KEY`. Do not create ordinary plaintext variables with these names.
4. `AUTH_PASSWORD_HASH` must be the 64-character, lowercase SHA-256 digest of a password generated by a password manager. Use at least 20 random characters because this deliberately small scheme uses a fast hash. `SESSION_SIGNING_KEY` must be a different random value containing at least 32 bytes.

   Generate both values without Node.js. The password prompt does not echo or place the password in shell history:

   ```sh
   bash -c 'read -rsp "Band password: " piece_selector_password; printf "\n"; printf "%s" "$piece_selector_password" | openssl dgst -sha256 -r | cut -d" " -f1'
   openssl rand -hex 32
   ```

   Use the first output for `AUTH_PASSWORD_HASH` and the second output for `SESSION_SIGNING_KEY`. Generate them separately; never reuse the band password as the signing key.

5. Connect the `piece-selector` Worker to the intended private repository. In Workers Builds use the production branch you intend to deploy, blank root directory, build command `npm run build`, and deploy command `npx wrangler deploy`.
6. Open the Worker URL, enter the band password, and verify that a refresh reopens the shared library. Sign in on the original browser first if it contains local-only data that must migrate.

Cloudflare Pages static-only deployment is no longer compatible with this architecture because it cannot serve the `/api/state` Worker entry point and D1 binding. No command in this repository automatically creates or changes a Cloudflare or GitHub resource.
