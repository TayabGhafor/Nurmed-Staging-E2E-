"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import toast from "react-hot-toast";
import { adminService, ApiKey, CreateApiKeyRequest } from "../../../kyClient/admin";
import { useHospitalAdminAccess } from "../../../hooks/useHospitalAdminAccess";

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeyAdded: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onApiKeyAdded,
}) => {
  const [formData, setFormData] = useState<CreateApiKeyRequest>({
    name: "",
    scopes: [],
    expires_at: "",
    metadata: {},
  });
  const [isLoading, setIsLoading] = useState(false);
  const [scopeInput, setScopeInput] = useState("");

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        name: "",
        scopes: [],
        expires_at: "",
        metadata: {},
      });
      setScopeInput("");
      onClose();
    }
  };

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      handleClose();
    }
  };

  const handleAddScope = () => {
    if (scopeInput.trim() && !formData.scopes.includes(scopeInput.trim())) {
      setFormData({
        ...formData,
        scopes: [...formData.scopes, scopeInput.trim()],
      });
      setScopeInput("");
    }
  };

  const handleRemoveScope = (scope: string) => {
    setFormData({
      ...formData,
      scopes: formData.scopes.filter((s) => s !== scope),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter a name for the API key", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }
    if (formData.scopes.length === 0) {
      toast.error("Please add at least one scope", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    setIsLoading(true);
    try {
      let expiresAt = formData.expires_at;
      if (expiresAt) {
        // Convert from "YYYY-MM-DDTHH:mm" to ISO 8601 format
        const date = new Date(expiresAt);
        expiresAt = date.toISOString();
      }

      const payload: CreateApiKeyRequest = {
        name: formData.name.trim(),
        scopes: formData.scopes,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
        ...(formData.metadata && Object.keys(formData.metadata).length > 0
          ? { metadata: formData.metadata }
          : {}),
      };

      const response = await adminService.createApiKey(payload);
      toast.success("API key created successfully!", {
        duration: 3000,
        position: "bottom-right",
      });
      
      // Show the key to the user (only shown once when created)
      if (response.key) {
        toast(
          (t) => (
            <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-gray-900">
                    Your API Key
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Please copy this key now. It won't be shown again.
                  </p>
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="ml-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Close"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="relative">
                <div className="flex items-center gap-2 rounded-lg border-2 border-gray-200 bg-gray-50 p-3">
                  <code className="flex-1 break-all font-mono text-sm font-medium text-gray-900">
                    {response.key}
                  </code>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(response.key || "");
                        toast.success("API key copied to clipboard!", {
                          duration: 3000,
                          position: "bottom-right",
                        });
                      } catch (err) {
                        toast.error("Failed to copy API key", {
                          duration: 3000,
                          position: "bottom-right",
                        });
                      }
                    }}
                    className="flex-shrink-0 rounded-lg bg-[#2832A8] p-2 text-white transition-colors hover:bg-[#2832A8] active:bg-[#2832A8]"
                    aria-label="Copy API key"
                    title="Copy to clipboard"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-2">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-xs font-medium text-amber-800">
                  Important: Save this key securely. You won't be able to see it again.
                </p>
              </div>
            </div>
          ),
          {
            duration: Infinity, // Never auto-close
            position: "top-center",
            style: {
              background: "transparent",
              boxShadow: "none",
              padding: 0,
            },
          }
        );
      }

      onApiKeyAdded();
      handleClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create API key", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleOutsideClick}
    >
      {/* Mobile Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 max-h-[90vh] w-full transform overflow-y-auto rounded-t-xl bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
        }}
      >
        {/* Mobile Header */}
        <div className="sticky top-0 rounded-t-xl border-b border-gray-200 bg-white">
          <div className="flex items-center justify-center pb-2 pt-3">
            <div className="h-1 w-12 rounded-full bg-gray-300"></div>
          </div>
          <div className="flex items-center justify-between px-4 pb-4">
            <h2 className="text-lg font-semibold text-[#19213D]">
              Add New API Key
            </h2>
            <button
              onClick={handleClose}
              className="rounded-full p-2 transition-colors hover:bg-gray-100"
              disabled={isLoading}
            >
              <svg
                className="h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Form */}
        <div className="px-4 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Enter API key name"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2832A8]"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Scopes <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scopeInput}
                  onChange={(e) => setScopeInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddScope();
                    }
                  }}
                  placeholder="Enter scope"
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2832A8]"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={handleAddScope}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-200"
                  disabled={isLoading}
                >
                  Add
                </button>
              </div>
              {formData.scopes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                    >
                      {scope}
                      <button
                        type="button"
                        onClick={() => handleRemoveScope(scope)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                        disabled={isLoading}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Expires At (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) =>
                  setFormData({ ...formData, expires_at: e.target.value })
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2832A8]"
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[#2832A8] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create API Key"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Desktop Modal */}
      <div
        className="hidden md:block w-3/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full  rounded-xl bg-white shadow-2xl">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#19213D]">
                Add New API Key
              </h2>
              <button
                onClick={handleClose}
                className="rounded-full p-2 transition-colors hover:bg-gray-100"
                disabled={isLoading}
              >
                <svg
                  className="h-5 w-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-4">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter API key name"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2832A8]"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Scopes <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scopeInput}
                    onChange={(e) => setScopeInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddScope();
                      }
                    }}
                    placeholder="Enter scope"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2832A8]"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={handleAddScope}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-200"
                    disabled={isLoading}
                  >
                    Add
                  </button>
                </div>
                {formData.scopes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                      >
                        {scope}
                        <button
                          type="button"
                          onClick={() => handleRemoveScope(scope)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                          disabled={isLoading}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) =>
                    setFormData({ ...formData, expires_at: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2832A8]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[#2832A8] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create API Key"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- Delete Confirmation Modal Component ---
interface DeleteApiKeyConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKey | null;
  isDeleting: boolean;
  onDelete: (apiKey: ApiKey) => void;
}
const DeleteApiKeyConfirmModal: React.FC<DeleteApiKeyConfirmModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  isDeleting,
  onDelete,
}) => {
  if (!isOpen || !apiKey) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-[#19213D]">
            Delete API Key
          </h3>
        </div>
        <div className="px-6 py-4">
          <p className="mb-4 text-sm text-gray-700">
            Are you sure you want to delete the API key <span className="font-semibold text-[#2832A8]">&quot;{apiKey.name}&quot;</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-50"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onDelete(apiKey)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const isDubaiRegion = process.env.NEXT_PUBLIC_REGION === "dubai";

export default function ApiKeyManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { capabilities, loading: capabilitiesLoading } = useHospitalAdminAccess();

  useEffect(() => {
    if (isDubaiRegion) {
      router.replace("/hospital-admin");
    }
  }, [router]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; apiKey: ApiKey | null }>({
    isOpen: false,
    apiKey: null,
  });

  // Fetch API keys when component mounts or when hospital_id changes
  useEffect(() => {
    if (isDubaiRegion || !user?.hospital_id) return;
    fetchApiKeys();
  }, [user?.hospital_id]);

  const fetchApiKeys = async () => {
    console.log("Fetching API keys for user:", user);
    if (!user?.hospital_id) {
      console.log("No hospital_id found for user:", user);
      return;
    }

    setIsLoading(true);
    try {
      console.log("Fetching API keys for hospital_id:", user.hospital_id);
      const keys = await adminService.getApiKeys(user.hospital_id);
      console.log("Fetched API keys:", keys);
      console.log("Number of keys:", keys?.length);
      // Filter out inactive keys
      const activeKeys = (keys || []).filter(key => key.is_active);
      console.log("Active keys:", activeKeys.length);
      setApiKeys(activeKeys);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch API keys", {
        duration: 3000,
        position: "bottom-right",
      });
      console.error("Error fetching API keys:", error);
      setApiKeys([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const openDeleteConfirmModal = (apiKey: ApiKey) => {
    setDeleteConfirm({ isOpen: true, apiKey });
  };

  const handleDeleteApiKey = async (apiKey: ApiKey) => {
    setDeletingKeyId(apiKey.id);
    try {
      await adminService.deleteApiKey(apiKey.id);
      toast.success("API key deleted successfully", {
        duration: 3000,
        position: "bottom-right",
      });
      fetchApiKeys(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || "Failed to delete API key", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setDeletingKeyId(null);
      setDeleteConfirm({ isOpen: false, apiKey: null });
    }
  };

  if (isDubaiRegion || capabilitiesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#2832A8] border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-none border-0 border-[#F0F2F5] bg-white shadow-none md:rounded-xl md:border md:shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
            <div className="flex items-center gap-2">
              {/* Back button - only show on mobile */}
              <div
                onClick={() => router.push("/hospital-admin")}
                className="cursor-pointer rounded-lg p-1 transition-colors hover:bg-gray-100 md:hidden"
              >
                <svg
                  className="h-5 w-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#19213D] md:text-2xl">
                  API Key Management
                </h1>
                <p className="mt-1 text-sm text-[#666F8D]">
                  Manage API keys for your hospital
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(true)}
                className="rounded-lg bg-[#2832A8] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] md:px-4"
              >
                <span className="hidden sm:inline">+ Add New API Key</span>
                <span className="sm:hidden">+ Add Key</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#2832A8] border-r-transparent"></div>
                <p className="mt-2 text-sm text-gray-600">Loading API keys...</p>
              </div>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-600">No API keys found</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 rounded-lg bg-[#2832A8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2832A8]"
                >
                  Create Your First API Key
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Key Prefix
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Scopes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Last Used
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Usage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Expires At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-[#19213D]">
                        {key.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 font-mono">
                        {key.key_prefix}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            key.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {key.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((scope, idx) => (
                            <span
                              key={idx}
                              className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                        {formatDate(key.last_used_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                        {key.metadata?.usage_count || 0}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                        {formatDate(key.expires_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        <button
                          onClick={() => openDeleteConfirmModal(key)}
                          disabled={deletingKeyId === key.id}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingKeyId === key.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create API Key Modal */}
      <ApiKeyModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onApiKeyAdded={fetchApiKeys}
      />

      {/* Delete API Key Confirmation Modal */}
      <DeleteApiKeyConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, apiKey: null })}
        apiKey={deleteConfirm.apiKey}
        isDeleting={!!(deletingKeyId && deleteConfirm.apiKey && deletingKeyId === deleteConfirm.apiKey.id)}
        onDelete={handleDeleteApiKey}
      />

    </div>
  );
}

