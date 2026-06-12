/**
 * HTML report writer for session validation results.
 *
 * Generates per-session HTML reports matching the Session-02.html template,
 * plus an index.html linking all reports.
 */

import fs from "fs";
import path from "path";
import type { MatchResult, ValidationResult } from "./excel-loader";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SessionReportData {
  sessionName: string;
  sessionId: number;
  mrn: string;
  template: string;
  audioFile: string;
  audioFolder: string;
  finalStatus: string;
  pollingAttempts: number;

  // Validation
  validation: ValidationResult;

  // Reference datasets
  fileStatus: {
    file: string;
    path: string;
    loaded: boolean;
    entries: number;
  }[];

  // Extracted clinical sections
  clinicalSections: {
    name: string;
    text: string;
    matches: MatchResult[];
    unmatched: string[];
  }[];
}

export interface ReportSummary {
  sessionName: string;
  fileName: string;
  status: "PASSED" | "FAILED";
  accuracy: number;
  totalExtracted: number;
  totalMatched: number;
  timestamp: string;
}

// ── Report Writer ──────────────────────────────────────────────────────────

/**
 * Write a single session report as HTML.
 */
export function writeSessionReport(
  data: SessionReportData,
  outputDir: string,
): string {
  const fileName = `${data.sessionName.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
  const filePath = path.join(outputDir, fileName);

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const passed =
    data.finalStatus === "Completed" && data.validation.totalExtracted > 0;
  const statusClass = passed ? "pass" : "fail";
  const statusText = passed ? "Validation PASSED" : "Validation FAILED";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(data.sessionName)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
    .nav { margin-bottom: 20px; }
    .nav a { color: #2563eb; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(240px, 1fr)); gap: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #f9fafb; }
    .field-card, .clinical-block { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .clinical-text { white-space: pre-wrap; background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 14px; }
    table.datasets { width: 100%; border-collapse: collapse; margin-top: 12px; }
    table.datasets th, table.datasets td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
    table.datasets th { background: #f9fafb; }
    table.matches { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    table.matches th, table.matches td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
    table.matches th { background: #f0fdf4; }
    table.matches tr.unmatched td { background: #fef2f2; }
    h1, h2, h3 { margin-top: 0; }
    .pass { color: #16a34a; }
    .fail { color: #dc2626; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-exact { background: #dcfce7; color: #166534; }
    .badge-partial { background: #fef9c3; color: #854d0e; }
    .badge-fuzzy { background: #fee2e2; color: #991b1b; }
    .timestamp { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <p class="nav"><a href="index.html">← All reports</a></p>
  <h1>${esc(data.sessionName)}</h1>
  <p class="timestamp">Generated: ${new Date().toISOString()}</p>
  
  <div class="summary">
    ${summaryCard("Session name", data.sessionName)}
    ${summaryCard("Session ID", String(data.sessionId))}
    ${summaryCard("MRN", data.mrn)}
    ${summaryCard("Template", data.template)}
    ${summaryCard("Audio File (random)", data.audioFile)}
    ${summaryCard("Audio Folder", `<code>${esc(data.audioFolder)}</code>`)}
    ${summaryCard("Final Status", data.finalStatus)}
    ${summaryCard("Polling Attempts", String(data.pollingAttempts))}
    ${summaryCard("Total Extracted", String(data.validation.totalExtracted))}
    ${summaryCard("Total Matched", String(data.validation.totalMatched))}
    ${summaryCard("Total Unmatched", String(data.validation.totalUnmatched))}
    ${summaryCard("Overall Accuracy", `${data.validation.accuracy}%`)}
  </div>

  <h2 class="${statusClass}">${statusText}</h2>
  ${
    !passed && data.finalStatus !== "Completed"
      ? `<p><em>Session did not complete processing (status: ${esc(data.finalStatus)})</em></p>`
      : ""
  }

  <h2>Reference datasets (docs/Data)</h2>
  <table class="datasets">
    <thead><tr><th>File</th><th>Path</th><th>Status</th><th>Entries used</th></tr></thead>
    <tbody>
      ${data.fileStatus
        .map(
          (f) =>
            `<tr>
          <td>${esc(f.file)}</td>
          <td><code>${esc(f.path)}</code></td>
          <td class="${f.loaded ? "pass" : "fail"}">${f.loaded ? "✅ Loaded" : "❌ Missing"}</td>
          <td>${f.entries}</td>
        </tr>`,
        )
        .join("\n      ")}
    </tbody>
  </table>

  <h2>Clinical text extracted from session</h2>
  ${data.clinicalSections
    .map(
      (section) => `
      <section class="clinical-block">
        <h3>${esc(section.name)} — extracted from session</h3>
        <pre class="clinical-text">${esc(section.text || "(empty)")}</pre>
      </section>`,
    )
    .join("\n")}

  <h2>SNOMED / ICD matching by field</h2>
  ${
    data.clinicalSections.some((s) => s.matches.length > 0 || s.unmatched.length > 0)
      ? data.clinicalSections
          .map(
            (section) => `
    <section class="field-card">
      <h3>${esc(section.name)}</h3>
      ${
        section.matches.length > 0 || section.unmatched.length > 0
          ? `<table class="matches">
        <thead>
          <tr>
            <th>Extracted Term</th>
            <th>Matched Code</th>
            <th>Description</th>
            <th>Source</th>
            <th>Match Type</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          ${section.matches
            .map(
              (m) => `<tr>
            <td>${esc(m.extractedTerm)}</td>
            <td><strong>${esc(m.matchedCode)}</strong></td>
            <td>${esc(m.matchedDescription)}</td>
            <td>${esc(m.sourceFile)}</td>
            <td><span class="badge ${badgeClass(m.matchType)}">${esc(m.matchType)}</span></td>
            <td>${Math.round(m.confidence * 100)}%</td>
          </tr>`,
            )
            .join("\n          ")}
          ${section.unmatched
            .map(
              (u) => `<tr class="unmatched">
            <td>${esc(u)}</td>
            <td colspan="5"><em>No match found</em></td>
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>`
          : `<p><em>No terms extracted from this section.</em></p>`
      }
    </section>`,
          )
          .join("\n")
      : `<p><em>No field-level validation (run did not reach clinical extraction).</em></p>`
  }

