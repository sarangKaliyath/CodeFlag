/**
 * @file decoration.js
 * @description Manages VS Code editor decorations for flagged code regions.
 *
 * This module is responsible for visually highlighting flagged code blocks
 * in the editor. It creates three types of decorations:
 *   1. A flag icon in the gutter at the START line of a flagged range.
 *   2. An end icon in the gutter at the END line of a flagged range.
 *   3. A subtle yellow background highlight across all lines in the flagged range.
 *
 * The `updateDecorations` function is called whenever the active editor changes
 * or the flag store is modified, ensuring the visuals stay in sync.
 */

const vscode = require("vscode");
const path = require("path");
const { getFlags } = require("../store/flagStore");

/**
 * Decoration type for the START of a flagged range.
 * Renders a flag SVG icon in the editor gutter at the first line of the flag.
 *
 * @type {vscode.TextEditorDecorationType}
 */
const startDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: path.join(__dirname, "../flag.svg"),
  gutterIconSize: "contain",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

/**
 * Decoration type for the END of a flagged range.
 * Renders an end SVG icon in the editor gutter at the last line of the flag.
 * Only applied when the end line differs from the start line (multi-line flags).
 *
 * @type {vscode.TextEditorDecorationType}
 */
const endDecoration = vscode.window.createTextEditorDecorationType({
  gutterIconPath: path.join(__dirname, "../end.svg"),
  gutterIconSize: "contain",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

/**
 * Decoration type for the full BLOCK of a flagged range.
 * Applies a subtle yellow background color to every line within the flag's range,
 * making the flagged code block visually distinct in the editor.
 *
 * @type {vscode.TextEditorDecorationType}
 */
const blockDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255, 215, 0, 0.15)", // subtle yellow
  isWholeLine: true,
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

/**
 * Updates all decorations (gutter icons + block highlight) for the given editor.
 *
 * This function:
 *   1. Reads all flags from the store.
 *   2. Filters to only those belonging to the currently active document (matched by URI).
 *   3. For each matching flag:
 *      - Adds a start gutter icon on the first line.
 *      - Adds an end gutter icon on the last line (if different from the first).
 *      - Adds a full-line background highlight across the entire flagged range.
 *   4. Applies all decoration arrays to the editor in a single pass.
 *
 * Called whenever:
 *   - The active text editor changes.
 *   - A flag is added, removed, or modified.
 *
 * @param {vscode.TextEditor | undefined} editor - The active text editor to decorate.
 *   If `undefined` or `null`, the function exits early with no changes.
 */
function updateDecorations(editor) {
  if (!editor) return;

  // Get the URI string of the currently open document to match against stored flags
  const uri = editor.document.uri.toString();

  // Accumulate decoration ranges for each of the three decoration types
  /** @type {vscode.DecorationOptions[]} */
  const startDecorations = [];
  /** @type {vscode.DecorationOptions[]} */
  const endDecorations = [];
  /** @type {vscode.DecorationOptions[]} */
  const blockDecorations = [];

  getFlags()
    .filter((f) => f.uri === uri) // Only process flags that belong to this file
    .forEach((f) => {
      const startLine = f.range.start.line;
      const endLine = f.range.end.line;

      // START: Place the flag gutter icon at the beginning of the flagged range
      startDecorations.push({
        range: new vscode.Range(startLine, 0, startLine, 0),
      });

      // END (if different): Place the end gutter icon only for multi-line flags
      if (endLine !== startLine) {
        endDecorations.push({
          range: new vscode.Range(endLine, 0, endLine, 0),
        });
      }

      // BLOCK: Highlight the entire flagged range with a background color
      // The range spans from the start of the first line to the end of the last line
      blockDecorations.push({
        range: new vscode.Range(
          startLine,
          0,
          endLine,
          editor.document.lineAt(endLine).range.end.character,
        ),
      });
    });

  // Apply all three decoration sets to the editor
  editor.setDecorations(startDecoration, startDecorations);
  editor.setDecorations(endDecoration, endDecorations);
  editor.setDecorations(blockDecoration, blockDecorations);
}

module.exports = {
  updateDecorations,
};
