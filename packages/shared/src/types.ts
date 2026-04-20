export type ISODateString = string;

export interface TranscriptChunk {
  id: string;
  sessionId: string;
  sequence: number;
  text: string;
  startedAt: ISODateString;
  endedAt: ISODateString;
  durationMs: number;
  createdAt: ISODateString;
}

/**
 * Semantic category of a live suggestion. Drives the small color pill shown
 * on each card (and echoed in the chat header when the suggestion is
 * clicked). The set is closed — the LLM is constrained to these values via
 * a strict json_schema enum.
 *
 *   QUESTION   — a sharp question the speaker should ask next
 *   INSIGHT    — a non-obvious observation, framing, or pattern
 *   RISK       — a concern, blind spot, or counter-argument
 *   CLARIFY    — a specific detail to pin down before moving on
 *   ACTION     — a concrete next step for the next minute
 *   FACT_CHECK — verify a concrete numeric claim or external assertion
 */
export type SuggestionKind =
  | 'QUESTION'
  | 'INSIGHT'
  | 'RISK'
  | 'CLARIFY'
  | 'ACTION'
  | 'FACT_CHECK';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  body: string;
}

export interface SuggestionBatch {
  id: string;
  sessionId: string;
  suggestions: [Suggestion, Suggestion, Suggestion];
  reason: 'auto' | 'manual';
  createdAt: ISODateString;
  basedOnTranscriptThroughSeq: number | null;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  createdAt: ISODateString;
  source?: {
    kind: 'typed' | 'suggestion';
    suggestionId?: string;
  };
}

export interface SessionMeta {
  id: string;
  createdAt: ISODateString;
  startedAt: ISODateString | null;
  stoppedAt: ISODateString | null;
}

export interface SessionSnapshot {
  meta: SessionMeta;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
  settings: AppSettings;
}

/**
 * What GET /settings and PUT /settings return. AppSettings plus a derived
 * `hasApiKey` flag. The Groq API key itself is NEVER returned — the UI only
 * ever learns whether one is configured.
 */
export interface SettingsResponse extends AppSettings {
  hasApiKey: boolean;
  /**
   * Masked preview of the configured key (e.g. `gsk_••••••••1a2b`). Present
   * only when `hasApiKey === true`. The key itself is never returned — this is
   * a display hint so the Settings UI can confirm which key is active without
   * asking the user to re-paste it.
   */
  apiKeyPreview?: string;
}

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface AppSettings {
  prompts: {
    suggestionSystem: string;
    suggestionUser: string;
    chatSystem: string;
    expandSystem: string;
  };
  context: {
    transcriptContextChunks: number;
    chatContextTurns: number;
    chunkSeconds: number;
  };
  llm: {
    suggestionModel: string;
    chatModel: string;
    transcriptionModel: string;
    temperature: number;
    maxTokens: number;
    /** Reasoning effort for the latency-sensitive 3-suggestion generation. */
    suggestionReasoningEffort: ReasoningEffort;
    /** Reasoning effort for typed chat + clicked-suggestion expansion. */
    chatReasoningEffort: ReasoningEffort;
  };
}

// ───── API request/response shapes ─────

export interface StartSessionResponse {
  sessionId: string;
  meta: SessionMeta;
}

export interface UploadChunkResponse {
  transcriptChunk: TranscriptChunk;
  suggestionBatch: SuggestionBatch;
}

export interface RefreshResponse {
  suggestionBatch: SuggestionBatch;
}

export interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface ExpandResponse {
  assistantMessage: ChatMessage;
}

/**
 * Runtime access check for the currently-configured Groq API key.
 * Computed by calling Groq's GET /models and cross-referencing against the
 * three model IDs the app actually uses. `ok` is true iff the key works AND
 * every required model is available to it.
 */
export type ModelRole = 'transcription' | 'suggestion' | 'chat';

export interface ModelAccess {
  role: ModelRole;
  id: string;
  available: boolean;
}

export interface ApiKeyCheckResult {
  ok: boolean;
  hasApiKey: boolean;
  /** Present only when the Groq call succeeded. */
  totalModels?: number;
  required: ModelAccess[];
  /** Present only on failure (network error, 401, etc.). */
  error?: string;
  checkedAt: ISODateString;
}
