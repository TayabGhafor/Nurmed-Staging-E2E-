"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
// import { dashboardService } from "../../../kyClient/dashboard";
import { useHospitalAdminAccess } from "../../../hooks/useHospitalAdminAccess";

interface SessionData {
  id: number;
  mrn: string;
  doctor_id: number;
  hospital_id: number;
  created_at: string;
  updated_at: string;
  status: string;
  language: string;
  session_template_id: number;
  doctor: {
    id: number;
    first_name: string;
    last_name: string;
    department: string;
  } | null;
  hospital: {
    id: number;
    name: string;
  } | null;
  sessiontemplate: {
    id: number;
    name: string;
  } | null;
}

interface EncounterDetail {
  id: string;
  patientMrn: string;
  doctorName: string;
  department: string;
  date: string;
  startTime: string;
  duration: string;
  adminToolUsage: number;
  codingToolUsage: number;
  aiCopilotUsage: number;
  editsCount: number;
  status: "Completed" | "In Progress" | "Failed";
  notesGenerated: boolean;
  sessionData: SessionData;
}

export default function EncounterDataPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { capabilities, loading: capabilitiesLoading } = useHospitalAdminAccess();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("all");
  const [filterDoctor, setFilterDoctor] = useState("all");
  const [encounters, setEncounters] = useState<EncounterDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterDetail | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);

  // Check if user has permission to access this page
  useEffect(() => {
    if (!capabilitiesLoading && !capabilities.canViewEncounters) {
      router.push('/hospital-admin');
    }
  }, [capabilitiesLoading, capabilities, router]);

  // If still loading capabilities or no access, don't render anything
  if (capabilitiesLoading || !capabilities.canViewEncounters) {
    return null;
  }

  // Fetch sessions data
  useEffect(() => {
    fetchSessions();
  }, [user, filterDate, filterDoctor]);

  // Fetch doctors data
  useEffect(() => {
    fetchDoctors();
  }, [user]);

  // Auto-refresh when there are sessions in progress
  useEffect(() => {
    const hasInProgressSessions = encounters.some(
      (encounter) => encounter.status === "In Progress"
    );

    if (!hasInProgressSessions) {
      return;
    }

    // Poll every 4 seconds when there are in-progress sessions
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing encounters due to in-progress sessions");
      fetchSessions();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [encounters]);

  const fetchSessions = async () => {
    if (!user?.hospital_id) {
      setError("Hospital ID not found");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get date filter
      const dateFilter = getDateFilter();
      
      // Build query
      let query = supabase
        .from('session')
        .select(`
          id,
          mrn,
          doctor_id,
          hospital_id,
          created_at,
          updated_at,
          status,
          language,
          session_template_id,
          doctor:doctor_id (
            id,
            first_name,
            last_name,
            department
          ),
          hospital:hospital_id (
            id,
            name
          ),
          sessiontemplate:session_template_id (
            id,
            name
          )
        `)
        .eq('hospital_id', user.hospital_id)
        .order('created_at', { ascending: false });

      // Apply date filter
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      // Apply doctor filter
      if (filterDoctor !== "all") {
        query = query.eq('doctor_id', filterDoctor);
      }

      const { data: sessions, error: sessionsError } = await query;

      if (sessionsError) {
        throw sessionsError;
      }

      // Transform sessions to encounter format
      const transformedEncounters: EncounterDetail[] = (sessions || []).map((session: any) => ({
        id: `ENC${session.id.toString().padStart(3, '0')}`,
        patientMrn: session.mrn || `MRN${session.id}`,
        doctorName: `${session.doctor?.first_name || ''} ${session.doctor?.last_name || ''}`.trim() || 'Unknown Doctor',
        department: session.doctor?.department || 'Unknown Department',
        date: new Date(session.created_at).toLocaleDateString(),
        startTime: new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: calculateDuration(session.created_at, session.updated_at),
        adminToolUsage: Math.floor(Math.random() * 6), // Mock data - replace with real data
        codingToolUsage: Math.floor(Math.random() * 5), // Mock data - replace with real data
        aiCopilotUsage: Math.floor(Math.random() * 8) + 2, // Mock data - replace with real data
        editsCount: Math.floor(Math.random() * 8), // Mock data - replace with real data
        status: mapSessionStatus(session.status),
        notesGenerated: session.status === 'Completed',
        sessionData: session
      }));

      setEncounters(transformedEncounters);
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    if (!user?.hospital_id) {
      return;
    }

    try {
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctor')
        .select('id, first_name, last_name, department')
        .eq('hospital_id', user.hospital_id)
        .order('first_name', { ascending: true });

      if (doctorsError) {
        console.error('Error fetching doctors:', doctorsError);
        return;
      }

      setDoctors(doctorsData || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    switch (filterDate) {
      case 'today':
        return now.toISOString().split('T')[0];
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo.toISOString();
      case 'all':
        return null; // No date filter for "All Time"
      default:
        return null;
    }
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    return `${diffMins} min`;
  };

  const mapSessionStatus = (status: string): "Completed" | "In Progress" | "Failed" => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Completed';
      case 'pending':
      case 'transcribed':
      case 'in_progress':
      case 'active':
        return 'In Progress';
      case 'failed':
      case 'error':
        return 'Failed';
      default:
        return 'In Progress';
    }
  };

  const handleViewDetails = async (encounter: EncounterDetail) => {
    setSelectedEncounter(encounter);
    setShowDetailsModal(true);
    // await fetchConversations(encounter.sessionData.id);
  };

  // const fetchConversations = async (sessionId: number) => {
  //   try {
  //     setConversationsLoading(true);
      
  //     // Use the same API service as the doctor dashboard
  //     const transcriptionData = await dashboardService.getTranscription(sessionId);

  //     // Transform transcription data to match Message interface (same as doctor dashboard)
  //     const transformedConversations = (transcriptionData || []).map((message: any, index: number) => ({
  //       id: index.toString(),
  //       sender: message.speaker || '',
  //       content: message.text || '',
  //       timestamp: new Date().toLocaleTimeString([], { 
  //         hour: '2-digit', 
  //         minute: '2-digit' 
  //       })
  //     }));

  //     setConversations(transformedConversations);
  //   } catch (err) {
  //     console.error('Error fetching conversations:', err);
  //     setConversations([]);
  //   } finally {
  //     setConversationsLoading(false);
  //   }
  // };

  const exportData = () => {
    const csvContent = [
      ['Encounter ID', 'Patient MRN', 'Doctor', 'Department', 'Date', 'Start Time', 'Duration', 'Status', 'Admin Tool Usage', 'Coding Tool Usage', 'AI Copilot Usage', 'Edits Count'],
      ...encounters.map(encounter => [
        encounter.id,
        encounter.patientMrn,
        encounter.doctorName,
        encounter.department,
        encounter.date,
        encounter.startTime,
        encounter.duration,
        encounter.status,
        encounter.adminToolUsage,
        encounter.codingToolUsage,
        encounter.aiCopilotUsage,
        encounter.editsCount
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encounter-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Static encounter data for fallback (removed - not needed with dynamic data)

  // Filter encounters
  const filteredEncounters = encounters.filter(encounter => {
    const matchesSearch =
      encounter.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      encounter.patientMrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      encounter.doctorName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Calculate averages
  const avgAdminUsage = encounters.length > 0 ? (encounters.reduce((sum, e) => sum + e.adminToolUsage, 0) / encounters.length).toFixed(1) : "0";
  const avgCodingUsage = encounters.length > 0 ? (encounters.reduce((sum, e) => sum + e.codingToolUsage, 0) / encounters.length).toFixed(1) : "0";
  const avgAiUsage = encounters.length > 0 ? (encounters.reduce((sum, e) => sum + e.aiCopilotUsage, 0) / encounters.length).toFixed(1) : "0";
  const avgEdits = encounters.length > 0 ? (encounters.reduce((sum, e) => sum + e.editsCount, 0) / encounters.length).toFixed(1) : "0";

  if (loading) {
    return (
      <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
        <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Loading encounter data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
        <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-sm text-red-600 mb-4">Error: {error}</p>
              <button 
                onClick={fetchSessions}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#19213D]">
                Encounter-Level Data
              </h1>
              <p className="mt-1 text-sm text-[#666F8D]">
                Detailed metrics for each consultation session
              </p>
            </div>
            <button 
              onClick={exportData}
              className="mt-3 md:mt-0 rounded-lg bg-[#2388FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6fd8] transition-colors"
            >
              Export Data
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <img
                    src="/images/search.svg"
                    alt="search"
                    className="size-4 text-gray-400"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Search by encounter ID, MRN, or doctor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            <select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  Dr. {doctor.first_name} {doctor.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Tool Usage Summary */}
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-purple-50 to-purple-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🛠️</span>
                <span className="text-xs font-medium text-purple-800">Admin Tool</span>
              </div>
              <p className="text-2xl font-bold text-[#19213D]">{avgAdminUsage}</p>
              <p className="text-xs text-[#666F8D]">Avg uses per encounter</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">💻</span>
                <span className="text-xs font-medium text-blue-800">Coding Tool</span>
              </div>
              <p className="text-2xl font-bold text-[#19213D]">{avgCodingUsage}</p>
              <p className="text-xs text-[#666F8D]">Avg uses per encounter</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-green-50 to-green-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">🤖</span>
                <span className="text-xs font-medium text-green-800">AI Copilot</span>
              </div>
              <p className="text-2xl font-bold text-[#19213D]">{avgAiUsage}</p>
              <p className="text-xs text-[#666F8D]">Avg uses per encounter</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">✏️</span>
                <span className="text-xs font-medium text-yellow-800">Edits</span>
              </div>
              <p className="text-2xl font-bold text-[#19213D]">{avgEdits}</p>
              <p className="text-xs text-[#666F8D]">Avg edits per encounter</p>
            </div>
          </div>

          {/* Encounter Details Table */}
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Encounter ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Patient MRN</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Doctor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Time</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Duration</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Tools Used</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Edits</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredEncounters.map((encounter) => (
                    <tr key={encounter.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#19213D]">{encounter.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#19213D]">{encounter.patientMrn}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-[#19213D]">{encounter.doctorName}</p>
                          <p className="text-xs text-[#666F8D]">{encounter.department}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-[#19213D]">{encounter.startTime}</p>
                          <p className="text-xs text-[#666F8D]">{encounter.date}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-[#19213D]">{encounter.duration}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-3">
                          <div className="text-center">
                            <p className="text-xs text-[#666F8D]">Admin</p>
                            <p className="text-sm font-medium text-purple-600">{encounter.adminToolUsage}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-[#666F8D]">Coding</p>
                            <p className="text-sm font-medium text-blue-600">{encounter.codingToolUsage}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-[#666F8D]">AI</p>
                            <p className="text-sm font-medium text-green-600">{encounter.aiCopilotUsage}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-[#19213D]">{encounter.editsCount}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${encounter.status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : encounter.status === "In Progress"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                          }`}>
                          {encounter.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => handleViewDetails(encounter)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredEncounters.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm text-[#666F8D]">No encounters found matching your criteria</p>
              </div>
            )}
          </div>

          {/* Tool Usage Insights */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-[#19213D] mb-3">Tool Usage Patterns</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-[#666F8D]">Administration AI</span>
                    <span className="text-xs font-medium text-[#19213D]">78% usage rate</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: "78%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-[#666F8D]">Coding Suggestions</span>
                    <span className="text-xs font-medium text-[#19213D]">65% usage rate</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: "65%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-[#666F8D]">AI Copilot</span>
                    <span className="text-xs font-medium text-[#19213D]">92% usage rate</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: "92%" }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-[#19213D] mb-3">Edit Patterns</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#666F8D]">No edits</span>
                  <span className="text-xs font-medium text-[#19213D]">12% of encounters</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#666F8D]">1-3 edits</span>
                  <span className="text-xs font-medium text-[#19213D]">45% of encounters</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#666F8D]">4-6 edits</span>
                  <span className="text-xs font-medium text-[#19213D]">32% of encounters</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#666F8D]">7+ edits</span>
                  <span className="text-xs font-medium text-[#19213D]">11% of encounters</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Modal - Same as Doctor Dashboard */}
      {showDetailsModal && selectedEncounter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#F0F2F5] shadow-xl w-full max-w-4xl h-[90vh] flex flex-col">
            {/* Header */}
            <div className="border-b border-[#E3E6EA] p-4 md:p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-[#19213D]">
                    {selectedEncounter.doctorName} - {selectedEncounter.patientMrn}
                  </h2>
                  <p className="text-sm text-[#666F8D] mt-1">
                    {selectedEncounter.department} • {selectedEncounter.date} at {selectedEncounter.startTime}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conversation Section - Exact same as doctor dashboard */}
            <div className="flex h-full flex-1 flex-col overflow-hidden border-[#E3E6EA] p-4 md:p-6">
              {/* Patient Info Header */}
              <div className="w-full rounded-lg border border-[#2F81FF] bg-blue-100 p-4 text-center mb-4">
                <h3 className="mb-1 text-center font-semibold text-blue-800">
                  {selectedEncounter.department}
                </h3>
                <p className="text-center text-xs text-gray-600">MRN: {selectedEncounter.patientMrn}</p>
              </div>

              {/* Messages */}
              <div className="max-h-[calc(100dvh-24rem)] flex-1 overflow-y-auto">
                {conversationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-sm text-gray-600">Loading conversation...</span>
                  </div>
                ) : conversations.length > 0 ? (
                  <div className="space-y-4">
                    {conversations.map((message) => (
                      <div key={message.id} className="rounded-lg bg-[#F7F8FA] p-4 transition-colors duration-200 hover:bg-gray-100">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold capitalize text-gray-800">
                            {message.sender}
                          </p>
                          <span className="text-xs text-[#666F8D]">{message.timestamp}</span>
                        </div>
                        <p className="break-words text-xs leading-relaxed text-[#666F8D]">
                          {message.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No conversation data available for this session.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
