import Modal from ".";
import TextArea from "../Text-field";
import { useState } from "react";
import toast from "react-hot-toast";
import { useSession } from "../../hooks/useSession";

interface RecordingModalProps {
  onClose: () => void;
  sessionId: string | undefined;
  // fetchAndTransformTranscription: (sessionId: number) => void;
  fetchAndTransformNotes: (sessionId: number) => void;
}

const AdministrationAiModel = ({
  onClose,
  sessionId,
  // fetchAndTransformTranscription,
  fetchAndTransformNotes,
}: RecordingModalProps) => {
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const {
    performAdminAITask,
    adminAITaskLoading,
    adminAITaskError,
    saveAdminAINote,
    adminAINoteLoading,
    adminAINoteError,
  } = useSession();

  const handleGenerate = async () => {
    if (!sessionId || !inputText.trim()) return;

    setIsGenerating(true);
    try {
      const response = await performAdminAITask(Number(sessionId), {
        query: inputText,
      });

      console.log("Admin AI Task Response:", response);
      if (response) {
        setInputText(response);
      }
    } catch (error) {
      console.error("Error generating admin AI response:", error);
      toast.error("Error generating admin AI response!", {
        duration: 1000,
        position: "bottom-right",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Add to note button click - calls saveAdminAINote API
  const handleAddToNote = async () => {
    if (!sessionId || !inputText.trim()) return;

    setIsAdding(true);
    try {
      const response = await saveAdminAINote(Number(sessionId), {
        note: inputText,
      });
      // fetchAndTransformTranscription(Number(sessionId));
      fetchAndTransformNotes(Number(sessionId));
      console.log("Admin AI Note Saved:", response);
      toast.success("Admin AI Note Saved!", {
        duration: 1000,
        position: "bottom-right",
      });
      onClose();
    } catch (error) {
      console.error("Error saving admin AI note:", error);
      toast.error("Error saving admin AI note!", {
        duration: 1000,
        position: "bottom-right",
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Modal className="w-full bg-white sm:rounded-lg" onClose={onClose}>
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <p className="text-center text-xl font-medium text-primary-300 sm:text-2xl">
          Administration AI
        </p>

        <TextArea
          className="min-h-[120px] resize-y rounded-lg border border-gray-300 px-4 py-3 text-sm text-primary-300 transition-all duration-200 focus:border-primary-100 focus:ring-2 focus:ring-primary-100 sm:min-h-[160px] sm:py-4 sm:text-base"
          placeholder="What can I help you with? "
          onChange={(e) => {
            const value = e.target.value;
            setInputText(value);
          }}
          value={inputText}
        />

        {(adminAITaskError || adminAINoteError) && (
          <div className="w-full rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm text-red-500">
              {adminAITaskError || adminAINoteError}
            </p>
          </div>
        )}

        {/* Mobile: Add & Generate in first row, Cancel in separate row. Desktop: all in one row on the right */}
        {/* Mobile row 1: Add & Generate */}
        <div className="flex w-full items-center justify-end gap-3 sm:hidden">
          <button
            className="flex w-full items-center justify-center rounded-lg bg-primary-100 px-6 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-dark hover:shadow-md disabled:opacity-50"
            onClick={handleAddToNote}
            disabled={isAdding || adminAINoteLoading || !inputText.trim()}
          >
            {isAdding || adminAINoteLoading ? "Adding..." : "Add to note"}
          </button>
          <button
            className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#2641DA] to-[#C43FE9] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md disabled:opacity-50"
            onClick={handleGenerate}
            disabled={isGenerating || adminAITaskLoading || !inputText.trim()}
          >
            {isGenerating || adminAITaskLoading
              ? "Generating..."
              : "Generate"}
          </button>
        </div>

        {/* Mobile row 2: Cancel */}
        <div className="mt-2 flex w-full items-center justify-end sm:hidden">
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-lg px-6 py-2 text-sm font-medium text-secondary-100 transition-all duration-200 hover:bg-secondary-50"
          >
            Cancel
          </button>
        </div>

        {/* Desktop: all three in a single row on the right */}
        <div className="hidden w-full items-center justify-end gap-3 sm:flex">
          <button
            className="flex w-full items-center justify-center rounded-lg bg-primary-100 px-6 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-dark hover:shadow-md disabled:opacity-50 sm:w-auto"
            onClick={handleAddToNote}
            disabled={isAdding || adminAINoteLoading || !inputText.trim()}
          >
            {isAdding || adminAINoteLoading ? "Adding..." : "Add to note"}
          </button>
          <button
            className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#2641DA] to-[#C43FE9] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md disabled:opacity-50 sm:w-auto"
            onClick={handleGenerate}
            disabled={isGenerating || adminAITaskLoading || !inputText.trim()}
          >
            {isGenerating || adminAITaskLoading
              ? "Generating..."
              : "Generate"}
          </button>
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-lg px-6 py-2 text-sm font-medium text-secondary-100 transition-all duration-200 hover:bg-secondary-50 sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AdministrationAiModel;
