import * as vscode from 'vscode';
import { MethodInfo } from './types';

/**
 * Lightweight Java Method Detector.
 * 
 * PROTOTYPE HARD-CODED LOGIC:
 * In production, this regex/brace-matching heuristic will be replaced by
 * JavaParser / Eclipse JDT / Tree-sitter AST parsing to robustly extract
 * AST nodes, scopes, annotations, and precise method declarations.
 */
export class MethodDetector {
  public static detectCurrentMethod(editor: vscode.TextEditor): MethodInfo | undefined {
    const document = editor.document;
    const cursorLine = editor.selection.active.line;
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const methods = MethodDetector.findAllMethods(lines);

    for (const method of methods) {
      if (cursorLine >= method.startLine && cursorLine <= method.endLine) {
        return method;
      }
    }

    return undefined;
  }

  public static findAllMethods(lines: string[]): MethodInfo[] {
    const methods: MethodInfo[] = [];

    // Regex matching standard Java method declarations:
    // e.g., public void processOrder(Order order) {
    const methodHeaderRegex = /(?:public|protected|private|static|\s)+[\w<>\[\]]+\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Exclude class declarations or constructors if needed, but match standard methods
      if (line.includes('class ') || line.includes('interface ')) {
        continue;
      }

      const match = line.match(methodHeaderRegex);
      if (match) {
        const methodName = match[1];
        const rawArgs = match[2].trim();

        // Format signature e.g. processOrder(Order)
        const formattedArgs = rawArgs
          ? rawArgs.split(',').map(arg => {
              const parts = arg.trim().split(/\s+/);
              return parts[0]; // Take type name (e.g. Order)
            }).join(', ')
          : '';
        const signature = `${methodName}(${formattedArgs})`;
        const declaration = `${line.trim().replace(/\s*\{$/, '')}`;

        // Find start and end lines using brace tracking
        let braceCount = 0;
        let foundOpenBrace = false;
        let endLine = i;

        for (let j = i; j < lines.length; j++) {
          const l = lines[j];
          for (let c = 0; c < l.length; c++) {
            if (l[c] === '{') {
              braceCount++;
              foundOpenBrace = true;
            } else if (l[c] === '}') {
              braceCount--;
              if (foundOpenBrace && braceCount === 0) {
                endLine = j;
                break;
              }
            }
          }
          if (foundOpenBrace && braceCount === 0) {
            break;
          }
        }

        const bodyLines = lines.slice(i, endLine + 1);

        methods.push({
          name: methodName,
          signature,
          declaration,
          startLine: i,
          endLine,
          bodyText: bodyLines.join('\n')
        });
      }
    }

    return methods;
  }
}
