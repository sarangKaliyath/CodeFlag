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

function getFlags() {
  return flags;
}

/**
 * Add a flag using start + end
 */
function addFlag(uri, startLine, endLine) {
  flags.push({
    uri,
    startLine,
    endLine,
  });
}

/**
 * Remove by index
 */
function removeFlag(index) {
  flags.splice(index, 1);
}

/**
 * Remove flag by position
 */
function removeFlagAt(uri, line) {
  flags = flags.filter(
    (f) =>
      !(
        f.uri === uri &&
        line >= f.startLine &&
        line <= f.endLine
      )
  );
}

module.exports = {
  getFlags,
  addFlag,
  removeFlag,
  removeFlagAt, // optional but useful
};