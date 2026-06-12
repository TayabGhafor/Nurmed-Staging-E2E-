"use client";

import { useAuth } from "../../contexts/AuthContext";
import { memo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import HospitalAdminSidebar from "./_components/HospitalAdminSidebar";
import { UIStateProvider, useUIState } from "../../contexts/UIStateContext";
import { FeatureFlagProvider } from "../../contexts/FeatureFlagContext";
import ChangePasswordModal from "../../components/Modal/ChangePasswordModal";
import Loader from "../../components/Loader";
import { supabase } from "../../lib/supabase";
import { useHospitalAdminAccess } from "../../hooks/useHospitalAdminAccess";

// Memoize the sidebar component to prevent unnecessary re-renders
const MemoizedHospitalAdminSidebar = memo(HospitalAdminSidebar);

// Separate component for the main layout content
const HospitalAdminLayoutContent = memo(({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  const { openChangePassword } = useUIState();
  const [isMobile, setIsMobile] = useState(false);
  const [hospitalName, setHospitalName] = useState<string>("");
  const router = useRouter();
  
  // Import the hospital admin access hook
  const { capabilities, loading: capabilitiesLoading, hasAnyAccess } = useHospitalAdminAccess();
  
  // Check if user has both doctor and hospitalAdmin roles
  const hasBothRoles = user?.role?.includes("doctor") && user?.role?.includes("hospitalAdmin");

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const getHospitalsById = async (id: number) => {
    const { data, error } = await supabase
      .from('hospital')
      .select('*')
      .eq('id', id);
    if (error) {
      throw new Error(`Get hospital by id failed: ${error.message}`);
    }
    return data;
  };

  useEffect(() => {
    const fetchHospitalName = async () => {
      if (!user?.hospital_id) return;
      try {
        const data = await getHospitalsById(user.hospital_id);
        const name = Array.isArray(data) && data.length > 0 ? (data[0] as any)?.name : "";
        setHospitalName(name || "");
      } catch (err) {
        console.error(err);
        setHospitalName("");
      }
    };
    fetchHospitalName();
  }, [user?.hospital_id]);

  // Wait for capabilities to load before showing UI
  if (capabilitiesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader size="large" />
      </div>
    );
  }

  // If user has no access to any hospital admin features, redirect to dashboard
  if (!hasAnyAccess()) {
    router.push('/');
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Top Bar - Matching Dashboard Layout */}
      <div className="flex h-[53px] flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white p-2 shadow-sm">
        <div className="flex items-center">
          <img src="/images/dash.png" alt="Logo" className="h-8 px-6" />
          <span className="text-sm font-medium text-gray-600">{
            hospitalName
              .toLowerCase()
              .split(" ")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Switch to Doctor Portal button - only show if user has both roles */}
          {hasBothRoles && (
            <button
              onClick={() => router.push('/')}
              className="px-3 py-1.5 mr-2 text-sm font-medium text-[#2832AB] bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-2"
              title="Switch to Doctor Portal"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span>Doctor Portal</span>
            </button>
          )}
          <div className="relative group">
            <button
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <img src="/images/settings.svg" alt="Settings" className="h-6 w-6 opacity-[0.5]" />
            </button>

            {/* Settings Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 backdrop-blur-sm opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
              <button
                onClick={() => {
                  openChangePassword();
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
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="pr-4 transition-colors duration-200 hover:text-gray-900"
          >
            <img src="/images/logout.svg" alt="Logout" className="h-6 px-4" />
          </button>
        </div>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Hidden on mobile, shown on desktop */}
        <div className="hidden md:block md:max-w-[362px]">
          <MemoizedHospitalAdminSidebar onNavigation={(path) => router.push(path)} />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>

      <ChangePasswordModal />
    </div>
  );
});

export default function HospitalAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Handle redirects in useEffect to avoid setState during render
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // User is not authenticated, redirect to login
        router.push("/login");
      } else if (!user.role?.includes("hospitalAdmin")) {
        // User is authenticated but not a hospital admin, redirect to dashboard
        router.push("/");
      }
    }
  }, [user, isLoading, router]);

  // Handle authentication and loading states
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader size="large" text="Loading..." />
      </div>
    );
  }

  // Allow superAdmin or hospitalAdmin roles to access
  // SuperAdmin can access all portals
  const canAccessHospitalAdmin = user?.role?.includes("hospitalAdmin") || 
  user?.role?.includes("superAdmin");
  
  if (!user || !canAccessHospitalAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader size="large" />
      </div>
    );
  }

  // Return the stable layout content
  return (
    <UIStateProvider>
      <FeatureFlagProvider>
        <HospitalAdminLayoutContent>{children}</HospitalAdminLayoutContent>
      </FeatureFlagProvider>
    </UIStateProvider>
  );
}
