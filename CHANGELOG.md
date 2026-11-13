# Changelog

All notable changes to Piece Selector will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.3.2] - 2026-11-13

*v2.3.2: Prod-ready*

### Added

- Share locked programs directly and choose a personal **Drummer notes** view on the same public setlist link, with structured tempo, measure, pickup, and custom text hidden by default and remembered per browser (fixes [#16](https://github.com/3isenHeiM/Set-Builder/issues/16)).

### Changed

- Configure drummer notes with tempo and beat-unit, measure, and optional pickup dropdowns, a music-notation preview, and a 100-character custom note. Preserve older notes and frozen program copies; include the structured fields in backups and shared views (fixes [#15](https://github.com/3isenHeiM/Set-Builder/issues/15)).
- Remove the H1–H3 / I1–I3 hotness labels from editable, locked, Tonight, and shared setlists to reduce visual clutter (fixes [#11](https://github.com/3isenHeiM/Set-Builder/issues/11)).
- Upgrade IndexedDB to version 14, cloud state to version 5, settings backups to version 6, and setlist backups to version 4 while preserving older notes and saved programs. Deploy the updated Worker and app together; this release needs no new D1 SQL migration.

## [2.3.1] - 2026-11-13

*No more single use piece*

### Added

- Repeat pieces, starters, or saved sets when composing a program, with a small **(!)** beside every repeated appearance in editable, locked, Tonight, and shared views. Automatic generation remains unique (fixes [#14](https://github.com/3isenHeiM/Set-Builder/issues/14)).

## [2.3.0] - 2026-11-12

*It's happening*

### Added

- See a live set count and total piece count at the top of Build and saved-program screens, including programs with unequal set sizes; keep the summary visible while scrolling (fixes [#9](https://github.com/3isenHeiM/Set-Builder/issues/9)).
- Lock a saved program against edits and load a fixed, device-local copy into **Tonight**, which opens automatically on relaunch and remains available offline; unlock only after explicit confirmation in Sets (fixes [#13](https://github.com/3isenHeiM/Set-Builder/issues/13)).
- Override goes-high piece ordering within an individual set while preserving its required starter and whole-program uniqueness; retain the custom order in saved programs, reusable sets, and JSON export/import (refs [#10](https://github.com/3isenHeiM/Set-Builder/issues/10)).
- Fold or expand individual sets by tapping their ribbons in editable and shared read-only programs, with keyboard support and visible state indicators (fixes [#12](https://github.com/3isenHeiM/Set-Builder/issues/12)).
- Delete a piece from its detail page after explicit confirmation, preserving saved sets and programs (fixes [#6](https://github.com/3isenHeiM/Set-Builder/issues/6)).
- Share a live, read-only mirror of a saved setlist, including its piece metrics, warnings, and notes, without requiring viewers to sign in; revoke access with **Stop sharing** (fixes [#7](https://github.com/3isenHeiM/Set-Builder/issues/7)).
- Add optional multiline drummer notes to pieces, retain them in backups, and update those notes in reusable sets, editable programs, and shared views while preserving locked program snapshots (fixes [#8](https://github.com/3isenHeiM/Set-Builder/issues/8)).

### Changed

- Build 1–12 sets with phone-friendly plus/minus controls and clear explanations when adding a set would reuse pieces or needs another unused starter (refs [#10](https://github.com/3isenHeiM/Set-Builder/issues/10)).
- Keep **Move to set** as a compact 44 × 44 picker beside each piece's ordering controls, leaving the title column free (fixes [#13](https://github.com/3isenHeiM/Set-Builder/issues/13)).
- Upgrade existing local databases without losing library settings or saved programs. Tonight's selection stays on its device, is cleared on sign-out, and must be reloaded to include later source-program edits.
- When deploying this release, apply the new D1 migration `0002_setlist_shares.sql` to enable setlist sharing.

## [2.2.1] - 2026-11-12

### Added

- Create and save empty collections, then import pieces directly into them. Move selected library pieces to another collection together or return them to **General**, preserving settings and saved programs (fixes [#5](https://github.com/3isenHeiM/Set-Builder/issues/5)).

### Changed

- Collections replace the separate 80s repertoire controls and generation preset. Older library state and backup metadata remain supported.

## [2.2.0] - 2026-11-12

### Added

- Create programs and sets from a chosen starting piece, edit and save existing sets, and move pieces between sets while preserving starter, high-piece, and whole-program uniqueness rules (fixes [#2](https://github.com/3isenHeiM/Set-Builder/issues/2)).
- Select multiple library pieces with a long press or **Select pieces**, then apply chosen settings together while keeping other settings unchanged (fixes [#3](https://github.com/3isenHeiM/Set-Builder/issues/3)).
- Import numeric and lettered piece identifiers into named collections. Filter the Library and Build screens by collection, add pieces without marking absent pieces missing, re-align a complete collection, and rename collections while preserving piece settings and saved programs (fixes [#4](https://github.com/3isenHeiM/Set-Builder/issues/4)).

### Changed

- Existing libraries migrate to **General**. Settings and set-list backups now include collection identifiers; older backups remain supported and pieces without a collection belong to **General**. Export a fresh settings backup after renaming a collection so future imports use its new name.

### Fixed

- Use the app's music icon for the iOS Home Screen and installed PWA icons, with an explicit 180px Apple touch icon (fixes [#1](https://github.com/3isenHeiM/Set-Builder/issues/1)).

## [2.1.0] - 2026-09-10

### Added

- Reusable named sets that can be saved and updated independently from an event program.
- Saved event programs assembled from reusable sets, with explicit save, import, and export actions.
- Controls to add or remove ready pieces, use different set sizes, and add, remove, or reorder sets while preserving starter, high-piece, and whole-program uniqueness constraints.

### Changed

- Reworked the Sets page around individually reusable sets and complete event programs. Programs keep stable copies so later set changes cannot silently alter a planned event.
- Saving an individually edited piece now returns to the Library, while **Save and next** continues through the pending configuration queue.

### Fixed

- Render Turnstile directly after its asynchronous script load, preventing the verification widget from failing before it appears.

## [2.0.1] - 2026-09-08

### Security

- Require a fresh Cloudflare Turnstile verification before every band-password attempt while retaining login rate limiting.

### Fixed

- Bind browser API requests to `window`, preventing sign-out and cloud synchronization failures in browsers that enforce the Fetch API receiver.

## [2.0.0] - 2026-09-07

### Added

- English and French interfaces selected automatically from the browser language. English remains the fallback for every non-French locale.
- Multiple saved set lists. Newly generated and imported lists remain available after generating another performance or relaunching the app.
- Editable names for saved set lists and their individual sets.
- Accessible controls for reordering whole sets and individual pieces while preserving starter and goes-high placement rules.
- Versioned JSON export and import for complete set lists, including their names, order, generation details, warnings, and independent score snapshots.
- Shared Cloudflare D1 storage for the piece library, configuration, last folder alignment, and current and saved set lists.
- Safe first-sign-in migration of an existing device-local library to an empty shared D1 database.
- Band-password sign-in and sign-out screens backed by signed session cookies.

### Changed

- **Breaking:** Deployed installations now require a Cloudflare Worker, a bound D1 database, and the configured authentication secrets. Static-only Cloudflare Pages deployments can no longer provide the application API.
- **Breaking:** D1 is the production source of truth. IndexedDB acts as the offline cache and queues offline changes for the next authenticated online session.
- Disabled pieces no longer require can-start, hotness, drums-intro, or goes-high settings to be considered configured. Re-enabling a piece restores those requirements.
- Generating another performance creates a new saved set list instead of replacing the previously generated list.

### Fixed

- iOS folder selection no longer narrows third-party Files providers with an extension filter, and users can select multiple `.mscz` files when a provider or browser cannot return a whole folder.

### Security

- Protected the D1 API with a shared password digest, 30-day HMAC-signed `HttpOnly`, `Secure`, `SameSite=Strict` session cookies, and same-origin request checks.
- Added login throttling, strict cloud-state validation, request-size limits, and no-store API responses.

## [1.0.0] - 2026-09-02

### Added

- Initial mobile-first offline PWA for importing and re-aligning `.mscz` filename metadata, configuring pieces, generating valid performances, saving the latest performance, and backing up piece settings.

[Unreleased]: https://github.com/3isenHeiM/Set-Builder/compare/v2.3.2...HEAD
[2.3.2]: https://github.com/3isenHeiM/Set-Builder/compare/v2.3.1...v2.3.2
[2.3.1]: https://github.com/3isenHeiM/Set-Builder/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/3isenHeiM/Set-Builder/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/3isenHeiM/Set-Builder/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/3isenHeiM/Set-Builder/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/3isenHeiM/Set-Builder/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/3isenHeiM/Set-Builder/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/3isenHeiM/Set-Builder/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/3isenHeiM/Set-Builder/releases/tag/v1.0.0
