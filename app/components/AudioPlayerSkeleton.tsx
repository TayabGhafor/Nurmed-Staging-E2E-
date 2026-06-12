import React from "react";

const AudioPlayerSkeleton = () => {
  return (
    <div className="w-full p-4">
      <div className="mx-auto max-w-2xl">
        {/* Top controls row (back, play/pause, forward) */}
        <div className="mb-2 flex items-center justify-center gap-8">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-300" />
          <div className="h-14 w-14 animate-pulse rounded-full bg-gray-300" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-300" />
        </div>

        {/* Progress bar skeleton */}
        <div>
          <div className="relative">
            <div className="relative h-6 w-full">
              {/* Background track */}
              <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-gray-200">
                {/* Progress fill */}
                <div className="h-1.5 w-1/3 animate-pulse rounded-full bg-gray-300" />
              </div>
            </div>
          </div>

          {/* Time labels skeleton */}
          <div className="mt-1 flex justify-between px-1">
            <div className="h-3 w-10 animate-pulse rounded bg-gray-300" />
            <div className="h-3 w-10 animate-pulse rounded bg-gray-300" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayerSkeleton;
