# Changelog

All notable changes to Piece Selector will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/3isenHeiM/Set-Builder/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/3isenHeiM/Set-Builder/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/3isenHeiM/Set-Builder/releases/tag/v1.0.0
