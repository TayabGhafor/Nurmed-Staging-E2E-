"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHospitalAdminAccess } from "../../../hooks/useHospitalAdminAccess";

interface Report {
  id: string;
  name: string;
  type: "Daily" | "Weekly" | "Monthly" | "Custom";
  lastGenerated: string;
  size: string;
  status: "Ready" | "Processing" | "Scheduled";
  format: "PDF" | "CSV" | "Excel";
}

export default function ReportsExportsPage() {
  const router = useRouter();
  const { capabilities, loading: capabilitiesLoading } = useHospitalAdminAccess();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedEncounterType, setSelectedEncounterType] = useState("all");
  const [reportFormat, setReportFormat] = useState("pdf");
  const [scheduleFrequency, setScheduleFrequency] = useState("daily");

  // Check if user has permission to access this page
  useEffect(() => {
    if (!capabilitiesLoading && !capabilities.canViewAnalytics && !capabilities.canViewCostsTools) {
      router.push('/hospital-admin');
    }
  }, [capabilitiesLoading, capabilities, router]);

  // If still loading capabilities or no access, don't render anything
  if (capabilitiesLoading || (!capabilities.canViewAnalytics && !capabilities.canViewCostsTools)) {
    return null;
  }

  // Static report data
  const previousReports: Report[] = [
    {
      id: "RPT001",
      name: "Monthly Hospital Report - December 2023",
      type: "Monthly",
      lastGenerated: "2024-01-01",
      size: "2.4 MB",
      status: "Ready",
      format: "PDF"
    },
    {
      id: "RPT002",
      name: "Weekly Performance Summary",
      type: "Weekly",
      lastGenerated: "2024-01-14",
      size: "856 KB",
      status: "Ready",
      format: "Excel"
    },
    {
      id: "RPT003",
      name: "Daily Encounter Report",
      type: "Daily",
      lastGenerated: "2024-01-15",
      size: "124 KB",
      status: "Processing",
      format: "CSV"
    },
    {
      id: "RPT004",
      name: "Custom Report - Cardiology Q4",
      type: "Custom",
      lastGenerated: "2024-01-10",
      size: "3.1 MB",
      status: "Ready",
      format: "PDF"
    }
  ];

  const scheduledReports = [
    {
      name: "Daily Encounter Summary",
      frequency: "Daily at 6:00 PM",
      recipients: "admin@hospital.com",
      nextRun: "Today, 6:00 PM"
    },
    {
      name: "Weekly Performance Report",
      frequency: "Every Monday at 9:00 AM",
      recipients: "management@hospital.com",
      nextRun: "Jan 22, 2024"
    },
    {
      name: "Monthly Analytics",
      frequency: "1st of every month",
      recipients: "board@hospital.com",
      nextRun: "Feb 1, 2024"
    }
  ];

  return (
    <div className="flex flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-xl border border-[#F0F2F5] bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#19213D]">
                Reports & Exports
              </h1>
              <p className="mt-1 text-sm text-[#666F8D]">
                Generate and schedule automated reports for your hospital data
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Report Generation Section */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
              <h3 className="text-sm font-medium text-[#19213D]">Generate New Report</h3>
            </div>
            <div className="p-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Date Range */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[#666F8D] mb-2">Date Range</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="self-center text-[#666F8D]">to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Doctor Filter */}
                <div>
                  <label className="block text-xs font-medium text-[#666F8D] mb-2">Doctor</label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Doctors</option>
                    <option value="sarah">Dr. Sarah Johnson</option>
                    <option value="michael">Dr. Michael Chen</option>
                    <option value="emily">Dr. Emily Williams</option>
                  </select>
                </div>

                {/* Encounter Type */}
                <div>
                  <label className="block text-xs font-medium text-[#666F8D] mb-2">Encounter Type</label>
                  <select
                    value={selectedEncounterType}
                    onChange={(e) => setSelectedEncounterType(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="consultation">Consultation</option>
                    <option value="followup">Follow-up</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                {/* Report Format */}
                <div>
                  <label className="block text-xs font-medium text-[#666F8D] mb-2">Format</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReportFormat("pdf")}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${reportFormat === "pdf"
                        ? "border-[#2388FF] bg-blue-50 text-[#2388FF]"
                        : "border-gray-200 text-[#666F8D] hover:bg-gray-50"
                        }`}
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => setReportFormat("csv")}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${reportFormat === "csv"
                        ? "border-[#2388FF] bg-blue-50 text-[#2388FF]"
                        : "border-gray-200 text-[#666F8D] hover:bg-gray-50"
                        }`}
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => setReportFormat("excel")}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${reportFormat === "excel"
                        ? "border-[#2388FF] bg-blue-50 text-[#2388FF]"
                        : "border-gray-200 text-[#666F8D] hover:bg-gray-50"
                        }`}
                    >
                      Excel
                    </button>
                  </div>
                </div>

                {/* Generate Button */}
                <div className="flex items-end">
                  <button className="w-full rounded-lg bg-[#2388FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a6fd8] transition-colors">
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Automated Reports */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-[#19213D]">Scheduled Reports</h3>
                <button className="text-xs font-medium text-[#2388FF] hover:text-[#1a6fd8]">
                  + Add Schedule
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {scheduledReports.map((report, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#19213D]">{report.name}</p>
                      <div className="flex gap-4 mt-1">
                        <span className="text-xs text-[#666F8D]">📅 {report.frequency}</span>
                        <span className="text-xs text-[#666F8D]">📧 {report.recipients}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#666F8D]">Next run:</p>
                      <p className="text-xs font-medium text-[#19213D]">{report.nextRun}</p>
                    </div>
                    <div className="ml-4 flex gap-2">
                      <button className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                      <button className="text-xs text-red-600 hover:text-red-800">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Previous Reports */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-100 px-4 py-3">
              <h3 className="text-sm font-medium text-[#19213D]">Previous Reports</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Report Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D]">Generated</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Size</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previousReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {report.format === "PDF" ? "📄" : report.format === "CSV" ? "📊" : "📈"}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-[#19213D]">{report.name}</p>
                            <p className="text-xs text-[#666F8D]">ID: {report.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${report.type === "Daily" ? "bg-blue-100 text-blue-800" :
                          report.type === "Weekly" ? "bg-green-100 text-green-800" :
                            report.type === "Monthly" ? "bg-purple-100 text-purple-800" :
                              "bg-gray-100 text-gray-800"
                          }`}>
                          {report.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-[#19213D]">{report.lastGenerated}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <p className="text-sm text-[#666F8D]">{report.size}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${report.status === "Ready" ? "bg-green-100 text-green-800" :
                          report.status === "Processing" ? "bg-yellow-100 text-yellow-800" :
                            "bg-blue-100 text-blue-800"
                          }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                            disabled={report.status !== "Ready"}
                          >
                            Download
                          </button>
                          <button className="text-gray-600 hover:text-gray-800 text-xs font-medium">
                            Share
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
