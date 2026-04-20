import { create } from 'zustand';
import type { ChatMessage } from '@twinmind/shared';

interface ChatState {
  messages: ChatMessage[];
  isSending: boolean;
  appendMessages: (msgs: ChatMessage[]) => void;
  setSending: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isSending: false,
  appendMessages: (msgs) =>
    set((s) => {
      const existing = new Set(s.messages.map((m) => m.id));
      const fresh = msgs.filter((m) => !existing.has(m.id));
      return { messages: [...s.messages, ...fresh] };
    }),
  setSending: (v) => set({ isSending: v }),
}));
