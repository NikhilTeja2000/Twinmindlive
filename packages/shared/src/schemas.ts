import { z } from 'zod';

export const SUGGESTION_KINDS = [
  'QUESTION',
  'INSIGHT',
  'RISK',
  'CLARIFY',
  'ACTION',
  'FACT_CHECK',
] as const;

export const SuggestionSchema = z.object({
  kind: z.enum(SUGGESTION_KINDS),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(800),
});

export const SuggestionTripleSchema = z.object({
  suggestions: z.array(SuggestionSchema).length(3),
});

export type SuggestionDraft = z.infer<typeof SuggestionSchema>;
export type SuggestionTriple = z.infer<typeof SuggestionTripleSchema>;

/**
 * JSON Schema mirror of SuggestionTripleSchema, used for Groq's strict
 * `response_format: { type: 'json_schema', ... }` structured-output mode.
 *
 * Kept hand-authored (and `as const`) on purpose — a generic Zod→JSON-Schema
 * converter would be a larger abstraction than these 3 fields deserve.
 */
export const SuggestionTripleJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'title', 'body'],
        properties: {
          kind: { type: 'string', enum: SUGGESTION_KINDS },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          body: { type: 'string', minLength: 1, maxLength: 800 },
        },
      },
    },
  },
} as const;

export const SettingsUpdateSchema = z
  .object({
    /**
     * Optional new Groq API key. Write-only: the server never returns this on GET.
     * Minimum 10 chars catches obviously-truncated pastes without being too strict.
     */
    apiKey: z.string().min(10).max(200).optional(),
    prompts: z
      .object({
        suggestionSystem: z.string().min(1).optional(),
        suggestionUser: z.string().min(1).optional(),
        chatSystem: z.string().min(1).optional(),
        expandSystem: z.string().min(1).optional(),
      })
      .partial()
      .optional(),
    context: z
      .object({
        transcriptContextChunks: z.number().int().min(1).max(200).optional(),
        chatContextTurns: z.number().int().min(0).max(100).optional(),
        chunkSeconds: z.number().int().min(5).max(120).optional(),
      })
      .partial()
      .optional(),
    llm: z
      .object({
        suggestionModel: z.string().min(1).optional(),
        chatModel: z.string().min(1).optional(),
        transcriptionModel: z.string().min(1).optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().min(64).max(8000).optional(),
        suggestionReasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
        chatReasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
      })
      .partial()
      .optional(),
  })
  .strict();

export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
});

export const ExpandRequestSchema = z.object({
  suggestionId: z.string().min(1),
  batchId: z.string().min(1),
});
