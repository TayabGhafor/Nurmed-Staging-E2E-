import ApiService from "./api";

export interface AddScribeRequest {
  name: string;
  email: string;
  is_active: boolean;
  doctor_ids?: number[];
  user_id?: string;
}

export interface SetScribeDoctorsRequest {
  doctor_ids: number[];
}

/** Shape returned by GET scribe/get_scribes (fields may vary by backend). */
export interface Scribe {
  id?: number | string;
  name?: string | null;
  email?: string | null;
  is_active?: boolean | null;
  doctor_ids?: number[] | null;
  roles?: string[] | null;
  created_at?: string | null;
  [key: string]: unknown;
}

function normalizeScribesResponse(response: unknown): Scribe[] {
  if (Array.isArray(response)) {
    return response as Scribe[];
  }
  if (response && typeof response === "object") {
    const r = response as Record<string, unknown>;
    if (Array.isArray(r.data)) {
      return r.data as Scribe[];
    }
    if (Array.isArray(r.scribes)) {
      return r.scribes as Scribe[];
    }
    if (Array.isArray(r.results)) {
      return r.results as Scribe[];
    }
    for (const key of Object.keys(r)) {
      const v = r[key];
      if (Array.isArray(v)) {
        return v as Scribe[];
      }
    }
  }
  return [];
}

class ScribeService extends ApiService {
  private static instance: ScribeService;

  private constructor() {
    super();
  }

  public static getInstance(): ScribeService {
    if (!ScribeService.instance) {
      ScribeService.instance = new ScribeService();
    }
    return ScribeService.instance;
  }

  async addScribe(payload: AddScribeRequest): Promise<unknown> {
    try {
      const response = await this.post("scribe/add_scribe", payload);
      return response;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to add scribe";
      throw new Error(message);
    }
  }

  async getScribes(): Promise<Scribe[]> {
    try {
      const response = await this.get<unknown>("scribe/get_scribes");
      return normalizeScribesResponse(response);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch scribes";
      throw new Error(message);
    }
  }

  /** POST /scribe/{scribeId}/doctors — replace scribe–doctor links (empty list unassigns all). */
  async setScribeDoctors(
    scribeId: number | string,
    payload: SetScribeDoctorsRequest,
  ): Promise<unknown> {
    try {
      const id = encodeURIComponent(String(scribeId));
      const response = await this.post(`scribe/${id}/doctors`, payload);
      return response;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update scribe doctors";
      throw new Error(message);
    }
  }
}

export const scribeService = ScribeService.getInstance();
