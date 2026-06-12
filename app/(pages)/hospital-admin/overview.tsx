"use client";

import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";

interface RecentActivity {
  id: string;
  type: "doctor_joined" | "session_completed" | "report_generated" | "ai_used";
  message: string;
  timestamp: string;
  icon: string;
  color: string;
}

export default function HospitalAdminDashboardOverview() {
  const { user } = useAuth();
  const router = useRouter();

  // Hardcoded stats for now
  const stats = {
    totalDoctors: 24,
    activeDoctors: 22,
    inactiveDoctors: 2,
    administrators: 3,
    totalEncounters: 156,
    todaysSessions: 42,
    thisWeekSessions: 112,
    completedSessions: 143,
    failedSessions: 3,
    inProgressSessions: 10,
    avgEncountersPerDoctor: 6.5,
    avgConsultationTime: "15 min",
    aiToolUsage: 89,
  };

  // Hardcoded recent activities
  const recentActivity: RecentActivity[] = [
    {
      id: "1",
      type: "session_completed",
      message: "42 encounters completed today",
      timestamp: "2 hours ago",
      icon: "✅",
      color: "green",
    },
    {
      id: "2",
      type: "doctor_joined",
      message: "22 active doctors in the system",
      timestamp: "Today",
      icon: "👤",
      color: "blue",
    },
    {
      id: "3",
      type: "ai_used",
      message: "AI tools used in 89% of encounters",
      timestamp: "This week",
      icon: "🤖",
      color: "purple",
    },
    {
      id: "4",
      type: "report_generated",
      message: "Weekly report generated successfully",
      timestamp: "5 hours ago",
      icon: "📈",
      color: "yellow",
    },
  ];

  const StatCard = ({
    title,
    value,
    icon,
    trend,
    bgColor = "bg-blue-100",
  }: {
    title: string;
    value: string | number;
    icon: string;
    trend?: string;
    bgColor?: string;
  }) => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor}`}
        >
          <span className="text-xl">{icon}</span>
        </div>
        {trend && (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              trend.startsWith("+")
                ? "bg-green-100 text-green-800"
                : trend.startsWith("-")
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-[#19213D]">{value}</p>
        <p className="text-sm text-[#666F8D]">{title}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <h1 className="text-xl font-semibold text-[#19213D]">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-[#666F8D]">
            Monitor your hospital's operations and performance
          </p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Quick Stats Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Active Doctors"
              value={stats.activeDoctors}
              icon="👨‍⚕️"
              bgColor="bg-blue-100"
              trend={`${Math.round((stats.activeDoctors / stats.totalDoctors) * 100)}% active`}
            />
            <StatCard
              title="Total Encounters"
              value={stats.totalEncounters}
              icon="📊"
              bgColor="bg-green-100"
              trend={`+${stats.thisWeekSessions} this week`}
            />
            <StatCard
              title="Today's Sessions"
              value={stats.todaysSessions}
              icon="⏱️"
              bgColor="bg-yellow-100"
              trend={stats.avgConsultationTime}
            />
            <StatCard
              title="AI Tool Usage"
              value={`${stats.aiToolUsage}%`}
              icon="🤖"
              bgColor="bg-purple-100"
              trend="AI Active"
            />
          </div>

          {/* Charts and Activity Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Activity */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
                <h3 className="text-sm font-medium text-[#19213D]">
                  Recent Activity
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start space-x-3"
                    >
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-${activity.color}-100`}
                      >
                        <span className="text-xs">{activity.icon}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-[#19213D]">
                          {activity.message}
                        </p>
                        <p className="text-xs text-[#666F8D]">
                          {activity.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
                <h3 className="text-sm font-medium text-[#19213D]">
                  Quick Actions
                </h3>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  <button
                    onClick={() => router.push("/hospital-admin/doctors")}
                    className="flex w-full items-center justify-between rounded-lg border border-[#E5E5EA] bg-white px-4 py-3 text-left transition-all hover:border-[#2388FF] hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">👨‍⚕️</span>
                      <span className="text-sm font-medium text-[#19213D]">
                        Add New Doctor
                      </span>
                    </div>
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => router.push("/hospital-admin/encounters")}
                    className="flex w-full items-center justify-between rounded-lg border border-[#E5E5EA] bg-white px-4 py-3 text-left transition-all hover:border-[#2388FF] hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📈</span>
                      <span className="text-sm font-medium text-[#19213D]">
                        View Analytics
                      </span>
                    </div>
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => router.push("/hospital-admin/reports")}
                    className="flex w-full items-center justify-between rounded-lg border border-[#E5E5EA] bg-white px-4 py-3 text-left transition-all hover:border-[#2388FF] hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📄</span>
                      <span className="text-sm font-medium text-[#19213D]">
                        Generate Reports
                      </span>
                    </div>
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() =>
                      router.push("/hospital-admin/encounter-data")
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-[#E5E5EA] bg-white px-4 py-3 text-left transition-all hover:border-[#2388FF] hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📝</span>
                      <span className="text-sm font-medium text-[#19213D]">
                        View Encounter Details
                      </span>
                    </div>
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
              <h3 className="text-sm font-medium text-[#19213D]">
                Performance Metrics
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="border-r border-gray-200 pr-4">
                  <p className="text-xs text-[#666F8D]">
                    Average Consultation Time
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#19213D] md:text-xl">
                    {stats.avgConsultationTime}
                  </p>
                  <p className="text-xs text-green-600">Optimized timing</p>
                </div>
                <div className="border-r border-gray-200 pr-4">
                  <p className="text-xs text-[#666F8D]">AI Tool Adoption</p>
                  <p className="mt-1 text-lg font-semibold text-[#19213D] md:text-xl">
                    {stats.aiToolUsage}%
                  </p>
                  <p className="text-xs text-green-600">High adoption rate</p>
                </div>
                <div>
                  <p className="text-xs text-[#666F8D]">
                    Avg Encounters/Doctor
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#19213D] md:text-xl">
                    {stats.avgEncountersPerDoctor.toFixed(1)}
                  </p>
                  <p className="text-xs text-yellow-600">Per doctor average</p>
                </div>
              </div>
            </div>
          </div>

          {/* Session Status Breakdown */}
          <div className="mt-6 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
              <h3 className="text-sm font-medium text-[#19213D]">
                Session Status Breakdown
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-[#666F8D]">Completed</span>
                    <span className="text-sm font-semibold text-green-600">
                      {stats.completedSessions}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{
                        width: `${(stats.completedSessions / stats.totalEncounters) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-[#666F8D]">In Progress</span>
                    <span className="text-sm font-semibold text-yellow-600">
                      {stats.inProgressSessions}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-yellow-500"
                      style={{
                        width: `${(stats.inProgressSessions / stats.totalEncounters) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-[#666F8D]">Failed</span>
                    <span className="text-sm font-semibold text-red-600">
                      {stats.failedSessions}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{
                        width: `${(stats.failedSessions / stats.totalEncounters) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
