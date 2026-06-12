"use client";

import { useEffect, useState } from "react";
import { useUIState } from "../../contexts/UIStateContext";
import Modal from ".";
import { useSession } from "../../hooks/useSession";
import toast from "react-hot-toast";

export default function CloudflowUrlModal() {
  const { isRpaUrlOpen, closeRpaUrl } = useUIState();
  const [rpaUrl, setRpaUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const {
    addRpaWebhookUrl,
    rpaWebhookUrl,
    rpaWebhookUrlLoading,
    rpaWebhookUrlError,
    rpaCloudeFlowUrl,
    getRpaCloudeFlowUrl,
  } = useSession();

  useEffect(() => {
    const maybePrefillRpaUrl = async () => {
      if (!isRpaUrlOpen) return;

      try {
        const response = await getRpaCloudeFlowUrl();
        if (!response) {
          setRpaUrl("");
          return;
        }

        const existingUrl = response.cloudflow_url ?? "";

        setRpaUrl(existingUrl);
      } catch {
        setRpaUrl("");
      }
    };

    void maybePrefillRpaUrl();
  }, [isRpaUrlOpen, getRpaCloudeFlowUrl]);

  const handleRpaUrlChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!rpaUrl.trim()) {
        throw new Error('Cloudflow URL is required');
      }

      const response = await addRpaWebhookUrl(encodeURIComponent(rpaUrl.trim()));
      toast.success(response.message, {
        duration: 3000,
        position: "bottom-right",
      });
      setRpaUrl(""); // clear input after adding or updating url
      closeRpaUrl();
    }
    catch (err: any) {
      toast.error(err.message, {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRpaUrlOpen) return null;

  return (
    <Modal className="w-full bg-white sm:rounded-lg" onClose={closeRpaUrl}>
      <form
        onSubmit={handleRpaUrlChange}
        className="flex flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-8 md:py-10"
      >
        <p className="text-center text-xl text-primary-300 sm:text-2xl md:font-medium">
          Cloudflow Url
        </p>
        <div className="w-full">
          <label
            htmlFor="rpaUrl"
            className="block text-sm font-medium text-gray-700 mb-2 text-left"
          >
            Cloudflow Url
          </label>
          <div className="relative">
            <textarea
              id="rpaUrl"
              value={rpaUrl}
              onChange={(e) => setRpaUrl(e.target.value)}
              placeholder="Enter your Cloudflow URL"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-secondary-100 sm:py-3 sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              required
              disabled={isLoading}
            />
          </div>
        </div>

        {rpaWebhookUrlError && (
          <div
            className={`w-full rounded-lg p-3 text-sm ${
              "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {rpaWebhookUrlError}
          </div>
        )}

        <div className="flex w-full items-center justify-end gap-3">
          <button
            type="button"
            onClick={closeRpaUrl}
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !rpaUrl.trim()}
            className="flex w-full items-center justify-center rounded-lg bg-[#2832A8] px-4 py-3 text-sm text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            style={{
              maxWidth: "220px",
            }}
          >
            {isLoading ? "Updating..." : "Update Cloudflow URL"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
