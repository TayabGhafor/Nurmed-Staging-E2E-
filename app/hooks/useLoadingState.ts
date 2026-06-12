"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

export type LoadingStateKey =
  | "sessions"
  | "notes"
  | "transcription"
  | "diagnosisCodes"
  | "aiCopilot"
  | "finalNoteUrl"
  | "session";

export function useLoadingState(
  initialState: Partial<Record<LoadingStateKey, boolean>> = {},
) {
  const [loadingState, setLoadingState] = useState<
    Record<LoadingStateKey, boolean>
  >({
    sessions: false,
    notes: false,
    transcription: false,
    diagnosisCodes: false,
    aiCopilot: false,
    finalNoteUrl: false,
    session: false,
    ...initialState,
  });

  const setLoading = useCallback((key: LoadingStateKey, isLoading: boolean) => {
    setLoadingState((prev) => ({
      ...prev,
      [key]: isLoading,
    }));
  }, []);

  const isAnyLoading = useMemo(
    () => Object.values(loadingState).some(Boolean),
    [loadingState],
  );

  return {
    loadingState,
    setLoading,
    isAnyLoading,
  };
}
