import type { FastifyInstance } from 'fastify';
import { SettingsUpdateSchema, type SettingsResponse } from '@twinmind/shared';
import type { SettingsStore } from '../services/SettingsStore.js';
import type { ApiKeyStore } from '../services/ApiKeyStore.js';
import type { ApiKeyValidationService } from '../services/ApiKeyValidationService.js';
import { HttpError } from '../errors/HttpError.js';

interface Deps {
  settings: SettingsStore;
  apiKeys: ApiKeyStore;
  apiKeyValidation: ApiKeyValidationService;
}

export function registerSettingsController(app: FastifyInstance, deps: Deps): void {
  app.get('/settings', async (_req, reply) => {
    return reply.send(buildResponse(deps));
  });

  app.put('/settings', async (req, reply) => {
    const parsed = SettingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.message);

    const { apiKey, ...rest } = parsed.data;
    if (apiKey !== undefined) {
      try {
        deps.apiKeys.set(apiKey);
      } catch (err) {
        throw new HttpError(400, (err as Error).message);
      }
    }
    deps.settings.update(rest);

    return reply.send(buildResponse(deps));
  });

  app.get('/settings/api-key/check', async (_req, reply) => {
    const result = await deps.apiKeyValidation.check();
    return reply.send(result);
  });
}

function buildResponse(deps: Deps): SettingsResponse {
  const hasApiKey = deps.apiKeys.has();
  return {
    ...deps.settings.get(),
    hasApiKey,
    ...(hasApiKey ? { apiKeyPreview: deps.apiKeys.preview() } : {}),
  };
}
