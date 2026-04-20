import type { ApiKeyCheckResult, ModelAccess } from '@twinmind/shared';
import type { GroqClient } from '../clients/GroqClient.js';
import type { ApiKeyStore } from './ApiKeyStore.js';
import type { SettingsStore } from './SettingsStore.js';

/**
 * Single responsibility: report what the currently-configured Groq API key
 * can actually access. Does not mutate state; the controller owns the HTTP
 * layer, the GroqClient owns the SDK call.
 */
export class ApiKeyValidationService {
  constructor(
    private readonly groq: GroqClient,
    private readonly apiKeys: ApiKeyStore,
    private readonly settings: SettingsStore,
  ) {}

  async check(): Promise<ApiKeyCheckResult> {
    const checkedAt = new Date().toISOString();
    const hasApiKey = this.apiKeys.has();
    const required = this.requiredModels();

    if (!hasApiKey) {
      return {
        ok: false,
        hasApiKey: false,
        required: required.map((r) => ({ ...r, available: false })),
        error: 'No API key configured.',
        checkedAt,
      };
    }

    try {
      const available = new Set(await this.groq.listModels());
      const resolved = required.map<ModelAccess>((r) => ({
        ...r,
        available: available.has(r.id),
      }));
      return {
        ok: resolved.every((r) => r.available),
        hasApiKey: true,
        totalModels: available.size,
        required: resolved,
        checkedAt,
      };
    } catch (err) {
      return {
        ok: false,
        hasApiKey: true,
        required: required.map((r) => ({ ...r, available: false })),
        error: extractMessage(err),
        checkedAt,
      };
    }
  }

  private requiredModels(): ModelAccess[] {
    const { llm } = this.settings.get();
    return [
      { role: 'transcription', id: llm.transcriptionModel, available: false },
      { role: 'suggestion', id: llm.suggestionModel, available: false },
      { role: 'chat', id: llm.chatModel, available: false },
    ];
  }
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Unknown error while contacting Groq.';
}
