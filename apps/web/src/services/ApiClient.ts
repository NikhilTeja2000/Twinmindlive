import type {
  ApiKeyCheckResult,
  ChatResponse,
  ExpandResponse,
  RefreshResponse,
  SessionSnapshot,
  SettingsResponse,
  SettingsUpdate,
  StartSessionResponse,
  UploadChunkResponse,
} from '@twinmind/shared';

/**
 * Single responsibility: typed wrapper around the API.
 * No state, no UI; throws on non-2xx with a parsed error message.
 */
export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    // Only tag the request as JSON when a JSON body is actually present.
    // Bodyless POSTs (session/start, stop, refresh) must NOT carry
    // Content-Type: application/json — Fastify would then try to parse an
    // empty body and reject it with FST_ERR_CTP_EMPTY_JSON_BODY.
    const body = init?.body;
    const sendsJsonBody = body !== undefined && body !== null && !(body instanceof FormData);

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(sendsJsonBody ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  }

  startSession(): Promise<StartSessionResponse> {
    return this.request<StartSessionResponse>('/session/start', { method: 'POST' });
  }

  stopSession(sessionId: string): Promise<{ meta: unknown }> {
    return this.request(`/session/${sessionId}/stop`, { method: 'POST' });
  }

  getSession(sessionId: string): Promise<SessionSnapshot> {
    return this.request<SessionSnapshot>(`/session/${sessionId}`);
  }

  uploadChunk(args: {
    sessionId: string;
    blob: Blob;
    sequenceNumber: number;
    startedAt: string;
    endedAt: string;
  }): Promise<UploadChunkResponse> {
    const fd = new FormData();
    const ext = args.blob.type.includes('webm') ? 'webm' : 'mp4';
    fd.append('audio', args.blob, `chunk-${args.sequenceNumber}.${ext}`);
    fd.append('sequenceNumber', String(args.sequenceNumber));
    fd.append('startedAt', args.startedAt);
    fd.append('endedAt', args.endedAt);
    return this.request<UploadChunkResponse>(`/session/${args.sessionId}/chunks`, {
      method: 'POST',
      body: fd,
    });
  }

  refresh(sessionId: string): Promise<RefreshResponse> {
    return this.request<RefreshResponse>(`/session/${sessionId}/refresh`, { method: 'POST' });
  }

  chat(sessionId: string, message: string): Promise<ChatResponse> {
    return this.request<ChatResponse>(`/session/${sessionId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  expand(sessionId: string, suggestionId: string, batchId: string): Promise<ExpandResponse> {
    return this.request<ExpandResponse>(`/session/${sessionId}/expand`, {
      method: 'POST',
      body: JSON.stringify({ suggestionId, batchId }),
    });
  }

  getSettings(): Promise<SettingsResponse> {
    return this.request<SettingsResponse>('/settings');
  }

  updateSettings(patch: SettingsUpdate): Promise<SettingsResponse> {
    return this.request<SettingsResponse>('/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  checkApiKey(): Promise<ApiKeyCheckResult> {
    return this.request<ApiKeyCheckResult>('/settings/api-key/check');
  }

  exportUrl(sessionId: string, format: 'json' | 'txt'): string {
    return `${this.baseUrl}/session/${sessionId}/export?format=${format}`;
  }
}

export const apiClient = new ApiClient(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
);
