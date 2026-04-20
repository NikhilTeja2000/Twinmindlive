import { nanoid } from 'nanoid';
import type { ChatMessage } from '@twinmind/shared';

/**
 * Single responsibility: mint ChatMessage objects with consistent id/timestamp
 * shape. Shared by ChatService and ExpandedAnswerService.
 */
export class ChatMessageFactory {
  user(args: {
    sessionId: string;
    content: string;
    source?: ChatMessage['source'];
  }): ChatMessage {
    return {
      id: nanoid(10),
      sessionId: args.sessionId,
      role: 'user',
      content: args.content,
      createdAt: new Date().toISOString(),
      ...(args.source ? { source: args.source } : {}),
    };
  }

  assistant(args: { sessionId: string; content: string }): ChatMessage {
    return {
      id: nanoid(10),
      sessionId: args.sessionId,
      role: 'assistant',
      content: args.content || '(no response)',
      createdAt: new Date().toISOString(),
    };
  }
}
