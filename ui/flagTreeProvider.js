/**
 * @file flagTreeProvider.js
 * @description Provides the data model for the "CodeFlag" sidebar tree view.
 *
 * This module implements VS Code's `TreeDataProvider` interface to populate
 * the CodeFlag panel in the Explorer sidebar. The tree is two levels deep:
 *
 *   Level 1 — FileItem:  One node per file that contains at least one flag.
 *                         Shows the workspace-relative file path and flag count.
 *   Level 2 — FlagItem:  One node per flag within that file, sorted by line number.
 *                         Shows the line range, an optional label, a short preview,
 *                         and a full code-block tooltip on hover.
 *
 * Clicking a FlagItem fires the `codeflag.revealLine` command, which navigates
 * the editor to that flag's location.
 */

const vscode = require("vscode");
const path = require("path");
const { getFlags } = require("../store/flagStore");

/**
 * @typedef {object} Flag
 * @property {string} uri - String-form URI of the file this flag belongs to.
 * @property {{ start: { line: number }, end: { line: number } }} range - The flagged line range.
 * @property {string} [label] - Optional user-defined label for the flag.
 * @property {string} [language] - Optional language ID for tooltip syntax highlighting.
 */

/**
 * Tree data provider for the CodeFlag sidebar panel.
 *
 * Implements `vscode.TreeDataProvider<FileItem | FlagItem>` so VS Code knows
 * how to render and refresh the flag tree.
 *
 * Typical lifecycle:
 *   1. Extension registers this provider via `vscode.window.createTreeView`.
 *   2. Whenever flags change, the extension calls `provider.refresh()`.
 *   3. VS Code re-invokes `getChildren` to re-render the tree.
 */
