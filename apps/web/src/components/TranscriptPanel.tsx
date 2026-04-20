'use client';

import type { ReactNode } from 'react';
import type { TranscriptChunk } from '@twinmind/shared';
import { useAutoScroll } from '@/hooks/useAutoScroll';

interface Props {
  chunks: TranscriptChunk[];
  isRecording: boolean;
  /**
   * Optional slot rendered on the right side of the panel header. Used by the
   * page to place the mic control next to the transcript it drives — keeps
   * this component UI-only (no session / recording orchestration leaks in).
   */
  headerAction?: ReactNode;
}

export function TranscriptPanel({ chunks, isRecording, headerAction }: Props) {
  const ref = useAutoScroll(chunks.length);

  return (
    <section className="flex flex-col h-full min-h-0 rounded-2xl border border-ink-200 bg-surface dark:bg-ink-900/50 dark:border-ink-700/50 shadow-card overflow-hidden">
      <header className="px-5 py-3 border-b border-ink-200 dark:border-ink-700/50 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase text-ink-700 dark:text-ink-100">
          1. Mic &amp; Transcript
        </h2>
        {headerAction}
      </header>
      <div
        ref={ref}
        className="panel-scroll flex-1 overflow-y-auto p-5 space-y-4 text-sm leading-relaxed"
      >
        {isRecording && (
          <div className="inline-flex items-center gap-2 text-xs text-ink-500">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Listening… transcript updates every ~30s.
          </div>
        )}

        {chunks.length === 0 && !isRecording && (
          <p className="text-ink-500 italic">Click mic to start. Transcript appends every ~30s.</p>
        )}

        {chunks.map((c) => (
          <div key={c.id} className="flex gap-3">
            <span className="text-[11px] text-ink-400 tabular-nums mt-0.5 shrink-0 w-[54px]">
              {formatClock(c.startedAt)}
            </span>
            <p className="text-ink-900 dark:text-ink-100 whitespace-pre-wrap flex-1">
              {c.text || <span className="text-ink-500 italic">(no speech detected)</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString([], { hour12: false });
}
