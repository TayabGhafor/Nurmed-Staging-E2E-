"use client";

import React, { useState } from "react";
import MedicationCard from "./MedicationCard";
import SessionActionButtons from "./SessionActionButtons";
import MedSkeleton from "../MedSkeleton";
import { Medication, Patient } from "../../(pages)/(dashboard)/interfaces";

interface ExaminationSectionProps {
  medications?: Medication[];
  handleMedicationEdit?: (
    medicationId: string,
    newContent: string,
  ) => Promise<void>;
  handleCopyMedication?: (content: string) => void;
  isLoading?: boolean;
  finalNoteUrl?: string | null;
  session?: Patient | null;
  fetchAndTransformNotes?: (sessionId: number) => void;
  scribeJobSendLocked?: boolean;
  onScribeJobQueued?: () => void;
}

const ExaminationSection: React.FC<ExaminationSectionProps> = ({
  medications = [],
  handleMedicationEdit,
  handleCopyMedication,
  isLoading = false,
  finalNoteUrl = null,
  session = null,
  fetchAndTransformNotes,
  scribeJobSendLocked = false,
  onScribeJobQueued,
}) => {
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(
    null,
  );

  // Wrapper functions to handle medication edit and copy
  const onMedicationEdit = handleMedicationEdit;
  const onMedicationCopy = handleCopyMedication;

  return (
    <div className="flex max-h-[calc(100dvh-21.5rem)] flex-1 flex-col overflow-y-auto md:max-h-[calc(100dvh-5.5rem)] lg:col-span-2">
      <div className="hidden justify-end border-b border-[#E3E6EA] px-4 md:flex md:px-6">
        <SessionActionButtons
          isLoading={isLoading}
          audioUrl={finalNoteUrl}
          isAudioLoading={isLoading}
          session={session}
          medications={medications}
          fetchAndTransformNotes={fetchAndTransformNotes}
          disableEhrOrScribeSend={scribeJobSendLocked}
          onScribeJobQueued={onScribeJobQueued}
        />
      </div>

      {isLoading ? (
        <MedSkeleton />
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {medications.map((medication) => (
            <MedicationCard
              key={medication.id}
              id={medication.id}
              title={medication.title}
              content={medication.content}
              editingId={editingMedicationId}
              setEditingId={setEditingMedicationId}
              onEdit={onMedicationEdit}
              onCopy={onMedicationCopy}
              editDisabled={scribeJobSendLocked}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExaminationSection;
