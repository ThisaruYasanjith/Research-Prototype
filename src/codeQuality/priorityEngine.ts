import {
  DetectedIssue,
  MaintainabilityGroup,
  MaintainabilityIssueType,
  MaintainabilityPriorityLevel,
  PrioritizedMaintainabilityGroup,
} from "./analyzerTypes";

/**
 * Prototype severity weights.
 *
 * These values express the relative importance of each
 * maintainability issue type inside the current triage model.
 *
 * They are configurable prototype values and can later be
 * calibrated using literature, repository testing, and
 * evaluation results.
 */
const ISSUE_BASE_WEIGHTS: Record<MaintainabilityIssueType, number> = {
  "Long Method": 20,
  "High Complexity": 25,
  "Large Class": 22,
  "Poor Naming": 10,
  "Duplicated Logic": 18,
};

const HIGH_PRIORITY_THRESHOLD = 70;
const MEDIUM_PRIORITY_THRESHOLD = 40;

/**
 * Maximum additional points contributed by how far a
 * measurable metric exceeds its configured threshold.
 */
const MAX_THRESHOLD_EXCEEDANCE_BONUS = 20;

/**
 * Additional evidence bonuses.
 */
const MULTIPLE_ISSUE_TYPE_BONUS = 12;
const MULTI_METHOD_IMPACT_BONUS = 8;
const ADDITIONAL_METHOD_BONUS = 3;
const MAX_MULTI_METHOD_BONUS = 16;

const STRONG_DUPLICATION_BONUS = 8;
const VERY_STRONG_DUPLICATION_BONUS = 12;

/**
 * Calculates priority scores for all maintainability groups
 * and returns them ordered from highest priority to lowest.
 *
 * Score factors:
 *
 * 1. Issue-type severity
 * 2. Threshold exceedance
 * 3. Co-occurrence of multiple issue types
 * 4. Number of affected methods
 * 5. Strength of duplicated-logic evidence
 */
export function prioritizeMaintainabilityGroups(
  groups: MaintainabilityGroup[],
): PrioritizedMaintainabilityGroup[] {
  const prioritized = groups.map((group) => prioritizeGroup(group));

  return prioritized.sort((first, second) => {
    if (second.priorityScore !== first.priorityScore) {
      return second.priorityScore - first.priorityScore;
    }

    /*
     * Deterministic tie-breaker:
     * earlier source location appears first.
     */
    return first.startLine - second.startLine;
  });
}

function prioritizeGroup(
  group: MaintainabilityGroup,
): PrioritizedMaintainabilityGroup {
  let score = 0;

  const reasons: string[] = [];

  /*
   * -------------------------------------------------------
   * 1. ISSUE SEVERITY
   * -------------------------------------------------------
   */

  const severityScore = calculateIssueSeverityScore(group);

  score += severityScore.score;

  reasons.push(...severityScore.reasons);

  /*
   * -------------------------------------------------------
   * 2. THRESHOLD EXCEEDANCE
   * -------------------------------------------------------
   *
   * Only applies when an issue contains an actual measured
   * value and configured threshold.
   */

  const exceedanceResult = calculateThresholdExceedance(group.issues);

  score += exceedanceResult.score;

  reasons.push(...exceedanceResult.reasons);

  /*
   * -------------------------------------------------------
   * 3. CO-OCCURRENCE
   * -------------------------------------------------------
   *
   * Multiple different maintainability issue types at the
   * same location indicate a stronger combined concern.
   *
   * Example:
   *
   * updateQueue()
   *   Long Method
   *   High Complexity
   */

  if (group.issueTypes.length > 1) {
    score += MULTIPLE_ISSUE_TYPE_BONUS;

    reasons.push(
      `${group.issueTypes.length} different maintainability issue types occur together.`,
    );
  }

  /*
   * -------------------------------------------------------
   * 4. AFFECTED CODE EXTENT
   * -------------------------------------------------------
   *
   * A duplication cluster affecting several methods has
   * broader maintenance impact than a single isolated
   * location.
   */

  if (group.affectedMethods.length > 1) {
    const additionalMethods = group.affectedMethods.length - 1;

    const methodBonus = Math.min(
      MAX_MULTI_METHOD_BONUS,
      MULTI_METHOD_IMPACT_BONUS + additionalMethods * ADDITIONAL_METHOD_BONUS,
    );

    score += methodBonus;

    reasons.push(
      `${group.affectedMethods.length} methods participate in the same maintainability concern.`,
    );
  }

  /*
   * -------------------------------------------------------
   * 5. DUPLICATION STRENGTH
   * -------------------------------------------------------
   */

  if (group.duplicatePairs.length > 0) {
    const duplicationResult = calculateDuplicationStrength(group);

    score += duplicationResult.score;

    reasons.push(...duplicationResult.reasons);
  }

  /*
   * Clamp to the normalized 0–100 range.
   */

  const priorityScore = Math.max(0, Math.min(100, Math.round(score)));

  const priorityLevel = determinePriorityLevel(priorityScore);

  return {
    ...group,
    priorityScore,
    priorityLevel,
    priorityReasons: reasons,
  };
}

