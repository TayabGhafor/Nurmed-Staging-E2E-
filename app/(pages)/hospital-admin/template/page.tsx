"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import toast from "react-hot-toast";
import { useHospitalAdminAccess } from "../../../hooks/useHospitalAdminAccess";
import { dashboardService } from "../../../kyClient/dashboard";
import { invalidateDoctorLanguagesAndTemplates } from "../../../hooks/useDoctorLanguagesAndTemplates";

interface TemplateRow {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface SectionInput {
  text: string;
}

interface AddTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const AddTemplateModal: React.FC<AddTemplateModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sections, setSections] = useState<SectionInput[]>([{ text: "" }]);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setCode("");
    setName("");
    setDescription("");
    setIsActive(true);
    setSections([{ text: "" }]);
  };

  const handleClose = () => {
    if (isLoading) return;
    resetForm();
    onClose();
  };

  // Close on escape
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", onEsc);
      return () => document.removeEventListener("keydown", onEsc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLoading]);

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const updateSection = (index: number, value: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, text: value } : s)),
    );
  };

  const addSection = () => setSections((prev) => [...prev, { text: "" }]);

  const removeSection = (index: number) =>
    setSections((prev) => prev.filter((_, i) => i !== index));

  const moveSection = (index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    const cleanedSections = sections
      .map((s) => s.text.trim())
      .filter((t) => t.length > 0);

    if (!trimmedCode || !trimmedName) {
      toast.error("Code and name are required.", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }
    if (cleanedSections.length === 0) {
      toast.error("Please add at least one section.", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    setIsLoading(true);
    try {
      await dashboardService.createTemplate({
        code: trimmedCode,
        name: trimmedName,
        ...(description.trim() ? { description: description.trim() } : {}),
        is_active: isActive,
        sections: cleanedSections.map((text, idx) => ({
          text,
          sort_order: idx,
        })),
      });
      toast.success("Template created successfully!", {
        duration: 3000,
        position: "bottom-right",
      });
      onCreated();
      resetForm();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create template", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#19213D]">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
            placeholder="CUSTOM_OPD"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#19213D]">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
            placeholder="Custom Outpatient"
            disabled={isLoading}
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[#19213D]">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
          placeholder="Short description of this template"
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#2832AB] focus:ring-2 focus:ring-[#2832AB]"
          disabled={isLoading}
        />
        <span className="text-sm font-medium text-[#19213D]">Active</span>
      </div>

      {/* Sections */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-sm font-medium text-[#19213D]">
            Sections <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={addSection}
            className="text-xs font-medium text-[#2832AB] transition-colors hover:text-[#1f2687]"
            disabled={isLoading}
          >
            + Add Section
          </button>
        </div>
        <div className="space-y-2">
          {sections.map((section, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-6 text-center text-xs font-medium text-[#666F8D]">
                {index + 1}
              </span>
              <input
                type="text"
                value={section.text}
                onChange={(e) => updateSection(index, e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                placeholder={`Section ${index + 1} title`}
                disabled={isLoading}
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(index, -1)}
                  disabled={isLoading || index === 0}
                  className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
                  title="Move up"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(index, 1)}
                  disabled={isLoading || index === sections.length - 1}
                  className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
                  title="Move down"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => removeSection(index)}
                  disabled={isLoading || sections.length === 1}
                  className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-30"
                  title="Remove section"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-50"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-[#2832A8] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Creating..." : "Create Template"}
        </button>
      </div>
    </form>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleOutsideClick}
    >
      {/* Mobile Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 max-h-[90vh] w-full transform overflow-y-auto rounded-t-xl bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ transform: isOpen ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="sticky top-0 z-10 rounded-t-xl border-b border-gray-200 bg-white">
          <div className="flex items-center justify-center pb-2 pt-3">
            <div className="h-1 w-12 rounded-full bg-gray-300"></div>
          </div>
          <div className="flex items-center justify-between px-4 pb-4">
            <h2 className="text-lg font-semibold text-[#19213D]">Add Template</h2>
            <button
              onClick={handleClose}
              className="rounded-full p-2 transition-colors hover:bg-gray-100"
              disabled={isLoading}
            >
              <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="px-4 pb-6">{form}</div>
      </div>

      {/* Desktop Modal */}
      <div className="hidden w-full max-w-2xl md:block" onClick={(e) => e.stopPropagation()}>
        <div className="max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#19213D]">Add Template</h2>
              <button
                onClick={handleClose}
                className="rounded-full p-2 transition-colors hover:bg-gray-100"
                disabled={isLoading}
              >
                <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-6 py-4">{form}</div>
        </div>
      </div>
    </div>
  );
};

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  templateName: string;
  isLoading: boolean;
}

function ConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  templateName,
  isLoading,
}: ConfirmationModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">
        <div className="px-6 py-4">
          <h2 className="mb-2 text-lg font-semibold text-[#19213D]">Delete Template?</h2>
          <p className="text-sm text-gray-700">
            Are you sure you want to delete the template{" "}
            <span className="font-semibold">&quot;{templateName}&quot;</span>? This
            action cannot be undone.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-50"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Normalize a raw list item into a flat template row (handles both the
// `{ session_template: {...} }` wrapper shape and a flat template object).
function normalizeTemplate(item: any): TemplateRow | null {
  const tpl = item?.session_template ?? item;
  if (!tpl || tpl.id == null) return null;
  return {
    id: Number(tpl.id),
    code: tpl.code ?? "-",
    name: tpl.name ?? "-",
    description: tpl.description ?? "",
    is_active: Boolean(tpl.is_active),
  };
}

// --- Session cache helpers (stale-while-revalidate) -------------------------
const listCacheKey = (hospitalId: number | string) =>
  `hospital_templates_${hospitalId}`;
const detailCacheKey = (templateId: number | string) =>
  `template_detail_${templateId}`;

function readListCache(hospitalId: number): TemplateRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(listCacheKey(hospitalId));
    return raw ? (JSON.parse(raw) as TemplateRow[]) : null;
  } catch {
    return null;
  }
}

function writeListCache(hospitalId: number, data: TemplateRow[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(listCacheKey(hospitalId), JSON.stringify(data));
  } catch {
    /* ignore quota / serialization errors */
  }
}

function clearDetailCache(templateId: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(detailCacheKey(templateId));
  } catch {
    /* ignore */
  }
}

export default function TemplatesManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { loading: capabilitiesLoading } = useHospitalAdminAccess();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    template: TemplateRow | null;
  }>({ isOpen: false, template: null });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // Track every template currently being toggled so concurrent activate/
  // deactivate actions each keep their own loader.
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // Row actions dropdown (three-dot menu)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.hospital_id) return;
    // Show cached templates instantly, then refresh in the background.
    const cached = readListCache(user.hospital_id);
    if (cached) {
      setTemplates(cached);
      setIsLoading(false);
      fetchData(true, true);
    } else {
      fetchData(true, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.hospital_id]);

  // Close the actions dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);

  // `silent` keeps the existing UI (no full-page loader) while refreshing in
  // the background — used for cache revalidation and post-action refetches.
  const fetchData = async (bustCache = false, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await dashboardService.getHospitalTemplates(
        user?.hospital_id as number,
        bustCache,
      );
      const list: any[] = response?.templates ?? [];
      const normalized = list
        .map(normalizeTemplate)
        .filter((t): t is TemplateRow => t !== null);
      setTemplates(normalized);
      writeListCache(user?.hospital_id as number, normalized);
    } catch (error: any) {
      // Don't disrupt the user with an error toast on background refreshes;
      // the already-rendered (cached/optimistic) data stays in place.
      if (!silent) {
        toast.error(error.message || "Failed to fetch templates", {
          duration: 3000,
          position: "bottom-right",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleDelete = (template: TemplateRow) =>
    setConfirmDelete({ isOpen: true, template });

  // Toggle a template's active state. The update endpoint expects the existing
  // sections, so we fetch the full template first and re-send its sections to
  // avoid wiping them while only flipping is_active.
  const handleToggleActive = async (template: TemplateRow) => {
    // Ignore if this template is already being toggled.
    if (togglingIds.has(template.id)) return;
    setTogglingIds((prev) => new Set(prev).add(template.id));
    try {
      const detail = await dashboardService.getTemplateById(template.id);
      const data: any = detail?.data ?? detail;
      const existingSections = [...(data?.sections ?? [])]
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .filter((s: any) => s.section_id != null)
        .map((s: any, idx: number) => ({
          section_id: s.section_id,
          text: s.text,
          sort_order: idx,
        }));

      await dashboardService.updateTemplate(template.id, {
        name: data?.name ?? template.name,
        is_active: !template.is_active,
        sections: existingSections,
      });

      // Optimistically reflect the new status (row only), then silently refetch.
      const nextActive = !template.is_active;
      setTemplates((prev) => {
        const updated = prev.map((t) =>
          t.id === template.id ? { ...t, is_active: nextActive } : t,
        );
        writeListCache(user?.hospital_id as number, updated);
        return updated;
      });
      clearDetailCache(template.id);
      // Active/inactive controls whether the template appears for doctors —
      // invalidate the doctor portal's separate cache so it refetches.
      invalidateDoctorLanguagesAndTemplates(user?.hospital_id);
      toast.success(
        template.is_active ? "Template deactivated" : "Template activated",
        { duration: 3000, position: "bottom-right" },
      );
      fetchData(true, true);
    } catch (error: any) {
      toast.error(error.message || "Failed to update template status", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  };

  const confirmDeleteTemplate = async () => {
    const template = confirmDelete.template;
    if (!template) return;
    setDeletingId(template.id);
    try {
      await dashboardService.deleteTemplate(template.id);
      // Optimistically remove the row (no full-page loader), then silently refetch.
      setTemplates((prev) => {
        const updated = prev.filter((t) => t.id !== template.id);
        writeListCache(user?.hospital_id as number, updated);
        return updated;
      });
      clearDetailCache(template.id);
      // A deleted template must disappear from the doctor recording modal —
      // invalidate the doctor portal's separate cache so it refetches.
      invalidateDoctorLanguagesAndTemplates(user?.hospital_id);
      toast.success("Template deleted successfully", {
        duration: 3000,
        position: "bottom-right",
      });
      fetchData(true, true);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete template", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setDeletingId(null);
      setConfirmDelete({ isOpen: false, template: null });
    }
  };

  if (capabilitiesLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#2832A8] border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col rounded-none border-0 border-[#F0F2F5] bg-white shadow-none md:rounded-xl md:border md:shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
            <div className="flex items-center gap-2">
              <div
                onClick={() => router.push("/hospital-admin")}
                className="cursor-pointer rounded-lg p-1 transition-colors hover:bg-gray-100 md:hidden"
              >
                <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#19213D] md:text-2xl">
                  Template Management
                </h1>
                <p className="mt-1 text-sm text-[#666F8D]">
                  Create and manage clinical note templates for your hospital
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(true)}
                className="rounded-lg bg-[#2832A8] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] md:px-4"
              >
                <span className="hidden sm:inline">+ Add Template</span>
                <span className="sm:hidden">+ Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {templates.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-gray-600">No templates found</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 rounded-lg bg-[#2832A8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2832A8]"
                >
                  Create your first template
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {templates.map((template) => (
                    <tr
                      key={template.id}
                      onClick={() =>
                        router.push(`/hospital-admin/template/${template.id}`)
                      }
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[#19213D]">
                        {template.id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-[#19213D]">
                        {template.code}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-[#19213D]">
                        {template.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        {template.is_active ? (
                          <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm">
                        <div className="relative flex items-center justify-end">
                          {(() => {
                            const pending =
                              togglingIds.has(template.id) ||
                              deletingId === template.id;
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (pending) return;
                                  setOpenMenuId((prev) =>
                                    prev === template.id ? null : template.id,
                                  );
                                }}
                                disabled={pending}
                                className="rounded-full p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                title="Actions"
                              >
                                {pending ? (
                                  <span className="block h-5 w-5 animate-spin rounded-full border-2 border-solid border-[#2832A8] border-r-transparent" />
                                ) : (
                                  <svg
                                    className="h-5 w-5"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M12 8a2 2 0 100-4 2 2 0 000 4zM12 14a2 2 0 100-4 2 2 0 000 4zM12 20a2 2 0 100-4 2 2 0 000 4z" />
                                  </svg>
                                )}
                              </button>
                            );
                          })()}

                          {openMenuId === template.id && (
                            <div
                              ref={menuRef}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  router.push(
                                    `/hospital-admin/template/${template.id}`,
                                  );
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#19213D] transition-colors hover:bg-gray-50"
                              >
                                <svg
                                  className="h-4 w-4 text-[#2832A8]"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                                View
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleToggleActive(template);
                                }}
                                disabled={togglingIds.has(template.id)}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#19213D] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {template.is_active ? (
                                  <>
                                    <svg
                                      className="h-4 w-4 text-amber-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    {togglingIds.has(template.id)
                                      ? "Updating..."
                                      : "Deactivate"}
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      className="h-4 w-4 text-green-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                    {togglingIds.has(template.id)
                                      ? "Updating..."
                                      : "Activate"}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleDelete(template);
                                }}
                                disabled={deletingId === template.id}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                {deletingId === template.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AddTemplateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreated={() => {
          // A new template affects what doctors see in the recording modal —
          // invalidate the doctor portal's separate cache so it refetches.
          invalidateDoctorLanguagesAndTemplates(user?.hospital_id);
          fetchData(true);
        }}
      />

      <ConfirmationModal
        isOpen={confirmDelete.isOpen}
        onCancel={() => setConfirmDelete({ isOpen: false, template: null })}
        onConfirm={confirmDeleteTemplate}
        templateName={confirmDelete.template?.name || ""}
        isLoading={deletingId === confirmDelete.template?.id}
      />
    </div>
  );
}
