export interface ChatRuleResult {
  hasConflict: boolean;
  conflictMessage?: string;
}

/**
 * Prototype chatbot-rule interpretation.
 *
 * The current prototype intentionally uses simple hardcoded matching.
 * This service keeps that behavior separate from the VS Code panel.
 */
export function evaluateChatRule(ruleText: string): ChatRuleResult {
  const normalized = ruleText.trim().toLowerCase();

  const mentionsController = /\bcontroller(s)?\b/.test(normalized);
  const mentionsRepository = /\brepositor(y|ies)\b|\brepo\b/.test(normalized);
  const allowsDependency =
    /\bcan\b/.test(normalized) ||
    /\ballow(ed)?\b/.test(normalized) ||
    /\bmay\b/.test(normalized) ||
    /\bdepend(s|ed|ency)?\b/.test(normalized) ||
    /\baccess\b/.test(normalized);

  if (mentionsController && mentionsRepository && allowsDependency) {
    return {
      hasConflict: true,
      conflictMessage:
        'The selected base architecture prohibits Controller → Repository direct access.'
    };
  }

  return { hasConflict: false };
}
