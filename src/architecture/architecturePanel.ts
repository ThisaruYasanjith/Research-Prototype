import * as vscode from 'vscode';
import { scanArchitectureWorkspace } from './architectureAnalyzer';
import { evaluateChatRule } from './architectureRuleService';
import { ArchitectureWebviewMessage } from './architectureTypes';
import { getArchitectureWebviewHtml } from './architectureWebview';

export class ArchitecturePanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static diagnostics: vscode.DiagnosticCollection | undefined;
  private static watcherDisposables: vscode.Disposable[] = [];

  // Demo-session state changed when the user confirms a conflicting rule.
  private static controllerRepositoryAllowed = false;

  public static show(context: vscode.ExtensionContext): void {
    if (ArchitecturePanel.currentPanel) {
      ArchitecturePanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      void ArchitecturePanel.scanWorkspace();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'architecturePanel',
      'Architecture Governance',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    ArchitecturePanel.currentPanel = panel;

    ArchitecturePanel.diagnostics ??=
      vscode.languages.createDiagnosticCollection('architecture-governance');

    context.subscriptions.push(ArchitecturePanel.diagnostics);

    panel.webview.html = getArchitectureWebviewHtml();

    ArchitecturePanel.registerWebviewMessages(panel);
    ArchitecturePanel.registerWorkspaceWatchers();

    panel.onDidDispose(() => {
      ArchitecturePanel.currentPanel = undefined;

      ArchitecturePanel.watcherDisposables.forEach((item) => item.dispose());
      ArchitecturePanel.watcherDisposables = [];

      ArchitecturePanel.diagnostics?.clear();
    });

    void ArchitecturePanel.scanWorkspace();
  }

  private static registerWebviewMessages(panel: vscode.WebviewPanel): void {
    panel.webview.onDidReceiveMessage(
      async (message: ArchitectureWebviewMessage) => {
        switch (message.type) {
          case 'ready':
          case 'refresh':
            await ArchitecturePanel.scanWorkspace();
            break;

          case 'openFile':
            if (message.file) {
              await ArchitecturePanel.openFile(message.file, message.line ?? 0);
            }
            break;

          case 'checkChatRule':
            await ArchitecturePanel.handleChatRule(
              panel,
              (message.text ?? '').trim()
            );
            break;

          case 'applyConflictRule':
            ArchitecturePanel.controllerRepositoryAllowed = true;

            await panel.webview.postMessage({
              type: 'conflictRuleApplied',
              allowed: true
            });

            await ArchitecturePanel.scanWorkspace();
            break;

          case 'cancelConflictRule':
            await panel.webview.postMessage({
              type: 'conflictRuleCancelled'
            });
            break;
        }
      }
    );
  }

  private static async handleChatRule(
    panel: vscode.WebviewPanel,
    ruleText: string
  ): Promise<void> {
    const result = evaluateChatRule(ruleText);

    if (result.hasConflict) {
      await panel.webview.postMessage({
        type: 'conflictRuleDetected',
        originalText: ruleText,
        conflictMessage: result.conflictMessage
      });
      return;
    }

    await panel.webview.postMessage({
      type: 'normalChatRule',
      originalText: ruleText
    });
  }

  private static registerWorkspaceWatchers(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/src/main/java/**/*.java'
    );

    const onChange = (): void => {
      void ArchitecturePanel.scanWorkspace();
    };

    ArchitecturePanel.watcherDisposables = [
      watcher,
      watcher.onDidCreate(onChange),
      watcher.onDidChange(onChange),
      watcher.onDidDelete(onChange),
      vscode.workspace.onDidSaveTextDocument(
        (document: vscode.TextDocument) => {
          if (document.languageId === 'java') {
            void ArchitecturePanel.scanWorkspace();
          }
        }
      )
    ];
  }

  private static async scanWorkspace(): Promise<void> {
    const panel = ArchitecturePanel.currentPanel;
    const diagnostics = ArchitecturePanel.diagnostics;

    if (!panel || !diagnostics) {
      return;
    }

    const result = await scanArchitectureWorkspace(
      diagnostics,
      ArchitecturePanel.controllerRepositoryAllowed
    );

    await panel.webview.postMessage({
      type: 'violations',
      violations: result.violations,
      workspaceMissing: result.workspaceMissing
    });
  }

  private static async openFile(
    filePath: string,
    line: number
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.file(filePath)
      );

      const editor = await vscode.window.showTextDocument(
        document,
        vscode.ViewColumn.One
      );

      const position = new vscode.Position(Math.max(0, line), 0);

      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    } catch {
      void vscode.window.showWarningMessage(
        'Could not open the source file for this violation.'
      );
    }
  }
}
