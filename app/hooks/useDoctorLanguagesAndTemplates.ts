import { useCallback, useSyncExternalStore } from "react";
import { dashboardService } from "../kyClient/dashboard";
import { useAuth } from "../contexts/AuthContext";

export interface DoctorTemplateItem {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export interface DoctorLanguageItem {
  id: number;
  name: string;
}

interface CacheState {
  templates: DoctorTemplateItem[];
  languages: DoctorLanguageItem[];
  loading: boolean;
  error: string | null;
  loadedFor: number | null;
}

const initialState: CacheState = {
  templates: [],
  languages: [],
  loading: false,
  error: null,
  loadedFor: null,
};

const STORAGE_KEY_PREFIX = "doctor-languages-and-templates";

const getStorageKey = (hospitalId: number) =>
  `${STORAGE_KEY_PREFIX}:${hospitalId}`;

const readFromStorage = (
  hospitalId: number,
): { templates: DoctorTemplateItem[]; languages: DoctorLanguageItem[] } | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(hospitalId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      templates: Array.isArray(parsed.templates) ? parsed.templates : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
    };
  } catch {
    return null;
  }
};

const writeToStorage = (
  hospitalId: number,
  data: { templates: DoctorTemplateItem[]; languages: DoctorLanguageItem[] },
) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(hospitalId), JSON.stringify(data));
  } catch {
    // ignore quota / serialization errors
  }
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

// Invalidate the doctor-facing templates/languages cache so the next read
// refetches fresh data from the API. Hospital-admin template mutations (create,
// update, delete) use a separate cache, so without this the doctor portal would
// keep serving the stale in-memory + localStorage copy until the browser cache
// is cleared. Pass the hospitalId to drop its persisted copy; with no argument
// every persisted hospital entry is cleared.
export const invalidateDoctorLanguagesAndTemplates = (hospitalId?: number) => {
  if (typeof window !== "undefined") {
    try {
      if (typeof hospitalId === "number") {
        window.localStorage.removeItem(getStorageKey(hospitalId));
      } else {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
            window.localStorage.removeItem(key);
          }
        }
      }
    } catch {
      // ignore storage access errors
    }
  }
  // Drop any in-flight request and reset the in-memory cache. Resetting
  // `loadedFor` to null forces the next getDoctorLanguagesAndTemplates() call
  // (e.g. when the dashboard layout mounts on portal switch) to refetch.
  inFlight = null;
  setCache({ ...initialState });
};

export function useDoctorLanguagesAndTemplates() {
  const { user } = useAuth();
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const getDoctorLanguagesAndTemplates = useCallback(
    async (force = false) => {
      const hospitalId = user?.hospital_id ?? 0;

      if (!force && cache.loadedFor === hospitalId && !cache.loading) {
        return { templates: cache.templates, languages: cache.languages };
      }
      if (inFlight) {
        return inFlight;
      }

      // Hydrate from localStorage so the UI can render immediately on a
      // returning browser, then refresh in the background and update both
      // the in-memory cache and the persisted copy with the latest data.
      const persisted = !force ? readFromStorage(hospitalId) : null;
      if (persisted) {
        setCache({
          templates: persisted.templates,
          languages: persisted.languages,
          loading: false,
          error: null,
          loadedFor: hospitalId,
        });
      } else {
        setCache({ ...cache, loading: true, error: null });
      }

      inFlight = dashboardService
        .getDoctorLanguagesAndTemplates(hospitalId)
        .then((response) => {
          const next = {
            templates: response?.templates ?? [],
            languages: response?.languages ?? [],
          };
          setCache({
            ...next,
            loading: false,
            error: null,
            loadedFor: hospitalId,
          });
          writeToStorage(hospitalId, next);
          return response;
        })
        .catch((err: any) => {
          // If we already hydrated from storage, keep showing that data
          // instead of wiping it out on a transient network failure.
          if (persisted) {
            setCache({
              templates: persisted.templates,
              languages: persisted.languages,
              loading: false,
              error: err.message || "Failed to fetch languages and templates",
              loadedFor: hospitalId,
            });
          } else {
            setCache({
              templates: [],
              languages: [],
              loading: false,
              error: err.message || "Failed to fetch languages and templates",
              loadedFor: null,
            });
          }
          return null;
        })
        .finally(() => {
          inFlight = null;
        });

      return persisted
        ? { templates: persisted.templates, languages: persisted.languages }
        : inFlight;
    },
    [user?.hospital_id],
  );

  return {
    templates: state.templates,
    languages: state.languages,
    loading: state.loading,
    error: state.error,
    getDoctorLanguagesAndTemplates,
  };
}
