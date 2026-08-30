export interface DetectedIssue {
  type: "Long Method" | "High Complexity";
  actualValue: number;
  threshold: number;
  evidence: string;
}

export interface MethodAnalysis {
  methodName: string;
  startLine: number;
  endLine: number;
  methodLength: number;
  complexity: number;
  issues: DetectedIssue[];
}

export interface JavaAnalysisResult {
  fileName: string;
  methods: MethodAnalysis[];
  totalIssues: number;
}

const LONG_METHOD_THRESHOLD = 40;
const HIGH_COMPLEXITY_THRESHOLD = 10;

/**
 * Basic Java maintainability analyzer for the PP1 prototype.
 *
 * This analyzer works directly on Java source text and calculates
 * real method-level measurements.
 *
 * The final research implementation can later replace/extend this
 * scanner with full AST-based analysis.
 */
export function analyzeJavaSource(
  sourceCode: string,
  fileName: string,
): JavaAnalysisResult {
  const sanitizedSource = removeCommentsAndStrings(sourceCode);

  const originalLines = sourceCode.split(/\r?\n/);
  const sanitizedLines = sanitizedSource.split(/\r?\n/);

  const methods: MethodAnalysis[] = [];

  for (let lineIndex = 0; lineIndex < sanitizedLines.length; lineIndex++) {
    const currentLine = sanitizedLines[lineIndex];

    const methodMatch = findMethodDeclaration(currentLine);

    if (!methodMatch) {
      continue;
    }

    const methodName = methodMatch.methodName;

    const methodEndIndex = findMethodEnd(sanitizedLines, lineIndex);

    if (methodEndIndex === -1) {
      continue;
    }

    const methodLength = methodEndIndex - lineIndex + 1;

    const methodSource = sanitizedLines
      .slice(lineIndex, methodEndIndex + 1)
      .join("\n");

    const complexity = calculateCyclomaticComplexity(methodSource);

    const issues: DetectedIssue[] = [];

    if (methodLength > LONG_METHOD_THRESHOLD) {
      issues.push({
        type: "Long Method",
        actualValue: methodLength,
        threshold: LONG_METHOD_THRESHOLD,
        evidence:
          `Method has ${methodLength} lines ` +
          `(threshold: ${LONG_METHOD_THRESHOLD}).`,
      });
    }

    if (complexity > HIGH_COMPLEXITY_THRESHOLD) {
      issues.push({
        type: "High Complexity",
        actualValue: complexity,
        threshold: HIGH_COMPLEXITY_THRESHOLD,
        evidence:
          `Cyclomatic complexity is ${complexity} ` +
          `(threshold: ${HIGH_COMPLEXITY_THRESHOLD}).`,
      });
    }

    methods.push({
      methodName,
      startLine: lineIndex + 1,
      endLine: methodEndIndex + 1,
      methodLength,
      complexity,
      issues,
    });

    // Skip lines already analyzed as part of this method.
    lineIndex = methodEndIndex;
  }

  const totalIssues = methods.reduce(
    (total, method) => total + method.issues.length,
    0,
  );

  return {
    fileName,
    methods,
    totalIssues,
  };
}

function findMethodDeclaration(line: string): { methodName: string } | null {
  const trimmedLine = line.trim();

  if (
    trimmedLine.length === 0 ||
    trimmedLine.startsWith("if") ||
    trimmedLine.startsWith("for") ||
    trimmedLine.startsWith("while") ||
    trimmedLine.startsWith("switch") ||
    trimmedLine.startsWith("catch") ||
    trimmedLine.startsWith("else") ||
    trimmedLine.startsWith("do ")
  ) {
    return null;
  }

  const methodPattern =
    /^(?:(?:public|protected|private)\s+)?(?:(?:static|final|synchronized|abstract|native)\s+)*(?:<[^>]+>\s+)?[\w$<>\[\],.?]+\s+([A-Za-z_$][\w$]*)\s*\([^;{}]*\)\s*(?:throws\s+[^{]+)?\{/;

  const match = trimmedLine.match(methodPattern);

  if (!match) {
    return null;
  }

  return {
    methodName: match[1],
  };
}

function findMethodEnd(lines: string[], startIndex: number): number {
  let braceDepth = 0;
  let methodStarted = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    for (const character of line) {
      if (character === "{") {
        braceDepth++;
        methodStarted = true;
      }

      if (character === "}") {
        braceDepth--;
      }
    }

    if (methodStarted && braceDepth === 0) {
      return i;
    }
  }

  return -1;
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
 * Removes comments and string/character contents while preserving
 * line structure. This prevents braces or keywords inside comments
 * and strings from affecting the measurements.
 */
function removeCommentsAndStrings(source: string): string {
  let result = "";

  let inSingleLineComment = false;
  let inMultiLineComment = false;
  let inString = false;
  let inCharacter = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const current = source[i];
    const next = source[i + 1];

    if (inSingleLineComment) {
      if (current === "\n") {
        inSingleLineComment = false;
        result += "\n";
      } else {
        result += " ";
      }

      continue;
    }

    if (inMultiLineComment) {
      if (current === "*" && next === "/") {
        result += "  ";
        inMultiLineComment = false;
        i++;
      } else if (current === "\n") {
        result += "\n";
      } else {
        result += " ";
      }

      continue;
    }

    if (inString) {
      if (current === "\n") {
        result += "\n";
        escaped = false;
        continue;
      }

      if (current === '"' && !escaped) {
        inString = false;
      }

      escaped = current === "\\" && !escaped;
      result += " ";
      continue;
    }

    if (inCharacter) {
      if (current === "\n") {
        result += "\n";
        escaped = false;
        continue;
      }

      if (current === "'" && !escaped) {
        inCharacter = false;
      }

      escaped = current === "\\" && !escaped;
      result += " ";
      continue;
    }

    if (current === "/" && next === "/") {
      result += "  ";
      inSingleLineComment = true;
      i++;
      continue;
    }

    if (current === "/" && next === "*") {
      result += "  ";
      inMultiLineComment = true;
      i++;
      continue;
    }

    if (current === '"') {
      result += " ";
      inString = true;
      escaped = false;
      continue;
    }

    if (current === "'") {
      result += " ";
      inCharacter = true;
      escaped = false;
      continue;
    }

    result += current;
  }

  return result;
}
