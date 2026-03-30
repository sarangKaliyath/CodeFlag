const vscode = require('vscode');
const path = require('path');
const { getFlags } = require('../store/flagStore');

const decorationType = vscode.window.createTextEditorDecorationType({
	gutterIconPath: path.join(__dirname, '../flag.svg'),
	gutterIconSize: 'contain'
});

function updateDecorations(editor) {
	if (!editor) return;

	const uri = editor.document.uri.toString();

	const ranges = getFlags()
		.filter(b => b.uri === uri)
		.map(b => new vscode.Range(b.line, 0, b.line, 0));

	editor.setDecorations(decorationType, ranges);
}

module.exports = {
	updateDecorations
};