import {
  ClassAnalysis,
  DetectedIssue,
  JavaAnalysisResult,
  MethodAnalysis,
} from "./analyzerTypes";

import { extractMethodMetrics } from "./methodMetrics";
import { extractClassMetrics } from "./classMetrics";

import { analyzeClassName, analyzeMethodName } from "./namingAnalyzer";

import { analyzeDuplicatedLogic } from "./duplicationAnalyzer";

import { buildMaintainabilityGroups } from "./groupingEngine";

/**
 * Prototype thresholds.
 *
 * These values are configurable prototype defaults and should
 * not be presented as universally applicable maintainability
 * standards.
 */
const LONG_METHOD_THRESHOLD = 40;
const HIGH_COMPLEXITY_THRESHOLD = 10;

const LARGE_CLASS_LINE_THRESHOLD = 200;
const LARGE_CLASS_METHOD_THRESHOLD = 15;

/**
 * Coordinates the current Java maintainability analysis.
 *
 * Pipeline:
 *
 * Java source
 *   ↓
 * Method metrics
 *   ↓
 * Class metrics
 *   ↓
 * Maintainability issue detection
 *   ↓
 * Naming indicators
 *   ↓
 * Duplicated-logic detection
 *   ↓
 * Related finding grouping
 *   ↓
 * JavaAnalysisResult
 */
export function analyzeJavaSource(
  sourceCode: string,
  fileName: string,
): JavaAnalysisResult {
  /*
   * -------------------------------------------------------
   * 1. METHOD ANALYSIS
   * -------------------------------------------------------
   */

  const methodMetrics = extractMethodMetrics(sourceCode);

  const methods: MethodAnalysis[] = methodMetrics.map((method) => {
    const issues: DetectedIssue[] = [];

    /*
     * Long Method
     */
    if (method.methodLength > LONG_METHOD_THRESHOLD) {
      issues.push({
        type: "Long Method",

        evidence:
          `Method has ${method.methodLength} lines ` +
          `(threshold: ${LONG_METHOD_THRESHOLD}).`,

        actualValue: method.methodLength,

        threshold: LONG_METHOD_THRESHOLD,
      });
    }

    /*
     * High Complexity
     */
    if (method.complexity > HIGH_COMPLEXITY_THRESHOLD) {
      issues.push({
        type: "High Complexity",

        evidence:
          `Cyclomatic complexity is ${method.complexity} ` +
          `(threshold: ${HIGH_COMPLEXITY_THRESHOLD}).`,

        actualValue: method.complexity,

        threshold: HIGH_COMPLEXITY_THRESHOLD,
      });
    }

    /*
     * Poor Naming indicator
     *
     * This is deliberately treated as a measurable naming
     * indicator rather than perfect semantic understanding.
     */
    const namingIndicator = analyzeMethodName(method.methodName);

    if (namingIndicator) {
      issues.push({
        type: "Poor Naming",

        evidence: namingIndicator.reason,
      });
    }

    return {
      ...method,
      issues,
    };
  });

  /*
   * -------------------------------------------------------
   * 2. CLASS ANALYSIS
   * -------------------------------------------------------
   */

  const classMetrics = extractClassMetrics(sourceCode, methodMetrics);

  const classes: ClassAnalysis[] = classMetrics.map((classItem) => {
    const issues: DetectedIssue[] = [];

    /*
     * Large Class
     *
     * A class can exceed either the configured physical
     * source-line threshold or method-count threshold.
     */
    if (classItem.classLength > LARGE_CLASS_LINE_THRESHOLD) {
      issues.push({
        type: "Large Class",

        evidence:
          `Class has ${classItem.classLength} lines ` +
          `(threshold: ${LARGE_CLASS_LINE_THRESHOLD}).`,

        actualValue: classItem.classLength,

        threshold: LARGE_CLASS_LINE_THRESHOLD,
      });
    } else if (classItem.methodCount > LARGE_CLASS_METHOD_THRESHOLD) {
      issues.push({
        type: "Large Class",

        evidence:
          `Class contains ${classItem.methodCount} methods ` +
          `(threshold: ${LARGE_CLASS_METHOD_THRESHOLD}).`,

        actualValue: classItem.methodCount,

        threshold: LARGE_CLASS_METHOD_THRESHOLD,
      });
    }

    /*
     * Poor class naming indicator.
     */
    const namingIndicator = analyzeClassName(classItem.className);

    if (namingIndicator) {
      issues.push({
        type: "Poor Naming",

        evidence: namingIndicator.reason,
      });
    }

    return {
      ...classItem,
      issues,
    };
  });

  /*
   * -------------------------------------------------------
   * 3. DUPLICATED LOGIC ANALYSIS
   * -------------------------------------------------------
   */

  const duplicates = analyzeDuplicatedLogic(sourceCode);

  /*
   * A duplication relationship belongs to both participating
   * methods for local evidence display.
   *
   * However, the relationship itself will only count once in
   * totalIssues.
   */
  for (const duplicate of duplicates) {
    const firstMethod = methods.find(
      (method) => method.methodName === duplicate.firstMethod,
    );

    const secondMethod = methods.find(
      (method) => method.methodName === duplicate.secondMethod,
    );

    if (firstMethod) {
      firstMethod.issues.push({
        type: "Duplicated Logic",

        evidence:
          `Method shares ${duplicate.similarity}% ` +
          `normalized structural similarity with ` +
          `"${duplicate.secondMethod}".`,

        actualValue: duplicate.similarity,

        threshold: duplicate.threshold,
      });
    }

    if (secondMethod) {
      secondMethod.issues.push({
        type: "Duplicated Logic",

        evidence:
          `Method shares ${duplicate.similarity}% ` +
          `normalized structural similarity with ` +
          `"${duplicate.firstMethod}".`,

        actualValue: duplicate.similarity,

        threshold: duplicate.threshold,
      });
    }
  }

  /*
   * -------------------------------------------------------
   * 4. UNIQUE RAW FINDING COUNT
   * -------------------------------------------------------
   *
   * Duplicated Logic is attached to both participating
   * methods for display, but one A ↔ B relationship is still
   * one unique raw duplication finding.
   */

  const totalMethodIssues = methods.reduce(
    (total, method) =>
      total +
      method.issues.filter((issue) => issue.type !== "Duplicated Logic").length,
    0,
  );

  const totalClassIssues = classes.reduce(
    (total, classItem) => total + classItem.issues.length,
    0,
  );

  const totalDuplicateIssues = duplicates.length;

  const totalIssues =
    totalMethodIssues + totalClassIssues + totalDuplicateIssues;

  /*
   * -------------------------------------------------------
   * 5. MAINTAINABILITY GROUPING
   * -------------------------------------------------------
   *
   * Raw findings are consolidated into related
   * maintainability concerns before we later introduce
   * priority scoring.
   */

  const groups = buildMaintainabilityGroups({
    fileName,
    methods,
    classes,
    duplicates,
  });

  /*
   * -------------------------------------------------------
   * 6. FINAL ANALYSIS RESULT
   * -------------------------------------------------------
   */

  return {
    fileName,
    methods,
    classes,
    duplicates,
    groups,
    totalIssues,
  };
}
