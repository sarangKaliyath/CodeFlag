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

      const uri = editor.document.uri.toString();
      const line = editor.selection.active.line;

      const index = getFlags().findIndex((b) => b.uri === uri && b.line == line);

      if (index === -1) {
        addFlag({ uri, line });
		updateDecorations(editor);
        vscode.window.showInformationMessage("Codeflag added");
      } else {
        vscode.window.showInformationMessage("Already flagged");
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

      const index = getFlags().findIndex((b) => b.uri === uri && b.line == line);

      if (index >= 0) {
        removeFlag(index);
		updateDecorations(editor);
        vscode.window.showInformationMessage("Codeflag removed");
      } else {
        vscode.window.showInformationMessage("No flag found on this line");
      }
    },
  );

  context.subscriptions.push(welcomeMessage, codeFlag, codeUnflag);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
