import Modal from ".";
import { useEffect, useState } from "react";

interface SavingModalProps {
  savingProgress: number;
  isEncrypting: boolean;
  isUploading: boolean;
  uploadProgress: number;
  estimatedTimeRemaining: number | null;
  isCreatingSession: boolean;
  error: string | null;
  onComplete: () => void;
}

const SavingModal = ({
  savingProgress,
  isEncrypting,
  isUploading,
  uploadProgress,
  estimatedTimeRemaining,
  isCreatingSession,
  error,
  onComplete,
}: SavingModalProps) => {
  const [status, setStatus] = useState<string>("Encrypting file...");

  useEffect(() => {
    if (error) {
      setStatus("Error");
    } else if (isEncrypting) {
      setStatus("Encrypting file...");
    } else if (isUploading) {
      setStatus("Uploading file...");
    } else if (isCreatingSession) {
      setStatus("Saving session...");
    } else if (savingProgress >= 100) {
      setStatus("Complete");
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [
    savingProgress,
    isEncrypting,
    isUploading,
    isCreatingSession,
    error,
    onComplete,
  ]);

  // Helper function to format time remaining
  const formatTimeRemaining = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "";
    if (seconds < 1) return "Less than 1 second";
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Modal
      className="w-full max-w-md bg-white sm:rounded-lg"
      onClose={() => {}}
    >
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-8 mt-10 text-center">
        {/* Icon/Spinner Section */}
        {error ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        ) : savingProgress >= 100 ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            {/* Circular loader spinner */}
            <svg
              className="h-16 w-16 animate-spin text-primary-dark"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        )}

        {/* Title */}
        <h2 className="text-2xl font-medium text-gray-900">
          {error
            ? "Saving Failed"
            : savingProgress >= 100
              ? "Saved Successfully"
              : "Saving Recording"}
        </h2>

        {/* Status Text */}
        <div className="w-full">
          <p className="mb-3 text-base font-medium text-gray-700">{status}</p>
        </div>

        {/* Progress Section - Show ONLY for uploading stage, but maintain space for all states */}
        <div className="w-full" style={{ minHeight: '60px' }}>
          {isUploading && !error && (
            <div className="w-full">
              <div className="mb-2 flex justify-between">
                <span className="text-sm font-medium text-gray-600">
                  Uploading...
                </span>
                <span className="text-sm font-medium text-primary-dark">
                  {uploadProgress}%
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-primary-dark transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Estimated time remaining: {formatTimeRemaining(estimatedTimeRemaining)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Error Section */}
        {error && (
          <div className="mt-2 w-full rounded-md bg-red-50 p-4 text-left">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error saving recording
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Action Buttons */}
        {error && (
          <div className="mt-2 flex w-full gap-4">
            <button
              onClick={onComplete}
              className="flex-1 rounded-lg border border-red-600 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50"
            >
              Cancel
            </button>
            <button
              onClick={onComplete}
              className="hover:bg-primary-darker flex-1 rounded-lg bg-primary-dark px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SavingModal;
