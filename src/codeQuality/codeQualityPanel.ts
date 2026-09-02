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
            transition:
              border-color 0.15s ease,
              background-color 0.15s ease;
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

          .rank-label {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            margin-bottom: 4px;
          }

          .issue-location {
            font-family: var(--vscode-editor-font-family, monospace);
            font-weight: 600;
            word-break: break-word;
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
            word-break: break-word;
          }

          .details-meta {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 12px;
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            line-height: 1.6;
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
            line-height: 1.45;
          }

          .grouping-box {
            padding: 8px 10px;
            border-left: 2px solid var(--vscode-focusBorder);
            background: var(--vscode-textBlockQuote-background);
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            line-height: 1.5;
          }

          .explanation {
            font-size: 12px;
            line-height: 1.5;
            color: var(--vscode-descriptionForeground);
          }

          .priority-reason {
            padding: 4px 0;
          }

          .priority-reason::before {
            content: "• ";
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
            width: 24px;
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

          .step-related {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            margin-top: 4px;
          }

          .empty-state {
            padding: 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background: var(--vscode-editorWidget-background);
            color: var(--vscode-descriptionForeground);
            text-align: center;
            font-size: 11px;
          }

          @media (max-width: 600px) {
            .summary-grid {
              grid-template-columns: 1fr;
            }
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

              <div
                class="target-file"
                id="targetFile"
              >
                Open a Java file to analyze
              </div>
            </div>

            <button
              class="analyze-button"
              id="analyzeButton"
            >
              Analyze Current File
            </button>

          </div>
        </div>

        <div
          class="analysis-status"
          id="analysisStatus"
        ></div>

        <div
          class="analysis-results"
          id="analysisResults"
        >

          <div class="summary-grid">

            <div class="summary-card">

              <div
                class="summary-number"
                id="groupCount"
              >
                0
              </div>

              <div class="summary-label">
                Issue Groups
              </div>

            </div>

            <div class="summary-card">

              <div
                class="summary-number"
                id="highPriorityCount"
              >
                0
              </div>

              <div class="summary-label">
                High Priority
              </div>

            </div>

            <div class="summary-card">

              <div
                class="summary-number"
                id="issueCount"
              >
                0
              </div>

              <div class="summary-label">
                Detected Issues
              </div>

            </div>

          </div>

          <div class="section-title">
            Ranked Maintainability Issues
          </div>

          <div id="rankedGroups"></div>

          <div
            class="details-card"
            id="detailsCard"
          >

            <div
              class="details-title"
              id="detailTitle"
            ></div>

            <div
              class="details-location"
              id="detailLocation"
            ></div>

            <div
              class="details-meta"
              id="detailMeta"
            ></div>

            <div class="sub-heading">
              Why These Findings Were Grouped
            </div>

            <div
              class="grouping-box"
              id="groupingReason"
            ></div>

            <div class="sub-heading">
              Analysis Evidence
            </div>

            <div id="evidenceContainer"></div>

            <div
              class="sub-heading"
              id="priorityHeading"
            >
              Why This Group Has This Priority
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
          const vscode =
            acquireVsCodeApi();

          const analyzeButton =
            document.getElementById(
              'analyzeButton'
            );

          const analysisStatus =
            document.getElementById(
              'analysisStatus'
            );

          const analysisResults =
            document.getElementById(
              'analysisResults'
            );

          const targetFile =
            document.getElementById(
              'targetFile'
            );

          const groupCount =
            document.getElementById(
              'groupCount'
            );

          const highPriorityCount =
            document.getElementById(
              'highPriorityCount'
            );

          const issueCount =
            document.getElementById(
              'issueCount'
            );

          const rankedGroups =
            document.getElementById(
              'rankedGroups'
            );

          const detailsCard =
            document.getElementById(
              'detailsCard'
            );

          const detailTitle =
            document.getElementById(
              'detailTitle'
            );

          const detailLocation =
            document.getElementById(
              'detailLocation'
            );

          const detailMeta =
            document.getElementById(
              'detailMeta'
            );

          const groupingReason =
            document.getElementById(
              'groupingReason'
            );

          const evidenceContainer =
            document.getElementById(
              'evidenceContainer'
            );

          const priorityHeading =
            document.getElementById(
              'priorityHeading'
            );

          const priorityExplanation =
            document.getElementById(
              'priorityExplanation'
            );

          const fixOrderContainer =
            document.getElementById(
              'fixOrderContainer'
            );

          let currentResult = null;
          let selectedGroupIndex = 0;

          analyzeButton.addEventListener(
            'click',
            () => {
              analyzeButton.disabled =
                true;

              analyzeButton.textContent =
                'Analyzing...';

              analysisStatus.style.display =
                'block';

              analysisStatus.textContent =
                'Running real Java maintainability analysis...';

              analysisResults.classList.remove(
                'visible'
              );

              vscode.postMessage({
                command:
                  'analyzeCurrentFile'
              });
            }
          );

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

                analysisResults.classList.remove(
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

              currentResult =
                message.result;

              selectedGroupIndex = 0;

              targetFile.textContent =
                currentResult.fileName;

              analyzeButton.disabled =
                false;

              analyzeButton.textContent =
                'Analyze Again';

              analysisStatus.style.display =
                'block';

              analysisStatus.textContent =
                'Analysis complete. ' +
                currentResult.totalIssues +
                ' maintainability issue(s) detected.';

              renderAnalysis(
                currentResult
              );

              analysisResults.classList.add(
                'visible'
              );
            }
          );

          function renderAnalysis(
            result
          ) {
            const highCount =
              result.groups.filter(
                group =>
                  group.priorityLevel ===
                  'High'
              ).length;

            groupCount.textContent =
              String(
                result.groups.length
              );

            highPriorityCount.textContent =
              String(highCount);

            issueCount.textContent =
              String(
                result.totalIssues
              );

            renderRankedGroups(
              result.groups
            );

            if (
              result.groups.length ===
              0
            ) {
              detailsCard.style.display =
                'none';

              return;
            }

            detailsCard.style.display =
              'block';

            renderGroupDetails(
              result.groups[0],
              0
            );
          }

          function renderRankedGroups(
            groups
          ) {
            if (
              groups.length === 0
            ) {
              rankedGroups.innerHTML = \`
                <div class="empty-state">
                  No maintainability concerns were detected
                  using the current prototype rules.
                </div>
              \`;

              return;
            }

            rankedGroups.innerHTML =
              groups
                .map(
                  (group, index) => {
                    const priorityClass =
                      group.priorityLevel
                        .toLowerCase();

                    const displayLocation =
                      getDisplayLocation(
                        group
                      );

                    const tags =
                      group.issueTypes
                        .map(
                          issueType => \`
                            <span class="issue-tag">
                              \${escapeHtml(
                                issueType
                              )}
                            </span>
                          \`
                        )
                        .join('');

                    const activeClass =
                      index ===
                      selectedGroupIndex
                        ? ' active'
                        : '';

                    return \`
                      <div
                        class="issue-card issue-selectable\${activeClass}"
                        data-group-index="\${index}"
                      >

                        <div class="issue-header">

                          <div>

                            <div class="rank-label">
                              Priority Rank #\${index + 1}
                            </div>

                            <div class="issue-location">
                              \${escapeHtml(
                                displayLocation
                              )}
                            </div>

                          </div>

                          <div
                            class="priority priority-\${priorityClass}"
                          >
                            \${escapeHtml(
                              group.priorityLevel
                                .toUpperCase()
                            )}
                          </div>

                        </div>

                        <div class="issue-tags">
                          \${tags}
                        </div>

                        <div class="score-row">

                          <span>
                            Maintainability Priority
                          </span>

                          <span class="score">
                            \${group.priorityScore} / 100
                          </span>

                        </div>

                      </div>
                    \`;
                  }
                )
                .join('');

            document
              .querySelectorAll(
                '.issue-selectable'
              )
              .forEach(
                card => {
                  card.addEventListener(
                    'click',
                    () => {
                      if (!currentResult) {
                        return;
                      }

                      const indexText =
                        card.getAttribute(
                          'data-group-index'
                        );

                      if (
                        indexText ===
                        null
                      ) {
                        return;
                      }

                      const index =
                        Number(
                          indexText
                        );

                      if (
                        Number.isNaN(
                          index
                        ) ||
                        !currentResult
                          .groups[index]
                      ) {
                        return;
                      }

                      selectedGroupIndex =
                        index;

                      document
                        .querySelectorAll(
                          '.issue-selectable'
                        )
                        .forEach(
                          item =>
                            item.classList.remove(
                              'active'
                            )
                        );

                      card.classList.add(
                        'active'
                      );

                      renderGroupDetails(
                        currentResult
                          .groups[index],
                        index
                      );
                    }
                  );
                }
              );
          }

          function renderGroupDetails(
            group,
            index
          ) {
            const displayLocation =
              getDisplayLocation(
                group
              );

            detailTitle.textContent =
              group.priorityLevel +
              ' Priority Issue Group';

            detailLocation.textContent =
              currentResult.fileName +
              ' → ' +
              displayLocation;

            const affectedMethods =
              group.affectedMethods
                .length === 0
                ? 'None'
                : group
                    .affectedMethods
                    .map(
                      method =>
                        escapeHtml(
                          method + '()'
                        )
                    )
                    .join(', ');

            const affectedClasses =
              group.affectedClasses
                .length === 0
                ? 'None'
                : group
                    .affectedClasses
                    .map(
                      className =>
                        escapeHtml(
                          className
                        )
                    )
                    .join(', ');

            detailMeta.innerHTML = \`
              <div>
                <strong>
                  Priority Rank:
                </strong>
                #\${index + 1}
              </div>

              <div>
                <strong>
                  Maintainability Priority:
                </strong>
                \${group.priorityScore} / 100
              </div>

              <div>
                <strong>
                  Issue Types:
                </strong>
                \${group.issueTypes
                  .map(
                    issueType =>
                      escapeHtml(
                        issueType
                      )
                  )
                  .join(', ')}
              </div>

              <div>
                <strong>
                  Affected Methods:
                </strong>
                \${affectedMethods}
              </div>

              <div>
                <strong>
                  Affected Classes:
                </strong>
                \${affectedClasses}
              </div>

              <div>
                <strong>
                  Raw Findings Grouped:
                </strong>
                \${group.rawFindingCount}
              </div>
            \`;

            groupingReason.textContent =
              group.groupingReason;

            renderEvidence(
              group
            );

            priorityHeading.textContent =
              'Why This Group Is ' +
              group.priorityLevel +
              ' Priority';

            renderPriorityExplanation(
              group
            );

            renderFixOrder(
              group
            );
          }

          function renderEvidence(
            group
          ) {
            const evidence = [];

            for (
              const issue of
              group.issues
            ) {
              evidence.push({
                name:
                  issue.type,

                value:
                  issue.evidence
              });
            }

            for (
              const duplicate of
              group.duplicatePairs
            ) {
              evidence.push({
                name:
                  duplicate.firstMethod +
                  '() ↔ ' +
                  duplicate.secondMethod +
                  '()',

                value:
                  'Structural similarity: ' +
                  duplicate.similarity +
                  '% · Configured threshold: ' +
                  duplicate.threshold +
                  '%'
              });
            }

            if (
              evidence.length === 0
            ) {
              evidenceContainer.innerHTML =
                \`
                  <div class="evidence-values">
                    No additional analysis evidence is available.
                  </div>
                \`;

              return;
            }

            evidenceContainer.innerHTML =
              evidence
                .map(
                  item => \`
                    <div class="evidence-row">

                      <div class="evidence-name">
                        \${escapeHtml(
                          item.name
                        )}
                      </div>

                      <div class="evidence-values">
                        \${escapeHtml(
                          item.value
                        )}
                      </div>

                    </div>
                  \`
                )
                .join('');
          }

          function renderPriorityExplanation(
            group
          ) {
            if (
              group.priorityReasons
                .length === 0
            ) {
              priorityExplanation.textContent =
                'No additional priority evidence is available.';

              return;
            }

            priorityExplanation.innerHTML =
              group.priorityReasons
                .map(
                  reason => \`
                    <div class="priority-reason">
                      \${escapeHtml(
                        reason
                      )}
                    </div>
                  \`
                )
                .join('');
          }

          function renderFixOrder(
            group
          ) {
            if (
              !group.recommendedFixes ||
              group.recommendedFixes
                .length === 0
            ) {
              fixOrderContainer.innerHTML =
                \`
                  <div class="evidence-values">
                    No refactoring guidance is currently available.
                  </div>
                \`;

              return;
            }

            fixOrderContainer.innerHTML =
              group.recommendedFixes
                .map(
                  step => {
                    const related =
                      step
                        .relatedIssueTypes
                        .map(
                          issueType =>
                            escapeHtml(
                              issueType
                            )
                        )
                        .join(', ');

                    return \`
                      <div class="fix-step">

                        <div class="step-number">
                          \${step.order}
                        </div>

                        <div>

                          <div class="step-title">
                            \${escapeHtml(
                              step.title
                            )}
                          </div>

                          <div class="step-reason">
                            \${escapeHtml(
                              step.reason
                            )}
                          </div>

                          <div class="step-related">
                            Related to:
                            \${related}
                          </div>

                        </div>

                      </div>
                    \`;
                  }
                )
                .join('');
          }

          function getDisplayLocation(
            group
          ) {
            if (
              group.kind ===
                'Duplication Cluster' &&
              group.affectedMethods
                .length > 2
            ) {
              return (
                group
                  .affectedMethods[0] +
                '() + ' +
                (
                  group
                    .affectedMethods
                    .length - 1
                ) +
                ' related methods'
              );
            }

            return group.primaryLocation;
          }

          function escapeHtml(
            value
          ) {
            return String(value)
              .replace(
                /&/g,
                '&amp;'
              )
              .replace(
                /</g,
                '&lt;'
              )
              .replace(
                />/g,
                '&gt;'
              )
              .replace(
                /"/g,
                '&quot;'
              )
              .replace(
                /'/g,
                '&#039;'
              );
          }

        </script>

      </body>
      </html>
    `;
  }
}
