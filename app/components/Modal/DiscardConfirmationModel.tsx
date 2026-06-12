import Modal from ".";

interface DiscardConfirmationModelProps {
  onClose: (shouldDiscard: boolean) => void;
}

const DiscardConfirmationModel = ({
  onClose,
}: DiscardConfirmationModelProps) => {
  return (
    <Modal
      className="w-full bg-white sm:rounded-lg"
      onClose={() => onClose(false)}
    >
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="32" cy="32" r="32" fill="#FFECEC" />
          <path
            d="M32 28V36M32 44H32.01M20 20L44 44M44 20L20 44"
            stroke="#FF4D4F"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h3 className="text-center text-[20px]">Discard Recording?</h3>
        <p className="max-w-md text-center text-[14px] text-secondary-100">
          If you close this window, your recording will be discarded. Are you
          sure you want to discard it?
        </p>

        <div className="flex w-full max-w-lg flex-col items-center justify-center gap-3">
          <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => onClose(false)}
              className="flex w-full items-center justify-center rounded-lg bg-primary-100 px-2 py-2 text-[12px] text-white shadow-sm sm:flex-1"
            >
              No, Return to Recording
            </button>
            <button
              onClick={() => onClose(true)}
              className="flex w-full items-center justify-center rounded-lg bg-red-600 px-2 py-2 text-[12px] text-white shadow-sm sm:flex-1"
            >
              Yes, Discard Recording
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DiscardConfirmationModel;
