import { findBlockEnd, sanitizeJavaSource } from "./analysisUtils";

import { DuplicateAnalysis } from "./analyzerTypes";

const DUPLICATION_THRESHOLD = 75;
const MINIMUM_TOKEN_COUNT = 12;
const NGRAM_SIZE = 3;

interface MethodBlock {
  methodName: string;
  startLine: number;
  normalizedTokens: string[];
}

const JAVA_KEYWORDS = new Set([
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "float",
  "for",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "record",
  "return",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "true",
  "false",
  "try",
  "void",
  "volatile",
  "while",
]);

/**
 * Performs lightweight duplicated-logic detection between
 * methods in the same Java source file.
 *
 * The prototype normalizes identifiers/numbers and compares
 * token 3-grams using a Dice similarity coefficient.
 */
export function analyzeDuplicatedLogic(
  sourceCode: string,
): DuplicateAnalysis[] {
  const methods = extractMethodBlocks(sourceCode);

  const duplicates: DuplicateAnalysis[] = [];

  for (let i = 0; i < methods.length; i++) {
    for (let j = i + 1; j < methods.length; j++) {
      const firstMethod = methods[i];
      const secondMethod = methods[j];

      if (
        firstMethod.normalizedTokens.length < MINIMUM_TOKEN_COUNT ||
        secondMethod.normalizedTokens.length < MINIMUM_TOKEN_COUNT
      ) {
        continue;
      }

      const firstNgrams = createNgrams(
        firstMethod.normalizedTokens,
        NGRAM_SIZE,
      );

      const secondNgrams = createNgrams(
        secondMethod.normalizedTokens,
        NGRAM_SIZE,
      );

      const similarity = calculateDiceSimilarity(firstNgrams, secondNgrams);

      const similarityPercentage = Math.round(similarity * 100);

      if (similarityPercentage >= DUPLICATION_THRESHOLD) {
        duplicates.push({
          firstMethod: firstMethod.methodName,
          secondMethod: secondMethod.methodName,

          firstStartLine: firstMethod.startLine,
          secondStartLine: secondMethod.startLine,

          similarity: similarityPercentage,
          threshold: DUPLICATION_THRESHOLD,

          evidence:
            `"${firstMethod.methodName}" and ` +
            `"${secondMethod.methodName}" have ` +
            `${similarityPercentage}% normalized ` +
            `structural similarity ` +
            `(threshold: ${DUPLICATION_THRESHOLD}%).`,
        });
      }
    }
  }

  return duplicates;
}

function extractMethodBlocks(sourceCode: string): MethodBlock[] {
  const sanitizedSource = sanitizeJavaSource(sourceCode);

  const lines = sanitizedSource.split(/\r?\n/);

  const methods: MethodBlock[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const methodName = findMethodDeclaration(lines[lineIndex]);

    if (!methodName) {
      continue;
    }

    const methodEndIndex = findBlockEnd(lines, lineIndex);

    if (methodEndIndex === -1) {
      continue;
    }

    const methodSource = lines.slice(lineIndex, methodEndIndex + 1).join("\n");

    const methodBody = extractMethodBody(methodSource);

    const normalizedTokens = normalizeMethodBody(methodBody);

    methods.push({
      methodName,
      startLine: lineIndex + 1,
      normalizedTokens,
    });

    lineIndex = methodEndIndex;
  }

  return methods;
}

function findMethodDeclaration(line: string): string | null {
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

  return match ? match[1] : null;
}

function extractMethodBody(methodSource: string): string {
  const firstBrace = methodSource.indexOf("{");

  const lastBrace = methodSource.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return "";
  }

  return methodSource.slice(firstBrace + 1, lastBrace);
}
function normalizeMethodBody(methodBody: string): string[] {
  const tokenPattern =
    /[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|->|::|[{}()[\];,.?:+\-*/%<>=!&|^~]/g;

  const tokens = methodBody.match(tokenPattern) ?? [];

  return tokens.map((token) => {
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      return "NUM";
    }

    if (/^[A-Za-z_$][\w$]*$/.test(token)) {
      if (JAVA_KEYWORDS.has(token)) {
        return token;
      }

      return "ID";
    }

    return token;
  });
}

function createNgrams(tokens: string[], size: number): string[] {
  if (tokens.length < size) {
    return [];
  }

  const ngrams: string[] = [];

  for (let i = 0; i <= tokens.length - size; i++) {
    ngrams.push(tokens.slice(i, i + size).join(" "));
  }

  return ngrams;
}

/**
 * Calculates a multiset Dice similarity coefficient.
 *
 * Result:
 * 0.0 = no structural overlap
 * 1.0 = identical normalized structure
 */
function calculateDiceSimilarity(first: string[], second: string[]): number {
  if (first.length === 0 || second.length === 0) {
    return 0;
  }

  const firstCounts = createFrequencyMap(first);

  const secondCounts = createFrequencyMap(second);

  let intersection = 0;

  for (const [ngram, firstCount] of firstCounts) {
    const secondCount = secondCounts.get(ngram) ?? 0;

    intersection += Math.min(firstCount, secondCount);
  }

  return (2 * intersection) / (first.length + second.length);
}

function createFrequencyMap(values: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();

  for (const value of values) {
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  }

  return frequencies;
}
