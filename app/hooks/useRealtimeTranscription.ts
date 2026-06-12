"use client";

import { useRef, useCallback } from "react";
import { useRecording, type UseRecordingReturn } from "@soniox/react";

export interface TranscriptionToken {
  speaker: string;
  text: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  english: "en",
  urdu: "ur",
  arabic: "ar",
  spanish: "es",
  turkish: "tr",
  swahili: "sw",
  punjabi: "pa",
  malay: "ms",
};

function mapLanguageHints(language?: string): string[] {
  if (!language) return ["en"];

  const parts = language.split("+").map((p) => p.trim().toLowerCase());
  const codes = parts
    .map((part) => LANGUAGE_MAP[part])
    .filter((code): code is string => !!code);

  return codes.length > 0 ? codes : ["en"];
}

export function useSonioxTranscription(
  language?: string,
  clientReferenceId?: string,
) {
  const transcriptionFailedRef = useRef(false);

  const recording: UseRecordingReturn = useRecording({
    model: "stt-rt-v4",
    language_hints: mapLanguageHints(language),
    enable_speaker_diarization: true,
    enable_endpoint_detection: true,
    groupBy: "speaker",
    // Tags this WebSocket request in Soniox's usage logs so cost/token usage can
    // be reconciled back to the session/encounter that produced it.
    ...(clientReferenceId ? { client_reference_id: clientReferenceId } : {}),
    onError: (error) => {
      console.error("[Soniox] Transcription error:", error);
      transcriptionFailedRef.current = true;
    },
    onConnected: () => {
      console.log("[Soniox] WebSocket connected, streaming audio");
    },
    onStateChange: (update) => {
      console.log(`[Soniox] State: ${update.old_state} → ${update.new_state}`);
    },
  });

  const getTranscription = useCallback((): TranscriptionToken[] => {
    const result: TranscriptionToken[] = [];

    for (const seg of recording.segments) {
      const speaker = seg.speaker ?? "S1";
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
  }, [recording.segments]);

  const getTranscriptionStatus = useCallback((): "Success" | "Failed" => {
    if (transcriptionFailedRef.current) return "Failed";
    if (recording.error) return "Failed";
    return "Success";
  }, [recording.error]);

  return {
    start: recording.start,
    stop: recording.stop,
    pause: recording.pause,
    resume: recording.resume,
    cancel: recording.cancel,
    finalize: recording.finalize,

    state: recording.state,
    isActive: recording.isActive,
    isRecording: recording.isRecording,
    isPaused: recording.isPaused,
    isSupported: recording.isSupported,
    unsupportedReason: recording.unsupportedReason,
    error: recording.error,

    text: recording.text,
    segments: recording.segments,
    groups: recording.groups,
    finalTokens: recording.finalTokens,
    partialTokens: recording.partialTokens,

    getTranscription,
    getTranscriptionStatus,
    transcriptionFailed: transcriptionFailedRef.current,
  };
}
