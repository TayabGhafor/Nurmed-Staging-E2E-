"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useMicrophone } from "../contexts/MicrophoneContext";

const BAR_COUNT = 9;
// Symmetric bell shape — shorter at the edges, taller in the middle.
// Keeps the silhouette of a waveform readable even at low audio levels.
const BAR_SHAPE = [0.45, 0.6, 0.78, 0.92, 1, 0.92, 0.78, 0.6, 0.45];

function MicWaveformBars({
  bars,
  state,
  responsive = false,
}: {
  bars: number[];
  state: "active" | "idle" | "alert";
  /** When true, hide on mobile to keep the topbar from overflowing. */
  responsive?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const color =
    state === "active"
      ? "bg-green-500"
      : state === "alert"
        ? "bg-red-500"
        : "bg-slate-400";

  // Idle/alert states render the static silhouette so the glyph reads as a
  // waveform even before any audio is captured.
  const floor = state === "active" ? 0.14 : 0.22;
  const cap = state === "active" ? 1 : 0.7;

  return (
    <span
      className={`pointer-events-none ${
        responsive ? "hidden sm:inline-flex" : "inline-flex"
      } h-4 items-center gap-[1.5px]`}
      aria-hidden
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const raw = bars[i] ?? 0;
        const normalized = Math.max(floor, Math.min(cap, raw));
        const heightPct = Math.round(normalized * 100);
        return (
          <motion.span
            key={i}
            className={`block w-[1.5px] rounded-full ${color}`}
            initial={false}
            animate={{
              height: reduceMotion ? `${BAR_SHAPE[i] * 70}%` : `${heightPct}%`,
            }}
            transition={{ duration: 0.09, ease: [0.45, 0, 0.55, 1] }}
          />
        );
      })}
    </span>
  );
}

