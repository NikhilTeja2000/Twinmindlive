'use client';

import { useEffect } from 'react';
import { apiClient } from '@/services/ApiClient';
import { useSettingsStore } from '@/stores/SettingsStore';

/**
 * Single responsibility: load settings from the API once on mount and push
 * them into the Zustand store. Idempotent — safe to call from the app root.
 */
export function useSettingsHydration(): void {
  const hydrated = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const setError = useSettingsStore((s) => s.setError);

  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getSettings();
        if (!cancelled) setSettings(res);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, setSettings, setError]);
}
