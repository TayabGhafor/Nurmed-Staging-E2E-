import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "../contexts/SessionContext";
import { useSession } from "./useSession";
import {
  Medication,
  Message,
  Patient,
} from "../(pages)/(dashboard)/interfaces";
import { Status } from "../kyClient/dashboard";
import toast from "react-hot-toast";
import { isEhrOrScribeSendLocked } from "../utils/ehrStatus";

type CachedSessionState = {
  currentSession: Patient | null;
  medications: Medication[];
  sessionData: {
    mrn: string;
    episode_id: string;
    department: string;
    language: string;
    audioInputDeviceId?: string;
  };
};

const SESSION_CACHE_PREFIX = "route-session-cache";

const getSessionCacheKey = (sessionId: string) =>
  `${SESSION_CACHE_PREFIX}:${sessionId}`;

const readSessionCache = (sessionId: string): CachedSessionState | null => {
  if (typeof window === "undefined" || !sessionId) return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionCacheKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      currentSession: parsed.currentSession ?? null,
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      sessionData: {
        mrn: parsed.sessionData?.mrn ?? "",
        episode_id: parsed.sessionData?.episode_id ?? "",
        department: parsed.sessionData?.department ?? "",
        language: parsed.sessionData?.language ?? "",
        audioInputDeviceId: parsed.sessionData?.audioInputDeviceId,
      },
    };
  } catch {
    return null;
  }
};

const writeSessionCache = (sessionId: string, value: CachedSessionState) => {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    window.sessionStorage.setItem(
      getSessionCacheKey(sessionId),
      JSON.stringify(value),
    );
  } catch {
    // ignore quota / serialization errors
  }
};

// Department mapping to normalize labels back to keys
const departmentLabelToKey: { [key: string]: string } = {
  "Emergency Department": "ED",
  "Primary Care": "PC",
  "Outpatient Department": "OPD",
  "Patient Review": "REVIEW",
  "Radiology": "RADIOLOGY",
};

/**
 * Normalize department value to always use the key (e.g., "ED") instead of label
 */
const normalizeDepartment = (department: string | undefined): string => {
  if (!department) return "ED";
  // If it's already a key, return it
  if (["ED", "PC", "OPD", "REVIEW", "RADIOLOGY"].includes(department)) {
    return department;
  }
  // Otherwise, try to map from label to key
  return departmentLabelToKey[department] || department;
};

