/**
 * This gives class-level measurements.
 * Again, we are not yet calling a class “Large Class.”
 * We are only measuring it.

 */
import { findBlockEnd, sanitizeJavaSource } from "./analysisUtils";
import { ClassMetrics, MethodMetrics } from "./analyzerTypes";

export function extractClassMetrics(
  sourceCode: string,
  methods: MethodMetrics[],
): ClassMetrics[] {
  const sanitizedSource = sanitizeJavaSource(sourceCode);
  const lines = sanitizedSource.split(/\r?\n/);

  const classes: ClassMetrics[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const className = findClassDeclaration(lines[lineIndex]);

    if (!className) {
      continue;
    }

    const classEndIndex = findBlockEnd(lines, lineIndex);

    if (classEndIndex === -1) {
      continue;
    }

    const startLine = lineIndex + 1;
    const endLine = classEndIndex + 1;

    const classMethods = methods.filter(
      (method) => method.startLine >= startLine && method.endLine <= endLine,
    );

    const fieldCount = countClassFields(lines, lineIndex, classEndIndex);

    classes.push({
      className,
      startLine,
      endLine,
      classLength: classEndIndex - lineIndex + 1,
      methodCount: classMethods.length,
      fieldCount,
    });

    lineIndex = classEndIndex;
  }

  return classes;
}

function findClassDeclaration(line: string): string | null {
  const match = line.match(/\b(?:class|record|enum)\s+([A-Za-z_$][\w$]*)/);

  return match ? match[1] : null;
}

function countClassFields(
  lines: string[],
  startIndex: number,
  endIndex: number,
): number {
  let fieldCount = 0;
  let braceDepth = 0;

  for (let i = startIndex; i <= endIndex; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (braceDepth === 1 && looksLikeFieldDeclaration(trimmedLine)) {
      fieldCount++;
    }

    for (const character of line) {
      if (character === "{") {
        braceDepth++;
      } else if (character === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
      }
    }
  }

  return fieldCount;
}

function looksLikeFieldDeclaration(line: string): boolean {
  if (
    line.length === 0 ||
    !line.endsWith(";") ||
    line.startsWith("return ") ||
    line.startsWith("throw ") ||
    line.startsWith("package ") ||
    line.startsWith("import ")
  ) {
    return false;
  }

  const fieldPattern =
    /^(?:(?:public|protected|private)\s+)?(?:(?:static|final|transient|volatile)\s+)*[\w$<>\[\],.?]+\s+[A-Za-z_$][\w$]*(?:\s*=.*)?;/;

  return fieldPattern.test(line);
}
