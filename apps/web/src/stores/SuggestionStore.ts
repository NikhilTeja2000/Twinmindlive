import { create } from 'zustand';
import type { SuggestionBatch } from '@twinmind/shared';

interface SuggestionState {
  batches: SuggestionBatch[]; // newest first
  isRefreshing: boolean;
  prependBatch: (b: SuggestionBatch) => void;
  setRefreshing: (v: boolean) => void;
}

export const useSuggestionStore = create<SuggestionState>((set) => ({
  batches: [],
  isRefreshing: false,
  prependBatch: (b) =>
    set((s) => {
      if (s.batches.some((x) => x.id === b.id)) return s;
      return { batches: [b, ...s.batches] };
    }),
  setRefreshing: (v) => set({ isRefreshing: v }),
}));