export function useRouteSession(sessionId: string) {
  const router = useRouter();
  const hasHandledAuthError = useRef(false);
  const { sessions, fetchSessions, patchSessionInPlace } = useSessionContext();
  const {
    getSession,
    getNotes,
    // getTranscription,
    getFinalNoteUrl,
    updateNotes,
  } = useSession();

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // State for the current session. Defaults match the SSR/initial render so
  // there's no hydration mismatch — `loadSessionData()` reads sessionStorage
  // synchronously at the top and swaps cached values in before the loader
  // ever paints.
  const [currentSession, setCurrentSession] = useState<Patient | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [finalNoteUrl, setFinalNoteUrl] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<{
    mrn: string;
    episode_id: string;
    department: string;
    language: string;
    audioInputDeviceId?: string;
  }>({
    mrn: "",
    episode_id: "",
    department: "",
    language: "",
  });

  // Transform notes data
  const transformNotes = useCallback((notesData: any[]) => {
    return (
      notesData?.map((note: any) => ({
        id: note.section_id,
        title: note.section,
        content: note.details,
        lastUpdated: "",
      })) || []
    );
  }, []);

  // Transform transcription data
  const transformTranscription = useCallback((transcriptionData: any[]) => {
    return (
      transcriptionData?.map((message: any, index: number) => ({
        id: index.toString(),
        sender: message.speaker,
        content: message.text,
        timestamp: "",
      })) || []
    );
  }, []);

  // Fetch and transform notes
  const fetchAndTransformNotes = useCallback(
    async (sessionId: number) => {
      try {
        const notesData = await getNotes(sessionId);
        const transformedNotes = transformNotes(notesData);
        setMedications(transformedNotes);
        return transformedNotes;
      } catch (error) {
        console.error("Error fetching notes:", error);
        return [];
      }
    },
    [getNotes, transformNotes],
  );

  // Fetch and transform transcription
  // const fetchAndTransformTranscription = useCallback(
  //   async (sessionId: number) => {
  //     try {
  //       const transcriptionData = await getTranscription(sessionId);
  //       const transformedMessages = transformTranscription(transcriptionData);
  //       setMessages(transformedMessages);
  //       return transformedMessages;
  //     } catch (error) {
  //       console.error("Error fetching transcription:", error);
  //       return [];
  //     }
  //   },
  //   [getTranscription, transformTranscription],
  // );

  // Handle medication edit
  const handleMedicationEdit = useCallback(
    async (medicationId: string, newContent: string) => {
      if (!currentSession) return;
      if (isEhrOrScribeSendLocked(currentSession)) return;

      // First update the local state for immediate UI feedback
      setMedications((prev) =>
        prev.map((med) =>
          med.id === medicationId ? { ...med, content: newContent } : med,
        ),
      );

      try {
        const updateData = {
          section_id: medicationId.toString(),
          updated_details: newContent,
        };

        const sessionId = parseInt(currentSession.id);
        const response = await updateNotes(sessionId, updateData);

        if (response) {
          toast.success("Note updated successfully", {
            duration: 1000,
            position: "bottom-right",
          });
        }
      } catch (error) {
        console.error("Failed to update note:", error);
        // Refetch notes if there was an error to ensure UI is in sync with server
        if (currentSession) {
          const sessionId = parseInt(currentSession.id);
          fetchAndTransformNotes(sessionId);
        }
        toast.error("Failed to update note. Please try again.", {
          duration: 1000,
          position: "bottom-right",
        });
      }
    },
    [currentSession, updateNotes, fetchAndTransformNotes],
  );

  // Handle medication copy
  const handleCopyMedication = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard", {
      duration: 1000,
      position: "bottom-right",
    });
  }, []);

  // Load session data
  const loadSessionData = useCallback(async () => {
    if (!sessionId) return;

    const cached = readSessionCache(sessionId);
    if (cached) {
      setCurrentSession(cached.currentSession);
      setMedications(cached.medications);
      setFinalNoteUrl(null);
      setSessionData(cached.sessionData);
      setIsLoading(false);
    } else {
      setCurrentSession(null);
      setMedications([]);
      setFinalNoteUrl(null);
      setSessionData({
        mrn: "",
        episode_id: "",
        department: "",
        language: "",
      });
      setIsLoading(true);
    }

    const fromList = sessionsRef.current.find(
      (s) => s.id === sessionId && !s.isOffline,
    );

    if (fromList) {
      const sessionFromList: Patient = {
        ...fromList,
        name: fromList.name || `Session ${fromList.mrn}`,
      };
      const statusStr = String(sessionFromList.status);
      const isFailed = statusStr === String(Status.Failed);
      const isDeleted = statusStr === String(Status.Deleted);

      setCurrentSession(sessionFromList);
      setSessionData({
        mrn: sessionFromList.mrn,
        episode_id: sessionFromList.episode_id ?? "",
        department: sessionFromList.department,
        language: sessionFromList.language,
      });

      try {
        const sessionIdNumber = parseInt(sessionId);
        if (isFailed) {
          toast.error(
            `Something went wrong. Contact support for session ID: ${sessionId}`,
            { duration: 3000, position: "bottom-right" },
          );
        } else if (isDeleted) {
          await fetchAndTransformNotes(sessionIdNumber);
        } else {
          // Completed / Pending / Transcribed — fetch notes + final note URL
          const [, finalNoteUrlData] = await Promise.all([
            fetchAndTransformNotes(sessionIdNumber),
            getFinalNoteUrl(sessionId),
          ]);
          if (finalNoteUrlData?.audio_url) {
            setFinalNoteUrl(finalNoteUrlData.audio_url);
          }
        }
      } catch (error) {
        console.error("Error loading session data from list:", error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // Fallback: session isn't in the loaded list, hit the per-session API
      const sessionIdNumber = parseInt(sessionId);
      const sessionDetails = await getSession(sessionIdNumber);

        if (sessionDetails) {
        const normalizedDept = normalizeDepartment(sessionDetails.session_template);
        
        const session: Patient = {
          id: sessionId,
          mrn: sessionDetails.mrn,
          episode_id: sessionDetails.episode_id,
          department: normalizedDept,
          sessionDurationSeconds: sessionDetails.session_duration_seconds,
          language: sessionDetails.language,
          name: `Session ${sessionDetails.mrn}`,
          status: sessionDetails.status,
          dateOfBirth: new Date(sessionDetails.created_at).toLocaleDateString(),
          date: new Date(sessionDetails.created_at).toLocaleDateString(),
          hospital_data: sessionDetails.hospital_data,
          ehr_status: sessionDetails.ehr_status ?? undefined,
          ehr_response: sessionDetails.ehr_response ?? undefined,
        };
        console.log("Session details from API:", sessionDetails);

        const isCompleted = String(sessionDetails.status) === String(Status.Completed);
        const isFailed = String(sessionDetails.status) === String(Status.Failed);
        const isDeleted = String(sessionDetails.status) === String(Status.Deleted);

        if (isFailed) {
          console.log(`Session ${sessionId} has failed status`);
          toast.error(
            `Something went wrong. Contact support for session ID: ${sessionId}`,
            {
              duration: 3000,
              position: "bottom-right",
            },
          );
          setCurrentSession(session);
        } else if (isCompleted) {
          // Session is completed, fetch all data
          setCurrentSession(session);

          // Fetch notes, transcription, and final note URL in parallel
          const [notesData, 
            // transcriptionData, 
            finalNoteUrlData] =
            await Promise.all([
              fetchAndTransformNotes(sessionIdNumber),
              // fetchAndTransformTranscription(sessionIdNumber),
              getFinalNoteUrl(sessionId),
            ]);

          if (finalNoteUrlData?.audio_url) {
            setFinalNoteUrl(finalNoteUrlData.audio_url);
          }

          // Update session data
          setSessionData({
            mrn: session.mrn,
            episode_id: sessionDetails.episode_id ?? "",
            department: session.department,
            language: session.language,
          });
        } else if (isDeleted) {
          // Session is deleted, fetch notes but skip audio data
          console.log(`Session ${sessionId} is deleted, skipping audio data`);
          setCurrentSession(session);

          // Only fetch notes for deleted sessions
          await fetchAndTransformNotes(sessionIdNumber);

          // Update session data
          setSessionData({
            mrn: session.mrn,
            episode_id: sessionDetails.episode_id ?? "",
            department: session.department,
            language: session.language,
          });
        } else {
          // For other statuses (Pending, Transcribed), still show the session but log the status
          console.log(
            `Session ${sessionId} has status: ${sessionDetails.status}`,
          );
          setCurrentSession(session);

          // Try to fetch whatever data is available
          const [notesData,
            //  transcriptionData,
              finalNoteUrlData] =
            await Promise.all([
              fetchAndTransformNotes(sessionIdNumber),
              // fetchAndTransformTranscription(sessionIdNumber),
              getFinalNoteUrl(sessionId),
            ]);

          if (finalNoteUrlData?.audio_url) {
            setFinalNoteUrl(finalNoteUrlData.audio_url);
          }

          // Update session data
          setSessionData({
            mrn: session.mrn,
            episode_id: sessionDetails.episode_id ?? "",
            department: session.department,
            language: session.language,
          });
        }
      }
    } catch (error: any) {
      // Handle 404 errors - session not found or not authorized
      // Use ref to prevent duplicate toasts (e.g., from React StrictMode)
      if (error?.status === 404 && !hasHandledAuthError.current) {
        hasHandledAuthError.current = true;
        toast.error("You are not authorized to access this session", {
          duration: 3000,
          position: "bottom-right",
        });
        router.push("/");
        return;
      }

      // Log and show toast for other errors
      if (!hasHandledAuthError.current) {
        console.error("Error loading session:", error);
        toast.error(`Failed to load session. Please try again later.`, {
          duration: 3000,
          position: "bottom-right",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    sessionId,
    getSession,
    fetchAndTransformNotes,
    // fetchAndTransformTranscription,
    getFinalNoteUrl,
  ]);

  const loadedSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadedSessionIdRef.current === sessionId) return;
    loadedSessionIdRef.current = sessionId;
    loadSessionData();
  }, [sessionId, loadSessionData]);

  useEffect(() => {
    if (!sessionId || !currentSession) return;
    if (currentSession.id !== sessionId) return;
    writeSessionCache(sessionId, {
      currentSession,
      medications,
      sessionData,
    });
  }, [sessionId, currentSession, medications, sessionData]);

  /** After send-to-scribe succeeds, patch local session so locks apply without a full refetch */
  const markScribeJobQueued = useCallback(() => {
    setCurrentSession((prev) =>
      prev
        ? {
            ...prev,
            ehr_status: 200,
            ehr_response: { scribe_job_queued: true },
          }
        : null,
    );
    
    if (sessionId) {
      patchSessionInPlace(sessionId, {
        ehr_status: 200,
        ehr_response: { scribe_job_queued: true },
      });
    }
  }, [sessionId, patchSessionInPlace]);

  // Return the session data and functions
  return {
    currentSession,
    medications,
    // messages,
    isLoading,
    finalNoteUrl,
    sessionData,
    setSessionData,
    refreshData: loadSessionData,
    fetchAndTransformNotes,
    // fetchAndTransformTranscription,
    handleMedicationEdit,
    handleCopyMedication,
    markScribeJobQueued,
  };
}