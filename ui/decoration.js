const vscode = require("vscode");
const path = require("path");
const { getFlags } = require("../store/flagStore");

const startDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: path.join(__dirname, "../flag.svg"),
  gutterIconSize: "contain",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const endDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: path.join(__dirname, "../end.svg"),
  gutterIconSize: "contain",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const blockDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255, 215, 0, 0.15)", // subtle yellow
  isWholeLine: true,
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

function updateDecorations(editor) {
  if (!editor) return;

  const uri = editor.document.uri.toString();

  const startDecorations = [];
  const endDecorations = [];
  const blockDecorations = [];

  getFlags()
    .filter((f) => f.uri === uri)
    .forEach((f) => {
      const startLine = f.range.start.line;
      const endLine = f.range.end.line;

      // START
      startDecorations.push({
        range: new vscode.Range(startLine, 0, startLine, 0),
      });

      // END (if different)
      if (endLine !== startLine) {
        endDecorations.push({
          range: new vscode.Range(endLine, 0, endLine, 0),
        });
      }

      // BLOCK (highlight flagged block)
      blockDecorations.push({
        range: new vscode.Range(
          startLine,
          0,
          endLine,
          editor.document.lineAt(endLine).range.end.character,
        ),
      });
    });

  editor.setDecorations(startDecoration, startDecorations);
  editor.setDecorations(endDecoration, endDecorations);
  editor.setDecorations(blockDecoration, blockDecorations);
}

module.exports = {
  updateDecorations,
};
