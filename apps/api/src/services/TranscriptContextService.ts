import type { ChatMessage, TranscriptChunk } from '@twinmind/shared';

/**
 * Single responsibility: produce the exact context strings (and chat-system
 * prompt assembly) that the LLM prompts will consume. Centralising this means
 * suggestion / chat / expand prompts all see the conversation the same way.
 */
export class TranscriptContextService {
  /**
   * Format the most recent N transcript chunks as a single string, oldest first.
   * Each chunk is timestamped (relative seconds from session start) so the model
   * understands ordering.
   */
  recentTranscriptText(transcript: TranscriptChunk[], maxChunks: number): string {
    if (transcript.length === 0) return '(no speech captured yet)';
    const slice = transcript.slice(-maxChunks);
    const sessionStart = Date.parse(transcript[0]!.startedAt);
    return slice.map((c) => this.formatLine(c, sessionStart)).join('\n');
  }

  /**
   * Like recentTranscriptText(), but splits the final chunk into an explicit
   * "CURRENT UTTERANCE" anchor block. This is the shape the suggestion prompt
   * expects: the model treats BACKGROUND as context and anchors its 3
   * suggestions on the CURRENT UTTERANCE — which is the fix for topic-pivot
   * cases (e.g. speaker starts about React, then pivots to mobile).
   *
   * Chat / expand intentionally do NOT use this shape: they are anchored on
   * the user's typed message or clicked suggestion, not on the last chunk.
   */
  recentTranscriptForSuggestions(
    transcript: TranscriptChunk[],
    maxChunks: number,
  ): string {
    if (transcript.length === 0) return '(no speech captured yet)';
    const slice = transcript.slice(-maxChunks);
    const sessionStart = Date.parse(transcript[0]!.startedAt);
    const lastIdx = slice.length - 1;
    const background = slice
      .slice(0, lastIdx)
      .map((c) => this.formatLine(c, sessionStart))
      .join('\n');
    const current = this.formatLine(slice[lastIdx]!, sessionStart);

    const parts: string[] = [];
    if (background) {
      parts.push('--- BACKGROUND (older utterances, context only) ---');
      parts.push(background);
      parts.push('');
    }
    parts.push('--- CURRENT UTTERANCE (anchor your 3 suggestions HERE) ---');
    parts.push(current);
    return parts.join('\n');
  }

  /**
   * A short biasing prompt to feed into Whisper for the *next* chunk —
   * helps continuity (names, jargon, etc.). Keep it tight; Whisper truncates.
   */
  recognizerBias(transcript: TranscriptChunk[]): string | undefined {
    if (transcript.length === 0) return undefined;
    const tail = transcript.slice(-3).map((c) => c.text).join(' ');
    return tail.slice(-450); // last ~450 chars
  }

  recentChatText(chat: ChatMessage[], maxTurns: number): string {
    if (chat.length === 0) return '(no prior chat)';
    const slice = chat.slice(-maxTurns * 2);
    return slice.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  }

  /**
   * Glue a user-authored system prompt with the live transcript + recent chat
   * blocks. Shared by ChatService and ExpandedAnswerService so both paths feed
   * the model the same context skeleton.
   */
  composeChatSystem(
    systemPrompt: string,
    transcriptContext: string,
    chatContext: string,
  ): string {
    return (
      `${systemPrompt}\n\n` +
      `--- LIVE TRANSCRIPT (most recent last) ---\n${transcriptContext}\n` +
      `--- RECENT CHAT ---\n${chatContext}`
    );
  }

  private formatLine(c: TranscriptChunk, sessionStart: number): string {
    const offsetSec = Math.max(
      0,
      Math.round((Date.parse(c.startedAt) - sessionStart) / 1000),
    );
    return `[${formatOffset(offsetSec)}] ${c.text}`;
  }
}

function formatOffset(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
