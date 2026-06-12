"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import * as speechSdk from "microsoft-cognitiveservices-speech-sdk";
import type { TranscriptionToken } from "./useRealtimeTranscription";
import { AZURE_PHRASE_LIST } from "./azurePhraseList";

export interface TranscriptionSegment {
  text: string;
  speaker: string;
}

export interface PartialToken {
  text: string;
  speaker: string;
}

type TranscriptionState =
  | "idle"
  | "starting"
  | "connecting"
  | "recording"
  | "paused"
  | "stopped"
  | "canceled"
  | "error";

const LANGUAGE_MAP: Record<string, string> = {
  english: "en-US",
  urdu: "ur-PK",
  arabic: "ar-AE",
  spanish: "es-ES",
  turkish: "tr-TR",
  swahili: "sw-KE",
  punjabi: "pa-IN",
};

function mapLanguages(language?: string): string[] {
  if (!language) return ["en-US"];
  const parts = language.split("+").map((p) => p.trim().toLowerCase());
  const codes = parts
    .map((part) => LANGUAGE_MAP[part])
    .filter((c): c is string => !!c);
  return codes.length > 0 ? codes : ["en-US"];
}

// Azure ConversationTranscriber returns speakerIds like "Guest-1" or "Unknown".
// Soniox used "S1", "S2"; the consumer modal's formatSpeaker handles both,
// but we normalize so downstream comparisons (same-speaker grouping) stay stable.
function normalizeSpeakerId(speakerId: string | undefined | null): string {
  if (!speakerId || speakerId === "Unknown") return "S1";
  const match = speakerId.match(/(\d+)/);
  if (match) return `S${match[1]}`;
  return speakerId;
}

