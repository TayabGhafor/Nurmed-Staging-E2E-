import { useState, useCallback } from "react";
import {
  dashboardService,
  Session,
  StartSessionRequest,
  SessionUpdateRequest,
  SectionSessionUpdateRequest,
  DiagnosisCode,
  DiagnosisCodesRequest,
  AdminAIRequest,
  AdminAINote,
  SendToEhrRequest,
} from "../kyClient/dashboard";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Initial state for API calls
const initialApiState = {
  data: null,
  loading: false,
  error: null,
};

/**
 * Custom hook for session-related API calls
 * Each method manages its own state and returns its data, loading state, and error state
 */
export const useSession = () => {
  // State for all sessions
  const [sessionsState, setSessionsState] =
    useState<ApiState<Session[]>>(initialApiState);

  // State for single session
  const [sessionState, setSessionState] =
    useState<ApiState<Session>>(initialApiState);

  // State for created session
  const [createdSessionState, setCreatedSessionState] =
    useState<ApiState<{ id: number }>>(initialApiState);

  // State for updated session
  const [updatedSessionState, setUpdatedSessionState] =
    useState<ApiState<any>>(initialApiState);

  // State for diagnosis codes
  const [diagnosisCodesState, setDiagnosisCodesState] =
    useState<ApiState<DiagnosisCode[]>>(initialApiState);

  // State for posted diagnosis codes
  const [postedDiagnosisCodesState, setPostedDiagnosisCodesState] =
    useState<ApiState<any>>(initialApiState);

  // State for notes
  const [notesState, setNotesState] = useState<ApiState<any>>(initialApiState);

  // State for updated notes
  const [updatedNotesState, setUpdatedNotesState] =
    useState<ApiState<any>>(initialApiState);

  // State for transcription
  const [transcriptionState, setTranscriptionState] =
    useState<ApiState<any>>(initialApiState);

  // State for admin AI task
  const [adminAITaskState, setAdminAITaskState] =
    useState<ApiState<any>>(initialApiState);

  // State for admin AI note
  const [adminAINoteState, setAdminAINoteState] =
    useState<ApiState<any>>(initialApiState);

  // State for AI copilot
  const [aiCopilotState, setAICopilotState] =
    useState<ApiState<any>>(initialApiState);

  // State for EHR send
  const [sendToEhrState, setSendToEhrState] =
    useState<ApiState<any>>(initialApiState);

  // State for final note Url
  const [finalNoteUrlState, setFinalNoteUrlState] =
    useState<ApiState<any>>(initialApiState);

  // State for full notes
  const [fullNotesState, setFullNotesState] =
    useState<ApiState<any>>(initialApiState);

  // State for rpa notes
  const [rpaNotesState, setRpaNotesState] =
    useState<ApiState<any>>(initialApiState);

  // State for rpa webhook url
  const [rpaWebhookUrlState, setRpaWebhookUrlState] =
    useState<ApiState<any>>(initialApiState);

  // State for rpa webhook url
  const [getRpaWebhookUrlState, setGetRpaWebhookUrlState] =
    useState<ApiState<any>>(initialApiState);

  // State for hospital templates
  const [getHospitalTemplatesState, setGetHospitalTemplatesState] =
    useState<ApiState<any>>(initialApiState);

  // State for added hospital template
  const [addHospitalTemplateState, setAddHospitalTemplateState] =
    useState<ApiState<any>>(initialApiState);

  // State for removed hospital template
  const [removeHospitalTemplateState, setRemoveHospitalTemplateState] =
    useState<ApiState<any>>(initialApiState);

  // State for hospital locations
  const [getHospitalLocationsState, setGetHospitalLocationsState] =
    useState<ApiState<any>>(initialApiState);

  /**
   * Get all sessions
   */
  const getSessions = useCallback(
    async (params?: { limit?: number; offset?: number }) => {
      setSessionsState({ ...sessionsState, loading: true, error: null });
      try {
        const response = await dashboardService.getSessions(params);
        setSessionsState({
          data: response?.sessions ?? [],
          loading: false,
          error: null,
        });
        return response;
      } catch (err: any) {
        const errorMessage = err.message || "Failed to fetch sessions";
        setSessionsState({ data: null, loading: false, error: errorMessage });
        return null;
      }
    },
    [],
  );

  /**
   * Get a single session by ID
   */
  const getSession = useCallback(async (sessionId: number) => {
    setSessionState({ ...sessionState, loading: true, error: null });
    try {
      const response = await dashboardService.getSession(sessionId);
      setSessionState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage =
        err.message || `Failed to fetch session ${sessionId}`;
      setSessionState({ data: null, loading: false, error: errorMessage });
      // Re-throw the error so calling code can handle it (e.g., for authorization errors)
      throw err;
    }
  }, []);

  /**
   * Create a new session
   */
  const createSession = useCallback(async (data: StartSessionRequest) => {
    setCreatedSessionState({
      ...createdSessionState,
      loading: true,
      error: null,
    });
    try {
      const response = await dashboardService.createSession(data);
      setCreatedSessionState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage = err.message || "Failed to create session";
      setCreatedSessionState({
        data: null,
        loading: false,
        error: errorMessage,
      });
      return null;
    }
  }, []);

  /**
   * Update an existing session
   */
  const updateSession = useCallback(
    async (sessionId: number, data: SessionUpdateRequest) => {
      setUpdatedSessionState({
        ...updatedSessionState,
        loading: true,
        error: null,
      });
      try {
        const response = await dashboardService.updateSession(sessionId, data);
        setUpdatedSessionState({ data: response, loading: false, error: null });
        return response;
      } catch (err: any) {
        const errorMessage =
          err.message || `Failed to update session ${sessionId}`;
        setUpdatedSessionState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        return null;
      }
    },
    [],
  );

  /**
   * Get diagnosis codes for a session
   */
  const getDiagnosisCodes = useCallback(async (sessionId: number) => {
    setDiagnosisCodesState({
      ...diagnosisCodesState,
      loading: true,
      error: null,
    });
    try {
      const response = await dashboardService.getDiagnosisCodes(sessionId);
      setDiagnosisCodesState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage =
        err.message ||
        `Failed to fetch diagnosis codes for session ${sessionId}`;
      setDiagnosisCodesState({
        data: null,
        loading: false,
        error: errorMessage,
      });
      return null;
    }
  }, []);

  /**
   * Post diagnosis codes for a session
   */
  const postDiagnosisCodes = useCallback(
    async (sessionId: number, data: DiagnosisCodesRequest) => {
      setPostedDiagnosisCodesState({
        ...postedDiagnosisCodesState,
        loading: true,
        error: null,
      });
      try {
        const response = await dashboardService.postDiagnosisCodes(
          sessionId,
          data,
        );
        setPostedDiagnosisCodesState({
          data: response,
          loading: false,
          error: null,
        });
        return response;
      } catch (err: any) {
        const errorMessage =
          err.message ||
          `Failed to post diagnosis codes for session ${sessionId}`;
        setPostedDiagnosisCodesState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        return null;
      }
    },
    [],
  );

  /**
   * Get notes for a session
   */
  const getNotes = useCallback(async (sessionId: number) => {
    setNotesState({ ...notesState, loading: true, error: null });
    try {
      const response = await dashboardService.getNotes(sessionId);
      setNotesState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage =
        err.message || `Failed to fetch notes for session ${sessionId}`;
      setNotesState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  /**
   * Update notes for a session
   */
  const updateNotes = useCallback(
    async (sessionId: number, data: SectionSessionUpdateRequest) => {
      setUpdatedNotesState({
        ...updatedNotesState,
        loading: true,
        error: null,
      });
      try {
        const response = await dashboardService.updateNotes(sessionId, data);
        setUpdatedNotesState({ data: response, loading: false, error: null });
        return response;
      } catch (err: any) {
        const errorMessage =
          err.message || `Failed to update notes for session ${sessionId}`;
        setUpdatedNotesState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        return null;
      }
    },
    [],
  );

  /**
   * Get transcription for a session
   */
  // const getTranscription = useCallback(async (sessionId: number) => {
  //   setTranscriptionState({
  //     ...transcriptionState,
  //     loading: true,
  //     error: null,
  //   });
  //   try {
  //     const response = await dashboardService.getTranscription(sessionId);
  //     setTranscriptionState({ data: response, loading: false, error: null });
  //     return response;
  //   } catch (err: any) {
  //     const errorMessage =
  //       err.message || `Failed to fetch transcription for session ${sessionId}`;
  //     setTranscriptionState({
  //       data: null,
  //       loading: false,
  //       error: errorMessage,
  //     });
  //     return null;
  //   }
  // }, []);

  /**
   * Perform admin AI task
   */
  const performAdminAITask = useCallback(
    async (sessionId: number, data: AdminAIRequest) => {
      setAdminAITaskState({ ...adminAITaskState, loading: true, error: null });
      try {
        const response = await dashboardService.performAdminAITask(
          sessionId,
          data,
        );
        setAdminAITaskState({ data: response, loading: false, error: null });
        return response;
      } catch (err: any) {
        const errorMessage =
          err.message ||
          `Failed to perform admin AI task for session ${sessionId}`;
        setAdminAITaskState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        return null;
      }
    },
    [],
  );

  /**
   * Save admin AI note
   */
  const saveAdminAINote = useCallback(
    async (sessionId: number, data: AdminAINote) => {
      setAdminAINoteState({ ...adminAINoteState, loading: true, error: null });
      try {
        const response = await dashboardService.saveAdminAINote(
          sessionId,
          data,
        );
        setAdminAINoteState({ data: response, loading: false, error: null });
        return response;
      } catch (err: any) {
        const errorMessage =
          err.message ||
          `Failed to save admin AI note for session ${sessionId}`;
        setAdminAINoteState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        return null;
      }
    },
    [],
  );

  /**
   * Get AI copilot
   */
  const getAICopilot = useCallback(async (sessionId: number) => {
    setAICopilotState({ ...aiCopilotState, loading: true, error: null });
    try {
      const response = await dashboardService.getAICopilot(sessionId);
      setAICopilotState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage =
        err.message || `Failed to fetch AI copilot for session ${sessionId}`;
      setAICopilotState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  /**
   * Send notes to EHR
   */
  const sendToEhr = useCallback(
    async (sessionId: number, data: SendToEhrRequest) => {
      setSendToEhrState({ ...sendToEhrState, loading: true, error: null });
      try {
        const response = await dashboardService.sendToEhr(sessionId, data);
        setSendToEhrState({ data: response, loading: false, error: null });
        return response;
      } catch (err: any) {
        const errorMessage =
          err.message || `Failed to send notes to EHR for session ${sessionId}`;
        setSendToEhrState({ data: null, loading: false, error: errorMessage });
        return null;
      }
    },
    [],
  );

  /**
   * Get final note ID
   */
  const getFinalNoteUrl = useCallback(async (sessionId: string) => {
    setFinalNoteUrlState({ ...finalNoteUrlState, loading: true, error: null });
    try {
      const response = await dashboardService.getFinalNoteUrl(sessionId);
      setFinalNoteUrlState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage =
        err.message || `Failed to get final note ID for session ${sessionId}`;
      setFinalNoteUrlState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  /**
   * Get full notes for a session
   */
  const getFullNotes = useCallback(async (sessionId: string) => {
    setFullNotesState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await dashboardService.getFullNotes(sessionId);
      setFullNotesState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage =
        err.message || `Failed to fetch full notes for session ${sessionId}`;
      setFullNotesState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  const getRpaNotes = useCallback(async (sessionId: string) => {
    setRpaNotesState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await dashboardService.getRpaNotes(sessionId);
      setRpaNotesState({ data: response, loading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMessage =
        err.message || `Failed to fetch rpa notes for session ${sessionId}`;
      setRpaNotesState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  const addRpaWebhookUrl = useCallback(async (url: string) => {
    setRpaWebhookUrlState({ ...rpaWebhookUrlState, loading: true, error: null });
    try {
      const response = await dashboardService.addRpaWebhookUrl(url);
      setRpaWebhookUrlState({ data: response, loading: false, error: null });
      return response;
    }
    catch (err: any) {
      const errorMessage =
        err.message || `Failed to add rpa webhook url for url ${url}`;
      setRpaWebhookUrlState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  const getRpaCloudeFlowUrl = useCallback(async () => {
    setGetRpaWebhookUrlState({ ...getRpaWebhookUrlState, loading: true, error: null });
    try {
      const response = await dashboardService.getRpaWebhookUrl();
      setGetRpaWebhookUrlState({ data: response, loading: false, error: null });
      return response;
    }
    catch (err: any) {
      const errorMessage =
        err.message || `Failed to get rpa webhook url`;
      setGetRpaWebhookUrlState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

    const addHospitalsTemplate = useCallback(async (hospitalId: number, sessionTemplateId: string) => {
    setAddHospitalTemplateState({ ...addHospitalTemplateState, loading: true, error: null });
    try {
      const response = await dashboardService.addHospitalTemplate(hospitalId, sessionTemplateId);
      setAddHospitalTemplateState({ data: response, loading: false, error: null });
      return response;
    }
    catch (err: any) {
      const errorMessage =
        err.message || `Failed to add hospital template`;
      setAddHospitalTemplateState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  const getHospitalTemplates = useCallback(async (hospitalId: number) => {
    setGetHospitalTemplatesState({ ...getHospitalTemplatesState, loading: true, error: null });
    try {
      const response = await dashboardService.getHospitalTemplates(hospitalId);
      setGetHospitalTemplatesState({ data: response, loading: false, error: null });
      return response;
    }
    catch (err: any) {
      const errorMessage =
        err.message || `Failed to get hospital templates`;
      setGetHospitalTemplatesState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

    const removeHospitalsTemplate = useCallback(async (sessionTemplateId: number) => {
    setRemoveHospitalTemplateState({ ...removeHospitalTemplateState, loading: true, error: null });
    try {
      const response = await dashboardService.removeHospitalTemplate(sessionTemplateId);
      setRemoveHospitalTemplateState({ data: response, loading: false, error: null });
      return response;
    }
    catch (err: any) {
      const errorMessage =
        err.message || `Failed to remove hospital template`;
      setRemoveHospitalTemplateState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  const getHospitalLocations = useCallback(async (hospitalId: number) => {
    setGetHospitalLocationsState({ ...getHospitalLocationsState, loading: true, error: null });
    try {
      const response = await dashboardService.getHospitalLocations(hospitalId);
      setGetHospitalLocationsState({ data: response, loading: false, error: null });
      return response;
    }
    catch (err: any) {
      const errorMessage =
        err.message || `Failed to get hospital locations`;
      setGetHospitalLocationsState({ data: null, loading: false, error: errorMessage });
      return null;
    }
  }, []);

  return {
    // Sessions
    sessions: sessionsState.data,
    sessionsLoading: sessionsState.loading,
    sessionsError: sessionsState.error,
    getSessions,

    // Single session
    session: sessionState.data,
    sessionLoading: sessionState.loading,
    sessionError: sessionState.error,
    getSession,

    // Create session
    createdSession: createdSessionState.data,
    createSessionLoading: createdSessionState.loading,
    createSessionError: createdSessionState.error,
    createSession,

    // Update session
    updatedSession: updatedSessionState.data,
    updateSessionLoading: updatedSessionState.loading,
    updateSessionError: updatedSessionState.error,
    updateSession,

    // Diagnosis codes
    diagnosisCodes: diagnosisCodesState.data,
    diagnosisCodesLoading: diagnosisCodesState.loading,
    diagnosisCodesError: diagnosisCodesState.error,
    getDiagnosisCodes,

    // Posted diagnosis codes
    postedDiagnosisCodes: postedDiagnosisCodesState.data,
    postDiagnosisCodesLoading: postedDiagnosisCodesState.loading,
    postDiagnosisCodesError: postedDiagnosisCodesState.error,
    postDiagnosisCodes,

    // Notes
    notes: notesState.data,
    notesLoading: notesState.loading,
    notesError: notesState.error,
    getNotes,

    // Updated notes
    updatedNotes: updatedNotesState.data,
    updateNotesLoading: updatedNotesState.loading,
    updateNotesError: updatedNotesState.error,
    updateNotes,

    // Transcription
    // transcription: transcriptionState.data,
    // transcriptionLoading: transcriptionState.loading,
    // transcriptionError: transcriptionState.error,
    // getTranscription,

    // Admin AI task
    adminAITaskResult: adminAITaskState.data,
    adminAITaskLoading: adminAITaskState.loading,
    adminAITaskError: adminAITaskState.error,
    performAdminAITask,

    // Admin AI note
    adminAINote: adminAINoteState.data,
    adminAINoteLoading: adminAINoteState.loading,
    adminAINoteError: adminAINoteState.error,
    saveAdminAINote,

    // AI Copilot
    aiCopilot: aiCopilotState.data,
    aiCopilotLoading: aiCopilotState.loading,
    aiCopilotError: aiCopilotState.error,
    getAICopilot,

    // Send to EHR
    sendToEhrResult: sendToEhrState.data,
    sendToEhrLoading: sendToEhrState.loading,
    sendToEhrError: sendToEhrState.error,
    sendToEhr,

    // Final note ID
    finalNoteUrl: finalNoteUrlState.data,
    finalNoteUrlLoading: finalNoteUrlState.loading,
    finalNoteUrlError: finalNoteUrlState.error,
    getFinalNoteUrl,

    // Full notes
    fullNotes: fullNotesState.data,
    fullNotesLoading: fullNotesState.loading,
    fullNotesError: fullNotesState.error,
    getFullNotes,

    // Rpa notes
    rpaNotes: rpaNotesState.data,
    rpaNotesLoading: rpaNotesState.loading,
    rpaNotesError: rpaNotesState.error,
    getRpaNotes,

    // Rpa webhook url
    rpaWebhookUrl: rpaWebhookUrlState.data,
    rpaWebhookUrlLoading: rpaWebhookUrlState.loading,
    rpaWebhookUrlError: rpaWebhookUrlState.error,
    addRpaWebhookUrl,

    // Get Rpa webhook url
    rpaCloudeFlowUrl: getRpaWebhookUrlState.data,
    rpaCloudeFlowUrlLoading: getRpaWebhookUrlState.loading,
    rpaCloudeFlowUrlError: getRpaWebhookUrlState.error,
    getRpaCloudeFlowUrl,

    // Get hospital templates
    hospitalTemplates: getHospitalTemplatesState.data,
    hospitalTemplatesLoading: getHospitalTemplatesState.loading,
    hospitalTemplatesError: getHospitalTemplatesState.error,
    getHospitalTemplates,

    // Add hospital template
    addHospitalTemplate: addHospitalTemplateState.data,
    addHospitalTemplateLoading: addHospitalTemplateState.loading,
    addHospitalTemplateError: addHospitalTemplateState.error,
    addHospitalsTemplate,

    // Remove hospital template
    removeHospitalTemplate: removeHospitalTemplateState.data,
    removeHospitalTemplateLoading: removeHospitalTemplateState.loading,
    removeHospitalTemplateError: removeHospitalTemplateState.error,
    removeHospitalsTemplate,

    // Get hospital locations
    hospitalLocations: getHospitalLocationsState.data,
    hospitalLocationsLoading: getHospitalLocationsState.loading,
    hospitalLocationsError: getHospitalLocationsState.error,
    getHospitalLocations,
  };
};
