// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const {
  getFlags,
  addFlag,
  removeFlag,
  initialStore,
} = require("./store/flagStore");
const { updateDecorations } = require("./ui/decoration");
const { FlagTreeDataProvider } = require("./ui/flagTreeProvider");
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

function activate(context) {
  initialStore(context);

  const flagProvider = new FlagTreeDataProvider();

  const treeView = vscode.window.createTreeView("codeflagView", {
    treeDataProvider: flagProvider,
    showCollapseAll: true,
  });

  // Apply to all visible editors immediately
  vscode.window.visibleTextEditors.forEach((editor) => {
    updateDecorations(editor);
  });

  // Fallback for active editor
  if (vscode.window.activeTextEditor) {
    updateDecorations(vscode.window.activeTextEditor);
  }

  const welcomeMessage = vscode.commands.registerCommand(
    "codeflag.welcomeMessage",
    function () {
      vscode.window.showInformationMessage("Hello From the other side!");
    },
  );

  const codeFlag = vscode.commands.registerCommand(
    "codeflag.flag",
    function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const document = editor.document;
      const uri = document.uri.toString();
      const selection = editor.selection;

      // Normalize selection
      let startLine;
      let endLine;

      if (selection.isEmpty) {
        // single cursor or gutter click
        const line = selection.active.line;
        startLine = line;
        endLine = line;
      } else {
        // multi-line selection
        startLine = Math.min(selection.start.line, selection.end.line);
        endLine = Math.max(selection.start.line, selection.end.line);
      }

      if (typeof startLine !== "number" || typeof endLine !== "number") {
        console.error("Invalid merged range", startLine, endLine);
        return;
      }
      const range = new vscode.Range(startLine, 0, endLine, 0);

      const flags = getFlags();

      // Find overlapping flags
      const overlappingFlags = flags.filter((f) => {
        if (f.uri !== uri) return false;

        const existingStart = f.range.start.line;
        const existingEnd = f.range.end.line;

        return (
          range.start.line <= existingEnd && range.end.line >= existingStart
        );
      });

      // Compute merged range
      let mergedStart = range.start.line;
      let mergedEnd = range.end.line;

      overlappingFlags.forEach((f) => {
        mergedStart = Math.min(mergedStart, f.range.start.line);
        mergedEnd = Math.max(mergedEnd, f.range.end.line);
      });

      // Remove overlapping flags
      for (let i = flags.length - 1; i >= 0; i--) {
        const f = flags[i];
        if (f.uri === uri && overlappingFlags.includes(f)) {
          removeFlag(i);
        }
      }

      // Add merged flag
      if (typeof mergedStart !== "number" || typeof mergedEnd !== "number") {
        console.error("Invalid merged range", mergedStart, mergedEnd);
        return;
      }

      const mergedRange = new vscode.Range(mergedStart, 0, mergedEnd, 0);

      addFlag(uri, mergedRange);
      updateDecorations(editor);
      flagProvider.refresh();

      // message
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

  // UNFLAG (based on cursor inside range)
  const codeUnflag = vscode.commands.registerCommand(
    "codeflag.unflag",
    function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const uri = editor.document.uri.toString();

      let line;

      if (editor.selection.isEmpty) {
        // single cursor or gutter click
        line = editor.selection.active.line;
      } else {
        // multi-line selection: unflag the start line
        line = editor.selection.start.line;
      }

      const flags = getFlags();

      const index = flags.findIndex((f) => {
        if (f.uri !== uri) return false;

        return line >= f.range.start.line && line <= f.range.end.line;
      });

      if (index >= 0) {
        removeFlag(index);
        updateDecorations(editor);
        flagProvider.refresh();
        vscode.window.showInformationMessage("Codeflag removed");
      } else {
        vscode.window.showInformationMessage("No flag found on this line");
      }
    },
  );

  context.subscriptions.push(codeFlag, codeUnflag);

  // Refresh on editor switch
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) updateDecorations(editor);
  });

  // Refresh on document open
  vscode.workspace.onDidOpenTextDocument((doc) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === doc) {
      updateDecorations(editor);
    }
  });

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

  const removeFromViewCommand = vscode.commands.registerCommand(
    "codeflag.removeFlagFromView",
    (flagItem) => {
      if (!flagItem) return;

      const flag = flagItem.flag;

      if (!flag) {
        console.error("No flag found on TreeItem");
        return;
      }

      const flags = getFlags();

      // FIX: match by values instead of reference
      const index = flags.findIndex(
        (f) =>
          f.uri === flag.uri &&
          f.range.start.line === flag.range.start.line &&
          f.range.end.line === flag.range.end.line,
      );

      if (index >= 0) {
        removeFlag(index);

        // refresh UI
        flagProvider.refresh();

        // refresh editor decorations
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

  vscode.window.onDidChangeTextEditorSelection((event) => {
    flagProvider.refresh();
  });

  context.subscriptions.push(
    welcomeMessage,
    codeFlag,
    codeUnflag,
    revealLineCommand,
    treeView,
    removeFromViewCommand,
  );
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
