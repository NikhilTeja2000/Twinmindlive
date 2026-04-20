'use client';

interface Props {
  isRecording: boolean;
  isStarting: boolean;
  isStopping: boolean;
  elapsedSeconds?: number;
  onStart: () => void;
  onStop: () => void;
}

export function MicButton({
  isRecording,
  isStarting,
  isStopping,
  elapsedSeconds = 0,
  onStart,
  onStop,
}: Props) {
  if (isRecording) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="rounded-pill border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-red-700">
          {formatElapsed(elapsedSeconds)}
        </span>
        <button
          onClick={onStop}
          disabled={isStopping}
          className="inline-flex items-center gap-2 rounded-pill bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm font-medium shadow-card transition disabled:opacity-50"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
          {isStopping ? 'Stopping…' : 'Stop recording'}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onStart}
      disabled={isStarting}
      className="inline-flex items-center gap-2 rounded-pill bg-accent-600 hover:bg-accent-500 text-white px-4 py-2 text-sm font-medium shadow-card transition disabled:opacity-50"
    >
      <MicIcon />
      {isStarting ? 'Starting…' : 'Start recording'}
    </button>
  );
}

function formatElapsed(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
