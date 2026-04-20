import { create } from 'zustand';
import type { TranscriptChunk } from '@twinmind/shared';

interface TranscriptState {
  chunks: TranscriptChunk[];
  appendChunk: (c: TranscriptChunk) => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  chunks: [],
  appendChunk: (c) =>
    set((s) => {
      // Idempotent append by id.
      if (s.chunks.some((x) => x.id === c.id)) return s;
      return { chunks: [...s.chunks, c] };
    }),
}));
