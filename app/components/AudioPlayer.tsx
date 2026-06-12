"use client";

import { useState, useEffect, useRef } from "react";
import { useAudioDecryption } from "../hooks/useAudioDecryption";
import AudioPlayerSkeleton from "./AudioPlayerSkeleton";

type AudioPlayerProps = {
  audioFileUrl: string;
  audioDuration?: string;
  // When true, suppress the skeleton loader and render nothing while loading
  hideSkeleton?: boolean;
};

export default function AudioPlayer({
  audioFileUrl,
  audioDuration,
  hideSkeleton = false,
}: AudioPlayerProps) {
  const [playing, setPlaying] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    decryptedAudioUrl,
    isDecrypting,
    decryptionError,
    decryptAudio,
    setAudioBlob,
    setAudioUrl,
  } = useAudioDecryption();

  // Prefer duration coming from props (if valid), fall back to audio metadata
  useEffect(() => {
    if (!audioDuration) return;
    const parsed = Number(audioDuration);
    if (Number.isFinite(parsed) && parsed > 0) {
      setDuration(parsed);
    }
  }, [audioDuration]);

  const progressPercent =
    Number.isFinite(duration) &&
    duration > 0 &&
    Number.isFinite(currentTime) &&
    currentTime >= 0
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    return new Date(seconds * 1000).toISOString().substring(14, 19);
  };

  // Function to handle time change (forward/backward)
  const handleTimeChange = (seconds: number) => {
    if (audioRef.current) {
      const next =
        Number.isFinite(currentTime) && currentTime >= 0
          ? currentTime + seconds
          : 0;
      const clamped = Math.min(
        duration || Number.POSITIVE_INFINITY,
        Math.max(0, next),
      );
      audioRef.current.currentTime = clamped;
      setCurrentTime(clamped);
    }
  };

  const handleSeek = (value: number) => {
    if (audioRef.current) {
      const clamped = Math.min(
        duration || Number.POSITIVE_INFINITY,
        Math.max(0, value),
      );
      audioRef.current.currentTime = clamped;
      setCurrentTime(clamped);
    }
  };

  // Fetch and decrypt the audio file when component mounts
  // Using an empty dependency array to ensure this only runs once
  useEffect(() => {
    let isMounted = true;

    const fetchAndDecryptAudio = async () => {
      if (!audioFileUrl) return;

      try {
        setLoading(true);
        const response = await fetch(audioFileUrl);

        if (!response.ok) {
          if (response.status === 403) {
            // Clear all cookies (using js-cookie) and localStorage, then redirect
            if (typeof window !== "undefined") {
              // Remove known cookies
              const cookiesToRemove = [
                "access_token",
                "user",
                "refresh_token",
                "password_updated",
                "reset_password",
                "locked",
              ];
              cookiesToRemove.forEach((cookie) => {
                if (window.Cookies) window.Cookies.remove(cookie);
              });
              localStorage.clear();
              window.location.href = "/login";
            }
            return null;
          }
          throw new Error(
            `Failed to fetch audio: ${response.status} ${response.statusText}`,
          );
        }

        // Convert the response to a Blob, then to a File
        const blob = await response.blob();
        const contentType = response.headers.get("content-type") || "";

        const urlPath = (() => {
          try {
            return new URL(audioFileUrl).pathname.toLowerCase();
          } catch {
            return audioFileUrl.toLowerCase();
          }
        })();

        const looksEncrypted =
          urlPath.endsWith(".enc") ||
          urlPath.endsWith(".b64") ||
          contentType.includes("text/plain") ||
          contentType.includes("application/base64") ||
          contentType.includes("application/octet-stream");

        const looksLikePlayableAudio =
          urlPath.endsWith(".webm") ||
          urlPath.endsWith(".mp3") ||
          urlPath.endsWith(".wav") ||
          urlPath.endsWith(".ogg") ||
          contentType.startsWith("audio/") ||
          contentType.includes("webm");

        // Only proceed if component is still mounted
        if (isMounted) {
          if (looksEncrypted && !looksLikePlayableAudio) {
            const file = new File([blob], "encrypted-audio.enc", {
              type: "application/octet-stream",
            });
            await decryptAudio(file);
          } else {
            // Normal audio (e.g. .webm) — skip decryption, just play it
            setAudioBlob(blob, contentType || "audio/webm");
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Error fetching audio:", err);
          setLoading(false);
        }
      }
    };

    fetchAndDecryptAudio();

    // Cleanup function to prevent state updates if component unmounts
    return () => {
      isMounted = false;
      setAudioUrl(null);
    };
  }, [audioFileUrl]);

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.play().catch((err) => {
          console.error("Error playing audio:", err);
          setPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [playing]);

  if (loading || isDecrypting) {
    // Allow callers (e.g. header buttons) to opt out of showing the skeleton
    if (hideSkeleton) {
      return null;
    }
    return <AudioPlayerSkeleton />;
  }

  if (decryptionError) {
    return (
      <div className="p-4 text-center text-red-500">Error loading audio</div>
    );
  }

  return (
    <>
      {decryptedAudioUrl && (
        <>
          <audio
            ref={audioRef}
            src={decryptedAudioUrl}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                // If duration not supplied via props, derive from metadata
                if (!audioDuration) {
                  const metaDuration = audioRef.current.duration;
                  if (Number.isFinite(metaDuration) && metaDuration > 0) {
                    setDuration(metaDuration);
                  } else {
                    setDuration(0);
                  }
                }
              }
            }}
            onTimeUpdate={() => {
              if (audioRef.current) {
                const t = audioRef.current.currentTime;
                if (Number.isFinite(t) && t >= 0) {
                  setCurrentTime(t);
                }
              }
            }}
            onEnded={() => {
              setPlaying(false);
              setCurrentTime(0);
            }}
            className="hidden"
          />

          <div className="p-4">
            <div className="mx-auto max-w-2xl">
              {/* Control buttons on top */}
              <div className="mb-2 flex items-center justify-center gap-8">
                {/* Previous/Rewind button */}
                <button
                onClick={() => handleTimeChange(-10)}
                className="flex h-10 min-h-8 w-10 min-w-8 items-center justify-center text-[#2174FD] transition-colors duration-200 hover:text-[#1a5fd3]"
              >
                <img
                  src="/images/reverse.svg"
                  alt="back"
                  className="h-10 w-10"
                />
              </button>

                {/* Play/Pause button */}
                <button
                onClick={() => setPlaying(!playing)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2F81FF] text-white transition-colors duration-200 hover:bg-[#1a5fd3]"
              >
                {playing ? (
                  <svg
                    className="h-14 w-14"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10 9H8V15H10V9Z" fill="currentColor" />
                    <path d="M16 9H14V15H16V9Z" fill="currentColor" />
                  </svg>
                ) : (
                  <svg
                    className="h-14 w-14"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M16 12L10 16V8L16 12Z" fill="currentColor" />
                  </svg>
                )}
              </button>

                {/* Next/Forward button */}
                <button
                onClick={() => handleTimeChange(10)}
                className="flex h-10 min-h-8 w-10 min-w-8 items-center justify-center text-[#2174FD] transition-colors duration-200 hover:text-[#1a5fd3]"
              >
                <img src="/images/forward.svg" alt="back" className="h-8 w-8" />
              </button>
              </div>

              {/* Progress bar section at bottom */}
              <div>
                <div className="relative">
                  <div className="group relative h-6 w-full cursor-pointer">
                    {/* Background track */}
                    <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-gray-300">
                      {/* Progress fill */}
                      <div
                        className="h-1.5 rounded-full bg-[#2174FD] transition-all duration-100"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* Seek thumb - always visible */}
                    <div
                      className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2174FD] shadow-lg transition-transform duration-200 group-hover:scale-125"
                      style={{ left: `${progressPercent}%` }}
                    />

                    {/* Invisible full-height input for better UX */}
                    <input
                      type="range"
                      min={0}
                      max={
                        Number.isFinite(duration) && duration > 0
                          ? duration
                          : 0
                      }
                      step={0.1}
                      value={
                        Number.isFinite(currentTime) && currentTime >= 0
                          ? currentTime
                          : 0
                      }
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="absolute inset-0 w-full cursor-pointer opacity-0"
                      disabled={!Number.isFinite(duration) || duration <= 0}
                      aria-label="Seek audio"
                    />
                  </div>
                </div>

                {/* Time display below progress bar */}
                <div className=" flex justify-between px-1">
                  <span className="text-xs font-medium text-gray-600 tabular-nums">
                    {formatTime(currentTime)}
                  </span>
                  <span className="text-xs font-medium text-gray-600 tabular-nums">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}