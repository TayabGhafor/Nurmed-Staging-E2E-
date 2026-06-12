"use client";

import React, { useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import NoteMarkdown from "../NoteMarkdown";

interface MedicationCardProps {
  id: string;
  title: string;
  content: string;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onEdit?: (id: string, content: string) => void;
  onCopy?: (content: string) => void;
  /** When true, note was sent to EHR/scribe successfully — editing is disabled */
  editDisabled?: boolean;
}

const MedicationCard: React.FC<MedicationCardProps> = ({
  id,
  title,
  content,
  editingId,
  setEditingId,
  onEdit,
  onCopy,
  editDisabled = false,
}) => {
  const isEditing = editingId === id;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipBlurSaveRef = useRef(false);

  const resizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (isEditing) {
      resizeTextarea(textareaRef.current);
    }
  }, [isEditing, content, resizeTextarea]);

  useEffect(() => {
    if (editDisabled && isEditing) {
      setEditingId(null);
    }
  }, [editDisabled, isEditing, setEditingId]);

  const handleEdit = (medicationId: string, newContent: string) => {
    if (onEdit) {
      onEdit(medicationId, newContent);
    }
  };

  const handleSave = () => {
    if (textareaRef.current) {
      handleEdit(id, textareaRef.current.value);
      setEditingId(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleCopy = (content: string) => {
    if (onCopy) {
      onCopy(content);
    } else {
      // Fallback if onCopy is not provided
      navigator.clipboard.writeText(content);
    }
  };

  return (
    <div className="shadow-xs rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-100 px-4">
        <h3 className="text-sm font-medium text-[#19213D]">{title}</h3>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => handleCopy(content)}
              className="h-10 cursor-pointer rounded-md px-1 py-2 text-gray-600 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-800"
            >
              <img src="/images/copy.svg" alt="copy" className="h-3.5 w-3.5" />
            </button>
          )}
          {isEditing && (
            <button
              type="button"
              onMouseDown={() => {
                skipBlurSaveRef.current = true;
              }}
              onClick={handleCancel}
              className="h-10 cursor-pointer rounded-md px-1 py-2 text-gray-600 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-800"
            >
              <p className="text-sm font-medium text-gray-600">Cancel</p>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (editDisabled) {
                toast.error(
                  "These notes have already been sent to the scribe and cannot be edited.",
                  {
                    duration: 3000,
                    position: "bottom-right",
                  },
                );
                return;
              }
              if (isEditing) {
                handleSave();
              } else {
                setEditingId(id);
              }
            }}
            onMouseDown={() => {
              if (isEditing) {
                skipBlurSaveRef.current = true;
              }
            }}
            className={`h-10 rounded-md px-1 py-2 text-gray-600 transition-colors duration-200 ${
              editDisabled
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            {isEditing ? (
              <p className="text-sm font-medium text-blue-700">Save</p>
            ) : (
              <img src="/images/edit.svg" alt="edit" className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 p-4">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="min-h-[72px] w-full resize-none overflow-hidden rounded-lg border p-3 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            defaultValue={content}
            data-id={id}
            onInput={(e) => resizeTextarea(e.currentTarget)}
            onBlur={(e) => {
              if (skipBlurSaveRef.current) {
                skipBlurSaveRef.current = false;
                return;
              }
              if (editDisabled) return;
              if (editingId === id) {
                handleEdit(id, e.target.value);
                setEditingId(null);
              }
            }}
            autoFocus
          />
        ) : (
          <div className="w-full min-w-0">
            <NoteMarkdown markdown={content} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicationCard;
