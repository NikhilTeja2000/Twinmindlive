import type { ExpandResponse } from '@twinmind/shared';
import type { GroqClient } from '../clients/GroqClient.js';
import type { SessionStore } from './SessionStore.js';
import type { SettingsStore } from './SettingsStore.js';
import type { TranscriptContextService } from './TranscriptContextService.js';
import type { ChatMessageFactory } from './ChatMessageFactory.js';
import type { SessionTimelineLogger } from './SessionTimelineLogger.js';
import { HttpError } from '../errors/HttpError.js';

/**
 * Single responsibility: when a user clicks a suggestion, produce a deeper
 * answer for that specific suggestion and append it to the chat end-to-end.
 */
export class ExpandedAnswerService {
  constructor(
    private readonly groq: GroqClient,
    private readonly sessions: SessionStore,
    private readonly settings: SettingsStore,
    private readonly context: TranscriptContextService,
    private readonly messages: ChatMessageFactory,
    private readonly timeline: SessionTimelineLogger,
  ) {}

  async expand(sessionId: string, batchId: string, suggestionId: string): Promise<ExpandResponse> {
    const session = this.sessions.require(sessionId);
    const settings = this.settings.get();

    const batch = session.suggestionBatches.find((b) => b.id === batchId);
    if (!batch) throw new HttpError(404, 'Suggestion batch not found');
    const suggestion = batch.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) throw new HttpError(404, 'Suggestion not found in batch');

    const transcriptContext = this.context.recentTranscriptText(
      session.transcript,
      settings.context.transcriptContextChunks,
    );
    const chatContext = this.context.recentChatText(
      session.chat,
      settings.context.chatContextTurns,
    );

    const systemContent = this.context.composeChatSystem(
      settings.prompts.expandSystem,
      transcriptContext,
      chatContext,
    );
    const userContent =
      `The user clicked this suggestion:\n` +
      `TITLE: ${suggestion.title}\n` +
      `BODY: ${suggestion.body}\n\n` +
      `Provide a deeper, more actionable answer for this suggestion.`;

    const reply = await this.groq.chat({
      model: settings.llm.chatModel,
      temperature: settings.llm.temperature,
      maxCompletionTokens: settings.llm.maxTokens,
      reasoningEffort: settings.llm.chatReasoningEffort,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
    });

    const user = this.messages.user({
      sessionId,
      // No "[Suggestion]" prefix — the message's `source.kind === 'suggestion'`
      // is the structured signal of provenance (the UI renders a kind pill on
      // top of the bubble using it). Keeping a textual prefix would diverge
      // from the frontend's optimistic message and bloat exports.
      content: suggestion.title,
      source: { kind: 'suggestion', suggestionId: suggestion.id },
    });
    const assistant = this.messages.assistant({ sessionId, content: reply });

    this.sessions.appendChat(sessionId, user);
    this.sessions.appendChat(sessionId, assistant);
    this.timeline.event(sessionId, 'chat.message', {
      kind: 'suggestion',
      suggestionId: suggestion.id,
      chars: assistant.content.length,
    });

    return { assistantMessage: assistant };
  }
}
