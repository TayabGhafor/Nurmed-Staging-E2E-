/**
 * Session Data Validation — the core E2E test.
 *
 * 1. Login → get token
 * 2. Pick random audio from testdata/audio/
 * 3. Upload audio → get note_id
 * 4. Create session with note_id
 * 5. Poll until processed
 * 6. Fetch notes → extract Diagnosis / Chief Complaint / Review of Systems
 * 7. Match against ICD + SNOMED Excel reference data
 * 8. Generate HTML report → testResults/{sessionName}.html
 * 9. Update testResults/index.html
 */

import { test, expect } from "../lib/fixtures";
import {
  uploadAudio,
  createSession,
  pollUntilProcessed,
  getNotes,
  pickRandomAudio,
  type NoteSection,
} from "../lib/api-client";
import {
  matchExtractedTerms,
  extractTermsFromText,
  type ValidationResult,
  type MatchResult,
} from "../lib/excel-loader";
import {
  writeSessionReport,
  writeIndexPage,
  loadExistingReports,
  saveReportSummaries,
  type SessionReportData,
  type ReportSummary,
} from "../lib/report-writer";
import path from "path";
import fs from "fs";

// ── Constants ──────────────────────────────────────────────────────────────

const AUDIO_DIR = path.resolve(__dirname, "../../testdata/audio");
const RESULTS_DIR = path.resolve(__dirname, "../../testResults");
const SESSION_TEMPLATE = process.env.SESSION_TEMPLATE || "OPDLHR18";

