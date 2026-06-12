"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { useSession } from "../hooks/useSession";
import { Patient } from "../(pages)/(dashboard)/interfaces";
import { indexedDBService, OfflineSession } from "../utils/indexedDB";
import { Status, dashboardService } from "../kyClient/dashboard";
import toast from "react-hot-toast";

const isDubaiRegion = process.env.NEXT_PUBLIC_REGION === "dubai";

// Department mapping for offline sessions (key to label)
const departmentMapping: { [key: string]: string } = {
  "ED": "Emergency Department",
  "PC": "Primary Care", 
  "OPD": "Outpatient Department",
  "REVIEW": "Patient Review",
  "RADIOLOGY": "Radiology"
};

// Reverse mapping (label to key) for normalization
const departmentLabelToKey: { [key: string]: string } = {
  "Emergency Department": "ED",
  "Primary Care": "PC",
  "Outpatient Department": "OPD",
  "Patient Review": "REVIEW",
  "Radiology": "RADIOLOGY",
};

export const getDepartmentDisplayName = (department: string): string => {
  return departmentMapping[department] || department;
};

/**
 * Normalize department value to always use the key (e.g., "ED") instead of label
 */
const normalizeDepartmentKey = (department: string | undefined): string => {
  if (!department) return "ED";
  // If it's already a key, return it
  if (["ED", "PC", "OPD", "REVIEW", "RADIOLOGY"].includes(department)) {
    return department;
  }
  // Otherwise, try to map from label to key
  return departmentLabelToKey[department] || department;
};

interface SessionContextType {
  // Sessions data
  sessions: Patient[];
  sessionsLoading: boolean;
  sessionsError: string | null;
  fetchSessions: () => Promise<any>;
  // Refresh status of specific sessions by ID (used by sidebar polling so
  // that processing sessions on deeper pages still get their status updated
  // without a hard reload).
  refreshSessionsByIds: (ids: string[]) => Promise<void>;
  // Pagination
  loadMoreSessions: () => Promise<void>;
  hasMoreSessions: boolean;
  isLoadingMoreSessions: boolean;
  // Offline session management
  addOptimisticSession: (sessionData: {
    mrn: string;
    episode_id: string;
    department: string;
    language: string;
    recording: Blob;
    hospital_data?: any;
    sessionId?: string; // For updates: the existing session ID to update
    isUpdate?: boolean; // Whether this is an update to an existing session
  }) => Promise<string>;
  // Add newly created session immediately to UI
  addSessionImmediately: (sessionData: {
    id: number;
    mrn: string;
    episode_id?: string;
    department: string;
    language: string;
    hospital_data?: any;
  }) => void;
  // Update existing session status to Pending
  updateSessionStatusToPending: (sessionId: string) => void;
  // Shallow-merge fields into a specific session row (e.g., optimistic lock).
  patchSessionInPlace: (sessionId: string, partial: Partial<Patient>) => void;
  retryOfflineSession: (tempId: string) => Promise<void>;
  removeOfflineSession: (tempId: string) => void;
}

const SESSIONS_PAGE_SIZE = 10;

