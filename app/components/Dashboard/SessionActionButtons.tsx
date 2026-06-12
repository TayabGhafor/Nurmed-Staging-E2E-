"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { useUIState } from "../../contexts/UIStateContext";
import FullNoteModal from "../Modal/FullNoteModal";
import { useParams } from "next/navigation";
import { useFeature } from "../../hooks/useFeatureFlags";
import { FeatureKeys } from "../../types/feature-flags";
import AudioPlayer from "../AudioPlayer";
import {
  Medication,
  Message,
  Patient,
} from "../../(pages)/(dashboard)/interfaces";
import { Status } from "../../kyClient/dashboard";
import ConfirmSendToScribeModal from "../Modal/ConfirmSendToScribeModal";

interface SessionActionButtonsProps {
  isMobile?: boolean;
  isLoading?: boolean;
  messages?: Message[];
  audioUrl?: string | null;
  isAudioLoading?: boolean;
  session?: Patient | null;
  medications?: Medication[];
  fetchAndTransformNotes?: (sessionId: number) => void;
  /** Set when scribe job is queued (ehr_status 200 + scribe_job_queued) — blocks another send */
  disableEhrOrScribeSend?: boolean;
  /** Called after send-to-EHR returns a queued scribe job so the parent can lock UI immediately */
  onScribeJobQueued?: () => void;
}

