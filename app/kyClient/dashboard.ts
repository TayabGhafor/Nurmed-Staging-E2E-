import ApiService from "./api";

export interface HospitalStats {
  id: number;
  name: string;
  active_doctor_count: number;
  inactive_doctor_count: number;
  total_doctor_count: number;
  completed_session_count: number;
  deleted_session_count: number;
  total_sessions: number;
  total_administrator_count: number;
}

export enum Status {
  Pending = "Pending",
  InProgress = "IN_PROGRESS",
  Failed = "Failed",
  Transcribed = "Transcribed",
  Completed = "Completed",
  Deleted = "deleted",
}

export interface Session {
  id: number;
  status: Status;
  language: string;
  created_at: string;
  session_duration_seconds: string;
  session_duration_minutes: string;
  mrn: string;
  episode_id?: string;
  session_template: "ED" | "PC" | "OPD" | "REVIEW";
  hospital_data?: {
    encounterId?: string;
    doctorId?: string;
    mrn?: string;
    template?: string;
    language?: string;
    new?: string;
  };
  /** EHR/scribe pipeline status from the API */
  ehr_status?: string | number | null;
  ehr_response?: { scribe_job_queued?: boolean } | null;
}

export enum NoteType {
  CREATE_SESSION = "create_session",
  UPDATE_SESSION = "update_session",
}

export interface StartSessionRequest {
  mrn: string;
  language?: string;
  new_note_storage_id: string;
  session_template: string;
  hospital_data?: any;
  session_duration_seconds?: number; // Duration in seconds
}

export interface SessionUpdateRequest {
  storage_id: string;
  session_duration_seconds?: number;
  transcription_status?: "Success" | "Failed";
  transcription?: Array<{ speaker: string; text: string }>;
}

export interface SectionSessionUpdateRequest {
  section_id: string;
  updated_details: string;
}

export interface DiagnosisCode {
  code: string;
  name: string;
  summary?: string;
}

export interface DiagnosisCodesRequest {
  diagnosis_codes: DiagnosisCode[];
}

export interface AdminAIRequest {
  query: string;
  variables?: Record<string, any>;
}

export interface AdminAINote {
  note: string;
}

export interface SendToEhrRequest {
  hospital: string;
  mrn: string;
  encounter_id?: string;
  vdr_id?: string;
  episode_id?: string;
}

export interface FileUploadResponse {
  note_id: string;
}

export interface CreateRealtimeSessionRequest {
  mrn: string;
  episode_id?: string;
  session_template: string;
  language?: string;
  s3_key?: string;
  session_duration_seconds?: number;
  transcription_status?: "Success" | "Failed";
  transcription?: Array<{ speaker: string; text: string }>;
  hospital_data?: any;
  third_party_present?: boolean;
  /**
   * Soniox client_reference_id used for this recording's WebSocket stream.
   * Persisted on the session so Soniox usage logs (tokens/cost) can be
   * reconciled back to this session/encounter.
   */
  client_reference_id?: string;
}

export interface RealtimeSessionAudioUpload {
  note_id: string;
  upload_url: string;
  upload_method: "PUT" | "POST";
  upload_headers?: Record<string, string>;
  expires_in?: number;
}

export interface CreateRealtimeSessionResponse {
  message: string;
  session_id: number;
  hospital_data_included: boolean;
  processing_route?: string;
  audio_upload?: RealtimeSessionAudioUpload;
}

export interface GenerateRealtimeUpdateSessionRequest {
  transcription_status?: "Success" | "Failed";
  transcription?: Array<{ speaker: string; text: string }>;
  session_duration_seconds?: number;
  third_party_present?: boolean;
  /**
   * Soniox client_reference_id for the appended clip's WebSocket stream. The
   * "Add Additional Note" flow opens a fresh Soniox stream, so it carries its
   * own usage entry that must be reconciled separately.
   */
  client_reference_id?: string;
}

export interface GenerateRealtimeUpdateSessionResponse {
  message: string;
  session_id: number;
  processing_route?: string;
}

class DashboardService extends ApiService {
  private static instance: DashboardService;

