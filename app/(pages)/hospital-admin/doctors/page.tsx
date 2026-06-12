"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import toast from "react-hot-toast";
import { supabase } from "../../../lib/supabase";
import { featureFlagsAPI } from "../../../kyClient/featureFlags";
import { dashboardService, HospitalStats } from "../../../kyClient/dashboard";
import { useHospitalAdminAccess } from "../../../hooks/useHospitalAdminAccess";
import { useSession } from "../../../hooks/useSession";
import AddLocationModal from "../../../components/AddLocations";

// Department code to name mapping (from sessiontemplate table)
const DEPARTMENT_MAPPING: Record<string, string> = {
  ED: "Emergency Department",
  PC: "Primary Care",
  OPD: "Outpatient Department",
  REVIEW: "Patient Review",
  RADIOLOGY: "Radiology",
};

const isGlobalRegion = process.env.NEXT_PUBLIC_REGION === "Global";

export interface HospitalLocation {
  id: number;
  name?: string;
  location_name?: string;
  [key: string]: unknown;
}

interface Doctor {
  id: string;
  user_id: string;
  first_name: string;
  sur_name?: string;
  last_name: string;
  email: string;
  department: string; // This will be the code (ED, PC, etc.)
  speciality?: string;
  registration_number: string;
  role: string[]; // Array of roles: can include "doctor", "hospitalAdmin", "superAdmin"
  status: "Active" | "Inactive";
  is_active: boolean;
  created_at: string;
  session_count?: number; // Number of sessions/encounters
  location_id?: number | null;
  location?: { name?: string; address?: string } | null;
}

interface DoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospitalId: number;
  onDoctorAdded: () => void;
  doctorToEdit?: Doctor | null;
  mode: "add" | "edit";
  locations?: HospitalLocation[];
  locationsLoading?: boolean;
}

