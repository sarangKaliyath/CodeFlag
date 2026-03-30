const vscode = require('vscode');
const path = require('path');
const { getFlags } = require('../store/flagStore');

const decorationType = vscode.window.createTextEditorDecorationType({
	gutterIconPath: path.join(__dirname, '../flag.svg'),
	gutterIconSize: 'contain',
    // Preventing flagging multiple lines, when clicking on enter
    // at start of the flagged code.
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
});

const startDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: path.join(__dirname, '../flag.svg'),
  gutterIconSize: 'contain',
});

const endDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: path.join(__dirname, '../end.svg'),
  gutterIconSize: 'contain',
});

function updateDecorations(editor) {
  if (!editor) return;

  const uri = editor.document.uri.toString();

  const startDecorations = [];
  const endDecorations = [];

  getFlags()
    .filter((f) => f.uri === uri)
    .forEach((f) => {
      // START marker
      startDecorations.push({
        range: new vscode.Range(f.startLine, 0, f.startLine, 0),
      });

      // END marker (only if different)
      if (f.endLine !== f.startLine) {
        endDecorations.push({
          range: new vscode.Range(f.endLine, 0, f.endLine, 0),
        });
      }
    });

  editor.setDecorations(startDecoration, startDecorations);
  editor.setDecorations(endDecoration, endDecorations);
}

module.exports = {
	updateDecorations
};