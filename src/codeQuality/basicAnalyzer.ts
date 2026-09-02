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

import { addRefactoringGuidance } from "./fixOrderEngine";

const LONG_METHOD_THRESHOLD = 40;

const HIGH_COMPLEXITY_THRESHOLD = 10;

const LARGE_CLASS_LINE_THRESHOLD = 200;

const LARGE_CLASS_METHOD_THRESHOLD = 15;

/**
 * Coordinates the complete current PP1
 * maintainability-triage pipeline.
 *
 * Java source
 *   ↓
 * Metrics
 *   ↓
 * Issue detection
 *   ↓
 * Duplicated-logic analysis
 *   ↓
 * Grouping
 *   ↓
 * Priority scoring
 *   ↓
 * Ordered refactoring guidance
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

    if (method.methodLength > LONG_METHOD_THRESHOLD) {
      issues.push({
        type: "Long Method",

        evidence:
          `Method has ${method.methodLength} effective source lines ` +
          `(comments and blank lines excluded; ` +
          `threshold: ${LONG_METHOD_THRESHOLD}).`,
        actualValue: method.methodLength,

        threshold: LONG_METHOD_THRESHOLD,
      });
    }

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

    if (!method.isConstructor) {
      const namingIndicator = analyzeMethodName(method.methodName);

      if (namingIndicator) {
        issues.push({
          type: "Poor Naming",

          evidence: namingIndicator.reason,
        });
      }
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

    if (classItem.classLength > LARGE_CLASS_LINE_THRESHOLD) {
      issues.push({
        type: "Large Class",

        evidence:
          `Class has ${classItem.classLength} effective source lines ` +
          `(comments and blank lines excluded; ` +
          `threshold: ${LARGE_CLASS_LINE_THRESHOLD}).`,

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
   * 3. DUPLICATED LOGIC
   * -------------------------------------------------------
   */

  const duplicates = analyzeDuplicatedLogic(sourceCode);

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
   * 5. GROUP RELATED FINDINGS
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
   * 6. PRIORITIZE GROUPS
   * -------------------------------------------------------
   */

  const prioritizedGroups = prioritizeMaintainabilityGroups(rawGroups);

  /*
   * -------------------------------------------------------
   * 7. GENERATE ORDERED REFACTORING GUIDANCE
   * -------------------------------------------------------
   */

  const groups = addRefactoringGuidance(prioritizedGroups);

  /*
   * -------------------------------------------------------
   * 8. FINAL RESULT
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
