import Modal from ".";
import { SaveAudioIcon } from "../svgs";

interface SaveRecordingModelProps {
  onClose: (shouldStop: boolean, shouldDiscard?: boolean) => void;
  onOutsideClick?: () => void;
}

const SaveRecordingModel = ({
  onClose,
  onOutsideClick,
}: SaveRecordingModelProps) => {
  const handleModalClose = () => {
    if (onOutsideClick) {
      onOutsideClick();
    } else {
      onClose(false);
    }
  };

  return (
    <Modal className="w-full bg-white sm:rounded-lg" onClose={handleModalClose}>
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <SaveAudioIcon />
        <h3 className="text-center text-[20px]">
          Are you sure you want to save recording
        </h3>
        <p className="max-w-md text-center text-[14px] text-secondary-100">
          This will save the recording to your device and you will not be able
          to continue recording
        </p>

        <div className="flex w-full max-w-lg flex-col items-center justify-center gap-3">
          <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => onClose(false)}
              className="flex w-full items-center justify-center rounded-lg bg-primary-100 px-2 py-2 text-[12px] text-white shadow-sm sm:flex-1"
            >
              No, Continue Recording
            </button>
            <button
              onClick={() => onClose(true)}
              className="flex w-full items-center justify-center rounded-lg bg-primary-dark px-2 py-2 text-[12px] text-white shadow-sm sm:flex-1"
            >
              Yes, Stop and Save
            </button>
            <button
              onClick={() => handleModalClose()}
              className="flex w-full items-center justify-center rounded-lg bg-red-600 px-2 py-2 text-[12px] text-white shadow-sm sm:flex-1"
            >
              Discard Recording
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SaveRecordingModel;
