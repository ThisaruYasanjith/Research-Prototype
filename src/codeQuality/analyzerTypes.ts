export type MaintainabilityIssueType =
  | "Long Method"
  | "High Complexity"
  | "Large Class"
  | "Poor Naming"
  | "Duplicated Logic";

export interface DetectedIssue {
  type: MaintainabilityIssueType;
  evidence: string;
  actualValue?: number;
  threshold?: number;
}

export interface MethodMetrics {
  methodName: string;
  startLine: number;
  endLine: number;
  methodLength: number;
  parameterCount: number;
  complexity: number;
  nestingDepth: number;
}

export interface MethodAnalysis extends MethodMetrics {
  issues: DetectedIssue[];
}

export interface ClassMetrics {
  className: string;
  startLine: number;
  endLine: number;
  classLength: number;
  methodCount: number;
  fieldCount: number;
}

export interface ClassAnalysis extends ClassMetrics {
  issues: DetectedIssue[];
}

export interface DuplicateAnalysis {
  firstMethod: string;
  secondMethod: string;

  firstStartLine: number;
  secondStartLine: number;

  similarity: number;
  threshold: number;

  evidence: string;
}

/**
 * Describes the structural type of a maintainability group.
 *
 * Method:
 * Findings that occur in the same method.
 *
 * Class:
 * Findings that occur at class level.
 *
 * Duplication Cluster:
 * Multiple methods connected through duplicated-logic
 * relationships.
 */
export type MaintainabilityGroupKind =
  | "Method"
  | "Class"
  | "Duplication Cluster";

/**
 * Represents a consolidated maintainability concern.
 *
 * Raw analyzer findings are grouped before priority scoring
 * so developers receive related concerns rather than a flat
 * list of isolated warnings.
 */
export interface MaintainabilityGroup {
  id: string;

  kind: MaintainabilityGroupKind;

  title: string;

  fileName: string;

  /**
   * Main human-readable location of the concern.
   *
   * Examples:
   *
   * updateQueue()
   * Commander
   * 3 related methods
   */
  primaryLocation: string;

  /**
   * First relevant source line for navigation/display.
   */
  startLine: number;

  /**
   * End line is mainly applicable to method/class groups.
   */
  endLine?: number;

  /**
   * Methods participating in this concern.
   *
   * A normal method group normally contains one method.
   * A duplication cluster may contain several.
   */
  affectedMethods: string[];

  /**
   * Classes participating in this concern.
   */
  affectedClasses: string[];

  /**
   * Unique issue categories represented by the group.
   */
  issueTypes: MaintainabilityIssueType[];

  /**
   * Original non-duplication issue evidence belonging to
   * method/class groups.
   *
   * Duplication details are stored separately in
   * duplicatePairs.
   */
  issues: DetectedIssue[];

  /**
   * Pairwise duplicated-logic evidence belonging to a
   * duplication cluster.
   */
  duplicatePairs: DuplicateAnalysis[];

  /**
   * Number of raw findings consolidated into this group.
   *
   * Example:
   *
   * updateQueue()
   *   Long Method
   *   High Complexity
   *
   * rawFindingCount = 2
   *
   * A duplication cluster containing three pair relationships
   * has rawFindingCount = 3.
   */
  rawFindingCount: number;

  /**
   * Explanation of why the findings were grouped.
   */
  groupingReason: string;
}

export interface JavaAnalysisResult {
  fileName: string;

  methods: MethodAnalysis[];

  classes: ClassAnalysis[];

  duplicates: DuplicateAnalysis[];

  /**
   * Consolidated maintainability concerns generated from
   * the raw analyzer findings.
   */
  groups: MaintainabilityGroup[];

  /**
   * Number of unique raw maintainability findings before
   * grouping.
   */
  totalIssues: number;
}
