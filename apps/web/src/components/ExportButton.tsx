'use client';

import { useState } from 'react';
import { exportBuilder } from '@/services/ExportBuilder';

interface Props {
  sessionId: string | null;
}

export function ExportButton({ sessionId }: Props) {
  const [open, setOpen] = useState(false);

  if (!sessionId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm rounded-pill px-4 py-2 border border-ink-200 bg-white hover:border-accent-500/60 hover:shadow-card dark:bg-ink-900/40 dark:border-ink-700/60 transition"
      >
        Export
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-40 rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 shadow-card-hover py-1 z-10"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-ink-100 dark:hover:bg-ink-700/40"
            onClick={() => {
              exportBuilder.download(sessionId, 'json');
              setOpen(false);
            }}
          >
            Download JSON
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-ink-100 dark:hover:bg-ink-700/40"
            onClick={() => {
              exportBuilder.download(sessionId, 'txt');
              setOpen(false);
            }}
          >
            Download TXT
          </button>
        </div>
      )}
    </div>
  );
}
