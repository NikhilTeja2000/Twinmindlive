'use client';

import { useCallback } from 'react';
import { apiClient } from '@/services/ApiClient';
import { useSettingsStore } from '@/stores/SettingsStore';

/**
 * Single responsibility: call GET /settings/api-key/check and mirror the
 * result into the settings store so the UI can render an access report.
 * Never throws — any transport/Groq error is captured in the returned result.
 */
export function useCheckApiKey() {
  const setCheck = useSettingsStore((s) => s.setCheck);
  const setChecking = useSettingsStore((s) => s.setChecking);
  const isChecking = useSettingsStore((s) => s.isChecking);
  const check = useSettingsStore((s) => s.check);

  const run = useCallback(async () => {
    setChecking(true);
    try {
      const res = await apiClient.checkApiKey();
      setCheck(res);
      return res;
    } catch (err) {
      const fallback = {
        ok: false,
        hasApiKey: false,
        required: [],
        error: (err as Error).message,
        checkedAt: new Date().toISOString(),
      };
      setCheck(fallback);
      return fallback;
    } finally {
      setChecking(false);
    }
  }, [setCheck, setChecking]);

  return { run, isChecking, check };
}