/**
 * Calculates the issue-type contribution.
 *
 * For a group containing different issue categories, each
 * category contributes once.
 */
function calculateIssueSeverityScore(group: MaintainabilityGroup): {
  score: number;
  reasons: string[];
} {
  let score = 0;

  const reasons: string[] = [];

  for (const issueType of group.issueTypes) {
    const weight = ISSUE_BASE_WEIGHTS[issueType];

    score += weight;

    reasons.push(`${issueType} contributes ${weight} base severity point(s).`);
  }

  return {
    score,
    reasons,
  };
}

/**
 * Measures how strongly a metric exceeds its configured
 * detection threshold.
 *
 * Example:
 *
 * Method length = 64
 * Threshold     = 40
 *
 * ratio = 64 / 40 = 1.6
 *
 * The amount above the threshold contributes additional
 * priority evidence.
 */
function calculateThresholdExceedance(issues: DetectedIssue[]): {
  score: number;
  reasons: string[];
} {
  let totalBonus = 0;

  const reasons: string[] = [];

  for (const issue of issues) {
    if (
      issue.actualValue === undefined ||
      issue.threshold === undefined ||
      issue.threshold <= 0
    ) {
      continue;
    }

    const ratio = issue.actualValue / issue.threshold;

    if (ratio <= 1) {
      continue;
    }

    const exceedance = ratio - 1;

    const bonus = Math.min(
      MAX_THRESHOLD_EXCEEDANCE_BONUS,
      Math.round(exceedance * 20),
    );

    if (bonus <= 0) {
      continue;
    }

    totalBonus += bonus;

    const percentageAbove = Math.round(exceedance * 100);

    reasons.push(
      `${issue.type} is approximately ${percentageAbove}% above its configured threshold.`,
    );
  }

  return {
    score: totalBonus,
    reasons,
  };
}

/**
 * Uses the average normalized structural similarity of a
 * duplication cluster as additional priority evidence.
 */
function calculateDuplicationStrength(group: MaintainabilityGroup): {
  score: number;
  reasons: string[];
} {
  if (group.duplicatePairs.length === 0) {
    return {
      score: 0,
      reasons: [],
    };
  }

  const totalSimilarity = group.duplicatePairs.reduce(
    (total, pair) => total + pair.similarity,
    0,
  );

  const averageSimilarity = totalSimilarity / group.duplicatePairs.length;

  let bonus = 0;

  if (averageSimilarity >= 95) {
    bonus = VERY_STRONG_DUPLICATION_BONUS;
  } else if (averageSimilarity >= 90) {
    bonus = STRONG_DUPLICATION_BONUS;
  }

  const reasons = [
    `Duplicated-logic relationships average ${Math.round(
      averageSimilarity,
    )}% structural similarity.`,
  ];

  if (group.duplicatePairs.length > 1) {
    reasons.push(
      `${group.duplicatePairs.length} pairwise duplication relationships were consolidated into this group.`,
    );
  }

  return {
    score: bonus,
    reasons,
  };
}

function determinePriorityLevel(score: number): MaintainabilityPriorityLevel {
  if (score >= HIGH_PRIORITY_THRESHOLD) {
    return "High";
  }

  if (score >= MEDIUM_PRIORITY_THRESHOLD) {
    return "Medium";
  }

  return "Low";
}
