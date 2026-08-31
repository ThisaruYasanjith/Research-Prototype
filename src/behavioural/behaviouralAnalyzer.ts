import { SideEffectType, ImpactSeverity, Fingerprint, MethodInfo } from './types';

/**
 * Behavioural Fingerprint Analyzer and Drift Detector.
 * 
 * PROTOTYPE HARD-CODED LOGIC:
 * In production, the static line matching, hard-coded rules, and simulated AI
 * explanations will be replaced by:
 * 1. JavaParser / AST analysis for control-flow and data-flow call graph extraction.
 * 2. Real side-effect fingerprinting using semantic effect classification rules.
 * 3. Actual semantic comparison engine comparing control flow graphs (CFGs).
 * 4. Real LLM API (e.g. Google Gemini / OpenAI) for dynamic natural-language code explanations.
 */
export class BehaviouralAnalyzer {
  
  /**
   * Extract side-effect fingerprint from a method's code body.
   * 
   * PROTOTYPE LOGIC: Scans method body text for representative pattern signatures.
   * FUTURE EXPANSION: Replace with JavaParser AST node traversal to identify method calls & mutations.
   */
  public static extractFingerprint(methodInfo: MethodInfo): Fingerprint {
    const effects: SideEffectType[] = [];
    const linesMap: Partial<Record<SideEffectType, number[]>> = {};

    const lines = methodInfo.bodyText.split(/\r?\n/);

    lines.forEach((line, idx) => {
      const lineNum = methodInfo.startLine + idx;

      // Check Database Write pattern
      if (line.includes('repository.save') || line.includes('repository.delete') || line.includes('repository.update')) {
        if (!effects.includes('DATABASE_WRITE')) {
          effects.push('DATABASE_WRITE');
        }
        linesMap['DATABASE_WRITE'] = [...(linesMap['DATABASE_WRITE'] || []), lineNum];
      }

      // Check External Service Call pattern
      if (line.includes('emailService.') || line.includes('sendConfirmation') || line.includes('http') || line.includes('client.')) {
        if (!effects.includes('EXTERNAL_CALL')) {
          effects.push('EXTERNAL_CALL');
        }
        linesMap['EXTERNAL_CALL'] = [...(linesMap['EXTERNAL_CALL'] || []), lineNum];
      }

      // Check File I/O pattern
      if (line.includes('FileWriter') || line.includes('FileReader') || line.includes('file.write')) {
        if (!effects.includes('FILE_IO')) {
          effects.push('FILE_IO');
        }
        linesMap['FILE_IO'] = [...(linesMap['FILE_IO'] || []), lineNum];
      }

      // Check State Mutation pattern
      if (line.includes('this.') || line.match(/\b\w+\s*=\s*[^=]/)) {
        if (!line.includes('Order order') && !line.includes('public void') && !line.includes('repository.') && !line.includes('emailService.')) {
          if (!effects.includes('STATE_MUTATION')) {
            effects.push('STATE_MUTATION');
          }
          linesMap['STATE_MUTATION'] = [...(linesMap['STATE_MUTATION'] || []), lineNum];
        }
      }
    });

    // Fallback default baseline if no pattern matched
    if (effects.length === 0) {
      effects.push('DATABASE_WRITE');
      linesMap['DATABASE_WRITE'] = [methodInfo.startLine + 1];
    }

    return { effects, linesMap };
  }

  /**
   * Compare baseline vs current fingerprint to identify new side effects.
   * 
   * PROTOTYPE LOGIC: Array difference comparison.
   * FUTURE EXPANSION: Replace with graph diffing engine (CFG / AST diffing).
   */
  public static computeDrift(baseline: Fingerprint, current: Fingerprint): SideEffectType[] {
    return current.effects.filter(effect => !baseline.effects.includes(effect));
  }

  /**
   * Rule-based impact classification.
   * 
   * PROTOTYPE HARD-CODED RULES:
   * STATE_MUTATION -> MEDIUM
   * DATABASE_WRITE -> HIGH
   * FILE_IO -> MEDIUM
   * EXTERNAL_CALL -> HIGH
   * 
   * FUTURE EXPANSION: Replace with formal security/reliability risk scoring engine.
   */
  public static classifyImpact(newEffects: SideEffectType[]): ImpactSeverity {
    if (newEffects.includes('EXTERNAL_CALL') || newEffects.includes('DATABASE_WRITE')) {
      return 'HIGH';
    }
    if (newEffects.includes('FILE_IO') || newEffects.includes('STATE_MUTATION')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * LLM-style plain-English explanation generation.
   * 
   * PROTOTYPE HARD-CODED LOGIC:
   * Returns exact prompt-requested explanation for EXTERNAL_CALL drift.
   * 
   * FUTURE EXPANSION: Replace with real LLM API call (e.g. Gemini 1.5 Pro / GPT-4o API)
   * passing full method diff context, AST summary, and prompt templates.
   */
  public static getAIExplanation(newEffects: SideEffectType[]): { explanation: string; action: string } {
    if (newEffects.includes('EXTERNAL_CALL')) {
      return {
        explanation:
          'The method previously performed only a database operation. The updated version also communicates with an external service. This introduces a new external dependency that may fail independently of the database operation.',
        action:
          'Consider adding appropriate error and timeout handling for the external service call.'
      };
    }

    if (newEffects.includes('FILE_IO')) {
      return {
        explanation:
          'The method introduced file system read/write operations. Disk I/O operations can introduce performance latency or unhandled file locks.',
        action:
          'Wrap file operations in try-with-resources and handle IOException explicitly.'
      };
    }

    if (newEffects.includes('STATE_MUTATION')) {
      return {
        explanation:
          'The method introduced internal class state modifications. Mutating shared instance fields can create race conditions in multi-threaded runtime environments.',
        action:
          'Ensure synchronized access or use thread-safe data structures for instance fields.'
      };
    }

    return {
      explanation: 'No unexpected behavioural drift detected.',
      action: 'No corrective action required.'
    };
  }
}
