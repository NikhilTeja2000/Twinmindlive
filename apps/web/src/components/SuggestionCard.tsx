'use client';

import { useState, type KeyboardEvent } from 'react';
import type { Suggestion, SuggestionKind } from '@twinmind/shared';

interface Props {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
  disabled?: boolean;
}

// ~140 chars is roughly where `line-clamp-3` at 12px starts chopping words.
// Below this we never truncate, so the toggle would just be noise.
const LONG_BODY_CHARS = 140;

export function SuggestionCard({ suggestion, onClick, disabled }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = suggestion.body.length > LONG_BODY_CHARS;

  const activate = () => {
    if (disabled) return;
    onClick(suggestion);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={activate}
      onKeyDown={onKey}
      className={`text-left w-full rounded-xl border border-ink-200 bg-white hover:border-accent-500/60 hover:shadow-card-hover dark:bg-ink-900/60 dark:border-ink-700/60 focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition px-4 py-3 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <KindPill kind={suggestion.kind} />
      <div className="text-sm font-semibold text-ink-900 dark:text-ink-100 mt-2">
        {suggestion.title}
      </div>
      <p
        className={`text-xs text-ink-500 mt-1 leading-snug ${
          isLong && !expanded ? 'line-clamp-3' : ''
        }`}
      >
        {suggestion.body}
      </p>
      {isLong && (
        <button
          type="button"
          // Stop propagation so toggling the body doesn't fire the card's
          // "open in chat" action. This is the whole reason we moved the
          // outer element from <button> to role=button.
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1.5 text-[11px] font-medium text-accent-600 hover:text-accent-700 focus:outline-none focus:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export function KindPill({ kind }: { kind: SuggestionKind | undefined | null }) {
  // Defensive lookup: older in-memory state (pre-schema-change) or a malformed
  // entry must NEVER crash the render tree — fall back to a neutral pill.
  const style = (kind && KIND_STYLE[kind]) ?? KIND_STYLE_FALLBACK;
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold tracking-wider ${style.tone}`}
    >
      {style.label}
    </span>
  );
}

const KIND_STYLE: Record<SuggestionKind, { tone: string; label: string }> = {
  QUESTION: { tone: 'bg-sky-100 text-sky-700', label: 'QUESTION' },
  INSIGHT: { tone: 'bg-amber-100 text-amber-700', label: 'INSIGHT' },
  RISK: { tone: 'bg-red-100 text-red-700', label: 'RISK' },
  CLARIFY: { tone: 'bg-cyan-100 text-cyan-700', label: 'CLARIFY' },
  ACTION: { tone: 'bg-green-100 text-green-700', label: 'ACTION' },
  FACT_CHECK: { tone: 'bg-purple-100 text-purple-700', label: 'FACT-CHECK' },
};

const KIND_STYLE_FALLBACK = { tone: 'bg-ink-100 text-ink-600', label: 'SUGGESTION' };
