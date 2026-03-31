const vscode = require("vscode");
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

  getChildren(element) {
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
      return element.flags.map((flag) => new FlagItem(flag));
    }

    return [];
  }
}

// File node
class FileItem extends vscode.TreeItem {
  constructor(uri, flags) {
    const label = vscode.workspace.asRelativePath(vscode.Uri.parse(uri));
    super(label, vscode.TreeItemCollapsibleState.Expanded);

    this.uri = uri;
    this.flags = flags;
    this.contextValue = "file";
  }
}

// Flag node
class FlagItem extends vscode.TreeItem {
  constructor(flag) {
    const line = flag.range.start.line + 1;

    super(`Line ${line}`, vscode.TreeItemCollapsibleState.None);

    this.flag = flag;

    this.command = {
      command: "codeflag.revealLine",
      title: "Reveal Line",
      arguments: [flag],
    };

    this.contextValue = "flag";
  }
}

module.exports = { FlagTreeDataProvider };
