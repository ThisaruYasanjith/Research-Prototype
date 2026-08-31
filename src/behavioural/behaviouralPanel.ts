import * as vscode from 'vscode';
import { MethodInfo, MethodState, AnalysisStep, SideEffectType } from './types';
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
   * Schedule automatic analysis after developer edits code (750ms short pause debounce).
   */
  private static scheduleAutoAnalysis() {
    if (BehaviouralPanel.autoAnalysisTimer) {
      clearTimeout(BehaviouralPanel.autoAnalysisTimer);
      BehaviouralPanel.autoAnalysisTimer = undefined;
    }

    BehaviouralPanel.autoAnalysisTimer = setTimeout(async () => {
      await BehaviouralPanel.performAutoAnalysis();
    }, 750);
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

    // If for demo fallback processOrder wasn't edited with EXTERNAL_CALL yet and manual button clicked
    if (state.methodInfo.name === 'processOrder' && !current.effects.includes('EXTERNAL_CALL') && trigger === 'manual') {
      current = {
        effects: ['DATABASE_WRITE', 'EXTERNAL_CALL'],
        linesMap: {
          'DATABASE_WRITE': [state.methodInfo.startLine + 1],
          'EXTERNAL_CALL': [state.methodInfo.startLine + 2]
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

    // STEP 7: LLM Explanation
    const aiResult = BehaviouralAnalyzer.getAIExplanation(newEffects);
    state.llmExplanation = aiResult.explanation;
    state.suggestedAction = aiResult.action;

    // STEP 8: Inline VS Code Diagnostics
    BehaviouralPanel.applyInlineDiagnostics(state);

    BehaviouralPanel.updateWebview();
  }

  /**
   * Helper: Programmatically insert emailService.sendConfirmation(order); into editor for instant demo testing
   */
  private static async handleSimulateEdit() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Please open OrderService.java in the editor first.');
      return;
    }

    const docText = editor.document.getText();
    const targetLine = 'repository.save(order);';

    if (docText.includes('emailService.sendConfirmation(order);')) {
      vscode.window.showInformationMessage('emailService.sendConfirmation(order); is already present in the method.');
      return;
    }

    if (docText.includes(targetLine)) {
      const lineIndex = docText.split(/\r?\n/).findIndex(l => l.includes(targetLine));
      if (lineIndex !== -1) {
        await editor.edit(editBuilder => {
          const insertPos = new vscode.Position(lineIndex + 1, 0);
          editBuilder.insert(insertPos, '        emailService.sendConfirmation(order);\n');
        });
        vscode.window.showInformationMessage('Added emailService.sendConfirmation(order); to method.');
        BehaviouralPanel.refreshPanelFromEditor();
      }
    }
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
   * STEP 8: Apply Inline VS Code Diagnostics in Active Editor
   */
  private static applyInlineDiagnostics(state: MethodState) {
    BehaviouralPanel.clearDiagnostics();

    const editor = vscode.window.activeTextEditor;
    if (!editor || !state.newEffects || state.newEffects.length === 0) {
      return;
    }

    const document = editor.document;
    const diagnostics: vscode.Diagnostic[] = [];

    // Look for lines containing new side effect signatures
    const lines = document.getText().split(/\r?\n/);
    const startLine = state.methodInfo.startLine;
    const endLine = Math.min(state.methodInfo.endLine, lines.length - 1);

    for (let i = startLine; i <= endLine; i++) {
      const lineText = lines[i];
      if (lineText.includes('emailService') || lineText.includes('sendConfirmation') || lineText.includes('http')) {
        const range = new vscode.Range(i, lineText.indexOf('emailService') !== -1 ? lineText.indexOf('emailService') : 0, i, lineText.length);
        const diagnostic = new vscode.Diagnostic(
          range,
          '⚠ Behavioral Drift: New external interaction detected\nSeverity: High\nSide Effect: EXTERNAL_CALL',
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'Behavioural Analyzer';
        diagnostics.push(diagnostic);
      }
    }

    // Fallback if no exact string match in document line range (e.g. simulated demo)
    if (diagnostics.length === 0 && state.newEffects.includes('EXTERNAL_CALL')) {
      const targetLine = Math.min(startLine + 2, endLine);
      const lineText = lines[targetLine] || '';
      const range = new vscode.Range(targetLine, 0, targetLine, Math.max(lineText.length, 10));
      const diagnostic = new vscode.Diagnostic(
        range,
        '⚠ Behavioral Drift: New external interaction detected\nSeverity: High\nSide Effect: EXTERNAL_CALL',
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'Behavioural Analyzer';
      diagnostics.push(diagnostic);
    }

    BehaviouralPanel.diagnosticCollection.set(document.uri, diagnostics);
  }

  private static clearDiagnostics() {
    BehaviouralPanel.diagnosticCollection.clear();
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
            padding: 4px 8px;
            background-color: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.2));
            border: 1px solid var(--border-color);
            border-radius: 4px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .effect-added {
            border-color: #499c54;
            background-color: rgba(73, 156, 84, 0.15);
            color: #89d185;
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
              <div class="method-sig">Signature: ${methodSig}</div>
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
          step === 'BASELINE_CREATED' || step === 'DRIFT_ANALYZED'
            ? `
            <div class="card">
              <div class="card-header">
                <span class="card-title">Behavioural Fingerprint</span>
                <span style="font-size: 11px; color: #89d185;">✓ Baseline Created</span>
              </div>
              <ul class="effect-list">
                ${
                  (state?.baselineFingerprint?.effects || ['DATABASE_WRITE'])
                    .map(eff => `<li class="effect-item"><i class="codicon codicon-database"></i> • ${eff}</li>`)
                    .join('')
                }
              </ul>

              ${
                step === 'BASELINE_CREATED'
                  ? `
                  <button class="btn" onclick="postCmd('analyzeAgain')">
                    <i class="codicon codicon-refresh"></i> Analyze Again
                  </button>
                  <button class="btn btn-secondary" onclick="postCmd('simulateEdit')">
                    <i class="codicon codicon-edit"></i> Add emailService Call to Method
                  </button>
                  <div style="font-size: 11px; margin-top: 8px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px;">
                    <i class="codicon codicon-zap" style="color: #cca700;"></i> Automatic detection active: editing code triggers analysis automatically after a short pause.
                  </div>
                  `
                  : ''
              }
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
              <ul class="effect-list" style="margin-bottom: 10px;">
                ${
                  (state?.baselineFingerprint?.effects || ['DATABASE_WRITE'])
                    .map(eff => `<li class="effect-item"><i class="codicon codicon-database"></i> • ${eff}</li>`)
                    .join('')
                }
              </ul>

              <div style="font-size: 12px; margin-bottom: 6px;"><strong>Current:</strong></div>
              <ul class="effect-list">
                ${
                  (state?.currentFingerprint?.effects || ['DATABASE_WRITE', 'EXTERNAL_CALL'])
                    .map(eff => `
                      <li class="effect-item ${eff === 'EXTERNAL_CALL' ? 'effect-added' : ''}">
                        <i class="codicon ${eff === 'EXTERNAL_CALL' ? 'codicon-cloud' : 'codicon-database'}"></i>
                        • ${eff}
                      </li>
                    `)
                    .join('')
                }
              </ul>

              <div style="margin-top: 10px; font-size: 12px;">
                <strong>New Behavioral Effect:</strong>
                <span style="color: #89d185; font-family: monospace; font-weight: bold;">+ EXTERNAL_CALL</span>
              </div>

              <div class="alert-box">
                <strong>⚠ BEHAVIOURAL DRIFT DETECTED</strong><br/>
                <span style="font-size: 11px;">Important: The method signature did <strong>NOT</strong> change, but its internal runtime behavior changed.</span>
              </div>
            </div>

            <!-- RULE-BASED IMPACT -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">Behavioural Impact</span>
                <span class="tag tag-high">IMPACT: ${state?.impactSeverity || 'HIGH'}</span>
              </div>
              <div style="font-size: 12px;">
                <div><strong>New Side Effect:</strong> EXTERNAL_CALL</div>
                <div><strong>Impact Rating:</strong> HIGH</div>
              </div>
            </div>

            <!-- AI EXPLANATION -->
            <div class="ai-box">
              <div class="ai-header">
                <i class="codicon codicon-sparkle"></i> AI Explanation
              </div>
              <div style="font-size: 12px; line-height: 1.6;">
                ${state?.llmExplanation || 'The method previously performed only a database operation. The updated version also communicates with an external service. This introduces a new external dependency that may fail independently of the database operation.'}
              </div>
            </div>

            <!-- SUGGESTED ACTION -->
            <div class="action-box">
              <div class="action-header">
                <i class="codicon codicon-lightbulb"></i> Suggested Action
              </div>
              <div style="font-size: 12px; line-height: 1.6;">
                ${state?.suggestedAction || 'Consider adding appropriate error and timeout handling for the external service call.'}
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