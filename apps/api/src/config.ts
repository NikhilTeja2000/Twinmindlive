import 'dotenv/config';

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function float(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function reasoningEffort(
  name: string,
  fallback: 'low' | 'medium' | 'high',
): 'low' | 'medium' | 'high' {
  const v = process.env[name]?.toLowerCase();
  return v === 'low' || v === 'medium' || v === 'high' ? v : fallback;
}

export const config = {
  // Optional at boot: if absent, the user pastes their key in the Settings UI,
  // which is then held in-memory by ApiKeyStore.
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  transcriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL ?? 'whisper-large-v3',
  llmModel: process.env.GROQ_LLM_MODEL ?? 'openai/gpt-oss-120b',
  port: int('API_PORT', 4000),
  host: process.env.API_HOST ?? '0.0.0.0',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  chunkSeconds: int('CHUNK_SECONDS', 30),
  transcriptContextChunks: int('TRANSCRIPT_CONTEXT_CHUNKS', 12),
  chatContextTurns: int('CHAT_CONTEXT_TURNS', 6),
  llmMaxTokens: int('LLM_MAX_TOKENS', 900),
  llmTemperature: float('LLM_TEMPERATURE', 0.4),
  // `low` keeps live 3-suggestion latency tight; `medium` gives chat/expand more headroom.
  llmSuggestionReasoningEffort: reasoningEffort('LLM_SUGGESTION_REASONING_EFFORT', 'low'),
  llmChatReasoningEffort: reasoningEffort('LLM_CHAT_REASONING_EFFORT', 'medium'),
} as const;
