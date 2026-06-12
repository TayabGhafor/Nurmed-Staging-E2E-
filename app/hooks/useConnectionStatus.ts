"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser network connectivity via the `online`/`offline` events.
 *
 * This is the fastest, most reliable signal we have for "the internet dropped":
 * the Soniox realtime WebSocket can take tens of seconds (TCP timeout) to notice
 * a dead connection, during which transcription silently freezes with no error.
 * `navigator.onLine` flips immediately when the OS loses its network interface,
 * letting us alert the doctor right away instead of leaving a frozen transcript.
 *
 * Caveat: `navigator.onLine` reflects interface presence, not true reachability,
 * so a flaky-but-connected link may stay `true`. That case is covered separately
 * by the Soniox `error` callback once its socket eventually fails.
 */
export function useConnectionStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync once on mount in case connectivity changed before listeners attached.
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
