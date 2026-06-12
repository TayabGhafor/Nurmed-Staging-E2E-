"use client";

import { useState, useMemo } from "react";

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
  sessiontemplate: {
    id: number;
    name: string;
    code: string;
  } | null;
}

interface EncountersTableProps {
  sessions: SessionData[];
  departmentMapping: Record<string, string>;
}

export default function EncountersTable({ sessions, departmentMapping }: EncountersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(sessions.map(s => s.status));
    return Array.from(statuses).sort();
  }, [sessions]);

  const uniqueDepartments = useMemo(() => {
    const departments = new Set(
      sessions
        .filter(s => s.sessiontemplate?.code)
        .map(s => s.sessiontemplate!.code)
    );
    return Array.from(departments).sort();
  }, [sessions]);

  const uniqueTemplates = useMemo(() => {
    const templates = new Set(
      sessions
        .filter(s => s.sessiontemplate?.name)
        .map(s => s.sessiontemplate!.name)
    );
    return Array.from(templates).sort();
  }, [sessions]);

  // Filter sessions based on all filters
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        searchQuery === "" ||
        session.id.toString().includes(searchLower) ||
        session.mrn.toLowerCase().includes(searchLower) ||
        session.sessiontemplate?.name.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = statusFilter === "all" || session.status === statusFilter;

      // Department filter
      const matchesDepartment = 
        departmentFilter === "all" || 
        session.sessiontemplate?.code === departmentFilter;

      // Template filter
      const matchesTemplate = 
        templateFilter === "all" || 
        session.sessiontemplate?.name === templateFilter;

      return matchesSearch && matchesStatus && matchesDepartment && matchesTemplate;
    });
  }, [sessions, searchQuery, statusFilter, departmentFilter, templateFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredSessions.length / rowsPerPage);
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredSessions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredSessions, currentPage, rowsPerPage]);

  // Reset to first page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    // If dateString does not end with 'Z', append it so it's parsed as UTC
    const normalizedDateString = dateString.endsWith('Z') ? dateString : dateString + 'Z';
    return new Date(normalizedDateString).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed') return 'bg-green-100 text-green-800';
    if (statusLower === 'active' || statusLower === 'in progress') return 'bg-blue-100 text-blue-800';
    if (statusLower === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (statusLower === 'failed') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDepartmentFilter("all");
    setTemplateFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || departmentFilter !== "all" || templateFilter !== "all";

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[#19213D]">Encounters</h3>
            <p className="text-sm text-[#666F8D] mt-1">
              {filteredSessions.length} {filteredSessions.length === 1 ? 'encounter' : 'encounters'} found
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm font-medium text-[#2832A8] hover:text-[#1f2680] transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] focus:border-transparent appearance-none bg-white"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.75rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem',
              }}
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] focus:border-transparent appearance-none bg-white"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.75rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem',
              }}
            >
              <option value="all">All Departments</option>
              {uniqueDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {departmentMapping[dept] || dept}
                </option>
              ))}
            </select>
          </div>

          {/* Template Filter */}
          <div>
            <select
              value={templateFilter}
              onChange={(e) => {
                setTemplateFilter(e.target.value);
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] focus:border-transparent appearance-none bg-white"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.75rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem',
              }}
            >
              <option value="all">All Templates</option>
              {uniqueTemplates.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar - Second Row */}
        <div>
          <input
            type="text"
            placeholder="Search by ID, MRN, or Template..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleFilterChange();
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto px-4 md:px-6">
        <table className="w-full min-w-[1000px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D] uppercase tracking-wider">
                Encounter ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D] uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D] uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D] uppercase tracking-wider">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D] uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#666F8D] uppercase tracking-wider">
                Template
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-[#666F8D] uppercase tracking-wider" colSpan={3}>
                AI Tool Usage
              </th>
            </tr>
            <tr className="bg-gray-50 border-t border-gray-200">
              <th colSpan={6}></th>
              <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666F8D] uppercase tracking-wider border-l border-gray-200">
                Copilot
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666F8D] uppercase tracking-wider border-l border-gray-200">
                Admin Tool
              </th>
              <th className="px-2 py-2 text-center text-[10px] font-medium text-[#666F8D] uppercase tracking-wider border-l border-gray-200">
                Optimize Code
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedSessions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-[#666F8D]">
                      {hasActiveFilters
                        ? "No encounters found matching your filters"
                        : "No encounters available"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedSessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-[#19213D] font-medium">
                    #{session.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#19213D]">
                    {formatDate(session.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#19213D]">
                    {formatTime(session.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#19213D]">
                    {formatDuration(session.session_duration_seconds)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(session.status)}`}>
                      {session.status === 'IN_PROGRESS' ? 'Processing' : session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#19213D]">
                    {session.sessiontemplate?.name || "-"}
                  </td>
                  <td className="px-2 py-3 text-center text-sm text-[#19213D] border-l border-gray-200">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-medium">
                      {session.count_copilot || 0}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-sm text-[#19213D] border-l border-gray-200">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-medium">
                      {session.count_admintool || 0}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-sm text-[#19213D] border-l border-gray-200">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 font-medium">
                      {session.count_optimizecode || 0}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredSessions.length > 0 && (
        <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#666F8D]">Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] focus:border-transparent bg-white"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-[#666F8D]">
              {((currentPage - 1) * rowsPerPage) + 1}-{Math.min(currentPage * rowsPerPage, filteredSessions.length)} of {filteredSessions.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Previous button */}
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              title="Previous page"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Page numbers */}
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                // Show first page, last page, current page, and pages around current
                const showPage = 
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);
                
                const showEllipsis = 
                  (pageNum === currentPage - 2 && currentPage > 3) ||
                  (pageNum === currentPage + 2 && currentPage < totalPages - 2);

                if (showEllipsis) {
                  return (
                    <span key={pageNum} className="px-3 py-1.5 text-sm text-[#666F8D]">
                      ...
                    </span>
                  );
                }

                if (!showPage) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-[#2832A8] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next button */}
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              title="Next page"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

