'use client';

import { useState } from 'react';
import { useRecordingSession } from '@/hooks/useRecordingSession';
import { useSettingsHydration } from '@/hooks/useSettingsHydration';
import { useSessionStore } from '@/stores/SessionStore';
import { useSettingsStore } from '@/stores/SettingsStore';
import { MicButton } from '@/components/MicButton';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { SuggestionPanel } from '@/components/SuggestionPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { ExportButton } from '@/components/ExportButton';
import { SettingsDrawer } from '@/components/SettingsDrawer';

export default function Page() {
  useSettingsHydration();
  const session = useRecordingSession();
  const sessionId = useSessionStore((s) => s.sessionId);
  const settings = useSettingsStore((s) => s.settings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const needsKey = settings !== null && !settings.hasApiKey;

  return (
    <main className="flex flex-col min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <header className="px-6 py-4 flex items-center justify-between border-b border-ink-200 bg-surface/80 backdrop-blur sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-accent-600 grid place-items-center text-white font-bold shadow-card">
            T
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-900">Twinmind Live</div>
            <div className="text-[11px] text-ink-500 -mt-0.5">
              Whisper Large V3 · GPT-OSS 120B · 30s refresh
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sessionId && (
            <span className="text-xs text-ink-500 hidden md:inline mr-1">
              Session <span className="font-mono">{sessionId}</span>
            </span>
          )}
          <ExportButton sessionId={sessionId} />
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="relative rounded-pill w-10 h-10 grid place-items-center border border-ink-200 bg-white hover:border-accent-500/60 hover:shadow-card transition"
          >
            <GearIcon />
            {needsKey && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-surface" />
            )}
          </button>
        </div>
      </header>

      {session.error && (
        <div className="px-6 py-2 bg-red-50 text-red-700 text-sm border-b border-red-200">
          {session.error}
        </div>
      )}
      {needsKey && (
        <div className="px-6 py-2 bg-amber-50 text-amber-800 text-xs border-b border-amber-200 flex items-center justify-between">
          <span>
            No Groq API key configured. Open <strong>Settings</strong> and paste your key to start
            recording.
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-pill bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1 transition"
          >
            Open settings
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 grid gap-4 p-4 grid-cols-1 lg:grid-cols-3 lg:grid-rows-1">
        <div className="min-h-[60vh] lg:min-h-0 lg:h-full">
          <TranscriptPanel
            chunks={session.transcriptChunks}
            isRecording={session.isRecording}
            headerAction={
              <MicButton
                isRecording={session.isRecording}
                isStarting={session.isStarting}
                isStopping={session.isStopping}
                elapsedSeconds={session.recordingElapsedSec}
                onStart={session.start}
                onStop={session.stop}
              />
            }
          />
        </div>
        <div className="min-h-[60vh] lg:min-h-0 lg:h-full">
          <SuggestionPanel
            batches={session.suggestionBatches}
            isRefreshing={session.isRefreshing}
            onRefresh={session.refresh}
            isRecording={session.isRecording}
          />
        </div>
        <div className="min-h-[60vh] lg:min-h-0 lg:h-full">
          <ChatPanel />
        </div>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink-700"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
