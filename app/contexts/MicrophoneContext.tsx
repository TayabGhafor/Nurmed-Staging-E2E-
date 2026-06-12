"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getPreferredMicDeviceId,
  setPreferredMicDeviceId,
} from "../utils/mic-preference";

export type MicPermission =
  | "checking"
  | "granted"
  | "denied"
  | "prompt"
  | "error";

interface MicrophoneContextType {
  permission: MicPermission;
  audioDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  loadingDevices: boolean;
  accessError: string | null;
  isMicReady: boolean;
  micGateMessage: string;
  requestAccess: () => Promise<void>;
  selectDevice: (deviceId: string) => void;
  refreshPermission: () => Promise<void>;
}

const MicrophoneContext = createContext<MicrophoneContextType | undefined>(
  undefined,
);

async function probePermission(): Promise<
  "granted" | "denied" | "prompt" | "error"
> {
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      return status.state as "granted" | "denied" | "prompt";
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch {
    return "error";
  }
}

export function MicrophoneProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<MicPermission>("checking");
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Avoids races when permission flips quickly (e.g. user toggles in browser UI).
  const permStatusRef = useRef<PermissionStatus | null>(null);

  const enumerateAudioInputs = useCallback(async () => {
    setLoadingDevices(true);
    setAccessError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      setAudioDevices(audioInputs);

      const stored = getPreferredMicDeviceId();
      setSelectedDeviceId((prev) => {
        const pick =
          (stored && audioInputs.some((d) => d.deviceId === stored)
            ? stored
            : null) ||
          (prev && audioInputs.some((d) => d.deviceId === prev) ? prev : null) ||
          audioInputs[0]?.deviceId ||
          "";
        if (pick) setPreferredMicDeviceId(pick);
        return pick;
      });
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err.name === "NotAllowedError") setAccessError("Microphone blocked");
      else if (err.name === "NotFoundError") setAccessError("No microphone");
      else setAccessError("Mic unavailable");
      setAudioDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const refreshPermission = useCallback(async () => {
    const p = await probePermission();
    if (p === "granted") setPermission("granted");
    else if (p === "denied") setPermission("denied");
    else if (p === "error") setPermission("prompt");
    else setPermission(p);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const apply = (state: PermissionState) => {
      if (cancelled) return;
      if (state === "granted") setPermission("granted");
      else if (state === "denied") setPermission("denied");
      else setPermission("prompt");
    };

    (async () => {
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({
            name: "microphone" as PermissionName,
          });
          if (cancelled) return;
          permStatusRef.current = status;
          apply(status.state);
          status.onchange = () => apply(status.state);
        } else {
          const p = await probePermission();
          if (!cancelled) setPermission(p === "error" ? "prompt" : p);
        }
      } catch {
        if (!cancelled) setPermission("prompt");
      }
    })();

    return () => {
      cancelled = true;
      if (permStatusRef.current) permStatusRef.current.onchange = null;
    };
  }, []);

  useEffect(() => {
    if (permission !== "granted") {
      setAudioDevices([]);
      return;
    }
    enumerateAudioInputs();
  }, [permission, enumerateAudioInputs]);

  useEffect(() => {
    const onChange = () => {
      if (permission === "granted") enumerateAudioInputs();
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () =>
      navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
  }, [permission, enumerateAudioInputs]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") refreshPermission();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshPermission]);

  const requestAccess = useCallback(async () => {
    setAccessError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermission("granted");
    } catch {
      setPermission("denied");
      setAccessError("Access denied");
    }
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    if (!deviceId) return;
    setSelectedDeviceId(deviceId);
    setPreferredMicDeviceId(deviceId);
  }, []);

  const isMicReady =
    permission === "granted" && !accessError && audioDevices.length > 0;

  const micGateMessage = useMemo(() => {
    if (permission === "checking") return "Checking microphone access…";
    if (permission === "denied")
      return "Microphone access is blocked. Please enable it in your browser settings to start a recording.";
    if (permission === "prompt")
      return "Please enable microphone access in your browser to start a recording.";
    if (accessError) return `${accessError}. Please check your microphone.`;
    if (audioDevices.length === 0)
      return "No microphone detected. Please connect a microphone to start a recording.";
    return "";
  }, [permission, accessError, audioDevices.length]);

  const value = useMemo<MicrophoneContextType>(
    () => ({
      permission,
      audioDevices,
      selectedDeviceId,
      loadingDevices,
      accessError,
      isMicReady,
      micGateMessage,
      requestAccess,
      selectDevice,
      refreshPermission,
    }),
    [
      permission,
      audioDevices,
      selectedDeviceId,
      loadingDevices,
      accessError,
      isMicReady,
      micGateMessage,
      requestAccess,
      selectDevice,
      refreshPermission,
    ],
  );

  return (
    <MicrophoneContext.Provider value={value}>
      {children}
    </MicrophoneContext.Provider>
  );
}

export function useMicrophone(): MicrophoneContextType {
  const ctx = useContext(MicrophoneContext);
  if (!ctx)
    throw new Error("useMicrophone must be used within a MicrophoneProvider");
  return ctx;
}
