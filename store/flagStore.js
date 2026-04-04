const vscode = require("vscode");
const path = require("path");

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
  const editor = vscode.window.activeTextEditor;
  if (!editor) return [];

  const context = getContextForUri(editor.document.uri.toString());

  return flags.filter(
    (f) =>
      f.workspace === context.workspace &&
      f.repoRoot === context.repoRoot &&
      f.branch === context.branch
  );
}

function addFlag(uri, range, label = "") {
  const context = getContextForUri(uri);

  flags.push({
    uri,
    range,
    label,
    repoRoot: context.repoRoot,
    branch: context.branch,
    workspace: context.workspace,
  });

  saveFlags();
}
/**
 * Remove by index
 */
function removeFlag(index, visibleFlags) {
  const target = visibleFlags[index];

  const realIndex = flags.findIndex(
    (f) =>
      f.uri === target.uri &&
      f.range.start.line === target.range.start.line &&
      f.range.end.line === target.range.end.line &&
      f.branch === target.branch &&
      f.repoRoot === target.repoRoot
  );

  if (realIndex >= 0) {
    flags.splice(realIndex, 1);
    saveFlags();
  }
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

    repoRoot: f.repoRoot || "__no_repo__",
    branch: f.branch || "__no_branch__",
    workspace: f.workspace || "__no_workspace__",
  }));

  workspaceState.update(STORAGE_KEY, serializable);
}

function isValidNumber(n) {
  return typeof n === "number" && !isNaN(n) && n >= 0;
}

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

      repoRoot: f.repoRoot || "__no_repo__",
      branch: f.branch || "__no_branch__",
      workspace: f.workspace || "__no_workspace__",
    }));
}

function updateFlagLabel(index, label, visibleFlags) {
  const target = visibleFlags[index];

  const realIndex = flags.findIndex(
    (f) =>
      f.uri === target.uri &&
      f.range.start.line === target.range.start.line &&
      f.range.end.line === target.range.end.line &&
      f.branch === target.branch &&
      f.repoRoot === target.repoRoot
  );

  if (realIndex >= 0) {
    flags[realIndex].label = label;
    saveFlags();
  }
}

async function getGitApi() {
  const ext = vscode.extensions.getExtension("vscode.git");

  if (!ext) return null;

  if (!ext.isActive) {
    await ext.activate();
  }

  return ext.exports.getAPI(1);
}

function getRepoForUri(uri) {
  const ext = vscode.extensions.getExtension("vscode.git");

  if (!ext || !ext.isActive) return null;

  const api = ext.exports.getAPI(1);

  return api.repositories.find((repo) =>
    uri.fsPath.startsWith(repo.rootUri.fsPath)
  );
}

function getBranchForRepo(repo) {
  if (!repo || !repo.state.HEAD) return "__no_branch__";
  return repo.state.HEAD.name || "__detached__";
}

function getWorkspaceKey() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return "__no_workspace__";

  return path.basename(folder.uri.fsPath);
}

function getContextForUri(uriString) {
  const uri = vscode.Uri.parse(uriString);

  const repo = getRepoForUri(uri);

  return {
    workspace: getWorkspaceKey(),
    repoRoot: repo?.rootUri.fsPath || "__no_repo__",
    branch: getBranchForRepo(repo),
  };
}

module.exports = {
  getFlags,
  addFlag,
  removeFlag,
  initialStore,
  updateFlagLabel
};