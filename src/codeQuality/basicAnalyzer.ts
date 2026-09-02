import {
  ClassAnalysis,
  DetectedIssue,
  JavaAnalysisResult,
  MethodAnalysis,
} from "./analyzerTypes";

import { extractClassMetrics } from "./classMetrics";
import { extractMethodMetrics } from "./methodMetrics";

import { analyzeClassName, analyzeMethodName } from "./namingAnalyzer";
import { analyzeDuplicatedLogic } from "./duplicationAnalyzer";

const LONG_METHOD_THRESHOLD = 40;
const HIGH_COMPLEXITY_THRESHOLD = 10;

const LARGE_CLASS_LENGTH_THRESHOLD = 200;
const LARGE_CLASS_METHOD_COUNT_THRESHOLD = 15;

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

    // Long Method detection
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

    // High Complexity detection
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

    // Poor Naming indicator - method level
    const methodNamingIndicator = analyzeMethodName(method.methodName);

    if (methodNamingIndicator) {
      issues.push({
        type: "Poor Naming",
        evidence:
          `Method "${methodNamingIndicator.identifier}": ` +
          methodNamingIndicator.reason,
      });
    }

    return {
      ...method,
      issues,
    };
  });

  const classMetrics = extractClassMetrics(sourceCode, methodMetrics);

  const classes: ClassAnalysis[] = classMetrics.map((classItem) => {
    const issues: DetectedIssue[] = [];

    // Large Class detection
    if (classItem.classLength > LARGE_CLASS_LENGTH_THRESHOLD) {
      issues.push({
        type: "Large Class",
        actualValue: classItem.classLength,
        threshold: LARGE_CLASS_LENGTH_THRESHOLD,
        evidence:
          `Class has ${classItem.classLength} lines ` +
          `(threshold: ${LARGE_CLASS_LENGTH_THRESHOLD}).`,
      });
    } else if (classItem.methodCount > LARGE_CLASS_METHOD_COUNT_THRESHOLD) {
      issues.push({
        type: "Large Class",
        actualValue: classItem.methodCount,
        threshold: LARGE_CLASS_METHOD_COUNT_THRESHOLD,
        evidence:
          `Class has ${classItem.methodCount} methods ` +
          `(threshold: ${LARGE_CLASS_METHOD_COUNT_THRESHOLD}).`,
      });
    }

    // Poor Naming indicator - class level
    const classNamingIndicator = analyzeClassName(classItem.className);

    if (classNamingIndicator) {
      issues.push({
        type: "Poor Naming",
        evidence:
          `Class "${classNamingIndicator.identifier}": ` +
          classNamingIndicator.reason,
      });
    }

    return {
      ...classItem,
      issues,
    };
  });

  const duplicates = analyzeDuplicatedLogic(sourceCode);

  for (const duplicate of duplicates) {
    const firstMethod = methods.find(
      (method) =>
        method.methodName === duplicate.firstMethod &&
        method.startLine === duplicate.firstStartLine,
    );

    const secondMethod = methods.find(
      (method) =>
        method.methodName === duplicate.secondMethod &&
        method.startLine === duplicate.secondStartLine,
    );

    if (firstMethod) {
      firstMethod.issues.push({
        type: "Duplicated Logic",
        actualValue: duplicate.similarity,
        threshold: duplicate.threshold,
        evidence:
          `Method shares ${duplicate.similarity}% ` +
          `normalized structural similarity with ` +
          `"${duplicate.secondMethod}".`,
      });
    }

    if (secondMethod) {
      secondMethod.issues.push({
        type: "Duplicated Logic",
        actualValue: duplicate.similarity,
        threshold: duplicate.threshold,
        evidence:
          `Method shares ${duplicate.similarity}% ` +
          `normalized structural similarity with ` +
          `"${duplicate.firstMethod}".`,
      });
    }
  }

  const totalMethodIssues = methods.reduce(
    (total, method) =>
      total +
      method.issues.filter((issue) => issue.type !== "Duplicated Logic").length,
    0,
  );

  const totalDuplicateIssues = duplicates.length;

  const totalClassIssues = classes.reduce(
    (total, classItem) => total + classItem.issues.length,
    0,
  );

  return {
    fileName,
    methods,
    classes,
    duplicates,
    totalIssues: totalMethodIssues + totalClassIssues + totalDuplicateIssues,
  };
}
