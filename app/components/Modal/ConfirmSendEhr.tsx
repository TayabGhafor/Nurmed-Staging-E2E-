import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../../hooks/useSession";
import Modal from ".";
import { SaveEHRICon } from "../svgs";
import { SendToEhrRequest } from "../../kyClient/dashboard";
import toast from "react-hot-toast";

interface ConfirmSendEhrProps {
  onClose: () => void;
  sendToEhrRequest: SendToEhrRequest;
  sessionId: string | undefined;
  // fetchAndTransformTranscription: (sessionId: number) => void;
  fetchAndTransformNotes: (sessionId: number) => void;
}

const CELERY_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  INPROGRESS: "INPROGRESS",
  IN_PROGRESS: "IN_PROGRESS",
  STARTED: "STARTED",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

function isCeleryInProgress(status: string | undefined): boolean {
  if (!status) return false;
  const u = status.toUpperCase();
  return (
    u === CELERY_STATUS.PENDING ||
    u === CELERY_STATUS.PROCESSING ||
    u === CELERY_STATUS.INPROGRESS ||
    u === CELERY_STATUS.IN_PROGRESS ||
    u === CELERY_STATUS.STARTED ||
    u === CELERY_STATUS.RUNNING
  );
}

type RpaNotesResponse = any;

const ConfirmSendEhr = ({
  onClose,
  sendToEhrRequest,
  sessionId,
  // fetchAndTransformTranscription,
  fetchAndTransformNotes,
}: ConfirmSendEhrProps) => {
  const {
    sendToEhr,
    sendToEhrLoading,
    sendToEhrError,
    sendToEhrResult,
    getRpaNotes,
  } = useSession();

  const [isSent, setIsSent] = useState(false);
  const [isReviewNotesLoading, setIsReviewNotesLoading] = useState(false);
  const [reviewNotesStatus, setReviewNotesStatus] = useState<string>("");
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPollTimeout = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  const pollRpaNotesUntilReady = useCallback(
    async (sid: string) => {
      clearPollTimeout();
      setIsReviewNotesLoading(true);

      try {
        const ret: RpaNotesResponse = await getRpaNotes(sid);
        const status = String(ret?.celery_status ?? ret?.status ?? "");
        const statusUpper = status.toUpperCase();
        setReviewNotesStatus(statusUpper);

        if (statusUpper === CELERY_STATUS.SUCCESS) {
          setIsReviewNotesLoading(false);
          return;
        }

        if (statusUpper === CELERY_STATUS.FAILED) {
          setIsReviewNotesLoading(false);
          toast.error("Failed to load review notes. Please try again.", {
            duration: 1500,
            position: "bottom-right",
          });
          return;
        }

        if (isCeleryInProgress(statusUpper)) {
          pollTimeoutRef.current = setTimeout(() => {
            pollRpaNotesUntilReady(sid);
          }, 10000);
          return;
        }

        // Unknown/missing status: don't block UI indefinitely.
        setIsReviewNotesLoading(false);
      } catch (e) {
        console.error("Error fetching RPA notes:", e);
        setIsReviewNotesLoading(false);
        toast.error("Error loading review notes. Please try again.", {
          duration: 1500,
          position: "bottom-right",
        });
      }
    },
    [getRpaNotes],
  );

  // Guards against React StrictMode's intentional double-fire of effects in
  // dev (which otherwise kicks off two concurrent poll loops sharing the same
  // pollTimeoutRef and hits rpa_notes/<id> twice on mount). Keyed by
  // sessionId so reopening for a different session still re-polls.
  const polledSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setIsReviewNotesLoading(false);
      setReviewNotesStatus("");
      return;
    }
    if (polledSessionIdRef.current === sessionId) return;
    polledSessionIdRef.current = sessionId;

    pollRpaNotesUntilReady(sessionId);
    return () => {
      clearPollTimeout();
    };
  }, [pollRpaNotesUntilReady, sessionId]);

  useEffect(() => {
    if (sendToEhrError) {
      console.error("Error sending to EHR:", sendToEhrError);
      toast.error("Error sending to EHR!", {
        duration: 1000,
        position: "bottom-right",
      });
    }
  }, [sendToEhrError]);

  useEffect(() => {
    if (sendToEhrResult) {
      console.log("Successfully sent to EHR:", sendToEhrResult);
      toast.success("Successfully sent to EHR!", {
        duration: 1000,
        position: "bottom-right",
      });
    }
  }, [sendToEhrResult]);

  const handleSendToEhr = async () => {
    if (!sessionId) {
      console.error("Session ID is undefined, cannot send to EHR");
      return;
    }

    console.log(
      "Sending to EHR with session ID:",
      sessionId,
      "and request:",
      sendToEhrRequest,
    );
    const result = await sendToEhr(Number(sessionId), sendToEhrRequest);

    if (result) {
      // fetchAndTransformTranscription(Number(sessionId));
      fetchAndTransformNotes(Number(sessionId));
      console.log("Send to EHR function returned:", result);
      setIsSent(true);
    } else {
      console.error("Failed to send to EHR, result is null or undefined");
    }
  };

  return (
    <Modal className="w-full bg-white sm:rounded-lg" onClose={onClose}>
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <SaveEHRICon />
        <h3 className="text-center text-[20px]">
          {isSent ? "Successfully Sent to EHR" : "Send to EHR?"}
        </h3>
        {isReviewNotesLoading ? (
          <div className="flex w-full max-w-md flex-col items-center justify-center gap-4 py-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-100 border-t-transparent" />
            <p className="text-center text-sm font-medium text-gray-700">
              Loading review notes...
            </p>
            <p className="text-center text-xs text-gray-500">
              Status: {reviewNotesStatus || "—"}
            </p>
          </div>
        ) : null}
        <p className="max-w-md text-[14px] text-secondary-100">
          {isSent ? (
            "Your recording has been successfully sent to the selected EHR system"
          ) : (
            <>
              <strong>Review & Confirmation Disclaimer</strong>
              <br />
              • You have reviewed all AI-generated notes related to this patient
              encounter, including consultation, administrative, and referral
              content.
              <br />
              • The information accurately reflects your clinical judgment and
              interaction with the patient.
              <br />
              • You accept full clinical responsibility for the final content
              before submission to the EHR.
              <br />
              <br />
              By tapping “Yes, Proceed” you acknowledge that:
            </>
          )}
        </p>

        <div className="flex w-full max-w-md flex-col items-center justify-center gap-3">
          <div className="flex w-full items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="flex w-full items-center justify-center rounded-lg bg-primary-100 py-2 px-3 text-[12px] text-white shadow-sm sm:w-auto"
            >
              {isSent ? "Close" : "No, Continue Editing"}
            </button>
            {!isSent && (
              <button
                onClick={handleSendToEhr}
                disabled={sendToEhrLoading || isReviewNotesLoading}
                className="flex w-full items-center justify-center rounded-lg bg-primary-dark py-2 px-3 text-[12px] text-white shadow-sm sm:w-auto"
              >
                {sendToEhrLoading
                  ? "Sending..."
                  : isReviewNotesLoading
                    ? "Loading Notes..."
                    : "Yes, Proceed"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmSendEhr;
