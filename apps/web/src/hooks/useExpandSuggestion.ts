'use client';

import { useCallback, useState } from 'react';
import type { Suggestion } from '@twinmind/shared';
import { apiClient } from '@/services/ApiClient';
import { useChatStore } from '@/stores/ChatStore';
import { useSessionStore } from '@/stores/SessionStore';

/**
 * Single responsibility: orchestrate a "user clicked a suggestion" flow.
 * Owns the optimistic local user-bubble, the API call, the store mutation,
 * and the per-suggestion pending signal the UI uses to disable cards.
 */
export function useExpandSuggestion() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const appendMessages = useChatStore((s) => s.appendMessages);
  const setSending = useChatStore((s) => s.setSending);
  const setError = useSessionStore((s) => s.setError);

  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);

  const expand = useCallback(
    async (suggestion: Suggestion, batchId: string): Promise<void> => {
      if (!sessionId || pendingSuggestionId) return;
      setPendingSuggestionId(suggestion.id);
      setSending(true);
      try {
        const res = await apiClient.expand(sessionId, suggestion.id, batchId);
        appendMessages([
          {
            id: `local-${suggestion.id}`,
            sessionId,
            role: 'user',
            content: suggestion.title,
            createdAt: new Date().toISOString(),
            source: { kind: 'suggestion', suggestionId: suggestion.id },
          },
          res.assistantMessage,
        ]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPendingSuggestionId(null);
        setSending(false);
      }
    },
    [sessionId, pendingSuggestionId, appendMessages, setSending, setError],
  );

  return { expand, pendingSuggestionId, isBusy: pendingSuggestionId !== null };
}
