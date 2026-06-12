"use client";

import toast from "react-hot-toast";
import { AudioIcon } from "./svgs";
import { useMicrophone } from "../contexts/MicrophoneContext";


interface EmptyStateProps {
    className?: string;
    title?: string;
    description?: string;
    btnValue?: string;
    btnAction?: () => void;
}

const EmptyState = ({ className, title = "Please select a patient to view details", description = "Choose a patient from the list on the left to view their examinations and conversations", btnValue = "Start New Recording", btnAction }: EmptyStateProps) => {
    const {
        isMicReady,
        permission: micPermission,
        micGateMessage,
        requestAccess: requestMicAccess,
    } = useMicrophone();

    const handleClick = () => {
        if (!btnAction) return;
        if (isMicReady) {
            btnAction();
            return;
        }
        toast.error(micGateMessage, { id: "mic-gate", duration: 3000, position: "bottom-right" });
        if (micPermission === "prompt") requestMicAccess();
    };

    return (
        <div className={`flex flex-col items-center justify-center p-4 ${className}`}>
            <AudioIcon />
            <p className="text-xl text-secondary font-medium">{title}</p>
            <p className="text-sm text-secondary-100 mt-2 mb-4">{description}</p>
            <button
                className={`px-3 md:px-4 py-2 rounded-lg flex items-center justify-center mx-auto shadow-md text-sm md:text-base transition-colors ${
                    isMicReady
                        ? "bg-[#2832A8] text-white hover:bg-[#1f2687]"
                        : "bg-slate-300 text-slate-600 cursor-not-allowed"
                }`}
                onClick={handleClick}
                aria-disabled={!isMicReady}
                title={!isMicReady ? micGateMessage : undefined}
            >
                <span className="mr-2 text-sm">+</span>
                {btnValue}
            </button>
        </div>
    )
}
export default EmptyState;
