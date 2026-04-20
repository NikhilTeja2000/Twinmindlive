import type { FastifyInstance } from 'fastify';
import type { StartSessionResponse } from '@twinmind/shared';
import type { SessionStore } from '../services/SessionStore.js';
import type { SettingsStore } from '../services/SettingsStore.js';
import type { AudioChunkService } from '../services/AudioChunkService.js';
import type { ChunkPipelineService } from '../services/ChunkPipelineService.js';
import type { SessionTimelineLogger } from '../services/SessionTimelineLogger.js';

interface Deps {
  sessions: SessionStore;
  settings: SettingsStore;
  audio: AudioChunkService;
  pipeline: ChunkPipelineService;
  timeline: SessionTimelineLogger;
}

/**
 * Thin HTTP layer: validate request, call one service method, return result.
 */
export function registerSessionController(app: FastifyInstance, deps: Deps): void {
  app.post('/session/start', async (_req, reply) => {
    const meta = deps.sessions.create();
    deps.timeline.event(meta.id, 'session.start');
    const body: StartSessionResponse = { sessionId: meta.id, meta };
    return reply.send(body);
  });

  app.post<{ Params: { id: string } }>('/session/:id/stop', async (req, reply) => {
    const meta = deps.sessions.stop(req.params.id);
    deps.timeline.event(meta.id, 'session.stop');
    return reply.send({ meta });
  });

  app.get<{ Params: { id: string } }>('/session/:id', async (req, reply) => {
    return reply.send(deps.sessions.snapshot(req.params.id, deps.settings.get()));
  });

  app.post<{ Params: { id: string } }>('/session/:id/chunks', async (req, reply) => {
    const incoming = await deps.audio.parse(await req.file());
    const result = await deps.pipeline.ingestChunk(req.params.id, incoming);
    return reply.send(result);
  });

  app.post<{ Params: { id: string } }>('/session/:id/refresh', async (req, reply) => {
    const result = await deps.pipeline.regenerateSuggestions(req.params.id);
    return reply.send(result);
  });
}
