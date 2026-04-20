import { apiClient } from './ApiClient';

/**
 * Single responsibility: trigger an export download for a session in the browser.
 * The actual artifact is generated server-side; this just opens the URL.
 */
export class ExportBuilder {
  download(sessionId: string, format: 'json' | 'txt'): void {
    const url = apiClient.exportUrl(sessionId, format);
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export const exportBuilder = new ExportBuilder();
