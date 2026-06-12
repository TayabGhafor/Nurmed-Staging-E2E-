import Modal from ".";
import toast from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import { useSession } from "../../hooks/useSession";
import { DiagnosisCode } from "../../kyClient/dashboard";

interface CodingSuggestionsModelProps {
  onClose: () => void;
  sessionId: string | undefined;
  // fetchAndTransformTranscription: (sessionId: number) => void;
  fetchAndTransformNotes: (sessionId: number) => void;
}

const CodingSuggestionsModel = ({
  onClose,
  sessionId,
  // fetchAndTransformTranscription,
  fetchAndTransformNotes,
}: CodingSuggestionsModelProps) => {
  const [selectedCodes, setSelectedCodes] = useState<DiagnosisCode[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    getDiagnosisCodes,
    diagnosisCodes,
    diagnosisCodesLoading,
    diagnosisCodesError,
    postDiagnosisCodes,
    postDiagnosisCodesError,
  } = useSession();

  // Guards against React StrictMode's intentional double-fire of effects in
  // dev (which otherwise hits get_diagnosis_codes/<id> twice on every modal
  // open). Keyed by sessionId so reopening for a different session still
  // triggers a fresh fetch.
  const loadedSessionIdRef = useRef<string | null>(null);

  // Fetch diagnosis codes when the modal is opened
  useEffect(() => {
    const fetchDiagnosisCodes = async () => {
      if (!sessionId) return;
      if (loadedSessionIdRef.current === sessionId) return;
      loadedSessionIdRef.current = sessionId;
      try {
        setIsLoading(true);
        await getDiagnosisCodes(parseInt(sessionId));
      } catch (error) {
        console.error("Error fetching diagnosis codes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiagnosisCodes();
  }, [sessionId, getDiagnosisCodes]);

  // Handle checkbox selection
  const handleSelectCode = (diagnosisCode: DiagnosisCode) => {
    setSelectedCodes((prevSelected) => {
      const isAlreadySelected = prevSelected.some(
        (code) => code.code === diagnosisCode.code,
      );

      if (isAlreadySelected) {
        return prevSelected.filter((code) => code.code !== diagnosisCode.code);
      } else {
        return [...prevSelected, diagnosisCode];
      }
    });
  };

  // Check if a code is selected
  const isCodeSelected = (codeId: string) => {
    return selectedCodes.some((code) => code.code === codeId);
  };

  // Handle applying selected codes
  const handleApplySelected = async () => {
    if (selectedCodes.length === 0) {
      toast.error("Please select at least one diagnosis code", {
        duration: 1000,
        position: "bottom-right",
      });
      return;
    }

    if (!sessionId) {
      toast.error("Session ID is missing", {
        duration: 1000,
        position: "bottom-right",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const sessionIdNumber = parseInt(sessionId, 10);

      if (isNaN(sessionIdNumber)) {
        throw new Error("Invalid session ID");
      }

      const response = await postDiagnosisCodes(sessionIdNumber, {
        diagnosis_codes: selectedCodes,
      });

      if (response) {
        // fetchAndTransformTranscription(sessionIdNumber);
        fetchAndTransformNotes(sessionIdNumber);
        toast.success(
          `${selectedCodes.length} diagnosis code${selectedCodes.length !== 1 ? "s" : ""} applied successfully`,
          {
            duration: 1000,
            position: "bottom-right",
          },
        );
        onClose();
      } else {
        toast.error("Failed to apply diagnosis codes", {
          duration: 1000,
          position: "bottom-right",
        });
      }
    } catch (error) {
      console.error("Error applying diagnosis codes:", error);
      toast.error("An error occurred while applying diagnosis codes", {
        duration: 1000,
        position: "bottom-right",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If there are no diagnosis codes after loading, close the modal
  useEffect(() => {
    if (
      !isLoading &&
      !diagnosisCodesLoading &&
      diagnosisCodes &&
      diagnosisCodes.length === 0
    ) {
      toast.error("Diagnosis codes unavailable!", {
        duration: 1000,
        position: "bottom-right",
      });
      onClose();
    }
  }, [diagnosisCodes, diagnosisCodesLoading, isLoading, onClose]);

  return (
    <Modal
      className="flex h-[80vh] w-full flex-col bg-white sm:rounded-lg"
      onClose={() => onClose()}
    >
      {/* Fixed Header */}
      <h2 className="py-4 text-center text-lg font-medium sm:py-6 sm:text-xl md:text-2xl">
        Coding Suggestions
      </h2>

      {/* Scrollable Content Area */}
      <div className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 flex-1 overflow-y-auto">
        {isLoading || diagnosisCodesLoading ? (
          // Loading state
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-100 border-t-transparent"></div>
          </div>
        ) : diagnosisCodesError ? (
          // Error state
          <div className="flex h-full w-full items-center justify-center p-6 text-center">
            <p className="text-red-500">
              An error occurred while loading diagnosis codes. Please try again.
            </p>
          </div>
        ) : (
          diagnosisCodes &&
          diagnosisCodes.map((diagnosisCode: DiagnosisCode, index: number) => (
            <div
              key={`${diagnosisCode.code}-${index}`}
              className="shadow-xs mx-3 my-3 rounded-lg border border-gray-200 bg-white sm:mx-4 sm:my-4 md:mx-6 md:my-6"
            >
              <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-100 px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded border ${
                      isCodeSelected(diagnosisCode.code)
                        ? "border-primary-100 bg-primary-100"
                        : "border-gray-300 bg-white"
                    }`}
                    onClick={() => handleSelectCode(diagnosisCode)}
                  >
                    {isCodeSelected(diagnosisCode.code) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="white"
                        className="h-3 w-3"
                      >
                        <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-xs font-medium text-[#19213D] sm:text-sm">
                    {`${diagnosisCode.code} - ${diagnosisCode.name}`}
                  </h3>
                </div>
              </div>

              <div className="flex items-start justify-start p-3 sm:p-4 md:p-6">
                <p className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 w-full overflow-y-auto rounded-lg text-xs text-secondary-100 sm:text-sm">
                  {diagnosisCode.summary}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto flex w-full flex-col items-end justify-center gap-3 border-t border-gray-200 px-4 py-6">
        <div className="flex w-full items-center justify-end gap-3">
          <button
            className={`flex w-full items-center justify-center rounded-lg bg-primary-100 px-6 py-2 text-sm font-medium text-white shadow-sm sm:w-auto ${
              isSubmitting || selectedCodes.length === 0
                ? "cursor-not-allowed opacity-60"
                : "hover:shadow-md"
            }`}
            onClick={handleApplySelected}
            disabled={isSubmitting || selectedCodes.length === 0}
          >
            {isSubmitting
              ? "Applying..."
              : `Apply Selected (${selectedCodes.length})`}
          </button>
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-lg border border-primary-100 px-6 py-2 text-sm font-medium text-primary-100 shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md sm:w-auto"
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
        {postDiagnosisCodesError && (
          <p className="mt-2 text-sm text-red-500">{postDiagnosisCodesError}</p>
        )}
      </div>
    </Modal>
  );
};

export default CodingSuggestionsModel;
