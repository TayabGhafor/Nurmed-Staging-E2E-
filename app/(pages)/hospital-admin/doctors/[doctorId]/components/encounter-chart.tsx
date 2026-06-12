"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface SessionData {
  id: number;
  created_at: string;
}

interface EncounterChartProps {
  sessions: SessionData[];
}

type TimeFilter = "24h" | "7d" | "30d";

export default function EncounterChart({ sessions }: EncounterChartProps) {
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

  // Group sessions by date and count them
  const chartData = useMemo(() => {
    const dateMap = new Map<string, number>();

    // Determine date format based on filter
    const formatOptions: Intl.DateTimeFormatOptions =
      selectedFilter === "24h"
        ? { hour: "numeric", hour12: true }
        : { month: "short", day: "numeric" };

    filteredSessions.forEach((session) => {
      const sessionDate = new Date(session.created_at);
      let dateKey: string;

      if (selectedFilter === "24h") {
        // Group by hour for 24h view
        dateKey = sessionDate.toLocaleDateString("en-US", formatOptions);
      } else {
        // Group by day for 7d and 30d views
        dateKey = sessionDate.toLocaleDateString("en-US", formatOptions);
      }

      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    });

    // Convert to array and sort by date
    const data = Array.from(dateMap.entries())
      .map(([date, count]) => ({
        date,
        encounters: count,
      }));

    // For 24h view, show all hours. For others, limit data points
    if (selectedFilter === "24h") {
      return data.slice(-24);
    } else if (selectedFilter === "7d") {
      return data.slice(-7);
    } else {
      return data.slice(-30);
    }
  }, [filteredSessions, selectedFilter]);

  const getSubtitle = () => {
    switch (selectedFilter) {
      case "24h":
        return "Encounter for the last 24 hours";
      case "7d":
        return "Encounter for the last 7 days";
      case "30d":
        return "Encounter for the last 30 days";
      default:
        return "Daily encounter count";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#19213D]">Encounters Over Time</h3>
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

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-72">
          <div className="text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm text-[#666F8D]">No encounter data available</p>
            <p className="text-xs text-[#999FAD] mt-1">for the selected time range</p>
          </div>
        </div>
      ) : (
        <div className="h-72 focus:outline-none [&_*:focus]:outline-none [&_*:focus-visible]:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...chartData].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#666F8D', fontSize: 12 }}
                tickLine={{ stroke: '#E5E7EB' }}
                axisLine={{ stroke: '#E5E7EB' }}
                angle={selectedFilter === "30d" ? -45 : 0}
                textAnchor={selectedFilter === "30d" ? "end" : "middle"}
                height={selectedFilter === "30d" ? 60 : 30}
              />
              <YAxis
                tick={{ fill: '#666F8D', fontSize: 12 }}
                tickLine={{ stroke: '#E5E7EB' }}
                axisLine={{ stroke: '#E5E7EB' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '8px 12px',
                }}
                labelStyle={{ color: '#19213D', fontWeight: 600, marginBottom: '4px' }}
                cursor={{ fill: 'rgba(40, 50, 168, 0.05)' }}
              />
              <Bar
                dataKey="encounters"
                fill="#2832A8"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}