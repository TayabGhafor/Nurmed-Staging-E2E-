"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Safe wrapper for useSearchParams
function SearchParamsWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<></>}>{children}</Suspense>;
}
import EmptyState from "../../components/EmptyState";
import { useUIState } from "../../contexts/UIStateContext";
import {
  AdministrationAiModel,
  RecordingDeatilModal,
  RecordingModal,
} from "../../components";
import CodingSuggestionsModel from "../../components/Modal/CodingSuggestionsModel";
import CopilotAi from "../../components/Modal/CopilotAi";
import EhrModel from "../../components/Modal/EhrModel";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { useSessionContext } from "../../contexts/SessionContext";
import { useSession } from "../../hooks/useSession";
import { Patient } from "./interfaces";
import { isNewHospitalSession, getHospitalParamsFromUrl, clearHospitalParamsFromUrl } from "../../utils/hospital-params";
import { useFeatures } from "../../hooks/useFeatureFlags";
import { FeatureKeys } from "../../types/feature-flags";
import { FeatureFlag } from "../../components/FeatureFlag";

function DashboardContent() {
  const { openRecordingDetail } = useUIState();
  const { fetchSessions } = useSessionContext();
  const { getNotes,
    //  getTranscription
     } = useSession();
  const searchParams = useSearchParams();
  
  // Get feature flags
  const features = useFeatures([
    FeatureKeys.CREATE_SESSION,
    FeatureKeys.GENERATE_NOTES,
    FeatureKeys.VIEW_TRANSCRIPTIONS,
    FeatureKeys.AI_COPILOT,
    FeatureKeys.EHR_INTEGRATION,
    FeatureKeys.CODING_SUGGESTIONS,
    FeatureKeys.ADMINISTRATION_AI,
  ]);

  // Local state for the dashboard
  const [selectedSession, setSelectedSession] = useState<Patient | null>(null);
  const [sessionData, setSessionData] = useState<{
    mrn: string;
    episode_id: string;
    department: string;
    language: string;
    hospital_data?: any;
    audioInputDeviceId?: string;
  }>({
    mrn: "",
    episode_id: "",
    department: "",
    language: "",
    hospital_data: undefined,
  });

  // Get audio recorder hook
  const {
    isRecording,
    recordedAudioFile,
    audioPreviewUrl,
    recordingTime,
    recordingDurationSeconds,
    pauseRecording,
    resumeRecording,
    isPaused,
    stopRecording,
    startRecording,
  } = useAudioRecorder();

  // Get UI state context
  const {
    activeModal,
    openModal,
    closeModal,
    isUpdatingNote,
    setIsUpdatingNote,
  } = useUIState();


  // Auto-open recording modal if new=true is in URL params
  useEffect(() => {
    if (isNewHospitalSession(searchParams)) {
      // Small delay to ensure UI is fully loaded
      setTimeout(() => {
        openRecordingDetail();
      }, 100);
    }
  }, [searchParams, openRecordingDetail]);

  // Handle closing the recording detail modal when opened via query params
  const handleRecordingDetailClose = () => {
    // Clear hospital parameters from URL when modal is closed
    if (isNewHospitalSession(searchParams)) {
      clearHospitalParamsFromUrl();
    }
    closeModal();
  };

  // Function to fetch and transform notes
  const fetchAndTransformNotes = async (sessionId: number) => {
    try {
      const notesData = await getNotes(sessionId);
      return notesData;
    } catch (error) {
      console.error("Error fetching notes:", error);
      return [];
    }
  };

  // Function to fetch and transform transcription
  // const fetchAndTransformTranscription = async (sessionId: number) => {
  //   try {
  //     const transcriptionData = await getTranscription(sessionId);
  //     return transcriptionData;
  //   } catch (error) {
  //     console.error("Error fetching transcription:", error);
  //     return [];
  //   }
  // };

  return (
    <>
      <FeatureFlag feature={FeatureKeys.CREATE_SESSION}>
        <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
          <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
            <div className="lg:col-span-3">
              <h3 className="w-full border-b border-[#E3E6EA] p-4 md:p-5">
                Create New Recording
              </h3>
              <div className="flex h-[calc(100dvh-10rem)] flex-1 flex-col items-center justify-center p-4">
                <EmptyState
                  className="w-full max-w-3xl rounded-xl border border-secondary-200 p-10 shadow-2xl"
                  btnAction={openRecordingDetail}
                />
              </div>
            </div>
          </div>
        </div>
      </FeatureFlag>

      {/* Render modals based on activeModal state */}
      {/* Only render the modal that is currently active */}
      {(() => {
        // Use an IIFE to encapsulate the modal rendering logic

        switch (activeModal) {
          case "adminAi":
            return features[FeatureKeys.ADMINISTRATION_AI] ? (
              <AdministrationAiModel
                sessionId={selectedSession?.id}
                onClose={closeModal}
                fetchAndTransformNotes={fetchAndTransformNotes}
                // fetchAndTransformTranscription={fetchAndTransformTranscription}
              />
            ) : null;

          case "recordingDetail":
            return features[FeatureKeys.CREATE_SESSION] ? (
              <RecordingDeatilModal
                onClose={handleRecordingDetailClose}
                onStart={() => {
                  openModal("recording");
                  setIsUpdatingNote(false);
                }}
                setSessionData={setSessionData}
              />
            ) : null;

          case "recording":
            return features[FeatureKeys.CREATE_SESSION] ? (
              <RecordingModal
                onStop={closeModal}
                sessionData={sessionData}
                fetchSessions={fetchSessions}
                isRecording={isRecording}
                recordedAudioFile={recordedAudioFile}
                audioPreviewUrl={audioPreviewUrl}
                recordingTime={recordingTime}
                recordingDurationSeconds={recordingDurationSeconds}
                pauseRecording={pauseRecording}
                resumeRecording={resumeRecording}
                isPaused={isPaused}
                startRecording={startRecording}
                stopRecording={stopRecording}
                isUpdatingNote={isUpdatingNote}
                sessionId={selectedSession?.id}
                fetchAndTransformNotes={fetchAndTransformNotes}
              />
            ) : null;

          case "ehr":
            return features[FeatureKeys.EHR_INTEGRATION] ? (
              <EhrModel
                patient={selectedSession}
                onClose={closeModal}
                fetchAndTransformNotes={fetchAndTransformNotes}
                // fetchAndTransformTranscription={fetchAndTransformTranscription}
              />
            ) : null;

          case "copilotAi":
            return features[FeatureKeys.AI_COPILOT] ? (
              <CopilotAi
                addAdditionalNote={() => {
                  openModal("recording");
                  setIsUpdatingNote(true);
                }}
                sessionId={selectedSession?.id}
                onClose={closeModal}
              />
            ) : null;

          case "codingSuggestions":
            return features[FeatureKeys.CODING_SUGGESTIONS] ? (
              <CodingSuggestionsModel
                onClose={closeModal}
                sessionId={selectedSession?.id}
                fetchAndTransformNotes={fetchAndTransformNotes}
                // fetchAndTransformTranscription={fetchAndTransformTranscription}
              />
            ) : null;

          default:
            return null;
        }
      })()}
    </>
  );
}

export default function Dashboard() {
  return (
    <SearchParamsWrapper>
      <DashboardContent />
    </SearchParamsWrapper>
  );
}