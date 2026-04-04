# Change Log

All notable changes to the "codeflag" extension will be documented in this file.

---

## [Unreleased]

- (No pending changes)

---

## [1.1.0] - 2026-04-04

### Added

- Git branch-aware flag tracking
- Flags are now scoped by workspace, repository, and branch
- Automatic UI refresh on branch switch (decorations + Activity Bar)

### Changed

- Improved flag isolation to prevent cross-branch leakage

### ⚠️ Behavior Change

Flags are now scoped per Git branch.

If your flags seem missing after updating:

- Switch back to the branch where they were created
- They are not deleted — just context-specific

---

## [1.0.2] - 2026-04-02

### Fixed

- General bug fixes and stability improvements

---

## [1.0.1] - 2026-04-01

### Fixed

- Minor bug fixes

---

## [1.0.0] - 2026-03-31

### Added

- Initial release of the CodeFlag extension
- Add and remove flags for single-line and multi-line code
- Rename flags for better organization
- Named bookmarks for easy navigation
- Keyboard shortcuts for adding/removing flags
- Smart flag merging (subset flags merge or ignored)
- Activity Bar preview for flagged code
