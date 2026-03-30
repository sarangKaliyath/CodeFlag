const vscode = require("vscode");

let flags = [];

function getFlags() {
  return flags;
}

function addFlag(uri, line) {
  const range = new vscode.Range(line, 0, line, 0);
  flags.push({ uri, range });
}

function removeFlag(index) {
  flags.splice(index, 1);
}

module.exports = {
  getFlags,
  addFlag,
  removeFlag,
};