/**
 * Single responsibility: own the microphone + MediaRecorder lifecycle and
 * emit one audio Blob per fixed-length chunk window (default 30s).
 *
 * This service does NOT know about HTTP, sessions, or transcripts.
 * It just gives you chunks; the caller decides what to do with them.
 *
 * Chunking strategy:
 *   Each window uses a brand-new MediaRecorder built on top of the same
 *   persistent MediaStream. At the 30s boundary (or on manual flush / stop)
 *   we `recorder.stop()` — that guarantees the browser emits a COMPLETE
 *   self-contained WebM file (with header) for that window — then we
 *   immediately start a fresh recorder for the next window.
 *
 *   This replaces the older "single recorder with 1s timeslice + concat
 *   blobs" approach, which only produced a valid WebM for the FIRST chunk
 *   (because only the first slice carried the WebM header).
 */

export interface RecorderChunk {
  blob: Blob;
  mimeType: string;
  sequence: number;
  startedAt: string;
  endedAt: string;
}

export type RecorderState = 'idle' | 'recording' | 'stopping';

export interface AudioRecorderOptions {
  /** Length of each emitted chunk in seconds. */
  chunkSeconds: number;
  /** Called every time a chunk is finalized. */
  onChunk: (chunk: RecorderChunk) => void;
  /** Optional error sink. */
  onError?: (err: Error) => void;
}

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
];

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  for (const t of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export class AudioRecorderService {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private sequence = 0;
  private rotateTimer: ReturnType<typeof setInterval> | null = null;
  private mimeType = '';
  private _state: RecorderState = 'idle';

  constructor(private readonly options: AudioRecorderOptions) {}

  get state(): RecorderState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state !== 'idle') return;

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported in this browser');
    }
    this.mimeType = pickSupportedMimeType();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.sequence = 0;
    this._state = 'recording';
    this.startWindow();

    this.rotateTimer = setInterval(
      () => this.rotateWindow(),
      this.options.chunkSeconds * 1000,
    );
  }

  /**
   * Force-flush whatever audio has accumulated into the current window as
   * a chunk *now*, then start a fresh window. Use this for "manual refresh".
   */
  flushNow(): void {
    if (this._state !== 'recording') return;
    this.rotateWindow();
  }

  /**
   * Apply a new rotate cadence while recording. Takes effect from the next
   * tick — the current in-flight window is NOT truncated, so no chunk is
   * ever cut mid-sentence just because the user changed the setting.
   * No-op when idle or stopping; the next Start already picks up the latest
   * value from options.
   */
  setChunkSeconds(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    if (this.options.chunkSeconds === seconds) return;
    this.options.chunkSeconds = seconds;
    if (this._state !== 'recording') return;
    if (this.rotateTimer) {
      clearInterval(this.rotateTimer);
    }
    this.rotateTimer = setInterval(() => this.rotateWindow(), seconds * 1000);
  }

  async stop(): Promise<void> {
    if (this._state === 'idle') return;
    this._state = 'stopping';
    if (this.rotateTimer) {
      clearInterval(this.rotateTimer);
      this.rotateTimer = null;
    }
    // Stop the active recorder and wait for its `stop` event, which is what
    // finalizes the WebM container and fires onstop → emit the final chunk.
    // Without this await, the stream teardown below can race the browser's
    // final flush and leave the tail chunk malformed.
    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this._state = 'idle';
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /**
   * Create a fresh MediaRecorder for the next window, wired to accumulate its
   * own blobs and emit a complete chunk when it is stopped.
   */
  private startWindow(): void {
    if (!this.stream) return;

    const recorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined,
    );
    const parts: Blob[] = [];
    const windowStartedAt = new Date().toISOString();

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) parts.push(e.data);
    };
    recorder.onerror = (e) => {
      this.options.onError?.(
        new Error(
          (e as unknown as { error?: Error }).error?.message ?? 'recorder error',
        ),
      );
    };
    recorder.onstop = () => {
      this.finalizeWindow(parts, windowStartedAt);
    };

    recorder.start();
    this.recorder = recorder;
  }

  /**
   * End the current window and immediately start a new one. Called on the
   * 30s tick and on manual flushNow().
   */
  private rotateWindow(): void {
    const recorder = this.recorder;
    if (!recorder || recorder.state !== 'recording') return;
    // Stopping the current recorder triggers a final dataavailable + stop,
    // which finalizeWindow() turns into an emitted chunk.
    recorder.stop();
    this.recorder = null;
    // Only start a new window if we are still actively recording (rotateWindow
    // can be called by the timer; stop() clears _state to 'stopping' first).
    if (this._state === 'recording') {
      this.startWindow();
    }
  }

  private finalizeWindow(parts: Blob[], startedAt: string): void {
    if (parts.length === 0) return;
    const blob = new Blob(parts, { type: this.mimeType || 'audio/webm' });
    // Guard only the clearly-bad case. A legitimate tail chunk can be short
    // (e.g. a 15s remainder after a 45s recording), so we only drop blobs
    // that are essentially empty containers Groq would reject anyway.
    if (blob.size < 1024) return;
    const endedAt = new Date().toISOString();
    const sequence = this.sequence++;
    try {
      this.options.onChunk({
        blob,
        mimeType: blob.type,
        sequence,
        startedAt,
        endedAt,
      });
    } catch (err) {
      this.options.onError?.(err as Error);
    }
  }
}