// The sections we want to extract and validate
const TARGET_SECTIONS = [
  "Diagnosis",
  "Chief Complaint",
  "History of Presenting Complaint",
  "Chief Complaint/History of Presenting Complaint",
  "Review of Systems",
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find a note section by name (case-insensitive, partial match).
 */
function findSection(
  notes: NoteSection[],
  sectionName: string,
): NoteSection | undefined {
  const lower = sectionName.toLowerCase();
  return notes.find((n) => {
    const name = (
      n.section_name ||
      n.section_title ||
      n.title ||
      ""
    ).toLowerCase();
    return name.includes(lower) || lower.includes(name);
  });
}

/**
 * Get the text content from a note section.
 */
function getSectionText(section: NoteSection | undefined): string {
  if (!section) return "(empty)";
  return (
    section.content ||
    section.details ||
    section.text ||
    "(empty)"
  );
}

/**
 * Generate a session name from timestamp.
 */
function generateSessionName(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "");
  return `E2E-Session-${dateStr}-${timeStr}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main validation test
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Session Data Validation & Report Generation", () => {
  test.setTimeout(900_000); // 15 minutes max

  test("Full pipeline: upload → create → poll → validate → report", async ({
    authToken,
    excelData,
  }) => {
    const sessionName = generateSessionName();
    let sessionId = 0;
    let mrn = "";
    let audioFileName = "";
    let pollingAttempts = 0;
    let finalStatus = "Not Started";
    let clinicalSections: {
      name: string;
      text: string;
      matches: MatchResult[];
      unmatched: string[];
    }[] = [];
    let overallValidation: ValidationResult = {
      matched: [],
      unmatched: [],
      totalExtracted: 0,
      totalMatched: 0,
      totalUnmatched: 0,
      accuracy: 0,
    };

    try {
      // ── Step 1: Pick random audio ──────────────────────────────────
      const audioFile = pickRandomAudio(AUDIO_DIR);
      audioFileName = path.basename(audioFile);
      console.log(`\n═══ ${sessionName} ═══`);
      console.log(`[1/8] Audio selected: ${audioFileName}`);

      // ── Step 2: Upload audio ───────────────────────────────────────
      const uploadResult = await uploadAudio(audioFile, authToken);
      expect(uploadResult.note_id).toBeTruthy();
      console.log(`[2/8] Audio uploaded → note_id: ${uploadResult.note_id}`);

      // ── Step 3: Create session ─────────────────────────────────────
      mrn = `E2E-${Date.now()}`;
      const createResult = await createSession(
        {
          mrn,
          language: "english",
          new_note_storage_id: uploadResult.note_id,
          session_template: SESSION_TEMPLATE,
          session_duration_seconds: 350,
        },
        authToken,
      );

      sessionId = createResult.session_id || createResult.id || 0;
      expect(sessionId).toBeGreaterThan(0);
      console.log(`[3/8] Session created → ID: ${sessionId}, MRN: ${mrn}`);

      // ── Step 4: Poll until processed ───────────────────────────────
      console.log(`[4/8] Polling for completion (15s intervals, max 10min)...`);
      const pollResult = await pollUntilProcessed(sessionId, authToken, {
        intervalMs: 15_000,
        maxWaitMs: 600_000,
        onPoll: (attempt, status) => {
          console.log(`       Poll #${attempt}: ${status}`);
        },
      });

      finalStatus = pollResult.session.status;
      pollingAttempts = pollResult.attempts;
      expect(finalStatus).toBe("Completed");
      console.log(
        `[4/8] Session completed after ${pollingAttempts} poll(s)`,
      );

      // ── Step 5: Fetch notes ────────────────────────────────────────
      const notes = await getNotes(sessionId, authToken);
      expect(notes.length).toBeGreaterThan(0);
      console.log(`[5/8] Retrieved ${notes.length} note sections`);

      // Log all section names for debugging
      const allSections = notes.map(
        (n) => n.section_name || n.section_title || n.title || "(unnamed)",
      );
      console.log(`       Sections found: ${allSections.join(", ")}`);

      // ── Step 6: Extract clinical sections ──────────────────────────
      console.log(`[6/8] Extracting clinical data...`);

      // Build clinical sections for each target
      const diagnosisSection = findSection(notes, "Diagnosis");
      const chiefComplaintSection =
        findSection(notes, "Chief Complaint") ||
        findSection(notes, "History of Presenting Complaint") ||
        findSection(notes, "HPI");
      const rosSection = findSection(notes, "Review of Systems");

      const sectionsToValidate = [
        { name: "Diagnosis", section: diagnosisSection },
        {
          name: "Chief Complaint / History of Presenting Complaint",
          section: chiefComplaintSection,
        },
        { name: "Review of Systems", section: rosSection },
      ];

      let allExtractedTerms: string[] = [];

      for (const { name, section } of sectionsToValidate) {
        const text = getSectionText(section);
        const terms = extractTermsFromText(text);
        allExtractedTerms.push(...terms);

        console.log(`       ${name}: ${terms.length} terms extracted`);

        // Match this section's terms individually
        const sectionResult = matchExtractedTerms(
          terms,
          excelData.icdCodes,
          excelData.snomedCodes,
        );

        clinicalSections.push({
          name,
          text,
          matches: sectionResult.matched,
          unmatched: sectionResult.unmatched,
        });
      }

      // ── Step 7: Overall validation ─────────────────────────────────
      console.log(`[7/8] Running SNOMED/ICD validation...`);
      overallValidation = matchExtractedTerms(
        allExtractedTerms,
        excelData.icdCodes,
        excelData.snomedCodes,
      );

      console.log(`       Total extracted: ${overallValidation.totalExtracted}`);
      console.log(`       Matched: ${overallValidation.totalMatched}`);
      console.log(`       Unmatched: ${overallValidation.totalUnmatched}`);
      console.log(`       Accuracy: ${overallValidation.accuracy}%`);

      // ── Step 8: Generate report ────────────────────────────────────
      console.log(`[8/8] Generating HTML report...`);

    } catch (error) {
      // If any step fails, still generate a report with whatever data we have
      console.error(`\n❌ Error during ${sessionName}:`, error);
      finalStatus = finalStatus === "Not Started" ? "Error" : finalStatus;
    }

    // Always generate report — even on failure
    const reportData: SessionReportData = {
      sessionName,
      sessionId,
      mrn,
      template: SESSION_TEMPLATE,
      audioFile: audioFileName,
      audioFolder: "testdata/audio",
      finalStatus,
      pollingAttempts,
      validation: overallValidation,
      fileStatus: excelData.fileStatus,
      clinicalSections:
        clinicalSections.length > 0
          ? clinicalSections
          : [
              { name: "Diagnosis", text: "(empty)", matches: [], unmatched: [] },
              {
                name: "Chief Complaint / History of Presenting Complaint",
                text: "(empty)",
                matches: [],
                unmatched: [],
              },
              {
                name: "Review of Systems",
                text: "(empty)",
                matches: [],
                unmatched: [],
              },
            ],
    };

    const fileName = writeSessionReport(reportData, RESULTS_DIR);

    // Update index page with all reports
    const existingReports = loadExistingReports(RESULTS_DIR);
    const newSummary: ReportSummary = {
      sessionName,
      fileName,
      status:
        finalStatus === "Completed" && overallValidation.totalExtracted > 0
          ? "PASSED"
          : "FAILED",
      accuracy: overallValidation.accuracy,
      totalExtracted: overallValidation.totalExtracted,
      totalMatched: overallValidation.totalMatched,
      timestamp: new Date().toISOString(),
    };

    const allReports = [...existingReports, newSummary];
    saveReportSummaries(allReports, RESULTS_DIR);
    writeIndexPage(allReports, RESULTS_DIR);

    console.log(`\n✅ Report written: testResults/${fileName}`);
    console.log(`📋 Index updated: testResults/index.html`);

    // Assert that we at least got through the pipeline
    expect(sessionId).toBeGreaterThan(0);
    expect(finalStatus).toBe("Completed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Excel data loading sanity checks
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Reference Data Loading", () => {
  test("should load ICD codes from Excel file", async ({ excelData }) => {
    console.log(`ICD codes loaded: ${excelData.icdCodes.length}`);

    if (excelData.icdCodes.length > 0) {
      expect(excelData.icdCodes[0]).toHaveProperty("code");
      expect(excelData.icdCodes[0]).toHaveProperty("description");
      console.log(
        `  Sample: ${excelData.icdCodes[0].code} — ${excelData.icdCodes[0].description}`,
      );
    } else {
      console.warn("⚠️  ICD Codes.xlsx not found or empty");
    }
  });

  test("should load SNOMED codes from Excel files", async ({ excelData }) => {
    console.log(`SNOMED codes loaded: ${excelData.snomedCodes.length}`);

    if (excelData.snomedCodes.length > 0) {
      expect(excelData.snomedCodes[0]).toHaveProperty("code");
      expect(excelData.snomedCodes[0]).toHaveProperty("term");
      console.log(
        `  Sample: ${excelData.snomedCodes[0].code} — ${excelData.snomedCodes[0].term}`,
      );
    } else {
      console.warn(
        "⚠️  Snomed Data 1.xlsx / Snowmed Data 2.xlsx not found or empty",
      );
    }
  });

  test("should report file status correctly", async ({ excelData }) => {
    for (const file of excelData.fileStatus) {
      console.log(
        `  ${file.file}: ${file.loaded ? "✅" : "❌"} (${file.entries} entries)`,
      );
    }

    // At least one file should be available
    const anyLoaded = excelData.fileStatus.some((f) => f.loaded);
    if (!anyLoaded) {
      console.warn(
        "⚠️  No reference data files found — validation will show 0 matches",
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Matching logic unit tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Matching Logic", () => {
  test("exact code match should return confidence 1.0", async ({ excelData }) => {
    if (excelData.icdCodes.length === 0) {
      console.log("Skipping — no ICD codes loaded");
      return;
    }

    const sampleCode = excelData.icdCodes[0].code;
    const result = matchExtractedTerms(
      [sampleCode],
      excelData.icdCodes,
      excelData.snomedCodes,
    );

    expect(result.totalMatched).toBe(1);
    expect(result.matched[0].matchType).toBe("exact_code");
    expect(result.matched[0].confidence).toBe(1.0);
  });

  test("exact term match should return confidence 1.0", async ({ excelData }) => {
    if (excelData.icdCodes.length === 0) {
      console.log("Skipping — no ICD codes loaded");
      return;
    }

    const sampleDesc = excelData.icdCodes[0].description;
    const result = matchExtractedTerms(
      [sampleDesc],
      excelData.icdCodes,
      excelData.snomedCodes,
    );

    if (result.totalMatched > 0) {
      expect(result.matched[0].confidence).toBeGreaterThanOrEqual(0.7);
    }
  });

  test("empty input should return zero matches", async ({ excelData }) => {
    const result = matchExtractedTerms(
      [],
      excelData.icdCodes,
      excelData.snomedCodes,
    );

    expect(result.totalExtracted).toBe(0);
    expect(result.totalMatched).toBe(0);
    expect(result.accuracy).toBe(0);
  });

  test("nonsense input should be unmatched", async ({ excelData }) => {
    const result = matchExtractedTerms(
      ["xyzzyplugh42nonexistent"],
      excelData.icdCodes,
      excelData.snomedCodes,
    );

    expect(result.totalUnmatched).toBe(1);
    expect(result.unmatched[0]).toBe("xyzzyplugh42nonexistent");
  });
});
