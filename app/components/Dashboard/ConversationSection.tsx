"use client";

import React, { useState } from "react";
// import MessageItem from "./MessageItem";
// import MessageSkeleton from "../MessageSkeleton";
import AudioPlayer from "../AudioPlayer";
import AudioPlayerSkeleton from "../AudioPlayerSkeleton";
import { Message, Patient } from "../../(pages)/(dashboard)/interfaces";
import { Status } from "../../kyClient/dashboard";

interface ConversationSectionProps {
  messages?: Message[];
  isLoading?: boolean;
  audioUrl?: string | null;
  isAudioLoading?: boolean;
  session?: Patient | null;
}

const ConversationSection: React.FC<ConversationSectionProps> = ({
  messages = [],
  isLoading = false,
  audioUrl = null,
  isAudioLoading = false,
  session = null,
}) => {
  // Local state for message search
  const [messageSearchQuery, setMessageSearchQuery] = useState("");

  const patientMrn = session?.mrn;
  const patientDepartment = session?.department;
  const filteredMessages = messages?.filter((message) =>
    message.content.toLowerCase().includes(messageSearchQuery.toLowerCase()),
  );

  // Check if session is deleted
  const isDeleted = session?.status === Status.Deleted;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden border-[#E3E6EA] p-4 md:border-l md:p-6">
      {patientMrn && patientDepartment && (
        <div className="hidden w-full rounded-lg border border-[#2F81FF] bg-blue-100 p-4 text-center md:block">
          <h3 className="mb-1 text-center font-semibold text-blue-800">
            {patientDepartment}
          </h3>
          <p className="text-center text-xs text-gray-600">MRN: {patientMrn}</p>
        </div>
      )}

      {/* Audio player - hide for deleted sessions */}
      {!isDeleted && (
        <>
          {isAudioLoading ? (
            <AudioPlayerSkeleton />
          ) : (
            <AudioPlayer 
            audioFileUrl={audioUrl || ""}
            audioDuration={session?.sessionDurationSeconds}
            />
          )}
        </>
      )}

      {/* {isLoading ? (
        <MessageSkeleton />
      ) : (
        <>
          <div className="relative mb-4 mt-4 flex-shrink-0 md:mb-6">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search for messages..."
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-3 pl-8 pr-4 text-xs shadow-2xl focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-[calc(100dvh-24rem)] flex-1 overflow-y-auto">
            <div className="space-y-4">
              {filteredMessages.map((message) => (
                <MessageItem
                  key={message.id}
                  id={
                    typeof message.id === "string"
                      ? parseInt(message.id, 10)
                      : message.id
                  }
                  sender={message.sender}
                  content={message.content}
                  timestamp={message.timestamp}
                />
              ))}
            </div>
          </div>
        </>
      )} */}
    </div>
  );
};

export default ConversationSection;
