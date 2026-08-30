import {
  DetectedIssue,
  JavaAnalysisResult,
  MethodAnalysis,
} from "./analyzerTypes";

import { extractClassMetrics } from "./classMetrics";
import { extractMethodMetrics } from "./methodMetrics";

const LONG_METHOD_THRESHOLD = 40;
const HIGH_COMPLEXITY_THRESHOLD = 10;

/**
 * Coordinates the maintainability analysis of Java source code.
 *
 * Metric extraction is delegated to dedicated method-level
 * and class-level analysis modules.
 */
export function analyzeJavaSource(
  sourceCode: string,
  fileName: string,
): JavaAnalysisResult {
  const methodMetrics = extractMethodMetrics(sourceCode);

  const methods: MethodAnalysis[] = methodMetrics.map((method) => {
    const issues: DetectedIssue[] = [];

    if (method.methodLength > LONG_METHOD_THRESHOLD) {
      issues.push({
        type: "Long Method",
        actualValue: method.methodLength,
        threshold: LONG_METHOD_THRESHOLD,
        evidence:
          `Method has ${method.methodLength} lines ` +
          `(threshold: ${LONG_METHOD_THRESHOLD}).`,
      });
    }

    if (method.complexity > HIGH_COMPLEXITY_THRESHOLD) {
      issues.push({
        type: "High Complexity",
        actualValue: method.complexity,
        threshold: HIGH_COMPLEXITY_THRESHOLD,
        evidence:
          `Cyclomatic complexity is ${method.complexity} ` +
          `(threshold: ${HIGH_COMPLEXITY_THRESHOLD}).`,
      });
    }

    return {
      ...method,
      issues,
    };
  });

  const classes = extractClassMetrics(sourceCode, methodMetrics);

  const totalIssues = methods.reduce(
    (total, method) => total + method.issues.length,
    0,
  );

  return {
    fileName,
    methods,
    classes,
    totalIssues,
  };
}
