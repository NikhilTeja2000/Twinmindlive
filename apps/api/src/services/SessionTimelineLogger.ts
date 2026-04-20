import type { FastifyBaseLogger } from 'fastify';

/**
 * Single responsibility: structured timestamped event logging for a session.
 * Logs go to stdout via Fastify's pino logger; no separate sink to keep the
 * dependency graph small for this take-home.
 */
export class SessionTimelineLogger {
  constructor(private readonly log: FastifyBaseLogger) {}

  event(sessionId: string, event: string, data: Record<string, unknown> = {}): void {
    this.log.info({ at: new Date().toISOString(), sessionId, event, ...data }, event);
  }
}