  private constructor() {
    super();
  }

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  // Get preferred language for hospital
  async getPreferredLanguage(): Promise<string | null> {
    try {
      const response = await this.get<{ preferred_language: string }>(
        "hospital/preferred-language",
      );
      console.log("getPreferredLanguage", response);
      // Handle different response structures
      if (response && typeof response === "object") {
        // Check if response has data property
        if ("data" in response && response.data) {
          return (response.data as any)?.preferred_language || null;
        }
        // Check if response has preferred_language directly
        if ("preferred_language" in response) {
          return (response as any).preferred_language || null;
        }
        // If response is the data directly
        if (response && (response as any).preferred_language) {
          return (response as any).preferred_language;
        }
      }

      return null;
    } catch (error: any) {
      // Check for 403 Forbidden and redirect to login
      if (
        error.response &&
        error.response.status === 403 &&
        typeof window !== "undefined"
      ) {
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
        return null;
      }
      // Don't throw error for preferred language, just return null if it fails
      console.warn(
        "Failed to fetch preferred language:",
        error.message || error.detail,
      );
      return null;
    }
  }

  // Create a realtime transcription session
  async createRealtimeSession(
    data: CreateRealtimeSessionRequest,
  ): Promise<CreateRealtimeSessionResponse> {
    try {
      if (typeof window !== "undefined") {
        const storedMrn = sessionStorage.getItem("magic_link_mrn");
        const storedTemplate = sessionStorage.getItem("magic_link_template");
        const storedLanguage = sessionStorage.getItem("magic_link_language");
        const storedEncounterId = sessionStorage.getItem(
          "magic_link_encounter_id",
        );
        const storedDoctorId = sessionStorage.getItem("magic_link_doctor_id");

        if (
          storedMrn ||
          storedTemplate ||
          storedLanguage ||
          storedEncounterId ||
          storedDoctorId
        ) {
          const sessionStorageData: Record<string, string> = {};
          if (storedMrn) sessionStorageData.mrn = storedMrn;
          if (storedTemplate) sessionStorageData.template = storedTemplate;
          if (storedLanguage) sessionStorageData.language = storedLanguage;
          if (storedEncounterId)
            sessionStorageData.encounterId = storedEncounterId;
          if (storedDoctorId) sessionStorageData.doctorId = storedDoctorId;

          data.hospital_data = {
            ...data.hospital_data,
            ...sessionStorageData,
          };
        }
      }

      const response = await this.post<CreateRealtimeSessionResponse>(
        "session/generate-realtime-session",
        data,
      );

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("magic_link_mrn");
        sessionStorage.removeItem("magic_link_template");
        sessionStorage.removeItem("magic_link_language");
        sessionStorage.removeItem("magic_link_encounter_id");
      }

      return response as unknown as CreateRealtimeSessionResponse;
    } catch (error: any) {
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      logger.error("Realtime session creation failed", {
        mrn: data.mrn,
        department: data.session_template,
        language: data.language,
        error: error.message,
        endpoint: "session/generate-realtime-session",
        method: "POST",
      });

      Sentry.captureException(error, {
        tags: {
          operation: "realtime_session_creation",
          department: data.session_template,
          language: data.language,
        },
        extra: {
          mrn: data.mrn,
          endpoint: "session/generate-realtime-session",
          method: "POST",
        },
      });

      throw new Error(
        error.message || "Failed to create realtime session",
      );
    }
  }

  // Generate a presigned upload for appending audio + transcription to an
  // existing realtime session (Add Additional Note flow).
  async generateRealtimeUpdateSession(
    sessionId: number,
    data: GenerateRealtimeUpdateSessionRequest,
  ): Promise<GenerateRealtimeUpdateSessionResponse> {
    try {
      const response = await this.post<GenerateRealtimeUpdateSessionResponse>(
        `session/generate-realtime-update-session/${sessionId}`,
        data,
      );
      return response as unknown as GenerateRealtimeUpdateSessionResponse;
    } catch (error: any) {
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      logger.error("Realtime update session generation failed", {
        sessionId,
        error: error.message,
        endpoint: `session/generate-realtime-update-session/${sessionId}`,
        method: "POST",
      });

      Sentry.captureException(error, {
        tags: {
          operation: "realtime_update_session_generation",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `session/generate-realtime-update-session/${sessionId}`,
          method: "POST",
        },
      });

      throw new Error(
        error.message || "Failed to generate realtime update session",
      );
    }
  }

  // Get sessions with pagination support
  async getSessions(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    sessions: Session[];
    pagination: {
      total_count: number;
      limit: number;
      offset: number;
      has_more: boolean;
    };
  }> {
    try {
      const response = await this.get<{
        sessions: Session[];
        pagination: {
          total_count: number;
          limit: number;
          offset: number;
          has_more: boolean;
        };
      }>("session/list", params);
      return (
        (response as any) ?? {
          sessions: [],
          pagination: {
            total_count: 0,
            limit: params?.limit ?? 0,
            offset: params?.offset ?? 0,
            has_more: false,
          },
        }
      );
    } catch (error: any) {
      // Check for 403 Forbidden and redirect to login
      if (
        error.response &&
        error.response.status === 403 &&
        typeof window !== "undefined"
      ) {
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
        return {
          sessions: [],
          pagination: {
            total_count: 0,
            limit: params?.limit ?? 0,
            offset: params?.offset ?? 0,
            has_more: false,
          },
        };
      }
      throw new Error(
        error.message || error.detail || "Failed to fetch sessions",
      );
    }
  }

  // Get a single session by ID
  async getSession(sessionId: number): Promise<Session> {
    try {
      const response = await this.get<Session>(`session/${sessionId}`);

      // Handle both response formats:
      // 1. If the response has a data property, return that
      // 2. If the response is the session data directly, return the response itself
      if (response && response.data) {
        return response.data as Session;
      } else if (response) {
        // If the API returns the session data directly without wrapping it in a data property
        return response as unknown as Session;
      }

      throw new Error(`No data returned for session ${sessionId}`);
    } catch (error: any) {
      // Track session fetch errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Session fetch failed", {
        sessionId,
        error: error.message,
        endpoint: `session/${sessionId}`,
        method: "GET",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "session_fetch",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `session/${sessionId}`,
          method: "GET",
        },
      });

      // Re-throw the original error to preserve status code for authorization handling
      throw error;
    }
  }

  // Create a new session
  async createSession(data: StartSessionRequest): Promise<{ id: number }> {
    try {
      // Check sessionStorage for magic link values (only in browser environment)
      if (typeof window !== "undefined") {
        const storedMrn = sessionStorage.getItem("magic_link_mrn");
        const storedTemplate = sessionStorage.getItem("magic_link_template");
        const storedLanguage = sessionStorage.getItem("magic_link_language");
        const storedEncounterId = sessionStorage.getItem(
          "magic_link_encounter_id",
        );
        const storedDoctorId = sessionStorage.getItem("magic_link_doctor_id");

        // Add sessionStorage values to hospital_data if any exist
        if (
          storedMrn ||
          storedTemplate ||
          storedLanguage ||
          storedEncounterId ||
          storedDoctorId
        ) {
          const sessionStorageData: Record<string, string> = {};
          if (storedMrn) sessionStorageData.mrn = storedMrn;
          if (storedTemplate) sessionStorageData.template = storedTemplate;
          if (storedLanguage) sessionStorageData.language = storedLanguage;
          if (storedEncounterId)
            sessionStorageData.encounterId = storedEncounterId;
          if (storedDoctorId) sessionStorageData.doctorId = storedDoctorId;

          // Merge with existing hospital_data or create new
          data.hospital_data = {
            ...data.hospital_data,
            ...sessionStorageData,
          };
        }
      }

      const response = await this.post<{ id: number }>("session/create", data);

      // Clear magic link values from sessionStorage after successful creation
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("magic_link_mrn");
        sessionStorage.removeItem("magic_link_template");
        sessionStorage.removeItem("magic_link_language");
        sessionStorage.removeItem("magic_link_encounter_id");
      }

      return (response as { id: number }) || { id: 0 };
    } catch (error: any) {
      // Track session creation errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Session creation failed", {
        mrn: data.mrn,
        department: data.session_template,
        language: data.language,
        error: error.message,
        endpoint: "session/create",
        method: "POST",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "session_creation",
          department: data.session_template,
          language: data.language,
        },
        extra: {
          mrn: data.mrn,
          endpoint: "session/create",
          method: "POST",
        },
      });

      throw new Error(error.message || "Failed to create session");
    }
  }

  // Update an existing session
  async updateSession(
    sessionId: number,
    data: SessionUpdateRequest,
  ): Promise<any> {
    try {
      const response = await this.put(
        `session/update_session/${sessionId}`,
        data,
      );
      return response as any;
    } catch (error: any) {
      // Track session update errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Session update failed", {
        sessionId,
        error: error.message,
        endpoint: `session/update_session/${sessionId}`,
        method: "PUT",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "session_update",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `session/update_session/${sessionId}`,
          method: "PUT",
        },
      });

      throw new Error(error.message || `Failed to update session ${sessionId}`);
    }
  }

  // Get diagnosis codes for a session
  async getDiagnosisCodes(sessionId: number): Promise<DiagnosisCode[]> {
    try {
      const response = await this.get<DiagnosisCode[]>(
        `note/get_diagnosis_codes/${sessionId}`,
      );
      return response as DiagnosisCode[];
    } catch (error: any) {
      // Track diagnosis codes fetch errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Diagnosis codes fetch failed", {
        sessionId,
        error: error.message,
        endpoint: `note/get_diagnosis_codes/${sessionId}`,
        method: "GET",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "diagnosis_codes_fetch",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `note/get_diagnosis_codes/${sessionId}`,
          method: "GET",
        },
      });

      throw new Error(
        error.message ||
          `Failed to fetch diagnosis codes for session ${sessionId}`,
      );
    }
  }

  // Post diagnosis codes for a session
  async postDiagnosisCodes(
    sessionId: number,
    data: DiagnosisCodesRequest,
  ): Promise<any> {
    try {
      const response = await this.post(
        `note/post_diagnosis_codes/${sessionId}`,
        data,
      );
      return response;
    } catch (error: any) {
      // Track diagnosis codes post errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Diagnosis codes post failed", {
        sessionId,
        error: error.message,
        endpoint: `note/post_diagnosis_codes/${sessionId}`,
        method: "POST",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "diagnosis_codes_post",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `note/post_diagnosis_codes/${sessionId}`,
          method: "POST",
        },
      });

      throw new Error(
        error.message ||
          `Failed to post diagnosis codes for session ${sessionId}`,
      );
    }
  }

  // Get notes for a session
  async getNotes(sessionId: number): Promise<any> {
    try {
      const response = await this.get(`note/get_notes/${sessionId}`);
      return response;
    } catch (error: any) {
      // Track notes fetch errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Notes fetch failed", {
        sessionId,
        error: error.message,
        endpoint: `note/get_notes/${sessionId}`,
        method: "GET",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "notes_fetch",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `note/get_notes/${sessionId}`,
          method: "GET",
        },
      });

      throw new Error(
        error.message || `Failed to fetch notes for session ${sessionId}`,
      );
    }
  }

  // Update notes for a session
  async updateNotes(
    sessionId: number,
    data: SectionSessionUpdateRequest,
  ): Promise<any> {
    try {
      const response = await this.put(`note/update_notes/${sessionId}`, {
        section_id: data.section_id,
        updated_details: data.updated_details,
      });
      return response;
    } catch (error: any) {
      // Track notes update errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Notes update failed", {
        sessionId,
        error: error.message,
        endpoint: `note/update_notes/${sessionId}`,
        method: "PUT",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "notes_update",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `note/update_notes/${sessionId}`,
          method: "PUT",
        },
      });

      throw new Error(
        error.message || `Failed to update notes for session ${sessionId}`,
      );
    }
  }

  // Get transcription for a session
  // async getTranscription(sessionId: number): Promise<any> {
  //   try {
  //     const response = await this.get(`session/get_transcription/${sessionId}`);
  //     return response;
  //   } catch (error: any) {
  //     // Track transcription fetch errors in Sentry
  //     const Sentry = require('@sentry/nextjs');
  //     const { logger } = Sentry;

  //     // Log the error with context (shows in Logs tab)
  //     logger.error('Transcription fetch failed', {
  //       sessionId,
  //       error: error.message,
  //       endpoint: `session/get_transcription/${sessionId}`,
  //       method: 'GET'
  //     });

  //     // Capture exception for error tracking (shows in Issues tab)
  //     Sentry.captureException(error, {
  //       tags: {
  //         operation: 'transcription_fetch',
  //         sessionId: sessionId.toString()
  //       },
  //       extra: {
  //         endpoint: `session/get_transcription/${sessionId}`,
  //         method: 'GET'
  //       }
  //     });

  //     throw new Error(
  //       error.message ||
  //       `Failed to fetch transcription for session ${sessionId}`,
  //     );
  //   }
  // }

  // Perform admin AI task
  async performAdminAITask(
    sessionId: number,
    data: AdminAIRequest,
  ): Promise<any> {
    try {
      const response = await this.post(`note/admin_ai/${sessionId}`, {
        query: data.query,
        variables: data.variables || {},
      });
      return response;
    } catch (error: any) {
      // Track admin AI task errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Admin AI task failed", {
        sessionId,
        error: error.message,
        endpoint: `note/admin_ai/${sessionId}`,
        method: "POST",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "admin_ai_task",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `note/admin_ai/${sessionId}`,
          method: "POST",
        },
      });

      throw new Error(
        error.message ||
          `Failed to perform admin AI task for session ${sessionId}`,
      );
    }
  }

  // Save admin AI note
  async saveAdminAINote(sessionId: number, data: AdminAINote): Promise<any> {
    try {
      const response = await this.post(`note/add_admin_note`, {
        session_id: sessionId,
        note: data.note,
      });
      return response;
    } catch (error: any) {
      // Track admin AI note save errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Admin AI note save failed", {
        sessionId,
        error: error.message,
        endpoint: `note/add_admin_note`,
        method: "POST",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "admin_ai_note_save",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `note/add_admin_note`,
          method: "POST",
        },
      });

      throw new Error(
        error.message ||
          `Failed to save admin AI note for session ${sessionId}`,
      );
    }
  }

  // Get AI copilot
  async getAICopilot(sessionId: number): Promise<any> {
    try {
      const response = await this.get(`note/ai-copilot-v2/${sessionId}`);
      return response;
    } catch (error: any) {
      // Track AI copilot fetch errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("AI copilot fetch failed", {
        sessionId,
        error: error.message,
        endpoint: `note/ai-copilot-v2/${sessionId}`,
        method: "GET",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "ai_copilot_fetch",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `note/ai-copilot-v2/${sessionId}`,
          method: "GET",
        },
      });

      throw new Error(
        error.message || `Failed to fetch AI copilot for session ${sessionId}`,
      );
    }
  }

  // Send notes to EHR
  async sendToEhr(sessionId: number, data: SendToEhrRequest): Promise<any> {
    try {
      const response = await this.post(
        `session/${sessionId}/send-to-ehr`,
        data,
      );
      return response;
    } catch (error: any) {
      // Track EHR send errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("EHR send failed", {
        sessionId,
        error: error.message,
        endpoint: `session/${sessionId}/send-to-ehr`,
        method: "POST",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "ehr_send",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `session/${sessionId}/send-to-ehr`,
          method: "POST",
        },
      });

      throw new Error(
        error.message || `Failed to send notes to EHR for session ${sessionId}`,
      );
    }
  }

  // Get final note ID
  async getFinalNoteUrl(sessionId: string): Promise<any> {
    try {
      const response = await this.get<{ final_note_storage_id: string }>(
        `session/get-final-note-url/${sessionId}`,
      );
      return response;
    } catch (error: any) {
      // Track final note URL fetch errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Final note URL fetch failed", {
        sessionId,
        error: error.message,
        endpoint: `session/get-final-note-url/${sessionId}`,
        method: "GET",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "session/get-final-note-url",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `session/get-final-note-url/${sessionId}`,
          method: "GET",
        },
      });

      throw new Error(
        error.message || `Failed to get final note ID for session ${sessionId}`,
      );
    }
  }

  async getRpaNotes(sessionId: string): Promise<any> {
    try {
      // If your .get method accepts a second param for headers
      const response = await this.get(`rpa/rpa_notes/${sessionId}`);
      console.log("response for rpa get notes api", response);
      return response;
    } catch (error: any) {
      throw new Error(
        error.message || `Failed to fetch rpa notes for session ${sessionId}`,
      );
    }
  }

  // Get full notes for a session
  async getFullNotes(sessionId: string): Promise<any> {
    try {
      const response = await this.get(`note/get_full_notes/${sessionId}`);
      return response;
    } catch (error: any) {
      // Track full notes fetch errors in Sentry
      const Sentry = require("@sentry/nextjs");
      const { logger } = Sentry;

      // Log the error with context (shows in Logs tab)
      logger.error("Full notes fetch failed", {
        sessionId,
        error: error.message,
        endpoint: `note/get_full_notes/${sessionId}`,
        method: "GET",
      });

      // Capture exception for error tracking (shows in Issues tab)
      Sentry.captureException(error, {
        tags: {
          operation: "full_notes_fetch",
          sessionId: sessionId.toString(),
        },
        extra: {
          endpoint: `note/get_full_notes/${sessionId}`,
          method: "GET",
        },
      });

      throw new Error(
        error.message || `Failed to fetch full notes for session ${sessionId}`,
      );
    }
  }

  async getDoctorLanguagesAndTemplates(hospitalId: number): Promise<{
    templates: {
      id: number;
      code: string;
      name: string;
      is_active: boolean;
    }[];
    languages: { id: number; name: string }[];
  }> {
    try {
      const response: any = await this.get(
        "hospital/doctor/languages-and-templates",
      );
      const payload = response?.data ?? response;
      const hospitals: any[] = payload?.hospitals ?? [];
      const match =
        hospitals.find((h) => h?.hospital_id === hospitalId) ?? hospitals[0];

      const templates = (match?.templates ?? []).filter(
        (t: any) => t?.is_active !== false,
      );
      const languages = match?.languages ?? [];

      return { templates, languages };
    } catch (error: any) {
      throw new Error(
        error.message || "Failed to fetch doctor languages and templates",
      );
    }
  }

  async addRpaWebhookUrl(url: string): Promise<any> {
    try {
      const response = await this.post(`rpa/webhoook_url/?url=${url}`);
      return response;
    } catch (error: any) {
      throw new Error(
        error.message || `Failed to add rpa webhook url for url ${url}`,
      );
    }
  }

  async getRpaWebhookUrl(): Promise<any> {
    try {
      const response = await this.get(`rpa/cloudflow_url`);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to get rpa webhook urls`);
    }
  }

  async addHospitalTemplate(
    hospitalId: number,
    sessionTemplateId: string,
  ): Promise<any> {
    try {
      const response = await this.post(
        `hospital/${hospitalId}/session-templates`,
        {
          session_template_id: sessionTemplateId,
        },
      );
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to add hospital template`);
    }
  }

  async getHospitalTemplates(
    hospitalId: number,
    bustCache = false,
  ): Promise<any> {
    try {
      // When refetching right after a mutation, append a unique param so the
      // browser doesn't serve a stale cached response for this GET.
      const response = await this.get(
        `hospital/${hospitalId}/session-templates`,
        bustCache ? { _: Date.now() } : undefined,
      );
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to get hospital templates`);
    }
  }

  async removeHospitalTemplate(sessionTemplateId: number): Promise<any> {
    try {
      const response = await this.delete(
        `hospital/session-templates/${sessionTemplateId}`,
      );
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to remove hospital template`);
    }
  }

  // Create a new template (with sections) for the hospital
  async createTemplate(data: {
    code: string;
    name: string;
    description?: string;
    is_active: boolean;
    doctor_id?: number;
    sections: { text: string; sort_order: number }[];
  }): Promise<any> {
    try {
      const response = await this.post(`template/setup`, data);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to create template`);
    }
  }

  // Get a single template by id (optionally including its sections)
  async getTemplateById(
    templateId: number,
  ): Promise<any> {
    try {
      const response = await this.get(`template/${templateId}`, {
        include_sections: true,
      });
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to get template`);
    }
  }

  // Update an existing template (name, active state, sections and new sections)
  async updateTemplate(
    templateId: number,
    data: {
      name?: string;
      is_active?: boolean;
      sections?: { section_id?: number; text?: string; sort_order: number }[];
      add_sections?: { text: string; sort_order: number }[];
    },
  ): Promise<any> {
    try {
      const response = await this.put(`template/${templateId}/setup`, data);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to update template`);
    }
  }

  // Delete a template by id
  async deleteTemplate(templateId: number): Promise<any> {
    try {
      const response = await this.delete(`template/${templateId}/setup`);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to delete template`);
    }
  }

  async getHospitalLocations(hospitalId: number): Promise<any> {
    try {
      const response = await this.get(`location/hospital/${hospitalId}`);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to get hospital locations`);
    }
  }

  async createLocation(data: {
    hospital_id: number;
    name: string;
    address: string;
    is_active: boolean;
  }): Promise<any> {
    try {
      const response = await this.post(`location/`, data);
      return response;
    } catch (error: any) {
      throw new Error(error.message || `Failed to create location`);
    }
  }

  // Get hospital statistics by ID
  async getHospital(hospitalId: number): Promise<HospitalStats | null> {
    try {
      const response = await this.get<HospitalStats>(`hospital/${hospitalId}`);
      // Handle different response formats
      if (response && typeof response === "object") {
        if ("data" in response && response.data) {
          return response.data as HospitalStats;
        }
        return response as unknown as HospitalStats;
      }
      return null;
    } catch (error: any) {
      // PGRST116 = no rows found; treat as empty state rather than an error.
      const message = error?.message ?? "";
      if (message.includes("PGRST116") || message.includes("0 rows")) {
        return null;
      }
      console.error("Error fetching hospital:", error);
      throw new Error(
        error.message || `Failed to fetch hospital ${hospitalId}`,
      );
    }
  }
}

export const dashboardService = DashboardService.getInstance();
