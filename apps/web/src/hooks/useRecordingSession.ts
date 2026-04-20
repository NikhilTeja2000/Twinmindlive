'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/ApiClient';
import { AudioRecorderService, type RecorderChunk } from '@/services/AudioRecorderService';
import { useSessionStore } from '@/stores/SessionStore';
import { useSettingsStore } from '@/stores/SettingsStore';
import { useTranscriptStore } from '@/stores/TranscriptStore';
import { useSuggestionStore } from '@/stores/SuggestionStore';

const DEFAULT_CHUNK_SECONDS = Number(process.env.NEXT_PUBLIC_CHUNK_SECONDS ?? '30');

/**
 * Single responsibility hook: own the recording lifecycle for the page.
 * Wires AudioRecorderService → ApiClient → stores.
 */
export function useRecordingSession() {
  const recorderRef = useRef<AudioRecorderService | null>(null);
  const inflightRef = useRef<Promise<unknown>>(Promise.resolve());
  const recordingStartedAtRef = useRef<number | null>(null);

  const session = useSessionStore();
  const settings = useSettingsStore((s) => s.settings);
  const transcript = useTranscriptStore();
  const suggestions = useSuggestionStore();
  const chunkSeconds = settings?.context.chunkSeconds ?? DEFAULT_CHUNK_SECONDS;
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);

  const handleChunk = useCallback(
    (chunk: RecorderChunk) => {
      const sessionId = useSessionStore.getState().sessionId;
      if (!sessionId) return;
      // Serialize uploads so chunks always append in order, even under slow networks.
      inflightRef.current = inflightRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            useSuggestionStore.getState().setRefreshing(true);
            const res = await apiClient.uploadChunk({
              sessionId,
              blob: chunk.blob,
              sequenceNumber: chunk.sequence,
              startedAt: chunk.startedAt,
              endedAt: chunk.endedAt,
            });
            useTranscriptStore.getState().appendChunk(res.transcriptChunk);
            useSuggestionStore.getState().prependBatch(res.suggestionBatch);
          } catch (err) {
            useSessionStore.getState().setError((err as Error).message);
          } finally {
            useSuggestionStore.getState().setRefreshing(false);
          }
        });
    },
    [],
  );

  const start = useCallback(async () => {
    // Gate on the recorder presence, NOT on sessionId. A sessionId can exist
    // after Stop (we keep it so chat/expand still work — one continuous
    // session per browser visit). A fresh Start just means "resume recording".
    if (session.isStarting || recorderRef.current) return;
    useSessionStore.getState().setStarting(true);
    useSessionStore.getState().setError(null);
    try {
      let sid = useSessionStore.getState().sessionId;
      if (!sid) {
        // First Start of this browser visit — create the backend session.
        const { sessionId: newId, meta } = await apiClient.startSession();
        useSessionStore
          .getState()
          .setSession(newId, meta.startedAt ?? new Date().toISOString());
        sid = newId;
      }
      // Otherwise reuse the existing session: chunks keep appending to the
      // same transcript, chat/expand keep working across Stop → Start.

      const rec = new AudioRecorderService({
        // Runtime settings win once hydrated; until then we preserve the
        // previous env-based default behavior so first paint still works.
        chunkSeconds,
        onChunk: handleChunk,
        onError: (e) => useSessionStore.getState().setError(e.message),
      });
      recorderRef.current = rec;
      await rec.start();
      recordingStartedAtRef.current = Date.now();
      setRecordingElapsedSec(0);
      useSessionStore.getState().setRecording(true);
    } catch (err) {
      useSessionStore.getState().setError((err as Error).message);
    } finally {
      useSessionStore.getState().setStarting(false);
    }
  }, [session.isStarting, chunkSeconds, handleChunk]);

  const stop = useCallback(async () => {
    const sid = useSessionStore.getState().sessionId;
    if (!sid || !recorderRef.current) return;
    useSessionStore.getState().setStopping(true);
    try {
      await recorderRef.current?.stop();
      recorderRef.current = null;
      recordingStartedAtRef.current = null;
      setRecordingElapsedSec(0);
      useSessionStore.getState().setRecording(false);
      // Wait for any in-flight chunk to finish so the export is complete.
      await inflightRef.current.catch(() => undefined);
      // Stamp stoppedAt on the backend, but keep the session alive so the
      // user can still chat / expand / export against it. Page refresh is
      // the only hard reset boundary.
      await apiClient.stopSession(sid).catch(() => undefined);
    } finally {
      useSessionStore.getState().setStopping(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const sid = useSessionStore.getState().sessionId;
    if (!sid) return;
    // Ask the recorder to flush whatever it has now → that triggers a normal
    // upload-chunk flow which transcribes *and* re-suggests in one go.
    if (recorderRef.current) {
      recorderRef.current.flushNow();
      return;
    }
    // Fallback: no active recorder, so just re-suggest from existing transcript.
    try {
      useSuggestionStore.getState().setRefreshing(true);
      const res = await apiClient.refresh(sid);
      useSuggestionStore.getState().prependBatch(res.suggestionBatch);
    } catch (err) {
      useSessionStore.getState().setError((err as Error).message);
    } finally {
      useSuggestionStore.getState().setRefreshing(false);
    }
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    if (!session.isRecording) return;
    const id = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current;
      if (!startedAt) return;
      setRecordingElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [session.isRecording]);

  // Push live chunkSeconds changes into an already-running recorder so the
  // setting is reactive without requiring Stop → Start.
  useEffect(() => {
    recorderRef.current?.setChunkSeconds(chunkSeconds);
  }, [chunkSeconds]);

  useEffect(() => {
    return () => {
      void recorderRef.current?.stop();
    };
  }, []);

  return {
    isRecording: session.isRecording,
    isStarting: session.isStarting,
    isStopping: session.isStopping,
    isRefreshing: suggestions.isRefreshing,
    error: session.error,
    recordingElapsedSec,
    transcriptChunks: transcript.chunks,
    suggestionBatches: suggestions.batches,
    start,
    stop,
    refresh,
  };
}
