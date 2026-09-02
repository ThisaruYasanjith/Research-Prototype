/**
 * Extracts class-level maintainability measurements.
 *
 * This module only measures class characteristics.
 * Detection such as "Large Class" is performed later
 * by the maintainability analyzer.
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

    /*
     * Find callable declarations that belong to the
     * current class.
     */
    const classCallables = methods.filter(
      (method) => method.startLine >= startLine && method.endLine <= endLine,
    );

    /*
     * Constructors are intentionally excluded from the
     * normal method count.
     *
     * Example:
     *
     * class Example {
     *   Example() {}
     *   void save() {}
     * }
     *
     * Method count = 1
     * Constructor count is not added to methodCount.
     */
    const classMethods = classCallables.filter(
      (method) => !method.isConstructor,
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

    /*
     * Move directly to the end of the detected class so
     * statements inside it are not reconsidered as separate
     * top-level class declarations.
     */
    lineIndex = classEndIndex;
  }

  return classes;
}

/**
 * Detects Java class-like type declarations currently used
 * by the prototype class metrics.
 */
function findClassDeclaration(line: string): string | null {
  const match = line.match(/\b(?:class|record|enum)\s+([A-Za-z_$][\w$]*)/);

  return match ? match[1] : null;
}

/**
 * Counts likely class fields at the direct class-body level.
 *
 * Statements inside methods and deeper nested blocks are
 * deliberately ignored.
 */
function countClassFields(
  lines: string[],
  startIndex: number,
  endIndex: number,
): number {
  let fieldCount = 0;

  let braceDepth = 0;

  for (let index = startIndex; index <= endIndex; index++) {
    const line = lines[index];

    const trimmedLine = line.trim();

    /*
     * braceDepth === 1 means we are directly inside the
     * current class body rather than inside a method/block.
     */
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

/**
 * Uses a lightweight structural rule to identify likely
 * Java field declarations.
 */
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
