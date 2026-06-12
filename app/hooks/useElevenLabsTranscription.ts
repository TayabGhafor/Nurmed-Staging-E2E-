"use client";

import { useRef, useCallback, useState, useMemo } from "react";
import { useScribe } from "@elevenlabs/react";
import type { TranscriptionToken } from "./useRealtimeTranscription";

type SonioxCompatibleState =
  | "idle"
  | "starting"
  | "connecting"
  | "recording"
  | "paused"
  | "stopping"
  | "stopped"
  | "error"
  | "canceled";

interface ElevenLabsSegment {
  speaker: string;
  text: string;
}

interface ElevenLabsPartialToken {
  text: string;
  speaker: string;
}

async function fetchScribeToken(): Promise<string> {
  const res = await fetch("/api/elevenlabs-token", { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch ElevenLabs token");
  }
  const data = await res.json();
  return data.token;
}

export function useElevenLabsTranscription(language?: string) {
  const [isPausedState, setIsPausedState] = useState(false);
  const [internalState, setInternalState] =
    useState<SonioxCompatibleState>("idle");
  const transcriptionFailedRef = useRef(false);
  const committedSegmentsRef = useRef<ElevenLabsSegment[]>([]);
  const [segments, setSegments] = useState<ElevenLabsSegment[]>([]);
  const hasConnectedRef = useRef(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    languageCode: "am",
    onConnect: () => {
      console.log("[ElevenLabs] WebSocket connected");
      hasConnectedRef.current = true;
      setInternalState("recording");
    },
    onDisconnect: () => {
      console.log("[ElevenLabs] WebSocket disconnected");
      if (internalState !== "canceled" && internalState !== "stopped") {
        setInternalState("stopped");
      }
    },
    onCommittedTranscript: (data) => {
      const text = data.text?.trim();
      if (!text) return;

      const newSegment: ElevenLabsSegment = { speaker: "S1", text };
      committedSegmentsRef.current = [
        ...committedSegmentsRef.current,
        newSegment,
      ];
      setSegments([...committedSegmentsRef.current]);
    },
    onError: (error) => {
      console.error("[ElevenLabs] Transcription error:", error);
      transcriptionFailedRef.current = true;
      setInternalState("error");
    },
    onSessionStarted: () => {
      console.log("[ElevenLabs] Session started, streaming audio");
    },
  });

  const state: SonioxCompatibleState = useMemo(() => {
    if (internalState === "canceled" || internalState === "stopped") {
      return internalState;
    }
    if (isPausedState && hasConnectedRef.current) return "paused";
    if (scribe.error) return "error";

    switch (scribe.status) {
      case "connecting":
        return "connecting";
      case "connected":
      case "transcribing":
        return "recording";
      case "disconnected":
        return hasConnectedRef.current ? internalState : "idle";
      default:
        return internalState;
    }
  }, [scribe.status, scribe.error, isPausedState, internalState]);

  const isRecording =
    state === "recording" || state === "paused" || state === "connecting";

  const partialTokens: ElevenLabsPartialToken[] = useMemo(() => {
    if (!scribe.partialTranscript) return [];
    return [{ text: scribe.partialTranscript, speaker: "S1" }];
  }, [scribe.partialTranscript]);

  const start = useCallback(async () => {
    try {
      setInternalState("connecting");
      transcriptionFailedRef.current = false;
      committedSegmentsRef.current = [];
      setSegments([]);
      setIsPausedState(false);
      hasConnectedRef.current = false;

      const token = await fetchScribeToken();

      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      console.error("[ElevenLabs] Failed to start:", e);
      transcriptionFailedRef.current = true;
      setInternalState("error");
    }
  }, [scribe]);

  const stop = useCallback(async () => {
    try {
      setInternalState("stopped");
      scribe.disconnect();
    } catch (e) {
      console.error("[ElevenLabs] Failed to stop:", e);
    }
  }, [scribe]);

  const pause = useCallback(() => {
    setIsPausedState(true);
    const connection = scribe.getConnection();
    if (connection) {
      try {
        (connection as any)._audioCleanup?.();
      } catch {}
    }
  }, [scribe]);

  const resume = useCallback(async () => {
    setIsPausedState(false);
    if (!scribe.isConnected) {
      try {
        setInternalState("connecting");
        const token = await fetchScribeToken();
        await scribe.connect({
          token,
          microphone: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (e) {
        console.error("[ElevenLabs] Failed to resume:", e);
      }
    }
  }, [scribe]);

  const cancel = useCallback(() => {
    setInternalState("canceled");
    try {
      scribe.disconnect();
      scribe.clearTranscripts();
    } catch {}
    committedSegmentsRef.current = [];
    setSegments([]);
  }, [scribe]);

  const getTranscription = useCallback((): TranscriptionToken[] => {
    const result: TranscriptionToken[] = [];

    for (const seg of committedSegmentsRef.current) {
      const speaker = seg.speaker;
      const text = seg.text.trim();
      if (!text) continue;

      const last = result[result.length - 1];
      if (last && last.speaker === speaker) {
        last.text += " " + text;
      } else {
        result.push({ speaker, text });
      }
    }

    return result;
  }, []);

  const getTranscriptionStatus = useCallback((): "Success" | "Failed" => {
    if (transcriptionFailedRef.current) return "Failed";
    if (scribe.error) return "Failed";
    return "Success";
  }, [scribe.error]);

  const error = scribe.error || null;

  return {
    start,
    stop,
    pause,
    resume,
    cancel,

    state,
    isActive: scribe.isConnected || isPausedState,
    isRecording,
    isPaused: isPausedState,
    isSupported: true as boolean | null,
    unsupportedReason: null as string | null,
    error,

    text: scribe.committedTranscripts.map((t) => t.text).join(" "),
    segments,
    groups: [],
    finalTokens: [],
    partialTokens,

    getTranscription,
    getTranscriptionStatus,
    transcriptionFailed: transcriptionFailedRef.current,
  };
}
