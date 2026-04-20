import type { ChatResponse } from '@twinmind/shared';
import type { GroqClient } from '../clients/GroqClient.js';
import type { SessionStore } from './SessionStore.js';
import type { SettingsStore } from './SettingsStore.js';
import type { TranscriptContextService } from './TranscriptContextService.js';
import type { ChatMessageFactory } from './ChatMessageFactory.js';
import type { SessionTimelineLogger } from './SessionTimelineLogger.js';

/**
 * Single responsibility: answer a typed user chat message end-to-end — build
 * context, call the LLM, append both messages to the session, log the event.
 *
 * Controller is pure routing/validation; this owns the whole use case.
 */
export class ChatService {
  constructor(
    private readonly groq: GroqClient,
    private readonly sessions: SessionStore,
    private readonly settings: SettingsStore,
    private readonly context: TranscriptContextService,
    private readonly messages: ChatMessageFactory,
    private readonly timeline: SessionTimelineLogger,
  ) {}

  async answerTyped(sessionId: string, userMessageContent: string): Promise<ChatResponse> {
    const session = this.sessions.require(sessionId);
    const settings = this.settings.get();

    const transcriptContext = this.context.recentTranscriptText(
      session.transcript,
      settings.context.transcriptContextChunks,
    );
    const chatContext = this.context.recentChatText(
      session.chat,
      settings.context.chatContextTurns,
    );

    const systemContent = this.context.composeChatSystem(
      settings.prompts.chatSystem,
      transcriptContext,
      chatContext,
    );

    const reply = await this.groq.chat({
      model: settings.llm.chatModel,
      temperature: settings.llm.temperature,
      maxCompletionTokens: settings.llm.maxTokens,
      reasoningEffort: settings.llm.chatReasoningEffort,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userMessageContent },
      ],
    });

    const user = this.messages.user({
      sessionId,
      content: userMessageContent,
      source: { kind: 'typed' },
    });
    const assistant = this.messages.assistant({ sessionId, content: reply });

    this.sessions.appendChat(sessionId, user);
    this.sessions.appendChat(sessionId, assistant);
    this.timeline.event(sessionId, 'chat.message', {
      kind: 'typed',
      chars: assistant.content.length,
    });

    return { userMessage: user, assistantMessage: assistant };
  }
}
