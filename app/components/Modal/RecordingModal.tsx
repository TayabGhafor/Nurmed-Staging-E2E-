import Modal from ".";
import { Button } from "..";
import { MicIcon } from "../svgs";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Volume2 } from "lucide-react";
import SaveRecordingModel from "./SaveRecordingModel";
import DiscardConfirmationModel from "./DiscardConfirmationModel";
import SavingModal from "./SavingModal";
import { useAudioEncryption } from "../../hooks/useAudioEncryption";
import {
  NoteType,
  type RealtimeSessionAudioUpload,
} from "../../kyClient/dashboard";
import { dashboardService } from "../../kyClient/dashboard";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { clearHospitalParamsFromUrl } from "../../utils/hospital-params";
import { useSessionContext } from "../../contexts/SessionContext";
import {
  useSonioxTranscription,
  type TranscriptionToken,
} from "../../hooks/useRealtimeTranscription";
import { useAzureTranscription } from "../../hooks/useAzureTranscription";
import { useConnectionStatus } from "../../hooks/useConnectionStatus";

const isDubaiRegion = process.env.NEXT_PUBLIC_REGION === "dubai";

// How long the network may be lost mid-recording before we consider the live
// transcript unreliable. The Soniox WebSocket only tolerates a short stall
// before it closes, so an outage beyond this almost certainly left a gap in
// (or fully stopped) the live transcription — at which point we save the
// session as "Failed" and let the backend re-transcribe the full audio.
const CONNECTION_LOSS_FAILURE_THRESHOLD_MS = 8000;

const useTranscription = isDubaiRegion
  ? useAzureTranscription
  : useSonioxTranscription;

// Unique id tagged onto the Soniox WebSocket stream (client_reference_id) and
// persisted on the session, so Soniox usage logs (tokens/cost) can be
// reconciled back to this recording. Generated per recording, not per session,
// because each create/update opens its own Soniox stream with its own usage.
function generateClientReferenceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface RecordingModalProps {
  onStop: () => void;
  sessionData: {
    mrn: string;
    episode_id: string;
    department: string;
    language: string;
    hospital_data?: any;
  };
  isRecording: boolean;
  recordedAudioFile: File | null;
  audioPreviewUrl: string | null;
  recordingTime: string;
  recordingDurationSeconds: number;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isPaused: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  isUpdatingNote: boolean;
  sessionId: string | undefined;
  fetchSessions: () => void;
  fetchAndTransformNotes: (sessionId: number) => void;
}

const uploadAudioToPresignedUrl = async (
  audioUpload: RealtimeSessionAudioUpload,
  encryptedAudioData: string,
) => {
  if (!audioUpload.upload_url) {
    throw new Error("Audio upload URL is missing");
  }

  const headers = new Headers(audioUpload.upload_headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }
  // Azure Blob Storage requires x-ms-blob-type on PUT; only the dubai region
  // uploads via Azure (other regions use a different storage backend).
  if (
    process.env.NEXT_PUBLIC_REGION === "dubai" &&
    !headers.has("x-ms-blob-type")
  ) {
    headers.set("x-ms-blob-type", "BlockBlob");
  }
  const encryptedAudioBlob = new Blob([encryptedAudioData], {
    type: "application/octet-stream",
  });

  const response = await fetch(audioUpload.upload_url, {
    method: audioUpload.upload_method || "PUT",
    headers,
    body: encryptedAudioBlob,
  });

  if (!response.ok) {
    throw new Error(`Audio upload failed with status ${response.status}`);
  }
};

