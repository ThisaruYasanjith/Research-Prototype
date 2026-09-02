import * as vscode from 'vscode';
import { FileDetector } from './fileDetector';
import { HtmlTemplates } from './htmlTemplates';

export class RuntimePanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static disposables: vscode.Disposable[] = [];

  public static show(context: vscode.ExtensionContext) {
    if (RuntimePanel.currentPanel) {
      RuntimePanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      RuntimePanel.updateContent();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'runtimePanel',
      'Exception Analysis',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    RuntimePanel.currentPanel = panel;

    // Trigger update when switching active tabs
    vscode.window.onDidChangeActiveTextEditor(() => {
      RuntimePanel.updateContent();
    }, null, RuntimePanel.disposables);

    // Trigger update when split panes/visible tabs change
    vscode.window.onDidChangeVisibleTextEditors(() => {
      RuntimePanel.updateContent();
    }, null, RuntimePanel.disposables);

    panel.onDidDispose(() => {
      RuntimePanel.currentPanel = undefined;
      RuntimePanel.disposables.forEach(d => d.dispose());
      RuntimePanel.disposables = [];
    });

    RuntimePanel.updateContent();
  }

  private static updateContent() {
    if (!RuntimePanel.currentPanel) {
      return;
    }

    const result = FileDetector.getActiveFileProcessor();
    
    if (result.detected) {
      RuntimePanel.currentPanel.webview.html = HtmlTemplates.getAnalysisHtml(result.targetInfo);
    } else {
      RuntimePanel.currentPanel.webview.html = HtmlTemplates.getNotFoundHtml();
    }
  }
}