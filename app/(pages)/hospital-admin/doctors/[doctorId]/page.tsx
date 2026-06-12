"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "../../../../contexts/AuthContext";
import { supabase } from "../../../../lib/supabase";
import { useHospitalAdminAccess } from "../../../../hooks/useHospitalAdminAccess";
import DoctorStatsCards from "./components/doctor-stats-cards";
import EncounterChart from "./components/encounter-chart";
import AiUsageChart from "./components/ai-usage-chart";
import EncountersTable from "./components/encounters-table";

// Department code to name mapping
const DEPARTMENT_MAPPING: Record<string, string> = {
  "ED": "Emergency Department",
  "PC": "Primary Care",
  "OPD": "Outpatient Department",
  "REVIEW": "Patient Review",
  "RADIOLOGY": "Radiology"
};

interface DoctorInfo {
  id: string;
  first_name: string;
  sur_name?: string;
  last_name: string;
  email: string;
  department: string;
  registration_number: string;
  status: "Active" | "Inactive";
  is_active: boolean;
  created_at: string;
}

interface SessionData {
  id: number;
  mrn: string;
  created_at: string;
  updated_at: string;
  status: string;
  session_duration_seconds: number | null;
  count_copilot: number | null;
  count_admintool: number | null;
  count_optimizecode: number | null;
  session_template_id: number;
  sessiontemplate: {
    id: number;
    name: string;
    code: string;
  } | null;
}

export default function DoctorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const doctorId = params?.doctorId as string;
  const { user } = useAuth();
  const { capabilities, loading: capabilitiesLoading } = useHospitalAdminAccess();

  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [allSessions, setAllSessions] = useState<SessionData[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range state (only affects the encounters table)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Check if user has permission to access this page
  useEffect(() => {
    if (!capabilitiesLoading && !capabilities.canViewDoctors) {
      router.push('/hospital-admin');
    }
  }, [capabilitiesLoading, capabilities, router]);

  // Fetch doctor info and all sessions
  useEffect(() => {
    if (doctorId && user?.hospital_id) {
      fetchDoctorData();
    }
  }, [doctorId, user?.hospital_id]);

  useEffect(() => {
    if (allSessions.length > 0) {
      filterSessionsByDateRange();
    }
  }, [allSessions, startDate, endDate]);

  const fetchDoctorData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch doctor info
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctor')
        .select('id, first_name, sur_name, last_name, email, department, registration_number, is_active, created_at')
        .eq('id', doctorId)
        .eq('hospital_id', user?.hospital_id)
        .single();

      if (doctorError) {
        throw new Error(`Failed to fetch doctor: ${doctorError.message}`);
      }

      if (!doctorData) {
        throw new Error('Doctor not found');
      }

      setDoctor({
        ...doctorData,
        status: doctorData.is_active ? "Active" : "Inactive"
      });

      // Only fetch Completed/deleted sessions so detail-page stats, charts,
      // and the encounters table match the doctor list table count.
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('session')
        .select(`
          id,
          mrn,
          created_at,
          updated_at,
          status,
          session_duration_seconds,
          count_copilot,
          count_admintool,
          count_optimizecode,
          session_template_id,
          sessiontemplate:session_template_id (
            id,
            name,
            code
          )
        `)
        .eq('doctor_id', doctorId)
        .in('status', ['Completed', 'deleted'])
        .order('created_at', { ascending: false });

      if (sessionsError) {
        throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
      }

      // ---- DIAGNOSTIC: breakdown of returned sessions for this doctor ----
      const returned = sessionsData || [];
      const completedCount = returned.filter(
        (s: any) => (s.status || "").toLowerCase() === "completed",
      ).length;
      const deletedCount = returned.filter(
        (s: any) => (s.status || "").toLowerCase() === "deleted",
      ).length;
      const otherCount = returned.length - completedCount - deletedCount;
      const otherStatusBreakdown = returned
        .filter((s: any) => {
          const st = (s.status || "").toLowerCase();
          return st !== "completed" && st !== "deleted";
        })
        .reduce<Record<string, number>>((acc: Record<string, number>, s: any) => {
          const key = String(s.status ?? "<null>");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      console.log(`[doctors/${doctorId}] detail query results:`, {
        doctorId,
        totalReturned: returned.length,
        completedCount,
        deletedCount,
        otherCount,
        otherStatusBreakdown,
      });
      // ---- end DIAGNOSTIC ----

      // Transform the data to handle sessiontemplate as single object
      const transformedSessions = (sessionsData || []).map((session: any) => ({
        ...session,
        sessiontemplate: Array.isArray(session.sessiontemplate)
          ? session.sessiontemplate[0] || null
          : session.sessiontemplate
      }));

      setAllSessions(transformedSessions);
      setFilteredSessions(transformedSessions);
    } catch (err: any) {
      console.error('Error fetching doctor data:', err);
      setError(err.message || 'Failed to load doctor data');
    } finally {
      setIsLoading(false);
    }
  };

  const filterSessionsByDateRange = () => {
    let filtered = [...allSessions];

    // Apply start date filter
    if (startDate) {
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);
      filtered = filtered.filter(session => {
        const sessionDate = new Date(session.created_at);
        return sessionDate >= startDateTime;
      });
    }

    // Apply end date filter
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      filtered = filtered.filter(session => {
        const sessionDate = new Date(session.created_at);
        return sessionDate <= endDateTime;
      });
    }

    setFilteredSessions(filtered);
  };

  const handleClearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  // If still loading capabilities or no access, don't render anything
  if (capabilitiesLoading || !capabilities.canViewDoctors) {
    return null;
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-medium text-gray-900">Error Loading Doctor</h3>
          <p className="mb-4 text-sm text-gray-600">{error}</p>
          <button
            onClick={() => router.push('/hospital-admin/doctors')}
            className="rounded-lg bg-[#2832A8] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f2680] transition-colors"
          >
            Back to Doctors
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-full md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-none md:rounded-xl border-0 md:border border-[#F0F2F5] bg-white shadow-none md:shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              {/* Back button */}
              <div
                onClick={() => router.push('/hospital-admin/doctors')}
                className="cursor-pointer p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
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
                <h1 className="text-xl md:text-2xl font-semibold text-[#19213D]">
                  {doctor ? `${doctor.sur_name || ''} ${doctor.first_name} ${doctor.last_name}` : 'Doctor Details'}
                </h1>
                {doctor && (
                  <p className="text-sm text-[#666F8D] mt-1">
                    {doctor.email}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2832AB] mx-auto"></div>
              <p className="text-sm text-[#666F8D] mt-3">Loading doctor details...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-4 md:p-6">
              <div className="space-y-6">
                {/* Stats Cards - Uses allSessions (all-time data) */}
                <DoctorStatsCards sessions={allSessions} doctor={doctor} />

                {/* Charts - Uses allSessions (all-time data) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <EncounterChart sessions={allSessions} />
                  <AiUsageChart sessions={allSessions} />
                </div>

                {/* Date Range Filter */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-[#666F8D] mb-2">
                        Date Range
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          max={endDate || undefined}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] focus:border-transparent"
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={startDate || undefined}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] focus:border-transparent"
                        />
                      </div>
                    </div>
                    {(startDate || endDate) && (
                      <button
                        onClick={handleClearDateRange}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-[#666F8D] hover:bg-gray-50 transition-colors whitespace-nowrap"
                      >
                        Clear Date Range
                      </button>
                    )}
                  </div>
                </div>

                {/* Encounters Table */}
                <EncountersTable sessions={filteredSessions} departmentMapping={DEPARTMENT_MAPPING} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}