export interface NamingIndicator {
  identifier: string;
  reason: string;
}

/**
 * Names that strongly indicate placeholder or unclear method naming.
 *
 * The list is intentionally conservative to reduce false positives.
 */
const GENERIC_METHOD_NAMES = new Set([
  "doit",
  "dostuff",
  "foo",
  "bar",
  "baz",
  "method",
  "temp",
  "abc",
  "xyz",
]);

/**
 * Common placeholder class names used during development.
 */
const GENERIC_CLASS_NAMES = new Set([
  "myclass",
  "testclass",
  "tempclass",
  "sampleclass",
]);

/**
 * Checks a Java method name for measurable naming-quality indicators.
 */
export function analyzeMethodName(methodName: string): NamingIndicator | null {
  const normalizedName = methodName.toLowerCase();

  // Java method names should normally follow lowerCamelCase.
  const followsLowerCamelCase = /^[a-z][A-Za-z0-9]*$/.test(methodName);

  if (!followsLowerCamelCase) {
    return {
      identifier: methodName,
      reason:
        "Method name does not follow the expected Java lowerCamelCase naming pattern.",
    };
  }

  // Very short method names usually provide little semantic meaning.
  if (methodName.length <= 2) {
    return {
      identifier: methodName,
      reason:
        "Method name is very short and may not clearly communicate its responsibility.",
    };
  }

  // Detect obvious placeholder/generic names.
  if (GENERIC_METHOD_NAMES.has(normalizedName)) {
    return {
      identifier: methodName,
      reason:
        "Method uses a generic or placeholder-style name that may not clearly describe its responsibility.",
    };
  }

  // Detect numbered placeholder patterns such as method1 or temp2.
  const numberedPlaceholderPattern = /^(?:method|temp|foo|bar|baz|func)\d+$/;

  if (numberedPlaceholderPattern.test(normalizedName)) {
    return {
      identifier: methodName,
      reason:
        "Method uses a numbered placeholder-style name instead of a descriptive responsibility-based name.",
    };
  }

  return null;
}

/**
 * Checks a Java class name for basic naming-quality indicators.
 */
export function analyzeClassName(className: string): NamingIndicator | null {
  const normalizedName = className.toLowerCase();

  // Java class names should normally follow UpperCamelCase.
  const followsUpperCamelCase = /^[A-Z][A-Za-z0-9]*$/.test(className);

  if (!followsUpperCamelCase) {
    return {
      identifier: className,
      reason:
        "Class name does not follow the expected Java UpperCamelCase naming pattern.",
    };
  }

  if (GENERIC_CLASS_NAMES.has(normalizedName)) {
    return {
      identifier: className,
      reason:
        "Class uses a generic placeholder-style name that may not communicate its responsibility clearly.",
    };
  }

  return null;
}
