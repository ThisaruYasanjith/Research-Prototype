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

import { prioritizeMaintainabilityGroups } from "./priorityEngine";

/**
 * Prototype maintainability thresholds.
 *
 * These are configurable defaults for the PP1 prototype.
 * They should not be presented as universally applicable
 * maintainability standards.
 */
const LONG_METHOD_THRESHOLD = 40;

const HIGH_COMPLEXITY_THRESHOLD = 10;

const LARGE_CLASS_LINE_THRESHOLD = 200;

const LARGE_CLASS_METHOD_THRESHOLD = 15;

/**
 * Coordinates the Java maintainability analysis pipeline.
 *
 * Java source
 *   ↓
 * Metric extraction
 *   ↓
 * Issue detection
 *   ↓
 * Naming indicators
 *   ↓
 * Duplicated-logic detection
 *   ↓
 * Maintainability grouping
 *   ↓
 * Explainable priority scoring
 *   ↓
 * Ranked maintainability concerns
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
     * Measurable Poor Naming indicator.
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
     * Measurable class naming indicator.
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
   * Attach pair evidence to both participating methods for
   * local display.
   *
   * The pair itself is still counted only once later.
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
   */

  const rawGroups = buildMaintainabilityGroups({
    fileName,
    methods,
    classes,
    duplicates,
  });

  /*
   * -------------------------------------------------------
   * 6. PRIORITY SCORING
   * -------------------------------------------------------
   *
   * Converts grouped findings into ranked maintainability
   * concerns using explainable evidence.
   */

  const groups = prioritizeMaintainabilityGroups(rawGroups);

  /*
   * -------------------------------------------------------
   * 7. FINAL RESULT
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
