import * as vscode from 'vscode';
import { MethodInfo, MethodState, AnalysisStep, SideEffectType, ImpactSeverity } from './types';
import { MethodDetector } from './methodDetector';
import { BehaviouralAnalyzer } from './behaviouralAnalyzer';

/**
 * Behavioural Analysis Webview Panel Controller.
 * 
 * Manages right-side webview panel, per-method analysis sessions,
 * VS Code editor cursor tracking, and inline diagnostic markers.
 * 
 * PROTOTYPE HARD-CODED LOGIC:
 * Inline comments specify integration points for:
 * 1. JavaParser / AST analysis (methodDetector.ts)
 * 2. Real side-effect fingerprinting (behaviouralAnalyzer.ts)
 * 3. Actual AST / CFG comparison engine (behaviouralAnalyzer.ts)
 * 4. Real LLM API integration (behaviouralAnalyzer.ts)
 */
export class BehaviouralPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static diagnosticCollection: vscode.DiagnosticCollection =
    vscode.languages.createDiagnosticCollection('behaviouralDrift');

  // Impact-specific editor decorations with warning gutter icons & colors
  private static highImpactDecorationType: vscode.TextEditorDecorationType =
    vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(241, 76, 76, 0.22)',
      border: '1px solid rgba(241, 76, 76, 0.6)',
      borderRadius: '3px',
      isWholeLine: true,
      overviewRulerColor: '#f14c4c',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      gutterIconPath: vscode.Uri.parse('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%23f14c4c" d="M7.56 1.76a1 1 0 0 1 1.76 0l6.23 10.8a1 1 0 0 1-.88 1.44H1.33a1 1 0 0 1-.88-1.44l6.23-10.8zM8 5a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 5zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>'),
      gutterIconSize: 'contain'
    });

  private static mediumImpactDecorationType: vscode.TextEditorDecorationType =
    vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(204, 167, 0, 0.22)',
      border: '1px solid rgba(204, 167, 0, 0.6)',
      borderRadius: '3px',
      isWholeLine: true,
      overviewRulerColor: '#cca700',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      gutterIconPath: vscode.Uri.parse('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%23cca700" d="M7.56 1.76a1 1 0 0 1 1.76 0l6.23 10.8a1 1 0 0 1-.88 1.44H1.33a1 1 0 0 1-.88-1.44l6.23-10.8zM8 5a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 5zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>'),
      gutterIconSize: 'contain'
    });

  private static lowImpactDecorationType: vscode.TextEditorDecorationType =
    vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(55, 148, 255, 0.22)',
      border: '1px solid rgba(55, 148, 255, 0.6)',
      borderRadius: '3px',
      isWholeLine: true,
      overviewRulerColor: '#3794ff',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      gutterIconPath: vscode.Uri.parse('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="%233794ff" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM6.75 8a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 .75.75v3.5h.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1 0-1.5h.5V8.5h-.5A.75.75 0 0 1 6.75 8z"/></svg>'),
      gutterIconSize: 'contain'
    });

  private static getDecorationTypeForImpact(impact?: ImpactSeverity): vscode.TextEditorDecorationType {
    if (impact === 'HIGH' || impact === 'CRITICAL') {
      return BehaviouralPanel.highImpactDecorationType;
    } else if (impact === 'MEDIUM') {
      return BehaviouralPanel.mediumImpactDecorationType;
    }
    return BehaviouralPanel.lowImpactDecorationType;
  }

  // Per-method baseline session state store keyed by method signature
  private static methodStates: Map<string, MethodState> = new Map();
  private static activeSignature: string | undefined;
  private static autoAnalysisTimer: NodeJS.Timeout | undefined;

  public static show(context: vscode.ExtensionContext) {
    if (BehaviouralPanel.currentPanel) {
      BehaviouralPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      BehaviouralPanel.refreshPanelFromEditor();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'behaviouralPanel',
      'Behavioural Details',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    BehaviouralPanel.currentPanel = panel;

    panel.onDidDispose(() => {
      BehaviouralPanel.currentPanel = undefined;
    });

    // Listen for Webview messages (e.g. Analyze Method, Analyze Again, Simulate Edit)
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'analyzeMethod':
            await BehaviouralPanel.handleAnalyzeMethod();
            break;
          case 'analyzeAgain':
            await BehaviouralPanel.handleAnalyzeAgain();
            break;
          case 'simulateEdit':
            await BehaviouralPanel.handleSimulateEdit();
            break;
          case 'resetBaseline':
            await BehaviouralPanel.handleResetBaseline();
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    // Track active editor selection/cursor movements to identify selected method
    context.subscriptions.push(
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (e.textEditor === vscode.window.activeTextEditor) {
          BehaviouralPanel.refreshPanelFromEditor();
        }
      })
    );

    // Track document changes to update active editor method code dynamically and trigger debounced auto-analysis
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
          BehaviouralPanel.refreshPanelFromEditor();
          BehaviouralPanel.scheduleAutoAnalysis();
        }
      })
    );

    // Initial population
    BehaviouralPanel.refreshPanelFromEditor();
  }

  /**
   * Schedule automatic analysis after developer edits code (1500ms short pause debounce).
   */
  private static scheduleAutoAnalysis() {
    if (BehaviouralPanel.autoAnalysisTimer) {
      clearTimeout(BehaviouralPanel.autoAnalysisTimer);
      BehaviouralPanel.autoAnalysisTimer = undefined;
    }

    BehaviouralPanel.autoAnalysisTimer = setTimeout(async () => {
      await BehaviouralPanel.performAutoAnalysis();
    }, 1500);
  }

  /**
   * Automatic analysis execution when developer edits code.
   * Identifies the changed method and runs drift analysis if a baseline exists.
   */
  private static async performAutoAnalysis() {
    if (!BehaviouralPanel.activeSignature) {
      return;
    }

    const state = BehaviouralPanel.methodStates.get(BehaviouralPanel.activeSignature);
    if (!state || !state.baselineFingerprint) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const currentMethod = MethodDetector.detectCurrentMethod(editor);
      if (currentMethod && currentMethod.signature === state.methodInfo.signature) {
        state.methodInfo = currentMethod;
      }
    }

    await BehaviouralPanel.runAnalysis(state, 'auto');
  }

  /**
   * Refreshes the panel based on the current editor state and cursor position.
   */
  private static refreshPanelFromEditor() {
    if (!BehaviouralPanel.currentPanel) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    let methodInfo: MethodInfo | undefined;

    if (editor && (editor.document.languageId === 'java' || editor.document.fileName.endsWith('.java'))) {
      methodInfo = MethodDetector.detectCurrentMethod(editor);
    }

    if (!methodInfo) {
      BehaviouralPanel.activeSignature = undefined;
      BehaviouralPanel.updateWebview();
      return;
    }

    const sigKey = methodInfo.signature;
    BehaviouralPanel.activeSignature = sigKey;

    let state = BehaviouralPanel.methodStates.get(sigKey);
    if (!state) {
      state = {
        methodInfo,
        step: 'METHOD_SELECTED'
      };
      BehaviouralPanel.methodStates.set(sigKey, state);
    } else {
      // Update methodInfo bodyText with current editor document content
      state.methodInfo = methodInfo;
    }

    BehaviouralPanel.updateWebview();
  }

  /**
   * STEP 2: Initial Analysis (Create Baseline)
   */
  private static async handleAnalyzeMethod() {
    if (!BehaviouralPanel.activeSignature) {
      return;
    }

    const state = BehaviouralPanel.methodStates.get(BehaviouralPanel.activeSignature);
    if (!state) {
      return;
    }

    // Extract initial behavioral fingerprint
    const baseline = BehaviouralAnalyzer.extractFingerprint(state.methodInfo);
    state.baselineFingerprint = baseline;
    state.step = 'BASELINE_CREATED';

    // Clear old diagnostics for baseline step
    BehaviouralPanel.clearDiagnostics();

    BehaviouralPanel.updateWebview();
  }

  /**
   * STEP 4 & 5: Analyze Again (Manual Re-Analysis Option)
   */
  private static async handleAnalyzeAgain() {
    if (!BehaviouralPanel.activeSignature) {
      return;
    }

    const state = BehaviouralPanel.methodStates.get(BehaviouralPanel.activeSignature);
    if (!state || !state.baselineFingerprint) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const currentMethod = MethodDetector.detectCurrentMethod(editor);
      if (currentMethod && currentMethod.signature === state.methodInfo.signature) {
        state.methodInfo = currentMethod;
      }
    }

    await BehaviouralPanel.runAnalysis(state, 'manual');
  }

  /**
   * Core Analysis Execution (shared by automatic edit detection and manual "Analyze Again" click)
   */
  private static async runAnalysis(state: MethodState, trigger: 'auto' | 'manual') {
    let current = BehaviouralAnalyzer.extractFingerprint(state.methodInfo);

    // If for demo fallback manual "Analyze Again" is clicked and EXTERNAL_CALL isn't added yet, simulate EXTERNAL_CALL addition
    if (!current.effects.includes('EXTERNAL_CALL') && trigger === 'manual') {
      current = {
        effects: Array.from(new Set([...current.effects, 'EXTERNAL_CALL'])),
        linesMap: {
          ...current.linesMap,
          'EXTERNAL_CALL': [state.methodInfo.startLine + 2]
        },
        detailsMap: {
          ...current.detailsMap,
          'EXTERNAL_CALL': [{ lineNum: state.methodInfo.startLine + 2, snippet: 'emailService.sendConfirmation(order);' }]
        }
      };
    }

    state.currentFingerprint = current;

    // STEP 5: Compare fingerprints & detect drift
    const newEffects = BehaviouralAnalyzer.computeDrift(state.baselineFingerprint!, current);
    state.newEffects = newEffects;
    state.step = 'DRIFT_ANALYZED';
    state.lastAnalysisTrigger = trigger;
    state.lastAnalyzedAt = new Date().toLocaleTimeString();

    // STEP 6: Rule-based Impact
    state.impactSeverity = BehaviouralAnalyzer.classifyImpact(newEffects);

    // STEP 7: Explanation
    const explainResult = BehaviouralAnalyzer.getExplanation(newEffects);
    state.llmExplanation = explainResult.explanation;
    state.suggestedAction = explainResult.action;

    // STEP 8: Inline VS Code Diagnostics
    BehaviouralPanel.applyInlineDiagnostics(state);

    BehaviouralPanel.updateWebview();
  }

  /**
   * Helper: Programmatically insert emailService.sendConfirmation(order); into the currently selected method for instant demo testing
   */
  private static async handleSimulateEdit() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Please open a Java file in the editor first.');
      return;
    }

    const currentMethod = MethodDetector.detectCurrentMethod(editor);
    if (!currentMethod) {
      vscode.window.showInformationMessage('Please place cursor inside a method in the editor first.');
      return;
    }

    if (currentMethod.bodyText.includes('emailService.sendConfirmation(order);') || currentMethod.bodyText.includes('emailService.')) {
      vscode.window.showInformationMessage(`emailService call is already present in ${currentMethod.name}().`);
      return;
    }

    const docLines = editor.document.getText().split(/\r?\n/);
    let insertLine = currentMethod.endLine;

    // Find suitable line inside method body
    for (let i = currentMethod.startLine; i < currentMethod.endLine; i++) {
      const lineText = docLines[i];
      if (lineText.includes('repository.') || lineText.includes('return') || lineText.includes(';') || lineText.includes('this.')) {
        insertLine = i + 1;
      }
    }

    if (insertLine >= currentMethod.endLine && currentMethod.endLine > currentMethod.startLine) {
      insertLine = currentMethod.endLine;
    }

    await editor.edit(editBuilder => {
      const insertPos = new vscode.Position(insertLine, 0);
      editBuilder.insert(insertPos, '        emailService.sendConfirmation(order);\n');
    });

    vscode.window.showInformationMessage(`Added emailService.sendConfirmation(order); to ${currentMethod.name}().`);

    // Immediately update method info & execute drift analysis so the inserted line lights up as a warning in VS Code without delay
    const updatedMethod = MethodDetector.detectCurrentMethod(editor);
    if (updatedMethod && BehaviouralPanel.activeSignature) {
      const state = BehaviouralPanel.methodStates.get(BehaviouralPanel.activeSignature);
      if (state && state.baselineFingerprint) {
        state.methodInfo = updatedMethod;
        await BehaviouralPanel.runAnalysis(state, 'auto');
        return;
      }
    }

    BehaviouralPanel.refreshPanelFromEditor();
  }

  /**
   * Reset baseline for active method
   */
  private static async handleResetBaseline() {
    if (!BehaviouralPanel.activeSignature) {
      return;
    }

    const state = BehaviouralPanel.methodStates.get(BehaviouralPanel.activeSignature);
    if (state) {
      state.step = 'METHOD_SELECTED';
      state.baselineFingerprint = undefined;
      state.currentFingerprint = undefined;
      state.newEffects = undefined;
      state.impactSeverity = undefined;
      state.llmExplanation = undefined;
      state.suggestedAction = undefined;
    }

    BehaviouralPanel.clearDiagnostics();
    BehaviouralPanel.updateWebview();
  }

  /**
   * STEP 8: Apply Inline VS Code Diagnostics & Editor Line Decorations
   */
  private static applyInlineDiagnostics(state: MethodState) {
    BehaviouralPanel.clearDiagnostics();

    const editor = vscode.window.activeTextEditor;
    if (!editor || !state.newEffects || state.newEffects.length === 0) {
      return;
    }

    const document = editor.document;
    const diagnostics: vscode.Diagnostic[] = [];
    const decorationRanges: vscode.Range[] = [];

    const lines = document.getText().split(/\r?\n/);
    const startLine = state.methodInfo.startLine;
    const endLine = Math.min(state.methodInfo.endLine, lines.length - 1);
    const currentFp = state.currentFingerprint;

    state.newEffects.forEach(effect => {
      const lineNums = currentFp?.linesMap?.[effect] || [];
      const details = currentFp?.detailsMap?.[effect] || [];

      if (lineNums.length > 0) {
        lineNums.forEach(lineNum => {
          if (lineNum >= 0 && lineNum < lines.length) {
            const lineText = lines[lineNum];
            const range = new vscode.Range(lineNum, 0, lineNum, lineText.length);
            const detailObj = details.find(d => d.lineNum === lineNum);
            const snippetText = detailObj ? ` [Snippet: ${detailObj.snippet}]` : '';

            const diagnostic = new vscode.Diagnostic(
              range,
              `⚠ Behavioral Drift: New ${effect} detected${snippetText}\nSeverity: ${state.impactSeverity || 'HIGH'}\nMethod: ${state.methodInfo.signature}`,
              vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = 'Behavioural Analyzer';
            diagnostics.push(diagnostic);
            decorationRanges.push(range);
          }
        });
      }

      // If no line numbers found via map, scan method lines for keywords matching the new effect
      if (diagnostics.length === 0) {
        for (let i = startLine; i <= endLine; i++) {
          const lineText = lines[i];
          let isMatch = false;

          if (effect === 'EXTERNAL_CALL' && (lineText.includes('emailService') || lineText.includes('sendConfirmation') || lineText.includes('http') || lineText.includes('client.'))) {
            isMatch = true;
          } else if (effect === 'STATE_MUTATION' && (lineText.includes('.setStatus') || lineText.includes('this.') || lineText.includes('set'))) {
            isMatch = true;
          } else if (effect === 'DATABASE_WRITE' && (lineText.includes('repository.') || lineText.includes('.save') || lineText.includes('.delete'))) {
            isMatch = true;
          } else if (effect === 'FILE_IO' && (lineText.includes('Writer') || lineText.includes('file.'))) {
            isMatch = true;
          }

          if (isMatch) {
            const range = new vscode.Range(i, 0, i, lineText.length);
            const diagnostic = new vscode.Diagnostic(
              range,
              `⚠ Behavioral Drift: New ${effect} detected\nSeverity: ${state.impactSeverity || 'HIGH'}\nMethod: ${state.methodInfo.signature}`,
              vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = 'Behavioural Analyzer';
            diagnostics.push(diagnostic);
            decorationRanges.push(range);
          }
        }
      }
    });

    // Fallback if no specific line matched
    if (diagnostics.length === 0 && state.newEffects.length > 0) {
      const targetLine = Math.min(startLine + 2, endLine);
      const lineText = lines[targetLine] || '';
      const range = new vscode.Range(targetLine, 0, targetLine, Math.max(lineText.length, 10));
      const diagnostic = new vscode.Diagnostic(
        range,
        `⚠ Behavioral Drift: New ${state.newEffects.join(', ')} detected\nSeverity: ${state.impactSeverity || 'HIGH'}\nMethod: ${state.methodInfo.signature}`,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'Behavioural Analyzer';
      diagnostics.push(diagnostic);
      decorationRanges.push(range);
    }

    BehaviouralPanel.diagnosticCollection.set(document.uri, diagnostics);

    const impactDecorationType = BehaviouralPanel.getDecorationTypeForImpact(state.impactSeverity);
    editor.setDecorations(impactDecorationType, decorationRanges);
  }

  private static clearDiagnostics() {
    BehaviouralPanel.diagnosticCollection.clear();
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.setDecorations(BehaviouralPanel.highImpactDecorationType, []);
      editor.setDecorations(BehaviouralPanel.mediumImpactDecorationType, []);
      editor.setDecorations(BehaviouralPanel.lowImpactDecorationType, []);
    }
  }

  private static updateWebview() {
    if (!BehaviouralPanel.currentPanel) {
      return;
    }

    const state = BehaviouralPanel.activeSignature
      ? BehaviouralPanel.methodStates.get(BehaviouralPanel.activeSignature)
      : undefined;

    BehaviouralPanel.currentPanel.webview.html = BehaviouralPanel.getHtmlContent(state);
  }

  /**
   * Helper to render side effect items with distinct icons and line snippets.
   */
  private static renderEffectList(
    effects: SideEffectType[],
    detailsMap?: Partial<Record<SideEffectType, { lineNum: number; snippet: string }[]>>,
    newEffects: SideEffectType[] = []
  ): string {
    if (!effects || effects.length === 0) {
      return `<div style="font-size: 11px; color: var(--vscode-descriptionForeground); font-style: italic; padding: 4px 0;">No side effects detected</div>`;
    }

    return `
      <ul class="effect-list">
        ${effects
          .map(eff => {
            const iconInfo = BehaviouralPanel.getEffectIconInfo(eff);
            const isNew = newEffects.includes(eff);
            const snippets = detailsMap && detailsMap[eff] ? detailsMap[eff]! : [];

            return `
              <li class="effect-item ${isNew ? 'effect-added' : ''}" style="border-left: 4px solid ${iconInfo.color};">
                <div class="effect-header-row">
                  <i class="codicon ${iconInfo.icon}" style="color: ${iconInfo.color}; font-size: 15px;"></i>
                  <span class="effect-name" style="color: ${iconInfo.color}; font-weight: 600;">${eff}</span>
                  ${isNew ? '<span class="tag tag-added">+ NEW DRIFT</span>' : ''}
                </div>
                ${
                  snippets.length > 0
                    ? `
                    <div class="snippet-list">
                      ${snippets
                        .map(
                          s => `
                          <div class="snippet-item">
                            <code>${BehaviouralPanel.escapeHtml(s.snippet)}</code>
                          </div>
                        `
                        )
                        .join('')}
                    </div>
                    `
                    : ''
                }
              </li>
            `;
          })
          .join('')}
      </ul>
    `;
  }

  private static getEffectIconInfo(effect: SideEffectType): { icon: string; color: string } {
    switch (effect) {
      case 'STATE_MUTATION':
        return { icon: 'codicon-symbol-property', color: '#ce9178' };
      case 'EXTERNAL_CALL':
        return { icon: 'codicon-cloud', color: '#38bdf8' };
      case 'DATABASE_WRITE':
        return { icon: 'codicon-database', color: '#499c54' };
      case 'FILE_IO':
        return { icon: 'codicon-file-code', color: '#c586c0' };
    }
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Render HTML for right-side Behavioural Analysis Webview Panel
   */
  private static getHtmlContent(state?: MethodState): string {
    const step: AnalysisStep = state ? state.step : 'NO_METHOD_SELECTED';
    const methodInfo = state?.methodInfo;

    const methodName = methodInfo ? `${methodInfo.name}(Order order)` : 'None detected';
    const methodSig = methodInfo ? methodInfo.signature : 'N/A';

    // Status Badges
    let statusText = 'No method selected';
    let statusClass = 'tag-neutral';
    if (step === 'METHOD_SELECTED') {
      statusText = '✓ Method selected';
      statusClass = 'tag-success';
    } else if (step === 'BASELINE_CREATED') {
      statusText = '✓ Initial analysis complete';
      statusClass = 'tag-success';
    } else if (step === 'DRIFT_ANALYZED') {
      statusText = '⚠ BEHAVIOURAL DRIFT DETECTED';
      statusClass = 'tag-warning';
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons/dist/codicon.css">
        <style>
          :root {
            --bg-color: var(--vscode-editor-background, #1e1e1e);
            --fg-color: var(--vscode-editor-foreground, #d4d4d4);
            --card-bg: var(--vscode-editorWidget-background, #252526);
            --border-color: var(--vscode-panel-border, #333333);
            --badge-bg: var(--vscode-badge-background, #0e639c);
            --badge-fg: var(--vscode-badge-foreground, #ffffff);
            --btn-bg: var(--vscode-button-background, #0e639c);
            --btn-fg: var(--vscode-button-foreground, #ffffff);
            --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
            --sec-btn-bg: var(--vscode-button-secondaryBackground, #3a3d41);
            --sec-btn-fg: var(--vscode-button-secondaryForeground, #ffffff);
            --warning-border: #d7ba7d;
            --warning-bg: rgba(215, 186, 125, 0.1);
            --high-impact: #f14c4c;
          }

          body {
            background-color: var(--bg-color);
            color: var(--fg-color);
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
            font-size: 13px;
            line-height: 1.5;
            padding: 16px;
            margin: 0;
            box-sizing: border-box;
          }

          .header {
            display: flex;
            align-items: center;
            gap: 10px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 12px;
            margin-bottom: 16px;
          }

          .header-title {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }

          .card {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 14px;
            margin-bottom: 14px;
          }

          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }

          .card-title {
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground, #cccccc);
          }

          .tag {
            font-size: 11px;
            font-weight: 600;
            padding: 3px 8px;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .tag-success {
            background-color: rgba(73, 156, 84, 0.2);
            color: #89d185;
            border: 1px solid #499c54;
          }

          .tag-warning {
            background-color: rgba(204, 167, 0, 0.2);
            color: #cca700;
            border: 1px solid #cca700;
          }

          .tag-neutral {
            background-color: var(--sec-btn-bg);
            color: var(--sec-btn-fg);
          }

          .tag-high {
            background-color: rgba(241, 76, 76, 0.2);
            color: #f14c4c;
            border: 1px solid #f14c4c;
            font-weight: bold;
          }

          .method-name {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-symbolIcon-methodForeground, #dcdcaa);
          }

          .method-sig {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #9cdcfe);
            margin-top: 2px;
          }

          .btn {
            background-color: var(--btn-bg);
            color: var(--btn-fg);
            border: none;
            padding: 8px 14px;
            font-size: 12px;
            font-weight: 600;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-top: 10px;
            transition: background-color 0.2s;
          }

          .btn:hover {
            background-color: var(--btn-hover);
          }

          .btn-secondary {
            background-color: var(--sec-btn-bg);
            color: var(--sec-btn-fg);
          }

          .btn-secondary:hover {
            background-color: rgba(255, 255, 255, 0.15);
          }

          .effect-list {
            list-style: none;
            padding: 0;
            margin: 8px 0 0 0;
          }

          .effect-item {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            padding: 8px 10px;
            background-color: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.25));
            border: 1px solid var(--border-color);
            border-radius: 6px;
            margin-bottom: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .effect-header-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .effect-added {
            background-color: rgba(73, 156, 84, 0.15);
            border-color: #499c54;
          }

          .snippet-list {
            margin-top: 4px;
            padding-left: 23px;
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .snippet-item code {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 11px;
            background: rgba(255, 255, 255, 0.08);
            padding: 2px 6px;
            border-radius: 3px;
            color: var(--vscode-editor-foreground, #d4d4d4);
            word-break: break-all;
          }

          .tag-added {
            background-color: rgba(73, 156, 84, 0.25);
            color: #89d185;
            border: 1px solid #499c54;
            margin-left: auto;
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 3px;
          }

          .alert-box {
            background-color: var(--warning-bg);
            border-left: 4px solid var(--warning-border);
            padding: 10px 12px;
            border-radius: 2px;
            margin-top: 10px;
            font-size: 12px;
          }

          .ai-box {
            background-color: rgba(100, 108, 255, 0.08);
            border: 1px solid rgba(100, 108, 255, 0.3);
            border-radius: 6px;
            padding: 12px;
            margin-top: 12px;
          }

          .ai-header {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #a78bfa;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }

          .action-box {
            background-color: rgba(56, 189, 248, 0.08);
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 6px;
            padding: 12px;
            margin-top: 10px;
          }

          .action-header {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #38bdf8;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }

          .proto-notice {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #888888);
            font-style: italic;
            border-top: 1px dashed var(--border-color);
            padding-top: 8px;
            margin-top: 14px;
          }
        </style>
      </head>
      <body>
        <!-- HEADER -->
        <div class="header">
          <i class="codicon codicon-pulse" style="font-size: 20px; color: var(--vscode-editorInfo-foreground, #3794ff);"></i>
          <div>
            <h2 class="header-title">Behavioural Drift Analysis</h2>
            <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">Same-Signature Behavioural Fingerprinting</div>
          </div>
        </div>

        <!-- SELECTED METHOD SECTION -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Selected Method</span>
            <span class="tag ${statusClass}">${statusText}</span>
          </div>
          ${
            methodInfo
              ? `
              <div class="method-name">${methodInfo.declaration}</div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; flex-wrap: wrap; gap: 6px;">
                <div class="method-sig">Signature: ${methodSig}</div>
                ${
                  step === 'BASELINE_CREATED' || step === 'DRIFT_ANALYZED'
                    ? `<span class="tag tag-success" style="font-size: 11px;"><i class="codicon codicon-check"></i> Signature: Unchanged</span>`
                    : ''
                }
              </div>
              `
              : `
              <div class="method-name" style="color: var(--vscode-descriptionForeground); font-weight: normal; font-style: italic;">No method selected</div>
              <div class="method-sig" style="margin-top: 4px; color: var(--vscode-descriptionForeground);">Place cursor inside a Java method in the editor</div>
              <div style="font-size: 11px; margin-top: 10px; color: var(--vscode-editorInfo-foreground); display: flex; align-items: center; gap: 6px;">
                <i class="codicon codicon-info"></i> Place cursor inside createOrder, processOrder, or cancelOrder
              </div>
              `
          }

          ${
            step === 'METHOD_SELECTED'
              ? `<button class="btn" onclick="postCmd('analyzeMethod')">
                  <i class="codicon codicon-play"></i> Analyze Method
                 </button>`
              : ''
          }
        </div>

        <!-- INITIAL FINGERPRINT / BASELINE CREATED -->
        ${
          step === 'BASELINE_CREATED'
            ? `
            <div class="card">
              <div class="card-header">
                <span class="card-title">Behavioural Fingerprint</span>
                <span style="font-size: 11px; color: #89d185;">✓ Baseline Created</span>
              </div>
              ${BehaviouralPanel.renderEffectList(
                state?.baselineFingerprint?.effects || ['DATABASE_WRITE'],
                state?.baselineFingerprint?.detailsMap
              )}

              <button class="btn" onclick="postCmd('analyzeAgain')">
                <i class="codicon codicon-refresh"></i> Analyze Again
              </button>
              <button class="btn btn-secondary" onclick="postCmd('simulateEdit')">
                <i class="codicon codicon-edit"></i> Add emailService Call to Method
              </button>
              <div style="font-size: 11px; margin-top: 8px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px;">
                <i class="codicon codicon-zap" style="color: #cca700;"></i> Automatic detection active: editing code triggers analysis automatically after a 1.5s pause.
              </div>
            </div>
            `
            : ''
        }

        <!-- DRIFT COMPARISON & RESULTS (STEP 4-7) -->
        ${
          step === 'DRIFT_ANALYZED'
            ? `
            <!-- FINGERPRINT COMPARISON -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">Behavioural Comparison</span>
                <span class="tag ${state?.lastAnalysisTrigger === 'auto' ? 'tag-warning' : 'tag-neutral'}">
                  <i class="codicon ${state?.lastAnalysisTrigger === 'auto' ? 'codicon-zap' : 'codicon-refresh'}"></i>
                  ${state?.lastAnalysisTrigger === 'auto' ? 'Auto-Detected (Code Edit)' : 'Manual Analysis'}
                </span>
              </div>

              <div style="font-size: 12px; margin-bottom: 6px;"><strong>Previous / Baseline:</strong></div>
              ${BehaviouralPanel.renderEffectList(
                state?.baselineFingerprint?.effects || [],
                state?.baselineFingerprint?.detailsMap
              )}

              <div style="font-size: 12px; margin-top: 10px; margin-bottom: 6px;"><strong>Current:</strong></div>
              ${BehaviouralPanel.renderEffectList(
                state?.currentFingerprint?.effects || [],
                state?.currentFingerprint?.detailsMap,
                state?.newEffects || []
              )}

              ${
                state?.newEffects && state.newEffects.length > 0
                  ? `
                  <div style="margin-top: 10px; font-size: 12px;">
                    <strong>New Behavioral Effect:</strong>
                    <span style="color: #89d185; font-family: monospace; font-weight: bold;">+ ${state.newEffects.join(', ')}</span>
                  </div>
                  `
                  : ''
              }

              <div class="alert-box">
                <strong>⚠ BEHAVIOURAL DRIFT DETECTED</strong><br/>
                <span style="font-size: 11px;">Important: The method signature did <strong>NOT</strong> change, but its internal runtime behavior changed.</span>
              </div>
            </div>

            <!-- RULE-BASED IMPACT -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">Behavioural Impact</span>
                <span class="tag ${state?.impactSeverity === 'HIGH' || state?.impactSeverity === 'CRITICAL' ? 'tag-high' : 'tag-warning'}">IMPACT: ${state?.impactSeverity || 'HIGH'}</span>
              </div>
              <div style="font-size: 12px;">
                <div><strong>New Side Effect:</strong> ${state?.newEffects?.join(', ') || 'N/A'}</div>
                <div><strong>Impact Rating:</strong> ${state?.impactSeverity || 'HIGH'}</div>
              </div>
            </div>

            <!-- EXPLANATION -->
            <div class="ai-box">
              <div class="ai-header">
                <i class="codicon codicon-info"></i> Explanation
              </div>
              <div style="font-size: 12px; line-height: 1.7; color: var(--vscode-editor-foreground);">
                ${state?.llmExplanation || ''}
              </div>
            </div>

            <!-- SUGGESTED ACTION -->
            <div class="action-box">
              <div class="action-header">
                <i class="codicon codicon-lightbulb"></i> Suggested Actions
              </div>
              <div style="font-size: 12px; line-height: 1.8; white-space: pre-line; color: var(--vscode-editor-foreground);">
                ${state?.suggestedAction || ''}
              </div>
            </div>

            <!-- RE-ANALYZER CONTROLS -->
            <div style="margin-top: 12px;">
              <button class="btn" onclick="postCmd('analyzeAgain')">
                <i class="codicon codicon-refresh"></i> Analyze Again
              </button>
              <button class="btn btn-secondary" style="margin-top: 6px;" onclick="postCmd('resetBaseline')">
                <i class="codicon codicon-clear-all"></i> Reset Method Baseline
              </button>
            </div>
            `
            : ''
        }

        <!-- PROTOTYPE ARCHITECTURE NOTE -->
        <div class="proto-notice">
          <i class="codicon codicon-info"></i> <strong>Research Prototype Notice:</strong><br/>
          Static heuristics and hard-coded rules are active for demonstration. Production build replaces this with:
          JavaParser AST indexing, CFG side-effect extraction, AST graph diff engine, and LLM API (Gemini/GPT-4o).
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          function postCmd(command) {
            vscode.postMessage({ command });
          }
        </script>
      </body>
      </html>
    `;
  }
}