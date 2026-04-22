import type { RefreshResponse, UploadChunkResponse } from '@twinmind/shared';
import type { IncomingAudioChunk } from './AudioChunkService.js';
import type { SessionStore } from './SessionStore.js';
import type { SettingsStore } from './SettingsStore.js';
import type { TranscriptionService } from './TranscriptionService.js';
import type { TranscriptContextService } from './TranscriptContextService.js';
import type { SuggestionService } from './SuggestionService.js';
import type { SessionTimelineLogger } from './SessionTimelineLogger.js';
import { HttpError } from '../errors/HttpError.js';

/**
 * Single responsibility: the transcribe-then-suggest pipeline.
 *
 *   ingestChunk           audio chunk -> transcript chunk -> suggestion batch
 *   regenerateSuggestions current transcript -> fresh suggestion batch
 *
 * Controllers only validate HTTP and call one of these two methods.
 */
export class ChunkPipelineService {
  constructor(
    private readonly sessions: SessionStore,
    private readonly settings: SettingsStore,
    private readonly transcription: TranscriptionService,
    private readonly context: TranscriptContextService,
    private readonly suggestions: SuggestionService,
    private readonly timeline: SessionTimelineLogger,
  ) {}

  async ingestChunk(
    sessionId: string,
    incoming: IncomingAudioChunk,
    apiKey: string,
  ): Promise<UploadChunkResponse> {
    const session = this.sessions.require(sessionId);
    const settings = this.settings.get();
    const sequence = this.sessions.nextTranscriptSequence(sessionId);
    const bias = this.context.recognizerBias(session.transcript);

    const transcriptChunk = await this.transcription.transcribe(
      sessionId,
      sequence,
      incoming,
      apiKey,
      bias,
    );
    this.sessions.appendTranscript(sessionId, transcriptChunk);
    this.timeline.event(sessionId, 'transcript.append', {
      sequence,
      chars: transcriptChunk.text.length,
      durationMs: transcriptChunk.durationMs,
    });

    const updated = this.sessions.require(sessionId);
    const transcriptContext = this.context.recentTranscriptForSuggestions(
      updated.transcript,
      settings.context.transcriptContextChunks,
    );

    const suggestionBatch = await this.suggestions.generate({
      sessionId,
      apiKey,
      transcriptContext,
      basedOnTranscriptThroughSeq: transcriptChunk.sequence,
      reason: 'auto',
      settings,
    });
    this.sessions.prependBatch(sessionId, suggestionBatch);
    this.timeline.event(sessionId, 'suggestions.generated', {
      reason: 'auto',
      basedOnSeq: transcriptChunk.sequence,
    });

    return { transcriptChunk, suggestionBatch };
  }

  async regenerateSuggestions(sessionId: string, apiKey: string): Promise<RefreshResponse> {
    const session = this.sessions.require(sessionId);
    const settings = this.settings.get();

    if (session.transcript.length === 0) {
      throw new HttpError(409, 'No transcript yet — record some audio first.');
    }

    const transcriptContext = this.context.recentTranscriptForSuggestions(
      session.transcript,
      settings.context.transcriptContextChunks,
    );
    const lastSeq = session.transcript[session.transcript.length - 1]?.sequence ?? null;

    const suggestionBatch = await this.suggestions.generate({
      sessionId,
      apiKey,
      transcriptContext,
      basedOnTranscriptThroughSeq: lastSeq,
      reason: 'manual',
      settings,
    });
    this.sessions.prependBatch(sessionId, suggestionBatch);
    this.timeline.event(sessionId, 'suggestions.generated', {
      reason: 'manual',
      basedOnSeq: lastSeq,
    });

    return { suggestionBatch };
  }
}
