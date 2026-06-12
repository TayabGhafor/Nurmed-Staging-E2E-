import Modal from ".";
import { useEffect, useRef, useState } from "react";
import { useSession } from "../../hooks/useSession";

interface CopilotAiProps {
  onClose: () => void;
  sessionId: string | undefined;
  addAdditionalNote: () => void;
}

// Object structure for AI Copilot v2 response
interface CopilotItem {
  heading: string;
  description: string;
}

const CopilotAi = ({
  onClose,
  sessionId,
  addAdditionalNote,
}: CopilotAiProps) => {
  const [copilotItems, setCopilotItems] = useState<CopilotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedSessionIdRef = useRef<string | null>(null);

  // Get the AI Copilot data using the useSession hook
  const { getAICopilot, aiCopilot, aiCopilotLoading, aiCopilotError } =
    useSession();

  // Fetch AI Copilot data when the modal is opened. The ref guard prevents the
  // double-fire from React StrictMode (dev) and any unstable callback identity
  // from re-triggering the request for the same session. We intentionally do
  // not guard setIsLoading with an `isMounted` flag: StrictMode's cleanup
  // fires between the two dev mounts, and the second mount short-circuits at
  // the ref check — so an isMounted flag would stay false and trap the loader
  // when the in-flight request resolves.
  useEffect(() => {
    if (!sessionId) return;
    if (fetchedSessionIdRef.current === sessionId) return;
    fetchedSessionIdRef.current = sessionId;

    const fetchAICopilot = async () => {
      try {
        setIsLoading(true);
        await getAICopilot(parseInt(sessionId));
      } catch (error) {
        console.error("Error fetching AI Copilot:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAICopilot();
  }, [sessionId, getAICopilot]);

  // Process the AI Copilot data when it's received
  useEffect(() => {
    if (aiCopilot) {
      // The new API returns an array of objects with heading and description
      // If it's already an array, use it directly
      if (Array.isArray(aiCopilot)) {
        setCopilotItems(aiCopilot);
      } else if (typeof aiCopilot === "string") {
        // For backward compatibility, try to parse if it's a string
        try {
          const parsedData = JSON.parse(aiCopilot);
          if (Array.isArray(parsedData)) {
            setCopilotItems(parsedData);
          } else {
            console.error("AI Copilot data is not in the expected format");
            setCopilotItems([]);
          }
        } catch (error) {
          console.error("Error parsing AI Copilot data:", error);
          setCopilotItems([]);
        }
      } else {
        console.error("AI Copilot data is not in the expected format");
        setCopilotItems([]);
      }
    } else {
      setCopilotItems([]);
    }
  }, [aiCopilot]);

  return (
    <Modal
      className="flex max-h-[80vh] w-full flex-col bg-white sm:rounded-lg"
      onClose={() => onClose()}
    >
      {isLoading || aiCopilotLoading ? (
        // Loading state - no borders
        <div className="flex h-[50vh] w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-100 border-t-transparent"></div>
        </div>
      ) : (
        <>
          <h2 className="border-b border-gray-200 py-4 text-center text-lg font-medium sm:py-6 sm:text-xl md:text-2xl">
            AI Copilot
          </h2>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            {aiCopilotError ? (
              // Error state
              <div className="flex h-full w-full items-center justify-center p-6 text-center">
                <p className="text-red-500">
                  An error occurred while loading AI Copilot data. Please try
                  again.
                </p>
              </div>
            ) : copilotItems.length > 0 ? (
              // Display the new structured data format
              copilotItems.map((item, index) => (
                <div
                  key={index}
                  className="shadow-xs mx-3 my-3 rounded-lg border border-gray-200 bg-white sm:mx-4 sm:my-4 md:mx-6 md:my-6"
                >
                  <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-100 px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                    <h3 className="text-xs font-medium text-[#19213D] sm:text-sm">
                      {item.heading}
                    </h3>
                  </div>

                  <div className="flex flex-col items-start justify-start p-3 sm:p-4 md:p-6">
                    <div className="w-full">
                      <p className="text-xs text-secondary-100 sm:text-sm">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              // Fallback display if no data
              <div className="shadow-xs mx-3 my-3 rounded-lg border border-gray-200 bg-white sm:mx-4 sm:my-4 md:mx-6 md:my-6">
                <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-100 px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                  <h3 className="text-xs font-medium text-[#19213D] sm:text-sm">
                    Copilot AI
                  </h3>
                </div>

                <div className="flex items-start justify-start p-3 sm:p-4 md:p-6">
                  <div className="w-full rounded-lg text-xs text-secondary-100 sm:text-sm">
                    No data available from AI Copilot.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fixed button bar at bottom */}
          <div className="flex w-full flex-col items-end justify-center gap-3 border-t border-gray-200 bg-white px-4 py-6">
            <div className="flex w-full flex-col items-end justify-end gap-3 sm:flex-row">
              <button
                onClick={() => {
                  onClose();
                  addAdditionalNote();
                }}
                disabled={isLoading || aiCopilotLoading}
                className={`flex w-full items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm sm:w-auto sm:px-6 ${
                  isLoading || aiCopilotLoading
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-primary-100 hover:shadow-md"
                }`}
              >
                Add Additional Note
              </button>
              <button
                onClick={onClose}
                className="flex w-full items-center justify-center rounded-lg border border-primary-100 px-4 py-2 text-sm font-medium text-primary-100 shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md sm:w-auto sm:px-6"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};

export default CopilotAi;
