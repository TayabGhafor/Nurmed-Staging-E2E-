"use client";

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface SessionData {
  created_at: string;
  count_copilot: number | null;
  count_admintool: number | null;
  count_optimizecode: number | null;
}

interface AiUsageChartProps {
  sessions: SessionData[];
}

type TimeFilter = "24h" | "7d" | "30d";

const COLORS = {
  copilot: '#2832A8',
  adminTool: '#7C3AED',
  optimizeCode: '#10B981',
};

export default function AiUsageChart({ sessions }: AiUsageChartProps) {
  const [selectedFilter, setSelectedFilter] = useState<TimeFilter>("7d");

  // Filter sessions based on selected time range
  const filteredSessions = useMemo(() => {
    const now = new Date();
    let cutoffDate: Date;

    switch (selectedFilter) {
      case "24h":
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return sessions.filter((session) => {
      const sessionDate = new Date(session.created_at);
      return sessionDate >= cutoffDate;
    });
  }, [sessions, selectedFilter]);

  // Calculate total AI tool usage from filtered sessions
  const chartData = useMemo(() => {
    const totals = {
      copilot: 0,
      adminTool: 0,
      optimizeCode: 0,
    };

    filteredSessions.forEach((session) => {
      totals.copilot += session.count_copilot || 0;
      totals.adminTool += session.count_admintool || 0;
      totals.optimizeCode += session.count_optimizecode || 0;
    });

    return [
      { name: 'Copilot', value: totals.copilot, color: COLORS.copilot },
      { name: 'Admin Tool', value: totals.adminTool, color: COLORS.adminTool },
      { name: 'Optimize Code', value: totals.optimizeCode, color: COLORS.optimizeCode },
    ].filter(item => item.value > 0); // Only show items with non-zero values
  }, [filteredSessions]);

  const totalUsage = chartData.reduce((sum, item) => sum + item.value, 0);

  const getSubtitle = () => {
    switch (selectedFilter) {
      case "24h":
        return "AI tool usage for the last 24 hours";
      case "7d":
        return "AI tool usage for the last 7 days";
      case "30d":
        return "AI tool usage for the last 30 days";
      default:
        return "Distribution across all encounters";
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / totalUsage) * 100).toFixed(1);
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-[#19213D]">{data.name}</p>
          <p className="text-sm text-[#666F8D]">
            {data.value} uses ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#19213D]">AI Tool Usage</h3>
          <p className="text-sm text-[#666F8D] mt-1">{getSubtitle()}</p>
        </div>

        {/* Time Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSelectedFilter("24h")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              selectedFilter === "24h"
                ? "bg-white text-[#2832A8] shadow-sm"
                : "text-[#666F8D] hover:text-[#19213D]"
            }`}
          >
            24h
          </button>
          <button
            onClick={() => setSelectedFilter("7d")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              selectedFilter === "7d"
                ? "bg-white text-[#2832A8] shadow-sm"
                : "text-[#666F8D] hover:text-[#19213D]"
            }`}
          >
            7d
          </button>
          <button
            onClick={() => setSelectedFilter("30d")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              selectedFilter === "30d"
                ? "bg-white text-[#2832A8] shadow-sm"
                : "text-[#666F8D] hover:text-[#19213D]"
            }`}
          >
            30d
          </button>
        </div>
      </div>

      {totalUsage === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm text-[#666F8D]">No AI tool usage data available</p>
            <p className="text-xs text-[#999FAD] mt-1">for the selected time range</p>
          </div>
        </div>
      ) : (
        <>
          <div className="h-72 focus:outline-none [&_*:focus]:outline-none [&_*:focus-visible]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#ffffff"
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value, entry: any) => (
                    <span className="text-sm text-[#666F8D]">
                      {value}: <span className="font-semibold text-[#19213D]">{entry.payload.value}</span>
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
            {chartData.map((item) => (
              <div key={item.name} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <p className="text-xs font-medium text-[#666F8D]">{item.name}</p>
                </div>
                <p className="text-2xl font-bold text-[#19213D]">{item.value}</p>
                <p className="text-xs text-[#666F8D] mt-1">
                  {((item.value / totalUsage) * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}