</body>
</html>`;

  fs.writeFileSync(filePath, html, "utf-8");
  return fileName;
}

/**
 * Write (or regenerate) the index.html page that links to all session reports.
 */
export function writeIndexPage(
  reports: ReportSummary[],
  outputDir: string,
): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NurMed E2E Test Reports</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    a { color: #2563eb; }
    .pass { color: #16a34a; font-weight: 600; }
    .fail { color: #dc2626; font-weight: 600; }
    h1 { color: #1f2937; }
    .meta { color: #6b7280; font-size: 13px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>🏥 NurMed E2E Test Reports</h1>
  <p class="meta">Total reports: ${reports.length} | Last updated: ${new Date().toISOString()}</p>
  
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Session</th>
        <th>Status</th>
        <th>Accuracy</th>
        <th>Extracted</th>
        <th>Matched</th>
        <th>Timestamp</th>
      </tr>
    </thead>
    <tbody>
      ${reports
        .map(
          (r, i) => `<tr>
        <td>${i + 1}</td>
        <td><a href="${esc(r.fileName)}">${esc(r.sessionName)}</a></td>
        <td class="${r.status === "PASSED" ? "pass" : "fail"}">${r.status}</td>
        <td>${r.accuracy}%</td>
        <td>${r.totalExtracted}</td>
        <td>${r.totalMatched}</td>
        <td>${esc(r.timestamp)}</td>
      </tr>`,
        )
        .join("\n      ")}
    </tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "index.html"), html, "utf-8");
}

/**
 * Load existing report summaries from the output directory (reads previously
 * generated index.html data). Falls back to empty array if none exist.
 */
export function loadExistingReports(outputDir: string): ReportSummary[] {
  const summaryPath = path.join(outputDir, "reports.json");
  if (fs.existsSync(summaryPath)) {
    try {
      return JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Save report summaries to a JSON file alongside the HTML reports.
 */
export function saveReportSummaries(
  reports: ReportSummary[],
  outputDir: string,
): void {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "reports.json"),
    JSON.stringify(reports, null, 2),
    "utf-8",
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function summaryCard(label: string, value: string): string {
  return `<div class="card"><strong>${esc(label)}</strong><div>${value}</div></div>`;
}

function badgeClass(matchType: string): string {
  if (matchType.startsWith("exact")) return "badge-exact";
  if (matchType === "partial_term") return "badge-partial";
  return "badge-fuzzy";
}
