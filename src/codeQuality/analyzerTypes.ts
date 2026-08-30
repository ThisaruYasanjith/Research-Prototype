export type MaintainabilityIssueType = "Long Method" | "High Complexity";

export interface DetectedIssue {
  type: MaintainabilityIssueType;
  actualValue: number;
  threshold: number;
  evidence: string;
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

export interface JavaAnalysisResult {
  fileName: string;
  methods: MethodAnalysis[];
  classes: ClassMetrics[];
  totalIssues: number;
}
