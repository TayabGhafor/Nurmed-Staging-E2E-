"use client";

import { useState } from "react";
import Modal from ".";
import NoteMarkdown from "../NoteMarkdown";
import { useSession } from "../../hooks/useSession";
import { Medication, Patient } from "../../(pages)/(dashboard)/interfaces";
import toast from "react-hot-toast";

const DUBAI_SEND_TO_EHR_PAYLOAD = {
  hospital: "YAS" as const,
  vdr_id: "36",
  encounter_id: "N-1234",
};

interface ConfirmSendToScribeModalProps {
  onClose: () => void;
  session: Patient;
  medications: Medication[];
  fetchAndTransformNotes?: (sessionId: number) => void;
  onScribeJobQueued?: () => void;
}

const ConfirmSendToScribeModal = ({
  onClose,
  session,
  medications,
  fetchAndTransformNotes,
  onScribeJobQueued,
}: ConfirmSendToScribeModalProps) => {
  const { sendToEhr, sendToEhrLoading } = useSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!session?.id) return;
    setErrorMessage(null);

    const episodeId = session.episode_id?.trim();
    const result = await sendToEhr(Number(session.id), {
      ...DUBAI_SEND_TO_EHR_PAYLOAD,
      mrn: session.mrn,
      ...(episodeId ? { episode_id: episodeId } : {}),
    });

    if (result) {
      onScribeJobQueued?.();
      fetchAndTransformNotes?.(Number(session.id));
      toast.success("Notes have been sent.", {
        duration: 3000,
        position: "bottom-right",
      });
      onClose();
    } else {
      const msg = "Could not send notes. Please try again.";
      setErrorMessage(msg);
      toast.error(msg, {
        duration: 3000,
        position: "bottom-right",
      });
    }
  };

  return (
    <Modal
      className="flex max-h-[90dvh] w-full flex-col bg-white sm:max-w-2xl sm:rounded-lg"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Review notes before sending
          </h3>
          <p className="mt-1 text-sm text-secondary-100">
            Confirm only after you have reviewed the note sections below. They
            will be sent to the scribe / EHR when you tap Send.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[#E3E6EA] bg-[#FAFBFC] p-3 sm:p-4">
          {medications.length === 0 ? (
            <p className="text-sm text-secondary-100">
              No note sections are available for this session yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {medications.map((m) => (
                <li key={m.id}>
                  <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                  <div className="mt-1 min-w-0">
                    <NoteMarkdown markdown={m.content} className="text-gray-700" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {errorMessage ? (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sendToEhrLoading}
            className="rounded-lg bg-primary-100 px-4 py-2 text-sm text-white shadow-sm disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={sendToEhrLoading}
            className="rounded-lg bg-primary-dark px-4 py-2 text-sm text-white shadow-sm disabled:opacity-60"
          >
            {sendToEhrLoading ? "Sending..." : "Yes, send notes"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmSendToScribeModal;
