import { nanoid } from 'nanoid';
import type { TranscriptChunk } from '@twinmind/shared';
import type { GroqClient } from '../clients/GroqClient.js';
import type { SettingsStore } from './SettingsStore.js';
import type { IncomingAudioChunk } from './AudioChunkService.js';
import { HttpError } from '../errors/HttpError.js';

/**
 * Single responsibility: turn an `IncomingAudioChunk` into a `TranscriptChunk`
 * by calling Groq Whisper Large V3 and packaging the result.
 *
 * The model ID is read from SettingsStore per call so that runtime edits to
 * `llm.transcriptionModel` take effect on the next chunk without a restart.
 * Knows nothing about sessions, sequences, suggestions, or storage.
 */
export class TranscriptionService {
  constructor(
    private readonly groq: GroqClient,
    private readonly settings: SettingsStore,
  ) {}

  async transcribe(
    sessionId: string,
    sequence: number,
    chunk: IncomingAudioChunk,
    apiKey: string,
    /** Optional rolling vocab/context to bias recognizer (last few transcript chunks). */
    biasPrompt?: string,
  ): Promise<TranscriptChunk> {
    const startedMs = Date.parse(chunk.startedAt);
    const endedMs = Date.parse(chunk.endedAt);
    const declaredDuration = Number.isFinite(startedMs) && Number.isFinite(endedMs)
      ? Math.max(0, endedMs - startedMs)
      : 0;

    const { text, durationSec } = await this.transcribeOrThrow(chunk, apiKey, biasPrompt);

    return {
      id: nanoid(10),
      sessionId,
      sequence,
      text,
      startedAt: chunk.startedAt,
      endedAt: chunk.endedAt,
      durationMs: durationSec ? Math.round(durationSec * 1000) : declaredDuration,
      createdAt: new Date().toISOString(),
    };
  }

  private async transcribeOrThrow(
    chunk: IncomingAudioChunk,
    apiKey: string,
    biasPrompt?: string,
  ): Promise<{ text: string; durationSec?: number }> {
    try {
      return await this.groq.transcribe({
        apiKey,
        model: this.settings.get().llm.transcriptionModel,
        audio: chunk.buffer,
        filename: chunk.filename,
        contentType: chunk.mimeType,
        language: 'en',
        prompt: biasPrompt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (
        message.includes('could not process file - is it a valid media file?') ||
        message.includes('Audio file is too short. Minimum audio length is 0.01 seconds.')
      ) {
        throw new HttpError(
          422,
          'The recorded audio chunk could not be processed. Please try recording again.',
        );
      }
      throw err;
    }
  }
}