class FlagTreeDataProvider {
  constructor() {
    /**
     * Internal event emitter used to signal VS Code that the tree data
     * has changed and the view should be re-rendered.
     *
     * @private
     * @type {vscode.EventEmitter<void>}
     */
    this._onDidChangeTreeData = new vscode.EventEmitter();

    /**
     * Public event that VS Code subscribes to in order to know when to
     * refresh the tree view. Exposed as required by the TreeDataProvider interface.
     *
     * @type {vscode.Event<void>}
     */
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  /**
   * Triggers a full refresh of the tree view.
   * Call this whenever the underlying flag store changes (flag added/removed/updated).
   */
  refresh() {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Returns the tree item representation for a given element.
   * Required by the `TreeDataProvider` interface.
   * Since `FileItem` and `FlagItem` already extend `vscode.TreeItem`,
   * we can return them as-is.
   *
   * @param {FileItem | FlagItem} element - The tree node to render.
   * @returns {vscode.TreeItem} The same element, used directly as a tree node.
   */
  getTreeItem(element) {
    return element;
  }

  /**
   * Returns the child nodes for a given tree element.
   * This is called by VS Code to build each level of the tree.
   *
   * - If `element` is `undefined` (i.e., root level), returns one `FileItem` per
   *   unique file URI found in the flag store, grouping flags by file.
   * - If `element` is a `FileItem`, returns a sorted list of `FlagItem` nodes
   *   for that file, with code previews loaded from the document.
   * - Otherwise returns an empty array (leaf nodes have no children).
   *
   * @param {FileItem | FlagItem | undefined} element - The parent node, or
   *   `undefined` when VS Code is requesting the root-level nodes.
   * @returns {Promise<FileItem[] | FlagItem[]>}
   */
  async getChildren(element) {
    const flags = /** @type {Flag[]} */ (getFlags());

    if (!element) {
      // --- ROOT LEVEL: Group flags by file URI and return one FileItem per file ---

      const fileMap = new Map();

      flags.forEach((f) => {
        if (!fileMap.has(f.uri)) {
          fileMap.set(f.uri, []);
        }
        fileMap.get(f.uri).push(f);
      });

      // Convert the map to an array of FileItem tree nodes
      return Array.from(fileMap.entries()).map(
        ([uri, flags]) => new FileItem(uri, flags),
      );
    }

    if (element instanceof FileItem) {
      // --- FILE LEVEL: Return sorted FlagItems for a specific file ---

      // Sort flags top-to-bottom by their start line
      const sortedFlags = /** @type {Flag[]} */ ([...element.flags].sort(
        (a, b) => a.range.start.line - b.range.start.line,
      ));

      // Determine which flag (if any) contains the editor's current cursor position,
      // so we can mark that flag as "active" with a visual indicator
      const activeEditor = vscode.window.activeTextEditor;
      const activeLine = activeEditor?.selection.active.line;
      const activeUri = activeEditor?.document.uri.toString();

      return Promise.all(
        sortedFlags.map(async (flag) => {
          // Try to find an already-open document for this flag's URI
          let doc = vscode.workspace.textDocuments.find(
            (d) => d.uri.toString() === flag.uri,
          );

          // If not open in any editor, load it from disk without showing it
          if (!doc) {
            try {
              doc = await vscode.workspace.openTextDocument(
                vscode.Uri.parse(flag.uri),
              );
            } catch (e) {
              // If the file can't be opened (e.g. deleted), show the flag with no preview
              return new FlagItem(flag, "");
            }
          }

          let preview = "";
          let fullText = "";

          try {
            const start = flag.range.start.line;
            const end = flag.range.end.line;

            // Collect all lines within the flagged range
            const lines = [];

            for (let i = start; i <= end; i++) {
              lines.push(doc.lineAt(i).text);
            }

            // Full text is used for the hover tooltip code block
            fullText = lines.join("\n");

            // Preview is a trimmed snippet of the first line, capped at 80 characters
            preview = lines[0].trim().substring(0, 80);
          } catch (e) {
            preview = "";
            fullText = "";
          }

          // A flag is "active" if the cursor is currently within its line range
          const isActive =
            flag.uri === activeUri &&
            activeLine >= flag.range.start.line &&
            activeLine <= flag.range.end.line;

          return new FlagItem(flag, fullText, preview, isActive);
        }),
      );
    }

    // FlagItems are leaf nodes — they have no children
    return [];
  }
}

/**
 * Represents a file node in the flag tree (Level 1).
 *
 * Displays the workspace-relative file path as the label, with a badge
 * showing how many flags exist in that file. Uses VS Code's native file
 * icon theme for the node icon.
 *
 * @extends {vscode.TreeItem}
 */
class FileItem extends vscode.TreeItem {
  /**
   * @param {string} uri - The string-form URI of the file (e.g. `file:///path/to/file.js`).
   * @param {Flag[]} flags - All flag objects associated with this file.
   */
  constructor(uri, flags) {
    const filePath = vscode.Uri.parse(uri).fsPath;
    // Show a relative path (e.g. "src/index.js") instead of the full absolute path
    const label = vscode.workspace.asRelativePath(filePath);

    // File nodes start expanded so the user sees all flags immediately
    super(label, vscode.TreeItemCollapsibleState.Expanded);

    /** @type {string} The URI string used to match flags to this file. */
    this.uri = uri;

    /** @type {object[]} The flags belonging to this file. */
    this.flags = flags;

    /** Enables context menu contributions scoped to file nodes in package.json. */
    this.contextValue = "file";

    /** Shows the flag count next to the file name, e.g. "(3)". */
    this.description = `(${flags.length})`;

    /**
     * Providing `resourceUri` lets VS Code apply the correct file icon
     * from the active icon theme (e.g. a JS icon for .js files).
     */
    this.resourceUri = vscode.Uri.file(filePath);
  }
}

/**
 * Represents an individual flag node in the flag tree (Level 2).
 *
 * Displays the line range (and optional label) as the node label, with
 * a short code preview as the description. Hovering over the node shows
 * a Markdown tooltip containing the full flagged code block. Clicking
 * the node navigates the editor to the flagged line.
 *
 * @extends {vscode.TreeItem}
 */
class FlagItem extends vscode.TreeItem {
  /**
   * @param {Flag} flag - The flag data object from the store.
   * @param {string} fullText - The complete text of the flagged range (used for tooltip).
   * @param {string} [preview=""] - A short one-line preview shown as the node description.
   * @param {boolean} [isActive=false] - Whether the cursor is currently inside this flag's range.
   */
  constructor(flag, fullText, preview, isActive) {
    const line = flag.range.start.line + 1; // Convert 0-based to 1-based for display

    const start = flag.range.start.line + 1;
    const end = flag.range.end.line + 1;

    // Single-line flag → "Line 42", multi-line flag → "Lines 42-50"
    const baseLabel = start === end ? `Line ${start}` : `Lines ${start}-${end}`;

    // Prepend the optional user-defined label if present, e.g. "[TODO] Line 42"
    const label = flag.label ? `[${flag.label}] ${baseLabel}` : baseLabel;

    // Flag nodes are leaves — they cannot be expanded
    super(label, vscode.TreeItemCollapsibleState.None);

    /**
     * Unique ID for this tree item, based on file URI and line range.
     * Required to avoid stale tree item references after a refresh.
     */
    this.id = `${flag.uri}:${flag.range.start.line}-${flag.range.end.line}`;

    /** @type {object} Reference to the original flag object for use in commands. */
    this.flag = flag;

    /**
     * Clicking the node triggers `codeflag.revealLine`, which scrolls the
     * editor to the flagged range and highlights it.
     */
    this.command = {
      command: "codeflag.revealLine",
      title: "Reveal Line",
      arguments: [flag],
    };

    /** Enables context menu contributions scoped to flag nodes in package.json. */
    this.contextValue = "flag";

    /** Inline text shown to the right of the label — a short code snippet. */
    this.description = preview;

    /** Uses VS Code's built-in "flag" codicon for a consistent look. */
    this.iconPath = new vscode.ThemeIcon("flag");

    // If the cursor is inside this flag, prefix the preview with a pointer indicator
    if (isActive) {
      this.description = `👉 ${preview}`;
    }

    // Build a Markdown tooltip with a syntax-highlighted code block for hover previews
    if (fullText) {
      const md = new vscode.MarkdownString();

      // Use the flag's stored language for syntax highlighting, defaulting to JavaScript
      const lang = flag.language || "javascript";

      md.appendCodeblock(fullText, lang);

      this.tooltip = md;
    }
  }
}

module.exports = { FlagTreeDataProvider };
