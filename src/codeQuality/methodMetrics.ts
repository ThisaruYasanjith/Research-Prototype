import { findBlockEnd, sanitizeJavaSource } from "./analysisUtils";

import { MethodMetrics } from "./analyzerTypes";

interface MethodDeclaration {
  methodName: string;
  parameterText: string;
  declarationEndIndex: number;
}

const MAX_DECLARATION_LINES = 12;

export function extractMethodMetrics(sourceCode: string): MethodMetrics[] {
  const sanitizedSource = sanitizeJavaSource(sourceCode);

  const lines = sanitizedSource.split(/\r?\n/);

  const methods: MethodMetrics[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const declaration = findMethodDeclaration(lines, lineIndex);

    if (!declaration) {
      continue;
    }

    const methodEndIndex = findBlockEnd(lines, lineIndex);

    if (methodEndIndex === -1) {
      continue;
    }

    const methodSource = lines.slice(lineIndex, methodEndIndex + 1).join("\n");

    const methodLength = methodEndIndex - lineIndex + 1;

    const parameterCount = countParameters(declaration.parameterText);

    const complexity = calculateCyclomaticComplexity(methodSource);

    const nestingDepth = calculateBlockNestingDepth(methodSource);

    methods.push({
      methodName: declaration.methodName,

      startLine: lineIndex + 1,

      endLine: methodEndIndex + 1,

      methodLength,
      parameterCount,
      complexity,
      nestingDepth,
    });

    /*
     * Move directly to the end of the method.
     *
     * This prevents blocks inside the method from
     * being considered as possible declarations.
     */
    lineIndex = methodEndIndex;
  }

  return methods;
}

/**
 * Detects both single-line and multi-line Java method
 * declarations.
 *
 * Examples supported:
 *
 * private void process(Order order) {
 *
 * and:
 *
 * private void process(
 *     Order order,
 *     User user)
 *     throws SomeException {
 */
function findMethodDeclaration(
  lines: string[],
  startIndex: number,
): MethodDeclaration | null {
  const firstLine = lines[startIndex].trim();

  if (!isPossibleMethodStart(firstLine)) {
    return null;
  }

  let declarationText = "";

  const maximumIndex = Math.min(
    lines.length - 1,
    startIndex + MAX_DECLARATION_LINES - 1,
  );

  for (let index = startIndex; index <= maximumIndex; index++) {
    const currentLine = lines[index].trim();

    declarationText += " " + currentLine;

    /*
     * A semicolon before an opening brace normally
     * indicates that this is not a concrete method
     * implementation.
     */
    if (declarationText.includes(";") && !declarationText.includes("{")) {
      return null;
    }

    if (!declarationText.includes("{")) {
      continue;
    }

    break;
  }

  if (!declarationText.includes("{")) {
    return null;
  }

  const normalizedDeclaration = declarationText.replace(/\s+/g, " ").trim();

  const methodPattern =
    /^(?:(?:public|protected|private)\s+)?(?:(?:static|final|synchronized|abstract|native|strictfp|default)\s+)*(?:<[^>]+>\s+)?[\w$<>\[\],.?]+\s+([A-Za-z_$][\w$]*)\s*\(([^;{}]*)\)\s*(?:throws\s+[^{]+)?\{/;

  const match = normalizedDeclaration.match(methodPattern);

  if (!match) {
    return null;
  }

  return {
    methodName: match[1],
    parameterText: match[2],
    declarationEndIndex:
      startIndex + countDeclarationLines(lines, startIndex) - 1,
  };
}

function isPossibleMethodStart(line: string): boolean {
  if (line.length === 0) {
    return false;
  }

  if (line.startsWith("//") || line.startsWith("*") || line.startsWith("@")) {
    return false;
  }

  const excludedStarts = [
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "else",
    "do ",
    "try",
    "return ",
    "throw ",
    "new ",
    "class ",
    "interface ",
    "enum ",
    "record ",
    "package ",
    "import ",
  ];

  for (const excluded of excludedStarts) {
    if (
      line === excluded ||
      line.startsWith(excluded + " ") ||
      line.startsWith(excluded + "(")
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Counts how many physical lines belong to a
 * declaration before its opening brace.
 */
function countDeclarationLines(lines: string[], startIndex: number): number {
  const maximumIndex = Math.min(
    lines.length - 1,
    startIndex + MAX_DECLARATION_LINES - 1,
  );

  for (let index = startIndex; index <= maximumIndex; index++) {
    if (lines[index].includes("{")) {
      return index - startIndex + 1;
    }
  }

  return 1;
}

function countParameters(parameterText: string): number {
  const trimmed = parameterText.trim();

  if (trimmed.length === 0) {
    return 0;
  }

  let count = 1;

  let angleDepth = 0;
  let parenthesisDepth = 0;
  let squareDepth = 0;

  for (const character of trimmed) {
    if (character === "<") {
      angleDepth++;
    } else if (character === ">") {
      angleDepth = Math.max(0, angleDepth - 1);
    } else if (character === "(") {
      parenthesisDepth++;
    } else if (character === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    } else if (character === "[") {
      squareDepth++;
    } else if (character === "]") {
      squareDepth = Math.max(0, squareDepth - 1);
    } else if (
      character === "," &&
      angleDepth === 0 &&
      parenthesisDepth === 0 &&
      squareDepth === 0
    ) {
      count++;
    }
  }

  return count;
}

function calculateCyclomaticComplexity(methodSource: string): number {
  let complexity = 1;

  const decisionPatterns = [
    /\bif\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\b/g,
    /\bcatch\s*\(/g,
    /&&/g,
    /\|\|/g,
  ];

  for (const pattern of decisionPatterns) {
    const matches = methodSource.match(pattern);

    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Calculates maximum brace nesting inside the method.
 *
 * This is a supporting prototype metric and is not
 * being presented as cognitive complexity.
 */
function calculateBlockNestingDepth(methodSource: string): number {
  let currentDepth = 0;
  let maximumDepth = 0;
  let methodRootSeen = false;

  for (const character of methodSource) {
    if (character === "{") {
      currentDepth++;

      if (!methodRootSeen) {
        methodRootSeen = true;
        continue;
      }

      const relativeDepth = currentDepth - 1;

      if (relativeDepth > maximumDepth) {
        maximumDepth = relativeDepth;
      }
    }

    if (character === "}") {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  return maximumDepth;
}
