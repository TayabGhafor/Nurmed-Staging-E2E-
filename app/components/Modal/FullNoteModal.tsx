import Modal from ".";
import { useEffect, useRef, useState } from "react";
import { useSession } from "../../hooks/useSession";
import Image from "next/image";
import toast from "react-hot-toast";
import jsPDF from "jspdf";

interface FullNoteModalProps {
  onClose: () => void;
  sessionId: string | undefined;
}

type FullNotesSection = {
  section_id: number;
  section: string;
  details: string;
};

type FullNotesResponse = {
  final_note_md?: string;
  sections?: FullNotesSection[];
  mrn?: string;
  session_id?: number;
};

const isFullNotesResponse = (value: unknown): value is FullNotesResponse => {
  return (
    !!value &&
    typeof value === "object" &&
    ("final_note_md" in value || "sections" in value)
  );
};

const normalizePlaceholderText = (text: string) =>
  text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, ".");

/** Hide sections whose only content is this backend placeholder. */
const isNotMentionedInConsultation = (details: string) =>
  normalizePlaceholderText(details) === "not mentioned in the consultation.";

/** Build the same markdown shape the modal always rendered (headings as `**Title**:` per line/block). */
const sectionsToMarkdown = (sections: FullNotesSection[]) => {
  return sections
    .filter((s) => !isNotMentionedInConsultation(s.details))
    .map((s) => `**${s.section}**:\n${s.details}`.trim())
    .filter(Boolean)
    .join("\n\n");
};

/**
 * Remove `**Section**: …` blocks whose body is only "Not mentioned in the consultation."
 * (handles both `final_note_md` and legacy plain markdown strings).
 */
const stripNotMentionedInConsultationBlocks = (markdown: string) => {
  const trimmed = markdown.trim();
  if (!trimmed) return "";

  const blocks = trimmed.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  const kept = blocks.filter((block) => {
    const m = block.match(/^\*\*[^*]+\*\*:\s*([\s\S]*)$/);
    if (!m) return true;
    return !isNotMentionedInConsultation(m[1]);
  });

  return kept.join("\n\n");
};

const normalizeFullNotesToMarkdown = (fullNotes: unknown): string => {
  if (fullNotes == null) return "";
  if (typeof fullNotes === "string") {
    return stripNotMentionedInConsultationBlocks(fullNotes);
  }
  if (isFullNotesResponse(fullNotes)) {
    const fromMd = fullNotes.final_note_md?.trim();
    if (fromMd) return stripNotMentionedInConsultationBlocks(fromMd);
    if (Array.isArray(fullNotes.sections) && fullNotes.sections.length > 0) {
      return sectionsToMarkdown(fullNotes.sections);
    }
  }
  return "";
};

