import React from "react";

interface LoaderProps {
  size?: "small" | "medium" | "large";
  color?: string;
  className?: string;
  text?: string;
}

const Loader: React.FC<LoaderProps> = ({
  size = "medium",
  color = "#2832A8",
  className = "",
  text = "Loading...",
}) => {
  const sizeClasses = {
    small: "w-4 h-4",
    medium: "w-8 h-8",
    large: "w-12 h-12",
  };

  const textSizeClasses = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base",
  };

  return (
    <div
      className={`flex flex-col items-center justify-center space-y-2 ${className}`}
    >
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-t-transparent shadow-lg`}
        style={{
          borderColor: color,
          borderTopColor: "transparent",
        }}
      >
        <span className="sr-only">{text}</span>
      </div>
      <span className={`${textSizeClasses[size]} font-medium text-gray-600`}>
        {text}
      </span>
    </div>
  );
};

export default Loader;
