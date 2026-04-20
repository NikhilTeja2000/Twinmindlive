'use client';

import type { SuggestionBatch } from '@twinmind/shared';
import { useExpandSuggestion } from '@/hooks/useExpandSuggestion';
import { SuggestionCard } from './SuggestionCard';

interface Props {
  batches: SuggestionBatch[];
  isRefreshing: boolean;
  onRefresh: () => void;
  isRecording: boolean;
}

export function SuggestionPanel({ batches, isRefreshing, onRefresh, isRecording }: Props) {
  const { expand, isBusy } = useExpandSuggestion();
  const count = batches.length;
  const total = count;

  return (
    <section className="flex flex-col h-full min-h-0 rounded-2xl border border-ink-200 bg-surface dark:bg-ink-900/50 dark:border-ink-700/50 shadow-card overflow-hidden">
      <header className="px-5 py-3.5 border-b border-ink-200 dark:border-ink-700/50 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase text-ink-700 dark:text-ink-100">
          2. Live Suggestions
        </h2>
        <span className="text-[10px] font-medium tracking-wider px-2 py-0.5 rounded-pill bg-ink-100 text-ink-500 dark:bg-ink-700/40 dark:text-ink-300">
          {count} {count === 1 ? 'BATCH' : 'BATCHES'}
        </span>
      </header>
      <div className="px-5 py-3 flex items-center justify-between gap-2 border-b border-ink-200/60 dark:border-ink-700/40">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 px-3 py-1.5 rounded-pill border border-ink-200 bg-white hover:border-accent-500/50 hover:shadow-card dark:bg-ink-900/40 dark:border-ink-700/60 transition disabled:opacity-50"
        >
          <ReloadIcon spinning={isRefreshing} />
          {isRefreshing ? 'Reloading…' : 'Reload suggestions'}
        </button>
        <span className="text-[11px] text-ink-500">
          {isRecording ? 'auto-refresh every ~30s' : 'start mic for auto-refresh'}
        </span>
      </div>
      <div className="panel-scroll flex-1 overflow-y-auto p-5 space-y-3">
        {batches.length === 0 ? (
          <p className="text-sm text-ink-500 italic leading-relaxed">
            Three fresh suggestions appear here every ~30s while you record. Each card is a
            tappable <span className="text-accent-600 font-medium">question</span>,{' '}
            <span className="text-accent-600 font-medium">insight</span>,{' '}
            <span className="text-accent-600 font-medium">risk</span>, or — if the transcript
            contains a concrete claim — a <span className="text-accent-600 font-medium">fact-check</span>.
          </p>
        ) : (
          batches.map((b, idx) => {
            const batchNumber = total - idx;
            return (
              <div key={b.id} className={idx === 0 ? 'space-y-2' : 'space-y-2 opacity-75'}>
                <div className="space-y-2">
                  {b.suggestions.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      onClick={(x) => expand(x, b.id)}
                      disabled={isBusy}
                    />
                  ))}
                </div>
                <BatchSeparator
                  label={`BATCH ${batchNumber} · ${formatClock(b.createdAt)}`}
                  manual={b.reason === 'manual'}
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function BatchSeparator({ label, manual }: { label: string; manual: boolean }) {
  return (
    <div className="flex items-center gap-3 pt-1 pb-2">
      <span className="flex-1 h-px bg-ink-200 dark:bg-ink-700/60" />
      <span className="text-[10px] uppercase tracking-wider text-ink-400 tabular-nums">
        — {label}{manual ? ' · manual' : ''} —
      </span>
      <span className="flex-1 h-px bg-ink-200 dark:bg-ink-700/60" />
    </div>
  );
}

function ReloadIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString([], { hour12: false });
}
