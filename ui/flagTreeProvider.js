const vscode = require("vscode");
const path = require("path");
const { getFlags } = require("../store/flagStore");

class FlagTreeDataProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    const flags = getFlags();

    if (!element) {
      // Group by file
      const fileMap = new Map();

      flags.forEach((f) => {
        if (!fileMap.has(f.uri)) {
          fileMap.set(f.uri, []);
        }
        fileMap.get(f.uri).push(f);
      });

      return Array.from(fileMap.entries()).map(
        ([uri, flags]) => new FileItem(uri, flags),
      );
    }

    if (element instanceof FileItem) {
      const sortedFlags = [...element.flags].sort(
        (a, b) => a.range.start.line - b.range.start.line,
      );

      const activeEditor = vscode.window.activeTextEditor;
      const activeLine = activeEditor?.selection.active.line;
      const activeUri = activeEditor?.document.uri.toString();

      return Promise.all(
        sortedFlags.map(async (flag) => {
          let doc = vscode.workspace.textDocuments.find(
            (d) => d.uri.toString() === flag.uri,
          );

          // If not open → load it
          if (!doc) {
            try {
              doc = await vscode.workspace.openTextDocument(
                vscode.Uri.parse(flag.uri),
              );
            } catch (e) {
              return new FlagItem(flag, "");
            }
          }

          let preview = "";
          let fullText = "";

          try {
            const start = flag.range.start.line;
            const end = flag.range.end.line;

            const lines = [];

            for (let i = start; i <= end; i++) {
              lines.push(doc.lineAt(i).text);
            }

            fullText = lines.join("\n");

            // keep preview short (first line)
            preview = lines[0].trim().substring(0, 80);
          } catch (e) {
            preview = "";
            fullText = "";
          }

          const isActive =
            flag.uri === activeUri &&
            activeLine >= flag.range.start.line &&
            activeLine <= flag.range.end.line;

          return new FlagItem(flag, fullText, preview, isActive);
        }),
      );
    }

    return [];
  }
}

// File node
class FileItem extends vscode.TreeItem {
  constructor(uri, flags) {
    const filePath = vscode.Uri.parse(uri).fsPath;
    const label = vscode.workspace.asRelativePath(filePath);

    super(label, vscode.TreeItemCollapsibleState.Expanded);

    this.uri = uri;
    this.flags = flags;
    this.contextValue = "file";

    this.description = `(${flags.length})`;

    // Use VS Code's built-in file icon
    this.resourceUri = vscode.Uri.file(filePath);
  }
}

// Flag node
class FlagItem extends vscode.TreeItem {
  constructor(flag, fullText, preview, isActive) {
    const line = flag.range.start.line + 1;

    super(`Line ${line}`, vscode.TreeItemCollapsibleState.None);

    this.id = `${flag.uri}:${flag.range.start.line}-${flag.range.end.line}`;

    this.flag = flag;

    this.command = {
      command: "codeflag.revealLine",
      title: "Reveal Line",
      arguments: [flag],
    };

    this.contextValue = "flag";

    this.description = preview;

    //Custom icon
    this.iconPath = new vscode.ThemeIcon("flag");

    if (isActive) {
      this.description = `👉 ${preview}`;
    }

    if (fullText) {
      const md = new vscode.MarkdownString();

      // optional: dynamic language
      const lang = flag.language || "javascript";

      md.appendCodeblock(fullText, lang);

      this.tooltip = md;
    }
  }
}

module.exports = { FlagTreeDataProvider };
