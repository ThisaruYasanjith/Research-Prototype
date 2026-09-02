/**
 * Removes comments and string/character contents while preserving
 * line breaks and source structure.
 *
 * This prevents braces and keywords inside comments or strings
 * from affecting basic source-code measurements.
 *
 * This is shared source-processing logic so we do not duplicate
 * it across the individual analyzers.
 */
export function sanitizeJavaSource(source: string): string {
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

/**
 * Counts effective source lines inside a range of an already
 * sanitized Java source file.
 *
 * Effective source line:
 * - contains source structure/code after comments are removed
 * - is not blank
 *
 * Therefore blank lines and comment-only lines are excluded.
 *
 * Brace-only lines are intentionally counted because they remain
 * part of the source structure.
 */
export function countEffectiveSourceLines(
  sanitizedLines: string[],
  startIndex: number,
  endIndex: number,
): number {
  const safeStart = Math.max(0, startIndex);

  const safeEnd = Math.min(sanitizedLines.length - 1, endIndex);

  if (safeStart > safeEnd) {
    return 0;
  }

  let lineCount = 0;

  for (let index = safeStart; index <= safeEnd; index++) {
    const line = sanitizedLines[index].trim();

    if (line.length > 0) {
      lineCount++;
    }
  }

  return lineCount;
}

/**
 * Finds the line on which a brace-delimited Java block ends.
 */
export function findBlockEnd(lines: string[], startIndex: number): number {
  let braceDepth = 0;
  let blockStarted = false;

  for (let i = startIndex; i < lines.length; i++) {
    for (const character of lines[i]) {
      if (character === "{") {
        braceDepth++;
        blockStarted = true;
      }

      if (character === "}") {
        braceDepth--;
      }
    }

    if (blockStarted && braceDepth === 0) {
      return i;
    }
  }

  return -1;
}
