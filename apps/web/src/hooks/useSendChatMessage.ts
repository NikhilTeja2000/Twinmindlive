'use client';

import { useCallback } from 'react';
import { apiClient } from '@/services/ApiClient';
import { useChatStore } from '@/stores/ChatStore';
import { useSessionStore } from '@/stores/SessionStore';

/**
 * Single responsibility: orchestrate sending a typed chat message.
 * Owns the API call + store mutation + pending/error signalling.
 * Returns values the component renders; the component does not touch stores.
 */
export function useSendChatMessage() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const isSending = useChatStore((s) => s.isSending);
  const appendMessages = useChatStore((s) => s.appendMessages);
  const setSending = useChatStore((s) => s.setSending);
  const setError = useSessionStore((s) => s.setError);

  const send = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!sessionId || !trimmed || isSending) return;
      setSending(true);
      try {
        const res = await apiClient.chat(sessionId, trimmed);
        appendMessages([res.userMessage, res.assistantMessage]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSending(false);
      }
    },
    [sessionId, isSending, appendMessages, setSending, setError],
  );

  return { send, isSending, canSend: !!sessionId && !isSending };
}
