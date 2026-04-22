'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type {
  ApiKeyCheckResult,
  ModelAccess,
  ReasoningEffort,
  SettingsUpdate,
} from '@twinmind/shared';
import { useSettingsStore } from '@/stores/SettingsStore';
import { useSaveSettings } from '@/hooks/useSaveSettings';
import { useCheckApiKey } from '@/hooks/useCheckApiKey';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Single responsibility: render the settings form and delegate saving to
 * useSaveSettings. Exposes the fields the assignment requires the user to be
 * able to edit: Groq API key, live-suggestion / chat / expand prompts,
 * context windows, and model + reasoning tuning.
 *
 * Persistence lives in useSettingsStore; the Groq key itself is never echoed
 * back — we only ever see `hasApiKey: boolean`.
 */
export function SettingsDrawer({ open, onClose }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const error = useSettingsStore((s) => s.error);
  const check = useSettingsStore((s) => s.check);
  const setCheck = useSettingsStore((s) => s.setCheck);
  const { save, isSaving } = useSaveSettings();
  const { run: runCheck, isChecking } = useCheckApiKey();

  const [apiKey, setApiKey] = useState('');
  const [draft, setDraft] = useState<SettingsUpdate>({});

  useEffect(() => {
    if (!open) {
      setApiKey('');
      setDraft({});
      setCheck(null);
    }
  }, [open, setCheck]);

  if (!settings) {
    return open ? (
      <Overlay onClose={onClose}>
        <div className="p-6 text-sm text-ink-500">Loading settings…</div>
      </Overlay>
    ) : null;
  }

  const trimmedKey = apiKey.trim();
  const hasKeyInDraft = trimmedKey.length > 0;
  const hasOtherDraft = hasDirtyFields(draft);
  const isDirty = hasKeyInDraft || hasOtherDraft;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isDirty) {
      if (settings?.hasApiKey) void runCheck();
      return;
    }
    const patch: SettingsUpdate = { ...draft };
    if (hasKeyInDraft) patch.apiKey = trimmedKey;
    const ok = await save(patch);
    if (ok) {
      setApiKey('');
      setDraft({});
      if (hasKeyInDraft) void runCheck();
    }
  }

  const submitLabel = isSaving
    ? 'Saving…'
    : isChecking
      ? 'Checking…'
      : hasKeyInDraft
        ? 'Save & validate'
        : hasOtherDraft
          ? 'Save'
          : settings.hasApiKey
            ? 'Validate access'
            : 'Save';

  const submitDisabled =
    isSaving || isChecking || (!isDirty && !settings.hasApiKey);

  return (
    <Overlay open={open} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col h-full">
        <header className="px-5 py-4 border-b border-ink-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Settings</h2>
            <p className="text-xs text-ink-500 mt-0.5">
              Runtime configuration. API key is kept in this browser session only.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:text-ink-900 rounded-pill w-8 h-8 grid place-items-center hover:bg-ink-100"
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto panel-scroll px-5 py-5 space-y-7">
          <Section
            title="Groq API key"
            subtitle="Never returned by the server on GET. Used for transcription, suggestions, and chat."
          >
            <div className="text-[11px] text-ink-500 inline-flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  settings.hasApiKey ? 'bg-green-500' : 'bg-amber-500'
                }`}
              />
              {settings.hasApiKey ? 'A key is currently configured.' : 'No key configured yet.'}
            </div>
            {settings.hasApiKey && settings.apiKeyPreview && (
              <div className="inline-flex items-center gap-2 rounded-pill bg-ink-100 px-3 py-1 text-[11px] font-mono text-ink-700">
                <span className="text-ink-400 uppercase tracking-wider text-[9px]">Current</span>
                {settings.apiKeyPreview}
              </div>
            )}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.hasApiKey ? 'Leave blank to keep current key' : 'gsk_…'}
              className="w-full rounded-pill border border-ink-200 bg-white px-4 py-2 text-sm focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
              autoComplete="off"
            />
            <p className="text-[11px] text-ink-400 leading-relaxed">
              Get a key at{' '}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-accent-600 hover:underline"
              >
                console.groq.com/keys
              </a>
              .
            </p>
          </Section>

          <AccessReport
            check={check}
            isChecking={isChecking}
            onCheck={() => void runCheck()}
            hasApiKey={settings.hasApiKey}
          />

          <Section
            title="Prompts"
            subtitle="Edit the system / user prompts used for suggestions, chat, and expand."
          >
            <PromptField
              label="Suggestion system prompt"
              initial={settings.prompts.suggestionSystem}
              onChange={(v) =>
                setDraft((d) => ({ ...d, prompts: { ...d.prompts, suggestionSystem: v } }))
              }
            />
            <PromptField
              label="Suggestion user prompt"
              initial={settings.prompts.suggestionUser}
              onChange={(v) =>
                setDraft((d) => ({ ...d, prompts: { ...d.prompts, suggestionUser: v } }))
              }
            />
            <PromptField
              label="Chat system prompt"
              initial={settings.prompts.chatSystem}
              onChange={(v) =>
                setDraft((d) => ({ ...d, prompts: { ...d.prompts, chatSystem: v } }))
              }
            />
            <PromptField
              label="Expand (clicked suggestion) prompt"
              initial={settings.prompts.expandSystem}
              onChange={(v) =>
                setDraft((d) => ({ ...d, prompts: { ...d.prompts, expandSystem: v } }))
              }
            />
          </Section>

          <Section
            title="Context window"
            subtitle="How much recent context is fed to the LLM."
          >
            <Row>
              <NumberField
                label="Transcript chunks"
                hint="1–200"
                min={1}
                max={200}
                initial={settings.context.transcriptContextChunks}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    context: { ...d.context, transcriptContextChunks: v },
                  }))
                }
              />
              <NumberField
                label="Chat turns"
                hint="0–100"
                min={0}
                max={100}
                initial={settings.context.chatContextTurns}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, context: { ...d.context, chatContextTurns: v } }))
                }
              />
              <NumberField
                label="Chunk seconds"
                hint="5–120"
                min={5}
                max={120}
                initial={settings.context.chunkSeconds}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, context: { ...d.context, chunkSeconds: v } }))
                }
              />
            </Row>
          </Section>

          <Section title="Models & reasoning" subtitle="Groq model IDs and latency knobs.">
            <Row>
              <TextField
                label="Suggestion model"
                initial={settings.llm.suggestionModel}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, llm: { ...d.llm, suggestionModel: v } }))
                }
              />
              <TextField
                label="Chat model"
                initial={settings.llm.chatModel}
                onChange={(v) => setDraft((d) => ({ ...d, llm: { ...d.llm, chatModel: v } }))}
              />
              <TextField
                label="Transcription model"
                initial={settings.llm.transcriptionModel}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, llm: { ...d.llm, transcriptionModel: v } }))
                }
              />
            </Row>
            <Row>
              <NumberField
                label="Temperature"
                hint="0–2"
                min={0}
                max={2}
                step={0.1}
                initial={settings.llm.temperature}
                onChange={(v) => setDraft((d) => ({ ...d, llm: { ...d.llm, temperature: v } }))}
              />
              <NumberField
                label="Max tokens"
                hint="64–8000"
                min={64}
                max={8000}
                initial={settings.llm.maxTokens}
                onChange={(v) => setDraft((d) => ({ ...d, llm: { ...d.llm, maxTokens: v } }))}
              />
              <SelectField
                label="Suggestion effort"
                initial={settings.llm.suggestionReasoningEffort}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, llm: { ...d.llm, suggestionReasoningEffort: v } }))
                }
              />
              <SelectField
                label="Chat effort"
                initial={settings.llm.chatReasoningEffort}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, llm: { ...d.llm, chatReasoningEffort: v } }))
                }
              />
            </Row>
          </Section>

          {error && (
            <div className="rounded-xl bg-red-50 text-red-700 text-xs px-3 py-2 border border-red-200">
              {error}
            </div>
          )}
        </div>

        <footer className="px-5 py-3.5 border-t border-ink-200 bg-surface-muted flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill px-4 py-2 text-sm border border-ink-200 bg-white hover:border-accent-500/60 transition"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={submitDisabled}
            className="rounded-pill px-5 py-2 text-sm font-medium bg-accent-600 hover:bg-accent-500 text-white shadow-card disabled:opacity-50 transition"
          >
            {submitLabel}
          </button>
        </footer>
      </form>
    </Overlay>
  );
}

function hasDirtyFields(draft: SettingsUpdate): boolean {
  if (!draft) return false;
  const hasContent = (obj: Record<string, unknown> | undefined) =>
    !!obj && Object.values(obj).some((v) => v !== undefined);
  return hasContent(draft.prompts) || hasContent(draft.context) || hasContent(draft.llm);
}

function AccessReport({
  check,
  isChecking,
  onCheck,
  hasApiKey,
}: {
  check: ApiKeyCheckResult | null;
  isChecking: boolean;
  onCheck: () => void;
  hasApiKey: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">Model access</h3>
        <button
          type="button"
          onClick={onCheck}
          disabled={!hasApiKey || isChecking}
          className="text-[11px] font-medium text-accent-600 hover:text-accent-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isChecking ? 'Checking…' : 'Check now'}
        </button>
      </div>
      <p className="text-xs text-ink-500">
        Verifies the current key can reach the three models this app uses.
      </p>

      {!hasApiKey && !isChecking && !check && (
        <div className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs text-ink-500">
          Save a key above, then validation runs automatically.
        </div>
      )}

      {isChecking && (
        <div className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs text-ink-500 inline-flex items-center gap-2">
          <Spinner /> Contacting Groq…
        </div>
      )}

      {check && !isChecking && <ReportCard check={check} />}
    </section>
  );
}

function ReportCard({ check }: { check: ApiKeyCheckResult }) {
  const banner = check.ok
    ? {
        tone: 'bg-green-50 border-green-200 text-green-700',
        label: 'All required models available.',
      }
    : check.error
      ? { tone: 'bg-red-50 border-red-200 text-red-700', label: check.error }
      : {
          tone: 'bg-amber-50 border-amber-200 text-amber-700',
          label: 'Some required models are not reachable with this key.',
        };

  return (
    <div className="space-y-2">
      <div className={`rounded-xl border px-3 py-2 text-xs ${banner.tone}`}>{banner.label}</div>
      <ul className="rounded-xl border border-ink-200 bg-white divide-y divide-ink-100">
        {check.required.map((m) => (
          <ModelRow key={m.role} access={m} />
        ))}
      </ul>
      {check.totalModels !== undefined && (
        <p className="text-[11px] text-ink-400">
          Checked against {check.totalModels} models visible to this key ·{' '}
          {formatTime(check.checkedAt)}
        </p>
      )}
    </div>
  );
}

function ModelRow({ access }: { access: ModelAccess }) {
  const label =
    access.role === 'transcription'
      ? 'Transcription'
      : access.role === 'suggestion'
        ? 'Suggestions'
        : 'Chat & expand';

  return (
    <li className="flex items-center justify-between px-3 py-2 text-xs">
      <div className="flex flex-col">
        <span className="font-medium text-ink-900">{label}</span>
        <span className="text-[11px] text-ink-500 font-mono">{access.id}</span>
      </div>
      <StatusPill ok={access.available} />
    </li>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
        ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {ok ? 'OK' : 'NO ACCESS'}
    </span>
  );
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" className="animate-spin">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour12: false });
}

function Overlay({
  open = true,
  onClose,
  children,
}: {
  open?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside className="ml-auto relative z-10 w-full max-w-xl h-full bg-surface shadow-card-hover border-l border-ink-200 flex flex-col">
        {children}
      </aside>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function PromptField({
  label,
  initial,
  onChange,
}: {
  label: string;
  initial: string;
  onChange: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</span>
      <textarea
        value={value}
        rows={5}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        className="mt-1 w-full rounded-xl border border-ink-200 bg-white p-3 text-xs font-mono leading-relaxed focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
      />
    </label>
  );
}

function TextField({
  label,
  initial,
  onChange,
}: {
  label: string;
  initial: string;
  onChange: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        className="mt-1 w-full rounded-pill border border-ink-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
      />
    </label>
  );
}

function NumberField({
  label,
  hint,
  min,
  max,
  step = 1,
  initial,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step?: number;
  initial: number;
  onChange: (v: number) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
        {label} <span className="text-ink-300 normal-case">· {hint}</span>
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          setValue(n);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="mt-1 w-full rounded-pill border border-ink-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
      />
    </label>
  );
}

function SelectField({
  label,
  initial,
  onChange,
}: {
  label: string;
  initial: ReasoningEffort;
  onChange: (v: ReasoningEffort) => void;
}) {
  const [value, setValue] = useState<ReasoningEffort>(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const v = e.target.value as ReasoningEffort;
          setValue(v);
          onChange(v);
        }}
        className="mt-1 w-full rounded-pill border border-ink-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
      >
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>
    </label>
  );
}
