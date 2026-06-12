"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import toast from "react-hot-toast";
import { useHospitalAdminAccess } from "../../../hooks/useHospitalAdminAccess";
import { scribeService, type Scribe } from "../../../kyClient/scribe";

interface AddScribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScribeAdded?: () => void;
}

const AddScribeModal: React.FC<AddScribeModalProps> = ({
  isOpen,
  onClose,
  onScribeAdded,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setEmail("");
    setIsActive(true);
  }, [isOpen]);

  const handleClose = () => {
    if (!isLoading) {
      setName("");
      setEmail("");
      setIsActive(true);
      onClose();
    }
  };

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      handleClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a name", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter an email", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    setIsLoading(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedName = name.trim();

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;
      if (!token) {
        throw new Error(
          "Missing session. Sign in again and retry adding this scribe.",
        );
      }

      const res = await fetch("/api/hospital-admin/scribe/send-auth-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: trimmedEmail,
          name: trimmedName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to create the scribe auth account.",
        );
      }
      const newUserId =
        typeof data?.user_id === "string" ? data.user_id : undefined;

      await scribeService.addScribe({
        name: trimmedName,
        email: trimmedEmail,
        is_active: isActive,
        user_id: newUserId,
      });

      onScribeAdded?.();

      toast.success(
        "Scribe added. An invite to set their password was emailed to them.",
        { duration: 3000, position: "bottom-right" },
      );

      handleClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to add scribe";
      toast.error(message, {
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4"
      onClick={handleOutsideClick}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-center border-b border-gray-200 pb-2 pt-3 md:hidden">
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4 md:px-6">
          <h2 className="text-lg font-semibold text-[#19213D] md:text-xl">
            Add Scribe
          </h2>
          <button
            type="button"
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter scribe name"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] disabled:cursor-not-allowed disabled:bg-gray-50"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] disabled:cursor-not-allowed disabled:bg-gray-50"
                required
                disabled={isLoading}
                autoComplete="off"
              />
            </div>

            <label
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 rounded border-gray-300 text-[#2832A8] focus:ring-[#2832A8] disabled:cursor-not-allowed"
              />
              <span className="text-sm font-medium text-[#19213D]">Active</span>
            </label>


            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-50 sm:order-1"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#2832A8] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#232a92] disabled:opacity-50 sm:order-2"
                disabled={isLoading}
              >
                {isLoading ? "Adding..." : "Add Scribe"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const isDubaiRegion = process.env.NEXT_PUBLIC_REGION === "dubai";

export default function ScribePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { loading: capabilitiesLoading } = useHospitalAdminAccess();
  const [scribes, setScribes] = useState<Scribe[]>([]);
  const [scribesLoading, setScribesLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  useEffect(() => {
    if (!isDubaiRegion) {
      router.replace("/hospital-admin");
    }
  }, [router]);

  const fetchScribes = async () => {
    setScribesLoading(true);
    try {
      const list = await scribeService.getScribes();
      setScribes(list);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch scribes";
      toast.error(message, { duration: 2500, position: "bottom-right" });
      setScribes([]);
    } finally {
      setScribesLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchScribes();
  }, [user?.id]);

  if (!isDubaiRegion || capabilitiesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#2832A8] border-r-transparent" />
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-none border-0 border-[#F0F2F5] bg-white shadow-none md:rounded-xl md:border md:shadow-xl">
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/hospital-admin")}
                className="cursor-pointer rounded-lg p-1 transition-colors hover:bg-gray-100 md:hidden"
                aria-label="Back"
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
              </button>
              <div>
                <h1 className="text-xl font-semibold text-[#19213D] md:text-2xl">
                  Scribe Management
                </h1>
                <p className="mt-1 text-sm text-[#666F8D]">
                  Scribes get role <span className="font-medium text-[#19213D]">scribe</span>.
                  They receive an email invite to set their own password.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-[#2832A8] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#232a92] md:px-4"
            >
              <span className="hidden sm:inline">+ Add Scribe</span>
              <span className="sm:hidden">+ Add</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {scribesLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#2832A8] border-r-transparent" />
                <p className="mt-2 text-sm text-gray-600">Loading scribes...</p>
              </div>
            </div>
          ) : scribes.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <span className="text-4xl" aria-hidden>
                ✍️
              </span>
              <p className="mt-4 max-w-md text-sm text-[#666F8D]">
                No scribes yet. Use{" "}
                <span className="font-medium text-[#19213D]">Add Scribe</span>{" "}
                to create one (role scribe, invite emailed).
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead className="border-b border-[#E3E6EA] bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2F5]">
                  {scribes.map((s, idx) => (
                      <tr
                        key={String(s.id ?? s.email ?? idx)}
                        className="bg-white"
                      >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[#19213D]">
                        {s.name != null && String(s.name).trim() !== ""
                          ? String(s.name)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#666F8D]">
                        {s.email != null && String(s.email).trim() !== ""
                          ? String(s.email)
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            s.is_active !== false
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {s.is_active !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AddScribeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onScribeAdded={fetchScribes}
      />

    </div>
  );
}
