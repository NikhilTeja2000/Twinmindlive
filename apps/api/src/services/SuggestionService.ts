import { nanoid } from 'nanoid';
import {
  renderTemplate,
  SuggestionTripleJsonSchema,
  type AppSettings,
  type Suggestion,
  type SuggestionBatch,
} from '@twinmind/shared';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import type { GroqClient } from '../clients/GroqClient.js';
import type { SuggestionParser } from './SuggestionParser.js';

type GroqChatParams = Parameters<GroqClient['chat']>[0];

/**
 * Single responsibility: given a transcript-context string, ask GPT-OSS 120B for
 * exactly 3 actionable suggestions and return a validated SuggestionBatch.
 *
 * Parsing + repair of malformed model output is delegated to SuggestionParser.
 *
 * Resilience policy (kept local so the pipeline stays simple):
 *   1. Normal call with the user's configured reasoning effort + max tokens.
 *   2. If Groq returns a structured-output budget failure
 *      (400 `json_validate_failed`, typically caused by a large transcript +
 *      medium/high reasoning eating the entire `max_completion_tokens`),
 *      retry once with `reasoning_effort: 'low'` and a doubled token budget.
 *   3. If that retry also fails, hand `''` to SuggestionParser so the
 *      existing placeholder-triple invariant kicks in — the UI still gets
 *      3 cards and the chunk upload returns 200 with the transcript intact.
 */
export class SuggestionService {
  constructor(
    private readonly groq: GroqClient,
    private readonly parser: SuggestionParser,
  ) {}

  async generate(args: {
    sessionId: string;
    apiKey: string;
    transcriptContext: string;
    basedOnTranscriptThroughSeq: number | null;
    reason: 'auto' | 'manual';
    settings: AppSettings;
  }): Promise<SuggestionBatch> {
    const { settings } = args;

    const userPrompt = renderTemplate(settings.prompts.suggestionUser, {
      TRANSCRIPT: args.transcriptContext,
    });

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: settings.prompts.suggestionSystem },
      { role: 'user', content: userPrompt },
    ];
    const baseCall: GroqChatParams = {
      apiKey: args.apiKey,
      model: settings.llm.suggestionModel,
      temperature: settings.llm.temperature,
      maxCompletionTokens: settings.llm.maxTokens,
      reasoningEffort: settings.llm.suggestionReasoningEffort,
      responseFormat: {
        type: 'json_schema',
        jsonSchema: {
          name: 'SuggestionTriple',
          schema: SuggestionTripleJsonSchema,
          strict: true,
        },
      },
      messages,
    };

    const raw = await this.callWithStructuredOutputFallback(baseCall);

    const drafts = this.parser.parseOrRepair(raw);
    const suggestions = drafts.map<Suggestion>((s) => ({
      id: nanoid(8),
      kind: s.kind,
      title: s.title,
      body: s.body,
    }));

    return {
      id: nanoid(10),
      sessionId: args.sessionId,
      suggestions: [suggestions[0]!, suggestions[1]!, suggestions[2]!],
      reason: args.reason,
      createdAt: new Date().toISOString(),
      basedOnTranscriptThroughSeq: args.basedOnTranscriptThroughSeq,
    };
  }

  private async callWithStructuredOutputFallback(params: GroqChatParams): Promise<string> {
    try {
      return await this.groq.chat(params);
    } catch (err) {
      if (!this.isStructuredOutputBudgetError(err)) throw err;
      try {
        return await this.groq.chat({
          ...params,
          reasoningEffort: 'low',
          maxCompletionTokens: Math.max(params.maxCompletionTokens * 2, 1024),
        });
      } catch {
        // Two strikes: return empty content and let SuggestionParser place its
        // safe placeholder triple. Transcript for this chunk is already saved.
        return '';
      }
    }
  }

  /**
   * Matches Groq's `400 json_validate_failed` — which, in practice, happens
   * when strict `json_schema` output is requested AND the model emits nothing
   * because reasoning tokens consumed the entire `max_completion_tokens`.
   */
  private isStructuredOutputBudgetError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { status?: number; message?: string };
    if (e.status !== 400) return false;
    const msg = typeof e.message === 'string' ? e.message : '';
    return msg.includes('json_validate_failed') || msg.includes('Failed to validate JSON');
  }
}
