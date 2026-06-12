"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import Loader from "../../../components/Loader";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useHospitalAdminAccess } from "../../../hooks/useHospitalAdminAccess";

interface EncounterStats {
  doctor_id: number;
  doctorName: string;
  encounterCount: number;
  avgDuration: string;
  totalDuration: string;
  lastEncounter: string;
  department: string;
}

interface AnalyticsData {
  totalEncounters: number;
  avgEncountersPerDoctor: number;
  avgConsultationTime: number;
  totalConsultationTime: number;
  encountersPerDoctor: EncounterStats[];
  departmentStats: { department: string; count: number }[];
  chartData: { date: string; encounters: number }[];
  departmentChartData: { department: string; encounters: number }[];
}

export default function EncounterAnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { capabilities, loading: capabilitiesLoading } = useHospitalAdminAccess();
  const [dateRange, setDateRange] = useState("week");
  const [department, setDepartment] = useState("all");
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user has permission to access this page
  useEffect(() => {
    if (!capabilitiesLoading && !capabilities.canViewAnalytics) {
      router.push('/hospital-admin');
    }
  }, [capabilitiesLoading, capabilities, router]);

  // If still loading capabilities or no access, don't render anything
  if (capabilitiesLoading || !capabilities.canViewAnalytics) {
    return null;
  }

  // Get date range filter
  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          end: now
        };
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        return { start: weekStart, end: now };
      case "month":
        const monthStart = new Date(now);
        monthStart.setMonth(now.getMonth() - 1);
        return { start: monthStart, end: now };
      case "quarter":
        const quarterStart = new Date(now);
        quarterStart.setMonth(now.getMonth() - 3);
        return { start: quarterStart, end: now };
      default:
        return null;
    }
  };

  // Generate chart data for encounters over time
  const generateChartData = (sessions: any[], range: string) => {
    const now = new Date();
    const data: { date: string; encounters: number }[] = [];
    
    let days = 7; // default to week
    if (range === "today") days = 1;
    else if (range === "month") days = 30;
    else if (range === "quarter") days = 90;
    
    // Group sessions by date
    const sessionsByDate = new Map<string, number>();
    sessions.forEach(session => {
      const date = new Date(session.created_at).toISOString().split('T')[0];
      sessionsByDate.set(date, (sessionsByDate.get(date) || 0) + 1);
    });
    
    // Generate data for the last N days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      data.push({
        date: dayName,
        encounters: sessionsByDate.get(dateStr) || 0
      });
    }
    
    return data;
  };

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    if (!user?.hospital_id) {
      setError("Hospital ID not found");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get doctors for the hospital
      const { data: doctors, error: doctorsError } = await supabase
        .from('doctor')
        .select('id, first_name, last_name, sur_name, department')
        .eq('hospital_id', user.hospital_id);
      
      if (!doctors || doctors.length === 0) {
        setAnalyticsData({
          totalEncounters: 0,
          avgEncountersPerDoctor: 0,
          avgConsultationTime: 0,
          totalConsultationTime: 0,
          encountersPerDoctor: [],
          departmentStats: [],
          chartData: [],
          departmentChartData: []
        });
        setIsLoading(false); 
        return;
      }

      // Get sessions for these doctors with date filter
      const doctorIds = doctors.map(d => d.id);
      const dateFilter = getDateFilter();
      
      let query = supabase
        .from('session')
        .select(`
          id,
          doctor_id,
          created_at,
          updated_at,
          hospital_id
        `)
        .in('doctor_id', doctorIds)
        .order('created_at', { ascending: false });

      // Apply date filter if selected
      if (dateFilter) {
        query = query
          .gte('created_at', dateFilter.start.toISOString())
          .lte('created_at', dateFilter.end.toISOString());
      }
      
      const { data: sessions, error: sessionsError } = await query;

      if (sessionsError) {
        throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
      }

      const sessionsToUse = sessions || [];

      if (!sessionsToUse || sessionsToUse.length === 0) {
        setAnalyticsData({
          totalEncounters: 0,
          avgEncountersPerDoctor: 0,
          avgConsultationTime: 0,
          totalConsultationTime: 0,
          encountersPerDoctor: [],
          departmentStats: [],
          chartData: [],
          departmentChartData: []
        });
        setIsLoading(false);
        return;
      }

      // Calculate consultation time from created_at to updated_at
      // Note: If updated_at equals created_at, the session duration is 0
      // This indicates the session timestamps are not being updated properly
      const sessionsWithDuration = sessionsToUse.map(session => {
        const start = new Date(session.created_at);
        const end = new Date(session.updated_at);
        const duration = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60)); // in minutes
        return { ...session, duration };
      });

      // Create doctor lookup map
      const doctorMap = new Map(doctors.map(d => [d.id, d]));

      // Group by doctor
      const doctorStats = new Map<number, {
        doctor_id: number;
        doctorName: string;
        department: string;
        encounters: any[];
        totalDuration: number;
        lastEncounter: Date;
      }>();

      sessionsWithDuration.forEach(session => {
        const doctorId = session.doctor_id;
        const doctor = doctorMap.get(doctorId);
        const doctorName = doctor ? `${doctor.first_name} ${doctor.last_name}` : `Doctor ${doctorId}`;
        const department = doctor?.department || 'Unknown';

        if (!doctorStats.has(doctorId)) {
          doctorStats.set(doctorId, {
            doctor_id: doctorId,
            doctorName,
            department,
            encounters: [],
            totalDuration: 0,
            lastEncounter: new Date(session.created_at)
          });
        }

        const stats = doctorStats.get(doctorId)!;
        stats.encounters.push(session);
        stats.totalDuration += session.duration;
        if (new Date(session.created_at) > stats.lastEncounter) {
          stats.lastEncounter = new Date(session.created_at);
        }
      });

      // Convert to array and calculate metrics
      const encountersPerDoctor: EncounterStats[] = Array.from(doctorStats.values()).map(stats => {
        const avgDuration = stats.encounters.length > 0 ? stats.totalDuration / stats.encounters.length : 0;
        const now = new Date();
        const timeDiff = now.getTime() - stats.lastEncounter.getTime();
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesAgo = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        let lastEncounterText = '';
        if (hoursAgo > 0) {
          lastEncounterText = `${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
        } else if (minutesAgo > 0) {
          lastEncounterText = `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`;
        } else {
          lastEncounterText = 'Just now';
        }

        return {
          doctor_id: stats.doctor_id,
          doctorName: stats.doctorName,
          encounterCount: stats.encounters.length,
          avgDuration: `${Math.round(avgDuration)} min`,
          totalDuration: `${(stats.totalDuration / 60).toFixed(1)} hrs`,
          lastEncounter: lastEncounterText,
          department: stats.department
        };
      });

      // Calculate department stats
      const departmentMap = new Map<string, number>();
      encountersPerDoctor.forEach(doctor => {
        departmentMap.set(doctor.department, (departmentMap.get(doctor.department) || 0) + doctor.encounterCount);
      });

      const departmentStats = Array.from(departmentMap.entries()).map(([department, count]) => ({
        department,
        count
      }));

        // Calculate totals
      const totalEncounters = sessionsToUse.length;
      const totalConsultationTime = sessionsWithDuration.reduce((sum, session) => sum + session.duration, 0);
      const avgConsultationTime = totalEncounters > 0 ? totalConsultationTime / totalEncounters : 0;
      const avgEncountersPerDoctor = encountersPerDoctor.length > 0 ? totalEncounters / encountersPerDoctor.length : 0;

      // Generate chart data - encounters by date
      const chartData = generateChartData(sessionsToUse, dateRange);
      
      // Generate department chart data
      const departmentChartData = departmentStats.map(dept => ({
        department: dept.department,
        encounters: dept.count
      }));

      setAnalyticsData({
        totalEncounters,
        avgEncountersPerDoctor,
        avgConsultationTime,
        totalConsultationTime,
        encountersPerDoctor,
        departmentStats,
        chartData,
        departmentChartData
      });

    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [user?.hospital_id, dateRange]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
        <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
          <div className="flex-1 flex items-center justify-center">
            <Loader size="large" text="Loading analytics..." />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
        <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl">⚠️</span>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <button 
                onClick={fetchAnalyticsData}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return null;
  }

  // Filter encounters by department if selected
  const filteredEncounters = department === "all" 
    ? analyticsData.encountersPerDoctor 
    : analyticsData.encountersPerDoctor.filter(encounter => 
        encounter.department.toLowerCase() === department.toLowerCase()
      );

  return (
    <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#19213D]">
                Encounter Analytics
              </h1>
              <p className="mt-1 text-sm text-[#666F8D]">
                Track encounter metrics and doctor performance for your hospital
              </p>
            </div>
            <div className="flex gap-2 mt-3 md:mt-0">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Departments</option>
                {analyticsData.departmentStats.map((dept) => (
                  <option key={dept.department} value={dept.department.toLowerCase()}>
                    {dept.department}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchAnalyticsData}
                disabled={isLoading}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                {isLoading ? '⟳' : '↻'}
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Overview Cards */}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">📊</span>
                <span className="text-xs font-medium text-blue-800 bg-blue-200 px-2 py-1 rounded-full">
                  Live Data
                </span>
              </div>
              <p className="text-3xl font-bold text-[#19213D]">{analyticsData.totalEncounters}</p>
              <p className="text-sm text-[#666F8D]">Total Encounters</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-green-50 to-green-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">👨‍⚕️</span>
                <span className="text-xs font-medium text-green-800 bg-green-200 px-2 py-1 rounded-full">
                  {analyticsData.encountersPerDoctor.length} Doctors
                </span>
              </div>
              <p className="text-3xl font-bold text-[#19213D]">{analyticsData.avgEncountersPerDoctor.toFixed(1)}</p>
              <p className="text-sm text-[#666F8D]">Avg Encounters/Doctor</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">⏱️</span>
                <span className="text-xs font-medium text-yellow-800 bg-yellow-200 px-2 py-1 rounded-full">
                  {(analyticsData.totalConsultationTime / 60).toFixed(1)}h total
                </span>
              </div>
              <p className="text-3xl font-bold text-[#19213D]">{Math.round(analyticsData.avgConsultationTime)} min</p>
              <p className="text-sm text-[#666F8D]">Avg Consultation Time</p>
            </div>
          </div>

          {/* Encounter Trends Chart */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-medium text-[#19213D] mb-4">Encounter Trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value) => [value, 'Encounters']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="encounters" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Doctor Performance Table */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
              <h3 className="text-sm font-medium text-[#19213D]">
                Doctor Performance Metrics 
                {filteredEncounters.length !== analyticsData.encountersPerDoctor.length && 
                  ` (${filteredEncounters.length} of ${analyticsData.encountersPerDoctor.length} doctors)`
                }
              </h3>
            </div>
            <div className="overflow-x-auto">
              {filteredEncounters.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="text-4xl">📊</span>
                  <p className="mt-2 text-sm text-[#666F8D]">No encounters found for the selected filters</p>
                </div>
              ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Doctor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Department</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Encounters</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Avg Duration</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Total Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Last Encounter</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {filteredEncounters.map((stat, index) => {
                      const maxEncounters = Math.max(...filteredEncounters.map(s => s.encounterCount));
                      const performancePercentage = maxEncounters > 0 ? (stat.encounterCount / maxEncounters) * 100 : 0;
                      
                      return (
                        <tr key={stat.doctor_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-blue-800">
                              {stat.doctorName.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-[#19213D]">{stat.doctorName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-[#666F8D]">{stat.department}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-[#19213D]">{stat.encounterCount}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-[#19213D]">{stat.avgDuration}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-[#666F8D]">{stat.totalDuration}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-[#666F8D]">{stat.lastEncounter}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${performancePercentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                      );
                    })}
                </tbody>
              </table>
              )}
            </div>
          </div>

                    {/* Department Breakdown */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-[#19213D] mb-3">Department Distribution</h3>
              {analyticsData.departmentChartData.length === 0 ? (
                <div className="text-center py-4">
                  <span className="text-2xl">📊</span>
                  <p className="text-xs text-[#666F8D] mt-1">No department data available</p>
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.departmentChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => [value, 'Encounters']}
                      />
                      <Bar dataKey="encounters" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-[#19213D] mb-3">Summary Statistics</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#666F8D]">Total Consultation Time</span>
                  <span className="text-xs font-medium text-[#19213D]">
                    {(analyticsData.totalConsultationTime / 60).toFixed(1)} hours
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#666F8D]">Average per Encounter</span>
                  <span className="text-xs font-medium text-[#19213D]">
                    {Math.round(analyticsData.avgConsultationTime)} minutes
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#666F8D]">Active Doctors</span>
                  <span className="text-xs font-medium text-[#19213D]">
                    {analyticsData.encountersPerDoctor.length} doctors
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#666F8D]">Date Range</span>
                  <span className="text-xs font-medium text-[#19213D]">
                    {dateRange === 'today' ? 'Today' : 
                     dateRange === 'week' ? 'Last 7 days' :
                     dateRange === 'month' ? 'Last 30 days' :
                     dateRange === 'quarter' ? 'Last 90 days' : 'All time'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
