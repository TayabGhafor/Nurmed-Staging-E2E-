"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";
import { useHospitalAdminAccess } from "../../../../hooks/useHospitalAdminAccess";
import { dashboardService } from "../../../../kyClient/dashboard";
import { invalidateDoctorLanguagesAndTemplates } from "../../../../hooks/useDoctorLanguagesAndTemplates";

interface TemplateSection {
  link_id?: number;
  section_id?: number;
  text: string;
  prompt?: string;
  sort_order: number;
}

interface TemplateDetail {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  hospital_id?: number;
  created_at?: string;
  updated_at?: string;
  sections: TemplateSection[];
}

// Editable section row in the form (carries a stable key + optional section_id)
interface SectionDraft {
  key: string;
  section_id?: number;
  text: string;
}

// --- Session cache helpers (stale-while-revalidate) -------------------------
const detailCacheKey = (templateId: number | string) =>
  `template_detail_${templateId}`;

function readDetailCache(templateId: number): TemplateDetail | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(detailCacheKey(templateId));
    return raw ? (JSON.parse(raw) as TemplateDetail) : null;
  } catch {
    return null;
  }
}

function writeDetailCache(templateId: number, data: TemplateDetail) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(detailCacheKey(templateId), JSON.stringify(data));
  } catch {
    /* ignore quota / serialization errors */
  }
}

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
          <h2 className="mb-2 text-lg font-semibold text-[#19213D]">
            Delete Template?
          </h2>
          <p className="text-sm text-gray-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">&quot;{templateName}&quot;</span>?
            This action cannot be undone.
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

