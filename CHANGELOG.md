# Changelog

All notable changes to Piece Selector will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- English and French interfaces selected automatically from the browser language. English remains the fallback for every non-French locale.
- Multiple saved set lists. Newly generated and imported lists remain available after generating another performance or relaunching the app.
- Editable names for saved set lists and their individual sets.
- Accessible controls for reordering whole sets and pieces while preserving starter and goes-high placement rules.
- Versioned JSON export and import for complete set lists, including their names, order, generation details, warnings, and independent score snapshots.
- Safe migration of the previously saved latest performance into the new saved-set-list library.

### Changed

- Disabled pieces no longer require can-start, hotness, drums-intro, or goes-high settings to be considered configured. Re-enabling a piece restores those requirements.
- Generating another performance creates a new saved set list instead of replacing the previously generated list.
