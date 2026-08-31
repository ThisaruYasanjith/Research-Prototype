export type SideEffectType = 'DATABASE_WRITE' | 'EXTERNAL_CALL' | 'FILE_IO' | 'STATE_MUTATION';

export type ImpactSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MethodInfo {
  name: string;
  signature: string;        // e.g. "processOrder(Order)"
  declaration: string;      // e.g. "public void processOrder(Order order)"
  startLine: number;        // 0-indexed line number in document
  endLine: number;          // 0-indexed line number in document
  bodyText: string;
}

export interface Fingerprint {
  effects: SideEffectType[];
  linesMap: Partial<Record<SideEffectType, number[]>>; // 0-indexed line numbers where effects occur
}

export type AnalysisStep =
  | 'NO_METHOD_SELECTED'
  | 'METHOD_SELECTED'
  | 'BASELINE_CREATED'
  | 'DRIFT_ANALYZED';

export interface MethodState {
  methodInfo: MethodInfo;
  step: AnalysisStep;
  baselineFingerprint?: Fingerprint;
  currentFingerprint?: Fingerprint;
  newEffects?: SideEffectType[];
  impactSeverity?: ImpactSeverity;
  llmExplanation?: string;
  suggestedAction?: string;
  lastAnalysisTrigger?: 'auto' | 'manual';
  lastAnalyzedAt?: string;
}