export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { loading: capabilitiesLoading } = useHospitalAdminAccess();

  const templateId = Number(params?.templateId);

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const keyCounter = useRef(0);
  const nextKey = () => `draft-${keyCounter.current++}`;

  useEffect(() => {
    if (Number.isNaN(templateId)) return;
    // Render cached detail instantly, then refresh in the background.
    const cached = readDetailCache(templateId);
    if (cached) {
      setTemplate(cached);
      setIsLoading(false);
      fetchTemplate(true);
    } else {
      fetchTemplate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // `silent` keeps the rendered (cached) detail in place while refreshing.
  const fetchTemplate = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await dashboardService.getTemplateById(templateId);
      const data: TemplateDetail = response?.data ?? response;
      const sortedSections = [...(data?.sections ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      );
      const next = { ...data, sections: sortedSections };
      setTemplate(next);
      writeDetailCache(templateId, next);
    } catch (error: any) {
      if (!silent) {
        toast.error(error.message || "Failed to load template", {
          duration: 3000,
          position: "bottom-right",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const startEditing = () => {
    if (!template) return;
    setName(template.name ?? "");
    setIsActive(Boolean(template.is_active));
    setSections(
      template.sections.map((s) => ({
        key: nextKey(),
        section_id: s.section_id,
        text: s.text ?? "",
      })),
    );
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const updateSection = (key: string, value: string) =>
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, text: value } : s)),
    );

  // Prepend so the new (empty) section appears at the top, making it
  // immediately visible for the user to fill in its name/details.
  const addSection = () =>
    setSections((prev) => [{ key: nextKey(), text: "" }, ...prev]);

  const removeSection = (key: string) =>
    setSections((prev) => prev.filter((s) => s.key !== key));

  const moveSection = (index: number, direction: -1 | 1) =>
    setSections((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required.", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    const existingSections: {
      section_id: number;
      text: string;
      sort_order: number;
    }[] = [];
    const newSections: { text: string; sort_order: number }[] = [];

    sections.forEach((s, idx) => {
      const text = s.text.trim();
      if (!text) return; // skip empty rows
      if (s.section_id != null) {
        existingSections.push({
          section_id: s.section_id,
          text,
          sort_order: idx,
        });
      } else {
        newSections.push({ text, sort_order: idx });
      }
    });

    if (existingSections.length === 0 && newSections.length === 0) {
      toast.error("Please add at least one section.", {
        duration: 3000,
        position: "bottom-right",
      });
      return;
    }

    setSaving(true);
    try {
      await dashboardService.updateTemplate(templateId, {
        name: name.trim(),
        is_active: isActive,
        sections: existingSections,
        ...(newSections.length > 0 ? { add_sections: newSections } : {}),
      });
      // Optimistically reflect the saved changes (no loader), then silently
      // refresh from the server to pick up new section ids / canonical order.
      setTemplate((prev) =>
        prev
          ? {
              ...prev,
              name: name.trim(),
              is_active: isActive,
              sections: sections
                .filter((s) => s.text.trim())
                .map((s, idx) => ({
                  section_id: s.section_id,
                  text: s.text.trim(),
                  sort_order: idx,
                })),
            }
          : prev,
      );
      // Edits (name/sections/active state) affect what doctors see in the
      // recording modal — invalidate the doctor portal's separate cache.
      invalidateDoctorLanguagesAndTemplates(template?.hospital_id);
      toast.success("Template updated successfully!", {
        duration: 3000,
        position: "bottom-right",
      });
      setEditing(false);
      fetchTemplate(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to update template", {
        duration: 3000,
        position: "bottom-right",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await dashboardService.deleteTemplate(templateId);
      // Invalidate caches so the list doesn't briefly show the deleted template.
      try {
        sessionStorage.removeItem(detailCacheKey(templateId));
        const hid = template?.hospital_id;
        if (hid != null) {
          const raw = sessionStorage.getItem(`hospital_templates_${hid}`);
          if (raw) {
            const pruned = (JSON.parse(raw) as { id: number }[]).filter(
              (t) => Number(t.id) !== templateId,
            );
            sessionStorage.setItem(
              `hospital_templates_${hid}`,
              JSON.stringify(pruned),
            );
          }
        }
      } catch {
        /* ignore cache errors */
      }
      // Drop the deleted template from the doctor portal's separate cache too.
      invalidateDoctorLanguagesAndTemplates(template?.hospital_id);
      toast.success("Template deleted successfully", {
        duration: 3000,
        position: "bottom-right",
      });
      router.push("/hospital-admin/template");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete template", {
        duration: 3000,
        position: "bottom-right",
      });
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
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

  if (!template) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-gray-600">Template not found</p>
        <button
          onClick={() => router.push("/hospital-admin/template")}
          className="rounded-lg bg-[#2832A8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2832A8]"
        >
          Back to Templates
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col md:max-h-[calc(100dvh-3.35rem)] md:py-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-none border-0 border-[#F0F2F5] bg-white shadow-none md:rounded-xl md:border md:shadow-xl">
        {/* Header */}
        <div className="border-b border-[#E3E6EA] p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-0">
            <div className="flex items-center gap-2">
              <div
                onClick={() => router.push("/hospital-admin/template")}
                className="cursor-pointer rounded-lg p-1 transition-colors hover:bg-gray-100"
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
                  {editing ? "Edit Template" : template.name}
                </h1>
                <p className="mt-1 text-sm text-[#666F8D]">
                  {editing
                    ? "Update template details and sections"
                    : `Code: ${template.code}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!editing ? (
                <>
                  <button
                    onClick={startEditing}
                    className="rounded-lg bg-[#2832A8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2832A8]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                  >
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#19213D] transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-[#2832A8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2832A8] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {!editing ? (
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Meta */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[#E3E6EA] p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                    Code
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#19213D]">
                    {template.code}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E3E6EA] p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                    Status
                  </p>
                  <p className="mt-1">
                    {template.is_active ? (
                      <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Inactive
                      </span>
                    )}
                  </p>
                </div>
                {template.description ? (
                  <div className="rounded-lg border border-[#E3E6EA] p-4 sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                      Description
                    </p>
                    <p className="mt-1 text-sm text-[#19213D]">
                      {template.description}
                    </p>
                  </div>
                ) : null}
                <div className="rounded-lg border border-[#E3E6EA] p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                    Created
                  </p>
                  <p className="mt-1 text-sm text-[#19213D]">
                    {formatDate(template.created_at)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E3E6EA] p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#666F8D]">
                    Last Updated
                  </p>
                  <p className="mt-1 text-sm text-[#19213D]">
                    {formatDate(template.updated_at)}
                  </p>
                </div>
              </div>

              {/* Sections */}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#19213D]">
                  Sections ({template.sections.length})
                </h2>
                {template.sections.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#E3E6EA] p-6 text-center text-sm text-gray-500">
                    This template has no sections yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {template.sections.map((section, index) => (
                      <div
                        key={section.section_id ?? section.link_id ?? index}
                        className="flex items-start gap-3 rounded-lg border border-[#E3E6EA] p-4"
                      >
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-[#2832A8]">
                          {index + 1}
                        </span>
                        <p className="text-sm font-medium text-[#19213D]">
                          {section.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#19213D]">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                  placeholder="Template name"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#666F8D]">
                  Code
                </label>
                <input
                  type="text"
                  value={template.code}
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Code cannot be changed after creation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#2832AB] focus:ring-2 focus:ring-[#2832AB]"
                  disabled={saving}
                />
                <span className="text-sm font-medium text-[#19213D]">Active</span>
              </div>

              {/* Sections editor */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-[#19213D]">
                    Sections <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addSection}
                    className="text-xs font-medium text-[#2832AB] transition-colors hover:text-[#1f2687]"
                    disabled={saving}
                  >
                    + Add Section
                  </button>
                </div>
                <div className="space-y-2">
                  {sections.map((section, index) => (
                    <div key={section.key} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-medium text-[#666F8D]">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={section.text}
                        onChange={(e) => updateSection(section.key, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2832AB]"
                        placeholder={`Section ${index + 1} title`}
                        disabled={saving}
                      />
                      {section.section_id == null && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#2832A8]">
                          NEW
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveSection(index, -1)}
                          disabled={saving || index === 0}
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
                          disabled={saving || index === sections.length - 1}
                          className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
                          title="Move down"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSection(section.key)}
                          disabled={saving}
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
                  {sections.length === 0 && (
                    <p className="rounded-lg border border-dashed border-[#E3E6EA] p-4 text-center text-sm text-gray-500">
                      No sections. Click &quot;Add Section&quot; to add one.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        templateName={template.name}
        isLoading={deleting}
      />
    </div>
  );
}
