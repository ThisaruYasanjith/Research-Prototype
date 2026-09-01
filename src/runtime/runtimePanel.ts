import * as vscode from 'vscode';

export class RuntimePanel {
  private static currentPanel: vscode.WebviewPanel | undefined;

  public static show(context: vscode.ExtensionContext) {
    if (RuntimePanel.currentPanel) {
      RuntimePanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'runtimePanel',
      'Exception Analysis',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    RuntimePanel.currentPanel = panel;
    panel.onDidDispose(() => {
      RuntimePanel.currentPanel = undefined;
    });

    panel.webview.html = RuntimePanel.getHtmlContent();
  }

  private static getHtmlContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons/dist/codicon.css">
        <style>
          body {
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            padding: 16px;
            margin: 0;
            line-height: 1.45;
          }
          .file-target {
            font-family: var(--vscode-editor-font-family, monospace);
            color: var(--vscode-textLink-foreground);
            margin-bottom: 8px;
            font-size: 13px;
          }
          .title-section {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .title-section h2 { 
            margin: 0 0 8px 0; 
            font-size: 16px; 
            font-weight: 600;
          }
          .overall-status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
          }
          .badge-warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground, #cca700);
            border: 1px solid var(--vscode-inputValidation-warningBorder, #cca700);
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .badge-success {
            background-color: rgba(115, 201, 145, 0.15);
            color: #73c991;
            border: 1px solid #73c991;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
          }
          .badge-danger {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground, #f48771);
            border: 1px solid var(--vscode-inputValidation-errorBorder, #f48771);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
          }
          .section-card {
            background-color: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
            border-radius: 4px;
            padding: 14px;
            margin-bottom: 14px;
          }
          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 13px;
          }
          .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px 12px;
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            margin: 8px 0;
            border: 1px solid var(--vscode-panel-border);
            white-space: pre;
            overflow-x: auto;
          }
          .flow-block {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px 14px;
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            line-height: 1.4;
            color: var(--vscode-editorLightBulb-foreground);
            margin: 8px 0;
            border: 1px solid var(--vscode-panel-border);
            text-align: center;
            width: fit-content;
          }
          .assessment-note {
            margin-top: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .summary-card {
            background-color: var(--vscode-sideBar-background, var(--vscode-editorWidget-background));
            border-left: 3px solid var(--vscode-inputValidation-warningBorder, #cca700);
            padding: 12px;
            border-radius: 0 4px 4px 0;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="file-target">FileProcessor.java:42</div>
        
        <div class="title-section">
          <h2>Exception Handling Quality</h2>
          <div class="overall-status">
            <span>Overall Assessment:</span>
            <span class="badge-warning">Needs Attention</span>
          </div>
        </div>

        <!-- Section 1 -->
        <div class="section-card">
          <div class="section-header">
            <span>1. Exception Handling Appropriateness</span>
            <span class="badge-success">Aligned</span>
          </div>
          <p style="margin: 0 0 8px 0;">
            The method <code>loadFile()</code> explicitly declares <code>IOException</code>, and the handler catches <code>IOException</code>. Therefore, the selected exception type is aligned with the exception flow represented in the analyzed code.
          </p>
          <div style="font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground);">Evidence:</div>
          <div class="code-block">void loadFile() throws IOException {
    ...
}

try {
    loadFile();
} catch (IOException e) {
    logger.error("File processing failed", e);
}</div>
          <div class="assessment-note">
            <strong>Assessment:</strong> The handler does not appear to use an unnecessarily broad or unrelated exception type.
          </div>
        </div>

    <!-- Section 2 -->
<div class="section-card">
  <div class="section-header">
    <span>2. Exception-Flow Coverage</span>
    <span class="badge-success">Covered</span>
  </div>
  <p style="margin: 0 0 8px 0;">
    The analyzed code indicates that <code>IOException</code> can propagate from <code>loadFile()</code> to the surrounding <code>try</code> block. A corresponding <code>catch(IOException)</code> handler is present, so the explicitly represented exception flow has a handling path.
  </p>
  
  <div style="font-size: 11px; font-weight: 600; color: var(--vscode-descriptionForeground); margin-bottom: 8px;">Exception flow:</div>
  
  <!-- Stepper / Track Flow -->
  <div class="flow-track">
    <div class="track-step">
      <div class="track-indicator">
        <span class="track-dot"></span>
        <span class="track-line"></span>
      </div>
      <div class="track-content">
        <span class="node-tag">loadFile()</span>
      </div>
    </div>

    <div class="track-step">
      <div class="track-indicator">
        <span class="track-dot warning"></span>
        <span class="track-line"></span>
      </div>
      <div class="track-content">
        <span class="node-tag warning">IOException</span>
      </div>
    </div>

    <div class="track-step">
      <div class="track-indicator">
        <span class="track-dot"></span>
        <span class="track-line"></span>
      </div>
      <div class="track-content">
        <span class="node-tag">try block</span>
      </div>
    </div>

    <div class="track-step">
      <div class="track-indicator">
        <span class="track-dot"></span>
        <span class="track-line"></span>
      </div>
      <div class="track-content">
        <span class="node-tag">catch(IOException)</span>
      </div>
    </div>

    <div class="track-step">
      <div class="track-indicator">
        <span class="track-dot success"></span>
      </div>
      <div class="track-content">
        <span class="node-tag success">handler</span>
      </div>
    </div>
  </div>

  <div class="assessment-note">
    <strong>Assessment:</strong> The identified <code>IOException</code> flow is covered by an explicit handler. No missing handling or propagation path was identified for this flow.
  </div>
</div>

        <!-- Section 3 -->
        <div class="section-card">
          <div class="section-header">
            <span>3. Handler Response Quality</span>
            <span class="badge-danger">Limited</span>
          </div>
          <p style="margin: 0 0 8px 0;">
            The handler logs the exception but does not perform an identifiable recovery, compensation, translation, or propagation action.
          </p>
          <div class="code-block">catch (IOException e) {
    logger.error("File processing failed", e);
}</div>
          <div class="assessment-note">
            <strong>Assessment:</strong> The failure is recorded, but the exception terminates at this handler. Whether this is appropriate depends on whether this layer is responsible for handling the failure or should allow a higher-level component to respond.
          </div>
        </div>

        <!-- Final Summary -->
        <div class="summary-card">
          <div style="font-weight: 600; margin-bottom: 4px;">Overall Assessment</div>
          <div style="font-size: 12px; margin-bottom: 6px;">
            The exception type is appropriately aligned with the existing exception flow, and the represented flow is explicitly covered. However, the handler provides only a limited response because the exception is logged and then suppressed.
          </div>
          <div style="font-size: 12px; font-weight: 600; color: var(--vscode-editorWarning-foreground);">
            Main concern: Handler Response Quality
          </div>
        </div>
      </body>
      </html>
    `;
  }
}