const RecordingModal = ({
  onStop,
  sessionData,
  isRecording,
  recordedAudioFile,
  audioPreviewUrl,
  recordingTime,
  recordingDurationSeconds,
  pauseRecording,
  resumeRecording,
  isPaused,
  startRecording,
  stopRecording,
  isUpdatingNote,
  sessionId,
  fetchSessions,
}: RecordingModalProps) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(true);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showSavingModal, setShowSavingModal] = useState(false);
  const [encryptionComplete, setEncryptionComplete] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [updatingSession, setUpdatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState(0);
  const audioFileRef = useRef<File | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const router = useRouter();
  const currentModalRef = useRef<"recording" | "save" | "saving">("recording");
  const hasCreatedSession = useRef(false);

  const [isInitializing, setIsInitializing] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const [noTranscriptionError, setNoTranscriptionError] = useState(false);
  const transcriptionEndRef = useRef<HTMLDivElement>(null);
  const savedTranscriptionRef = useRef<TranscriptionToken[]>([]);
  const stopCompletedRef = useRef(false);
  const lastPartialActivityRef = useRef<number>(Date.now());
  // True once the transcription service actually reached the "recording" state,
  // i.e. it connected and was streaming. Used to distinguish "Soniox was working
  // but the user said nothing" from "Soniox/network never connected".
  const transcriptionConnectedRef = useRef(false);
  // True if the network dropped for longer than the failure threshold while
  // recording (or the live transcription service errored/closed mid-stream).
  // When set, the live transcript is treated as unreliable: we save the session
  // with transcription_status "Failed" and let the backend re-transcribe the
  // full audio from storage, mirroring the offline retry flow. This covers the
  // case where the Soniox WebSocket closes after a prolonged stall and does not
  // auto-recover even after connectivity returns.
  const connectionLostDuringRecordingRef = useRef(false);

  const {
    addOptimisticSession,
    addSessionImmediately,
    updateSessionStatusToPending,
  } = useSessionContext();

  // Stable for the lifetime of this recording modal (one Soniox stream).
  const clientReferenceIdRef = useRef<string>("");
  if (!clientReferenceIdRef.current) {
    clientReferenceIdRef.current = generateClientReferenceId();
  }

  const transcription = useTranscription(
    sessionData.language,
    isDubaiRegion ? undefined : clientReferenceIdRef.current,
  );

  const isOnline = useConnectionStatus();

  const {
    encryptedAudioData,
    isEncrypting,
    isUploading,
    encryptionError,
    uploadProgress,
    estimatedTimeRemaining,
    encryptAudio,
    uploadEncryptedAudio,
  } = useAudioEncryption();

  useEffect(() => {
    if (recordedAudioFile) {
      audioFileRef.current = recordedAudioFile;
    }
    if (audioPreviewUrl) {
      audioUrlRef.current = audioPreviewUrl;
    }
  }, [recordedAudioFile, audioPreviewUrl]);

  // Start transcription and audio recorder on mount
  useEffect(() => {
    try {
      transcription.start();
    } catch (e) {
      console.error("[RecordingModal] Failed to start transcription:", e);
      setIsInitializing(false);
    }

    if (!isRecording) {
      startRecording();
    }
  }, []);

  // Dismiss loader once transcription reaches recording state (WebSocket connected)
  useEffect(() => {
    if (!isInitializing) return;

    const connected =
      transcription.state === "recording" || transcription.state === "paused";
    const failed =
      transcription.state === "error" ||
      transcription.state === "canceled" ||
      transcription.state === "stopped";

    if (connected || failed || transcription.error) {
      setIsInitializing(false);
    }
  }, [isInitializing, transcription.state, transcription.error]);

  // Safety timeout: dismiss loader after 10s even if Soniox hasn't connected
  useEffect(() => {
    if (!isInitializing) return;

    const timeout = setTimeout(() => {
      setIsInitializing(false);
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isInitializing]);

  // If transcription isn't supported, log it
  useEffect(() => {
    if (transcription.isSupported === false) {
      toast.error("Transcription not available in this browser.", {
        duration: 5000,
        position: "bottom-right",
      });
      setIsInitializing(false);
    }
  }, [transcription.isSupported, transcription.unsupportedReason]);

  // If transcription errors mid-recording, notify user but continue audio capture
  useEffect(() => {
    if (transcription.error && !showSavingModal && !isInitializing) {
      toast.error(
        "Transcription connection lost. Your recording will still be saved.",
        { duration: 5000, position: "bottom-right" },
      );
    }
  }, [transcription.error, showSavingModal, isInitializing]);

  // Auto-scroll transcription panel
  useEffect(() => {
    transcriptionEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcription.segments, transcription.partialTokens]);

  // Build grouped transcription from finalized segments + current partial text
  const groupedTranscription = useMemo(() => {
    const groups: { speaker: string; text: string }[] = [];

    for (const seg of transcription.segments) {
      const speaker = seg.speaker ?? "S1";
      const text = seg.text.trim();
      if (!text) continue;
      const last = groups[groups.length - 1];
      if (last && last.speaker === speaker) {
        last.text += " " + text;
      } else {
        groups.push({ speaker, text });
      }
    }

    if (transcription.partialTokens.length > 0) {
      const partialText = transcription.partialTokens
        .map((t) => t.text)
        .join("")
        .trim();
      if (partialText) {
        const partialSpeaker =
          transcription.partialTokens[transcription.partialTokens.length - 1]?.speaker ?? "S1";
        const last = groups[groups.length - 1];
        if (last && last.speaker === partialSpeaker) {
          last.text += " " + partialText;
        } else {
          groups.push({ speaker: partialSpeaker, text: partialText });
        }
      }
    }

    return groups;
  }, [transcription.segments, transcription.partialTokens]);

  // Record that the transcription service successfully connected at least once.
  useEffect(() => {
    if (transcription.state === "recording") {
      transcriptionConnectedRef.current = true;
    }
  }, [transcription.state]);

  // Monitor network connectivity for the lifetime of the recording. If the
  // connection is lost for longer than CONNECTION_LOSS_FAILURE_THRESHOLD_MS,
  // the Soniox WebSocket very likely closed (it tolerates only a short stall
  // before dropping) and the live transcript now has a gap — so we flag the
  // session as a transcription failure regardless of whether Soniox later
  // reconnects.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let offlineSince: number | null = null;
    let outageTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOffline = () => {
      offlineSince = Date.now();
      // Flag the failure once the outage crosses the threshold, even if the
      // user never regains connectivity before stopping the recording.
      outageTimer = setTimeout(() => {
        connectionLostDuringRecordingRef.current = true;
      }, CONNECTION_LOSS_FAILURE_THRESHOLD_MS);
    };

    const handleOnline = () => {
      if (outageTimer) {
        clearTimeout(outageTimer);
        outageTimer = null;
      }
      if (offlineSince != null) {
        const outageMs = Date.now() - offlineSince;
        if (outageMs >= CONNECTION_LOSS_FAILURE_THRESHOLD_MS) {
          connectionLostDuringRecordingRef.current = true;
        }
        offlineSince = null;
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (outageTimer) clearTimeout(outageTimer);
    };
  }, []);

  // The live transcription service errored/closed while it was actively
  // streaming (e.g. the Soniox socket dropped after a prolonged stall). Treat
  // the captured transcript as unreliable so we save with status "Failed".
  useEffect(() => {
    if (transcription.error && transcriptionConnectedRef.current) {
      connectionLostDuringRecordingRef.current = true;
    }
  }, [transcription.error]);

  // Whether this recording's live transcript must be treated as failed: the
  // service reported an error, the network dropped long enough mid-recording,
  // or nothing was captured at all. In every case we discard the (partial)
  // live transcript and let the backend transcribe the full audio from storage.
  const isTranscriptionFailed = useCallback(
    (captured: TranscriptionToken[]) => {
      if (connectionLostDuringRecordingRef.current) return true;
      if (captured.length === 0) return true;
      try {
        return transcription.getTranscriptionStatus() === "Failed";
      } catch {
        return false;
      }
    },
    [transcription],
  );

  // Persist the recording locally (IndexedDB) for a later retry when the
  // session can't be created/updated online — i.e. the user is offline or a
  // network/upload error happens mid-save. Guarded by a ref so the create-flow
  // catch block and the encryption/upload-error effect below can both call it
  // without storing the same recording twice.
  const offlineStoreInitiatedRef = useRef(false);
  const storeRecordingOffline = useCallback(async () => {
    if (offlineStoreInitiatedRef.current) return;
    const fileToStore = audioFileRef.current || recordedAudioFile;
    if (!fileToStore) return;
    offlineStoreInitiatedRef.current = true;

    const recordingBlob = new Blob([fileToStore], {
      type: fileToStore.type || "audio/webm",
    });
    await addOptimisticSession({
      mrn: sessionData.mrn,
      episode_id: sessionData.episode_id,
      department: sessionData.department,
      language: sessionData.language,
      recording: recordingBlob,
      hospital_data: sessionData.hospital_data,
      sessionId: isUpdatingNote && sessionId ? sessionId : undefined,
      isUpdate: isUpdatingNote,
    });
    clearHospitalParamsFromUrl();
    setCreatingSession(false);
    setShowSavingModal(false);
    onStop();
  }, [
    recordedAudioFile,
    addOptimisticSession,
    sessionData,
    isUpdatingNote,
    sessionId,
    onStop,
  ]);

  // Clear the "no conversation detected" error as soon as new speech is captured.
  useEffect(() => {
    if (noTranscriptionError && groupedTranscription.length > 0) {
      setNoTranscriptionError(false);
    }
  }, [noTranscriptionError, groupedTranscription]);

  const formatSpeaker = (speaker: string) => {
    if (/^\d+$/.test(speaker.trim())) {
      return `Speaker ${speaker.trim()}`;
    }
    if (/^S\d+$/i.test(speaker.trim())) {
      return `Speaker ${speaker.trim().slice(1)}`;
    }
    return speaker;
  };

  // Update saving progress based on current operation
  useEffect(() => {
    if (showSavingModal) {
      if (isEncrypting) {
        setSavingProgress(25);
      } else if (isUploading) {
        setSavingProgress(50);
      } else if (creatingSession || updatingSession) {
        setSavingProgress(75);
      }
    }
  }, [
    showSavingModal,
    isEncrypting,
    isUploading,
    creatingSession,
    updatingSession,
  ]);

  // After encryption completes, either update an existing note or create the
  // session first and upload the encrypted audio to the returned presigned URL.
  useEffect(() => {
    if (
      isEncrypting ||
      isUploading ||
      !encryptedAudioData ||
      !encryptionComplete
    ) {
      return;
    }

    if (isUpdatingNote) {
      const updateExistingSession = async () => {
        if (!sessionId) {
          setSessionError("Missing session id for update");
          return;
        }
        if (hasCreatedSession.current) return;
        hasCreatedSession.current = true;
        setEncryptionComplete(false);

        try {
          setUpdatingSession(true);
          setSessionError(null);

          const duration = Math.round(recordingDurationSeconds);
          const capturedTranscription = savedTranscriptionRef.current;
          // Treat a mid-recording connection loss / Soniox drop as a failure so
          // the backend re-transcribes the appended audio instead of saving a
          // partial live transcript.
          const transcriptionStatus = isTranscriptionFailed(capturedTranscription)
            ? "Failed"
            : "Success";

          await dashboardService.generateRealtimeUpdateSession(
            parseInt(sessionId),
            {
              transcription_status: transcriptionStatus,
              transcription:
                transcriptionStatus === "Success"
                  ? capturedTranscription
                  : undefined,
              session_duration_seconds: duration,
              third_party_present: false,
              // Soniox-only: tag this appended clip's stream for usage reconciliation.
              ...(isDubaiRegion
                ? {}
                : { client_reference_id: clientReferenceIdRef.current }),
            },
          );

          // Backend handles concatenation of this new clip with the existing
          // session audio; we just upload the raw new recording.
          await uploadEncryptedAudio(
            sessionData.mrn || "untitled",
            NoteType.UPDATE_SESSION,
            sessionId,
          );

          updateSessionStatusToPending(sessionId);
          setSavingProgress(100);
          setUpdatingSession(false);
          clearHospitalParamsFromUrl();

          toast.success(
            "Additional note added successfully. The session is being processed.",
            { duration: 3000, position: "bottom-right" },
          );

          setTimeout(() => {
            setShowSavingModal(false);
            onStop();
            router.push("/");
          }, 1000);
        } catch (error) {
          console.error("Failed to update session:", error);
          hasCreatedSession.current = false;
          toast.error("Failed to update session", {
            duration: 1000,
            position: "bottom-right",
          });
          setSessionError(
            error instanceof Error
              ? error.message
              : "Failed to update session",
          );
          setUpdatingSession(false);
        }
      };

      updateExistingSession();
      return;
    }

    const createNewSession = async () => {
      if (hasCreatedSession.current) return;
      hasCreatedSession.current = true;
      setEncryptionComplete(false);

      try {
        setCreatingSession(true);
        setSessionError(null);

        const duration = Math.round(recordingDurationSeconds);
        const capturedTranscription = savedTranscriptionRef.current;
        const transcriptionFailed = isTranscriptionFailed(capturedTranscription);

        const sessionCreationData: any = {
          mrn: sessionData.mrn,
          session_template: sessionData.department,
          language: sessionData.language,
          session_duration_seconds: duration,
          third_party_present: false,
        };

        if (transcriptionFailed) {
          // The connection dropped (or Soniox closed) mid-recording, so the
          // live transcript is unreliable. Mirror the offline retry flow:
          // upload the encrypted audio to storage FIRST and attach its key, so
          // the backend can re-transcribe the full audio. The realtime "Failed"
          // create path does not hand back a presigned upload URL, so without
          // this the audio would never reach the backend.
          const storageId = await uploadEncryptedAudio(
            sessionData.mrn || "untitled",
            NoteType.CREATE_SESSION,
          );
          if (!storageId) {
            throw new Error(
              "Audio upload failed for failed-transcription session",
            );
          }
          sessionCreationData.transcription_status = "Failed";
          sessionCreationData.s3_key = storageId;
        } else {
          sessionCreationData.transcription = capturedTranscription;
        }

        // Only Soniox (non-Dubai) streams carry a usage log to reconcile.
        if (!isDubaiRegion) {
          sessionCreationData.client_reference_id =
            clientReferenceIdRef.current;
        }

        if (isDubaiRegion) {
          sessionCreationData.episode_id =
            sessionData.episode_id?.trim() ?? "";
        }

        if (
          sessionData.hospital_data &&
          Object.keys(sessionData.hospital_data).length > 0
        ) {
          sessionCreationData.hospital_data = sessionData.hospital_data;
        }

        const sessionResponse =
          await dashboardService.createRealtimeSession(sessionCreationData);

        if (sessionResponse && sessionResponse.session_id) {
          addSessionImmediately({
            id: sessionResponse.session_id,
            mrn: sessionData.mrn,
            ...(isDubaiRegion
              ? {
                  episode_id:
                    sessionData.episode_id?.trim() ?? "",
                }
              : {}),
            department: sessionData.department,
            language: sessionData.language,
            hospital_data: sessionData.hospital_data,
          });
        }

        toast.success("Session created successfully", {
          duration: 1000,
          position: "bottom-right",
        });
        setSavingProgress(100);
        setCreatingSession(false);
        clearHospitalParamsFromUrl();

        // Kick off the S3/Azure presigned upload immediately so the request is
        // in flight before the modal/hook tear down. Deferring it inside a
        // setTimeout that runs AFTER onStop() was causing the upload to be
        // dropped, which is why the audio later 404s on getFinalNoteUrl.
        // The failed-transcription path already uploaded the audio (and passed
        // its s3_key above), so it skips this presigned upload entirely.
        let uploadPromise: Promise<void> | null = null;
        if (!transcriptionFailed) {
          if (sessionResponse.audio_upload) {
            uploadPromise = uploadAudioToPresignedUrl(
              sessionResponse.audio_upload,
              encryptedAudioData,
            ).catch((uploadError) => {
              console.error("Failed to upload audio to S3:", uploadError);
              toast.error("Session saved, but audio upload failed", {
                duration: 3000,
                position: "bottom-right",
              });
            });
          } else {
            console.warn(
              "Session response did not include an audio upload URL",
            );
            toast.error("Session saved, but audio upload URL was missing", {
              duration: 3000,
              position: "bottom-right",
            });
          }
        }

        setTimeout(async () => {
          await fetchSessions();
          // Wait for the upload to finish before unmounting the modal so the
          // fetch isn't torn down mid-flight by a parent re-render.
          if (uploadPromise) {
            await uploadPromise;
          }
          setShowSavingModal(false);
          onStop();
        }, 1000);
      } catch (error) {
        console.error("Failed to create session:", error);
        hasCreatedSession.current = false;

        const hasRecording = audioFileRef.current || recordedAudioFile;
        // Covers both the realtime create call and the failed-transcription S3
        // upload above ("Upload failed: Network error" from the XHR uploader).
        const isNetworkError =
          error instanceof Error &&
          (error.message.includes("Failed to fetch") ||
            error.message.includes("NetworkError") ||
            error.message.includes("Network error") ||
            error.message.includes("No internet connection"));

        if (hasRecording && isNetworkError) {
          await storeRecordingOffline();
          return;
        }

        toast.error("Failed to create session", {
          duration: 1000,
          position: "bottom-right",
        });
        setSessionError(
          error instanceof Error
            ? error.message
            : "Failed to create session",
        );
        setCreatingSession(false);
      }
    };

    createNewSession();
  }, [
    isEncrypting,
    isUploading,
    encryptedAudioData,
    encryptionComplete,
    uploadEncryptedAudio,
    sessionData,
    isUpdatingNote,
    recordingDurationSeconds,
    addSessionImmediately,
    fetchSessions,
    onStop,
    recordedAudioFile,
    addOptimisticSession,
    sessionId,
    router,
    updateSessionStatusToPending,
    isTranscriptionFailed,
    storeRecordingOffline,
  ]);

  // Handle upload failures by storing optimistically (network errors)
  useEffect(() => {
    if (encryptionError && !isUploading && !isEncrypting) {
      const isNetworkError =
        encryptionError.includes("Failed to fetch") ||
        encryptionError.includes("NetworkError") ||
        encryptionError.includes("offline") ||
        encryptionError.includes("Upload failed");

      if (isNetworkError && (audioFileRef.current || recordedAudioFile)) {
        // Guarded helper — no-ops if the create-flow catch already stored this
        // recording offline (e.g. a failed-transcription S3 upload that failed).
        storeRecordingOffline();
      }
    }
  }, [
    encryptionError,
    isUploading,
    isEncrypting,
    recordedAudioFile,
    storeRecordingOffline,
  ]);

  const completeStop = useCallback(() => {
    if (stopCompletedRef.current) return;
    stopCompletedRef.current = true;

    try { transcription.pause(); } catch {}

    try {
      savedTranscriptionRef.current = transcription.getTranscription();
    } catch {
      savedTranscriptionRef.current = [];
    }

    setIsStopping(false);
    setShowRecordingModal(false);
    setShowSaveModal(true);
    currentModalRef.current = "save";
  }, [transcription]);

  useEffect(() => {
    lastPartialActivityRef.current = Date.now();
  }, [transcription.partialTokens]);

  useEffect(() => {
    if (!isStopping) return;
    if (transcription.partialTokens.length === 0) {
      completeStop();
    }
  }, [isStopping, transcription.partialTokens, completeStop]);

  // Fallback if the server never drains partials (network stall, dropped final).
  useEffect(() => {
    if (!isStopping) return;
    const interval = setInterval(() => {
      if (Date.now() - lastPartialActivityRef.current >= 5000) {
        completeStop();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isStopping, completeStop]);

  const handleStop = () => {
    pauseRecording();
    if (transcription.partialTokens.length > 0) {
      if ("finalize" in transcription) {
        try { transcription.finalize({ trailing_silence_ms: 0 }); } catch {}
      }
    }
    lastPartialActivityRef.current = Date.now();
    stopCompletedRef.current = false;
    setIsStopping(true);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording();
      try { transcription.resume(); } catch {}
    } else {
      pauseRecording();
      try { transcription.pause(); } catch {}
    }
  };

  const handleRecordingModalClose = () => {
    pauseRecording();
    try { transcription.pause(); } catch {}
    setShowDiscardModal(true);
    currentModalRef.current = "recording";
  };

  const handleSaveModalClose = async (
    shouldStop: boolean,
    shouldDiscard?: boolean,
  ) => {
    setShowSaveModal(false);

    if (shouldStop) {
      // Re-capture transcription in case more segments finalized while save modal was open.
      // If this fails or returns empty, keep the capture from handleStop.
      try {
        const latestTranscription = transcription.getTranscription();
        if (latestTranscription.length > 0) {
          savedTranscriptionRef.current = latestTranscription;
        }
      } catch {
        // Keep the transcription captured in handleStop
      }

      // Block saving only when the user is online AND the transcription service
      // actually connected and worked correctly, but captured no conversation
      // (the user didn't say anything). If the user is offline, the network
      // dropped mid-recording, or the service never connected/failed, we fall
      // through and save the session as before.
      if (!shouldDiscard) {
        const isOnline =
          typeof navigator !== "undefined" ? navigator.onLine : true;
        const transcriptionWorking =
          transcription.getTranscriptionStatus() === "Success";
        const transcriptionConnected = transcriptionConnectedRef.current;
        const hasTranscription = savedTranscriptionRef.current.length > 0;

        if (
          isOnline &&
          transcriptionConnected &&
          transcriptionWorking &&
          !hasTranscription
        ) {
          // Surface the error inline within the recording modal (not a toast).
          setNoTranscriptionError(true);
          // Return to the recording view and resume so the user can capture
          // the conversation instead of saving an empty session.
          setShowRecordingModal(true);
          resumeRecording();
          try {
            transcription.resume();
          } catch {}
          currentModalRef.current = "recording";
          return;
        }
      }

      stopRecording();
      try { transcription.stop().catch(() => {}); } catch {}

      if (shouldDiscard) {
        try { transcription.cancel(); } catch {}
        onStop();
        toast.success("Recording discarded", {
          duration: 1000,
          position: "bottom-right",
        });
        return;
      }

      setShowSavingModal(true);
      currentModalRef.current = "saving";
      setSavingProgress(10);

      // Wait briefly for the audio file to finalize, then encrypt
      setTimeout(() => {
        const fileToEncrypt = audioFileRef.current || recordedAudioFile;

        if (!fileToEncrypt) {
          setSessionError("No audio file available");
          return;
        }

        encryptAudio(fileToEncrypt);
        setEncryptionComplete(true);
      }, 500);
    } else {
      setShowRecordingModal(true);
      resumeRecording();
      try { transcription.resume(); } catch {}
      currentModalRef.current = "recording";
    }
  };

  const handleSavingComplete = () => {
    if (sessionError || encryptionError) {
      setShowSavingModal(false);
      setShowRecordingModal(true);
      currentModalRef.current = "recording";
      setSessionError(null);
    } else {
      setShowSavingModal(false);
      onStop();
    }
  };

  const handleDiscardConfirmation = (shouldDiscard: boolean) => {
    setShowDiscardModal(false);

    if (shouldDiscard) {
      stopRecording();
      try { transcription.cancel(); } catch {}
      onStop();
      toast.success("Recording discarded", {
        duration: 1000,
        position: "bottom-right",
      });
    } else {
      if (currentModalRef.current === "recording") {
        setShowRecordingModal(true);
        resumeRecording();
        try { transcription.resume(); } catch {}
      } else if (currentModalRef.current === "save") {
        setShowSaveModal(true);
      } else if (currentModalRef.current === "saving") {
        setShowSavingModal(true);
      }
    }
  };

  const isTranscriptionActive =
    transcription.state === "recording" ||
    transcription.state === "paused" ||
    transcription.state === "connecting" ||
    transcription.state === "starting";

  return (
    <>
      {showRecordingModal && isInitializing && (
        <Modal
          className="flex max-w-md flex-col items-center justify-center gap-6 px-10 py-14 text-center"
          onClose={() => {
            try { transcription.cancel(); } catch {}
            stopRecording();
            onStop();
          }}
        >
          <div className="relative flex items-center justify-center">
            <div className="relative">
              <svg
                className="h-16 w-16 animate-spin text-[#2832A8]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <MicIcon />
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-medium text-gray-800">
              Setting up recording...
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              {transcription.state === "connecting"
                ? "Connecting to transcription service..."
                : transcription.state === "starting"
                  ? "Requesting microphone access..."
                  : "Initializing..."}
            </p>
          </div>

          <div className="flex w-full max-w-xs flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                isRecording ? "bg-green-500" : "animate-pulse bg-yellow-500"
              }`} />
              <span className="text-sm text-gray-600">
                {isRecording ? "Microphone ready" : "Setting up microphone..."}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                transcription.state === "recording"
                  ? "bg-green-500"
                  : transcription.state === "connecting" || transcription.state === "starting"
                    ? "animate-pulse bg-yellow-500"
                    : transcription.error
                      ? "bg-red-500"
                      : "bg-gray-300"
              }`} />
              <span className="text-sm text-gray-600">
                {transcription.state === "recording"
                  ? "Transcription connected"
                  : transcription.state === "connecting"
                    ? "Connecting to transcription..."
                    : transcription.state === "starting"
                      ? "Starting transcription..."
                      : transcription.error
                        ? "Transcription unavailable"
                        : "Waiting for connection..."}
              </span>
            </div>
          </div>
        </Modal>
      )}

      {showRecordingModal && !isInitializing && (
        <Modal
          className="flex max-w-xl flex-col items-center gap-3 px-6 py-6 sm:px-8 sm:py-8"
          onClose={isStopping ? () => {} : handleRecordingModalClose}
        >
          {/* Recording timer */}
          <div className="animate-pulse">
            <MicIcon />
          </div>
          <h2 className="text-2xl font-medium text-[#FE4EEE] sm:text-3xl">
            {recordingTime}
          </h2>

          {/* Offline notice — recording keeps going; the live transcript may
              pause, but the audio is captured and the session is processed once
              back online. Doctor should just keep speaking. */}
          {!isOnline && (
            <div className="flex w-full items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-left">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs text-amber-700">
                Internet connection lost. You&apos;re offline. Keep speaking the recording continues and
                this session will be processed in offline mode.
              </p>
            </div>
          )}

          {/* No-conversation-detected error (shown when save was blocked) */}
          {noTranscriptionError && (
            <div className="flex w-full items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-left">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-xs text-red-600">
                No conversation was detected. Please record the conversation
                before saving this session.
              </p>
            </div>
          )}

          {/* Live Transcription */}
          <div className="w-full">
            <div className="mb-1.5 flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  isTranscriptionActive && !isPaused
                    ? "animate-pulse bg-green-500"
                    : isPaused
                      ? "bg-yellow-500"
                      : transcription.state === "connecting" ||
                          transcription.state === "starting"
                        ? "animate-pulse bg-yellow-500"
                        : "bg-gray-400"
                }`}
              />
              <span className="text-xs font-medium text-secondary-100">
                {transcription.isRecording
                  ? isPaused
                    ? "Paused"
                    : "Listening..."
                  : transcription.state === "connecting" ||
                      transcription.state === "starting"
                    ? "Connecting..."
                    : transcription.error
                      ? "Transcription unavailable"
                      : "Disconnected"}
              </span>
            </div>

            <div className="max-h-[30vh] overflow-y-auto rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-2.5">
              <AnimatePresence mode="popLayout">
                {groupedTranscription.length > 0 ? (
                  <div className="relative space-y-2">
                    {groupedTranscription.map((group, index) => (
                      <motion.div
                        key={`${group.speaker}-${index}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`flex items-start gap-2 ${
                          index === groupedTranscription.length - 1
                            ? "text-secondary"
                            : "text-secondary-100"
                        }`}
                      >
                        <div
                          className={`mt-0.5 shrink-0 rounded-md p-1 ${
                            group.speaker
                              .toLowerCase()
                              .includes("doctor") ||
                            group.speaker
                              .toLowerCase()
                              .includes("provider")
                              ? "bg-primary-light"
                              : "bg-secondary-300"
                          }`}
                        >
                          <Volume2 className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-100">
                            {formatSpeaker(group.speaker)}
                          </span>
                          <p className="text-sm leading-relaxed">
                            {group.text}
                          </p>
                        </div>
                      </motion.div>
                    ))}

                    {isTranscriptionActive && !isPaused && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-secondary-100"
                      >
                        <div className="flex gap-1">
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-4 text-secondary-100">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-xs">
                      Your conversation will appear here in real-time
                    </p>
                  </div>
                )}
              </AnimatePresence>
              <div ref={transcriptionEndRef} />
            </div>
          </div>

          {/* Stopping buffer / Pause & Stop buttons */}
          {isStopping ? (
            <div className="flex w-full max-w-sm items-center justify-center gap-3 rounded-lg bg-secondary-300 p-3">
              <svg
                className="h-5 w-5 animate-spin text-[#2832A8]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-xs text-secondary">
                Finishing up transcription...
              </p>
            </div>
          ) : (
            <div className="grid w-full max-w-sm grid-cols-2 gap-4 divide-x divide-black/50 rounded-lg bg-secondary-300 p-3">
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 px-3"
                onClick={handlePauseResume}
              >
                {isPaused ? (
                  <svg
                    width="23"
                    height="22"
                    viewBox="0 0 19 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9.46484 0.0842285C4.63222 0.0842285 0.714844 4.0016 0.714844 8.83423C0.714844 13.6669 4.63222 17.5842 9.46484 17.5842C14.2975 17.5842 18.2148 13.6669 18.2148 8.83423C18.2148 4.0016 14.2975 0.0842285 9.46484 0.0842285ZM7.31238 5.33423L13.6874 8.83423L7.31238 12.3342V5.33423Z"
                      fill="#3B7ADE"
                    />
                  </svg>
                ) : (
                  <svg
                    width="23"
                    height="22"
                    viewBox="0 0 19 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9.46484 0.0842285C4.63222 0.0842285 0.714844 4.0016 0.714844 8.83423C0.714844 13.6669 4.63222 17.5842 9.46484 17.5842C14.2975 17.5842 18.2148 13.6669 18.2148 8.83423C18.2148 4.0016 14.2975 0.0842285 9.46484 0.0842285ZM7.31238 5.33423C7.79582 5.33423 8.18738 5.72579 8.18738 6.20923V11.4592C8.18738 11.9427 7.79582 12.3342 7.31238 12.3342C6.82894 12.3342 6.43738 11.9427 6.43738 11.4592V6.20923C6.43738 5.72579 6.82894 5.33423 7.31238 5.33423ZM11.6874 5.33423C12.1708 5.33423 12.5624 5.72579 12.5624 6.20923V11.4592C12.5624 11.9427 12.1708 12.3342 11.6874 12.3342C11.2039 12.3342 10.8124 11.9427 10.8124 11.4592V6.20923C10.8124 5.72579 11.2039 5.33423 11.6874 5.33423Z"
                      fill="#3B7ADE"
                    />
                  </svg>
                )}
                <p className="text-xs text-secondary">
                  {isPaused ? "Resume" : "Pause"} Recording
                </p>
              </div>
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 px-3"
                onClick={handleStop}
              >
                <svg
                  width="23"
                  height="22"
                  viewBox="0 0 23 22"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11.5001 0C5.51683 0 0.666748 4.85008 0.666748 10.8333C0.666748 16.8166 5.51683 21.6667 11.5001 21.6667C17.4833 21.6667 22.3334 16.8166 22.3334 10.8333C22.3334 4.85008 17.4833 0 11.5001 0ZM9.10596 7.04167H13.981C14.7279 7.04167 15.3351 7.64942 15.3351 8.39583V13.2708C15.3351 14.0172 14.7279 14.625 13.981 14.625H9.10596C8.359 14.625 7.75179 14.0172 7.75179 13.2708V8.39583C7.75179 7.64942 8.359 7.04167 9.10596 7.04167Z"
                    fill="#FF2D55"
                  />
                </svg>

                <Button className="text-xs text-secondary">
                  Stop Recording
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {showSaveModal && (
        <SaveRecordingModel
          onClose={handleSaveModalClose}
          onOutsideClick={() => {
            setShowSaveModal(false);
            setShowDiscardModal(true);
            currentModalRef.current = "save";
          }}
        />
      )}

      {showSavingModal && (
        <SavingModal
          savingProgress={savingProgress}
          isEncrypting={isEncrypting}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          estimatedTimeRemaining={estimatedTimeRemaining}
          isCreatingSession={creatingSession || updatingSession}
          error={sessionError || encryptionError}
          onComplete={handleSavingComplete}
        />
      )}

      {showDiscardModal && (
        <DiscardConfirmationModel onClose={handleDiscardConfirmation} />
      )}
    </>
  );
};

export default RecordingModal;
