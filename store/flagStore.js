const vscode = require("vscode");
const path = require("path");

/**
 * In-memory list of all flags across all files, branches, and workspaces.
 * Each flag is scoped by workspace, git repo root, and branch so flags don't
 * bleed across different contexts.
 *
 * Flag shape:
 * {
 *   uri:       string          — absolute URI string of the flagged file
 *   range:     vscode.Range    — the highlighted selection (start/end Position)
 *   label:     string          — optional user-provided label for the flag
 *   repoRoot:  string          — absolute path to the git repo root (or "__no_repo__")
 *   branch:    string          — active git branch name (or "__no_branch__" / "__detached__")
 *   workspace: string          — basename of the first workspace folder (or "__no_workspace__")
 * }
 */
let flags = [];

/** VS Code workspace state, set once during initialization. Used to persist flags across sessions. */
let workspaceState = null;

/** Key under which all flags are stored in workspaceState. */
const STORAGE_KEY = "codeflags";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Must be called once at extension activation (inside `activate(context)`).
 * Wires up the persistence layer and loads any previously saved flags.
 *
 * @param {vscode.ExtensionContext} context
 */
function initialStore(context) {
  workspaceState = context.workspaceState;
  // Uncomment the line below to wipe all saved flags on every activation (useful during development):
  // workspaceState.update(STORAGE_KEY, []);
  loadFlags();
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Returns only the flags that belong to the currently active editor's context
 * (same workspace, repo root, and branch). Returns an empty array if no editor
 * is open.
 *
 * @returns {any[]} Filtered subset of `flags`
 */
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

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Adds a new flag to the in-memory list and persists it immediately.
 * The git context (workspace, repo root, branch) is resolved automatically
 * from the provided URI.
 *
 * @param {string}       uri   - Absolute URI string of the file being flagged
 * @param {vscode.Range} range - The selected range to flag
 * @param {string}       label - Optional human-readable label (defaults to "")
 */
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
 * Removes a flag identified by its position in `visibleFlags` (the filtered,
 * currently visible list) rather than by its raw index in the global `flags`
 * array. This prevents index mismatches when flags from other contexts are
 * present in memory.
 *
 * @param {number} index        - Index within the visible (filtered) flag list
 * @param {any[]} visibleFlags - The subset of flags currently shown to the user
 */
function removeFlag(index, visibleFlags) {
  const target = visibleFlags[index];

  // Find the matching entry in the global array by comparing identity fields.
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
 * Updates the label of an existing flag. Uses the same visible-to-real-index
 * lookup as `removeFlag` to stay in sync with filtered views.
 *
 * @param {number} index        - Index within the visible (filtered) flag list
 * @param {string} label        - New label to assign
 * @param {any[]}  visibleFlags - The subset of flags currently shown to the user
 */
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

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Serializes the in-memory `flags` array into a plain JSON-safe structure and
 * writes it to VS Code's workspaceState. Called automatically after every
 * mutation (add, remove, label update).
 *
 * `vscode.Range` / `vscode.Position` objects are not JSON-serializable, so
 * start/end are stored as `{ line, character }` pairs and reconstructed in
 * `loadFlags`.
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

/**
 * Returns true if `n` is a non-negative finite number. Used to validate
 * line/character values loaded from storage before reconstructing Positions.
 *
 * @param {*} n
 * @returns {boolean}
 */
function isValidNumber(n) {
  return typeof n === "number" && !isNaN(n) && n >= 0;
}

/**
 * Reads flags from workspaceState and populates the in-memory `flags` array.
 * Invalid or incomplete entries are silently dropped to guard against
 * corruption (e.g. manually edited state, version mismatches).
 *
 * Reconstructs `vscode.Range` objects from the serialized `start`/`end` pairs.
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

      repoRoot: f.repoRoot || "__no_repo__",
      branch: f.branch || "__no_branch__",
      workspace: f.workspace || "__no_workspace__",
    }));
}

// ---------------------------------------------------------------------------
// Git / workspace context helpers
// ---------------------------------------------------------------------------

/**
 * Lazily activates the built-in `vscode.git` extension (if present) and
 * returns its public API at version 1. Returns null if git is unavailable.
 *
 * @returns {Promise<any | null>}
 */
async function getGitApi() {
  const ext = vscode.extensions.getExtension("vscode.git");

  if (!ext) return null;

  if (!ext.isActive) {
    await ext.activate();
  }

  return ext.exports.getAPI(1);
}

/**
 * Synchronously finds the git repository that contains the given URI by
 * matching against all known repository root paths. Returns null if git is
 * unavailable or if the file is outside any known repo.
 *
 * @param {vscode.Uri} uri
 * @returns {any | null}
 */
function getRepoForUri(uri) {
  const ext = vscode.extensions.getExtension("vscode.git");

  if (!ext || !ext.isActive) return null;

  const api = ext.exports.getAPI(1);

  return api.repositories.find((repo) =>
    uri.fsPath.startsWith(repo.rootUri.fsPath)
  );
}

/**
 * Extracts the current branch name from a repository object.
 * Falls back to sentinel strings when HEAD is unavailable (e.g. detached HEAD
 * state) so callers never have to deal with null/undefined.
 *
 * @param {any | null} repo
 * @returns {string}
 */
function getBranchForRepo(repo) {
  if (!repo || !repo.state.HEAD) return "__no_branch__";
  return repo.state.HEAD.name || "__detached__";
}

/**
 * Returns a stable key that identifies the current VS Code workspace. Uses the
 * basename of the first workspace folder so it remains readable in storage.
 * Falls back to a sentinel string when no workspace is open.
 *
 * @returns {string}
 */
function getWorkspaceKey() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return "__no_workspace__";

  return path.basename(folder.uri.fsPath);
}

/**
 * Builds the full context object (workspace + repoRoot + branch) for a given
 * URI string. This is the single source of truth used when adding or filtering
 * flags so that every flag is correctly scoped to its originating context.
 *
 * @param {string} uriString - Absolute URI string (e.g. from `document.uri.toString()`)
 * @returns {{ workspace: string, repoRoot: string, branch: string }}
 */
function getContextForUri(uriString) {
  const uri = vscode.Uri.parse(uriString);

  const repo = getRepoForUri(uri);

  return {
    workspace: getWorkspaceKey(),
    repoRoot: repo?.rootUri.fsPath || "__no_repo__",
    branch: getBranchForRepo(repo),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

module.exports = {
  getFlags,
  addFlag,
  removeFlag,
  initialStore,
  updateFlagLabel
};
