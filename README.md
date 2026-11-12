# Piece Selector

Piece Selector is a mobile-first, authenticated set builder for a street band. It turns a manually selected scores folder into a configurable library, synchronizes it through Cloudflare D1, and generates complete performances with distinct pieces and a valid starter at the beginning of every set.

## What it reads

Only the metadata exposed by the file picker is used: filename and, where available, relative path. The app never calls a content-reading method on a selected MuseScore file, and it does not keep the selected `File` or `FileList` after the scan. Accepted filenames and relative paths are synchronized to the password-protected D1 library; MuseScore contents are never uploaded.

Candidate filenames end in `.mscz` (case-insensitive) and follow:

```text
XX - name.mscz
01 - Take On Me.mscz
A - Jingle Bells.mscz
```

Whitespace and number width may vary. Leading zeroes are kept for display. Identifiers can be positive integers or 1–20 Latin letters (A–Z, AA, AB, etc.); letters are normalized to uppercase. Numeric identifiers and letters are distinct, and duplicates are checked within each collection. Malformed names and conflicting identifiers are shown under Needs attention and skipped.

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
- `npm run preview:cf` — apply local D1 migrations and serve the already-built Worker locally. Authentication fails closed until its authentication and Turnstile bindings are supplied.

## Import and manual re-alignment

In the Library, tap **New collection**, enter a name (for example **Christmas**), and tap **Create collection**. The collection is saved immediately, even while empty, and **Import pieces** opens with it selected. Choose the folder or files, review the preview, then apply the import. You can also choose an existing collection or type a new name directly in **Import pieces**. **Add pieces** is the default: importing a partial folder adds or updates its pieces without marking absent pieces missing. Existing libraries belong to **General** automatically.

For a full folder comparison, choose **Re-align collection** and select its complete folder. Only absent pieces in that collection are marked missing. Other collections are never affected. Filter the Library or the Build screen by collection; **All collections** retains the existing Mix behavior of including every eligible piece.

To rename a collection, select it in the Library's Collection filter, tap **Rename collection**, and save the new name. Piece IDs, settings, and saved programs are preserved; a name already used by another collection is rejected.

Tap **Select pieces** (or hold a piece), select one or more pieces, and choose **Move to collection**. Choose the destination and tap **Move pieces** to save the entire selection together. **Remove from collection** returns selected pieces to **General**; it keeps the pieces, settings, and saved programs. If an identifier already exists in the destination, the whole move is rejected without changing any pieces. Empty collections remain available for later imports. **Edit settings** applies only the chosen settings to selected pieces.

Matching uses the collection name (case-insensitive) and identifier: **Christmas · A**, **General · A**, and **General · 1** are independent pieces. A title change under the same identifier keeps the immutable ID and configuration. Full re-alignment suggests unique normalized-title matches under a different identifier for explicit review. Choose **Treat as same score** to preserve identity or **Add as new** to keep the previous record missing. Title normalization is Unicode NFKC followed by lower-casing and never changes displayed text.

Applying a reviewed scan updates scores and its alignment record in one D1 state write when connected. Scanning or cancelling does not mutate storage.

On iPhone with Safari 18.4 or newer, tap the folder action, navigate inside the intended folder in Files, then tap **Open**. Do not select each document separately. The directory input intentionally has no file-type filter; Piece Selector filters the returned metadata to `.mscz` locally, which keeps third-party Files providers available. Older iOS versions and failed provider flows can use **Select .mscz files instead** for an explicit multi-file selection.

## Configuration and generation

New scores start active, enabled, and pending. `can start`, hotness 1–3, drums intro, and goes high must each have an explicit value before an enabled score becomes complete; a disabled score may leave these values unset. Collections replace the separate **80s repertoire** option. Create an **80s** collection if you want to group that repertoire. Missing, disabled, and pending scores cannot be generated.

