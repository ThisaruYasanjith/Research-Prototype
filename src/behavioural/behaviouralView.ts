import * as vscode from 'vscode';

export class BehaviouralItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly detail: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon('pulse');
    this.command = {
      command: 'analyzer.showIssue',
      title: 'View Details',
      arguments: ['Behavioural', label, detail]
    };
  }
}

export class BehaviouralProvider implements vscode.TreeDataProvider<BehaviouralItem> {
  getTreeItem(element: BehaviouralItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<BehaviouralItem[]> {
    return Promise.resolve([
      new BehaviouralItem('Race Condition Risk', 'Shared variable updated without lock'),
      new BehaviouralItem('Resource Leak', 'FileInputStream not closed on exception')
    ]);
  }
}