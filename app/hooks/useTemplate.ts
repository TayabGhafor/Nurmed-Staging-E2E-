import { useCallback, useSyncExternalStore } from "react";
import { dashboardService } from "../kyClient/dashboard";
import { useAuth } from "../contexts/AuthContext";

interface Template {
  id: number;
  code: string;
  name: string;
}

interface CacheState {
  data: Template[];
  loading: boolean;
  error: string | null;
  loadedFor: number | null;
}

const initialState: CacheState = {
  data: [],
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

export function useTemplates() {
  const { user } = useAuth();
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const getTemplates = useCallback(
    async (force = false) => {
      const hospitalId = user?.hospital_id ?? 0;

      if (!force && cache.loadedFor === hospitalId && !cache.loading) {
        return { templates: cache.data };
      }
      if (inFlight) {
        return inFlight;
      }

      setCache({ ...cache, loading: true, error: null });
      inFlight = dashboardService
        .getHospitalTemplates(hospitalId)
        .then((response) => {
          setCache({
            data: response?.templates ?? [],
            loading: false,
            error: null,
            loadedFor: hospitalId,
          });
          return response;
        })
        .catch((err: any) => {
          setCache({
            data: [],
            loading: false,
            error: err.message || "Failed to fetch templates",
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
    templates: state.data,
    templatesLoading: state.loading,
    templatesError: state.error,
    getTemplates,
  };
}
