import { create } from 'zustand';

interface SessionState {
  sessionId: string | null;
  startedAt: string | null;
  isRecording: boolean;
  isStarting: boolean;
  isStopping: boolean;
  error: string | null;
  setSession: (id: string, startedAt: string) => void;
  clear: () => void;
  setRecording: (v: boolean) => void;
  setStarting: (v: boolean) => void;
  setStopping: (v: boolean) => void;
  setError: (msg: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  startedAt: null,
  isRecording: false,
  isStarting: false,
  isStopping: false,
  error: null,
  setSession: (id, startedAt) => set({ sessionId: id, startedAt, error: null }),
  clear: () =>
    set({ sessionId: null, startedAt: null, isRecording: false, error: null }),
  setRecording: (v) => set({ isRecording: v }),
  setStarting: (v) => set({ isStarting: v }),
  setStopping: (v) => set({ isStopping: v }),
  setError: (msg) => set({ error: msg }),
}));
