import type { FastifyInstance } from 'fastify';
import type { SessionStore } from '../services/SessionStore.js';
import type { SettingsStore } from '../services/SettingsStore.js';
import type { ExportService } from '../services/ExportService.js';
import { HttpError } from '../errors/HttpError.js';

interface Deps {
  sessions: SessionStore;
  settings: SettingsStore;
  exporter: ExportService;
}

export function registerExportController(app: FastifyInstance, deps: Deps): void {
  app.get<{ Params: { id: string }; Querystring: { format?: 'json' | 'txt' } }>(
    '/session/:id/export',
    async (req, reply) => {
      const fmt = req.query.format ?? 'json';
      if (fmt !== 'json' && fmt !== 'txt') {
        throw new HttpError(400, 'format must be "json" or "txt"');
      }
      const snapshot = deps.sessions.snapshot(req.params.id, deps.settings.get());
      const out = fmt === 'json' ? deps.exporter.toJson(snapshot) : deps.exporter.toTxt(snapshot);
      reply.header('Content-Type', out.contentType);
      reply.header('Content-Disposition', `attachment; filename="${out.filename}"`);
      return reply.send(out.body);
    },
  );
}
