"use client";

import React from "react";

interface MessageItemProps {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
}

const MessageItem: React.FC<MessageItemProps> = ({
  id,
  sender,
  content,
  timestamp,
}) => {
  return (
    <div className="rounded-lg bg-[#F7F8FA] p-4 transition-colors duration-200 hover:bg-gray-100">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold capitalize text-gray-800">
          {sender}
        </p>
        <span className="text-xs text-[#666F8D]">{timestamp}</span>
      </div>
      <p className="break-words text-xs leading-relaxed text-[#666F8D]">
        {content}
      </p>
    </div>
  );
};

export default MessageItem;