export default function MicrophoneStatusIndicator() {
  const reduceMotion = useReducedMotion();
  const {
    permission,
    audioDevices,
    selectedDeviceId,
    loadingDevices,
    accessError,
    isMicReady,
    requestAccess,
    selectDevice,
  } = useMicrophone();

  const [bars, setBars] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [menuOpen, setMenuOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Each bar carries its own slowly drifting jitter so the row "breathes"
  // instead of all bars rising and falling in perfect lockstep.
  const jitterRef = useRef<number[]>(
    new Array(BAR_COUNT).fill(0).map(() => 0.85 + Math.random() * 0.3),
  );
  const lastTickRef = useRef<number>(0);

  const stopMicMonitor = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setBars(new Array(BAR_COUNT).fill(0));
  }, []);

  const startMicMonitorWithDevice = useCallback(
    async (deviceId: string) => {
      if (!deviceId) return;
      stopMicMonitor();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
        });
        micStreamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Throttle to ~16fps so each Framer transition (~90ms) lands cleanly;
        // updating every RAF frame makes the bars look jittery rather than fluid.
        const FRAME_MS = 60;

        const tick = (now: number) => {
          if (!analyserRef.current) {
            animationFrameRef.current = requestAnimationFrame(tick);
            return;
          }
          if (now - lastTickRef.current < FRAME_MS) {
            animationFrameRef.current = requestAnimationFrame(tick);
            return;
          }
          lastTickRef.current = now;

          analyserRef.current.getByteFrequencyData(dataArray);
          // Average the speech-rich band (~150Hz – 5.6kHz with default 48kHz).
          let sum = 0;
          const start = 1;
          const end = Math.min(30, dataArray.length);
          for (let i = start; i < end; i++) sum += dataArray[i];
          const avg = sum / Math.max(1, end - start);
          // Lift so normal speech reaches ~0.7–1.0 and quiet sounds still move.
          const level = Math.min(1, (avg / 140) * 1.3);

          // Slowly drift each bar's jitter toward a new random target — this
          // gives organic variation without the per-frame noise look.
          const next = new Array(BAR_COUNT);
          for (let i = 0; i < BAR_COUNT; i++) {
            const target = 0.75 + Math.random() * 0.5;
            jitterRef.current[i] = jitterRef.current[i] * 0.78 + target * 0.22;
            next[i] = Math.min(1, level * BAR_SHAPE[i] * jitterRef.current[i]);
          }
          setBars(next);

          animationFrameRef.current = requestAnimationFrame(tick);
        };

        animationFrameRef.current = requestAnimationFrame(tick);
      } catch {
        // Non-fatal: the context exposes accessError for the user message.
      }
    },
    [stopMicMonitor],
  );

  useEffect(() => {
    if (permission !== "granted" || !selectedDeviceId) {
      stopMicMonitor();
      return;
    }
    startMicMonitorWithDevice(selectedDeviceId);
    return () => stopMicMonitor();
  }, [permission, selectedDeviceId, startMicMonitorWithDevice, stopMicMonitor]);

  useEffect(() => () => stopMicMonitor(), [stopMicMonitor]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const selectedDeviceLabel = useMemo(() => {
    const idx = audioDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    if (idx >= 0) return audioDevices[idx].label || `Microphone ${idx + 1}`;
    return "";
  }, [audioDevices, selectedDeviceId]);

  const needsAttention =
    permission === "denied" ||
    permission === "prompt" ||
    (permission === "granted" && Boolean(accessError)) ||
    (permission === "granted" && audioDevices.length === 0);

  // Average bar height above this threshold counts as "speaking" — used to
  // pick the active vs. idle tint without flicker.
  const barAvg = bars.reduce((s, v) => s + v, 0) / bars.length;
  const receiving = isMicReady && barAvg > 0.12;

  const barState: "active" | "idle" | "alert" = needsAttention
    ? "alert"
    : receiving
      ? "active"
      : "idle";

  const titleText = needsAttention
    ? permission === "denied"
      ? "Microphone blocked — click to manage"
      : permission === "prompt"
        ? "Microphone access needed — click to enable"
        : audioDevices.length === 0
          ? "No microphone detected — click for details"
          : accessError ?? "Microphone needs attention"
    : selectedDeviceLabel
      ? `Microphone: ${selectedDeviceLabel}`
      : "Microphone";

  const triggerButtonClass = needsAttention
    ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-500"
    : "border border-transparent bg-blue-50 text-[#2832AB] hover:bg-blue-100 focus-visible:ring-[#2832A8]";

  const pulseAttention = needsAttention && !reduceMotion;
  const Icon = permission === "denied" ? MicOff : Mic;

  // Static waveform silhouette shown when the mic needs attention.
  const alertBars = useMemo(() => BAR_SHAPE.map((s) => s * 0.7), []);
  const displayBars = needsAttention ? alertBars : bars;

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <motion.button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md px-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${triggerButtonClass}`}
        title={titleText}
        aria-label={titleText}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        animate={
          pulseAttention
            ? { scale: [1, 1.04], opacity: [1, 0.9] }
            : { scale: 1, opacity: 1 }
        }
        transition={
          pulseAttention
            ? {
                duration: 2.2,
                repeat: Infinity,
                repeatType: "mirror",
                ease: [0.45, 0, 0.55, 1],
              }
            : { duration: 0.25, ease: [0.45, 0, 0.55, 1] }
        }
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        <MicWaveformBars bars={displayBars} state={barState} responsive />
      </motion.button>

      {menuOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-[60] w-72 max-w-[min(18rem,calc(100vw-0.75rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
          role="dialog"
          aria-label="Microphone"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Microphone
          </p>

          {permission !== "granted" ? (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50/90 p-3">
              <p className="text-sm font-semibold text-red-900">
                {permission === "denied"
                  ? "Microphone access is blocked"
                  : "Microphone access is off"}
              </p>
              <p className="text-sm text-red-800/90">
                Enable the microphone to see input level and choose a device for
                recordings.
              </p>
              <button
                type="button"
                onClick={requestAccess}
                className="w-full rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              >
                Enable microphone
              </button>
              {accessError ? (
                <p className="text-xs font-medium text-red-700">{accessError}</p>
              ) : null}
            </div>
          ) : loadingDevices ? (
            <div className="flex items-center gap-2 py-2 text-sm text-slate-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2832A8] border-t-transparent" />
              Loading devices…
            </div>
          ) : audioDevices.length === 0 ? (
            <p className="text-sm text-amber-800">No microphones detected.</p>
          ) : (
            <>
              <p className="mb-1.5 text-xs text-slate-500">Input device</p>
              <ul
                className="max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/80 py-1"
                role="listbox"
                aria-label="Microphone devices"
              >
                {audioDevices.map((device, index) => {
                  const label = device.label || `Microphone ${index + 1}`;
                  const selected = device.deviceId === selectedDeviceId;
                  return (
                    <li key={device.deviceId}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                          selected
                            ? "bg-slate-200 font-medium text-slate-900"
                            : "text-slate-700 hover:bg-white"
                        }`}
                        onClick={() => {
                          selectDevice(device.deviceId);
                          setMenuOpen(false);
                        }}
                      >
                        {label}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <MicWaveformBars
                  bars={bars}
                  state={receiving ? "active" : "idle"}
                />
                <p className="min-w-0 flex-1 text-right text-xs text-slate-600">
                  {accessError
                    ? accessError
                    : receiving
                      ? "Receiving audio"
                      : "Speak to test"}
                </p>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
