import { create } from 'zustand';
import type { ApiKeyCheckResult, SettingsResponse } from '@twinmind/shared';

interface SettingsState {
  settings: SettingsResponse | null;
  isSaving: boolean;
  error: string | null;
  /** Result of the last GET /settings/api-key/check — null until the user runs one. */
  check: ApiKeyCheckResult | null;
  isChecking: boolean;
  setSettings: (s: SettingsResponse) => void;
  setSaving: (v: boolean) => void;
  setError: (e: string | null) => void;
  setCheck: (c: ApiKeyCheckResult | null) => void;
  setChecking: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isSaving: false,
  error: null,
  check: null,
  isChecking: false,
  setSettings: (s) => set({ settings: s }),
  setSaving: (v) => set({ isSaving: v }),
  setError: (e) => set({ error: e }),
  setCheck: (c) => set({ check: c }),
  setChecking: (v) => set({ isChecking: v }),
}));