Choose a collection on the Build screen, or **All collections** to use every active, enabled, complete score. There is no separate repertoire switch. Existing 80s tags and historical program metadata are retained for backup compatibility; they do not restrict new builds. To continue grouping pieces previously tagged 80s, select them in the Library and move them into an **80s** collection. The documented UI limits are 1–12 sets and 1–30 scores per set. Generation checks the requested score and distinct-starter counts before doing work, reserves all starters first, samples the remaining scores without replacement using hotness as weight, places goes-high pieces at the beginning of their set immediately after its starter, and avoids adjacent drums intros when possible. A non-blocking warning is retained when that soft preference must be relaxed. The seed is stored so a result can be reproduced in tests.

Every generated performance becomes a saved set list containing independent score snapshots, and the most recently opened list opens automatically after relaunch. Set-list and individual-set names are editable. Arrow controls can reorder whole sets and pieces; the starter remains first and goes-high placement stays valid. Later folder alignment does not rewrite this historical output.

## Data, authentication, and offline behavior

Authenticated D1 storage is the source of truth whenever the service is reachable. The shared band password unlocks one shared D1 state document containing filenames, relative paths, settings, alignment summary, and saved set lists.

IndexedDB holds a cache for installed/offline use and at most one latest deferred state write. When connectivity returns, that deferred write is copied to D1. Avoid simultaneous edits on several devices: the last complete state received by D1 wins. An existing local-only installation is migrated automatically only when the shared D1 library is empty and that browser has never connected successfully; once D1 exists it wins over a stale browser cache.

Collection management upgrades IndexedDB to version 11 and the cloud state document to version 3. Older libraries are upgraded without dropping pieces or settings. The D1 SQL schema and Worker bindings do not change; deploy the updated Worker and app together. Settings backups contain each piece's collection, but do not include empty collections.

The Worker accepts only a correctly signed, unexpired, 30-day session cookie before reading or changing D1. Login requires a server-validated Cloudflare Turnstile token before the password is checked and retains the per-network-location rate limit of ten attempts per minute. The password is represented only by its SHA-256 digest in an encrypted Worker Secret, and the independent session-signing key and Turnstile validation key are separate encrypted secrets. The static application shell is public and contains no library data or credentials. Turnstile loads only on the login page and sends no score filenames, settings, or set lists to its challenge service. There is no Zero Trust account, account database, WebDAV access, telemetry, or external font. The production service worker caches only the same-origin app shell and static assets; it does not cache Turnstile or selected `.mscz` files.

Use **Download app settings** on the About screen to save a versioned JSON file containing each piece's collection, identifier, name, and configuration. **Re-import app settings** matches by collection and identifier and shows a preview before confirmation. Older settings files without collections match **General**; after renaming a collection, export a fresh backup using its new name. Files, relative paths, internal IDs, alignment state, and performances are excluded. Missing pieces are skipped and unspecified pieces keep their settings.

Use **Export set list** on the Sets screen to save the current named list as a separate, versioned JSON file. It includes set names, order, source generation details, score names and ordering, and the score metadata needed to display it independently of the library. **Import set list** validates an explicitly selected JSON file and saves it with fresh local IDs, so an import cannot overwrite another list. This set-list file remains separate from the app-settings backup.

Sign in successfully at least once before relying on offline mode. Use **Sign out** to remove the server session on that browser. Keep a downloaded settings JSON outside the browser profile as a recovery copy. Folder access remains manual, and availability of a Nextcloud-backed folder depends on the iOS Files provider.

The interface follows the device’s light or dark appearance automatically. Dark appearance uses glare-controlled near-black surfaces and high-contrast controls for reading set lists during evening and indoor performances.

## Install on iPhone

In Safari, open the deployed address, tap Share, choose **Add to Home Screen**, and enable **Open as Web App** if offered. Launch once while online. The in-app update notice provides a deliberate refresh path without replacing IndexedDB.

## Cloudflare dashboard deployment without local Node.js (owner actions)

