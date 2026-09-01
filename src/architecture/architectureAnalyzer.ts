import * as vscode from 'vscode';
import * as path from 'path';
import { ArchitectureScanResult, ArchitectureViolation } from './architectureTypes';

interface DependencyMatch {
  line: number;
  start: number;
  end: number;
  title: string;
  description: string;
  idSuffix: string;
}

/**
 * Scans only Maven/Spring Boot workspace roots and applies the two
 * architecture checks used by the proposal prototype.
 */
export async function scanArchitectureWorkspace(
  diagnostics: vscode.DiagnosticCollection,
  controllerRepositoryAllowed: boolean
): Promise<ArchitectureScanResult> {
  const projectFolders = await getSpringProjectFolders();

  if (projectFolders.length === 0) {
    diagnostics.clear();
    return {
      violations: [],
      workspaceMissing: true
    };
  }

  const javaFiles: vscode.Uri[] = [];

  for (const folder of projectFolders) {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, 'src/main/java/**/*.java'),
      '**/{target,build,.gradle,node_modules,out,dist}/**'
    );
    javaFiles.push(...files);
  }

  const violations: ArchitectureViolation[] = [];
  const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();
  diagnostics.clear();

  for (const file of javaFiles) {
    const document = await vscode.workspace.openTextDocument(file);
    const text = document.getText();

    // Comments are replaced by spaces while line positions are preserved.
    const codeOnly = stripCommentsPreserveLines(text);
    const lines = text.split(/\r?\n/);
    const codeLines = codeOnly.split(/\r?\n/);

    const normalizedPath = file.fsPath.replace(/\\/g, '/');
    const relativeFile = vscode.workspace
      .asRelativePath(file, false)
      .replace(/\\/g, '/');
    const fileName = path.basename(file.fsPath);

    detectServiceInControllerPackage(
      fileName,
      normalizedPath,
      relativeFile,
      codeOnly,
      codeLines,
      file,
      violations
    );

    if (!controllerRepositoryAllowed) {
      detectControllerRepositoryDependency(
        fileName,
        normalizedPath,
        relativeFile,
        codeOnly,
        codeLines,
        lines,
        file,
        violations,
        diagnosticsByFile
      );
    }
  }

  for (const file of javaFiles) {
    const fileDiagnostics = diagnosticsByFile.get(file.toString());
    if (fileDiagnostics && fileDiagnostics.length > 0) {
      diagnostics.set(file, fileDiagnostics);
    }
  }

  return {
    violations,
    workspaceMissing: false
  };
}

/**
 * Restricts the demo scan to workspace roots containing pom.xml.
 * This prevents Java files outside the opened Spring Boot project
 * from appearing as architecture violations.
 */
async function getSpringProjectFolders(): Promise<vscode.WorkspaceFolder[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const springProjectFolders: vscode.WorkspaceFolder[] = [];

  for (const folder of folders) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(folder.uri, 'pom.xml'));
      springProjectFolders.push(folder);
    } catch {
      // Ignore workspace roots that are not the opened Maven/Spring project.
    }
  }

  return springProjectFolders;
}

/**
 * Demo structure rule:
 * A Service class must not be created inside the controller package.
 */
function detectServiceInControllerPackage(
  fileName: string,
  normalizedPath: string,
  relativeFile: string,
  codeOnly: string,
  codeLines: string[],
  file: vscode.Uri,
  violations: ArchitectureViolation[]
): void {
  const looksLikeService =
    /Service\.java$/i.test(fileName) ||
    /@Service\b/.test(codeOnly);

  const insideControllerPackage =
    /\/src\/main\/java\/.*\/controller\//i.test(normalizedPath) ||
    /package\s+[\w.]*controller\s*;/.test(codeOnly);

  if (!looksLikeService || !insideControllerPackage) {
    return;
  }

  const foundLine = codeLines.findIndex(
    (line: string) =>
      /\bclass\s+\w+Service\b/.test(line) ||
      /@Service\b/.test(line)
  );

  violations.push({
    id: `structure:${normalizedPath}`,
    kind: 'structure',
    title: 'Service placed in Controller package',
    description:
      `${fileName} is classified as a Service but is located inside the Controller package.`,
    file: file.fsPath,
    relativeFile,
    line: Math.max(0, foundLine),
    severity: 'High',
    expected: 'Service classes → service package',
    found: `${fileName} → controller package`
  });
}

/**
 * Demo dependency rule:
 * Controller → Repository direct access is prohibited unless the
 * rule has been explicitly overridden through the chatbot.
 *
 * Both imports and Repository field declarations are detected.
 */
function detectControllerRepositoryDependency(
  fileName: string,
  normalizedPath: string,
  relativeFile: string,
  codeOnly: string,
  codeLines: string[],
  originalLines: string[],
  file: vscode.Uri,
  violations: ArchitectureViolation[],
  diagnosticsByFile: Map<string, vscode.Diagnostic[]>
): void {
  const looksLikeController =
    /Controller\.java$/i.test(fileName) ||
    /@(RestController|Controller)\b/.test(codeOnly);

  if (!looksLikeController) {
    return;
  }

  const matches: DependencyMatch[] = [];

  findRepositoryImports(fileName, codeLines, originalLines, matches);
  findRepositoryFields(fileName, codeLines, originalLines, matches);

  for (const match of matches) {
    addRepositoryDiagnostic(
      file,
      normalizedPath,
      relativeFile,
      match,
      violations,
      diagnosticsByFile
    );
  }
}