const FullNoteModal = ({ onClose, sessionId }: FullNoteModalProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [fullNoteContent, setFullNoteContent] = useState<string>("");

  const { getFullNotes, fullNotes, fullNotesLoading, fullNotesError } =
    useSession();

  // Guards against React StrictMode's intentional double-fire of effects in
  // dev (which otherwise re-runs get_full_notes/<id> twice on every modal
  // open). Keyed by sessionId so reopening the modal for a different session
  // still triggers a fetch.
  const loadedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchFullNotes = async () => {
      if (!sessionId) return;
      if (loadedSessionIdRef.current === sessionId) return;
      loadedSessionIdRef.current = sessionId;
      try {
        setIsLoading(true);
        await getFullNotes(sessionId);
      } catch (error) {
        console.error("Error fetching Full Notes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFullNotes();
  }, [sessionId, getFullNotes]);

  useEffect(() => {
    setFullNoteContent(normalizeFullNotesToMarkdown(fullNotes));
  }, [fullNotes]);

  const formatNoteContent = (content: string) => {
    if (!content) return null;

    return content.split("\n").map((line, index) => {
      if (line.startsWith("**") && line.endsWith("**:")) {
        const headingText = line.replace(/^\*\*|\*\*:$/g, "");
        return (
          <h3 key={index} className="mb-2 mt-4 font-bold text-[#19213D]">
            {headingText}:
          </h3>
        );
      }

      const processedLine = line.replace(/\*\*([^*]+)\*\*/g, (_match, p1) => {
        return `<strong>${p1}</strong>`;
      });

      return (
        <p
          key={index}
          className="mb-2 text-secondary-100"
          dangerouslySetInnerHTML={{ __html: processedLine }}
        />
      );
    });
  };

  const downloadNoteAsPDF = () => {
    if (!fullNoteContent) return;

    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let yPosition = 30;

    doc.setFillColor(25, 33, 61);
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Final Note", pageWidth / 2, 25, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const lines = fullNoteContent.split("\n");
    let currentY = yPosition + 20;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("**") && line.endsWith("**:")) {
        const headingText = line.replace(/^\*\*|\*\*:$/g, "");

        if (currentY > yPosition + 20) {
          currentY += 8;
        }

        if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = 30;
        }

        doc.setFillColor(25, 33, 61, 0.1);
        doc.rect(margin - 5, currentY - 8, contentWidth + 10, 12, "F");

        doc.setTextColor(25, 33, 61);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`${headingText}:`, margin, currentY);

        currentY += 15;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
      } else if (line.trim()) {
        const processedLine = processLineForPDF(line);

        if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = 30;
        }

        const textLines = doc.splitTextToSize(processedLine, contentWidth);

        for (const textLine of textLines) {
          if (currentY > pageHeight - 30) {
            doc.addPage();
            currentY = 30;
          }

          if (textLine.includes("**")) {
            const parts = textLine.split(/\*\*([^*]+)\*\*/);
            let xPos = margin;

            for (let j = 0; j < parts.length; j++) {
              if (j % 2 === 0) {
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "normal");
                doc.text(parts[j], xPos, currentY);
                xPos += doc.getTextWidth(parts[j]);
              } else {
                doc.setTextColor(25, 33, 61);
                doc.setFont("helvetica", "bold");
                doc.text(parts[j], xPos, currentY);
                xPos += doc.getTextWidth(parts[j]);
              }
            }
          } else {
            doc.setTextColor(0, 0, 0);
            doc.setFont("helvetica", "normal");
            doc.text(textLine, margin, currentY);
          }

          currentY += 6;
        }
      } else {
        currentY += 4;
      }
    }

    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      "NurMed - Medical Documentation System",
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    doc.save(`final-note-${sessionId}-(${new Date().toLocaleDateString()}).pdf`);
  };

  const processLineForPDF = (line: string): string => {
    return line.replace(/\*\*([^*]+)\*\*/g, "**$1**");
  };

  return (
    <Modal
      className="flex max-h-[80vh] w-full flex-col bg-white sm:rounded-lg"
      onClose={() => onClose()}
    >
      {isLoading || fullNotesLoading ? (
        <div className="flex h-[50vh] w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-100 border-t-transparent"></div>
        </div>
      ) : (
        <>
          <h2 className="border-b border-gray-200 py-4 text-center text-lg font-medium sm:py-6 sm:text-xl md:text-2xl">
            Final Note
          </h2>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {fullNotesError ? (
              <div className="flex h-full w-full items-center justify-center p-6 text-center">
                <p className="text-red-500">
                  An error occurred while loading Full Notes data. Please try
                  again.
                </p>
              </div>
            ) : fullNoteContent ? (
              <div className="shadow-xs rounded-lg bg-white p-4 sm:p-6">
                {formatNoteContent(fullNoteContent)}
              </div>
            ) : (
              <div className="shadow-xs rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
                <p className="text-secondary-100">
                  No full note data available for this session.
                </p>
              </div>
            )}
          </div>

          <div className="flex w-full items-center justify-end gap-4 border-t border-gray-200 bg-white p-4 sm:p-6">
            <button
              onClick={downloadNoteAsPDF}
              className="flex items-center justify-center rounded-lg border border-primary-100 px-4 py-2 text-sm font-medium text-primary-100 shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md sm:px-6"
              disabled={!fullNoteContent}
            >
              <Image
                src="/images/upload.svg"
                alt="Copy"
                width={16}
                height={16}
                className="mr-2"
                style={{
                  filter:
                    "invert(43%) sepia(93%) saturate(1752%) hue-rotate(198deg) brightness(105%) contrast(101%)",
                }}
              />
              Export Note
            </button>
            <button
              onClick={() => {
                if (fullNoteContent) {
                  const plainText = convertMarkdownToPlainText(fullNoteContent);
                  navigator.clipboard.writeText(plainText);
                  toast.success("Note copied to clipboard!", {
                    duration: 2000,
                    position: "bottom-right",
                  });
                }
              }}
              className="flex items-center justify-center rounded-lg border border-primary-100 px-4 py-2 text-sm font-medium text-primary-100 shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md sm:px-6"
              disabled={!fullNoteContent}
            >
              <Image
                src="/images/copy.svg"
                alt="Copy"
                width={16}
                height={16}
                className="mr-2"
                style={{
                  filter:
                    "invert(43%) sepia(93%) saturate(1752%) hue-rotate(198deg) brightness(105%) contrast(101%)",
                }}
              />
              Copy Note
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-lg border border-primary-100 px-4 py-2 text-sm font-medium text-primary-100 shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md sm:px-6"
            >
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

const convertMarkdownToPlainText = (markdown: string): string => {
  if (!markdown) return "";

  return markdown
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
};

export default FullNoteModal;
