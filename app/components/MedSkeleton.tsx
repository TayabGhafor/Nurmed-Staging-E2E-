import React from "react";

const MedSkeleton = () => {
  return (
    <div className="space-y-4 p-4 md:p-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="mb-2 h-8 rounded-lg bg-gray-200" />
          <div className="h-24 rounded-lg bg-gray-200" />
        </div>
      ))}
    </div>
  );
};

export default MedSkeleton;
