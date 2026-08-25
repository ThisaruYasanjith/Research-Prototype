import * as vscode from "vscode";

export class CodeQualityPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;

  public static show(context: vscode.ExtensionContext) {
    if (CodeQualityPanel.currentPanel) {
      CodeQualityPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "codeQualityPanel",
      "Maintainability Triage",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    CodeQualityPanel.currentPanel = panel;

    panel.onDidDispose(() => {
      CodeQualityPanel.currentPanel = undefined;
    });

    panel.webview.html = CodeQualityPanel.getHtmlContent();
  }

  private static getHtmlContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 18px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
          }

          .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 14px;
            margin-bottom: 16px;
          }

          .header h1 {
            margin: 0 0 5px 0;
            font-size: 18px;
            font-weight: 600;
          }

          .subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
          }

          .prototype-note {
            margin-top: 10px;
            padding: 7px 9px;
            border-left: 3px solid var(--vscode-focusBorder);
            background: var(--vscode-textBlockQuote-background);
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
          }

          .target-card {
            padding: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            background: var(--vscode-editorWidget-background);
            margin-bottom: 14px;
          }

          .target-label {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-bottom: 4px;
          }

          .target-file {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 13px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 18px;
          }

          .summary-card {
            padding: 10px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            background: var(--vscode-editorWidget-background);
          }

          .summary-number {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 3px;
          }

          .summary-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
          }

          .section-title {
            font-size: 13px;
            font-weight: 600;
            margin: 18px 0 10px 0;
          }

          .issue-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 13px;
            margin-bottom: 10px;
            background: var(--vscode-editorWidget-background);
          }

          .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
          }

          .issue-location {
            font-family: var(--vscode-editor-font-family, monospace);
            font-weight: 600;
          }

          .priority {
            font-size: 10px;
            font-weight: 700;
            padding: 3px 7px;
            border-radius: 3px;
            white-space: nowrap;
          }

          .priority-high {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
          }

          .priority-medium {
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
          }

          .priority-low {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
          }

          .issue-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin: 8px 0;
          }

          .issue-tag {
            font-size: 10px;
            padding: 3px 6px;
            border-radius: 3px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
          }

          .score-row {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
          }

          .score {
            color: var(--vscode-editor-foreground);
            font-weight: 600;
          }

          .details-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background: var(--vscode-editorWidget-background);
            padding: 14px;
            margin-top: 16px;
          }

          .details-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
          }

          .details-location {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family, monospace);
            margin-bottom: 15px;
          }

          .sub-heading {
            font-size: 12px;
            font-weight: 600;
            margin: 15px 0 8px 0;
          }

          .evidence-row {
            border-top: 1px solid var(--vscode-panel-border);
            padding: 8px 0;
          }

          .evidence-row:first-of-type {
            border-top: none;
          }

          .evidence-name {
            font-weight: 600;
            margin-bottom: 3px;
          }

          .evidence-values {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
          }

          .explanation {
            font-size: 12px;
            line-height: 1.5;
            color: var(--vscode-descriptionForeground);
          }

          .fix-step {
            display: flex;
            gap: 10px;
            padding: 9px 0;
            border-top: 1px solid var(--vscode-panel-border);
          }

          .fix-step:first-of-type {
            border-top: none;
          }

          .step-number {
            min-width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
          }

          .step-title {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 3px;
          }

          .step-reason {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            line-height: 1.4;
          }
        </style>
      </head>

      <body>

        <div class="header">
          <h1>Maintainability Triage</h1>

          <div class="subtitle">
            Code Cleanliness & Maintainability Analysis
          </div>

          
        </div>

        <div class="target-card">
          <div class="target-label">Analysis Target</div>
          <div class="target-file">ApplicationService.java</div>
        </div>

        <div class="summary-grid">

          <div class="summary-card">
            <div class="summary-number">3</div>
            <div class="summary-label">Issue Groups</div>
          </div>

          <div class="summary-card">
            <div class="summary-number">1</div>
            <div class="summary-label">High Priority</div>
          </div>

          <div class="summary-card">
            <div class="summary-number">6</div>
            <div class="summary-label">Detected Issues</div>
          </div>

        </div>

        <div class="section-title">
          Ranked Maintainability Issues
        </div>

        <div class="issue-card">

          <div class="issue-header">
            <div class="issue-location">
              processApplication()
            </div>

            <div class="priority priority-high">
              HIGH
            </div>
          </div>

          <div class="issue-tags">
            <span class="issue-tag">Long Method</span>
            <span class="issue-tag">High Complexity</span>
            <span class="issue-tag">Duplicated Logic</span>
          </div>

          <div class="score-row">
            <span>Maintainability Priority</span>
            <span class="score">86 / 100</span>
          </div>

        </div>

        <div class="issue-card">

          <div class="issue-header">
            <div class="issue-location">
              UserService
            </div>

            <div class="priority priority-medium">
              MEDIUM
            </div>
          </div>

          <div class="issue-tags">
            <span class="issue-tag">Large Class</span>
            <span class="issue-tag">Weak Cohesion</span>
          </div>

          <div class="score-row">
            <span>Maintainability Priority</span>
            <span class="score">61 / 100</span>
          </div>

        </div>

        <div class="issue-card">

          <div class="issue-header">
            <div class="issue-location">
              calculateFee()
            </div>

            <div class="priority priority-low">
              LOW
            </div>
          </div>

          <div class="issue-tags">
            <span class="issue-tag">Poor Naming</span>
          </div>

          <div class="score-row">
            <span>Maintainability Priority</span>
            <span class="score">28 / 100</span>
          </div>

        </div>

        <div class="details-card">

          <div class="details-title">
            High Priority Issue Group
          </div>

          <div class="details-location">
            ApplicationService.java → processApplication()
          </div>

          <div class="sub-heading">
            Analysis Evidence
          </div>

          <div class="evidence-row">
            <div class="evidence-name">
              Long Method
            </div>

            <div class="evidence-values">
              Method length: 85 lines · Configured threshold: 40
            </div>
          </div>

          <div class="evidence-row">
            <div class="evidence-name">
              High Complexity
            </div>

            <div class="evidence-values">
              Complexity value: 17 · Configured threshold: 10
            </div>
          </div>

          <div class="evidence-row">
            <div class="evidence-name">
              Duplicated Logic
            </div>

            <div class="evidence-values">
              Similarity: 82% · Configured threshold: 75%
            </div>
          </div>

          <div class="sub-heading">
            Why This Group Is High Priority
          </div>

          <div class="explanation">
            Multiple maintainability issues occur in the same method.
            Repeated logic contributes to unnecessary method size, while
            complex decision logic makes the method harder to understand
            and modify safely. These related findings are therefore treated
            as one maintainability concern instead of separate warnings.
          </div>

          <div class="sub-heading">
            Recommended Fix Order
          </div>

          <div class="fix-step">

            <div class="step-number">1</div>

            <div>
              <div class="step-title">
                Extract duplicated logic
              </div>

              <div class="step-reason">
                Remove repeated operations first so the method becomes
                smaller and shared behaviour is maintained in one place.
              </div>
            </div>

          </div>

          <div class="fix-step">

            <div class="step-number">2</div>

            <div>
              <div class="step-title">
                Simplify complex decision logic
              </div>

              <div class="step-reason">
                Reduce difficult conditional paths after the repeated
                logic has been separated.
              </div>
            </div>

          </div>

          <div class="fix-step">

            <div class="step-number">3</div>

            <div>
              <div class="step-title">
                Split remaining responsibilities
              </div>

              <div class="step-reason">
                Extract focused methods for the remaining responsibilities
                if the method is still excessively large.
              </div>
            </div>

          </div>

          <div class="fix-step">

            <div class="step-number">4</div>

            <div>
              <div class="step-title">
                Improve naming after restructuring
              </div>

              <div class="step-reason">
                Use clear names for the final extracted methods and
                variables after their responsibilities are established.
              </div>
            </div>

          </div>

        </div>

      </body>
      </html>
    `;
  }
}
