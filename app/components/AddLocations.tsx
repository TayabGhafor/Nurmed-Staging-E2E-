import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { dashboardService } from "../kyClient/dashboard";

interface LocationFormData {
  name: string;
  address: string;
  is_active: boolean;
}

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospitalId: number;
  onLocationAdded: () => void;
}

const AddLocationModal: React.FC<AddLocationModalProps> = ({
  isOpen,
  onClose,
  hospitalId,
  onLocationAdded,
}) => {
  const [locations, setLocations] = useState<LocationFormData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<
    Record<number, { name?: string; address?: string }>
  >({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocations([]);
      setErrors({});
    }
  }, [isOpen]);

  const appendLocation = () => {
    setLocations([...locations, { name: "", address: "", is_active: true }]);
  };

  const updateLocation = (
    index: number,
    field: keyof LocationFormData,
    value: string | boolean,
  ) => {
    const updatedLocations = [...locations];
    updatedLocations[index] = { ...updatedLocations[index], [field]: value };
    setLocations(updatedLocations);

    // Clear error when user starts typing
    if (errors[index]) {
      const updatedErrors = { ...errors };
      delete updatedErrors[index][field as "name" | "address"];
      setErrors(updatedErrors);
    }
  };

  const validateLocations = (): boolean => {
    const newErrors: Record<number, { name?: string; address?: string }> = {};
    let isValid = true;

    locations.forEach((location, index) => {
      if (!location.name.trim()) {
        newErrors[index] = {
          ...newErrors[index],
          name: "Campus name is required",
        };
        isValid = false;
      }
      if (!location.address.trim()) {
        newErrors[index] = {
          ...newErrors[index],
          address: "Address is required",
        };
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (locations.length === 0) {
      toast.error("Please add at least one location", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    if (!validateLocations()) {
      return;
    }

    setIsLoading(true);
    try {
      // Create all locations sequentially
      for (const location of locations) {
        await dashboardService.createLocation({
          hospital_id: hospitalId,
          name: location.name,
          address: location.address,
          is_active: location.is_active,
        });
      }

      toast.success(
        locations.length === 1
          ? "Location added successfully"
          : `${locations.length} locations added successfully`,
        {
          duration: 3000,
          position: "bottom-right",
        },
      );
      onLocationAdded();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to add location(s)", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#19213D]">Add Location</h2>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
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

        <div className="space-y-4 pt-1">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-gray-500"
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
                <span className="text-sm font-semibold">Locations</span>
              </div>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium transition-colors hover:bg-gray-50"
                onClick={appendLocation}
              >
                <svg
                  className="h-3.5 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add location
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Add branches or campuses for this hospital.
            </p>
          </div>

          {locations.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center"
              role="presentation"
            >
              <svg
                className="mb-2 h-9 w-9 text-gray-400"
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
              <p className="text-sm font-medium text-gray-500">
                No locations added
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Add a campus or branch if needed.
              </p>
              <button
                type="button"
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-200"
                onClick={appendLocation}
              >
                <svg
                  className="h-3.5 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add location
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {locations.map((location, idx) => (
                <div
                  key={idx}
                  className="space-y-4 rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      Location {idx + 1}
                    </span>
                  </div>
                  <div className="grid gap-4">
                    <div className="min-w-0">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Campus name
                      </label>
                      <input
                        type="text"
                        value={location.name}
                        onChange={(e) =>
                          updateLocation(idx, "name", e.target.value)
                        }
                        placeholder="e.g. Main Campus"
                        className={`h-9 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] ${
                          errors[idx]?.name
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {errors[idx]?.name && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors[idx].name}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Address
                      </label>
                      <input
                        type="text"
                        value={location.address}
                        onChange={(e) =>
                          updateLocation(idx, "address", e.target.value)
                        }
                        placeholder="Branch address"
                        className={`h-9 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2832A8] ${
                          errors[idx]?.address
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {errors[idx]?.address && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors[idx].address}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-row items-start space-x-3 rounded-md border p-3">
                      <input
                        type="checkbox"
                        checked={location.is_active}
                        onChange={(e) =>
                          updateLocation(idx, "is_active", e.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2832A8] focus:ring-[#2832A8]"
                      />
                      <div className="space-y-0.5 leading-none">
                        <label className="cursor-pointer text-sm font-normal">
                          Location is active
                        </label>
                        <p className="text-xs text-gray-500">
                          Inactive locations are hidden from selection.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 text-sm font-medium transition-colors hover:bg-gray-50"
                onClick={appendLocation}
              >
                <svg
                  className="h-3.5 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add another location
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || locations.length === 0}
            className="rounded-lg bg-[#2832A8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1e2680] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Save Locations"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddLocationModal;
