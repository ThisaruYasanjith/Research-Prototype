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

export type MaintainabilityGroupKind =
  | "Method"
  | "Class"
  | "Duplication Cluster";

export interface MaintainabilityGroup {
  id: string;

  kind: MaintainabilityGroupKind;

  title: string;

  fileName: string;

  primaryLocation: string;

  startLine: number;

  endLine?: number;

  affectedMethods: string[];

  affectedClasses: string[];

  issueTypes: MaintainabilityIssueType[];

  issues: DetectedIssue[];

  duplicatePairs: DuplicateAnalysis[];

  rawFindingCount: number;

  groupingReason: string;
}

export type MaintainabilityPriorityLevel = "High" | "Medium" | "Low";

/**
 * A grouped maintainability concern after evidence-based
 * priority scoring.
 */
export interface PrioritizedMaintainabilityGroup extends MaintainabilityGroup {
  /**
   * Normalized priority score between 0 and 100.
   */
  priorityScore: number;

  priorityLevel: MaintainabilityPriorityLevel;

  /**
   * Human-readable evidence explaining why this score
   * was assigned.
   */
  priorityReasons: string[];
}

export interface JavaAnalysisResult {
  fileName: string;

  methods: MethodAnalysis[];

  classes: ClassAnalysis[];

  duplicates: DuplicateAnalysis[];

  /**
   * Consolidated and priority-ranked maintainability
   * concerns.
   */
  groups: PrioritizedMaintainabilityGroup[];

  /**
   * Number of unique raw findings before grouping.
   */
  totalIssues: number;
}
