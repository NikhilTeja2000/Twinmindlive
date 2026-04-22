import type { FastifyInstance } from 'fastify';
import { SettingsUpdateSchema, type SettingsResponse } from '@twinmind/shared';
import type { SettingsStore } from '../services/SettingsStore.js';
import type { ApiKeyStore } from '../services/ApiKeyStore.js';
import type { ApiKeyValidationService } from '../services/ApiKeyValidationService.js';
import { HttpError } from '../errors/HttpError.js';
import { requestApiKey } from './requestApiKey.js';

interface Deps {
  settings: SettingsStore;
  apiKeys: ApiKeyStore;
  apiKeyValidation: ApiKeyValidationService;
}

export function registerSettingsController(app: FastifyInstance, deps: Deps): void {
  app.get('/settings', async (req, reply) => {
    return reply.send(buildResponse(deps, requestApiKey(req)));
  });

  app.put('/settings', async (req, reply) => {
    const parsed = SettingsUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.message);

    const { apiKey, ...rest } = parsed.data;
    const requestKey = apiKey?.trim() || requestApiKey(req);
    deps.settings.update(rest);

    return reply.send(buildResponse(deps, requestKey));
  });

  app.get('/settings/api-key/check', async (req, reply) => {
    const result = await deps.apiKeyValidation.check(requestApiKey(req) ?? undefined);
    return reply.send(result);
  });
}

function buildResponse(deps: Deps, requestKey: string | null): SettingsResponse {
  const key = requestKey?.trim() ?? '';
  const hasApiKey = key.length > 0;
  return {
    ...deps.settings.get(),
    hasApiKey,
    ...(hasApiKey ? { apiKeyPreview: maskPreview(key) } : {}),
  };
}

function maskPreview(key: string): string {
  if (key.length <= 8) return '•'.repeat(Math.max(key.length, 4));
  const prefixMatch = key.match(/^([A-Za-z]{2,4}_)/);
  const prefix = prefixMatch?.[1] ?? '';
  const last4 = key.slice(-4);
  return `${prefix}${'•'.repeat(12)}${last4}`;
}
