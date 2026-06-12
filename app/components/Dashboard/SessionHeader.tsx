"use client";

import React from "react";
import { Status } from "../../kyClient/dashboard";
import { Patient, TabType } from "../../(pages)/(dashboard)/interfaces";
import { useRouter } from "next/navigation";
import { getDepartmentDisplayName } from "../../contexts/SessionContext";

interface SessionHeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  session?: Patient | null;
  onBackClick?: () => void;
}

const SessionHeader: React.FC<SessionHeaderProps> = ({
  activeTab,
  setActiveTab,
  session = null,
  onBackClick,
}) => {
  const router = useRouter();

  // Use setActiveTab directly
  const onTabChange = setActiveTab;

  // Default back handler if not provided
  const handleBackClick = onBackClick || (() => router.push("/"));

  const patientMrn = session?.mrn;
  const patientDepartment = session?.department;
  const patientStatus = session?.status;

  return (
    <>
      {/* Mobile back button and patient info */}
      <div className="flex items-center bg-white p-4 md:hidden">
        <button onClick={handleBackClick} className="mr-3 text-gray-600">
          <svg
            className="h-6 w-6"
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
        </button>
        {patientMrn && patientDepartment && patientStatus !== Status.Failed ? (
          <div>
            <h2 className="font-semibold text-gray-700">MRN: {patientMrn}</h2>
            <p className="text-sm text-gray-500">{getDepartmentDisplayName(patientDepartment)}</p>
          </div>
        ) : null}
      </div>

      {/* Mobile tabs */}
      {patientMrn && patientDepartment && patientStatus !== Status.Failed ? (
        <div className="flex border-b border-gray-200 md:hidden">
          <button
            onClick={() => onTabChange("examinations")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "examinations"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500"
            }`}
          >
            Examinations
          </button>
          <button
            onClick={() => onTabChange("conversations")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "conversations"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500"
            }`}
          >
            Audio
          </button>
        </div>
      ) : null}

      {/* Mobile department info */}
      <div
        className={`border-b border-gray-200 p-4 md:hidden ${
          activeTab === "examinations" ? "hidden" : "block"
        }`}
      >
        {patientMrn && patientDepartment && (
          <div className="rounded-lg border border-[#2F81FF]">
            <div className="rounded-lg bg-blue-100 px-4 py-2 text-center">
              <h3 className="mb-1 text-sm font-semibold text-blue-800">
                {getDepartmentDisplayName(patientDepartment)}
              </h3>
              <p className="text-xs text-gray-500">MRN: {patientMrn}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SessionHeader;
