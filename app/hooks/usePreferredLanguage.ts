import { useCallback, useSyncExternalStore } from "react";
import { dashboardService } from "../kyClient/dashboard";
import { useAuth } from "../contexts/AuthContext";

interface CacheState {
  data: string | null;
  loading: boolean;
  error: string | null;
  loadedFor: number | null;
}

const initialState: CacheState = {
  data: null,
  loading: false,
  error: null,
  loadedFor: null,
};

let cache: CacheState = initialState;
let inFlight: Promise<any> | null = null;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getSnapshot = () => cache;

const setCache = (next: CacheState) => {
  cache = next;
  listeners.forEach((cb) => cb());
};

export function usePreferredLanguage() {
  const { user } = useAuth();
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const getPreferredLanguage = useCallback(
    async (force = false) => {
      const hospitalId = user?.hospital_id ?? 0;

      if (!force && cache.loadedFor === hospitalId && !cache.loading) {
        return cache.data;
      }
      if (inFlight) {
        return inFlight;
      }

      setCache({ ...cache, loading: true, error: null });
      inFlight = dashboardService
        .getPreferredLanguage()
        .then((response) => {
          setCache({
            data: response ?? null,
            loading: false,
            error: null,
            loadedFor: hospitalId,
          });
          return response;
        })
        .catch((err: any) => {
          setCache({
            data: null,
            loading: false,
            error: err.message || "Failed to fetch preferred language",
            loadedFor: null,
          });
          return null;
        })
        .finally(() => {
          inFlight = null;
        });

      return inFlight;
    },
    [user?.hospital_id],
  );

  return {
    preferredLanguage: state.data,
    preferredLanguageLoading: state.loading,
    preferredLanguageError: state.error,
    getPreferredLanguage,
  };
}
