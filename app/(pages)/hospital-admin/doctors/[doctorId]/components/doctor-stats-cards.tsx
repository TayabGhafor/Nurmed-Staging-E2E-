"use client";

interface SessionData {
  id: number;
  status: string;
  session_duration_seconds: number | null;
}

interface DoctorInfo {
  status: "Active" | "Inactive";
}

interface DoctorStatsCardsProps {
  sessions: SessionData[];
  doctor: DoctorInfo | null;
}

export default function DoctorStatsCards({ sessions, doctor }: DoctorStatsCardsProps) {
  // Only count sessions that are Completed or deleted
  const countableSessions = sessions.filter(s => {
    const status = (s.status || "").toLowerCase();
    return status === "completed" || status === "deleted";
  });

  // Calculate total encounters
  const totalEncounters = countableSessions.length;

  // Calculate average duration
  const calculateAvgDuration = () => {
    const sessionsWithDuration = countableSessions.filter(s => s.session_duration_seconds !== null && s.session_duration_seconds > 0);
    
    if (sessionsWithDuration.length === 0) return "0 min";
    
    const totalSeconds = sessionsWithDuration.reduce((sum, s) => sum + (s.session_duration_seconds || 0), 0);
    const avgSeconds = totalSeconds / sessionsWithDuration.length;
    const avgMinutes = Math.round(avgSeconds / 60);
    
    return `${avgMinutes} min`;
  };

  const avgDuration = calculateAvgDuration();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Encounters Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-[#666F8D] mb-2">Total Encounters</p>
            <p className="text-4xl font-bold text-[#19213D]">{totalEncounters}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50">
            <svg className="h-7 w-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Average Duration Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-[#666F8D] mb-2">Avg Duration</p>
            <p className="text-4xl font-bold text-[#19213D]">{avgDuration}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-50">
            <svg className="h-7 w-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Doctor Status Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-[#666F8D] mb-2">Doctor Status</p>
            <div className="flex items-center mt-1">
              <span className={`rounded-lg px-4 py-2 text-base font-semibold ${
                doctor?.status === "Active"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {doctor?.status || "Unknown"}
              </span>
            </div>
          </div>
          <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${
            doctor?.status === "Active" ? "bg-green-50" : "bg-red-50"
          }`}>
            <svg className={`h-7 w-7 ${
              doctor?.status === "Active" ? "text-green-600" : "text-red-600"
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {doctor?.status === "Active" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

