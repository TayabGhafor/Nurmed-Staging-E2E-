import React from "react";

const MessageSkeleton = () => {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="mb-2 h-4 w-1/4 rounded bg-gray-200" />
          <div className="h-16 rounded-lg bg-gray-200" />
        </div>
      ))}
    </div>
  );
};

export default MessageSkeleton;