function findRepositoryImports(
  fileName: string,
  codeLines: string[],
  originalLines: string[],
  matches: DependencyMatch[]
): void {
  for (let index = 0; index < codeLines.length; index += 1) {
    const codeLine = codeLines[index];

    const importMatch =
      /^\s*import\s+[\w.]*repository\.([A-Za-z_$][\w$]*Repository)\s*;\s*$/.exec(
        codeLine
      );

    if (!importMatch) {
      continue;
    }

    const repositoryType = importMatch[1];
    const originalLine = originalLines[index] ?? '';
    const startColumn = Math.max(0, originalLine.indexOf(repositoryType));

    matches.push({
      line: index,
      start: startColumn,
      end: startColumn + repositoryType.length,
      title: 'Controller directly imports Repository',
      description:
        `${fileName} imports ${repositoryType} directly and bypasses the Service layer.`,
      idSuffix: `import:${index}`
    });
  }
}

function findRepositoryFields(
  fileName: string,
  codeLines: string[],
  originalLines: string[],
  matches: DependencyMatch[]
): void {
  for (let index = 0; index < codeLines.length; index += 1) {
    const codeLine = codeLines[index];

    // Example: private UserRepository userRepository;
    const fieldMatch =
      /^\s*(?:private|protected|public)?\s*(?:final\s+)?([A-Za-z_$][\w$]*Repository)\s+[A-Za-z_$][\w$]*\s*(?:[;=,]|$)/.exec(
        codeLine
      );

    if (!fieldMatch) {
      continue;
    }

    const repositoryType = fieldMatch[1];
    const originalLine = originalLines[index] ?? '';
    const startColumn = Math.max(0, originalLine.indexOf(repositoryType));

    const duplicate = matches.some(
      (item) => item.line === index && item.start === startColumn
    );

    if (duplicate) {
      continue;
    }

    matches.push({
      line: index,
      start: startColumn,
      end: startColumn + repositoryType.length,
      title: 'Controller directly declares Repository dependency',
      description:
        `${fileName} declares ${repositoryType} directly inside the Controller.`,
      idSuffix: `field:${index}`
    });
  }
}

function addRepositoryDiagnostic(
  file: vscode.Uri,
  normalizedPath: string,
  relativeFile: string,
  match: DependencyMatch,
  violations: ArchitectureViolation[],
  diagnosticsByFile: Map<string, vscode.Diagnostic[]>
): void {
  const range = new vscode.Range(
    new vscode.Position(match.line, match.start),
    new vscode.Position(match.line, match.end)
  );

  const diagnostic = new vscode.Diagnostic(
    range,
    'Architecture violation: Controller must access persistence through the Service layer, not depend on a Repository directly.',
    vscode.DiagnosticSeverity.Error
  );

  diagnostic.source = 'Architecture Governance';
  diagnostic.code = 'ARCH-LAYER-001';

  const key = file.toString();
  const fileDiagnostics = diagnosticsByFile.get(key) ?? [];
  fileDiagnostics.push(diagnostic);
  diagnosticsByFile.set(key, fileDiagnostics);

  violations.push({
    id: `dependency:${normalizedPath}:${match.idSuffix}`,
    kind: 'dependency',
    title: match.title,
    description: match.description,
    file: file.fsPath,
    relativeFile,
    line: match.line,
    severity: 'High',
    expected: 'Controller → Service → Repository',
    found: 'Controller → Repository'
  });
}

/**
 * Removes // and block comments while preserving line breaks and
 * character positions. This prevents commented-out imports or fields
 * from triggering diagnostics.
 */
function stripCommentsPreserveLines(input: string): string {
  let result = '';
  let i = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inString = false;
  let inChar = false;
  let escaped = false;

  while (i < input.length) {
    const current = input[i];
    const next = input[i + 1] ?? '';

    if (inLineComment) {
      if (current === '\n') {
        inLineComment = false;
        result += '\n';
      } else if (current === '\r') {
        result += '\r';
      } else {
        result += ' ';
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (current === '*' && next === '/') {
        result += '  ';
        inBlockComment = false;
        i += 2;
        continue;
      }

      result += current === '\n' || current === '\r' ? current : ' ';
      i += 1;
      continue;
    }

    if (inString || inChar) {
      result += current;

      if (escaped) {
        escaped = false;
      } else if (current === '\\') {
        escaped = true;
      } else if (inString && current === '"') {
        inString = false;
      } else if (inChar && current === "'") {
        inChar = false;
      }

      i += 1;
      continue;
    }

    if (current === '/' && next === '/') {
      result += '  ';
      inLineComment = true;
      i += 2;
      continue;
    }

    if (current === '/' && next === '*') {
      result += '  ';
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (current === '"') {
      inString = true;
    } else if (current === "'") {
      inChar = true;
    }

    result += current;
    i += 1;
  }

  return result;
}
