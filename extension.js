const vscode = require("vscode");
const {
  getFlags,
  addFlag,
  removeFlag,
  initialStore,
  updateFlagLabel,
} = require("./store/flagStore");
const { updateDecorations } = require("./ui/decoration");
const { FlagTreeDataProvider } = require("./ui/flagTreeProvider");

// ---------------------------------------------------------------------------
// Entry point — called once by VS Code when the extension is first activated.
// All commands, providers, and event listeners are registered here and pushed
// onto `context.subscriptions` so VS Code disposes them on deactivation.
// ---------------------------------------------------------------------------

/**
 * Extension activation handler.
 * Wires up persistent storage, the sidebar tree view, all commands, and every
 * event listener needed to keep decorations and the tree in sync.
 *
 * @param {vscode.ExtensionContext} context - Provided by VS Code; carries
 *   workspaceState (used for persistence) and the subscriptions array.
 */
async function activate(context) {
  // Hydrate the flag store from persisted workspaceState before anything else.
  initialStore(context);

  // -------------------------------------------------------------------------
  // Sidebar tree view
  // -------------------------------------------------------------------------

  // The data provider drives the "CodeFlag" panel in the Explorer sidebar.
  const flagProvider = new FlagTreeDataProvider();

  const treeView = vscode.window.createTreeView("codeflagView", {
    treeDataProvider: flagProvider,
    showCollapseAll: true,
  });

  // -------------------------------------------------------------------------
  // Initial decoration pass
  // -------------------------------------------------------------------------

  // Decorate every editor that is already visible when the extension activates
  // (e.g. tabs that were open from the previous session).
  vscode.window.visibleTextEditors.forEach((editor) => {
    updateDecorations(editor);
  });

  // Belt-and-suspenders: also update the focused editor explicitly, in case it
  // wasn't included in visibleTextEditors on some VS Code versions.
  if (vscode.window.activeTextEditor) {
    updateDecorations(vscode.window.activeTextEditor);
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  /** Smoke-test command — shows a greeting. Registered in package.json as "codeflag.welcomeMessage". */
  const welcomeMessage = vscode.commands.registerCommand(
    "codeflag.welcomeMessage",
    function () {
      vscode.window.showInformationMessage("Hello from the other side!");
    },
  );

  /**
   * FLAG command ("codeflag.flag")
   *
   * Adds a flag for the current selection (or cursor line). If the new range
   * overlaps with one or more existing flags they are all merged into a single
   * contiguous flag, which prevents duplicate / nested flags on the same lines.
   *
   * Flow:
   *   1. Resolve the selected range (single line or multi-line).
   *   2. Find all flags in the current file that overlap the selection.
   *   3. Merge their ranges into one bounding range.
   *   4. Remove the individual overlapping flags.
   *   5. Prompt the user for an optional label.
   *   6. Persist the merged flag and refresh the UI.
   */
  const codeFlag = vscode.commands.registerCommand(
    "codeflag.flag",
    async function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const document = editor.document;
      const uri = document.uri.toString();
      const selection = editor.selection;

      // -- Step 1: Resolve the line range from the current selection ----------
      let startLine;
      let endLine;

      if (selection.isEmpty) {
        // No text selected — flag the line the cursor sits on.
        const line = selection.active.line;
        startLine = line;
        endLine = line;
      } else {
        // Text selected — clamp to whole lines (characters are ignored; flags
        // are line-granular).
        startLine = Math.min(selection.start.line, selection.end.line);
        endLine = Math.max(selection.start.line, selection.end.line);
      }

      if (typeof startLine !== "number" || typeof endLine !== "number") {
        console.error("Invalid merged range", startLine, endLine);
        return;
      }
      const range = new vscode.Range(startLine, 0, endLine, 0);

      const visibleFlags = getFlags();

      // -- Step 2: Detect overlapping flags in the same file ------------------
      const overlappingFlags = visibleFlags.filter((f) => {
        if (f.uri !== uri) return false;

        const existingStart = f.range.start.line;
        const existingEnd = f.range.end.line;

        // Two ranges overlap when neither ends before the other starts.
        return (
          range.start.line <= existingEnd && range.end.line >= existingStart
        );
      });

      // -- Step 3: Compute the bounding (merged) range ------------------------
      let mergedStart = range.start.line;
      let mergedEnd = range.end.line;

      overlappingFlags.forEach((f) => {
        mergedStart = Math.min(mergedStart, f.range.start.line);
        mergedEnd = Math.max(mergedEnd, f.range.end.line);
      });

      // -- Step 4: Remove the overlapping flags (iterate in reverse so that
      //    splice-based removal inside removeFlag doesn't shift indices) -------
      for (let i = visibleFlags.length - 1; i >= 0; i--) {
        const f = visibleFlags[i];
        if (f.uri === uri && overlappingFlags.includes(f)) {
          removeFlag(i, visibleFlags);
        }
      }

      // -- Step 5: Prompt for an optional label --------------------------------
      if (typeof mergedStart !== "number" || typeof mergedEnd !== "number") {
        console.error("Invalid merged range", mergedStart, mergedEnd);
        return;
      }

      const mergedRange = new vscode.Range(mergedStart, 0, mergedEnd, 0);

      const label = await vscode.window.showInputBox({
        placeHolder: "Add a name for this flag (optional)",
      });

      // -- Step 6: Persist the flag and refresh UI ----------------------------
      addFlag(uri, mergedRange, label || "");
      updateDecorations(editor);
      flagProvider.refresh();

      // Inform the user whether a plain add or a merge happened.
      if (overlappingFlags.length > 0) {
        vscode.window.showInformationMessage(
          `Flags merged: ${mergedStart + 1} → ${mergedEnd + 1}`,
        );
      } else {
        vscode.window.showInformationMessage(
          `Flag added: ${mergedStart + 1} → ${mergedEnd + 1}`,
        );
      }
    },
  );

  /**
   * UNFLAG command ("codeflag.unflag")
   *
   * Removes the flag that covers the cursor's current line. If text is
   * selected, the start line is used for the lookup. No-ops with a message
   * when no flag is found on the line.
   */
  const codeUnflag = vscode.commands.registerCommand(
    "codeflag.unflag",
    function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const uri = editor.document.uri.toString();

      let line;

      if (editor.selection.isEmpty) {
        // Single cursor — use its line.
        line = editor.selection.active.line;
      } else {
        // Multi-line selection — anchor to the start line.
        line = editor.selection.start.line;
      }

      const visibleFlags = getFlags();

      // Find the first flag whose range contains the target line.
      const index = visibleFlags.findIndex((f) => {
        if (f.uri !== uri) return false;

        return line >= f.range.start.line && line <= f.range.end.line;
      });

      if (index >= 0) {
        removeFlag(index, visibleFlags);
        updateDecorations(editor);
        flagProvider.refresh();
        vscode.window.showInformationMessage("Codeflag removed");
      } else {
        vscode.window.showInformationMessage("No flag found on this line");
      }
    },
  );

  /**
   * REVEAL LINE command ("codeflag.revealLine")
   *
   * Navigates to the file and line associated with a flag. Triggered when the
   * user clicks a flag entry in the sidebar tree view. Centers the range in
   * the editor and moves the cursor to the flag's start position.
   *
   * @param {{ uri: string, range: vscode.Range }} flag - The flag to navigate to
   */
  const revealLineCommand = vscode.commands.registerCommand(
    "codeflag.revealLine",
    (flag) => {
      const uri = vscode.Uri.parse(flag.uri);

      vscode.workspace.openTextDocument(uri).then((doc) => {
        vscode.window.showTextDocument(doc).then((editor) => {
          editor.revealRange(flag.range, vscode.TextEditorRevealType.InCenter);
          editor.selection = new vscode.Selection(
            flag.range.start,
            flag.range.start,
          );
        });
      });
    },
  );

  /**
   * REMOVE FROM VIEW command ("codeflag.removeFlagFromView")
   *
   * Deletes a flag via the inline remove button in the sidebar tree. Uses
   * value-based matching (uri + line numbers) rather than object reference
   * equality because the tree item holds a snapshot of the flag, not the live
   * store reference.
   *
   * @param {{ flag: object }} flagItem - The tree item whose flag should be removed
   */
  const removeFromViewCommand = vscode.commands.registerCommand(
    "codeflag.removeFlagFromView",
    (flagItem) => {
      if (!flagItem) return;

      const flag = flagItem.flag;

      if (!flag) {
        console.error("No flag found on TreeItem");
        return;
      }

      const visibleFlags = getFlags();

      // Match by value (not reference) since the tree item holds a snapshot.
      const index = visibleFlags.findIndex(
        (f) =>
          f.uri === flag.uri &&
          f.range.start.line === flag.range.start.line &&
          f.range.end.line === flag.range.end.line,
      );

      if (index >= 0) {
        removeFlag(index, visibleFlags);

        // Refresh both the tree and the editor decorations.
        flagProvider.refresh();

        const editor = vscode.window.activeTextEditor;
        if (editor) {
          updateDecorations(editor);
        }

        vscode.window.showInformationMessage("Flag removed");
      } else {
        console.error("Flag not found in store");
      }
    },
  );

  /**
   * RENAME FLAG command ("codeflag.renameFlag")
   *
   * Prompts the user for a new label and updates the flag in the store.
   * Triggered via the inline rename button in the sidebar tree view.
   * Cancelling the input box (pressing Escape) is a no-op.
   *
   * @param {{ flag: object }} flagItem - The tree item whose flag should be renamed
   */
  const renameFlagCommand = vscode.commands.registerCommand(
    "codeflag.renameFlag",
    async (flagItem) => {
      if (!flagItem || !flagItem.flag) return;

      const flag = flagItem.flag;

      const newLabel = await vscode.window.showInputBox({
        value: flag.label || "",
        placeHolder: "Rename flag",
      });

      if (newLabel === undefined) return; // User pressed Escape — cancel silently.

      const visibleFlags = getFlags();

      const index = visibleFlags.findIndex(
        (f) =>
          f.uri === flag.uri &&
          f.range.start.line === flag.range.start.line &&
          f.range.end.line === flag.range.end.line,
      );

      if (index >= 0) {
        updateFlagLabel(index, newLabel.trim(), visibleFlags);

        flagProvider.refresh();

        const editor = vscode.window.activeTextEditor;
        if (editor) updateDecorations(editor);

        vscode.window.showInformationMessage("Flag renamed");
      }
    },
  );

  // -------------------------------------------------------------------------
  // Event listeners
  // -------------------------------------------------------------------------

  // Re-decorate whenever the user switches to a different editor tab.
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) updateDecorations(editor);
  });

  // Re-decorate when a document is opened (handles split-pane scenarios where
  // the opened doc becomes active but the editor reference changes).
  vscode.workspace.onDidOpenTextDocument((doc) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === doc) {
      updateDecorations(editor);
    }
  });

  // Refresh the tree whenever the cursor moves to a different line so that
  // the "current line" highlight in the tree stays in sync. Debounced by
  // comparing `lastLine` to avoid unnecessary redraws.
  let lastLine = -1;

  vscode.window.onDidChangeTextEditorSelection((event) => {
    const line = event.selections[0]?.active.line;

    if (line !== lastLine) {
      lastLine = line;
      flagProvider.refresh();
    }
  });

  // -------------------------------------------------------------------------
  // Git branch change listener
  // -------------------------------------------------------------------------

  // When the user switches branches the active context changes, so decorations
  // and the tree must be refreshed to show only the flags for the new branch.
  const ext = vscode.extensions.getExtension("vscode.git");

  if (ext) {
    if (!ext.isActive) {
      await ext.activate();
    }

    const api = ext.exports.getAPI(1);

    // Listen to repos that are already open when the extension activates.
    api.repositories.forEach((repo) => {
      repo.state.onDidChange(() => {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
          updateDecorations(editor);
        }

        flagProvider.refresh();
      });
    });

    // Also listen to any repo that the user opens later during the session.
    api.onDidOpenRepository((repo) => {
      repo.state.onDidChange(() => {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
          updateDecorations(editor);
        }

        flagProvider.refresh();
      });
    });
  }

  // -------------------------------------------------------------------------
  // Register disposables
  // -------------------------------------------------------------------------

  // Pushing everything onto subscriptions ensures VS Code cleans up commands,
  // views, and listeners automatically when the extension is deactivated.
  context.subscriptions.push(
    welcomeMessage,
    codeFlag,
    codeUnflag,
    revealLineCommand,
    treeView,
    removeFromViewCommand,
    renameFlagCommand,
  );
}

// Called by VS Code when the extension is deactivated (e.g. window closes).
// No manual cleanup needed — everything was pushed onto context.subscriptions.
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
