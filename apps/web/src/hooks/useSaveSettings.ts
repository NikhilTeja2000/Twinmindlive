'use client';

import { useCallback } from 'react';
import type { SettingsUpdate } from '@twinmind/shared';
import { apiClient } from '@/services/ApiClient';
import { useSettingsStore } from '@/stores/SettingsStore';

/**
 * Single responsibility: PUT a settings patch to the API, update the Zustand
 * store on success, and surface pending/error state to the caller.
 */
export function useSaveSettings() {
  const setSettings = useSettingsStore((s) => s.setSettings);
  const setSaving = useSettingsStore((s) => s.setSaving);
  const setError = useSettingsStore((s) => s.setError);
  const isSaving = useSettingsStore((s) => s.isSaving);

  const save = useCallback(
    async (patch: SettingsUpdate): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const res = await apiClient.updateSettings(patch);
        setSettings(res);
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [setSettings, setSaving, setError],
  );

  return { save, isSaving };
}
