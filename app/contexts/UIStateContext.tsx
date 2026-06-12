"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from "react";
import { TabType } from "../(pages)/(dashboard)/interfaces";

// Define modal types
export type ModalType =
  | "recordingDetail"
  | "recording"
  | "adminAi"
  | "ehr"
  | "copilotAi"
  | "codingSuggestions"
  | "fullNote"
  | "changePassword"
  | "viewProfile"
  | "rpaUrl"
  | null;

// Define loading state keys
export type LoadingStateKey =
  | "sessions"
  | "notes"
  | "transcription"
  | "diagnosisCodes"
  | "aiCopilot"
  | "finalNoteUrl"
  | "session";

interface UIStateContextType {
  // Modal state
  activeModal: ModalType;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;

  // For backward compatibility
  isRecordingDetailOpen: boolean;
  isRecordingOpen: boolean;
  isAdminAiOpen: boolean;
  isEhrOpen: boolean;
  isCopilotAiOpen: boolean;
  isCodingSuggestionsOpen: boolean;
  isFullNoteOpen: boolean;
  isChangePasswordOpen: boolean;
  isViewProfileOpen: boolean;
  isRpaUrlOpen: boolean;
  // Modal actions for backward compatibility
  openRecordingDetail: () => void;
  closeRecordingDetail: () => void;
  openRecording: () => void;
  closeRecording: () => void;
  openAdminAi: () => void;
  closeAdminAi: () => void;
  openEhr: () => void;
  closeEhr: () => void;
  openCopilotAi: () => void;
  closeCopilotAi: () => void;
  openCodingSuggestions: () => void;
  closeCodingSuggestions: () => void;
  openFullNote: () => void;
  closeFullNote: () => void;
  openChangePassword: () => void;
  closeChangePassword: () => void;
  openViewProfile: () => void;
  closeViewProfile: () => void;
  openRpaUrl: () => void;
  closeRpaUrl: () => void;

  // Recording state
  isUpdatingNote: boolean;
  setIsUpdatingNote: (isUpdating: boolean) => void;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export const UIStateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Modal state - single state for all modals
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Recording state
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);

  // Modal actions
  const openModal = useCallback((modal: ModalType) => {
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  // Computed modal states for backward compatibility
  const isRecordingDetailOpen = useMemo(
    () => activeModal === "recordingDetail",
    [activeModal],
  );
  const isRecordingOpen = useMemo(
    () => activeModal === "recording",
    [activeModal],
  );
  const isAdminAiOpen = useMemo(() => activeModal === "adminAi", [activeModal]);
  const isEhrOpen = useMemo(() => activeModal === "ehr", [activeModal]);
  const isCopilotAiOpen = useMemo(
    () => activeModal === "copilotAi",
    [activeModal],
  );
  const isCodingSuggestionsOpen = useMemo(
    () => activeModal === "codingSuggestions",
    [activeModal],
  );
  const isFullNoteOpen = useMemo(
    () => activeModal === "fullNote",
    [activeModal],
  );
  const isChangePasswordOpen = useMemo(
    () => activeModal === "changePassword",
    [activeModal],
  );
  const isViewProfileOpen = useMemo(
    () => activeModal === "viewProfile",
    [activeModal],
  );
  const isRpaUrlOpen = useMemo(
    () => activeModal === "rpaUrl",
    [activeModal],
  );
  // Modal actions for backward compatibility
  const openRecordingDetail = useCallback(
    () => setActiveModal("recordingDetail"),
    [],
  );
  const closeRecordingDetail = useCallback(() => setActiveModal(null), []);

  const openRecording = useCallback(() => {
    setActiveModal("recording");
  }, []);

  const closeRecording = useCallback(() => setActiveModal(null), []);

  const openAdminAi = useCallback(() => setActiveModal("adminAi"), []);
  const closeAdminAi = useCallback(() => setActiveModal(null), []);

  const openEhr = useCallback(() => setActiveModal("ehr"), []);
  const closeEhr = useCallback(() => setActiveModal(null), []);

  const openCopilotAi = useCallback(() => setActiveModal("copilotAi"), []);
  const closeCopilotAi = useCallback(() => setActiveModal(null), []);

  const openCodingSuggestions = useCallback(
    () => setActiveModal("codingSuggestions"),
    [],
  );
  const closeCodingSuggestions = useCallback(() => setActiveModal(null), []);

  const openFullNote = useCallback(() => setActiveModal("fullNote"), []);
  const closeFullNote = useCallback(() => setActiveModal(null), []);

  const openChangePassword = useCallback(() => setActiveModal("changePassword"), []);
  const closeChangePassword = useCallback(() => setActiveModal(null), []);
  const openViewProfile = useCallback(() => setActiveModal("viewProfile"), []);
  const closeViewProfile = useCallback(() => setActiveModal(null), []);

  const openRpaUrl = useCallback(() => setActiveModal("rpaUrl"), []);
  const closeRpaUrl = useCallback(() => setActiveModal(null), []);

  const value = {
    // Modal state
    activeModal,
    openModal,
    closeModal,

    // Modal states for backward compatibility
    isRecordingDetailOpen,
    isRecordingOpen,
    isAdminAiOpen,
    isEhrOpen,
    isCopilotAiOpen,
    isCodingSuggestionsOpen,
    isFullNoteOpen,
    isChangePasswordOpen,
    isViewProfileOpen,
    isRpaUrlOpen,
    // Modal actions for backward compatibility
    openRecordingDetail,
    closeRecordingDetail,
    openRecording,
    closeRecording,
    openAdminAi,
    closeAdminAi,
    openEhr,
    closeEhr,
    openCopilotAi,
    closeCopilotAi,
    openCodingSuggestions,
    closeCodingSuggestions,
    openFullNote,
    closeFullNote,
    openChangePassword,
    closeChangePassword,
    openViewProfile,
    closeViewProfile,
    openRpaUrl,
    closeRpaUrl,
    // Recording state
    isUpdatingNote,
    setIsUpdatingNote,
  };

  return (
    <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>
  );
};

export const useUIState = () => {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error("useUIState must be used within a UIStateProvider");
  }
  return context;
};
