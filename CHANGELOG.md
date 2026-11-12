# Changelog

All notable changes to Piece Selector will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/3isenHeiM/Set-Builder/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/3isenHeiM/Set-Builder/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/3isenHeiM/Set-Builder/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/3isenHeiM/Set-Builder/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/3isenHeiM/Set-Builder/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/3isenHeiM/Set-Builder/releases/tag/v1.0.0
