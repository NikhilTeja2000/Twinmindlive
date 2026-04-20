import type { FastifyInstance } from 'fastify';
import { ChatRequestSchema, ExpandRequestSchema } from '@twinmind/shared';
import type { ChatService } from '../services/ChatService.js';
import type { ExpandedAnswerService } from '../services/ExpandedAnswerService.js';
import { HttpError } from '../errors/HttpError.js';

interface Deps {
  chat: ChatService;
  expand: ExpandedAnswerService;
}

/**
 * Thin HTTP layer: validate request, call one service method, return result.
 */
export function registerChatController(app: FastifyInstance, deps: Deps): void {
  app.post<{ Params: { id: string } }>('/session/:id/chat', async (req, reply) => {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.message);

    const result = await deps.chat.answerTyped(req.params.id, parsed.data.message);
    return reply.send(result);
  });

  app.post<{ Params: { id: string } }>('/session/:id/expand', async (req, reply) => {
    const parsed = ExpandRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.message);

    const result = await deps.expand.expand(
      req.params.id,
      parsed.data.batchId,
      parsed.data.suggestionId,
    );
    return reply.send(result);
  });
}
