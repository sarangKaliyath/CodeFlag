# CodeFlag

Easily add, manage, and navigate flags (bookmarks) in your code for faster development.

> Your bookmarks — now aware of your Git branches.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Features Highlights](#features-highlights)
- [Detailed Usage](#detailed-usage)
  - [Add a Flag](#add-a-flag)
  - [Remove a Flag](#remove-a-flag)
  - [Rename a Flag](#rename-a-flag)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
- [Git Branch Awareness (New)](#git-branch-awareness-new)
- [Screenshots](#screenshots)
- [Release Notes](#release-notes)

---

## Quick Start

1. **Add a Flag**
   - Single-line: Place cursor → Right-click → **Add Flag**
   - Multi-line: Select lines → Right-click → **Add Flag**

2. **Remove a Flag**
   - Editor: Right-click flagged line → **Remove Flag**
   - Activity Bar: Hover → Click **Remove**

3. **Rename a Flag**
   - Hover over a flag → Click **Rename** → Enter new name

4. **Keyboard Shortcuts**
   | Action | Shortcut |
   |------------|----------------|
   | Add Flag | Ctrl + Alt + F |
   | Remove Flag | Ctrl + Alt + U |

---

## Features Highlights

- Add, remove, and rename flags quickly
- Named bookmarks for easy navigation
- **Smart flag merging:**
  - Flagging a subset of an existing flag is **ignored**
  - Overlapping flags automatically **merge into one**
- **Activity Bar preview:** Hover to preview flagged code
- Fully supports single-line and multi-line selections

### 🆕 Context-Aware Flags

- Flags are scoped to:
  - Workspace
  - Git repository
  - Git branch
- Prevents flags from leaking across unrelated contexts

---

## Detailed Usage

### Add a Flag

**Single-line**

1. Place your cursor on the line you want to flag
2. Right-click and select **"Add Flag"**

**Multi-line**

1. Select multiple lines of code
2. Right-click the selection
3. Select **"Add Flag"**

---

### Remove a Flag

**From Editor**

1. Right-click on a flagged line
2. Select **"Remove Flag"**

**From Activity Bar**

1. Hover over the flagged item
2. Click the **Remove** option

---

### Rename a Flag

1. Hover over the flagged item
2. Click the **Rename** option
3. Enter a new name or description

---

### Keyboard Shortcuts

| Action      | Shortcut       |
| ----------- | -------------- |
| Add Flag    | Ctrl + Alt + F |
| Remove Flag | Ctrl + Alt + U |

---

## Git Branch Awareness (New)

CodeFlag now intelligently tracks flags **per Git branch**.

### ✅ What this means

- Flags created on one branch **will NOT appear** on another
- Switching branches automatically updates:
  - Editor decorations
  - Activity Bar flag list
- Each flag is tied to:
  - File
  - Repository
  - Branch
  - Workspace

### 🔄 Example Workflow

1. Add flags in `feature/login`
2. Switch to `main`
3. → Flags disappear (clean context)
4. Switch back to `feature/login`
5. → Flags reappear instantly

### ⚙️ Under the Hood

- Uses VS Code Git API (`vscode.git`)
- Listens to branch changes via repository state updates
- Automatically refreshes:
  - Decorations
  - Sidebar tree view

---

## Screenshots

**Add Flag: Multi-line**  
![Add Flag: Multi-line](images/multiLineAddFlag.gif)

**Add Flag: Single-line**  
![Add Flag: Single-line](images/singleLineAddFlag.gif)

**Remove Flag**  
![Remove Flag](images/removeFlag.gif)

**Remove Flag: Activity Bar**  
![Remove Flag](images/removeFlagActivityBar.gif)

**Rename Flag: Activity Bar**  
![Rename Flag](images/renameFlag.gif)

---

## Release Notes

## [1.1.1] - 2026-04-04

### Fixed

- Flags not loading on IDE startup until CodeFlag view is opened

### [1.1.0] 2026-04-04

- ✨ Added Git branch-aware flag tracking
- 🔄 Automatic UI refresh on branch switch
- 🧠 Flags now scoped by workspace, repo, and branch

### ⚠️ Behavior Change

Flags are now scoped per Git branch.

If your flags seem missing after updating:

- Switch back to the branch where they were created
- They are not deleted — just context-specific

### [1.0.2] - 2026-04-02

- 🐛 Bug fixes and stability improvements

### [1.0.1] - 2026-04-01

- 🐛 Minor bug fixes

### [1.0.0] - 2026-04-01

- Initial release