All account setup can be performed in the Cloudflare web panel. Cloudflare Workers Builds runs the repository's npm and Wrangler commands inside Cloudflare's build environment; Node.js does not need to be installed on the owner's computer. `wrangler.toml` remains the deployment source of truth for static assets and the `LOGIN_RATE_LIMITER` binding.

1. Open **Storage & Databases → D1 SQL database**, create a database named `piece-selector`, and copy its database ID. Put that ID in `wrangler.toml` as `database_id` on the branch that will be deployed.
2. Select **piece-selector → Console**, paste the following SQL, and select **Execute**:

   ```sql
   CREATE TABLE IF NOT EXISTS app_states (
     owner_id TEXT PRIMARY KEY,
     revision INTEGER NOT NULL,
     operation_id TEXT NOT NULL,
     state_json TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   ```

   Open **Tables** and confirm that `app_states` exists. This is the complete migration; using `IF NOT EXISTS` makes it safe to execute again.
3. Open **Workers & Pages → set-builder → Bindings → Add binding → D1 database**. Enter exactly `DB` for **Variable name**, select the `piece-selector` database, and deploy the binding. The Worker cannot use a differently named binding.
4. Open **Turnstile → Add widget**. Name it `Piece Selector login`, choose **Managed** mode, then use **Add custom hostname** under **Hostname management** and enter `set-builder.pierre-513.workers.dev` exactly—without `https://`, a path, or a trailing slash. The dropdown only lists zones in your account, so a `workers.dev` hostname is expected not to appear there. For an existing widget, open its **Settings → Hostname management → Add Hostnames**. Copy the site key and secret key after saving the widget.
5. Open **Workers & Pages → set-builder → Settings → Variables and Secrets → Add**. Create `TURNSTILE_SITE_KEY` as a plaintext runtime variable and create `TURNSTILE_SECRET_KEY`, `AUTH_PASSWORD_HASH`, and `SESSION_SIGNING_KEY` as type **Secret**. Do not place any secret under Build variables. Select **Deploy** after saving all four bindings.
6. `AUTH_PASSWORD_HASH` must be the 64-character, lowercase SHA-256 digest of a password generated by a password manager. Use at least 20 random characters because this deliberately small scheme uses a fast hash. `SESSION_SIGNING_KEY` must be a different random value containing at least 32 bytes. Generate both values without Node.js; the password prompt does not echo or place the password in shell history:

   ```sh
   bash -c 'read -rsp "Band password: " piece_selector_password; printf "\n"; printf "%s" "$piece_selector_password" | openssl dgst -sha256 -r | cut -d" " -f1'
   openssl rand -hex 32
   ```

   Use the first output for `AUTH_PASSWORD_HASH` and the second output for `SESSION_SIGNING_KEY`. Generate them separately; never reuse the band password as the signing key.
7. Under **Workers & Pages → set-builder → Settings → Build**, connect the intended private repository and production branch. Use a blank root directory, `npm run build` as the build command, and `npx wrangler deploy` as the deploy command.
8. Trigger a new build from a commit on the configured branch. The deployment output should list the `ASSETS`, `DB`, and `LOGIN_RATE_LIMITER` bindings. Cloudflare currently does not display Rate Limiting API bindings in the web panel, so `LOGIN_RATE_LIMITER` must remain configured in `wrangler.toml`; missing authentication or Turnstile configuration deliberately makes sign-in fail closed.
9. Open the resulting Worker URL in a private browser, complete the verification, enter the band password, and verify that refreshing opens the shared library without another prompt. Sign in on the original browser first if it contains local-only data that must migrate.

Use the `*.workers.dev` address from this Worker rather than a static-only Pages deployment, which cannot serve the `/api/state` entry point and D1 binding. No repository command automatically creates or changes a Cloudflare or GitHub resource. See Cloudflare's [D1 dashboard instructions](https://developers.cloudflare.com/d1/get-started/), [Turnstile hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/), [secret configuration](https://developers.cloudflare.com/workers/configuration/secrets/), and [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) for the current panel flow.
