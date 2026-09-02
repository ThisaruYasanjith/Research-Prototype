import * as vscode from "vscode";
import * as path from "path";

import { analyzeJavaSource } from "./basicAnalyzer";

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

    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command !== "analyzeCurrentFile") {
          return;
        }

        const activeEditor = vscode.window.activeTextEditor;

        const javaEditor =
          activeEditor?.document.languageId === "java"
            ? activeEditor
            : vscode.window.visibleTextEditors.find(
                (editor) => editor.document.languageId === "java",
              );

        if (!javaEditor) {
          panel.webview.postMessage({
            command: "analysisError",
            message:
              "No Java source file is currently open. Open a .java file and try again.",
          });

          return;
        }

        const document = javaEditor.document;

        try {
          const sourceCode = document.getText();

          const fileName = path.basename(document.fileName);

          const result = analyzeJavaSource(sourceCode, fileName);

          panel.webview.postMessage({
            command: "analysisResult",
            result,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown analysis error.";

          panel.webview.postMessage({
            command: "analysisError",
            message,
          });
        }
      },
      undefined,
      context.subscriptions,
    );

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

          .action-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }

          .analyze-button {
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 7px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            white-space: nowrap;
          }

          .analyze-button:hover {
            background: var(--vscode-button-hoverBackground);
          }

          .analyze-button:disabled {
            opacity: 0.65;
            cursor: default;
          }

          .analysis-status {
            margin: 10px 0 16px 0;
            padding: 8px 10px;
            border-left: 3px solid var(--vscode-focusBorder);
            background: var(--vscode-textBlockQuote-background);
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            display: none;
          }

          .analysis-results {
            display: none;
          }

          .analysis-results.visible {
            display: block;
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

          .issue-selectable {
            cursor: pointer;
            transition: border-color 0.15s ease, background-color 0.15s ease;
          }

          .issue-selectable:hover {
            border-color: var(--vscode-focusBorder);
          }

          .issue-selectable.active {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground);
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

          .real-results {
            display: none;
            margin-top: 16px;
          }

          .real-results.visible {
            display: block;
          }

          .real-result-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 10px;
            background: var(--vscode-editorWidget-background);
          }

          .real-result-title {
            font-weight: 600;
            margin-bottom: 8px;
          }

          .real-result-line {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            line-height: 1.6;
          }

          .real-issue {
            margin-top: 6px;
            padding: 5px 7px;
            border-left: 2px solid var(--vscode-editorWarning-foreground);
            background: var(--vscode-textBlockQuote-background);
            font-size: 11px;
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
          <div class="action-row">

            <div>
              <div class="target-label">
                Analysis Target
              </div>

              <div class="target-file" id="targetFile">
                Open a Java file to analyze
              </div>
            </div>

            <button class="analyze-button" id="analyzeButton">
              Analyze Current File
            </button>

          </div>
        </div>

        <div class="analysis-status" id="analysisStatus"></div>

        <div class="real-results" id="realResults">

          <div class="section-title">
            Real Analyzer Output
          </div>

          <div id="realSummary"></div>

          <div id="realGroups"></div>

          <div id="realMethods"></div>

          <div id="realClasses"></div>

          <div id="realDuplicates"></div>

        </div>

        <div class="analysis-results" id="analysisResults">

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

          <div
            class="issue-card issue-selectable active"
            data-group="processApplication"
          >

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

          <div
            class="issue-card issue-selectable"
            data-group="userService"
          >

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

          <div
            class="issue-card issue-selectable"
            data-group="calculateFee"
          >

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

            <div class="details-title" id="detailTitle">
              High Priority Issue Group
            </div>

            <div class="details-location" id="detailLocation">
              ApplicationService.java → processApplication()
            </div>

            <div class="sub-heading">
              Analysis Evidence
            </div>

            <div id="evidenceContainer"></div>

            <div class="sub-heading" id="priorityHeading">
              Why This Group Is High Priority
            </div>

            <div
              class="explanation"
              id="priorityExplanation"
            ></div>

            <div class="sub-heading">
              Recommended Fix Order
            </div>

            <div id="fixOrderContainer"></div>

          </div>

        </div>

        <script>
          const vscode = acquireVsCodeApi();

          const groups = {
            processApplication: {
              title: 'High Priority Issue Group',
              location: 'ApplicationService.java → processApplication()',
              priority: 'High',

              evidence: [
                {
                  name: 'Long Method',
                  value: 'Method length: 85 lines · Configured threshold: 40'
                },
                {
                  name: 'High Complexity',
                  value: 'Complexity value: 17 · Configured threshold: 10'
                },
                {
                  name: 'Duplicated Logic',
                  value: 'Similarity: 82% · Configured threshold: 75%'
                }
              ],

              explanation:
                'Multiple maintainability issues occur in the same method. ' +
                'Repeated logic contributes to unnecessary method size, while ' +
                'complex decision logic makes the method harder to understand ' +
                'and modify safely. These related findings are therefore treated ' +
                'as one maintainability concern instead of separate warnings.',

              fixes: [
                {
                  title: 'Extract duplicated logic',
                  reason:
                    'Remove repeated operations first so the method becomes smaller and shared behaviour is maintained in one place.'
                },
                {
                  title: 'Simplify complex decision logic',
                  reason:
                    'Reduce difficult conditional paths after the repeated logic has been separated.'
                },
                {
                  title: 'Split remaining responsibilities',
                  reason:
                    'Extract focused methods for the remaining responsibilities if the method is still excessively large.'
                },
                {
                  title: 'Improve naming after restructuring',
                  reason:
                    'Use clear names for the final extracted methods and variables after their responsibilities are established.'
                }
              ]
            },

            userService: {
              title: 'Medium Priority Issue Group',
              location: 'UserService.java → UserService',
              priority: 'Medium',

              evidence: [
                {
                  name: 'Large Class',
                  value:
                    'Class contains multiple methods and fields beyond the configured maintainability profile.'
                },
                {
                  name: 'Weak Cohesion',
                  value:
                    'Several methods operate on separate groups of class fields.'
                }
              ],

              explanation:
                'The class contains multiple responsibilities and its methods do not strongly relate to the same internal state. ' +
                'These findings are grouped because class size and weak cohesion together indicate a broader maintainability concern.',

              fixes: [
                {
                  title: 'Identify separate responsibility groups',
                  reason:
                    'Determine which methods and fields belong to different responsibilities before changing the class structure.'
                },
                {
                  title: 'Extract focused classes',
                  reason:
                    'Move related methods and fields into smaller classes with clearer responsibilities.'
                },
                {
                  title: 'Review the remaining class',
                  reason:
                    'Check whether the original class is now cohesive and easier to understand.'
                }
              ]
            },

            calculateFee: {
              title: 'Low Priority Issue Group',
              location: 'PaymentService.java → calculateFee()',
              priority: 'Low',

              evidence: [
                {
                  name: 'Poor Naming',
                  value:
                    'One or more identifiers use unclear or weakly descriptive names.'
                }
              ],

              explanation:
                'The detected issue affects readability, but no additional maintainability problems are currently grouped with it. ' +
                'Therefore, it receives a lower fixing priority than the other issue groups.',

              fixes: [
                {
                  title: 'Review unclear identifiers',
                  reason:
                    'Identify names that do not clearly communicate their purpose.'
                },
                {
                  title: 'Rename using domain-relevant terms',
                  reason:
                    'Use names that describe the value, responsibility, or operation more clearly.'
                }
              ]
            }
          };

          function renderGroup(groupKey) {
            const group = groups[groupKey];

            document.getElementById('detailTitle').textContent =
              group.title;

            document.getElementById('detailLocation').textContent =
              group.location;

            document.getElementById('priorityHeading').textContent =
              'Why This Group Is ' + group.priority + ' Priority';

            document.getElementById('priorityExplanation').textContent =
              group.explanation;

            const evidenceContainer =
              document.getElementById('evidenceContainer');

            evidenceContainer.innerHTML = group.evidence
              .map(
                item => \`
                  <div class="evidence-row">
                    <div class="evidence-name">\${item.name}</div>
                    <div class="evidence-values">\${item.value}</div>
                  </div>
                \`
              )
              .join('');

            const fixOrderContainer =
              document.getElementById('fixOrderContainer');

            fixOrderContainer.innerHTML = group.fixes
              .map(
                (step, index) => \`
                  <div class="fix-step">

                    <div class="step-number">
                      \${index + 1}
                    </div>

                    <div>
                      <div class="step-title">
                        \${step.title}
                      </div>

                      <div class="step-reason">
                        \${step.reason}
                      </div>
                    </div>

                  </div>
                \`
              )
              .join('');
          }

          const cards =
            document.querySelectorAll('.issue-selectable');

          const analyzeButton =
            document.getElementById('analyzeButton');

          const analysisStatus =
            document.getElementById('analysisStatus');

          const analysisResults =
            document.getElementById('analysisResults');

          const targetFile =
            document.getElementById('targetFile');

          const realResults =
            document.getElementById('realResults');

          const realSummary =
            document.getElementById('realSummary');

          const realGroups =
            document.getElementById('realGroups');

          const realMethods =
            document.getElementById('realMethods');

          const realClasses =
            document.getElementById('realClasses');

          const realDuplicates =
            document.getElementById('realDuplicates');

          cards.forEach(card => {
            card.addEventListener('click', () => {
              cards.forEach(item =>
                item.classList.remove('active')
              );

              card.classList.add('active');

              const groupKey =
                card.getAttribute('data-group');

              if (groupKey) {
                renderGroup(groupKey);
              }
            });
          });

          analyzeButton.addEventListener('click', () => {
            analyzeButton.disabled = true;

            analyzeButton.textContent =
              'Analyzing...';

            analysisStatus.style.display =
              'block';

            analysisStatus.textContent =
              'Running real Java maintainability analysis...';

            realResults.classList.remove(
              'visible'
            );

            analysisResults.classList.remove(
              'visible'
            );

            vscode.postMessage({
              command:
                'analyzeCurrentFile'
            });
          });

          window.addEventListener(
            'message',
            event => {
              const message =
                event.data;

              if (
                message.command ===
                'analysisError'
              ) {
                analyzeButton.disabled =
                  false;

                analyzeButton.textContent =
                  'Analyze Current File';

                analysisStatus.style.display =
                  'block';

                analysisStatus.textContent =
                  message.message;

                realResults.classList.remove(
                  'visible'
                );

                return;
              }

              if (
                message.command !==
                'analysisResult'
              ) {
                return;
              }

              const result =
                message.result;

              targetFile.textContent =
                result.fileName;

              analyzeButton.disabled =
                false;

              analyzeButton.textContent =
                'Analyze Again';

              analysisStatus.style.display =
                'block';

              analysisStatus.textContent =
                'Analysis complete. ' +
                result.totalIssues +
                ' maintainability issue(s) detected.';

              renderRealAnalysis(
                result
              );

              realResults.classList.add(
                'visible'
              );
            }
          );

          renderGroup(
            'processApplication'
          );

          function renderRealAnalysis(result) {
            const highPriorityCount =
              result.groups.filter(
                group =>
                  group.priorityLevel ===
                  'High'
              ).length;

            const mediumPriorityCount =
              result.groups.filter(
                group =>
                  group.priorityLevel ===
                  'Medium'
              ).length;

            const lowPriorityCount =
              result.groups.filter(
                group =>
                  group.priorityLevel ===
                  'Low'
              ).length;

            realSummary.innerHTML = \`
              <div class="real-result-card">

                <div class="real-result-title">
                  \${result.fileName}
                </div>

                <div class="real-result-line">
                  Methods analyzed:
                  \${result.methods.length}
                </div>

                <div class="real-result-line">
                  Classes analyzed:
                  \${result.classes.length}
                </div>

                <div class="real-result-line">
                  Duplicate pairs:
                  \${result.duplicates.length}
                </div>

                <div class="real-result-line">
                  Maintainability groups:
                  \${result.groups.length}
                </div>

                <div class="real-result-line">
                  High priority groups:
                  \${highPriorityCount}
                </div>

                <div class="real-result-line">
                  Medium priority groups:
                  \${mediumPriorityCount}
                </div>

                <div class="real-result-line">
                  Low priority groups:
                  \${lowPriorityCount}
                </div>

                <div class="real-result-line">
                  Total detected issues:
                  \${result.totalIssues}
                </div>

              </div>
            \`;

            realGroups.innerHTML =
              result.groups.length === 0
                ? ''
                : \`
                  <div class="section-title">
                    Ranked Maintainability Groups
                  </div>

                  \${result.groups
                    .map((group, index) => {
                      const issueTypes =
                        group.issueTypes.length === 0
                          ? 'None'
                          : group.issueTypes.join(', ');

                      const affectedMethods =
                        group.affectedMethods.length === 0
                          ? 'None'
                          : group.affectedMethods
                              .map(
                                method =>
                                  method + '()'
                              )
                              .join(', ');

                      const affectedClasses =
                        group.affectedClasses.length === 0
                          ? 'None'
                          : group.affectedClasses.join(', ');

                      const priorityClass =
                        group.priorityLevel.toLowerCase();

                      const priorityReasons =
                        group.priorityReasons.length === 0
                          ? '<div class="real-result-line">No additional priority evidence.</div>'
                          : group.priorityReasons
                              .map(
                                reason => \`
                                  <div class="real-issue">
                                    \${reason}
                                  </div>
                                \`
                              )
                              .join('');

                      const localEvidence =
                        group.issues.length === 0
                          ? ''
                          : \`
                            <div class="sub-heading">
                              Analysis Evidence
                            </div>

                            \${group.issues
                              .map(
                                issue => \`
                                  <div class="real-issue">

                                    <strong>
                                      \${issue.type}
                                    </strong>
                                    <br>

                                    \${issue.evidence}

                                  </div>
                                \`
                              )
                              .join('')}
                          \`;

                      const duplicateEvidence =
                        group.duplicatePairs.length === 0
                          ? ''
                          : \`
                            <div class="sub-heading">
                              Duplication Evidence
                            </div>

                            \${group.duplicatePairs
                              .map(
                                duplicate => \`
                                  <div class="real-issue">

                                    <strong>
                                      \${duplicate.firstMethod}()
                                      ↔
                                      \${duplicate.secondMethod}()
                                    </strong>

                                    <br>

                                    Similarity:
                                    \${duplicate.similarity}%

                                  </div>
                                \`
                              )
                              .join('')}
                          \`;

                      const recommendedFixes =
                        !group.recommendedFixes ||
                        group.recommendedFixes.length === 0
                          ? '<div class="real-result-line">No refactoring guidance available.</div>'
                          : group.recommendedFixes
                              .map(
                                step => \`
                                  <div class="fix-step">

                                    <div class="step-number">
                                      \${step.order}
                                    </div>

                                    <div>

                                      <div class="step-title">
                                        \${step.title}
                                      </div>

                                      <div class="step-reason">
                                        \${step.reason}
                                      </div>

                                      <div class="real-result-line">
                                        Related to:
                                        \${step.relatedIssueTypes.join(', ')}
                                      </div>

                                    </div>

                                  </div>
                                \`
                              )
                              .join('');

                      return \`
                        <div class="real-result-card">

                          <div class="issue-header">

                            <div>

                              <div class="real-result-title">
                                #\${index + 1}
                                ·
                                \${group.title}
                              </div>

                              <div class="real-result-line">
                                \${group.primaryLocation}
                              </div>

                            </div>

                            <div
                              class="priority priority-\${priorityClass}"
                            >
                              \${group.priorityLevel.toUpperCase()}
                            </div>

                          </div>

                          <div class="score-row">

                            <span>
                              Maintainability Priority
                            </span>

                            <span class="score">
                              \${group.priorityScore} / 100
                            </span>

                          </div>

                          <div class="real-result-line">
                            Kind:
                            \${group.kind}
                          </div>

                          <div class="real-result-line">
                            Issue types:
                            \${issueTypes}
                          </div>

                          <div class="real-result-line">
                            Affected methods:
                            \${affectedMethods}
                          </div>

                          <div class="real-result-line">
                            Affected classes:
                            \${affectedClasses}
                          </div>

                          <div class="real-result-line">
                            Raw findings grouped:
                            \${group.rawFindingCount}
                          </div>

                          <div class="sub-heading">
                            Why These Findings Were Grouped
                          </div>

                          <div class="real-issue">
                            \${group.groupingReason}
                          </div>

                          \${localEvidence}

                          \${duplicateEvidence}

                          <div class="sub-heading">
                            Why This Group Is
                            \${group.priorityLevel}
                            Priority
                          </div>

                          \${priorityReasons}

                          <div class="sub-heading">
                            Recommended Fix Order
                          </div>

                          \${recommendedFixes}

                        </div>
                      \`;
                    })
                    .join('')}
                \`;

            realMethods.innerHTML =
              result.methods
                .map(method => {
                  const issues =
                    method.issues.length === 0
                      ? '<div class="real-result-line">No current method-level issues detected.</div>'
                      : method.issues
                          .map(
                            issue => \`
                              <div class="real-issue">

                                <strong>
                                  \${issue.type}
                                </strong>
                                <br>

                                \${issue.evidence}

                              </div>
                            \`
                          )
                          .join('');

                  return \`
                    <div class="real-result-card">

                      <div class="real-result-title">
                        Method:
                        \${method.methodName}()
                      </div>

                      <div class="real-result-line">
                        Lines:
                        \${method.startLine}–\${method.endLine}
                      </div>

                      <div class="real-result-line">
                        Method length:
                        \${method.methodLength}
                      </div>

                      <div class="real-result-line">
                        Parameters:
                        \${method.parameterCount}
                      </div>

                      <div class="real-result-line">
                        Cyclomatic complexity:
                        \${method.complexity}
                      </div>

                      <div class="real-result-line">
                        Nesting depth:
                        \${method.nestingDepth}
                      </div>

                      \${issues}

                    </div>
                  \`;
                })
                .join('');

            realClasses.innerHTML =
              result.classes
                .map(classItem => {
                  const issues =
                    classItem.issues.length === 0
                      ? '<div class="real-result-line">No current class-level issues detected.</div>'
                      : classItem.issues
                          .map(
                            issue => \`
                              <div class="real-issue">

                                <strong>
                                  \${issue.type}
                                </strong>
                                <br>

                                \${issue.evidence}

                              </div>
                            \`
                          )
                          .join('');

                  return \`
                    <div class="real-result-card">

                      <div class="real-result-title">
                        Class:
                        \${classItem.className}
                      </div>

                      <div class="real-result-line">
                        Class length:
                        \${classItem.classLength}
                      </div>

                      <div class="real-result-line">
                        Method count:
                        \${classItem.methodCount}
                      </div>

                      <div class="real-result-line">
                        Field count:
                        \${classItem.fieldCount}
                      </div>

                      \${issues}

                    </div>
                  \`;
                })
                .join('');

            realDuplicates.innerHTML =
              result.duplicates.length === 0
                ? ''
                : \`
                  <div class="section-title">
                    Raw Duplicated Logic Candidates
                  </div>

                  \${result.duplicates
                    .map(
                      duplicate => \`
                        <div class="real-result-card">

                          <div class="real-result-title">
                            \${duplicate.firstMethod}()
                            ↔
                            \${duplicate.secondMethod}()
                          </div>

                          <div class="real-result-line">
                            Similarity:
                            \${duplicate.similarity}%
                          </div>

                          <div class="real-result-line">
                            \${duplicate.evidence}
                          </div>

                        </div>
                      \`
                    )
                    .join('')}
                \`;
          }

        </script>

      </body>
      </html>
    `;
  }
}
