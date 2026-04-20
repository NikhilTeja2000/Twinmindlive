import Groq, { toFile } from 'groq-sdk';
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
} from 'groq-sdk/resources/chat/completions';
import type { ApiKeyStore } from '../services/ApiKeyStore.js';

/**
 * Thin wrapper around the Groq SDK. Single responsibility: talk to Groq.
 *
 * The API key comes from ApiKeyStore (seeded by env, overridable at runtime
 * from the Settings UI). The underlying Groq SDK instance is rebuilt lazily
 * whenever the key changes so HTTP keep-alive stays intact on the hot path.
 *
 * Higher-level prompt construction lives in the services that own the use case.
 */
export class GroqClient {
  private client: Groq;
  private cachedKey: string;

  constructor(private readonly keys: ApiKeyStore) {
    this.cachedKey = keys.get();
    this.client = new Groq({ apiKey: this.cachedKey });
  }

  private sdk(): Groq {
    const current = this.keys.get();
    if (current !== this.cachedKey) {
      this.cachedKey = current;
      this.client = new Groq({ apiKey: current });
    }
    return this.client;
  }

  async transcribe(params: {
    model: string;
    audio: Buffer;
    filename: string;
    contentType: string;
    /** Optional language hint, e.g. "en" — speeds up + improves accuracy. */
    language?: string;
    /** Optional prompt to bias the recognizer (e.g. domain vocabulary). */
    prompt?: string;
  }): Promise<{ text: string; durationSec?: number }> {
    const file = await toFile(params.audio, params.filename, { type: params.contentType });
    const result = await this.sdk().audio.transcriptions.create({
      model: params.model,
      file,
      response_format: 'verbose_json',
      language: params.language,
      prompt: params.prompt,
      temperature: 0,
    });
    const text = (result as { text?: string }).text ?? '';
    const duration = (result as { duration?: number }).duration;
    return { text: text.trim(), durationSec: duration };
  }

  async chat(params: {
    model: string;
    messages: ChatCompletionMessageParam[];
    temperature: number;
    maxCompletionTokens: number;
    /** Groq reasoning-model knob. Lower = faster first-token + fewer thinking tokens. */
    reasoningEffort?: 'low' | 'medium' | 'high';
    /**
     * `'json_object'` = loose JSON mode (model decides shape).
     * `{ type: 'json_schema', ... }` = strict structured output enforced by the server.
     */
    responseFormat?:
      | 'text'
      | 'json_object'
      | {
          type: 'json_schema';
          jsonSchema: { name: string; schema: unknown; strict?: boolean };
        };
  }): Promise<string> {
    const responseFormat = (() => {
      if (params.responseFormat === 'json_object') return { type: 'json_object' as const };
      if (
        params.responseFormat &&
        typeof params.responseFormat === 'object' &&
        params.responseFormat.type === 'json_schema'
      ) {
        return {
          type: 'json_schema' as const,
          json_schema: {
            name: params.responseFormat.jsonSchema.name,
            schema: params.responseFormat.jsonSchema.schema,
            strict: params.responseFormat.jsonSchema.strict ?? true,
          },
        };
      }
      return undefined;
    })();

    // NOTE: groq-sdk 0.7 types predate `max_completion_tokens`, `reasoning_effort`,
    // and `json_schema` response_format, but the Groq API accepts them. We localize
    // the single cast here so no other module has to know about SDK type lag.
    const body = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_completion_tokens: params.maxCompletionTokens,
      ...(params.reasoningEffort ? { reasoning_effort: params.reasoningEffort } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
    };

    const sdk = this.sdk();
    const completion = (await sdk.chat.completions.create(
      body as unknown as Parameters<typeof sdk.chat.completions.create>[0],
    )) as ChatCompletion;
    return completion.choices[0]?.message?.content?.trim() ?? '';
  }

  /**
   * Lists every model the current key can see. Used by the settings UI to
   * verify that a pasted key has access to the three required model IDs.
   */
  async listModels(): Promise<string[]> {
    const res = await this.sdk().models.list();
    return res.data.map((m) => m.id);
  }
}
