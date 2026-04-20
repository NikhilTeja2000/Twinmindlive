import type { SessionSnapshot } from '@twinmind/shared';

/**
 * Single responsibility: convert an in-memory SessionSnapshot into an
 * exportable artifact (JSON or human-readable TXT).
 */
export class ExportService {
  toJson(snapshot: SessionSnapshot): { body: string; contentType: string; filename: string } {
    return {
      body: JSON.stringify(snapshot, null, 2),
      contentType: 'application/json',
      filename: `session-${snapshot.meta.id}.json`,
    };
  }

  toTxt(snapshot: SessionSnapshot): { body: string; contentType: string; filename: string } {
    const lines: string[] = [];
    lines.push(`# Twinmind Live — Session ${snapshot.meta.id}`);
    lines.push(`Started:  ${snapshot.meta.startedAt ?? '(never)'}`);
    lines.push(`Stopped:  ${snapshot.meta.stoppedAt ?? '(still running)'}`);
    lines.push('');

    lines.push('## Transcript');
    if (snapshot.transcript.length === 0) {
      lines.push('(empty)');
    } else {
      for (const c of snapshot.transcript) {
        lines.push(`[${c.startedAt}]  #${c.sequence}  (${Math.round(c.durationMs / 1000)}s)`);
        lines.push(c.text);
        lines.push('');
      }
    }

    lines.push('## Suggestion batches (newest first)');
    if (snapshot.suggestionBatches.length === 0) {
      lines.push('(none)');
    } else {
      for (const b of snapshot.suggestionBatches) {
        lines.push(`-- ${b.createdAt}  (${b.reason}) --`);
        b.suggestions.forEach((s, i) => {
          lines.push(`${i + 1}. ${s.title}`);
          lines.push(`   ${s.body}`);
        });
        lines.push('');
      }
    }

    lines.push('## Chat');
    if (snapshot.chat.length === 0) {
      lines.push('(no chat)');
    } else {
      for (const m of snapshot.chat) {
        lines.push(`[${m.createdAt}]  ${m.role.toUpperCase()}${m.source ? ` (${m.source.kind})` : ''}`);
        lines.push(m.content);
        lines.push('');
      }
    }

    return {
      body: lines.join('\n'),
      contentType: 'text/plain; charset=utf-8',
      filename: `session-${snapshot.meta.id}.txt`,
    };
  }
}
