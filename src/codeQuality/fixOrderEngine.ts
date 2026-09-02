import {
  MaintainabilityIssueType,
  PrioritizedMaintainabilityGroup,
  RefactoringStep,
  TriagedMaintainabilityGroup,
} from "./analyzerTypes";

/**
 * Adds ordered, context-aware refactoring guidance to
 * prioritized maintainability groups.
 *
 * Current prototype strategy:
 *
 * Duplication Cluster
 *   → understand common structure
 *   → extract/reuse common behaviour
 *   → replace duplicated implementations
 *
 * Method with High Complexity
 *   → simplify decision logic first
 *
 * Method with Long Method
 *   → extract cohesive responsibilities after the
 *     control flow becomes clearer
 *
 * Class with Large Class
 *   → identify responsibility clusters
 *   → extract focused classes
 *
 * Poor Naming
 *   → rename after structural changes so names reflect
 *     the final responsibilities
 *
 * Every group ends with verification.
 */
export function addRefactoringGuidance(
  groups: PrioritizedMaintainabilityGroup[],
): TriagedMaintainabilityGroup[] {
  return groups.map((group) => ({
    ...group,
    recommendedFixes: buildRecommendedFixOrder(group),
  }));
}

function buildRecommendedFixOrder(
  group: PrioritizedMaintainabilityGroup,
): RefactoringStep[] {
  if (group.kind === "Duplication Cluster") {
    return buildDuplicationFixes(group);
  }

  if (group.kind === "Class") {
    return buildClassFixes(group);
  }

  return buildMethodFixes(group);
}

/**
 * Builds guidance for method-level concerns.
 *
 * Structural problems are addressed before naming because
 * refactoring may create, remove, or rename responsibilities.
 */
function buildMethodFixes(
  group: PrioritizedMaintainabilityGroup,
): RefactoringStep[] {
  const steps: RefactoringStep[] = [];

  const hasHighComplexity = group.issueTypes.includes("High Complexity");

  const hasLongMethod = group.issueTypes.includes("Long Method");

  const hasPoorNaming = group.issueTypes.includes("Poor Naming");

  /*
   * High Complexity is handled first when it co-occurs with
   * Long Method.
   *
   * Simplifying difficult decision structures first makes
   * later extraction boundaries clearer and reduces the risk
   * of moving already-complicated logic into new methods.
   */
  if (hasHighComplexity) {
    addStep(
      steps,
      "Simplify complex decision logic",
      "Reduce deeply nested or compound decision paths first so the method's control flow becomes easier to understand before further structural refactoring.",
      ["High Complexity"],
    );
  }

  if (hasLongMethod) {
    if (hasHighComplexity) {
      addStep(
        steps,
        "Extract remaining cohesive responsibilities",
        "After simplifying the control flow, identify cohesive blocks of behaviour and extract them into focused methods to reduce method size.",
        ["Long Method"],
      );
    } else {
      addStep(
        steps,
        "Identify cohesive responsibility blocks",
        "Review the long method and identify sections that perform distinct responsibilities before extracting code.",
        ["Long Method"],
      );

      addStep(
        steps,
        "Extract focused methods",
        "Move the identified responsibility blocks into clearly focused methods so the original method becomes smaller and easier to maintain.",
        ["Long Method"],
      );
    }
  }

  if (hasPoorNaming) {
    addStep(
      steps,
      "Improve names after restructuring",
      "Rename unclear identifiers after structural refactoring so the final names accurately describe the resulting responsibilities.",
      ["Poor Naming"],
    );
  }

  addVerificationStep(steps, group.issueTypes);

  return steps;
}

/**
 * Builds guidance for class-level concerns.
 */
function buildClassFixes(
  group: PrioritizedMaintainabilityGroup,
): RefactoringStep[] {
  const steps: RefactoringStep[] = [];

  const hasLargeClass = group.issueTypes.includes("Large Class");

  const hasPoorNaming = group.issueTypes.includes("Poor Naming");

  if (hasLargeClass) {
    addStep(
      steps,
      "Identify responsibility clusters",
      "Inspect the class methods and fields to determine which groups belong to separate responsibilities before changing the class structure.",
      ["Large Class"],
    );

    addStep(
      steps,
      "Extract focused classes",
      "Move strongly related methods and fields into smaller focused classes while preserving the original behaviour.",
      ["Large Class"],
    );

    addStep(
      steps,
      "Review the remaining class responsibility",
      "Check whether the remaining class now represents a clearer and more focused responsibility.",
      ["Large Class"],
    );
  }

  if (hasPoorNaming) {
    addStep(
      steps,
      "Rename the class after restructuring",
      "Choose a class name that reflects its final responsibility after structural changes have been completed.",
      ["Poor Naming"],
    );
  }

  addVerificationStep(steps, group.issueTypes);

  return steps;
}

/**
 * Builds guidance for duplicated-logic clusters.
 *
 * The recommendation is generated for the whole connected
 * cluster rather than independently for every pair.
 */
function buildDuplicationFixes(
  group: PrioritizedMaintainabilityGroup,
): RefactoringStep[] {
  const steps: RefactoringStep[] = [];

  const methodCount = group.affectedMethods.length;

  const pairCount = group.duplicatePairs.length;

  const averageSimilarity = calculateAverageSimilarity(group);

  addStep(
    steps,
    "Compare the repeated implementations",
    `${methodCount} method(s) participate in this duplication cluster across ${pairCount} detected relationship(s), with approximately ${averageSimilarity}% average structural similarity. Identify which operations are genuinely common and which parts represent intentional variation.`,
    ["Duplicated Logic"],
  );

  addStep(
    steps,
    "Extract or parameterize the common behaviour",
    "Move the genuinely shared workflow into a reusable method or abstraction, and represent legitimate variations through parameters or focused helper operations where appropriate.",
    ["Duplicated Logic"],
  );

  addStep(
    steps,
    "Replace duplicated implementations",
    "Update the affected methods to reuse the extracted common behaviour instead of maintaining separate repeated structures.",
    ["Duplicated Logic"],
  );

  addVerificationStep(steps, ["Duplicated Logic"]);

  return steps;
}

function calculateAverageSimilarity(
  group: PrioritizedMaintainabilityGroup,
): number {
  if (group.duplicatePairs.length === 0) {
    return 0;
  }

  const total = group.duplicatePairs.reduce(
    (sum, pair) => sum + pair.similarity,
    0,
  );

  return Math.round(total / group.duplicatePairs.length);
}

function addVerificationStep(
  steps: RefactoringStep[],
  relatedIssueTypes: MaintainabilityIssueType[],
): void {
  addStep(
    steps,
    "Re-run maintainability analysis",
    "Analyze the file again after refactoring to verify whether the detected maintainability evidence has been reduced or removed and to check for remaining concerns.",
    relatedIssueTypes,
  );
}

function addStep(
  steps: RefactoringStep[],
  title: string,
  reason: string,
  relatedIssueTypes: MaintainabilityIssueType[],
): void {
  steps.push({
    order: steps.length + 1,
    title,
    reason,
    relatedIssueTypes,
  });
}
