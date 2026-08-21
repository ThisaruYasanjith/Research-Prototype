import * as vscode from 'vscode';

export class RuntimeItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly detail: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon('bug');
    this.command = {
      command: 'analyzer.showIssue',
      title: 'View Details',
      arguments: ['Runtime', label, detail]
    };
  }
}

export class RuntimeProvider implements vscode.TreeDataProvider<RuntimeItem> {
  getTreeItem(element: RuntimeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<RuntimeItem[]> {
    return Promise.resolve([
      new RuntimeItem('NullPointerException Risk', 'Object dereferenced before null check'),
      new RuntimeItem('ArrayIndexOutOfBounds', 'Unsafe array access on line 42')
    ]);
  }
}