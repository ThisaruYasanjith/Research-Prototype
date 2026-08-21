import * as vscode from 'vscode';

export class CodeQualityItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly detail: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon('checklist');
    this.command = {
      command: 'analyzer.showIssue',
      title: 'View Details',
      arguments: ['Code Quality', label, detail]
    };
  }
}

export class CodeQualityProvider implements vscode.TreeDataProvider<CodeQualityItem> {
  getTreeItem(element: CodeQualityItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<CodeQualityItem[]> {
    return Promise.resolve([
      new CodeQualityItem('High Cognitive Complexity (22)', 'Method: calculateDiscount()'),
      new CodeQualityItem('Unused Private Method', 'Helper: sanitizeInput()')
    ]);
  }
}