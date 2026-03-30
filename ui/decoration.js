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

function updateDecorations(editor) {
  if (!editor) return;

  const uri = editor.document.uri.toString();

  const decorations = getFlags()
    .filter((f) => f.uri === uri)
    .map((f) => ({
      range: f.range,
    }));

  editor.setDecorations(decorationType, decorations);
}

module.exports = {
	updateDecorations
};