"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import DoctorManagementPage from "./doctors/page";
import HospitalAdminSidebar from "./_components/HospitalAdminSidebar";
import { useHospitalAdminAccess } from "../../hooks/useHospitalAdminAccess";

const HospitalAdminDashboard = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { capabilities, loading: capabilitiesLoading } = useHospitalAdminAccess();

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // On mobile, show sidebar initially; on desktop, always show content
      setShowSidebar(mobile);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Handle navigation from sidebar
  const handleNavigation = (path: string) => {
    if (isMobile) {
      setShowSidebar(false);
    }
    router.push(path);
  };

  // Wait for capabilities to load
  if (capabilitiesLoading) {
    return null;
  }

  // If on mobile and showing sidebar, render sidebar
  if (isMobile && showSidebar) {
    return (
      <div className="h-full">
        <HospitalAdminSidebar onNavigation={handleNavigation} />
      </div>
    );
  }

  // If on mobile and not showing sidebar, render content
  if (isMobile && !showSidebar) {
    return (
      <div className="h-full">
        <DoctorManagementPage />
      </div>
    );
  }

  // Desktop view - show doctor management page
  return <DoctorManagementPage />;
};

export default HospitalAdminDashboard;