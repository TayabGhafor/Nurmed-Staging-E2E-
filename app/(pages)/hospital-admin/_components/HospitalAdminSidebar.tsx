"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { useHospitalAdminAccess } from "../../../hooks/useHospitalAdminAccess";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: string;
}

interface HospitalAdminSidebarProps {
  onNavigation?: (path: string) => void;
}

const isDubaiRegion = process.env.NEXT_PUBLIC_REGION === "dubai";

const HospitalAdminSidebar = ({ onNavigation }: HospitalAdminSidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user } = useAuth();
  const { capabilities, loading: capabilitiesLoading } = useHospitalAdminAccess();

  // Navigation items for hospital admin - memoized to prevent recreation
  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];
    
    // Doctor Management - always visible to all hospital admins
    items.push({
      id: "doctors",
      label: "Doctor Management",
      icon: "👨‍⚕️",
      path: "/hospital-admin/doctors"
    });

    if (isDubaiRegion) {
      items.push({
        id: "scribe",
        label: "Scribe Management",
        icon: "✍️",
        path: "/hospital-admin/scribe",
      });
    }

    if (!isDubaiRegion) {
      items.push({
        id: "api-keys",
        label: "API Key Management",
        icon: "🔑",
        path: "/hospital-admin/api-keys",
      });
    }

    if (!isDubaiRegion) {
      items.push({
        id: "templates-management",
        label: "Template Management",
        icon: "📄",
        path: "/hospital-admin/template"
      });
    }
    
    // // Add encounter analytics if user can view encounters
    // if (capabilities.canViewEncounters) {
    //   items.push({
    //     id: "encounters",
    //     label: "Encounter Analytics",
    //     icon: "📈",
    //     path: "/hospital-admin/encounters"
    //   });
    // }
    
    // // Add encounter data if user can view encounters
    // if (capabilities.canViewEncounters) {
    //   items.push({
    //     id: "encounter-data",
    //     label: "Encounter Data",
    //     icon: "📝",
    //     path: "/hospital-admin/encounter-data"
    //   });
    // }
    
    // // Add reports if user can view analytics or costs/tools
    // if (capabilities.canViewAnalytics || capabilities.canViewCostsTools) {
    //   items.push({
    //     id: "reports",
    //     label: "Reports & Exports",
    //     icon: "📄",
    //     path: "/hospital-admin/reports"
    //   });
    // }
    
    return items;
  }, [capabilities]);

  // Memoize the navigation handler to prevent recreation
  const handleNavigation = useCallback((path: string) => {
    if (onNavigation) {
      onNavigation(path);
    } else {
      router.push(path);
    }
  }, [router, onNavigation]);

  // Memoize the sidebar toggle handler
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Memoize the active state calculations to prevent unnecessary re-renders
  const activeStates = useMemo(() => {
    return navItems.reduce((acc, item) => {
      acc[item.id] = pathname === item.path ||
        (item.path !== "/hospital-admin" && pathname.startsWith(item.path));
      return acc;
    }, {} as Record<string, boolean>);
  }, [pathname, navItems]);

  // Don't show anything if no capabilities (layout handles this now)
  if (capabilitiesLoading || navItems.length === 0) {
    return null;
  }

  return (
    <div
      className={`${isSidebarOpen ? "w-full p-4 md:w-[362px] md:max-w-[362px] md:p-6" : "p-3 py-10 md:w-16"
        } relative flex flex-col transition duration-300 h-[calc(100dvh-3.35rem)] md:h-[calc(100dvh-3.35rem)]`}
    >
      <div className="relative flex items-center">
        {isSidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full border border-[#A7C7ED] bg-[#D7E5F0] p-1">
              <img
                src="/images/person.svg"
                alt="Person"
                className="h-6 w-7 object-cover md:h-8 md:w-9"
              />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-500">Hospital Administrator</p>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="absolute right-0 top-1/2 hidden -translate-y-1/2 cursor-pointer p-1.5 transition-all duration-300 md:block"
        >
          <img
            src="/images/toggle.svg"
            alt="toggle sidebar"
            className={`size-5 transform transition-transform duration-300 ${!isSidebarOpen ? "rotate-180" : ""
              }`}
          />
        </button>
      </div>

      {isSidebarOpen && (
        <>
          {/* Hospital Info */}
          {/* <div className="mt-6 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-blue-800">Hospital Name</p>
            <p className="text-sm font-semibold text-gray-800">General Hospital</p>
          </div> */}

          {/* Navigation Menu */}
          <div className="relative flex-1 overflow-y-auto py-5">
            <h2 className="text-sm font-semibold text-gray-800">Navigations</h2>
            <div className="space-y-2 py-2">
              {navItems.map((item) => {
                const isActive = activeStates[item.id];

                return (
                  <div
                    key={item.id}
                    className={`cursor-pointer rounded-lg border bg-white p-3 transition-all ${isActive
                      ? "border-[#2388FF] bg-blue-50"
                      : "border-[#E5E5EA] hover:border-gray-300"
                      }`}
                    onClick={() => handleNavigation(item.path)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{item.icon}</span>
                        <p
                          className={`text-sm font-medium ${isActive ? "text-[#2832A8]" : "text-[#19213D]"
                            }`}
                        >
                          {item.label}
                        </p>
                      </div>
                      {item.badge && (
                        <span className="rounded-full bg-[#2832A8] px-2 py-0.5 text-xs text-white">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Collapsed state icons */}
      {!isSidebarOpen && (
        <div className="mt-6 space-y-4">
          {navItems.map((item) => {
            const isActive = activeStates[item.id];

            return (
              <div
                key={item.id}
                className={`cursor-pointer rounded-lg p-2 text-center transition-all ${isActive ? "bg-blue-50 text-[#2388FF]" : "hover:bg-gray-100"
                  }`}
                onClick={() => handleNavigation(item.path)}
                title={item.label}
              >
                <span className="text-xl">{item.icon}</span>
              </div>
            );
          })}
        </div>

      )}
    </div>
  );
};

export default HospitalAdminSidebar;