// `_clientReferenceId` is accepted only to mirror useSonioxTranscription's
// signature so both can be swapped behind the shared useTranscription alias.
// Azure (Dubai region) does not use Soniox, so there is no usage log to tag.
export function useAzureTranscription(
  language?: string,
  _clientReferenceId?: string,
) {
  const [state, setState] = useState<TranscriptionState>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [partialTokens, setPartialTokens] = useState<PartialToken[]>([]);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [unsupportedReason, setUnsupportedReason] = useState<string | undefined>();

  const transcriberRef = useRef<speechSdk.ConversationTranscriber | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const transcriptionFailedRef = useRef(false);
  const stateRef = useRef<TranscriptionState>("idle");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setUnsupportedReason("MediaDevices API not available in this browser");
      return;
    }
    const key = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
    const region = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;
    if (!key || !region) {
      setIsSupported(false);
      setUnsupportedReason("Azure Speech credentials missing in env");
    }
  }, []);

  const stopMediaStream = useCallback(() => {
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }
  }, []);

  const closeTranscriber = useCallback(() => {
    const t = transcriberRef.current;
    transcriberRef.current = null;
    if (t) {
      try {
        t.close();
      } catch {}
    }
    stopMediaStream();
  }, [stopMediaStream]);

  const buildTranscriber = useCallback(async (): Promise<speechSdk.ConversationTranscriber> => {
    const key = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
    const region = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;
    if (!key || !region) {
      throw new Error("Azure Speech credentials missing in env");
    }

    const speechConfig = speechSdk.SpeechConfig.fromSubscription(key, region);
    // Dictation LM produces better punctuation + longer-form output than the
    // default conversational LM, which fits clinical notes.
    speechConfig.enableDictation();
    speechConfig.outputFormat = speechSdk.OutputFormat.Detailed;
    // Shorter segmentation silence => snappier `transcribed` finals.
    speechConfig.setProperty(
      speechSdk.PropertyId.Speech_SegmentationSilenceTimeoutMs,
      "500",
    );
    speechConfig.setProperty(
      speechSdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
      "15000",
    );

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStreamRef.current = stream;
    const audioConfig = speechSdk.AudioConfig.fromStreamInput(stream);

    const langs = mapLanguages(language);

    let transcriber: speechSdk.ConversationTranscriber;
    if (langs.length > 1) {
      // Continuous LID keeps re-evaluating language per segment instead of
      // locking to whatever it heard first — better for code-switching docs.
      speechConfig.setProperty(
        speechSdk.PropertyId.SpeechServiceConnection_LanguageIdMode,
        "Continuous",
      );
      const autoConfig =
        speechSdk.AutoDetectSourceLanguageConfig.fromLanguages(langs);
      transcriber = speechSdk.ConversationTranscriber.FromConfig(
        speechConfig,
        autoConfig,
        audioConfig,
      );
    } else {
      speechConfig.speechRecognitionLanguage = langs[0];
      transcriber = new speechSdk.ConversationTranscriber(
        speechConfig,
        audioConfig,
      );
    }

    if (AZURE_PHRASE_LIST.length > 0) {
      const grammar =
        speechSdk.PhraseListGrammar.fromRecognizer(transcriber);
      grammar.addPhrases(AZURE_PHRASE_LIST);
    }

    // Open the WSS handshake in parallel with mic init so the first utterance
    // doesn't pay the full connection setup latency.
    try {
      speechSdk.Connection.fromRecognizer(transcriber).openConnection();
    } catch (e) {
      console.warn("[Azure Speech] pre-warm openConnection failed:", e);
    }

    transcriber.sessionStarted = () => {
      console.log("[Azure Speech] session started");
      setState("recording");
    };

    transcriber.sessionStopped = () => {
      console.log("[Azure Speech] session stopped");
    };

    transcriber.transcribing = (_sender, e) => {
      const text = e.result?.text ?? "";
      if (!text) return;
      const speaker = normalizeSpeakerId(e.result?.speakerId);
      setPartialTokens([{ text, speaker }]);
    };

    transcriber.transcribed = (_sender, e) => {
      const text = (e.result?.text ?? "").trim();
      setPartialTokens([]);
      if (!text) return;
      const speaker = normalizeSpeakerId(e.result?.speakerId);
      setSegments((prev) => [...prev, { text, speaker }]);
    };

    transcriber.canceled = (_sender, e) => {
      if (e.reason === speechSdk.CancellationReason.Error) {
        console.error(
          "[Azure Speech] canceled with error:",
          e.errorDetails,
          e.errorCode,
        );
        transcriptionFailedRef.current = true;
        setError(new Error(e.errorDetails || "Azure Speech canceled"));
        setState("error");
        closeTranscriber();
      } else {
        console.log("[Azure Speech] canceled:", e.reason);
      }
    };

    return transcriber;
  }, [language, closeTranscriber]);

  const start = useCallback(() => {
    if (transcriberRef.current) return;
    setState("starting");
    setError(null);
    transcriptionFailedRef.current = false;
    setSegments([]);
    setPartialTokens([]);

    buildTranscriber()
      .then((t) => {
        transcriberRef.current = t;
        setState("connecting");
        t.startTranscribingAsync(
          () => {
            // sessionStarted callback flips state to "recording"
          },
          (err) => {
            console.error("[Azure Speech] start failed:", err);
            transcriptionFailedRef.current = true;
            setError(new Error(typeof err === "string" ? err : "Failed to start transcription"));
            setState("error");
            closeTranscriber();
          },
        );
      })
      .catch((e) => {
        console.error("[Azure Speech] init failed:", e);
        transcriptionFailedRef.current = true;
        setError(e instanceof Error ? e : new Error(String(e)));
        setState("error");
        stopMediaStream();
      });
  }, [buildTranscriber, closeTranscriber, stopMediaStream]);

  const stop = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const t = transcriberRef.current;
      if (!t) {
        setState("stopped");
        resolve();
        return;
      }
      t.stopTranscribingAsync(
        () => {
          closeTranscriber();
          setState("stopped");
          resolve();
        },
        (err) => {
          console.warn("[Azure Speech] stop error (continuing):", err);
          closeTranscriber();
          setState("stopped");
          resolve();
        },
      );
    });
  }, [closeTranscriber]);

  // Pause: tear down the transcriber so audio stops streaming. Resume rebuilds it;
  // existing `segments` are kept so the UI/transcript text persists across pauses.
  const pause = useCallback(() => {
    const t = transcriberRef.current;
    if (!t) return;
    if (stateRef.current !== "recording" && stateRef.current !== "connecting") {
      return;
    }
    t.stopTranscribingAsync(
      () => {
        closeTranscriber();
        setState("paused");
      },
      () => {
        closeTranscriber();
        setState("paused");
      },
    );
  }, [closeTranscriber]);

  const resume = useCallback(() => {
    if (stateRef.current !== "paused") return;
    setState("starting");
    buildTranscriber()
      .then((t) => {
        transcriberRef.current = t;
        setState("connecting");
        t.startTranscribingAsync(
          () => {},
          (err) => {
            console.error("[Azure Speech] resume failed:", err);
            setError(new Error(typeof err === "string" ? err : "Failed to resume transcription"));
            setState("error");
            closeTranscriber();
          },
        );
      })
      .catch((e) => {
        console.error("[Azure Speech] resume init failed:", e);
        setError(e instanceof Error ? e : new Error(String(e)));
        setState("error");
        stopMediaStream();
      });
  }, [buildTranscriber, closeTranscriber, stopMediaStream]);

  const cancel = useCallback(() => {
    const t = transcriberRef.current;
    if (t) {
      t.stopTranscribingAsync(
        () => closeTranscriber(),
        () => closeTranscriber(),
      );
    }
    setSegments([]);
    setPartialTokens([]);
    setState("canceled");
  }, [closeTranscriber]);

  useEffect(() => {
    return () => {
      const t = transcriberRef.current;
      const stream = mediaStreamRef.current;
      if (t) {
        try {
          t.stopTranscribingAsync(
            () => {
              try { t.close(); } catch {}
            },
            () => {
              try { t.close(); } catch {}
            },
          );
        } catch {}
        transcriberRef.current = null;
      }
      if (stream) {
        try { stream.getTracks().forEach((tr) => tr.stop()); } catch {}
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const getTranscription = useCallback((): TranscriptionToken[] => {
    const result: TranscriptionToken[] = [];

    for (const seg of segments) {
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

    if (partialTokens.length > 0) {
      const partialText = partialTokens
        .map((t) => t.text)
        .join("")
        .trim();
      if (partialText) {
        const partialSpeaker =
          partialTokens[partialTokens.length - 1]?.speaker ?? "S1";
        const last = result[result.length - 1];
        if (last && last.speaker === partialSpeaker) {
          last.text += " " + partialText;
        } else {
          result.push({ speaker: partialSpeaker, text: partialText });
        }
      }
    }

    return result;
  }, [segments, partialTokens]);

  const getTranscriptionStatus = useCallback((): "Success" | "Failed" => {
    if (transcriptionFailedRef.current) return "Failed";
    if (error) return "Failed";
    return "Success";
  }, [error]);

  return {
    start,
    stop,
    pause,
    resume,
    cancel,

    state,
    isActive:
      state === "recording" ||
      state === "paused" ||
      state === "connecting" ||
      state === "starting",
    isRecording: state === "recording",
    isPaused: state === "paused",
    isSupported,
    unsupportedReason,
    error,

    text: segments.map((s) => s.text).join(" "),
    segments,
    groups: [] as Array<{ speaker: string; text: string }>,
    finalTokens: [] as PartialToken[],
    partialTokens,

    getTranscription,
    getTranscriptionStatus,
    transcriptionFailed: transcriptionFailedRef.current,
  };
}
