export interface ArchitectureViolation {
  id: string;
  kind: 'structure' | 'dependency';
  title: string;
  description: string;
  file: string;
  relativeFile: string;
  line: number;
  severity: 'High' | 'Medium';
  expected: string;
  found: string;
}

export interface ArchitectureScanResult {
  violations: ArchitectureViolation[];
  workspaceMissing: boolean;
}

export interface ArchitectureWebviewMessage {
  type?: string;
  file?: string;
  line?: number;
  text?: string;
}