const DoctorModal: React.FC<DoctorModalProps> = ({
  isOpen,
  onClose,
  hospitalId,
  onDoctorAdded,
  doctorToEdit,
  mode,
  locations = [],
  locationsLoading = false,
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    sur_name: "",
    last_name: "",
    department: "",
    speciality: "",
    registration_number: "",
    role: ["doctor"] as string[],
    location_id: "" as number | "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [features, setFeatures] = useState<any[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [hospitalAdminFeatures, setHospitalAdminFeatures] = useState<any[]>([]);
  const [selectedHospitalAdminFeatures, setSelectedHospitalAdminFeatures] =
    useState<string[]>([]);
  const [hospitalAdminFeaturesLoading, setHospitalAdminFeaturesLoading] =
    useState(false);
  const [specialities, setSpecialities] = useState<{ name: string }[]>([]);

  // Refs for click outside detection (separate for mobile and desktop layouts)
  const mobileRoleRef = useRef<HTMLDivElement>(null);
  const desktopRoleRef = useRef<HTMLDivElement>(null);

  // Handle outside click for Role Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both mobile and desktop dropdown containers
      const outsideMobile =
        mobileRoleRef.current && !mobileRoleRef.current.contains(target);
      const outsideDesktop =
        desktopRoleRef.current && !desktopRoleRef.current.contains(target);

      if (showRoleDropdown && outsideMobile && outsideDesktop) {
        setShowRoleDropdown(false);
      }
    };

    if (showRoleDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showRoleDropdown]);

  // Fetch available features when modal opens for ADD/EDIT mode OR when role changes
  useEffect(() => {
    if (isOpen) {
      if (formData.role.includes("doctor")) {
        if (mode === "add") {
          fetchFeatures();
        } else if (mode === "edit" && doctorToEdit?.user_id) {
          fetchUserFeatures(doctorToEdit.user_id);
        }
      }

      if (formData.role.includes("hospitalAdmin")) {
        if (mode === "add") {
          fetchHospitalAdminFeatures();
        } else if (mode === "edit" && doctorToEdit?.user_id) {
          fetchUserHospitalAdminFeatures(doctorToEdit.user_id);
        }
      }
    }

    // Clear features if roles are not selected
    if (!formData.role.includes("doctor")) {
      setFeatures([]);
      setSelectedFeatures([]);
    }

    if (!formData.role.includes("hospitalAdmin")) {
      setHospitalAdminFeatures([]);
      setSelectedHospitalAdminFeatures([]);
    }
  }, [isOpen, mode, formData.role, doctorToEdit?.user_id]);

  useEffect(() => {
    if (!isOpen || isGlobalRegion) return;
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
        const res = await fetch(`${baseUrl}/speciality/`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSpecialities(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching specialities:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const fetchFeatures = async () => {
    setFeaturesLoading(true);
    try {
      const allFeatures = await featureFlagsAPI.listFeatures();
      const doctorFeatures = featureFlagsAPI.filterDoctorFeatures(allFeatures);

      setFeatures(doctorFeatures);
      setSelectedFeatures(doctorFeatures.map((f: any) => f.key));
    } catch (error) {
      console.error("Error fetching features:", error);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const fetchUserFeatures = async (userId: string) => {
    setFeaturesLoading(true);
    try {
      const userFeatures = await featureFlagsAPI.getUserFeatures(userId);
      const doctorFeatures = featureFlagsAPI
        .filterDoctorFeatures(userFeatures)
        .map((f: any) => ({
          id: f.id,
          key: f.feature_key,
          name: f.feature_name,
          description: f.description,
          is_enabled: f.is_enabled,
        }));

      setFeatures(doctorFeatures);

      const enabledFeatures = doctorFeatures
        .filter((f: any) => f.is_enabled === true)
        .map((f: any) => f.key);
      setSelectedFeatures(enabledFeatures);
    } catch (error) {
      console.error("Error fetching user features:", error);
    } finally {
      setFeaturesLoading(false);
    }
  };

  const fetchHospitalAdminFeatures = async () => {
    setHospitalAdminFeaturesLoading(true);
    try {
      const allFeatures = await featureFlagsAPI.listFeatures();
      const hospitalAdminFeatures =
        featureFlagsAPI.filterHospitalAdminFeatures(allFeatures);

      setHospitalAdminFeatures(hospitalAdminFeatures);
      setSelectedHospitalAdminFeatures(
        hospitalAdminFeatures.map((f: any) => f.key),
      );
    } catch (error) {
      console.error("Error fetching hospital admin features:", error);
    } finally {
      setHospitalAdminFeaturesLoading(false);
    }
  };

  const fetchUserHospitalAdminFeatures = async (userId: string) => {
    setHospitalAdminFeaturesLoading(true);
    try {
      const userFeatures = await featureFlagsAPI.getUserFeatures(userId);
      const hospitalAdminFeatures = featureFlagsAPI
        .filterHospitalAdminFeatures(userFeatures)
        .map((f: any) => ({
          id: f.id,
          key: f.feature_key,
          name: f.feature_name,
          description: f.description,
          is_enabled: f.is_enabled,
        }));

      setHospitalAdminFeatures(hospitalAdminFeatures);

      const enabledFeatures = hospitalAdminFeatures
        .filter((f: any) => f.is_enabled === true)
        .map((f: any) => f.key);
      setSelectedHospitalAdminFeatures(enabledFeatures);
    } catch (error) {
      console.error("Error fetching user hospital admin features:", error);
    } finally {
      setHospitalAdminFeaturesLoading(false);
    }
  };

  // Populate form when editing
  useEffect(() => {
    if (doctorToEdit && mode === "edit") {
      // Filter out superAdmin role - hospital admins cannot edit superAdmin role
      const roles = Array.isArray(doctorToEdit.role)
        ? doctorToEdit.role
        : [doctorToEdit.role];
      const filteredRoles = roles.filter((r) => r !== "superAdmin");

      setFormData({
        email: doctorToEdit.email,
        first_name: doctorToEdit.first_name,
        sur_name: doctorToEdit.sur_name || "",
        last_name: doctorToEdit.last_name,
        department: doctorToEdit.department,
        speciality: doctorToEdit.speciality || "",
        registration_number: doctorToEdit.registration_number || "",
        role: filteredRoles.length > 0 ? filteredRoles : ["doctor"], // Default to doctor if only superAdmin
        location_id: doctorToEdit.location_id ?? "",
      });
    } else {
      // Reset form for add mode
      setFormData({
        email: "",
        first_name: "",
        sur_name: "",
        last_name: "",
        department: "",
        speciality: "",
        registration_number: "",
        role: ["doctor"],
        location_id: "",
      });
    }
  }, [doctorToEdit, mode]);

  // Handle outside click to close modal
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Handle modal close and form reset
  const handleClose = () => {
    // Reset form to initial state
    setFormData({
      email: "",
      first_name: "",
      sur_name: "",
      last_name: "",
      department: "",
      speciality: "",
      registration_number: "",
      role: ["doctor"],
      location_id: "",
    });
    setFeatures([]);
    setSelectedFeatures([]);
    setHospitalAdminFeatures([]);
    setSelectedHospitalAdminFeatures([]);
    setShowRoleDropdown(false); // Ensure dropdown is closed
    onClose();
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
      return () => {
        document.removeEventListener("keydown", handleEscapeKey);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // This is evercare lahore hospital id
  const isInternalDoctorIdRequired =
    hospitalId === Number(process.env.NEXT_PUBLIC_EVERCARE_LAHORE_HOSPITAL_ID);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedRegistrationNumber = formData.registration_number.trim();
    if (isInternalDoctorIdRequired && !trimmedRegistrationNumber) {
      toast.error("Internal Doctor ID is required", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "add") {
        // Add new doctor
        const { location_id: locId, speciality, ...restForm } = formData;
        const requestData = {
          ...restForm,
          ...(trimmedRegistrationNumber
            ? { registration_number: trimmedRegistrationNumber }
            : {}),
          hospital_id: hospitalId,
          ...(locId !== "" && { location_id: Number(locId) }),
          ...(!isGlobalRegion && speciality ? { speciality } : {}),
        };

        console.log("Sending data to signup API:", requestData);

        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to add doctor");
        }

        if (data.user_id) {
          try {
            // Combine doctor and hospital admin features
            const allFeatures = [
              ...selectedFeatures,
              ...selectedHospitalAdminFeatures,
            ];
            if (allFeatures.length > 0) {
              await featureFlagsAPI.updateUserFeatures(
                data.user_id,
                allFeatures,
              );
            }
          } catch (featureError) {
            console.error("Error saving feature flags:", featureError);
          }
        }

        toast.success(
          "Doctor added successfully! Login credentials sent via email.",
          {
            duration: 3000,
            position: "bottom-right",
          },
        );
      } else {
        // Edit existing doctor - update role properly with auth metadata sync
        // Compare role arrays (check if they're different)
        const roleChanged =
          JSON.stringify(formData.role?.sort()) !==
          JSON.stringify(doctorToEdit?.role?.sort());

        if (roleChanged) {
          // Role is changing - use RPC function to set all roles (replaces existing)
          const { error: rpcError } = await supabase.rpc("set_user_roles", {
            p_user_id: doctorToEdit?.user_id,
            p_roles: formData.role,
          });

          if (rpcError) {
            // If set_user_roles doesn't exist, fallback to legacy function with primary role
            const primaryRole = formData.role?.[0] || "doctor";
            const { error: legacyError } = await supabase.rpc(
              "update_doctor_role_and_hospital",
              {
                p_user_id: doctorToEdit?.user_id,
                p_role: primaryRole,
                p_hospital_id: hospitalId,
              },
            );

            if (legacyError) {
              throw new Error(
                legacyError.message || "Failed to update doctor role",
              );
            }
          }
        }

        // Update email if it changed - use RPC function to sync with auth.users
        if (formData.email !== doctorToEdit?.email) {
          const { error: emailError } = await supabase.rpc(
            "update_doctor_email",
            {
              p_doctor_id: doctorToEdit?.id,
              p_new_email: formData.email,
            },
          );

          if (emailError) {
            throw new Error(emailError.message || "Failed to update email");
          }
        }

        // Update other fields in the doctor table
        // Check if registration_number changed and validate uniqueness if it did
        if (
          trimmedRegistrationNumber &&
          trimmedRegistrationNumber !== doctorToEdit?.registration_number
        ) {
          const { data: existingDoctor, error: checkError } = await supabase
            .from("doctor")
            .select("registration_number")
            .eq("registration_number", trimmedRegistrationNumber)
            .neq("id", doctorToEdit?.id)
            .single();

          if (checkError && checkError.code === "PGRST116") {
            // PGRST116 means no rows found, which means it's unique - proceed
          } else if (checkError && checkError.code !== "PGRST116") {
            console.error(
              "Error checking Internal Doctor ID uniqueness:",
              checkError,
            );
            throw new Error("Failed to validate Internal Doctor ID");
          } else {
            throw new Error(
              "A doctor with this Internal Doctor ID already exists",
            );
          }
        }

        const { error } = await supabase
          .from("doctor")
          .update({
            first_name: formData.first_name,
            sur_name: formData.sur_name,
            last_name: formData.last_name,
            department: formData.department,
            ...(!isGlobalRegion
              ? { speciality: formData.speciality || null }
              : {}),
            ...(trimmedRegistrationNumber
              ? { registration_number: trimmedRegistrationNumber }
              : {}),
            // Update role only if it didn't change (to preserve it)
            ...(!roleChanged ? { role: formData.role } : {}),
            // Update location_id
            location_id:
              formData.location_id === ""
                ? null
                : Number(formData.location_id) || null,
          })
          .eq("id", doctorToEdit?.id);

        if (error) {
          throw new Error(error.message || "Failed to update doctor");
        }

        // Update feature flags if they changed
        const allFeatures = [
          ...selectedFeatures,
          ...selectedHospitalAdminFeatures,
        ];
        if (doctorToEdit?.user_id && allFeatures.length > 0) {
          try {
            await featureFlagsAPI.updateUserFeatures(
              doctorToEdit.user_id,
              allFeatures,
            );
          } catch (featureError) {
            console.error("Error updating feature flags:", featureError);
          }
        }

        toast.success("Doctor updated successfully!", {
          duration: 3000,
          position: "bottom-right",
        });
      }

      onDoctorAdded();
      handleClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to save doctor", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black bg-opacity-50"
      onClick={handleOutsideClick}
    >
      {/* Mobile Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 max-h-[90vh] w-full transform overflow-y-auto rounded-t-xl bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
        }}
      >
        {/* Mobile Header with drag handle */}
        <div className="sticky top-0 rounded-t-xl border-b border-gray-200 bg-white">
          <div className="flex items-center justify-center pb-2 pt-3">
            <div className="h-1 w-12 rounded-full bg-gray-300"></div>
          </div>
          <div className="flex items-center justify-between px-4 pb-4">
            <h2 className="text-lg font-semibold text-[#19213D]">
              {mode === "add" ? "Add New Doctor" : "Edit Doctor"}
            </h2>
            <button
              onClick={handleClose}
              className="rounded-full p-2 transition-colors hover:bg-gray-100"
              disabled={isLoading}
            >
              <svg
                className="h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Form */}
        <div className="px-4 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.sur_name}
                  onChange={(e) =>
                    setFormData({ ...formData, sur_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  placeholder="Enter Title"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  placeholder="Enter first name"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                placeholder="Enter last name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                placeholder="Enter email address"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Internal Doctor ID
                {isInternalDoctorIdRequired && " *"}
              </label>
              <input
                type="text"
                required={isInternalDoctorIdRequired}
                value={formData.registration_number}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    registration_number: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                placeholder="EMP-000000"
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Location
                <span className="ml-1 text-xs font-normal text-gray-500">
                  (Optional)
                </span>
              </label>
              <select
                value={formData.location_id === "" ? "" : formData.location_id}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location_id:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: "right 0.75rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.5em 1.5em",
                }}
              >
                <option value="">Select Location</option>
                {locationsLoading ? (
                  <option disabled>Loading locations...</option>
                ) : (
                  locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name ?? loc.location_name ?? `Location ${loc.id}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {!isGlobalRegion && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Speciality
                </label>
                <select
                  value={formData.speciality}
                  onChange={(e) =>
                    setFormData({ ...formData, speciality: e.target.value })
                  }
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.75rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select Speciality</option>
                  {specialities.map((sp) => (
                    <option key={sp.name} value={sp.name}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Department and Role Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Department *
                </label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.75rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select Department</option>
                  <option value="ED">Emergency Department</option>
                  <option value="PC">Primary Care</option>
                  <option value="OPD">Outpatient Department</option>
                  <option value="REVIEW">Patient Review</option>
                  <option value="RADIOLOGY">Radiology</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Roles *{" "}
                  <span className="text-xs font-normal text-gray-500">
                    (Select one or more)
                  </span>
                </label>
                <div className="relative" ref={mobileRoleRef}>
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  >
                    <span className="text-gray-500">
                      {formData.role && formData.role.length > 0
                        ? `${formData.role.length} role${formData.role.length > 1 ? "s" : ""} selected`
                        : "Select roles"}
                    </span>
                    <svg
                      className={`h-4 w-4 text-gray-400 transition-transform ${showRoleDropdown ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {showRoleDropdown && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-300 bg-white shadow-lg">
                      <div className="p-2">
                        <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={formData.role?.includes("doctor")}
                            onChange={(e) => {
                              const newRoles = e.target.checked
                                ? [...(formData.role || []), "doctor"]
                                : formData.role?.filter(
                                    (r) => r !== "doctor",
                                  ) || [];
                              setFormData({
                                ...formData,
                                role:
                                  newRoles.length > 0 ? newRoles : ["doctor"],
                              });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[#2832AB] focus:ring-2 focus:ring-[#2832AB]"
                          />
                          <span className="text-sm text-[#19213D]">Doctor</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={formData.role?.includes("hospitalAdmin")}
                            onChange={(e) => {
                              const newRoles = e.target.checked
                                ? [...(formData.role || []), "hospitalAdmin"]
                                : formData.role?.filter(
                                    (r) => r !== "hospitalAdmin",
                                  ) || [];
                              setFormData({
                                ...formData,
                                role:
                                  newRoles.length > 0 ? newRoles : ["doctor"],
                              });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[#2832AB] focus:ring-2 focus:ring-[#2832AB]"
                          />
                          <span className="text-sm text-[#19213D]">
                            Hospital Admin
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                {/* Show selected roles - filter out superAdmin */}
                {formData.role && formData.role.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {formData.role
                      .filter((r) => r !== "superAdmin")
                      .map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            role === "hospitalAdmin"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {role === "hospitalAdmin"
                            ? "Hospital Admin"
                            : "Doctor"}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Feature Flags (For doctor role) */}
            {formData.role.includes("doctor") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-[#19213D]">
                    Doctor Feature Access
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">
                      Select features for doctor portal
                    </span>
                  </label>
                  {features.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedFeatures.length === features.length) {
                          setSelectedFeatures([]);
                        } else {
                          setSelectedFeatures(features.map((f) => f.key));
                        }
                      }}
                      className="text-xs font-medium text-[#2832AB] transition-colors hover:text-[#1f2687]"
                    >
                      {selectedFeatures.length === features.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  )}
                </div>

                {featuresLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#2832AB]"></div>
                    <p className="mt-3 text-sm text-gray-500">
                      Loading features...
                    </p>
                  </div>
                ) : features.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-[#E0E4EA] bg-white">
                    <div className="max-h-96 overflow-y-auto">
                      {features.map((feature, index) => (
                        <label
                          key={feature.id}
                          className={`flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-all duration-150 ${
                            index !== features.length - 1
                              ? "border-b border-[#F0F2F5]"
                              : ""
                          } ${
                            selectedFeatures.includes(feature.key)
                              ? "bg-[#EEF2FF] hover:bg-[#E0E7FF]"
                              : "hover:bg-[#F9FAFB]"
                          }`}
                        >
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedFeatures.includes(feature.key)}
                              onChange={(e) => {
                                setSelectedFeatures((prev) =>
                                  e.target.checked
                                    ? [...prev, feature.key]
                                    : prev.filter((k) => k !== feature.key),
                                );
                              }}
                              className="peer sr-only"
                            />
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                                selectedFeatures.includes(feature.key)
                                  ? "border-[#2832AB] bg-[#2832AB]"
                                  : "border-[#D1D5DB] bg-white hover:border-[#2832AB]"
                              }`}
                            >
                              {selectedFeatures.includes(feature.key) && (
                                <svg
                                  className="h-3.5 w-3.5 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-[#19213D]">
                              {feature.name}
                            </div>
                            {feature.description && (
                              <div className="mt-0.5 text-xs leading-relaxed text-[#666F8D]">
                                {feature.description}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="border-t border-[#E0E4EA] bg-[#F9FAFB] px-4 py-3">
                      <p className="text-xs text-[#666F8D]">
                        <span className="font-semibold text-[#2832AB]">
                          {selectedFeatures.length}
                        </span>{" "}
                        of {features.length} doctor features selected
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                    <div className="mb-2 text-gray-400">
                      <svg
                        className="mx-auto h-12 w-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600">
                      No features available
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Features will appear here when available
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Hospital Admin Feature Flags */}
            {formData.role.includes("hospitalAdmin") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-[#19213D]">
                    Hospital Admin Feature Access
                    <span className="mt-0.5 block text-xs font-normal text-gray-500">
                      Select features for hospital admin portal
                    </span>
                  </label>
                  {hospitalAdminFeatures.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          selectedHospitalAdminFeatures.length ===
                          hospitalAdminFeatures.length
                        ) {
                          setSelectedHospitalAdminFeatures([]);
                        } else {
                          setSelectedHospitalAdminFeatures(
                            hospitalAdminFeatures.map((f) => f.key),
                          );
                        }
                      }}
                      className="text-xs font-medium text-[#2832AB] transition-colors hover:text-[#1f2687]"
                    >
                      {selectedHospitalAdminFeatures.length ===
                      hospitalAdminFeatures.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  )}
                </div>

                {hospitalAdminFeaturesLoading ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#2832AB]"></div>
                    <p className="mt-3 text-sm text-gray-500">
                      Loading hospital admin features...
                    </p>
                  </div>
                ) : hospitalAdminFeatures.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-[#E0E4EA] bg-white">
                    <div className="max-h-96 overflow-y-auto">
                      {hospitalAdminFeatures.map((feature, index) => (
                        <label
                          key={feature.id}
                          className={`flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-all duration-150 ${
                            index !== hospitalAdminFeatures.length - 1
                              ? "border-b border-[#F0F2F5]"
                              : ""
                          } ${
                            selectedHospitalAdminFeatures.includes(feature.key)
                              ? "bg-[#EEF2FF] hover:bg-[#E0E7FF]"
                              : "hover:bg-[#F9FAFB]"
                          }`}
                        >
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedHospitalAdminFeatures.includes(
                                feature.key,
                              )}
                              onChange={(e) => {
                                setSelectedHospitalAdminFeatures((prev) =>
                                  e.target.checked
                                    ? [...prev, feature.key]
                                    : prev.filter((k) => k !== feature.key),
                                );
                              }}
                              className="peer sr-only"
                            />
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${
                                selectedHospitalAdminFeatures.includes(
                                  feature.key,
                                )
                                  ? "border-[#2832AB] bg-[#2832AB]"
                                  : "border-[#D1D5DB] bg-white hover:border-[#2832AB]"
                              }`}
                            >
                              {selectedHospitalAdminFeatures.includes(
                                feature.key,
                              ) && (
                                <svg
                                  className="h-3.5 w-3.5 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-[#19213D]">
                              {feature.name}
                            </div>
                            {feature.description && (
                              <div className="mt-0.5 text-xs leading-relaxed text-[#666F8D]">
                                {feature.description}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="border-t border-[#E0E4EA] bg-[#F9FAFB] px-4 py-3">
                      <p className="text-xs text-[#666F8D]">
                        <span className="font-semibold text-[#2832AB]">
                          {selectedHospitalAdminFeatures.length}
                        </span>{" "}
                        of {hospitalAdminFeatures.length} hospital admin
                        features selected
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                    <div className="mb-2 text-gray-400">
                      <svg
                        className="mx-auto h-12 w-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600">
                      No hospital admin features available
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Features will appear here when available
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Action Buttons */}
            <div className="flex flex-col gap-3 pb-4 pt-6">
              <button
                type="submit"
                className="w-full rounded-lg bg-[#2832A8] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading
                  ? mode === "add"
                    ? "Adding..."
                    : "Updating..."
                  : mode === "add"
                    ? "Add Doctor"
                    : "Update Doctor"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-[#666F8D] transition-colors hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Desktop Modal */}
      <div className="hidden md:flex md:h-full md:w-full md:items-center md:justify-center md:px-4 md:py-4">
        <div
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Desktop Modal Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#19213D]">
              {mode === "add" ? "Add New Doctor" : "Edit Doctor"}
            </h2>
            <button
              onClick={handleClose}
              className="rounded-full p-1 transition-colors hover:bg-gray-100"
              disabled={isLoading}
            >
              <svg
                className="h-5 w-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Desktop Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.sur_name}
                  onChange={(e) =>
                    setFormData({ ...formData, sur_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  placeholder="Enter Title"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  placeholder="Enter first name"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                placeholder="Enter last name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                placeholder="Enter email address"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Internal Doctor ID
                {isInternalDoctorIdRequired && " *"}
              </label>
              <input
                type="text"
                required={isInternalDoctorIdRequired}
                value={formData.registration_number}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    registration_number: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                placeholder="1234"
              />
            </div>

            {/* Location - Desktop */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#19213D]">
                Location
                <span className="ml-1 text-xs font-normal text-gray-500">
                  (Optional)
                </span>
              </label>
              <select
                value={formData.location_id === "" ? "" : formData.location_id}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location_id:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: "right 0.75rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.5em 1.5em",
                }}
              >
                <option value="">Select Location</option>
                {locationsLoading ? (
                  <option disabled>Loading locations...</option>
                ) : (
                  locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name ?? loc.location_name ?? `Location ${loc.id}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {!isGlobalRegion && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Speciality
                </label>
                <select
                  value={formData.speciality}
                  onChange={(e) =>
                    setFormData({ ...formData, speciality: e.target.value })
                  }
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.75rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select Speciality</option>
                  {specialities.map((sp) => (
                    <option key={sp.name} value={sp.name}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Department and Role Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Department *
                </label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.75rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select Department</option>
                  <option value="ED">Emergency Department</option>
                  <option value="PC">Primary Care</option>
                  <option value="OPD">Outpatient Department</option>
                  <option value="REVIEW">Patient Review</option>
                  <option value="RADIOLOGY">Radiology</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Roles *{" "}
                  <span className="text-xs font-normal text-gray-500">
                    (Select one or more)
                  </span>
                </label>
                <div className="relative" ref={desktopRoleRef}>
                  <button
                    type="button"
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  >
                    <span className="text-gray-500">
                      {formData.role && formData.role.length > 0
                        ? `${formData.role.length} role${formData.role.length > 1 ? "s" : ""} selected`
                        : "Select roles"}
                    </span>
                    <svg
                      className={`h-4 w-4 text-gray-400 transition-transform ${showRoleDropdown ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {showRoleDropdown && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-300 bg-white shadow-lg">
                      <div className="p-2">
                        <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={formData.role?.includes("doctor")}
                            onChange={(e) => {
                              const newRoles = e.target.checked
                                ? [...(formData.role || []), "doctor"]
                                : formData.role?.filter(
                                    (r) => r !== "doctor",
                                  ) || [];
                              setFormData({
                                ...formData,
                                role:
                                  newRoles.length > 0 ? newRoles : ["doctor"],
                              });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[#2832AB] focus:ring-2 focus:ring-[#2832AB]"
                          />
                          <span className="text-sm text-[#19213D]">Doctor</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={formData.role?.includes("hospitalAdmin")}
                            onChange={(e) => {
                              const newRoles = e.target.checked
                                ? [...(formData.role || []), "hospitalAdmin"]
                                : formData.role?.filter(
                                    (r) => r !== "hospitalAdmin",
                                  ) || [];
                              setFormData({
                                ...formData,
                                role:
                                  newRoles.length > 0 ? newRoles : ["doctor"],
                              });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[#2832AB] focus:ring-2 focus:ring-[#2832AB]"
                          />
                          <span className="text-sm text-[#19213D]">
                            Hospital Admin
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                {/* Show selected roles - filter out superAdmin */}
                {formData.role && formData.role.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {formData.role
                      .filter((r) => r !== "superAdmin")
                      .map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            role === "hospitalAdmin"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {role === "hospitalAdmin"
                            ? "Hospital Admin"
                            : "Doctor"}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Feature Flags (For doctor role) - Desktop */}
            {formData.role.includes("doctor") && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Doctor Feature Access{" "}
                  <span className="text-xs font-normal text-gray-500">
                    (Select features for doctor portal)
                  </span>
                </label>
                {featuresLoading ? (
                  <div className="rounded-lg border border-gray-300 p-4 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-[#2832AB]"></div>
                    <p className="mt-2 text-xs text-gray-500">
                      Loading doctor features...
                    </p>
                  </div>
                ) : features.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-3">
                    <div className="space-y-1">
                      {features.map((feature) => (
                        <label
                          key={feature.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFeatures.includes(feature.key)}
                            onChange={(e) => {
                              setSelectedFeatures((prev) =>
                                e.target.checked
                                  ? [...prev, feature.key]
                                  : prev.filter((k) => k !== feature.key),
                              );
                            }}
                            className="mt-1.5 h-4 w-4 rounded border-gray-300 text-[#2832AB] focus:ring-2 focus:ring-[#2832AB]"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-[#19213D]">
                              {feature.name}
                            </span>
                            {feature.description && (
                              <p className="mt-0.5 text-xs text-gray-600">
                                {feature.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-300 p-4 text-center">
                    <p className="text-sm text-gray-600">
                      No doctor features available
                    </p>
                  </div>
                )}
                {features.length > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-600">
                      {selectedFeatures.length} of {features.length} doctor
                      features selected
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedFeatures.length === features.length) {
                          setSelectedFeatures([]);
                        } else {
                          setSelectedFeatures(features.map((f) => f.key));
                        }
                      }}
                      className="text-xs text-[#2832AB] hover:underline"
                    >
                      {selectedFeatures.length === features.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Hospital Admin Feature Flags - Desktop */}
            {formData.role.includes("hospitalAdmin") && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Hospital Admin Feature Access{" "}
                  <span className="text-xs font-normal text-gray-500">
                    (Select features for hospital admin portal)
                  </span>
                </label>
                {hospitalAdminFeaturesLoading ? (
                  <div className="rounded-lg border border-gray-300 p-4 text-center">
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-[#2832AB]"></div>
                    <p className="mt-2 text-xs text-gray-500">
                      Loading hospital admin features...
                    </p>
                  </div>
                ) : hospitalAdminFeatures.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-3">
                    <div className="space-y-1">
                      {hospitalAdminFeatures.map((feature) => (
                        <label
                          key={feature.id}
                          className="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={selectedHospitalAdminFeatures.includes(
                              feature.key,
                            )}
                            onChange={(e) => {
                              setSelectedHospitalAdminFeatures((prev) =>
                                e.target.checked
                                  ? [...prev, feature.key]
                                  : prev.filter((k) => k !== feature.key),
                              );
                            }}
                            className="mt-1.5 h-4 w-4 rounded border-gray-300 text-[#2832AB] focus:ring-2 focus:ring-[#2832AB]"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-[#19213D]">
                              {feature.name}
                            </span>
                            {feature.description && (
                              <p className="mt-0.5 text-xs text-gray-600">
                                {feature.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-300 p-4 text-center">
                    <p className="text-sm text-gray-600">
                      No hospital admin features available
                    </p>
                  </div>
                )}
                {hospitalAdminFeatures.length > 0 && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-600">
                      {selectedHospitalAdminFeatures.length} of{" "}
                      {hospitalAdminFeatures.length} hospital admin features
                      selected
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          selectedHospitalAdminFeatures.length ===
                          hospitalAdminFeatures.length
                        ) {
                          setSelectedHospitalAdminFeatures([]);
                        } else {
                          setSelectedHospitalAdminFeatures(
                            hospitalAdminFeatures.map((f) => f.key),
                          );
                        }
                      }}
                      className="text-xs text-[#2832AB] hover:underline"
                    >
                      {selectedHospitalAdminFeatures.length ===
                      hospitalAdminFeatures.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Desktop Action Buttons */}
            <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-[#666F8D] transition-colors hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-[#2832A8] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading
                  ? mode === "add"
                    ? "Adding..."
                    : "Updating..."
                  : mode === "add"
                    ? "Add Doctor"
                    : "Update Doctor"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Mobile Doctor Card Component for responsive design
const DoctorCard: React.FC<{
  doctor: Doctor;
  onEdit: (doctor: Doctor) => void;
  onToggleStatus: (doctor: Doctor) => void;
  onSendPasswordRecovery: (doctor: Doctor) => void;
  passwordResetLoading: Record<string, boolean>;
  canManageDoctors: boolean;
  // onRemove: (doctor: Doctor) => void;
}> = ({
  doctor,
  onEdit,
  onToggleStatus,
  onSendPasswordRecovery,
  passwordResetLoading,
  canManageDoctors,
}) => {
  const router = useRouter();
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      onClick={() => router.push(`/hospital-admin/doctors/${doctor.id}`)}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header with name and status */}
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium text-[#19213D]">
            {doctor.sur_name} {doctor.first_name} {doctor.last_name}
          </h3>
          <p className="mt-1 truncate text-sm text-[#666F8D]">{doctor.email}</p>
        </div>
        <div className="ml-2 flex items-center gap-2">
          <span
            className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${
              doctor.status === "Active"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {doctor.status}
          </span>
          {canManageDoctors && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="rounded-full p-1 transition-colors hover:bg-gray-100"
            >
              <svg
                className="h-4 w-4 text-gray-500"
                fill="currentColor"
                viewBox="0 0 24 20"
              >
                <path d="M4 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM20 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Department and Role */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-[#666F8D]">Department</p>
          <p className="text-sm font-medium text-[#19213D]">
            {DEPARTMENT_MAPPING[doctor.department] || doctor.department}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-[#666F8D]">Roles</p>
          <div className="flex flex-wrap gap-1">
            {doctor.role
              ?.filter((role) => role !== "superAdmin")
              .map((role) => (
                <span
                  key={role}
                  className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                    role === "hospitalAdmin"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {role === "hospitalAdmin" ? "Hospital Admin" : "Doctor"}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="mb-3">
        <p className="mb-1 text-xs text-[#666F8D]">Location</p>
        <p className="truncate text-sm text-[#19213D]">
          {doctor.location && (doctor.location.name || doctor.location.address)
            ? [doctor.location.name, doctor.location.address].filter(Boolean).join(", ")
            : "—"}
        </p>
      </div>

      {/* Sessions and Join Date */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-[#666F8D]">Encounters</p>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            {doctor.session_count || 0}
          </span>
        </div>
        <div>
          <p className="mb-1 text-xs text-[#666F8D]">Joined</p>
          <p className="text-sm text-[#19213D]">
            {new Date(doctor.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Action Buttons (Mobile) - Only show if canManageDoctors */}
      {canManageDoctors && showActions && (
        <div
          className="mt-3 border-t border-gray-100 pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(doctor);
                setShowActions(false);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-blue-600 transition-colors hover:bg-blue-50"
            >
              Edit Doctor
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(doctor);
                setShowActions(false);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              {doctor.is_active ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSendPasswordRecovery(doctor);
                setShowActions(false);
              }}
              disabled={passwordResetLoading[doctor.id]}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-black transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {passwordResetLoading[doctor.id]
                ? "Sending..."
                : "Reset Password"}
            </button>
            {/* <button
              onClick={() => {
                onRemove(doctor);
                setShowActions(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Remove Doctor
            </button> */}
          </div>
        </div>
      )}
    </div>
  );
};

// Add Location Modal Component

export default function DoctorManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    capabilities,
    loading: capabilitiesLoading,
    canAccess,
  } = useHospitalAdminAccess();
  const { getHospitalLocations, hospitalLocations, hospitalLocationsLoading } =
    useSession();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [totalEncounters, setTotalEncounters] = useState(0);
  const [hospitalStats, setHospitalStats] = useState<HospitalStats | null>(
    null,
  );
  const [hospitalStatsLoading, setHospitalStatsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<
    "All" | "doctor" | "hospitalAdmin" | "superAdmin"
  >("All");
  const [filterStatus, setFilterStatus] = useState<
    "All" | "Active" | "Inactive"
  >("All");
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [doctorToEdit, setDoctorToEdit] = useState<Doctor | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [passwordResetLoading, setPasswordResetLoading] = useState<
    Record<string, boolean>
  >({});
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // New filters for Usage by Date and Usage by Doctors
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minUsageCount, setMinUsageCount] = useState<string>("");
  const [maxUsageCount, setMaxUsageCount] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState<string>("");

  // Toggle dropdown visibility
  const toggleDropdown = (doctorId: string) => {
    setOpenDropdownId(openDropdownId === doctorId ? null : doctorId);
  };

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (openDropdownId) {
      const timer = setTimeout(() => {
        const button = document.querySelector(
          `[data-doctor-id="${openDropdownId}"]`,
        ) as HTMLElement;
        if (button) {
          const rect = button.getBoundingClientRect();
          const dropdownHeight = 140; // Approximate height of dropdown
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceAbove = rect.top;

          let top;
          if (spaceBelow >= dropdownHeight) {
            top = rect.bottom + 4; // Position below with margin
          } else if (spaceAbove >= dropdownHeight) {
            top = rect.top - dropdownHeight - 4; // Position above with margin
          } else {
            top = rect.bottom + 4; // Default to below
          }

          const left = rect.right - 208; // 208px = 52 * 4 (w-52 in pixels)

          setDropdownPosition({ top, left });
        }
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [openDropdownId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openDropdownId &&
        !(event.target as Element).closest(".dropdown-container") &&
        !(event.target as Element).closest(".dropdown-menu")
      ) {
        setOpenDropdownId(null);
      }
    };

    const handleResize = () => {
      if (openDropdownId) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [openDropdownId]);

  // Fetch doctors when component mounts or when hospital_id or date filters change
  useEffect(() => {
    if (user?.hospital_id) {
      fetchDoctors();
    }
  }, [user?.hospital_id, startDate, endDate]);

  // Fetch hospital locations when we have hospital_id (for Add/Edit Doctor modal)
  useEffect(() => {
    if (user?.hospital_id) {
      getHospitalLocations(user.hospital_id);
    }
  }, [user?.hospital_id]);

  // Fetch hospital stats when we have hospital_id
  useEffect(() => {
    const fetchHospitalStats = async () => {
      if (!user?.hospital_id) return;

      setHospitalStatsLoading(true);
      try {
        const stats = await dashboardService.getHospital(user.hospital_id);
        setHospitalStats(stats);
      } catch (error: any) {
        console.error("Error fetching hospital stats:", error);
        // Don't show toast for stats error, just log it
        setHospitalStats(null);
      } finally {
        setHospitalStatsLoading(false);
      }
    };

    fetchHospitalStats();
  }, [user?.hospital_id]);

  // Auto-switch view mode based on screen size (1024px breakpoint)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setViewMode("cards");
      } else {
        setViewMode("table");
      }
    };

    handleResize(); // Set initial view mode
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchDoctors = async () => {
    if (!user?.hospital_id) return;

    setIsLoading(true);
    try {
      // First, fetch all doctors
      const doctorSelect = `
          id,
          user_id,
          first_name,
          sur_name,
          last_name,
          email,
          department,
          ${isGlobalRegion ? "" : "speciality,"}
          registration_number,
          is_active,
          created_at,
          role,
          location_id,
          location:location_id (
            name,
            address
          )
        `;
      const { data: doctors, error: doctorsError } = await supabase
        .from("doctor")
        .select(doctorSelect)
        .eq("hospital_id", user.hospital_id)
        .order("created_at", { ascending: false })
        .returns<Array<{
          id: string;
          user_id: string;
          first_name: string;
          sur_name: string | null;
          last_name: string;
          email: string;
          department: string;
          speciality?: string | null;
          registration_number: string | null;
          is_active: boolean;
          created_at: string;
          role: string | string[] | null;
          location_id: number | null;
          location?:
            | { name?: string; address?: string }
            | { name?: string; address?: string }[]
            | null;
        }>>();

      if (doctorsError) {
        throw new Error(doctorsError.message || "Failed to fetch doctors");
      }

      // Get all doctor IDs for this hospital
      const doctorIds = (doctors || []).map((doctor) => doctor.id);

      // If there are no doctors, we can safely short-circuit without querying sessions
      if (doctorIds.length === 0) {
        setDoctors([]);
        setTotalEncounters(0);
        return;
      }

      // Only count encounters with status "Completed" or "deleted" so the
      // list table matches the detail page stats card.
      //
      // Supabase / PostgREST caps each response at ~1000 rows by default.
      // Across ~88 doctors the total can exceed that cap, silently truncating
      // results and under-counting per-doctor sessions (e.g. doctor 425 was
      // showing 7 instead of 160 in the DB). Paginate explicitly with
      // .range() to fetch every matching row.
      const buildSessionQuery = (rangeStart: number, rangeEnd: number) => {
        let q = supabase
          .from("session")
          .select("doctor_id, created_at, status")
          .in("doctor_id", doctorIds)
          .in("status", ["Completed", "deleted"])
          .range(rangeStart, rangeEnd);

        if (startDate) {
          q = q.gte("created_at", new Date(startDate).toISOString());
        }
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setDate(endDateTime.getDate() + 1);
          q = q.lt("created_at", endDateTime.toISOString());
        }
        return q;
      };

      const SESSION_PAGE_SIZE = 1000;
      const sessions: Array<{
        doctor_id: number | null;
        created_at: string;
        status: string;
      }> = [];
      let pageStart = 0;
      while (true) {
        const { data: page, error: pageError } = await buildSessionQuery(
          pageStart,
          pageStart + SESSION_PAGE_SIZE - 1,
        );
        if (pageError) {
          throw new Error(pageError.message || "Failed to fetch sessions");
        }
        if (!page || page.length === 0) break;
        sessions.push(...page);
        if (page.length < SESSION_PAGE_SIZE) break;
        pageStart += SESSION_PAGE_SIZE;
      }

      // ---- DIAGNOSTIC: breakdown of returned sessions for doctor 425 ----
      const TARGET_DOCTOR_ID = 425;
      const targetSessions = (sessions || []).filter(
        (s) => Number(s.doctor_id) === TARGET_DOCTOR_ID,
      );
      const completedCount = targetSessions.filter(
        (s) => (s.status || "").toLowerCase() === "completed",
      ).length;
      const deletedCount = targetSessions.filter(
        (s) => (s.status || "").toLowerCase() === "deleted",
      ).length;
      const otherCount =
        targetSessions.length - completedCount - deletedCount;
      const otherStatusBreakdown = targetSessions
        .filter((s) => {
          const st = (s.status || "").toLowerCase();
          return st !== "completed" && st !== "deleted";
        })
        .reduce<Record<string, number>>((acc, s) => {
          const key = String(s.status ?? "<null>");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      console.log("[doctors/page] list query results for doctor 425:", {
        totalReturnedForDoctor425: targetSessions.length,
        completedCount,
        deletedCount,
        otherCount,
        otherStatusBreakdown,
        totalSessionsReturnedOverall: (sessions || []).length,
        startDate,
        endDate,
      });
      // ---- end DIAGNOSTIC ----

      // Count sessions per doctor
      const sessionCounts: { [key: string]: number } = {};
      (sessions || []).forEach((session) => {
        if (session.doctor_id == null) return;
        const key = String(session.doctor_id);
        sessionCounts[key] = (sessionCounts[key] || 0) + 1;
      });

      // Transform data to match our interface and add session counts
      const transformedDoctors = (doctors || []).map((doctor) => {
        const rawLocation = (doctor as { location?: { name?: string; address?: string } | { name?: string; address?: string }[] }).location;
        const location =
          rawLocation == null
            ? null
            : Array.isArray(rawLocation)
              ? rawLocation[0] ?? null
              : rawLocation;
        return {
          ...doctor,
          // Ensure role is always an array
          role: Array.isArray(doctor.role)
            ? doctor.role
            : doctor.role
              ? [doctor.role]
              : ["doctor"],
          status: (doctor.is_active ? "Active" : "Inactive") as
            | "Active"
            | "Inactive",
          session_count: sessionCounts[String(doctor.id)] || 0,
          location,
        };
      });

      setDoctors(transformedDoctors as Doctor[]);
      // Total encounters is the sum of all sessions for doctors in this hospital
      setTotalEncounters((sessions || []).length);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch doctors", {
        duration: 3000,
        position: "bottom-right",
      });
      console.error("Error fetching doctors:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // const handleRemoveDoctor = async (doctor: Doctor) => {
  //   if (!confirm(`Are you sure you want to remove ${doctor.first_name} ${doctor.last_name}? This action cannot be undone.`)) {
  //     return;
  //   }

  //   try {
  //     // Delete doctor record from Supabase
  //     const { error: doctorError } = await supabase
  //       .from('doctor')
  //       .delete()
  //       .eq('id', doctor.id);

  //     if (doctorError) {
  //       throw new Error(doctorError.message || "Failed to delete doctor record");
  //     }

  //     toast.success("Doctor removed successfully", {
  //       duration: 3000,
  //       position: "bottom-right",
  //     });
  //     fetchDoctors(); // Refresh the list
  //   } catch (error: any) {
  //     toast.error(error.message || "Failed to remove doctor", {
  //       duration: 3000,
  //       position: "bottom-right",
  //     });
  //   }
  // };

  const handleEditDoctor = (doctor: Doctor) => {
    setDoctorToEdit(doctor);
    setModalMode("edit");
    setShowDoctorModal(true);
  };

  const handleToggleStatus = async (doctor: Doctor) => {
    try {
      // Use the deactivate_doctor function to update both doctor and auth.users tables
      const { error } = await supabase.rpc("deactivate_doctor", {
        p_doctor_id: doctor.id,
        p_is_active: !doctor.is_active,
      });

      if (error) {
        throw new Error(error.message || "Failed to update doctor status");
      }

      toast.success(
        `Doctor ${!doctor.is_active ? "activated" : "deactivated"} successfully`,
        {
          duration: 3000,
          position: "bottom-right",
        },
      );
      fetchDoctors(); // Refresh the list
    } catch (error: any) {
      toast.error(error.message || "Failed to update doctor status", {
        duration: 3000,
        position: "bottom-right",
      });
    }
  };

  const handleSendPasswordRecovery = async (doctor: Doctor) => {
    // Set loading state for this specific doctor
    setPasswordResetLoading((prev) => ({ ...prev, [doctor.id]: true }));

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: doctor.email,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send password recovery");
      }

      toast.success(`Password reset sent to ${doctor.email}`, {
        duration: 3000,
        position: "bottom-right",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to send password recovery", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      // Clear loading state for this doctor
      setPasswordResetLoading((prev) => {
        const newState = { ...prev };
        delete newState[doctor.id];
        return newState;
      });
    }
  };

  // Filter doctors based on search and filters
  const filteredDoctors = doctors.filter((doctor) => {
    const searchTerm = searchQuery.toLowerCase().trim();

    const first = doctor.first_name ?? "";
    const last = doctor.last_name ?? "";
    const sur = doctor.sur_name ?? "";

    // Create multiple name variations for flexible searching
    const nameVariations = [
      `${sur} ${first} ${last}`.toLowerCase().trim(),
      `${first} ${sur} ${last}`.toLowerCase().trim(),
      `${first} ${last}`.toLowerCase().trim(),
      `${last} ${first}`.toLowerCase().trim(),
      first.toLowerCase(),
      last.toLowerCase(),
      sur.toLowerCase(),
    ].filter((name) => name.length > 0); // Remove empty strings

    const departmentName = (
      DEPARTMENT_MAPPING[doctor.department] || doctor.department || ""
    ).toLowerCase();

    const emailLower = (doctor.email ?? "").toLowerCase();

    const matchesSearch =
      searchTerm === "" ||
      nameVariations.some((name) => name.includes(searchTerm)) ||
      emailLower.includes(searchTerm) ||
      departmentName.includes(searchTerm);

    const matchesRole =
      filterRole === "All" || doctor.role?.includes(filterRole);
    const matchesStatus =
      filterStatus === "All" || doctor.status === filterStatus;

    // Apply usage count filters (Usage by Doctors filter)
    const sessionCount = doctor.session_count || 0;
    const matchesMinUsage =
      minUsageCount === "" || sessionCount >= parseInt(minUsageCount);
    const matchesMaxUsage =
      maxUsageCount === "" || sessionCount <= parseInt(maxUsageCount);

    // Apply location/address filter (search by location name or address)
    const loc = doctor.location;
    const locationDisplay =
      loc && (loc.name || loc.address)
        ? [loc.name, loc.address].filter(Boolean).join(" ").toLowerCase()
        : "";
    const locationSearchTerm = locationFilter.toLowerCase().trim();
    const matchesLocation =
      locationSearchTerm === "" ||
      (locationDisplay.length > 0 &&
        locationDisplay.includes(locationSearchTerm));

    return (
      matchesSearch &&
      matchesRole &&
      matchesStatus &&
      matchesMinUsage &&
      matchesMaxUsage &&
      matchesLocation
    );
  });

  // Helper to get location display string for a doctor
  const getDoctorLocationDisplay = (doctor: Doctor) => {
    const loc = doctor.location;
    if (!loc || (!loc.name && !loc.address)) return "—";
    return [loc.name, loc.address].filter(Boolean).join(", ") || "—";
  };

  // Export doctors data to CSV
  const exportDoctorsCSV = () => {
    const csvContent = [
      [
        "Name",
        "Department",
        "Role",
        "Status",
        "Location",
        "Encounters",
        "Joined Date",
      ],
      ...filteredDoctors.map((doctor) => [
        `"${[doctor.sur_name, doctor.first_name, doctor.last_name].filter(Boolean).join(" ")}"`,
        `"${DEPARTMENT_MAPPING[doctor.department] || doctor.department}"`,
        `"${doctor.role?.join(", ") || ""}"`,
        doctor.status,
        `"${getDoctorLocationDisplay(doctor).replace(/"/g, '""')}"`,
        doctor.session_count || 0,
        new Date(doctor.created_at).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doctors-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate stats
  const activeDoctors = doctors.filter((d) => d.status === "Active").length;
  const inactiveDoctors = doctors.filter((d) => d.status === "Inactive").length;
  const administrators = doctors.filter((d) =>
    d.role?.includes("hospitalAdmin"),
  ).length;
  const totalDoctors = doctors.length;

  return (
    <div className="flex h-full flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-none border-0 border-[#F0F2F5] bg-white shadow-none md:rounded-xl md:border md:shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
            <div className="flex items-center gap-2">
              {/* Back button - only show on mobile */}
              <div
                onClick={() => router.push("/hospital-admin")}
                className="cursor-pointer rounded-lg p-1 transition-colors hover:bg-gray-100 md:hidden"
              >
                <svg
                  className="h-5 w-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#19213D] md:text-2xl">
                  Doctor Management
                </h1>
                <p className="mt-1 text-sm text-[#666F8D]">
                  Manage doctors and administrators in your hospital
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportDoctorsCSV}
                className="flex items-center gap-2 rounded-lg border border-[#2832A8] px-3 py-2 text-sm font-medium text-[#2832A8] transition-colors hover:bg-[#2832A8]/10 md:px-4"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="hidden sm:inline">Download CSV</span>
                <span className="sm:hidden">CSV</span>
              </button>
              <button
                onClick={() => setShowLocationModal(true)}
                className="flex items-center gap-2 rounded-lg border border-[#2832A8] px-3 py-2 text-sm font-medium text-[#2832A8] transition-colors hover:bg-[#2832A8]/10 md:px-4"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="hidden sm:inline">Add Location</span>
                <span className="sm:hidden">Location</span>
              </button>
              {capabilities.canManageDoctors && (
                <button
                  onClick={() => {
                    setDoctorToEdit(null);
                    setModalMode("add");
                    setShowDoctorModal(true);
                  }}
                  className="rounded-lg bg-[#2832A8] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] md:px-4"
                >
                  <span className="hidden sm:inline">+ Add New Doctor</span>
                  <span className="sm:hidden">+ Add Doctor</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
            <div className="rounded-lg border border-gray-200 p-3 md:p-4">
              <p className="text-xs text-[#666F8D]">Total Doctors</p>
              <p className="text-lg font-semibold text-[#19213D] md:text-xl">
                {hospitalStatsLoading ? (
                  <span className="text-xs">Loading...</span>
                ) : (
                  (hospitalStats?.total_doctor_count ?? totalDoctors)
                )}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 md:p-4">
              <p className="text-xs text-[#666F8D]">Active</p>
              <p className="text-lg font-semibold text-[#19213D] md:text-xl">
                {hospitalStatsLoading ? (
                  <span className="text-xs">Loading...</span>
                ) : (
                  (hospitalStats?.active_doctor_count ?? activeDoctors)
                )}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 md:p-4">
              <p className="text-xs text-[#666F8D]">Inactive</p>
              <p className="text-lg font-semibold text-[#19213D] md:text-xl">
                {hospitalStatsLoading ? (
                  <span className="text-xs">Loading...</span>
                ) : (
                  (hospitalStats?.inactive_doctor_count ?? inactiveDoctors)
                )}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 md:p-4">
              <p className="text-xs text-[#666F8D]">Total Encounters</p>
              <p className="text-lg font-semibold text-[#19213D] md:text-xl">
                {hospitalStatsLoading ? (
                  <span className="text-xs">Loading...</span>
                ) : (
                  (hospitalStats?.total_sessions ?? totalEncounters)
                )}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 md:p-4">
              <p className="text-xs text-[#666F8D]">Administrators</p>
              <p className="text-lg font-semibold text-[#19213D] md:text-xl">
                {hospitalStatsLoading ? (
                  <span className="text-xs">Loading...</span>
                ) : (
                  (hospitalStats?.total_administrator_count ?? administrators)
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Filters - Only show if user can view doctors */}
        {capabilities.canViewDoctors && (
          <div className="border-b border-[#E3E6EA] p-4">
            <div className="flex flex-col gap-3 md:gap-4">
              {/* First Row: Search and Primary Filters - search keeps min width, filters don't squeeze it */}
              <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:gap-4">
                {/* Search - full width mobile; on md+ min width preserved, max width so location has room */}
                <div className="order-1 w-full min-w-0 md:min-w-[220px] md:max-w-[380px] md:flex-1 lg:min-w-[260px] lg:max-w-[420px]">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      <svg
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search doctors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#2832A8]"
                    />
                  </div>
                </div>

                {/* Filters Row - wraps on mobile; on md+ has min width so search isn't squeezed */}
                <div className="order-2 flex w-full flex-shrink-0 flex-wrap gap-2 md:min-w-[280px] md:flex-1 md:max-w-[520px] md:gap-3 lg:max-w-[580px]">
                  {/* Role Filter */}
                  <div className="min-w-0 flex-1 basis-[calc(50%-4px)] sm:basis-auto md:flex-none">
                    <select
                      value={filterRole}
                      onChange={(e) =>
                        setFilterRole(
                          e.target.value as
                            | "All"
                            | "doctor"
                            | "hospitalAdmin"
                            | "superAdmin",
                        )
                      }
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832A8]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: "right 0.75rem center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "1.5em 1.5em",
                      }}
                    >
                      <option value="All">All Roles</option>
                      <option value="doctor">Doctor</option>
                      <option value="hospitalAdmin">Hospital Admin</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="min-w-0 flex-1 basis-[calc(50%-4px)] sm:basis-auto md:flex-none">
                    <select
                      value={filterStatus}
                      onChange={(e) =>
                        setFilterStatus(
                          e.target.value as "All" | "Active" | "Inactive",
                        )
                      }
                      className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832A8]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: "right 0.75rem center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "1.5em 1.5em",
                      }}
                    >
                      <option value="All">All Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Location / Address Filter - full width on mobile; bounded on desktop so search has room */}
                  <div className="relative w-full min-w-0 md:min-w-[160px] md:max-w-[220px] md:flex-1 lg:min-w-[180px] lg:max-w-[260px]">
                    <input
                      type="text"
                      placeholder="Search by location or address"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832A8] sm:pr-9"
                    />
                    {locationFilter && (
                      <button
                        type="button"
                        onClick={() => setLocationFilter("")}
                        className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200 sm:right-2 sm:min-h-0 sm:min-w-0 sm:p-1"
                        aria-label="Clear location filter"
                      >
                        <svg className="h-4 w-4 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Second Row: Usage by Date and Usage by Doctors */}
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
                {/* Usage by Date Filter */}
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-medium text-[#666F8D]">
                    Usage by Date Range
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832A8]"
                      placeholder="Start Date"
                    />
                    <span className="flex items-center text-sm text-gray-400">
                      to
                    </span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832A8]"
                      placeholder="End Date"
                    />
                  </div>
                </div>

                {/* Usage by Doctors Filter */}
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-medium text-[#666F8D]">
                    Usage by Doctors (Encounter Count)
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      min="0"
                      value={minUsageCount}
                      onChange={(e) => setMinUsageCount(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832A8]"
                      placeholder="Min"
                    />
                    <span className="flex items-center text-sm text-gray-400">
                      to
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={maxUsageCount}
                      onChange={(e) => setMaxUsageCount(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832A8]"
                      placeholder="Max"
                    />
                  </div>
                </div>

                {/* Clear Filters Button */}
                {(startDate ||
                  endDate ||
                  minUsageCount ||
                  maxUsageCount ||
                  searchQuery ||
                  filterRole !== "All" ||
                  filterStatus !== "All" ||
                  locationFilter) && (
                  <button
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setMinUsageCount("");
                      setMaxUsageCount("");
                      setSearchQuery("");
                      setFilterRole("All");
                      setFilterStatus("All");
                      setLocationFilter("");
                    }}
                    className="w-full min-h-[44px] whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-[#666F8D] transition-colors hover:bg-gray-50 active:bg-gray-100 lg:w-auto lg:min-h-0"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Doctor List - Only show if user can view doctors */}
        {capabilities.canViewDoctors && (
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[#2832AB]"></div>
                    <p className="mt-3 text-sm text-[#666F8D]">
                      Loading doctors...
                    </p>
                  </div>
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <svg
                      className="mx-auto mb-4 h-12 w-12 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <p className="text-sm text-[#666F8D]">
                      {searchQuery ||
                      filterRole !== "All" ||
                      filterStatus !== "All" ||
                      startDate ||
                      endDate ||
                      minUsageCount ||
                      maxUsageCount ||
                      locationFilter
                        ? "No doctors found matching your criteria"
                        : "No doctors found. Add your first doctor to get started."}
                    </p>
                    {(searchQuery ||
                      filterRole !== "All" ||
                      filterStatus !== "All" ||
                      startDate ||
                      endDate ||
                      minUsageCount ||
                      maxUsageCount ||
                      locationFilter) && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setFilterRole("All");
                          setFilterStatus("All");
                          setStartDate("");
                          setEndDate("");
                          setMinUsageCount("");
                          setMaxUsageCount("");
                          setLocationFilter("");
                        }}
                        className="mt-3 text-sm text-[#2832AB] hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Results count */}
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-[#666F8D]">
                      Showing {filteredDoctors.length} of {totalDoctors} doctors
                    </p>

                    {/* View toggle for 1024px+ screens only */}
                    <div className="hidden rounded-lg border border-gray-200 p-1 lg:flex">
                      <button
                        onClick={() => setViewMode("table")}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === "table"
                            ? "bg-[#2832A8] text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h18M3 6h18m-9 8h9"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setViewMode("cards")}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === "cards"
                            ? "bg-[#2832A8] text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Doctor Table (1024px+ only) */}
                  {viewMode === "table" && (
                    <div className="hidden overflow-hidden rounded-lg border border-gray-200 lg:block">
                      <div className="h-full">
                        <table className="h-auto w-full min-w-[800px]">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                                Name
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                                Department
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                                Location
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                                Role
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                                Status
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                                Encounters
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                                Joined
                              </th>
                              {capabilities.canManageDoctors && (
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                                  Actions
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredDoctors.map((doctor) => (
                              <tr
                                key={doctor.id}
                                onClick={() =>
                                  router.push(
                                    `/hospital-admin/doctors/${doctor.id}`,
                                  )
                                }
                                className="cursor-pointer transition-colors hover:bg-gray-50"
                              >
                                <td className="px-4 py-4">
                                  <div>
                                    <p className="text-sm font-medium text-[#19213D]">
                                      {doctor.sur_name} {doctor.first_name}{" "}
                                      {doctor.last_name}
                                    </p>
                                    <p className="text-xs text-[#666F8D]">
                                      {doctor.email}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="text-sm text-[#19213D]">
                                    {DEPARTMENT_MAPPING[doctor.department] ||
                                      doctor.department}
                                  </p>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="max-w-[180px] truncate text-sm text-[#19213D]" title={getDoctorLocationDisplay(doctor)}>
                                    {getDoctorLocationDisplay(doctor)}
                                  </p>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {doctor.role
                                      ?.filter((role) => role !== "superAdmin")
                                      .map((role) => (
                                        <span
                                          key={role}
                                          className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                                            role === "hospitalAdmin"
                                              ? "bg-purple-100 text-purple-800"
                                              : "bg-blue-100 text-blue-800"
                                          }`}
                                        >
                                          {role === "hospitalAdmin"
                                            ? "Hospital Admin"
                                            : "Doctor"}
                                        </span>
                                      ))}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                                      doctor.status === "Active"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {doctor.status}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                    {doctor.session_count || 0}
                                  </span>
                                </td>
                                <td className="px-4 py-4">
                                  <p className="text-xs text-[#666F8D]">
                                    {new Date(
                                      doctor.created_at,
                                    ).toLocaleDateString()}
                                  </p>
                                </td>
                                {capabilities.canManageDoctors && (
                                  <td className="px-4 py-4">
                                    <div className="dropdown-container relative inline-block">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleDropdown(doctor.id);
                                        }}
                                        data-doctor-id={doctor.id}
                                        className="flex items-center justify-center rounded-full p-2 transition-colors hover:bg-gray-100"
                                      >
                                        <svg
                                          className="h-4 w-4 text-gray-500"
                                          fill="currentColor"
                                          viewBox="0 0 24 20"
                                        >
                                          <path d="M4 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM20 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                      </button>

                                      {/* Dropdown Menu */}
                                      {openDropdownId === doctor.id && (
                                        <div
                                          className="dropdown-menu fixed z-[9999] w-52 rounded-lg border border-gray-200 bg-white shadow-lg"
                                          style={{
                                            top: `${dropdownPosition.top}px`,
                                            left: `${dropdownPosition.left}px`,
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <div className="py-1">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditDoctor(doctor);
                                                setOpenDropdownId(null);
                                              }}
                                              className="w-full px-3 py-2 text-left text-sm text-blue-600 transition-colors hover:bg-blue-50"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleStatus(doctor);
                                                setOpenDropdownId(null);
                                              }}
                                              className="w-full px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
                                            >
                                              {doctor.is_active
                                                ? "Deactivate"
                                                : "Activate"}
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSendPasswordRecovery(
                                                  doctor,
                                                );
                                                setOpenDropdownId(null);
                                              }}
                                              disabled={
                                                passwordResetLoading[doctor.id]
                                              }
                                              className="w-full px-3 py-2 text-left text-sm text-black transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                              {passwordResetLoading[doctor.id]
                                                ? "Sending..."
                                                : "Reset Password"}
                                            </button>
                                            {/* <button
                                              onClick={() => handleRemoveDoctor(doctor)}
                                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                              Remove
                                            </button> */}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Doctor Cards (For screens less than 1024px or when cards view is selected) */}
                  {(viewMode === "cards" || window.innerWidth < 1024) && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
                      {filteredDoctors.map((doctor) => (
                        <DoctorCard
                          key={doctor.id}
                          doctor={doctor}
                          onEdit={handleEditDoctor}
                          onToggleStatus={handleToggleStatus}
                          onSendPasswordRecovery={handleSendPasswordRecovery}
                          passwordResetLoading={passwordResetLoading}
                          canManageDoctors={capabilities.canManageDoctors}
                          // onRemove={handleRemoveDoctor}
                        />
                      ))}
                    </div>
                  )}

                  {/* Cards view for 1024px+ when cards mode is selected */}
                  {viewMode === "cards" && (
                    <div className="hidden gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-3">
                      {filteredDoctors.map((doctor) => (
                        <DoctorCard
                          key={doctor.id}
                          doctor={doctor}
                          onEdit={handleEditDoctor}
                          onToggleStatus={handleToggleStatus}
                          onSendPasswordRecovery={handleSendPasswordRecovery}
                          passwordResetLoading={passwordResetLoading}
                          canManageDoctors={capabilities.canManageDoctors}
                          // onRemove={handleRemoveDoctor}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Doctor Modal */}
      <DoctorModal
        isOpen={showDoctorModal}
        onClose={() => {
          setShowDoctorModal(false);
          setDoctorToEdit(null);
          setModalMode("add"); // Reset to add mode when closing
        }}
        hospitalId={user?.hospital_id || 0}
        onDoctorAdded={() => {
          fetchDoctors();
          setShowDoctorModal(false);
          setDoctorToEdit(null);
          setModalMode("add"); // Reset to add mode after adding/editing
        }}
        doctorToEdit={doctorToEdit}
        mode={modalMode}
        locations={
          Array.isArray(hospitalLocations)
            ? hospitalLocations
            : ((hospitalLocations as { locations?: HospitalLocation[] } | null)
                ?.locations ?? [])
        }
        locationsLoading={hospitalLocationsLoading}
      />

      {/* Add Location Modal */}
      <AddLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        hospitalId={user?.hospital_id || 0}
        onLocationAdded={() => {
          // Refresh hospital locations after adding
          if (user?.hospital_id) {
            getHospitalLocations(user.hospital_id);
          }
        }}
      />
    </div>
  );
}