const transformSession = (session: any): Patient => {
  // Parse UTC date and convert to user's local timezone
  // If the date string doesn't have a timezone indicator, treat it as UTC
  let dateString = session.created_at;
  const hasTimezone =
    dateString.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(dateString);
  if (!hasTimezone) {
    dateString = dateString + "Z";
  }
  const utcDate = new Date(dateString);
  const localDateString = utcDate.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localTimeString = utcDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const normalizedDept = normalizeDepartmentKey(session.session_template);

  // Use display name from API – explicit keys first, then scan for any name-like field
  const explicitName = [
    session.patient_name,
    session.patientName,
    session.name,
    session.patient?.name,
    session.patient?.patient_name,
    session.details?.patient_name,
    session.details?.name,
    session.hospital_data?.patient_name,
    session.hospital_data?.name,
    session.hospital_data?.patientName,
    session.encounter_patient_name,
    session.patient_display_name,
    session.display_name,
    session.encounter_name,
    session.patient_full_name,
    session.patientFullName,
  ].find((v) => typeof v === "string" && v.trim() !== "");

  const isNameLike = (s: string) => {
    const t = s.trim();
    if (t.length === 0 || t === session.mrn || t === "Session " + session.mrn)
      return false;
    if (/^\d+$/.test(t)) return false;
    if (/^\d{4}-\d{2}-\d{2}/.test(t) || /^\d{2}\/\d{2}\/\d{2,4}/.test(t))
      return false;
    return true;
  };

  const skipKeys = new Set([
    "mrn",
    "id",
    "session_template",
    "language",
    "status",
    "created_at",
    "updated_at",
    "session_duration_seconds",
    "session_duration_minutes",
  ]);
  const scanForName = (
    obj: Record<string, unknown> | null | undefined,
  ): string | null => {
    if (!obj || typeof obj !== "object") return null;
    for (const [key, value] of Object.entries(obj)) {
      if (skipKeys.has(key)) continue;
      if (typeof value === "string" && isNameLike(value)) return value;
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        key.toLowerCase().includes("patient")
      ) {
        const nested = scanForName(value as Record<string, unknown>);
        if (nested) return nested;
      }
    }
    return null;
  };

  const displayName =
    explicitName ??
    scanForName(session as unknown as Record<string, unknown>) ??
    (session.hospital_data
      ? scanForName(session.hospital_data as Record<string, unknown>)
      : null) ??
    `Session ${session.mrn}`;

  return {
    id: session.id.toString(),
    mrn: session.mrn,
    ...(isDubaiRegion ? { episode_id: session.episode_id } : {}),
    department: normalizedDept,
    language: session.language,
    name: displayName,
    status: session.status,
    dateOfBirth: localDateString,
    date: localDateString,
    time: localTimeString,
    created_at: session.created_at,
    hospital_data: session.hospital_data,
    sessionDurationMinutes: session.session_duration_minutes,
    sessionDurationSeconds: session.session_duration_seconds,
    ehr_status: session.ehr_status ?? undefined,
    ehr_response: session.ehr_response ?? undefined,
  } as Patient;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Session state
  const [sessions, setSessions] = useState<Patient[]>([]);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false);
  const hasLoadedFirstPageRef = useRef(false);
  const loadingMoreRef = useRef(false);

  // Get the session hook functions and state
  const {
    // Sessions data and state
    sessionsError,
    sessionsLoading,
    getSessions,
    createSession,
    updateSession,
  } = useSession();

  // Fetch the first page. Merges into existing state so polling refreshes
  // statuses without truncating already-loaded later pages.
  const fetchSessions = useCallback(async () => {
    try {
      const response = await getSessions({
        limit: SESSIONS_PAGE_SIZE,
        offset: 0,
      });

      if (response) {
        const transformedSessions = (response.sessions ?? []).map(
          transformSession,
        );
        const isFirstLoad = !hasLoadedFirstPageRef.current;

        setSessions((prevSessions) => {
          const offlineSessions = prevSessions.filter((s) => s.isOffline);
          const existingServer = prevSessions.filter((s) => !s.isOffline);

          const byId = new Map(existingServer.map((s) => [s.id, s]));
          const updated: Patient[] = [];

          // Update existing rows in-place; prepend new rows at the top.
          for (const s of transformedSessions) {
            if (byId.has(s.id)) {
              byId.set(s.id, { ...byId.get(s.id), ...s });
            } else {
              updated.push(s);
            }
          }

          const merged = [
            ...updated,
            ...existingServer.map((s) => byId.get(s.id) as Patient),
          ];

          return [...offlineSessions, ...merged];
        });

        // Only adjust pagination flags on the very first load — later page-1
        // refreshes (polling) shouldn't shorten the known list.
        if (isFirstLoad) {
          hasLoadedFirstPageRef.current = true;
          setHasMoreSessions(response.pagination?.has_more ?? false);
        }

        return transformedSessions;
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      return [];
    }
  }, [getSessions]);

  const loadMoreSessions = useCallback(async () => {
    if (!hasMoreSessions || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMoreSessions(true);
    try {
      const offset = sessions.filter((s) => !s.isOffline).length;
      const response = await getSessions({
        limit: SESSIONS_PAGE_SIZE,
        offset,
      });

      const newSessions = response?.sessions ?? [];
      if (newSessions.length > 0) {
        const transformedSessions = newSessions.map(transformSession);
        setSessions((prevSessions) => {
          const existingIds = new Set(prevSessions.map((s) => s.id));
          const newOnes = transformedSessions.filter(
            (s) => !existingIds.has(s.id),
          );
          return [...prevSessions, ...newOnes];
        });
      }

      setHasMoreSessions(response?.pagination?.has_more ?? false);
    } catch (error) {
      console.error("Failed to load more sessions:", error);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMoreSessions(false);
    }
  }, [getSessions, sessions, hasMoreSessions]);

  // Refresh the latest server status for specific session IDs and merge into
  // local state in place. Used by the sidebar's "processing" poll so that a
  // session living on a deeper paginated page (e.g. offset 30+) still gets
  // its status updated — `fetchSessions` only fetches page 0 and would miss
  // it. We fetch each requested ID individually so cost scales with the
  // number of in-flight processing sessions, not the size of the loaded list.
  const refreshSessionsByIds = useCallback(async (ids: string[]) => {
    if (!ids || ids.length === 0) return;

    const numericIds = Array.from(
      new Set(
        ids
          .map((id) => Number(id))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );
    if (numericIds.length === 0) return;

    const results = await Promise.allSettled(
      numericIds.map((id) => dashboardService.getSession(id)),
    );

    const refreshed: Patient[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        try {
          refreshed.push(transformSession(result.value));
        } catch (err) {
          console.error("Failed to transform refreshed session:", err);
        }
      }
    }
    if (refreshed.length === 0) return;

    setSessions((prevSessions) => {
      const byId = new Map(prevSessions.map((s) => [s.id, s]));
      for (const r of refreshed) {
        const existing = byId.get(r.id);
        if (existing && !existing.isOffline) {
          byId.set(r.id, { ...existing, ...r });
        }
      }
      return prevSessions.map((s) =>
        s.isOffline ? s : (byId.get(s.id) as Patient),
      );
    });
  }, []);

  // Load offline sessions on mount
  useEffect(() => {
    const loadOfflineSessions = async () => {
      try {
        const offlineSessions = await indexedDBService.getOfflineSessions();
        const offlinePatients: Patient[] = offlineSessions.map(
          (offlineSession) => ({
            id: offlineSession.tempId,
            tempId: offlineSession.tempId,
            mrn: offlineSession.mrn,
            episode_id: offlineSession.episode_id,
            department: getDepartmentDisplayName(offlineSession.department),
            language: offlineSession.language,
            name: `Session ${offlineSession.mrn}`,
            status: Status.Pending,
            dateOfBirth: offlineSession.dateOfBirth,
            date: offlineSession.date,
            created_at: new Date(offlineSession.createdAt).toISOString(),
            hospital_data: offlineSession.hospital_data,
            isOffline: true,
            recording: offlineSession.recording,
            retryUpload: () => retryOfflineSession(offlineSession.tempId),
          }),
        );

        // Add offline sessions to the list
        setSessions((prevSessions) => {
          // Remove any existing offline sessions with the same tempId to avoid duplicates
          const filteredSessions = prevSessions.filter(
            (session) => !session.isOffline,
          );
          return [...offlinePatients, ...filteredSessions];
        });
      } catch (error) {
        console.error("Failed to load offline sessions:", error);
      }
    };

    loadOfflineSessions();
  }, []);

  // Effect to fetch sessions on mount
  React.useEffect(() => {
    fetchSessions();
  }, []); // Remove fetchSessions dependency to prevent infinite loops

  // Add optimistic session when offline
  const addOptimisticSession = useCallback(
    async (sessionData: {
      mrn: string;
      episode_id: string;
      department: string;
      language: string;
      recording: Blob;
      hospital_data?: any;
      sessionId?: string; // For updates: the existing session ID to update
      isUpdate?: boolean; // Whether this is an update to an existing session
    }) => {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      const currentDate = now.toLocaleDateString();
      const currentTime = now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const optimisticSession: Patient = {
        id: tempId,
        tempId,
        mrn: sessionData.mrn,
        episode_id: sessionData.episode_id,
        department: getDepartmentDisplayName(sessionData.department),
        language: sessionData.language,
        name: `Session ${sessionData.mrn}`,
        status: Status.Pending,
        dateOfBirth: currentDate,
        date: currentDate,
        time: currentTime,
        created_at: now.toISOString(),
        hospital_data: sessionData.hospital_data,
        isOffline: true,
        recording: sessionData.recording,
        retryUpload: () => retryOfflineSession(tempId),
      };

      // Add to UI immediately
      setSessions((prevSessions) => [optimisticSession, ...prevSessions]);
      
      // Get user email from localStorage
      let userEmail = '';
      try {
        if (typeof window !== 'undefined') {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            userEmail = user?.email || '';
          }
        }
      } catch (error) {
        console.error('Failed to get user email from localStorage:', error);
      }

      // Store in IndexedDB
      const offlineSession: OfflineSession = {
        id: tempId,
        tempId,
        mrn: sessionData.mrn,
        episode_id: sessionData.episode_id,
        department: sessionData.department,
        language: sessionData.language,
        name: `Session ${sessionData.mrn}`,
        status: Status.Pending,
        dateOfBirth: currentDate,
        date: currentDate,
        recording: sessionData.recording,
        hospital_data: sessionData.hospital_data,
        createdAt: Date.now(),
        sessionId: sessionData.sessionId,
        isUpdate: sessionData.isUpdate || false,
        userEmail, // Include user email for filtering
      };

      try {
        await indexedDBService.storeOfflineSession(offlineSession);
        toast.success("Session saved locally. Will upload when online.", {
          duration: 3000,
          position: "bottom-right",
        });
      } catch (error) {
        console.error("Failed to store offline session:", error);
        toast.error("Failed to save session locally", {
          duration: 3000,
          position: "bottom-right",
        });
      }

      return tempId;
    },
    [],
  );

  // Retry uploading offline session (EXACT SAME steps as online save)
  const retryOfflineSession = useCallback(
    async (tempId: string) => {
      try {
        const offlineSessions = await indexedDBService.getOfflineSessions();
        const offlineSession = offlineSessions.find(
          (session) => session.tempId === tempId,
        );

        if (!offlineSession) {
          toast.error("Offline session not found", {
            duration: 3000,
            position: "bottom-right",
          });
          return;
        }

        console.log(
          "Retrying offline session - doing EXACT same steps as online:",
          {
            size: offlineSession.recording.size,
            type: offlineSession.recording.type,
            tempId: tempId,
          },
        );

        // STEP 1: Encrypt the recording (SAME as online)
        const recordingFile = new File(
          [offlineSession.recording],
          `recording-${tempId}.webm`,
          {
            type: offlineSession.recording.type || "audio/webm",
          },
        );

        // Use CryptoJS to encrypt (SAME encryption as useAudioEncryption hook)
        const arrayBuffer = await new Promise<ArrayBuffer>(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(recordingFile);
          },
        );

        const CryptoJS = (await import("crypto-js")).default;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const secretKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
        if (!secretKey) {
          throw new Error("Encryption key is needed");
        }
        const key = CryptoJS.SHA256(secretKey);
        const iv = CryptoJS.enc.Hex.parse("00000000000000000000000000000000");
        const encrypted = CryptoJS.AES.encrypt(wordArray, key, { iv: iv });
        const encryptedData = encrypted.ciphertext.toString(
          CryptoJS.enc.Base64,
        );

        // STEP 2: Upload encrypted data (SAME as online)
        const now = new Date();
        const timestamp = now
          .toISOString()
          .replace(/[-:]/g, "")
          .replace("T", "-")
          .replace(/\..+/, "");
        const filename = `${offlineSession.mrn}-${timestamp}.enc`;

        const tempFile = new Blob([encryptedData], {
          type: "application/octet-stream",
        });
        const formData = new FormData();
        formData.append("file", tempFile, filename);

        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(
          /\/$/,
          "",
        );
        
        // Determine if this is an update or create
        const isUpdate = offlineSession.isUpdate && offlineSession.sessionId;
        const noteType = isUpdate ? "update_session" : "create_session";

        // For update sessions, include the session_id so the backend appends
        // to the existing session's audio.
        const uploadUrl = isUpdate
          ? `${baseUrl}/note/upload-file-to-s3/?note_type=${noteType}&session_id=${offlineSession.sessionId}`
          : `${baseUrl}/note/upload-file-to-s3/?note_type=${noteType}`;

        const uploadResponse = await fetch(
          uploadUrl,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
            body: formData,
          },
        );

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        const uploadData = await uploadResponse.json();
        const storageId = uploadData.note_id;

        // STEP 3: Create or Update session with transcription_status: Failed
        if (isUpdate && offlineSession.sessionId) {
          console.log(`📤 Updating existing session ${offlineSession.sessionId} with storage_id: ${storageId}`);
          
          const response = await updateSession(
            parseInt(offlineSession.sessionId),
            {
              storage_id: storageId,
              transcription_status: "Failed",
            },
          );

          if (!response) {
            throw new Error("Failed to update session - no response");
          }

          console.log("✅ Offline session updated successfully:", response);
        } else {
          const duration = Math.round((tempFile.size * 8) / 128000);
          console.log(`✅ Estimated offline duration: ${duration} seconds (${tempFile.size} bytes)`);

          const sessionData = {
            mrn: offlineSession.mrn,
            episode_id: offlineSession.episode_id,
            language: offlineSession.language,
            s3_key: storageId,
            session_template: offlineSession.department,
            hospital_data: offlineSession.hospital_data,
            session_duration_seconds: duration,
            transcription_status: "Failed" as const,
          };

          console.log('📤 Offline session creation data being sent:', sessionData);
          const response = await dashboardService.createRealtimeSession(sessionData);

          if (!response || !response.session_id) {
            throw new Error("Failed to create session - no response or missing ID");
          }

          console.log("✅ Offline session created successfully:", response);
        }

        // STEP 1: Clean up offline data from IndexedDB
        try {
          console.log(`Removing offline session from IndexedDB: ${tempId}`);
          await indexedDBService.removeOfflineSession(tempId);
          console.log("Successfully removed from IndexedDB");
        } catch (dbError) {
          console.error("Failed to remove from IndexedDB:", dbError);
          // Continue anyway - don't fail the whole operation
        }

        // STEP 2: Remove optimistic session from UI
        console.log(`Removing optimistic session from UI: ${tempId}`);
        setSessions((prevSessions) => {
          const filtered = prevSessions.filter(
            (session) => session.tempId !== tempId,
          );
          console.log(
            `UI sessions before: ${prevSessions.length}, after: ${filtered.length}`,
          );
          return filtered;
        });

        // STEP 3: Fetch updated session list (same as online flow)
        try {
          console.log("Fetching updated session list after retry...");
          const updatedSessions = await fetchSessions();
          console.log(
            `Successfully fetched ${updatedSessions?.length || 0} updated sessions`,
          );
        } catch (fetchError) {
          console.error("Failed to fetch sessions:", fetchError);
          // Don't fail the whole operation if fetch fails
        }

        toast.success("Session uploaded successfully!", {
          duration: 3000,
          position: "bottom-right",
        });
      } catch (error) {
        console.error("Failed to retry offline session:", error);
        toast.error("Failed to upload session. Please try again.", {
          duration: 3000,
          position: "bottom-right",
        });
      }
    },
    [createSession, updateSession, fetchSessions],
  );

  // Remove offline session
  const removeOfflineSession = useCallback(async (tempId: string) => {
    try {
      // Remove from UI
      setSessions((prevSessions) =>
        prevSessions.filter((session) => session.tempId !== tempId),
      );

      // Remove from IndexedDB
      await indexedDBService.removeOfflineSession(tempId);

      toast.success("Offline session removed", {
        duration: 2000,
        position: "bottom-right",
      });
    } catch (error) {
      console.error("Failed to remove offline session:", error);
      toast.error("Failed to remove session", {
        duration: 3000,
        position: "bottom-right",
      });
    }
  }, []);

  // Add newly created session immediately to UI with Pending status
  const addSessionImmediately = useCallback(
    (sessionData: {
      id: number;
      mrn: string;
      episode_id?: string;
      department: string;
      language: string;
      hospital_data?: any;
    }) => {
      // Format date as DD/MM/YY to match the expected format
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const currentDate = `${day}/${month}/${year}`;
      const currentTime = now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const newSession: Patient = {
        id: sessionData.id.toString(),
        mrn: sessionData.mrn,
        episode_id: sessionData.episode_id,
        department: normalizeDepartmentKey(sessionData.department),
        language: sessionData.language,
        name: `Session ${sessionData.mrn}`,
        status: Status.Pending,
        dateOfBirth: currentDate,
        date: currentDate,
        time: currentTime,
        hospital_data: sessionData.hospital_data,
      };

      // Add to UI immediately at the beginning of the list
      setSessions((prevSessions) => {
        // Check if session already exists (avoid duplicates)
        const exists = prevSessions.some(
          (session) => session.id === newSession.id && !session.isOffline
        );
        if (exists) {
          return prevSessions;
        }
        return [newSession, ...prevSessions];
      });
    },
    [],
  );

  // Update existing session status to Pending (for when additional note is added)
  const updateSessionStatusToPending = useCallback((sessionId: string) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.id === sessionId && !session.isOffline
          ? { ...session, status: Status.Pending }
          : session
      )
    );
  }, []);

  const patchSessionInPlace = useCallback(
    (sessionId: string, partial: Partial<Patient>) => {
      setSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === sessionId ? { ...session, ...partial } : session,
        ),
      );
    },
    [],
  );

  const value = {
    // Sessions data
    sessions,
    sessionsLoading,
    sessionsError,
    fetchSessions,
    refreshSessionsByIds,
    // Pagination
    loadMoreSessions,
    hasMoreSessions,
    isLoadingMoreSessions,
    // Offline session management
    addOptimisticSession,
    addSessionImmediately,
    updateSessionStatusToPending,
    patchSessionInPlace,
    retryOfflineSession,
    removeOfflineSession,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
};

export const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
};
