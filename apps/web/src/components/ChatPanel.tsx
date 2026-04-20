'use client';

import { useState, type FormEvent } from 'react';
import type { ChatMessage, SuggestionKind } from '@twinmind/shared';
import { useChatStore } from '@/stores/ChatStore';
import { useSessionStore } from '@/stores/SessionStore';
import { useSuggestionStore } from '@/stores/SuggestionStore';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useSendChatMessage } from '@/hooks/useSendChatMessage';
import { KindPill } from './SuggestionCard';
import { MarkdownMessage } from './MarkdownMessage';

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const isSending = useChatStore((s) => s.isSending);
  const sessionId = useSessionStore((s) => s.sessionId);
  const batches = useSuggestionStore((s) => s.batches);
  const { send } = useSendChatMessage();

  const [draft, setDraft] = useState('');
  const ref = useAutoScroll(messages.length);

  const kindOf = (m: ChatMessage): SuggestionKind | null => {
    if (m.role !== 'user' || m.source?.kind !== 'suggestion' || !m.source.suggestionId) return null;
    for (const b of batches) {
      const s = b.suggestions.find((x) => x.id === m.source!.suggestionId);
      // Normalise undefined → null so the `{kind && …}` guard below works.
      if (s) return s.kind ?? null;
    }
    return null;
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft('');
    await send(text);
  }

  return (
    <section className="flex flex-col h-full min-h-0 rounded-2xl border border-ink-200 bg-surface dark:bg-ink-900/50 dark:border-ink-700/50 shadow-card overflow-hidden">
      <header className="px-5 py-3.5 border-b border-ink-200 dark:border-ink-700/50 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold tracking-wide uppercase text-ink-700 dark:text-ink-100">
          3. Chat <span className="text-ink-500 font-normal normal-case">(detailed answers)</span>
        </h2>
        <span className="text-[10px] font-medium tracking-wider px-2 py-0.5 rounded-pill bg-ink-100 text-ink-500 dark:bg-ink-700/40 dark:text-ink-300">
          SESSION-ONLY
        </span>
      </header>
      <div ref={ref} className="panel-scroll flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-ink-500 italic leading-relaxed">
            Click a suggestion or type a question — answers are grounded in the live transcript and
            flow as one continuous session.
          </p>
        ) : (
          messages.map((m) => {
            const kind = kindOf(m);
            return (
              <div key={m.id} className="space-y-1">
                <div
                  className={`flex items-center gap-2 text-[10px] font-semibold tracking-wider uppercase ${
                    m.role === 'user' ? 'text-accent-600 justify-end' : 'text-ink-500'
                  }`}
                >
                  <span>{m.role === 'user' ? 'You' : 'Assistant'}</span>
                  {kind && (
                    <>
                      <span className="text-ink-300 font-normal">·</span>
                      <KindPill kind={kind} />
                    </>
                  )}
                </div>
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'ml-auto bg-accent-600 text-white shadow-card whitespace-pre-wrap'
                      : 'mr-auto bg-ink-100 dark:bg-ink-700/40 text-ink-900 dark:text-ink-100'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <MarkdownMessage content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            );
          })
        )}
        {isSending && (
          <div className="space-y-1">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-ink-500">
              Assistant
            </div>
            <div className="mr-auto rounded-2xl px-4 py-2.5 text-sm bg-ink-100 dark:bg-ink-700/40 text-ink-500 inline-flex items-center gap-2">
              <TypingDots />
              Thinking…
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={onSubmit}
        className="border-t border-ink-200 dark:border-ink-700/50 p-3 flex gap-2 bg-surface-muted dark:bg-ink-900/40"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!sessionId || isSending}
          placeholder={sessionId ? 'Ask anything…' : 'Start recording to enable chat'}
          className="flex-1 rounded-pill bg-white dark:bg-ink-900/70 border border-ink-200 dark:border-ink-700 px-4 py-2 text-sm focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition"
        />
        <button
          type="submit"
          disabled={!sessionId || isSending || draft.trim().length === 0}
          className="rounded-pill bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium px-5 py-2 shadow-card disabled:opacity-50 transition"
        >
          Send
        </button>
      </form>
    </section>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-ink-500 animate-bounce" />
    </span>
  );
}
