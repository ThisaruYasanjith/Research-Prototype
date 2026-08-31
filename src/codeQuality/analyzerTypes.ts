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

export interface JavaAnalysisResult {
  fileName: string;
  methods: MethodAnalysis[];
  classes: ClassAnalysis[];

  duplicates: DuplicateAnalysis[];

  totalIssues: number;
}
