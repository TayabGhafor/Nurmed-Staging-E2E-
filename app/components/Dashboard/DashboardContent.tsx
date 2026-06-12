"use client";

import React, { useCallback, useState } from "react";
import { Status } from "../../kyClient/dashboard";
import {
  Medication,
  Message,
  Patient,
  TabType,
} from "../../(pages)/(dashboard)/interfaces";
import EmptyState from "../EmptyState";
import ExaminationSection from "./ExaminationSection";
import ConversationSection from "./ConversationSection";
import SessionHeader from "./SessionHeader";
import SessionActionButtons from "./SessionActionButtons";
import { useUIState } from "../../contexts/UIStateContext";
import { useMicrophone } from "../../contexts/MicrophoneContext";
import { useRouter } from "next/navigation";
import { isEhrOrScribeSendLocked } from "../../utils/ehrStatus";
import toast from "react-hot-toast";

interface DashboardContentProps {
  session?: Patient | null;
  medications?: Medication[];
  messages?: Message[];
  finalNoteUrl?: string | null;
  handleMedicationEdit?: (
    medicationId: string,
    newContent: string,
  ) => Promise<void>;
  handleCopyMedication?: (content: string) => void;
  isLoading?: boolean;
  fetchAndTransformNotes?: (sessionId: number) => void;
  /** Patches session after send-to-scribe so EHR locks apply immediately */
  onScribeJobQueued?: () => void;
}

const DashboardContent: React.FC<DashboardContentProps> = ({
  session: selectedPatient = null,
  medications = [],
  messages = [],
  finalNoteUrl = null,
  handleMedicationEdit,
  handleCopyMedication,
  isLoading: externalIsLoading = false,
  fetchAndTransformNotes,
  onScribeJobQueued,
}) => {
  const router = useRouter();

  // Get UI state context
  const { openModal, openRecordingDetail: openRecordingDetailAction } = useUIState();
  const {
    isMicReady,
    permission: micPermission,
    micGateMessage,
    requestAccess: requestMicAccess,
  } = useMicrophone();

  const onNewRecording = useCallback(() => {
    if (isMicReady) {
      openRecordingDetailAction();
      return;
    }
    toast.error(micGateMessage, { id: "mic-gate", duration: 3000, position: "bottom-right" });
    if (micPermission === "prompt") requestMicAccess();
  }, [
    isMicReady,
    openRecordingDetailAction,
    micGateMessage,
    micPermission,
    requestMicAccess,
  ]);

  // Local state for active tab
  const [activeTab, setActiveTab] = useState<TabType>("examinations");

  // Handle going back to sessions list
  const handleBackToPatients = useCallback(() => {
    // Navigate back to the dashboard page
    router.push("/");
  }, [router]);

  // Modal actions using the new approach
  const onCopilotClick = useCallback(() => openModal("copilotAi"), [openModal]);
  const onAdminAiClick = useCallback(() => openModal("adminAi"), [openModal]);
  const onCodingSuggestionsClick = useCallback(
    () => openModal("codingSuggestions"),
    [openModal],
  );
  const onEhrClick = useCallback(() => openModal("ehr"), [openModal]);

  // Use external loading state
  const isLoading = externalIsLoading;

  // Send-to-scribe / edit lock only applies in the Dubai region; Global keeps
  // both actions available even after an EHR send.
  const scribeJobSendLocked =
    process.env.NEXT_PUBLIC_REGION === "dubai" &&
    isEhrOrScribeSendLocked(selectedPatient);

  return (
    <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
        {selectedPatient && (
          <SessionHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            session={selectedPatient}
            onBackClick={handleBackToPatients}
          />
        )}

        {/* Content area */}
        <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
          {selectedPatient && selectedPatient.status !== Status.Failed ? (
            <>
              {/* Left Section - Medications */}
              <div
                className={`lg:col-span-2 ${activeTab === "examinations" || !selectedPatient ? "block" : "hidden md:block"}`}
              >
                <ExaminationSection
                  medications={medications}
                  handleMedicationEdit={handleMedicationEdit}
                  handleCopyMedication={handleCopyMedication}
                  isLoading={isLoading}
                  finalNoteUrl={finalNoteUrl}
                  session={selectedPatient}
                  fetchAndTransformNotes={fetchAndTransformNotes}
                  scribeJobSendLocked={scribeJobSendLocked}
                  onScribeJobQueued={onScribeJobQueued}
                />
              </div>

              {/* Right Section - Messages */}
              <div
                className={`${activeTab === "conversations" || !selectedPatient ? "block" : "hidden md:block"}`}
              >
                <ConversationSection
                  messages={messages}
                  isLoading={isLoading}
                  audioUrl={finalNoteUrl}
                  isAudioLoading={isLoading}
                  session={selectedPatient}
                />
              </div>
            </>
          ) : (
            <div className="lg:col-span-3">
              <h3 className="w-full border-b border-[#E3E6EA] p-4 md:p-5">
                Create New Recording
              </h3>
              <div className="flex h-[calc(100dvh-10rem)] flex-1 flex-col items-center justify-center p-4">
                <EmptyState
                  className="w-full max-w-3xl rounded-xl border border-secondary-200 p-10 shadow-2xl"
                  btnAction={onNewRecording}
                />
              </div>
            </div>
          )}
        </div>

        {/* Mobile buttons */}
        {selectedPatient && selectedPatient.status !== Status.Failed && (
          <>
            <div
              className={`fixed bottom-2 left-0 right-0 z-50 space-y-3 bg-gradient-to-t from-white to-transparent p-4 md:hidden ${activeTab === "conversations" ? "hidden" : "block"}`}
            >
              <SessionActionButtons
                isMobile={true}
                isLoading={isLoading}
                audioUrl={finalNoteUrl}
                isAudioLoading={isLoading}
                session={selectedPatient}
                medications={medications}
                fetchAndTransformNotes={fetchAndTransformNotes}
                disableEhrOrScribeSend={scribeJobSendLocked}
                onScribeJobQueued={onScribeJobQueued}
              />
            </div>

            <div
              className={`fixed bottom-6 left-0 right-0 z-50 px-4 md:hidden ${activeTab === "examinations" || activeTab === "conversations" ? "hidden" : "block"}`}
            >
              <button
                onClick={onNewRecording}
                aria-disabled={!isMicReady}
                title={!isMicReady ? micGateMessage : undefined}
                className={`flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm shadow-lg transition-colors ${
                  isMicReady
                    ? "bg-[#2832A8] text-white"
                    : "bg-slate-300 text-slate-600 cursor-not-allowed"
                }`}
              >
                <span className="mr-2 text-lg">+</span>
                Start New Recording
              </button>
            </div>

            {/* <div
              className={`md:hidden ${activeTab === "conversations" ? "h-6" : "h-32"}`}
            ></div> */}
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardContent;
