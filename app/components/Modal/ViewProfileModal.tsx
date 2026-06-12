"use client";

import { useState, useEffect, useRef } from "react";
import { useUIState } from "../../contexts/UIStateContext";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { dashboardService } from "../../kyClient/dashboard";
import Modal from ".";

const departmentOptions = [
  { value: "ED", label: "Emergency Department" },
  { value: "PC", label: "Primary Care" },
  { value: "OPD", label: "Outpatient Department" },
  { value: "REVIEW", label: "Patient Review" },
  { value: "RADIOLOGY", label: "Radiology" },
];

const getDepartmentLabel = (departmentCode: string | null | undefined): string => {
  if (!departmentCode) return 'N/A';
  const department = departmentOptions.find(opt => opt.value === departmentCode);
  return department ? department.label : departmentCode;
};

export default function ViewProfileModal() {
  const { isViewProfileOpen, closeViewProfile } = useUIState();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<{
    name: string;
    email: string;
    designation: string;
    preferredLanguage: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isFetchingRef = useRef(false);

  console.log("user",user);
  

  useEffect(() => {
    if (isViewProfileOpen && user && !isFetchingRef.current) {
      fetchProfileData();
    } else if (!isViewProfileOpen) {
      // Reset data when modal closes
      setProfileData(null);
      setIsLoading(false);
      isFetchingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewProfileOpen]);

  const fetchProfileData = async () => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.error("No authenticated user");
        setIsLoading(false);
        return;
      }

      // Fetch doctor data with department
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctor')
        .select('first_name, last_name, sur_name, email, department')
        .eq('user_id', session.user.id)
        .single();

      // Build full name
      let fullName = '';
      if (doctorData) {
        const parts = [
          doctorData.first_name,
          doctorData.sur_name,
          doctorData.last_name
        ].filter(Boolean);
        fullName = parts.join(' ');
      } else if (user) {
        // Fallback to user data from context
        const parts = [
          user.first_name,
          user.sur_name,
          user.last_name
        ].filter(Boolean);
        fullName = parts.join(' ') || 'N/A';
      }

      // Get preferred language
      let preferredLanguage = 'N/A';
      try {
        const language = await dashboardService.getPreferredLanguage();
        if (language) {
          preferredLanguage = language;
        }
      } catch (error) {
        console.warn("Failed to fetch preferred language:", error);
      }

      const departmentCode = doctorData?.department || user?.department;
      const designation = getDepartmentLabel(departmentCode);

      setProfileData({
        name: fullName || 'N/A',
        email: doctorData?.email || user?.email || 'N/A',
        designation: designation,
        preferredLanguage: preferredLanguage
      });
    } catch (error: any) {
      console.error("Error fetching profile data:", error);
      // Set fallback data
      if (user) {
        const parts = [
          user.first_name,
          user.sur_name,
          user.last_name
        ].filter(Boolean);
        const departmentCode = user.department;
        const designation = getDepartmentLabel(departmentCode);

        setProfileData({
          name: parts.join(' ') || 'N/A',
          email: user.email || 'N/A',
          designation: designation,
          preferredLanguage: 'N/A'
        });
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  if (!isViewProfileOpen) return null;

  return (
    <Modal className="w-full bg-white sm:rounded-lg" onClose={closeViewProfile}>
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <p className="text-center text-xl text-primary-300 sm:text-2xl md:font-medium">
          View Profile
        </p>

        {isLoading ? (
          <div className="w-full flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="w-full space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={profileData?.name || ''}
                disabled
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 bg-gray-50 sm:py-3 sm:text-base cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={profileData?.email || ''}
                disabled
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 bg-gray-50 sm:py-3 sm:text-base cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="designation" className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Designation
              </label>
              <input
                type="text"
                id="designation"
                value={profileData?.designation || ''}
                disabled
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 bg-gray-50 sm:py-3 sm:text-base cursor-not-allowed"
              />
            </div>

            <div className="w-full flex justify-end">
              <button
                onClick={closeViewProfile}
                className="flex w-full items-center justify-center rounded-lg bg-[#2832A8] px-4 py-3 text-sm text-white shadow-lg sm:w-auto hover:bg-[#1f2680] transition-colors"
                style={{ maxWidth: "220px" }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

