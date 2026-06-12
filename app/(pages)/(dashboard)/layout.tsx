"use client";
import { useAuth } from "../../contexts/AuthContext";
import { SessionProvider } from "../../contexts/SessionContext";
import { UIStateProvider } from "../../contexts/UIStateContext";
import { FeatureFlagProvider } from "../../contexts/FeatureFlagContext";
import { useUIState } from "../../contexts/UIStateContext";
import AppSidebar from "../../components/AppSidebar";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import ChangePasswordModal from "../../components/Modal/ChangePasswordModal";
import ViewProfileModal from "../../components/Modal/ViewProfileModal";
import Loader from "../../components/Loader";
import CloudflowUrlModal from "../../components/Modal/CloudflowUrlModal";
import MicrophoneStatusIndicator from "../../components/MicrophoneStatusIndicator";
import { MicrophoneProvider } from "../../contexts/MicrophoneContext";
import { SonioxProvider } from "@soniox/react";
import { useDoctorLanguagesAndTemplates } from "../../hooks/useDoctorLanguagesAndTemplates";
import { usePreferredLanguage } from "../../hooks/usePreferredLanguage";
// import useKeyboardTracking from "../../hooks/useKeyboardTracking";

const region = process.env.NEXT_PUBLIC_REGION;
const sonioxApiKey = process.env.NEXT_PUBLIC_SONIOX_API_KEY ?? "";

// Separate component for the top bar that can use useUIState
function TopBar() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const { openChangePassword, openViewProfile, openRpaUrl } = useUIState();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Check if user has both doctor and hospitalAdmin roles
  const hasBothRoles = user?.role?.includes("doctor") && user?.role?.includes("hospitalAdmin");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);
  
  return (
    <div className="flex h-[53px] min-w-0 flex-shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-0 shrink items-center">
        <button
          type="button"
          onClick={() => router.push('/')}
        >
          <img
            src="/images/dash.png"
            alt="Logo"
            className="h-8 max-h-8 w-auto shrink-0 px-3 sm:px-6"
          />
        </button>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <MicrophoneStatusIndicator />
        {hasBothRoles && (
          <button
            type="button"
            onClick={() => router.push('/hospital-admin')}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-blue-50 px-2 text-sm font-medium text-[#2832AB] transition-colors hover:bg-blue-100 sm:gap-2 sm:px-3"
            title="Switch to Hospital Admin Portal"
          >
            <svg
              className="hidden h-4 w-4 shrink-0 sm:block"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            <span className="hidden sm:inline">Hospital Admin</span>
            <span className="truncate sm:hidden">Admin</span>
          </button>
        )}

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Settings"
          >
            <img src="/images/settings.svg" alt="Settings" className="h-6 w-6 opacity-[0.5]" />
          </button>
          
          {/* Settings Dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 backdrop-blur-sm transition-all duration-200">
              <button
                onClick={() => {
                  openViewProfile();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 flex items-center gap-3 rounded-lg"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors">
                  <svg 
                    className="h-4 w-4 text-blue-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                    />
                  </svg>
                </div>
                <span className="font-medium">View Profile</span>
              </button>
              <button
                onClick={() => {
                  openChangePassword();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 flex items-center gap-3 rounded-lg"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors">
                  <svg 
                    className="h-4 w-4 text-blue-600" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" 
                    />
                  </svg>
                </div>
                <span className="font-medium">Change Password</span>
              </button>
              {/* {region === "dubai" && (
              <button
                onClick={() => {
                  openRpaUrl();
                  setIsDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 flex items-center gap-3 rounded-lg"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors">
                  <svg
                    className="h-4 w-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 13v6a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h6m5-3h3m0 0v3m0-3L10 14"
                    />
                  </svg>
                </div>
                <span className="font-medium">Cloudflow Url</span>
              </button>
              )} */}
            </div>
          )}
        </div>
        
        <button
          onClick={() => logout()}
          className="shrink-0 pr-2 transition-colors duration-200 hover:text-gray-900 sm:pr-4"
        >
          <img src="/images/logout.svg" alt="Logout" className="h-6 px-2 sm:px-4" />
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const { getDoctorLanguagesAndTemplates } = useDoctorLanguagesAndTemplates();
  const { getPreferredLanguage } = usePreferredLanguage();

  // Handle authentication only - NO role-based redirects to avoid infinite loops
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Only redirect to login if not authenticated
      const currentUrl = window.location.href;
      router.replace(`/login?redirect=${encodeURIComponent(currentUrl)}`);
    }
    // DO NOT redirect based on role - we check access in render instead
  }, [isAuthenticated, isLoading, router]);

  // Prefetch the doctor's templates + languages and the preferred language once
  // when the user lands on the dashboard, so opening the recording modal
  // doesn't trigger another network call.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.hospital_id) {
      getDoctorLanguagesAndTemplates();
      getPreferredLanguage();
    }
  }, [
    isAuthenticated,
    user?.hospital_id,
    getDoctorLanguagesAndTemplates,
    getPreferredLanguage,
  ]);

  // Show loader while checking auth
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FF]">
        <Loader size="large" />
      </div>
    );
  }
  
  // Allow superAdmin, doctor, or hospitalAdmin roles to access
  // SuperAdmin can access all portals
  const canAccessDashboard = user?.role?.includes("doctor") || 
                             user?.role?.includes("superAdmin") ||
                             user?.role?.includes("hospitalAdmin");
  
  if (!canAccessDashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FF]">
        <Loader size="large" />
      </div>
    );
  }

  return (
    <UIStateProvider>
      <FeatureFlagProvider>
        <MicrophoneProvider>
          <div className="flex h-screen flex-col bg-gray-100">
            {/* Top Bar */}
            <TopBar />

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden md:flex-row">
              <SonioxProvider apiKey={sonioxApiKey}>
                <SessionProvider>
                  {/* The existing container will be preserved */}
                  <div className="flex flex-1 overflow-hidden">
                    <AppSidebar />
                    {/* Wrap children in a container that takes remaining width */}
                    <div className="flex-1 overflow-hidden">{children}</div>
                  </div>
                </SessionProvider>
              </SonioxProvider>
            </div>

            {/* Modals */}
            <ChangePasswordModal />
            <ViewProfileModal />
            {region === "dubai" && <CloudflowUrlModal />}
          </div>
        </MicrophoneProvider>
      </FeatureFlagProvider>
    </UIStateProvider>
  );
}