const SessionActionButtons: React.FC<SessionActionButtonsProps> = ({
  isMobile = false,
  isLoading = false,
  messages = [],
  audioUrl = null,
  isAudioLoading = false,
  session = null,
  medications = [],
  fetchAndTransformNotes,
  disableEhrOrScribeSend = false,
  onScribeJobQueued,
}) => {
  // Get UI state context
  const {
    openCopilotAi: onCopilotClick,
    openAdminAi: onAdminAiClick,
    openCodingSuggestions: onCodingSuggestionsClick,
    openEhr: onEhrClick,
    openFullNote: onFullNoteClick,
    isFullNoteOpen,
    closeFullNote,
    openModal,
    setIsUpdatingNote,
  } = useUIState();

  // Get session ID from URL params
  const params = useParams();
  const sessionId = params?.id as string;

  // Feature flag checks
  const hasAICopilot = useFeature(FeatureKeys.AI_COPILOT);
  const hasAdministrationAI = useFeature(FeatureKeys.ADMINISTRATION_AI);
  const hasCodingSuggestions = useFeature(FeatureKeys.CODING_SUGGESTIONS);
  const hasEHRIntegration = useFeature(FeatureKeys.EHR_INTEGRATION);
  const canGenerateNotes = useFeature(FeatureKeys.GENERATE_NOTES);
  const canCreateSession = useFeature(FeatureKeys.CREATE_SESSION);

  // Determine if current session is deleted (string-safe comparison)
  const isDeleted =
    !!session && String(session.status) === String(Status.Deleted);

  const region = process.env.NEXT_PUBLIC_REGION;
  const isDubaiRegion = region === "dubai";

  const [isSendToScribeModalOpen, setIsSendToScribeModalOpen] = useState(false);

  const handleAddAdditionalNote = () => {
    if (disableEhrOrScribeSend) {
      toast.error(
        "These notes have already been sent to the assigned scribe.",
        { duration: 3000, position: "bottom-right" },
      );
      return;
    }
    openModal("recording");
    setIsUpdatingNote(true);
  };

  const openSendToScribeModal = () => {
    if (!session?.id) return;
    setIsSendToScribeModalOpen(true);
  };

  const ehrButtonLabel = region === 'dubai' ? "Send to Scribe" : "Send to EHR";

  const isScribeRegion = !!region && region !== 'Global';
  const isNonDubaiRegion = region !== 'dubai';

  const handleEhrOrScribeClick = () => {
    if (disableEhrOrScribeSend) {
      toast.error(
        isScribeRegion
          ? "These notes have already been sent to the assigned scribe."
          : "These notes have already been sent to the EHR and cannot be sent again.",
        { duration: 3000, position: "bottom-right" },
      );
      return;
    }
    if (isScribeRegion) {
      openSendToScribeModal();
    } else {
      onEhrClick();
    }
  };

  const ehrButtonLockedClass = disableEhrOrScribeSend
    ? "cursor-not-allowed opacity-60"
    : "";

  const scribeSendButtonClass = disableEhrOrScribeSend
    ? "cursor-not-allowed bg-gray-400 text-gray-200 hover:bg-gray-400"
    : "bg-[#2036B3] text-white";

  const addAdditionalNoteButtonClass = disableEhrOrScribeSend
    ? "cursor-not-allowed bg-gray-400 text-gray-200 hover:bg-gray-400"
    : "bg-primary-100 text-white";

  /** Dubai: Administration AI follows Send to Scribe lock (already sent to scribe). */
  const adminAiLockedClass = region ? ehrButtonLockedClass : "";

  const handleAdminAiClick = () => {
    if (region && disableEhrOrScribeSend) {
      toast.error(
        "These notes have already been sent to the assigned scribe.",
        { duration: 3000, position: "bottom-right" },
      );
      return;
    }
    onAdminAiClick();
  };

  const sendToScribeModal =
    isScribeRegion && isSendToScribeModalOpen && session ? (
      <ConfirmSendToScribeModal
        onClose={() => setIsSendToScribeModalOpen(false)}
        session={session}
        medications={medications}
        fetchAndTransformNotes={fetchAndTransformNotes}
        onScribeJobQueued={onScribeJobQueued}
      />
    ) : null;

  if (isMobile) {
    return (
      <div className="space-y-2">
        {isLoading ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-10 animate-pulse rounded-lg border border-gray-200 bg-gray-100"></div>
              <div className="h-10 animate-pulse rounded-lg bg-gray-200"></div>
            </div>
            <div className="flex flex-col space-y-2">
              <div className="h-10 animate-pulse rounded-lg bg-gray-200"></div>
              <div className="h-10 animate-pulse rounded-lg bg-gray-200"></div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {isNonDubaiRegion && hasAICopilot && !isDeleted && (
              <button
                onClick={onCopilotClick}
                className="whitespace-nowrap rounded-lg border border-[#2174FD] bg-white px-4 py-2 text-sm text-[#2174FD] shadow-md"
              >
                AI Copilot
              </button>
            )}
            {isNonDubaiRegion && hasAdministrationAI && (
              <button
                type="button"
                onClick={handleAdminAiClick}
                className={`whitespace-nowrap rounded-lg bg-gradient-to-r from-[#2641DA] to-[#C43FE9] px-4 py-2 text-sm text-white shadow-md ${adminAiLockedClass}`}
              >
                Administration AI
              </button>
            )}
            {isNonDubaiRegion && hasCodingSuggestions && (
              <button
                onClick={onCodingSuggestionsClick}
                className="whitespace-nowrap rounded-lg bg-[#2174FD] px-4 py-2 text-sm text-white shadow-md"
              >
                Optimise Coding
              </button>
            )}
            {isNonDubaiRegion && canGenerateNotes && (
              <button
                className="whitespace-nowrap rounded-lg border border-[#C43FE9] bg-white px-4 py-2 text-sm text-[#C43FE9] shadow-md"
                onClick={onFullNoteClick}
              >
                View Full Note
              </button>
            )}
            {isDubaiRegion && canCreateSession && !isDeleted && (
              <button
                type="button"
                disabled={disableEhrOrScribeSend}
                onClick={handleAddAdditionalNote}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm shadow-md ${addAdditionalNoteButtonClass}`}
              >
                Add Additional Note
              </button>
            )}
            {hasEHRIntegration && (
              <button
                type="button"
                disabled={disableEhrOrScribeSend}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm shadow-md ${scribeSendButtonClass}`}
                onClick={handleEhrOrScribeClick}
              >
                {ehrButtonLabel}
              </button>
            )}
          </div>
        )}
        {sendToScribeModal}
      </div>
    );
  }

  return (
    <div
      className={`flex w-full flex-wrap items-center justify-between gap-2${
      region === 'dubai' ? " flex-row-reverse" : ""
      }`}
    >
      {isLoading ? (
        <>
          <div className="h-8 w-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100"></div>
          <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200"></div>
          <div className="h-8 w-28 animate-pulse rounded-lg bg-gray-200"></div>
          <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-200"></div>
        </>
      ) : (
        <div className={`flex flex-wrap items-end gap-2 ${(isDeleted || !audioUrl) ? 'py-5' : ''}`}>
          {isNonDubaiRegion && hasAICopilot && !isDeleted && (
            <button
              onClick={onCopilotClick}
              className="rounded-lg border border-[#2174FD] px-4 py-2 text-xs text-[#2174FD]"
            >
              AI Copilot
            </button>
          )}
          {isNonDubaiRegion && hasAdministrationAI && (
            <button
              type="button"
              onClick={handleAdminAiClick}
              className={`rounded-lg bg-gradient-to-r from-[#2641DA] to-[#C43FE9] px-4 py-2 text-xs text-white ${adminAiLockedClass}`}
            >
              Administration AI
            </button>
          )}
          {isNonDubaiRegion && hasCodingSuggestions && (
            <button
              onClick={onCodingSuggestionsClick}
              className="rounded-lg bg-[#2174FD] px-4 py-2 text-xs text-white"
            >
              Optimise Coding
            </button>
          )}
          {isNonDubaiRegion && canGenerateNotes && (
            <button
              onClick={onFullNoteClick}
              className="rounded-lg border border-[#C43FE9] bg-white px-4 py-2 text-xs text-[#C43FE9]"
            >
              View Full Note
            </button>
          )}
          {isDubaiRegion && canCreateSession && !isDeleted && (
            <button
              type="button"
              disabled={disableEhrOrScribeSend}
              onClick={handleAddAdditionalNote}
              className={`rounded-lg px-4 py-2 text-xs ${addAdditionalNoteButtonClass}`}
            >
              Add Additional Note
            </button>
          )}
          {hasEHRIntegration && (
            <button
              type="button"
              disabled={disableEhrOrScribeSend}
              onClick={handleEhrOrScribeClick}
              className={`rounded-lg px-4 py-2 text-xs ${scribeSendButtonClass}`}
            >
              {ehrButtonLabel}
            </button>
          )}
        </div>
      )}
      {sendToScribeModal}
      {/* Desktop audio player - hide for deleted sessions and don't show loader */}
      {!isDeleted && audioUrl && (
        <div className="flex items-center justify-center">
          <AudioPlayer
            audioFileUrl={audioUrl}
            hideSkeleton={isDeleted}
            audioDuration={session?.sessionDurationSeconds}
            />
        </div>
      )}
    </div>
  );
};

// Render the FullNoteModal when it's open
export const FullNoteModalWrapper = () => {
  const { isFullNoteOpen, closeFullNote } = useUIState();
  const params = useParams();
  const sessionId = params?.id as string;

  if (!isFullNoteOpen) return null;

  return <FullNoteModal onClose={closeFullNote} sessionId={sessionId} />;
};

export default SessionActionButtons;
