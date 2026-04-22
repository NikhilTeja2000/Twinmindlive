import type { FastifyRequest } from 'fastify';

const API_KEY_HEADER = 'x-groq-api-key';

/**
 * Per-request key extraction for browser-scoped API keys.
 * Accepts either `x-groq-api-key` or `X-Groq-Api-Key`.
 */
export function requestApiKey(req: FastifyRequest): string | null {
  const raw = req.headers[API_KEY_HEADER] ?? req.headers[API_KEY_HEADER.toUpperCase()];
  if (Array.isArray(raw)) return raw[0]?.trim() || null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

