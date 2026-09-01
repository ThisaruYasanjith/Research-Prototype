export function getArchitectureWebviewHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }
    button, select, textarea { font: inherit; }
    .page { max-width: 1000px; margin: 0 auto; padding: 22px; }
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; margin-bottom: 18px;
    }
    .brand { display: flex; align-items: center; gap: 11px; }
    .brand-mark {
      width: 34px; height: 34px; border-radius: 9px;
      display: grid; place-items: center;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground); font-weight: 750;
    }
    h1 { margin: 0; font-size: 19px; font-weight: 700; }
    .subtitle { margin-top: 4px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .prototype-chip {
      border: 1px solid var(--vscode-panel-border); border-radius: 999px;
      padding: 5px 9px; color: var(--vscode-descriptionForeground); font-size: 10px;
      background: var(--vscode-editorWidget-background);
    }
    .view { display: none; }
    .view.active { display: block; }
    .card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 11px; overflow: hidden; margin-bottom: 15px;
    }
    .card-head {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      padding: 13px 15px; border-bottom: 1px solid var(--vscode-panel-border);
    }
    .card-title { font-weight: 650; }
    .card-body { padding: 15px; }
    .muted { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    button {
      border: 0; border-radius: 6px; padding: 7px 12px; cursor: pointer;
      background: var(--vscode-button-background); color: var(--vscode-button-foreground);
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .nav-button {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-height: 40px; padding: 10px 16px; font-weight: 700;
      border: 1px solid var(--vscode-focusBorder);
      box-shadow: 0 2px 8px rgba(0,0,0,.16);
    }
    .nav-button.primary-nav {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .nav-button.primary-nav:hover { background: var(--vscode-button-hoverBackground); }
    .nav-count {
      min-width: 19px; height: 19px; border-radius: 999px; padding: 0 5px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 10px;
    }
    .label { display: block; color: var(--vscode-descriptionForeground); font-size: 11px; margin-bottom: 6px; }
    select, textarea {
      width: 100%; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 6px; background: var(--vscode-input-background);
      color: var(--vscode-input-foreground); outline: none;
    }
    select { padding: 8px 10px; }
    textarea { min-height: 66px; resize: vertical; padding: 9px 10px; }
    select:focus, textarea:focus { border-color: var(--vscode-focusBorder); }
    .graph-shell {
      margin-top: 14px; min-height: 320px; padding: 25px;
      display: flex; align-items: center; justify-content: center;
      border: 1px dashed var(--vscode-panel-border); border-radius: 9px;
      background: color-mix(in srgb, var(--vscode-editor-background) 82%, transparent);
    }
    .graph { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .node-row { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }
    .node {
      min-width: 150px; padding: 17px 14px; text-align: center;
      border: 1px solid var(--vscode-focusBorder); border-radius: 7px;
      background: var(--vscode-editor-background); font-weight: 650;
      box-shadow: 0 5px 15px rgba(0,0,0,.11);
    }
    .node small { display: block; margin-top: 4px; color: var(--vscode-descriptionForeground); font-weight: 400; }
    .custom-node { border-style: dashed; }
    .arrow { color: var(--vscode-descriptionForeground); font-size: 19px; }
    .arrow-down { font-size: 22px; line-height: 1; }
    .legend { margin-top: 11px; color: var(--vscode-descriptionForeground); font-size: 10px; }
    .chat-box {
      height: 205px; overflow-y: auto; padding: 12px; margin-bottom: 10px;
      background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px;
    }
    .bubble { max-width: 91%; padding: 8px 10px; border-radius: 8px; margin-bottom: 8px; line-height: 1.45; }
    .assistant { background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-panel-border); }
    .user { margin-left: auto; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .input-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; }
    .send { height: 36px; }
    .chat-actions { display: flex; gap: 8px; margin-top: 9px; }
    .stats {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 15px;
    }
    .stat {
      padding: 13px; border: 1px solid var(--vscode-panel-border); border-radius: 9px;
      background: var(--vscode-editorWidget-background);
    }
    .stat-label { color: var(--vscode-descriptionForeground); font-size: 10px; margin-bottom: 7px; }
    .stat-value { font-size: 21px; font-weight: 720; }
    .stat-value.error { color: var(--vscode-editorError-foreground); }
    .violation-list { display: flex; flex-direction: column; gap: 9px; }
    .violation {
      border: 1px solid var(--vscode-panel-border);
      border-left: 3px solid var(--vscode-editorError-foreground);
      background: var(--vscode-editor-background); border-radius: 8px; padding: 11px; cursor: pointer;
    }
    .violation:hover { border-color: var(--vscode-focusBorder); }
    .v-top { display: flex; justify-content: space-between; gap: 10px; align-items: start; }
    .v-title { font-weight: 650; }
    .severity { color: var(--vscode-editorError-foreground); font-size: 10px; }
    .v-desc, .v-file { margin-top: 5px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .rule-grid { display: grid; gap: 4px; margin-top: 8px; font-size: 11px; }
    .empty {
      padding: 27px 12px; text-align: center; color: var(--vscode-descriptionForeground);
      border: 1px dashed var(--vscode-panel-border); border-radius: 8px;
    }
    @media (max-width: 650px) {
      .stats { grid-template-columns: 1fr; }
      .topbar { align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">A</div>
        <div>
          <h1>Architecture Governance</h1>
          <div class="subtitle">Architecture conformance analysis</div>
        </div>
      </div>
      <div class="prototype-chip">Architecture</div>
    </div>

    <!-- INITIAL VIEW: architecture template + chatbot only -->
    <main id="configureView" class="view active">
      <section class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Architecture Template</div>
            <div class="muted" id="architectureName">Layered Architecture</div>
          </div>
          <button id="showViolationsBtn" class="nav-button primary-nav">
            View Violations <span id="topViolationCount" class="nav-count">0</span>
          </button>
        </div>
        <div class="card-body">
          <label class="label" for="architectureSelect">Select base architecture</label>
          <select id="architectureSelect">
            <option value="layered">Layered Architecture</option>
            <option value="layeredMvc">Layered Architecture with MVC</option>
            <option value="hexagonal">Hexagonal Architecture</option>
          </select>

          <div class="graph-shell"><div id="graph" class="graph"></div></div>
          <div class="legend">Solid box = base component &nbsp;•&nbsp; Dashed box = chatbot-added component</div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Architecture Assistant</div>
            <div class="muted">Describe project-specific architecture changes using natural language</div>
          </div>
        </div>
        <div class="card-body">
          <div id="chat" class="chat-box">
            <div class="bubble assistant">Describe a project-specific architecture change.</div>
          </div>
          <div class="input-row">
            <textarea id="message" placeholder="Describe an architecture modification..."></textarea>
            <button id="sendBtn" class="send">Send</button>
          </div>
        </div>
      </section>
    </main>

    <!-- VIOLATIONS VIEW -->
    <main id="violationsView" class="view">
      <div class="toolbar" style="justify-content: space-between; margin-bottom: 14px;">
        <button id="configureBtn" class="nav-button primary-nav">← Configure Architecture</button>
        <button id="refreshBtn" class="secondary">Refresh Analysis</button>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-label">TOTAL VIOLATIONS</div>
          <div id="statTotal" class="stat-value error">0</div>
        </div>
        <div class="stat">
          <div class="stat-label">DEPENDENCY VIOLATIONS</div>
          <div id="statDependency" class="stat-value">0</div>
        </div>
        <div class="stat">
          <div class="stat-label">STRUCTURE VIOLATIONS</div>
          <div id="statStructure" class="stat-value">0</div>
        </div>
      </div>

      <section class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Detected Architecture Violations</div>
            <div class="muted">Click a violation to open its source file</div>
          </div>
        </div>
        <div class="card-body">
          <div id="violations" class="violation-list">
            <div class="empty">No architecture violations detected.</div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const configureView = document.getElementById('configureView');
    const violationsView = document.getElementById('violationsView');
    const showViolationsBtn = document.getElementById('showViolationsBtn');
    const configureBtn = document.getElementById('configureBtn');
    const architectureSelect = document.getElementById('architectureSelect');
    const architectureName = document.getElementById('architectureName');
    const graph = document.getElementById('graph');
    const chat = document.getElementById('chat');
    const message = document.getElementById('message');
    const sendBtn = document.getElementById('sendBtn');
    const violations = document.getElementById('violations');
    const topViolationCount = document.getElementById('topViolationCount');
    const statTotal = document.getElementById('statTotal');
    const statDependency = document.getElementById('statDependency');
    const statStructure = document.getElementById('statStructure');
    const refreshBtn = document.getElementById('refreshBtn');

    let customAuditEnabled = false;
    let controllerRepositoryAllowed = false;
    let pendingConfirmation = false;

    const node = (name, subtitle = '', custom = false) =>
      '<div class="node ' + (custom ? 'custom-node' : '') + '">' + name +
      (subtitle ? '<small>' + subtitle + '</small>' : '') + '</div>';
    const down = '<div class="arrow arrow-down">↓</div>';
    const right = '<div class="arrow">→</div>';

    function showView(name) {
      const configuring = name === 'configure';
      configureView.classList.toggle('active', configuring);
      violationsView.classList.toggle('active', !configuring);
    }

    function renderGraph() {
      const selected = architectureSelect.value;
      const names = {
        layered: 'Layered Architecture',
        layeredMvc: 'Layered Architecture with MVC',
        hexagonal: 'Hexagonal Architecture'
      };
      architectureName.textContent = names[selected];

      if (selected === 'layered') {
        if (controllerRepositoryAllowed) {
          graph.innerHTML =
            '<div class="node-row">' +
              node('Controller', 'Presentation layer') + right +
              node('Repository', 'Direct access allowed', true) +
            '</div>' +
            down +
            '<div class="node-row">' + node('Service', 'Business layer') +
            (customAuditEnabled ? right + node('Audit', 'Custom component', true) : '') + '</div>' +
            down + node('Repository', 'Persistence layer');
        } else {
          graph.innerHTML =
            node('Controller', 'Presentation layer') + down +
            '<div class="node-row">' + node('Service', 'Business layer') +
            (customAuditEnabled ? right + node('Audit', 'Custom component', true) : '') + '</div>' +
            down + node('Repository', 'Persistence layer');
        }
      } else if (selected === 'layeredMvc') {
        graph.innerHTML =
          '<div class="node-row">' + node('View', 'MVC') + right + node('Controller', 'MVC / Presentation') + '</div>' +
          down + node('Service', 'Business layer') + down +
          '<div class="node-row">' + node('Model', 'Domain data') + right + node('Repository', 'Persistence') + '</div>';
      } else {
        graph.innerHTML =
          node('Inbound Adapter', 'REST / UI') + down +
          node('Inbound Port', 'Application API') + down +
          node('Domain / Core', 'Business rules') + down +
          node('Outbound Port', 'Required capability') + down +
          node('Outbound Adapter', 'Database / external API');
      }
    }

    function addBubble(text, role = 'assistant', html = false) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble ' + role;
      if (html) bubble.innerHTML = text; else bubble.textContent = text;
      chat.appendChild(bubble);
      chat.scrollTop = chat.scrollHeight;
      return bubble;
    }

    function submitChat() {
      const value = message.value.trim();
      if (!value || pendingConfirmation) return;

      addBubble(value, 'user');
      message.value = '';
      pendingConfirmation = true;

      vscode.postMessage({ type: 'checkChatRule', text: value });
    }

    function showStandardArchitectureProposal() {
      const bubble = addBubble(
        '<strong>Proposed architecture change</strong><br><br>' +
        '• Add component: <strong>Audit</strong><br>' +
        '• Allow: <strong>Service → Audit</strong><br>' +
        '• Prohibit direct access from Controller and Repository.<br><br>' +
        'Apply this change?',
        'assistant', true
      );

      const actions = document.createElement('div');
      actions.className = 'chat-actions';
      actions.innerHTML = '<button id="confirmChange">Confirm</button><button id="cancelChange" class="secondary">Cancel</button>';
      bubble.appendChild(actions);

      actions.querySelector('#confirmChange').addEventListener('click', () => {
        customAuditEnabled = true;
        architectureSelect.value = 'layered';
        pendingConfirmation = false;
        actions.remove();
        renderGraph();
        addBubble('Architecture updated. The Audit component is now accessible from Service only.');
      });

      actions.querySelector('#cancelChange').addEventListener('click', () => {
        pendingConfirmation = false;
        actions.remove();
        addBubble('Change cancelled.');
      });
    }

    function renderViolations(items, workspaceMissing) {
      const dependencyCount = items.filter((item) => item.kind === 'dependency').length;
      const structureCount = items.filter((item) => item.kind === 'structure').length;

      topViolationCount.textContent = String(items.length);
      statTotal.textContent = String(items.length);
      statDependency.textContent = String(dependencyCount);
      statStructure.textContent = String(structureCount);

      if (workspaceMissing) {
        violations.innerHTML = '<div class="empty">Open the Spring Boot demo project as the root folder in this Extension Development Host window.</div>';
        return;
      }

      if (!items.length) {
        violations.innerHTML = '<div class="empty">✓ No architecture violations detected.</div>';
        return;
      }

      violations.innerHTML = '';
      for (const item of items) {
        const card = document.createElement('div');
        card.className = 'violation';
        card.innerHTML =
          '<div class="v-top"><div class="v-title">' + escapeHtml(item.title) + '</div><div class="severity">' + escapeHtml(item.severity) + '</div></div>' +
          '<div class="v-desc">' + escapeHtml(item.description) + '</div>' +
          '<div class="v-file">' + escapeHtml(item.relativeFile) + ':' + (item.line + 1) + '</div>' +
          '<div class="rule-grid"><div><strong>Expected:</strong> ' + escapeHtml(item.expected) + '</div><div><strong>Found:</strong> ' + escapeHtml(item.found) + '</div></div>';
        card.addEventListener('click', () => vscode.postMessage({ type: 'openFile', file: item.file, line: item.line }));
        violations.appendChild(card);
      }
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[char]));
    }

    showViolationsBtn.addEventListener('click', () => {
      showView('violations');
      vscode.postMessage({ type: 'refresh' });
    });
    configureBtn.addEventListener('click', () => showView('configure'));
    refreshBtn.addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));

    architectureSelect.addEventListener('change', () => {
      customAuditEnabled = false;
      renderGraph();
    });

    sendBtn.addEventListener('click', submitChat);
    message.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitChat();
      }
    });

    function showConflictRuleConfirmation(conflictMessage) {
      const bubble = addBubble(
        '<strong>Rule conflict detected</strong><br><br>' +
        conflictMessage + '<br><br>' +
        'The new rule would allow <strong>Controller → Repository</strong> direct access and override the current base architecture rule.<br><br>' +
        'Apply this override?',
        'assistant',
        true
      );

      const actions = document.createElement('div');
      actions.className = 'chat-actions';
      actions.innerHTML =
        '<button id="confirmConflict">Confirm Override</button>' +
        '<button id="cancelConflict" class="secondary">Cancel</button>';

      bubble.appendChild(actions);

      actions.querySelector('#confirmConflict').addEventListener('click', () => {
        actions.remove();
        vscode.postMessage({ type: 'applyConflictRule' });
      });

      actions.querySelector('#cancelConflict').addEventListener('click', () => {
        actions.remove();
        vscode.postMessage({ type: 'cancelConflictRule' });
      });
    }

    window.addEventListener('message', (event) => {
      const payload = event.data;

      if (payload.type === 'violations') {
        renderViolations(payload.violations || [], payload.workspaceMissing);
        return;
      }

      if (payload.type === 'normalChatRule') {
        showStandardArchitectureProposal();
        return;
      }

      if (payload.type === 'conflictRuleDetected') {
        showConflictRuleConfirmation(payload.conflictMessage || 'This rule conflicts with the selected base architecture.');
        return;
      }

      if (payload.type === 'conflictRuleApplied') {
        controllerRepositoryAllowed = true;
        architectureSelect.value = 'layered';
        pendingConfirmation = false;
        renderGraph();
        addBubble('Rule override confirmed. Controller → Repository direct access is now allowed for this project.');
        return;
      }

      if (payload.type === 'conflictRuleCancelled') {
        pendingConfirmation = false;
        addBubble('The conflicting rule was not applied.');
      }
    });

    renderGraph();
    showView('configure');
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
