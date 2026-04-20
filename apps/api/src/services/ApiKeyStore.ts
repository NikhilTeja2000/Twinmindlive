/**
 * Single responsibility: hold the Groq API key in memory.
 *
 * The key is NEVER serialised back over HTTP — the settings controller only
 * exposes `hasApiKey: boolean`. The store seeds from env at boot and can be
 * overwritten at runtime by the user via the Settings drawer.
 */
export class ApiKeyStore {
  private key: string;

  constructor(initial: string) {
    this.key = initial ?? '';
  }

  get(): string {
    return this.key;
  }

  has(): boolean {
    return this.key.trim().length > 0;
  }

  /**
   * Masked, display-safe form of the key (e.g. `gsk_••••••••1a2b`). Returns
   * an empty string when no key is configured. Never leaks the secret middle.
   */
  preview(): string {
    const k = this.key;
    if (k.length === 0) return '';
    if (k.length <= 8) return '•'.repeat(Math.max(k.length, 4));
    const prefixMatch = k.match(/^([A-Za-z]{2,4}_)/);
    const prefix = prefixMatch?.[1] ?? '';
    const last4 = k.slice(-4);
    return `${prefix}${'•'.repeat(12)}${last4}`;
  }

  set(next: string): void {
    const trimmed = next.trim();
    if (trimmed.length < 10) {
      throw new Error('API key looks invalid (too short).');
    }
    this.key = trimmed;
  }
}
