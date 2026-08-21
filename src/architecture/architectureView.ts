import * as vscode from 'vscode';

export class ArchitectureItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly detail: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon('type-hierarchy');
    this.command = {
      command: 'analyzer.showIssue',
      title: 'View Details',
      arguments: ['Architecture', label, detail]
    };
  }
}

export class ArchitectureProvider implements vscode.TreeDataProvider<ArchitectureItem> {
  getTreeItem(element: ArchitectureItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<ArchitectureItem[]> {
    return Promise.resolve([
      new ArchitectureItem('Circular Dependency Detected', 'OrderService <-> PaymentService'),
      new ArchitectureItem('Layering Violation', 'Direct DB access in UserController')
    ]);
  }
}