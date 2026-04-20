import type { AppSettings, SettingsUpdate } from '@twinmind/shared';

/**
 * Single responsibility: hold global runtime settings (prompts, context windows, model ids).
 * Lives in-memory; resets when the server restarts (matches the assignment's persistence model).
 */
export class SettingsStore {
  private current: AppSettings;

  constructor(initial: AppSettings) {
    this.current = initial;
  }

  get(): AppSettings {
    return this.current;
  }

  update(patch: SettingsUpdate): AppSettings {
    this.current = {
      prompts: { ...this.current.prompts, ...(patch.prompts ?? {}) },
      context: { ...this.current.context, ...(patch.context ?? {}) },
      llm: { ...this.current.llm, ...(patch.llm ?? {}) },
    };
    return this.current;
  }
}
