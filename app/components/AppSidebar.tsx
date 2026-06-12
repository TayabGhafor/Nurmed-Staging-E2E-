"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import {
  useSessionContext,
  getDepartmentDisplayName,
} from "../contexts/SessionContext";
import { useUIState } from "../contexts/UIStateContext";
import { useMicrophone } from "../contexts/MicrophoneContext";
import { Status } from "../kyClient/dashboard";
import toast from "react-hot-toast";
import { useFeature } from "../hooks/useFeatureFlags";
import { FeatureKeys } from "../types/feature-flags";

const isDubaiRegion = process.env.NEXT_PUBLIC_REGION === "dubai";

const AppSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Get feature flags
  const canCreateSession = useFeature(FeatureKeys.CREATE_SESSION);
  const canViewSessions = useFeature(FeatureKeys.VIEW_SESSIONS);

  // Get session context - now simplified
  const {
    sessions,
    sessionsLoading,
    refreshSessionsByIds,
    retryOfflineSession,
    loadMoreSessions,
    hasMoreSessions,
    isLoadingMoreSessions,
  } = useSessionContext();

  // The scrollable list container — scroll position is checked here to
  // trigger infinite scroll loading.
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Force re-render when sessions change
  const [sessionsVersion, setSessionsVersion] = useState(0);

  // Track if initial load is complete
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Optimistic selection: highlight clicked session immediately before API resolves
  const [optimisticSelectedSessionId, setOptimisticSelectedSessionId] =
    useState<string | null>(null);

  // Trigger re-render when sessions change
  useEffect(() => {
    setSessionsVersion((prev) => prev + 1);
    if (sessions && sessions.length > 0 && !hasInitialLoad) {
      setHasInitialLoad(true);
    }
  }, [sessions, hasInitialLoad]);

  // Infinite scroll: when the user nears the bottom of the session list,
  // request the next page. Using a scroll handler (rather than
  // IntersectionObserver) avoids subtle root/visibility pitfalls that have
  // shown up across environments.
  const handleSessionListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMoreSessions || isLoadingMoreSessions) return;
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 100) {
      loadMoreSessions();
    }
  };

  // Auto-refresh sessions while any session is in a processing state. The
  // statuses checked here MUST stay in sync with the `isProcessing` render
  // condition below (Pending, InProgress, Transcribed).
  //
  // We poll by *session ID* (not by re-fetching page 0) because after
  // infinite-scroll the user may have just updated a session that lives at
  // offset 30+. `fetchSessions` only refetches limit=10 offset=0, so the
  // updated session never appears in the polled response and its
  // "Processing" badge gets stuck until a hard reload.
  // `refreshSessionsByIds` calls GET /session/:id for each in-flight session
  // directly and merges the new status into local state in place.
  useEffect(() => {
    const processingIds = (sessions || [])
      .filter(
        (session: any) =>
          !session.isOffline &&
          (session.status === Status.Pending ||
            session.status === Status.InProgress ||
            session.status === Status.Transcribed),
      )
      .map((session: any) => String(session.id));

    if (processingIds.length === 0) {
      return;
    }

    // Poll every 4 seconds while any session is still processing.
    const intervalId = setInterval(async () => {
      console.log(
        "Auto-refreshing processing sessions by id:",
        processingIds,
      );
      await refreshSessionsByIds(processingIds);
    }, 4000);

    return () => clearInterval(intervalId);
  }, [sessions, refreshSessionsByIds]);

  // Create a local loading state for retry operations
  const [retryLoadingMap, setRetryLoadingMap] = useState<
    Record<string, boolean>
  >({});

  // Get UI state context
  const { openRecordingDetail } = useUIState();
  const {
    isMicReady,
    permission: micPermission,
    micGateMessage,
    requestAccess: requestMicAccess,
  } = useMicrophone();

  const handleStartNewRecording = () => {
    if (isMicReady) {
      openRecordingDetail();
      return;
    }
    toast.error(micGateMessage, { id: "mic-gate", duration: 3000, position: "bottom-right" });
    if (micPermission === "prompt") {
      requestMicAccess();
    }
  };

  // Extract session ID from pathname if it exists
  const currentSessionId = pathname.includes("/session/")
    ? pathname.split("/session/")[1]
    : null;

  // When user just clicked a session (optimistic), only that one is selected so previous loses highlight
  const isSessionSelected = (sessionId: string) =>
    optimisticSelectedSessionId !== null
      ? optimisticSelectedSessionId === sessionId
      : currentSessionId === sessionId;

  // Clear optimistic selection when pathname catches up (navigation succeeded)
  useEffect(() => {
    if (currentSessionId && optimisticSelectedSessionId === currentSessionId) {
      setOptimisticSelectedSessionId(null);
    }
  }, [currentSessionId, optimisticSelectedSessionId]);

  // Check if a retry operation is currently loading
  const isRetryLoading = (sessionId: string) => {
    return retryLoadingMap[sessionId] || false;
  };

  // Memoize filtered sessions to prevent unnecessary recalculations
  const filteredSessions = useMemo(() => {
    return sessions?.filter(
      (session: any) =>
        session.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.name?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [sessions, searchQuery]);

  // Filter sessions by selected date if a date is selected
  const dateFilteredSessions = useMemo(() => {
    if (!selectedDate || !filteredSessions) {
      return filteredSessions;
    }

    // Parse selected date (YYYY-MM-DD format from input)
    const selectedDateObj = new Date(selectedDate);
    const selectedDateOnly = new Date(
      selectedDateObj.getFullYear(),
      selectedDateObj.getMonth(),
      selectedDateObj.getDate(),
    );

    return filteredSessions.filter((session) => {
      // Parse session date from created_at (ISO format: YYYY-MM-DDTHH:MM:SS)
      if (!session.created_at) return false;

      const sessionDate = new Date(session.created_at);
      if (isNaN(sessionDate.getTime())) return false;

      const sessionDateOnly = new Date(
        sessionDate.getFullYear(),
        sessionDate.getMonth(),
        sessionDate.getDate(),
      );

      return sessionDateOnly.getTime() === selectedDateOnly.getTime();
    });
  }, [filteredSessions, selectedDate]);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    if (!dateFilteredSessions || dateFilteredSessions.length === 0) {
      return [];
    }

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const yesterdayStart = todayStart - 86400000;

    // Sort sessions by created_at (newest first)
    const sortedSessions = [...dateFilteredSessions].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });

    const groups: Map<
      string,
      { label: string; sessions: typeof sortedSessions; sortKey: number }
    > = new Map();

    sortedSessions.forEach((session) => {
      if (!session.created_at) {
        const other = groups.get("other") || {
          label: "Other",
          sessions: [],
          sortKey: Infinity,
        };
        other.sessions.push(session);
        groups.set("other", other);
        return;
      }

      const sessionDate = new Date(session.created_at);
      const sessionDayStart = new Date(
        sessionDate.getFullYear(),
        sessionDate.getMonth(),
        sessionDate.getDate(),
      ).getTime();

      let label: string;
      let sortKey: number;

      if (sessionDayStart >= todayStart) {
        label = "Today";
        sortKey = 0;
      } else if (sessionDayStart >= yesterdayStart) {
        label = "Yesterday";
        sortKey = 1;
      } else {
        // Show formatted date for older sessions (e.g., "Jan 15, 2026")
        label = sessionDate.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        sortKey = 2 + (todayStart - sessionDayStart) / 86400000; // Days ago from today
      }

      const existing = groups.get(label) || { label, sessions: [], sortKey };
      existing.sessions.push(session);
      groups.set(label, existing);
    });

    return Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [dateFilteredSessions]);

  // Handle session selection using status from list data (no extra API call)
  const handleSessionSelect = (session: any) => {
    // Don't allow navigation for offline sessions
    if (session.isOffline) {
      return;
    }

    const sessionId = parseInt(session.id);
    if (isNaN(sessionId)) {
      toast.error("Invalid session ID", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    const status = String(session.status);

    if (
      status === String(Status.Completed) ||
      status === String(Status.Deleted)
    ) {
      // Optimistic UI: mark as selected so the sidebar responds before pathname updates
      setOptimisticSelectedSessionId(session.id);
      router.push(`/session/${session.id}`);
    } else if (status === String(Status.Failed)) {
      toast.error(
        `Something went wrong. Contact support for session ID: ${sessionId}`,
        {
          duration: 3000,
          position: "bottom-right",
        },
      );
    } else {
      toast.success(`Please wait. The session is being processed.`, {
        duration: 3000,
        position: "bottom-right",
      });
    }
  };

  // Handle retry upload for offline sessions
  const handleRetryUpload = async (session: any) => {
    if (isRetryLoading(session.tempId)) {
      return;
    }

    try {
      setRetryLoadingMap((prev) => ({
        ...prev,
        [session.tempId]: true,
      }));

      await retryOfflineSession(session.tempId);

      // Force re-render after successful upload
      setSessionsVersion((prev) => prev + 1);
    } catch (error) {
      console.error("Retry upload failed:", error);
    } finally {
      setRetryLoadingMap((prev) => ({
        ...prev,
        [session.tempId]: false,
      }));
    }
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={` ${currentSessionId ? "hidden md:flex md:max-w-[362px]" : "w-full"} ${isSidebarOpen ? "w-full p-4 md:max-w-[362px] md:p-6" : "p-3 py-10 md:w-16"} relative flex flex-col transition duration-300 md:h-[calc(100dvh-3.35rem)]`}
      >
        <div className="relative flex items-center">
          {isSidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full border border-[#A7C7ED] bg-[#D7E5F0] p-1">
                <img
                  src="/images/person.svg"
                  alt="Person"
                  className="h-6 w-7 object-cover md:h-8 md:w-9"
                />
              </div>
              <p className="text-sm font-semibold">
                Dr. {user?.first_name} {user?.last_name}
              </p>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute right-0 top-1/2 hidden -translate-y-1/2 cursor-pointer p-1.5 transition-all duration-300 md:block"
          >
            <img
              src="/images/toggle.svg"
              alt="toggle sidebar"
              className={`size-5 transform transition-transform duration-300 ${!isSidebarOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {isSidebarOpen && (
          <>
            <div className="relative mb-4 mt-4 flex-shrink-0">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <img
                  src="/images/search.svg"
                  alt="search"
                  className="size-4 text-gray-400"
                />
              </div>
              <input
                type="text"
                placeholder="Search for sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-8 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Sessions</h2>
              <div
                className="relative flex items-center gap-1.5"
                ref={datePickerRef}
              >
                {selectedDate && (
                  <>
                    <span className="whitespace-nowrap text-xs text-gray-600">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                        "en-GB",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(null);
                      }}
                      className="flex items-center justify-center rounded-full p-0.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      title="Clear date filter"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </>
                )}
                <div className="relative">
                  <input
                    type="date"
                    ref={dateInputRef}
                    value={selectedDate || ""}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      setSelectedDate(e.target.value || null);
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    style={{ width: "100%", height: "100%", zIndex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dateInputRef.current?.click();
                    }}
                    className={`relative z-0 flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                      selectedDate
                        ? "bg-blue-100 text-blue-600"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                    title="Filter by date"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={scrollContainerRef}
              onScroll={handleSessionListScroll}
              className="relative flex-1 overflow-y-auto"
            >
              <div className="space-y-3 py-4">
                {sessionsLoading && !hasInitialLoad ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="mb-2 h-12 rounded-lg bg-gray-200"></div>
                        <div className="h-4 w-3/4 rounded bg-gray-200"></div>
                      </div>
                    ))}
                  </div>
                ) : canViewSessions &&
                  groupedSessions &&
                  groupedSessions.length > 0 ? (
                  groupedSessions.map((group) => (
                    <div key={group.label} className="space-y-3">
                      <h3 className="sticky top-0 z-10 bg-gray-100 py-2 text-xs font-semibold text-[#666F8D]">
                        {group.label}
                      </h3>
                      {group.sessions.map((session: any) => {
                        const isProcessing =
                          session.status === Status.Pending ||
                          session.status === Status.InProgress || 
                          session.status === Status.Transcribed;
                        const isDeleted = session.status === Status.Deleted;

                        return (
                          <div
                            key={session.id}
                            className={`relative ${session.isOffline || isProcessing ? "cursor-default" : "cursor-pointer"} rounded-lg border bg-white p-2 ${
                              isSessionSelected(session.id)
                                ? "border-[#2388FF]"
                                : isProcessing
                                  ? "border-dotted border-[#2388FF]"
                                  : "border-[#E5E5EA]"
                            }`}
                            onClick={() =>
                              !session.isOffline && handleSessionSelect(session)
                            }
                          >
                            <div className="relative mb-2 flex flex-row items-center justify-between gap-1 md:gap-0">
                              <div className="flex items-center gap-1">
                                <p
                                  className={`text-sm font-semibold ${
                                    isSessionSelected(session.id)
                                      ? "text-[#2388FF]"
                                      : "text-[#19213D]"
                                  }`}
                                >
                                  {isDubaiRegion ? "URN" : "MRN"}: {session.mrn}
                                  {session.episode_id != null &&
                                  String(session.episode_id).trim() !== ""
                                    ? ` - ${String(session.episode_id).trim()}`
                                    : null}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 whitespace-nowrap rounded-lg bg-[#F7F8FA] px-1 py-px">
                                <svg
                                  className="h-2.5 w-2.5 text-[#666F8D]"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <p className="text-[8px] font-medium text-[#666F8D]">
                                  {session.time || session.date}
                                </p>
                              </div>
                            </div>
                            <div className="relative flex items-center justify-between">
                              <p className="text-xs text-[#666F8D]">
                                {getDepartmentDisplayName(session.department)}
                              </p>
                              {session.isOffline && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRetryUpload(session);
                                  }}
                                  disabled={isRetryLoading(session.tempId)}
                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  title="Retry upload"
                                >
                                  {isRetryLoading(session.tempId) ? (
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                  ) : (
                                    <svg
                                      className="h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                      />
                                    </svg>
                                  )}
                                </button>
                              )}
                              {isProcessing &&
                                !session.isOffline &&
                                !isDeleted && (
                                  <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5">
                                    <svg
                                      className="h-3 w-3 animate-spin text-[#2388FF]"
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
                                    <span className="text-[10px] font-medium text-[#2388FF]">
                                      Processing
                                    </span>
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : canViewSessions ? (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-gray-500">No sessions</p>
                  </div>
                ) : null}

                {canViewSessions &&
                  hasInitialLoad &&
                  groupedSessions &&
                  groupedSessions.length > 0 && (
                    <div className="flex items-center justify-center py-3">
                      {isLoadingMoreSessions ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <svg
                            className="h-4 w-4 animate-spin text-[#2388FF]"
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
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Loading more...
                        </div>
                      ) : !hasMoreSessions ? (
                        <p className="text-[10px] text-gray-400">
                          No more sessions
                        </p>
                      ) : null}
                    </div>
                  )}
              </div>
            </div>

            {canCreateSession && (
              <div className="absolute bottom-8 left-4 right-4 mt-4 z-11 flex-shrink-0 pt-4 md:relative md:bottom-0 md:left-0 md:right-0">
                <button
                  onClick={handleStartNewRecording}
                  aria-disabled={!isMicReady}
                  title={!isMicReady ? micGateMessage : undefined}
                  className={`mx-auto flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm shadow-md transition-colors md:px-4 md:text-base ${
                    isMicReady
                      ? "bg-[#2832A8] text-white hover:bg-[#1f2687]"
                      : "cursor-not-allowed bg-slate-300 text-slate-600 hover:bg-slate-300"
                  }`}
                >
                  <span className="mr-2 text-sm">+</span>
                  Start New Recording
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default AppSidebar;
