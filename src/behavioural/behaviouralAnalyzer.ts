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
    const detailsMap: Partial<Record<SideEffectType, { lineNum: number; snippet: string }[]>> = {};

    const lines = methodInfo.bodyText.split(/\r?\n/);

    lines.forEach((line, idx) => {
      const lineNum = methodInfo.startLine + idx;
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        return;
      }

      // Check State Mutation pattern (e.g. order.setStatus("CREATED"), order.setStatus("CANCELLED"), this.field = ..., obj.setX(...))
      const isSetterCall = /\b\w+\.set[A-Z]\w*\s*\(/.test(trimmed) || /\bset[A-Z]\w*\s*\(/.test(trimmed) || trimmed.includes('.setStatus(');
      const isAssignment = (trimmed.includes('this.') || /\b\w+\s*=\s*[^=]/.test(trimmed)) &&
        !trimmed.includes('public void') &&
        !trimmed.includes('Order order') &&
        !trimmed.includes('repository.') &&
        !trimmed.includes('emailService.');

      if (isSetterCall || isAssignment) {
        if (!effects.includes('STATE_MUTATION')) {
          effects.push('STATE_MUTATION');
        }
        linesMap['STATE_MUTATION'] = [...(linesMap['STATE_MUTATION'] || []), lineNum];
        detailsMap['STATE_MUTATION'] = [...(detailsMap['STATE_MUTATION'] || []), { lineNum, snippet: trimmed }];
      }

      // Check Database Write pattern
      if (trimmed.includes('repository.save') || trimmed.includes('repository.delete') || trimmed.includes('repository.update') || trimmed.includes('.save(') || trimmed.includes('.delete(') || trimmed.includes('.update(')) {
        if (!effects.includes('DATABASE_WRITE')) {
          effects.push('DATABASE_WRITE');
        }
        linesMap['DATABASE_WRITE'] = [...(linesMap['DATABASE_WRITE'] || []), lineNum];
        detailsMap['DATABASE_WRITE'] = [...(detailsMap['DATABASE_WRITE'] || []), { lineNum, snippet: trimmed }];
      }

      // Check External Service Call pattern
      if (trimmed.includes('emailService.') || trimmed.includes('sendConfirmation') || trimmed.includes('http') || trimmed.includes('client.') || trimmed.includes('restTemplate.') || trimmed.includes('webClient.')) {
        if (!effects.includes('EXTERNAL_CALL')) {
          effects.push('EXTERNAL_CALL');
        }
        linesMap['EXTERNAL_CALL'] = [...(linesMap['EXTERNAL_CALL'] || []), lineNum];
        detailsMap['EXTERNAL_CALL'] = [...(detailsMap['EXTERNAL_CALL'] || []), { lineNum, snippet: trimmed }];
      }

      // Check File I/O pattern
      if (trimmed.includes('FileWriter') || trimmed.includes('FileReader') || trimmed.includes('file.write') || trimmed.includes('Files.write')) {
        if (!effects.includes('FILE_IO')) {
          effects.push('FILE_IO');
        }
        linesMap['FILE_IO'] = [...(linesMap['FILE_IO'] || []), lineNum];
        detailsMap['FILE_IO'] = [...(detailsMap['FILE_IO'] || []), { lineNum, snippet: trimmed }];
      }
    });

    // Fallback default baseline if no pattern matched
    if (effects.length === 0) {
      effects.push('DATABASE_WRITE');
      linesMap['DATABASE_WRITE'] = [methodInfo.startLine + 1];
    }

    return { effects, linesMap, detailsMap };
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
   * Plain-English explanation generation for detected side-effect drift.
   * 
   * PROTOTYPE HARD-CODED LOGIC:
   * Returns structured explanations per effect type.
   * 
   * FUTURE EXPANSION: Replace with real LLM API call (e.g. Gemini 1.5 Pro / GPT-4o API)
   * passing full method diff context, AST summary, and prompt templates.
   */
  public static getExplanation(newEffects: SideEffectType[]): { explanation: string; action: string } {
    if (newEffects.includes('EXTERNAL_CALL')) {
      return {
        explanation:
          'This method now communicates with an external service (e.g. emailService.sendConfirmation) in addition to its original database operation. ' +
          'External service calls introduce a new failure point: the service may be temporarily unavailable, respond slowly, or return unexpected errors. ' +
          'Unlike a database write, external calls are not automatically rolled back if a subsequent step fails, which can lead to partial execution and data inconsistency.',
        action:
          '1. Wrap the external call in a try-catch block to handle service errors gracefully.\n' +
          '2. Set a timeout limit (e.g. 3–5 seconds) to prevent the method from hanging indefinitely.\n' +
          '3. Consider adding a retry mechanism with exponential backoff for transient failures.\n' +
          '4. If data consistency is critical, use a transactional outbox pattern or compensating transaction.'
      };
    }

    if (newEffects.includes('FILE_IO')) {
      return {
        explanation:
          'This method has introduced file system read or write operations. File I/O is significantly slower than in-memory operations and introduces risks such as: ' +
          'disk full errors, permission denied exceptions, file locks held by other processes, and data corruption if the write is interrupted. ' +
          'File operations that are not properly closed can also cause resource leaks over time.',
        action:
          '1. Always use try-with-resources (e.g. try (FileWriter fw = new FileWriter(...))) to ensure the file handle is closed automatically.\n' +
          '2. Explicitly catch IOException and log or rethrow it with a meaningful error message.\n' +
          '3. Validate that the target directory exists and is writable before attempting the write.\n' +
          '4. Avoid performing file I/O inside a database transaction — complete the transaction first.'
      };
    }

    if (newEffects.includes('STATE_MUTATION')) {
      return {
        explanation:
          'This method now modifies the internal state of an object (e.g. order.setStatus(...)) before or during its operation. ' +
          'State mutations are a common source of bugs when the same object is shared across multiple threads or reused across multiple calls. ' +
          'If the method is called concurrently, two threads may read and write the same field simultaneously, causing race conditions and unpredictable behaviour.',
        action:
          '1. Ensure that the object being mutated (e.g. Order) is not shared across concurrent threads without synchronization.\n' +
          '2. If thread safety is required, use synchronized blocks or java.util.concurrent locks around the mutation.\n' +
          '3. Consider using immutable value objects and returning a new modified instance rather than mutating in place.\n' +
          '4. Review all callers of this method to confirm that state changes happen in the correct sequence.'
      };
    }

    if (newEffects.includes('DATABASE_WRITE')) {
      return {
        explanation:
          'This method now performs a database write operation (save or delete) that was not present in the baseline. ' +
          'Additional writes increase the risk of unintended data modifications, duplicate records, or conflicts with concurrent transactions. ' +
          'They may also affect performance if called in loops or bulk operations.',
        action:
          '1. Confirm the write operation is intentional and not a duplicate of an existing call.\n' +
          '2. Ensure the operation is protected within an appropriate transaction boundary (@Transactional).\n' +
          '3. Add input validation before writing to prevent persisting invalid or incomplete data.\n' +
          '4. Review the impact on existing unit and integration tests.'
      };
    }

    return {
      explanation: 'No unexpected behavioural drift was detected between the baseline and the current version of this method.',
      action: 'No corrective action is required at this time. Continue monitoring for future changes.'
    };
  }
}
