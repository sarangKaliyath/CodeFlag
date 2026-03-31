const vscode = require("vscode");

let flags = [];

/**
 * Shape:
 * {
 *   uri: string,
 *   startLine: number,
 *   endLine: number
 * }
 */

let workspaceState = null;

const STORAGE_KEY = "codeflags";

/**
 * Initialize store with VS Code context
 */
function initialStore(context) {
  workspaceState = context.workspaceState;
  // workspaceState.update(STORAGE_KEY, []);
  loadFlags();
}

function getFlags() {
  return flags;
}

/**
 * Add a flag using start + end
 */
function addFlag(uri, range, label = "") {
  flags.push({ uri, range, label});
  saveFlags();
}

/**
 * Remove by index
 */
function removeFlag(index) {
  flags.splice(index, 1);
  saveFlags();
}

/**
 * Save flags (serialize Range)
 */
function saveFlags() {
  if (!workspaceState) return;

  const serializable = flags.map((f) => ({
    uri: f.uri,
    start: {
      line: f.range.start.line,
      character: f.range.start.character,
    },
    end: {
      line: f.range.end.line,
      character: f.range.end.character,
    },
    label: f.label || "",
  }));

  workspaceState.update(STORAGE_KEY, serializable);
}

function isValidNumber(n) {
  return typeof n === "number" && !isNaN(n) && n >= 0;
}
/**
 * Load flags (recreate Range)
 */

function loadFlags() {
  if (!workspaceState) return;

  const stored = workspaceState.get(STORAGE_KEY, []);

  flags = stored
    .filter((f) =>
      f &&
      f.uri &&
      f.start &&
      f.end &&
      isValidNumber(f.start.line) &&
      isValidNumber(f.start.character) &&
      isValidNumber(f.end.line) &&
      isValidNumber(f.end.character)
    )
    .map((f) => ({
      uri: f.uri,
      range: new vscode.Range(
        new vscode.Position(f.start.line, f.start.character),
        new vscode.Position(f.end.line, f.end.character)
      ),
      label: f.label || "",
    }));
}


module.exports = {
  getFlags,
  addFlag,
  removeFlag,
  initialStore
};