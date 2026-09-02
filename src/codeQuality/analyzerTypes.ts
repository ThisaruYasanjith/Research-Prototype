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

export interface PrioritizedMaintainabilityGroup extends MaintainabilityGroup {
  priorityScore: number;

  priorityLevel: MaintainabilityPriorityLevel;

  priorityReasons: string[];
}

/**
 * One ordered refactoring recommendation.
 *
 * The order field represents the recommended sequence
 * within the current maintainability concern.
 */
export interface RefactoringStep {
  order: number;

  title: string;

  reason: string;

  relatedIssueTypes: MaintainabilityIssueType[];
}

/**
 * Final maintainability-triage group after:
 *
 * detection
 * → grouping
 * → priority scoring
 * → ordered refactoring guidance
 */
export interface TriagedMaintainabilityGroup extends PrioritizedMaintainabilityGroup {
  recommendedFixes: RefactoringStep[];
}

export interface JavaAnalysisResult {
  fileName: string;

  methods: MethodAnalysis[];

  classes: ClassAnalysis[];

  duplicates: DuplicateAnalysis[];

  groups: TriagedMaintainabilityGroup[];

  totalIssues: number;
}
