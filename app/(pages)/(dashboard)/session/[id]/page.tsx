"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessionContext } from "../../../../contexts/SessionContext";
import DashboardContent from "../../../../components/Dashboard/DashboardContent";
import {
  AdministrationAiModel,
  RecordingDeatilModal,
  RecordingModal,
} from "../../../../components";
import CodingSuggestionsModel from "../../../../components/Modal/CodingSuggestionsModel";
import CopilotAi from "../../../../components/Modal/CopilotAi";
import EhrModel from "../../../../components/Modal/EhrModel";
import { useAudioRecorder } from "../../../../hooks/useAudioRecorder";
import { useUIState } from "../../../../contexts/UIStateContext";
import { useRouteSession } from "../../../../hooks/useRouteSession";
import Loader from "../../../../components/Loader";
import FullNoteModal from "../../../../components/Modal/FullNoteModal";
import { useFeatures } from "../../../../hooks/useFeatureFlags";
import { FeatureKeys } from "../../../../types/feature-flags";
import RpaNoteModal from "../../../../components/Modal/RpaNoteModal";

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { fetchSessions } = useSessionContext();

  const region = process.env.NEXT_PUBLIC_REGION

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

  // Use the route-level session hook
  const {
    currentSession,
    medications,
    // messages,
    isLoading,
    finalNoteUrl,
    sessionData,
    setSessionData,
    fetchAndTransformNotes,
    // fetchAndTransformTranscription,
    handleMedicationEdit,
    handleCopyMedication,
    markScribeJobQueued,
  } = useRouteSession(sessionId);

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

  // Log modal changes only when activeModal changes
  useEffect(() => {
    if (activeModal) {
      console.log("Current active modal:", activeModal);
    }
  }, [activeModal]);

  // Show loading state while session data is being fetched
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <>
      <DashboardContent
        session={currentSession}
        medications={medications}
        // messages={messages}
        finalNoteUrl={finalNoteUrl}
        handleMedicationEdit={handleMedicationEdit}
        handleCopyMedication={handleCopyMedication}
        fetchAndTransformNotes={fetchAndTransformNotes}
        onScribeJobQueued={markScribeJobQueued}
      />

      {/* Render modals based on activeModal state */}
      {/* Only render the modal that is currently active */}
      {(() => {
        // Use an IIFE to encapsulate the modal rendering logic
        switch (activeModal) {
          case "adminAi":
            return features[FeatureKeys.ADMINISTRATION_AI] ? (
              <AdministrationAiModel
                sessionId={currentSession?.id}
                onClose={closeModal}
                fetchAndTransformNotes={fetchAndTransformNotes}
              // fetchAndTransformTranscription={fetchAndTransformTranscription}
              />
            ) : null;

          case "recordingDetail":
            return features[FeatureKeys.CREATE_SESSION] ? (
              <RecordingDeatilModal
                onClose={closeModal}
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
                sessionId={currentSession?.id}
                fetchAndTransformNotes={fetchAndTransformNotes}
              />
            ) : null;

          case "ehr":
            return features[FeatureKeys.EHR_INTEGRATION] ? (
              region === "dubai" ? (
                <RpaNoteModal
                  patient={currentSession}
                  onClose={closeModal}
                />
              ) : (
                <EhrModel
                  patient={currentSession}
                  onClose={closeModal}
                  fetchAndTransformNotes={fetchAndTransformNotes}
                />
              )
            ) : null;

          case "copilotAi":
            return features[FeatureKeys.AI_COPILOT] ? (
              <CopilotAi
                addAdditionalNote={() => {
                  openModal("recording");
                  setIsUpdatingNote(true);
                }}
                sessionId={currentSession?.id}
                onClose={closeModal}
              />
            ) : null;

          case "codingSuggestions":
            return features[FeatureKeys.CODING_SUGGESTIONS] ? (
              <CodingSuggestionsModel
                onClose={closeModal}
                sessionId={currentSession?.id}
                fetchAndTransformNotes={fetchAndTransformNotes}
              // fetchAndTransformTranscription={fetchAndTransformTranscription}
              />
            ) : null;

          case "fullNote":
            return features[FeatureKeys.GENERATE_NOTES] ? (
              <FullNoteModal
                onClose={closeModal}
                sessionId={currentSession?.id?.toString()}
              />
            ) : null;

          default:
            return null;
        }
      })()}
    </>
  );
}
