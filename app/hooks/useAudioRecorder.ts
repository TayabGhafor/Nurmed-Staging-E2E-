"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordedAudioFile, setRecordedAudioFile] = useState<File | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState<string>("00:00:00");
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef<number>(0);
  const startingRef = useRef(false);
  const onDataAvailableCallbackRef = useRef<((data: Blob) => void) | null>(
    null,
  );

  // Format time in MM:SS:MS format (only two digits for milliseconds)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 100); // Only take first two digits of ms

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${milliseconds.toString().padStart(2, "0")}`;
  };

  // Add effect to handle the timer with higher precision
  useEffect(() => {
    if (isRecording && !isPaused) {
      // Set the start time when recording begins or resumes
      startTimeRef.current = Date.now();

      // Update recording time every animation frame for smooth display
      const updateTimer = () => {
        if (startTimeRef.current) {
          const currentElapsed = (Date.now() - startTimeRef.current) / 1000;
          const totalElapsed = accumulatedTimeRef.current + currentElapsed;
          setRecordingTime(formatTime(totalElapsed));
          setRecordingDurationSeconds(totalElapsed);
        }
        timerRef.current = requestAnimationFrame(updateTimer);
      };

      timerRef.current = requestAnimationFrame(updateTimer);
    } else {
      // Clear timer when not recording or paused
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
        timerRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const startRecording = useCallback(async (audioInputDeviceId?: string) => {
    if (startingRef.current) return;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      return;
    }
    startingRef.current = true;

    setRecordingError(null);
    chunksRef.current = [];
    setRecordingTime("00:00:00");
    accumulatedTimeRef.current = 0;
    setIsPaused(false);

    try {
      const audioConstraints: boolean | MediaTrackConstraints =
        audioInputDeviceId && audioInputDeviceId.length > 0
          ? { deviceId: { exact: audioInputDeviceId } }
          : true;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      if (!startingRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          onDataAvailableCallbackRef.current?.(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioPreviewUrl) {
          URL.revokeObjectURL(audioPreviewUrl);
        }

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        const audioFile = new File([audioBlob], "recording.webm", {
          type: "audio/webm",
          lastModified: Date.now(),
        });

        setRecordedAudioFile(audioFile);

        const url = URL.createObjectURL(audioBlob);
        setAudioPreviewUrl(url);
      };

      mediaRecorder.start(500);
      setIsRecording(true);
    } catch (error) {
      setRecordingError(
        `Recording failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      startingRef.current = false;
    }
  }, [audioPreviewUrl]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      // Only pause if we are currently recording and not already paused
      try {
        mediaRecorderRef.current.pause();
        setIsPaused(true);

        // Update accumulated time
        if (startTimeRef.current) {
          const currentElapsed = (Date.now() - startTimeRef.current) / 1000;
          accumulatedTimeRef.current += currentElapsed;
        }
      } catch (error) {
        console.error("Error pausing recording:", error);
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      // Only resume if we are currently paused
      try {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        // Reset start time for new interval timing
        startTimeRef.current = Date.now();
      } catch (error) {
        console.error("Error resuming recording:", error);
      }
    }
  }, [isRecording, isPaused]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        // If paused, resume first to ensure we can stop properly
        if (isPaused && mediaRecorderRef.current.state === "paused") {
          mediaRecorderRef.current.resume();
        }

        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setIsPaused(false);

        // Final update to recording time to ensure accuracy
        if (startTimeRef.current && !isPaused) {
          const currentElapsed = (Date.now() - startTimeRef.current) / 1000;
          const totalElapsed = accumulatedTimeRef.current + currentElapsed;
          setRecordingTime(formatTime(totalElapsed));
          setRecordingDurationSeconds(totalElapsed);
        }
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    }
  }, [isRecording, isPaused]);

  // New reset function to clear the state
  const resetRecording = useCallback(() => {
    // Stop recording if it's in progress
    if (isRecording) {
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch (error) {
          console.error("Error stopping recorder during reset:", error);
        }
      }

      // Stop and release the media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    // Clear timer
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }

    // Revoke object URL to prevent memory leaks
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }

    setIsRecording(false);
    setIsPaused(false);
    setRecordedAudioFile(null);
    setRecordingError(null);
    setAudioPreviewUrl(null);
    setRecordingTime("00:00:00");
    setRecordingDurationSeconds(0);
    chunksRef.current = [];
    accumulatedTimeRef.current = 0;
    startTimeRef.current = null;
    startingRef.current = false;
    mediaRecorderRef.current = null;
  }, [isRecording, audioPreviewUrl]);

  const setOnDataAvailable = useCallback(
    (callback: ((data: Blob) => void) | null) => {
      onDataAvailableCallbackRef.current = callback;
    },
    [],
  );

  useEffect(() => {
    return () => {
      // Cleanup function
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [audioPreviewUrl]);

  return {
    isRecording,
    isPaused,
    recordedAudioFile,
    recordingError,
    audioPreviewUrl,
    recordingTime,
    recordingDurationSeconds,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    setOnDataAvailable,
  };
};
