import { nanoid } from 'nanoid';
import type {
  AppSettings,
  ChatMessage,
  SessionMeta,
  SessionSnapshot,
  SuggestionBatch,
  TranscriptChunk,
} from '@twinmind/shared';
import { HttpError } from '../errors/HttpError.js';

interface SessionRecord {
  meta: SessionMeta;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
}

/**
 * In-memory session store. Single responsibility: hold per-session state.
 * Settings are global (one tenant), so they live in SettingsStore.
 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  create(): SessionMeta {
    const now = new Date().toISOString();
    const meta: SessionMeta = {
      id: nanoid(12),
      createdAt: now,
      startedAt: now,
      stoppedAt: null,
    };
    this.sessions.set(meta.id, {
      meta,
      transcript: [],
      suggestionBatches: [],
      chat: [],
    });
    return meta;
  }

  get(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  require(sessionId: string): SessionRecord {
    const s = this.sessions.get(sessionId);
    if (!s) throw new HttpError(404, `Session not found: ${sessionId}`);
    return s;
  }

  stop(sessionId: string): SessionMeta {
    const s = this.require(sessionId);
    s.meta.stoppedAt = new Date().toISOString();
    return s.meta;
  }

  appendTranscript(sessionId: string, chunk: TranscriptChunk): void {
    this.require(sessionId).transcript.push(chunk);
  }

  prependBatch(sessionId: string, batch: SuggestionBatch): void {
    // Newest batch on top — store as descending order (index 0 = newest).
    this.require(sessionId).suggestionBatches.unshift(batch);
  }

  appendChat(sessionId: string, msg: ChatMessage): void {
    this.require(sessionId).chat.push(msg);
  }

  nextTranscriptSequence(sessionId: string): number {
    return this.require(sessionId).transcript.length;
  }

  snapshot(sessionId: string, settings: AppSettings): SessionSnapshot {
    const s = this.require(sessionId);
    return {
      meta: s.meta,
      transcript: [...s.transcript],
      suggestionBatches: [...s.suggestionBatches],
      chat: [...s.chat],
      settings,
    };
  }
}
