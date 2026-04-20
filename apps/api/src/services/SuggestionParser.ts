import {
  SUGGESTION_KINDS,
  SuggestionTripleSchema,
  type SuggestionDraft,
  type SuggestionKind,
} from '@twinmind/shared';

/**
 * Single responsibility: take the raw LLM output that *should* be a
 * SuggestionTriple and return a validated array of exactly 3 drafts.
 *
 * Applies, in order:
 *   1. Strict parse against SuggestionTripleSchema.
 *   2. Shape coercion for common model deviations (items/description/name/text).
 *   3. A last-resort placeholder triple so the UI invariant ("always 3 cards")
 *      never breaks mid-session.
 */
export class SuggestionParser {
  parseOrRepair(raw: string): SuggestionDraft[] {
    const json = this.safeParseJson(raw);
    const strict = SuggestionTripleSchema.safeParse(json);
    if (strict.success) return strict.data.suggestions;

    const coerced = this.coerceToTriple(json);
    const recovered = SuggestionTripleSchema.safeParse({ suggestions: coerced });
    if (recovered.success) return recovered.data.suggestions;

    return this.placeholderTriple();
  }

  private safeParseJson(s: string): unknown {
    try {
      return JSON.parse(s);
    } catch {
      const match = s.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  private coerceToTriple(input: unknown): SuggestionDraft[] {
    if (!input || typeof input !== 'object') return [];
    const obj = input as Record<string, unknown>;
    const arr = Array.isArray(obj.suggestions)
      ? obj.suggestions
      : Array.isArray(obj.items)
        ? (obj.items as unknown[])
        : [];

    const normalized = arr
      .map((item) => this.normalizeItem(item))
      .filter((x): x is SuggestionDraft => x !== null);

    while (normalized.length < 3) {
      normalized.push({
        kind: 'INSIGHT',
        title: 'Continue listening',
        body: 'Waiting for more context before suggesting a concrete next step.',
      });
    }
    return normalized.slice(0, 3);
  }

  private normalizeItem(item: unknown): SuggestionDraft | null {
    if (typeof item === 'string')
      return { kind: 'INSIGHT', title: item.slice(0, 80), body: item };
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    const title =
      typeof o.title === 'string' ? o.title : typeof o.name === 'string' ? o.name : '';
    const body =
      typeof o.body === 'string'
        ? o.body
        : typeof o.description === 'string'
          ? o.description
          : typeof o.text === 'string'
            ? o.text
            : '';
    const kind = this.normalizeKind(o.kind ?? o.type ?? o.category);
    return title && body ? { kind, title, body } : null;
  }

  private normalizeKind(raw: unknown): SuggestionKind {
    if (typeof raw !== 'string') return 'INSIGHT';
    const upper = raw.trim().toUpperCase().replace(/[-\s]+/g, '_');
    return (SUGGESTION_KINDS as readonly string[]).includes(upper)
      ? (upper as SuggestionKind)
      : 'INSIGHT';
  }

  private placeholderTriple(): SuggestionDraft[] {
    const body =
      'The model returned a malformed response for this batch. The next refresh will retry automatically.';
    return [
      { kind: 'ACTION', title: 'Listen for next decision point', body },
      { kind: 'INSIGHT', title: 'Summarize what was just said', body },
      { kind: 'CLARIFY', title: 'Ask a clarifying question', body },
    ];
  }
}
