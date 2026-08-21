import * as vscode from 'vscode';
import { ArchitectureProvider } from './architecture/architectureView';
import { CodeQualityProvider } from './codeQuality/codeQualityView';
import { BehaviouralProvider } from './behavioural/behaviouralView';
import { RuntimeProvider } from './runtime/runtimeView';

export function activate(context: vscode.ExtensionContext) {
  // 1. Register Tree Views for all 4 modules
  vscode.window.registerTreeDataProvider('analyzer.architectureView', new ArchitectureProvider());
  vscode.window.registerTreeDataProvider('analyzer.codeQualityView', new CodeQualityProvider());
  vscode.window.registerTreeDataProvider('analyzer.behaviouralView', new BehaviouralProvider());
  vscode.window.registerTreeDataProvider('analyzer.runtimeView', new RuntimeProvider());

  // 2. Global click action when an item is selected
  context.subscriptions.push(
    vscode.commands.registerCommand('analyzer.showIssue', (category: string, title: string, detail: string) => {
      vscode.window.showInformationMessage(`[${category}] ${title}: ${detail}`);
    })
  );
}

export function deactivate() {}