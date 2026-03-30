// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const { getFlags, addFlag, removeFlag } = require("./store/flagStore");
const { updateDecorations } = require("./ui/decoration");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */

function activate(context) {
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
      const startLine = Math.min(selection.start.line, selection.end.line);
      const endLine = Math.max(selection.start.line, selection.end.line);

      const flags = getFlags();

      // Prevent duplicate range
      const alreadyExists = flags.find(
        (f) =>
          f.uri === uri && f.startLine === startLine && f.endLine === endLine,
      );

      if (alreadyExists) {
        vscode.window.showInformationMessage(
          "Flag already exists for this selection",
        );
        return;
      }

      // Add flag
      addFlag(uri, startLine, endLine);

      updateDecorations(editor);

      if (startLine === endLine) {
        vscode.window.showInformationMessage(
          `Flag added at line ${startLine + 1}`,
        );
      } else {
        vscode.window.showInformationMessage(
          `Flag added: ${startLine + 1} → ${endLine + 1}`,
        );
      }
    },
  );

  const codeUnflag = vscode.commands.registerCommand(
    "codeflag.unflag",
    function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const uri = editor.document.uri.toString();
      const line = editor.selection.active.line;

      const flags = getFlags();

      const index = flags.findIndex(
        (f) => f.uri === uri && line >= f.startLine && line <= f.endLine,
      );

      if (index >= 0) {
        removeFlag(index);

        updateDecorations(editor);

        vscode.window.showInformationMessage("Codeflag removed");
      } else {
        vscode.window.showInformationMessage("No flag found on this line");
      }
    },
  );

  vscode.workspace.onDidChangeTextDocument((event) => {
    const uri = event.document.uri.toString();

    const flags = getFlags();

    event.contentChanges.forEach((change) => {
      const startLine = change.range.start.line;
      const endLine = change.range.end.line;

      const linesAdded =
        change.text.split("\n").length - 1 - (endLine - startLine);

      if (linesAdded === 0) return;

      flags.forEach((f) => {
        if (f.uri !== uri) return;

        // change ABOVE flag → shift entire flag
        if (startLine < f.startLine) {
          f.startLine += linesAdded;
          f.endLine += linesAdded;
        }
        // change INSIDE flag → expand/shrink end
        else if (startLine >= f.startLine && startLine <= f.endLine) {
          // If insertion happens exactly at start → shift whole block
          if (startLine === f.startLine) {
            f.startLine += linesAdded;
            f.endLine += linesAdded;
          } else {
            f.endLine += linesAdded;
          }
        }
      });
    });

    // Re-render decorations
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === uri) {
      updateDecorations(editor);
    }
  });

  context.subscriptions.push(welcomeMessage, codeFlag, codeUnflag);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
