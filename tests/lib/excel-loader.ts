/**
 * Excel data loader for ICD / SNOMED reference files.
 *
 * Parses the .xlsx files in docs/Data/ and provides lookup + fuzzy matching
 * so tests can compare AI-extracted terms against the reference datasets.
 */

import XLSX from "xlsx";
import fs from "fs";
import path from "path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ICDEntry {
  code: string;
  description: string;
}

export interface SnomedEntry {
  code: string;
  term: string;
}

export interface MatchResult {
  extractedTerm: string;
  matchedCode: string;
  matchedDescription: string;
  sourceFile: string;
  matchType: "exact_code" | "exact_term" | "partial_term" | "fuzzy";
  confidence: number; // 0-1
}

export interface ValidationResult {
  matched: MatchResult[];
  unmatched: string[];
  totalExtracted: number;
  totalMatched: number;
  totalUnmatched: number;
  accuracy: number; // percentage
}

// ── Loaders ────────────────────────────────────────────────────────────────

/**
 * Load ICD codes from an Excel file.
 * Tries common column names: "Code", "ICD Code", "code", "ICD-10 Code",
 * "Description", "ICD Description", "description", etc.
 */
export function loadICDCodes(filePath: string): ICDEntry[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`ICD file not found: ${filePath}`);
    return [];
  }

  const workbook = XLSX.readFile(filePath);
  const entries: ICDEntry[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    if (rows.length === 0) continue;

    // Auto-detect column names from first row keys
    const keys = Object.keys(rows[0]);
    const codeCol = keys.find((k) =>
      /^(code|icd.?code|icd.?10.?code|diagnosis.?code)$/i.test(k.trim()),
    );
    const descCol = keys.find((k) =>
      /^(description|icd.?description|name|diagnosis|title|long.?description)$/i.test(
        k.trim(),
      ),
    );

    // Fallback: use first two columns
    const codeKey = codeCol || keys[0];
    const descKey = descCol || keys[1] || keys[0];

    for (const row of rows) {
      const code = String(row[codeKey] || "").trim();
      const description = String(row[descKey] || "").trim();
      if (code || description) {
        entries.push({ code, description });
      }
    }
  }

  return entries;
}

/**
 * Load SNOMED codes from an Excel file.
 * Tries common column names: "SNOMED CT Code", "Code", "Concept ID",
 * "Term", "Fully Specified Name", "Description", etc.
 */
export function loadSnomedCodes(filePath: string): SnomedEntry[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`SNOMED file not found: ${filePath}`);
    return [];
  }

  const workbook = XLSX.readFile(filePath);
  const entries: SnomedEntry[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    if (rows.length === 0) continue;

    const keys = Object.keys(rows[0]);
    const codeCol = keys.find((k) =>
      /^(code|snomed.?ct?.?code|concept.?id|snomed.?id|id)$/i.test(
        k.trim(),
      ),
    );
    const termCol = keys.find((k) =>
      /^(term|description|fully.?specified.?name|fsn|name|preferred.?term|title)$/i.test(
        k.trim(),
      ),
    );

    const codeKey = codeCol || keys[0];
    const termKey = termCol || keys[1] || keys[0];

    for (const row of rows) {
      const code = String(row[codeKey] || "").trim();
      const term = String(row[termKey] || "").trim();
      if (code || term) {
        entries.push({ code, term });
      }
    }
  }

  return entries;
}

/**
 * Load all reference datasets from the docs/Data/ directory.
 */
export function loadAllReferenceData(dataDir: string): {
  icdCodes: ICDEntry[];
  snomedCodes: SnomedEntry[];
  fileStatus: { file: string; path: string; loaded: boolean; entries: number }[];
} {
  const files = {
    icd: path.join(dataDir, "ICD Codes.xlsx"),
    snomed1: path.join(dataDir, "Snomed Data 1.xlsx"),
    snomed2: path.join(dataDir, "Snowmed Data 2.xlsx"),
  };

  const icdCodes = loadICDCodes(files.icd);
  const snomed1 = loadSnomedCodes(files.snomed1);
  const snomed2 = loadSnomedCodes(files.snomed2);
  const snomedCodes = [...snomed1, ...snomed2];

  const fileStatus = [
    {
      file: "ICD Codes.xlsx",
      path: files.icd,
      loaded: icdCodes.length > 0,
      entries: icdCodes.length,
    },
    {
      file: "Snomed Data 1.xlsx",
      path: files.snomed1,
      loaded: snomed1.length > 0,
      entries: snomed1.length,
    },
    {
      file: "Snowmed Data 2.xlsx",
      path: files.snomed2,
      loaded: snomed2.length > 0,
      entries: snomed2.length,
    },
  ];

  return { icdCodes, snomedCodes, fileStatus };
}

// ── Matching ───────────────────────────────────────────────────────────────

/**
 * Normalize a string for fuzzy matching: lowercase, remove punctuation,
 * collapse whitespace.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match extracted clinical terms against the ICD + SNOMED reference datasets.
 */
export function matchExtractedTerms(
  extractedTerms: string[],
  icdCodes: ICDEntry[],
  snomedCodes: SnomedEntry[],
): ValidationResult {
  const matched: MatchResult[] = [];
  const unmatched: string[] = [];

  for (const rawTerm of extractedTerms) {
    const term = rawTerm.trim();
    if (!term || term === "(empty)") continue;

    const normTerm = normalize(term);
    let bestMatch: MatchResult | null = null;

    // 1. Exact code match against ICD
    for (const icd of icdCodes) {
      if (normalize(icd.code) === normTerm) {
        bestMatch = {
          extractedTerm: term,
          matchedCode: icd.code,
          matchedDescription: icd.description,
          sourceFile: "ICD Codes.xlsx",
          matchType: "exact_code",
          confidence: 1.0,
        };
        break;
      }
    }

    // 2. Exact code match against SNOMED
    if (!bestMatch) {
      for (const sn of snomedCodes) {
        if (normalize(sn.code) === normTerm) {
          bestMatch = {
            extractedTerm: term,
            matchedCode: sn.code,
            matchedDescription: sn.term,
            sourceFile: "Snomed Data",
            matchType: "exact_code",
            confidence: 1.0,
          };
          break;
        }
      }
    }

    // 3. Exact term match against ICD descriptions
    if (!bestMatch) {
      for (const icd of icdCodes) {
        if (normalize(icd.description) === normTerm) {
          bestMatch = {
            extractedTerm: term,
            matchedCode: icd.code,
            matchedDescription: icd.description,
            sourceFile: "ICD Codes.xlsx",
            matchType: "exact_term",
            confidence: 1.0,
          };
          break;
        }
      }
    }

    // 4. Exact term match against SNOMED terms
    if (!bestMatch) {
      for (const sn of snomedCodes) {
        if (normalize(sn.term) === normTerm) {
          bestMatch = {
            extractedTerm: term,
            matchedCode: sn.code,
            matchedDescription: sn.term,
            sourceFile: "Snomed Data",
            matchType: "exact_term",
            confidence: 1.0,
          };
          break;
        }
      }
    }

    // 5. Partial (substring) match — ICD descriptions contain the term
    if (!bestMatch) {
      for (const icd of icdCodes) {
        const normDesc = normalize(icd.description);
        if (!normDesc) continue;
        if (
          normDesc.includes(normTerm) ||
          normTerm.includes(normDesc)
        ) {
          bestMatch = {
            extractedTerm: term,
            matchedCode: icd.code,
            matchedDescription: icd.description,
            sourceFile: "ICD Codes.xlsx",
            matchType: "partial_term",
            confidence: 0.7,
          };
          break;
        }
      }
    }

    // 6. Partial (substring) match — SNOMED terms
    if (!bestMatch) {
      for (const sn of snomedCodes) {
        const normSn = normalize(sn.term);
        if (!normSn) continue;
        if (normSn.includes(normTerm) || normTerm.includes(normSn)) {
          bestMatch = {
            extractedTerm: term,
            matchedCode: sn.code,
            matchedDescription: sn.term,
            sourceFile: "Snomed Data",
            matchType: "partial_term",
            confidence: 0.7,
          };
          break;
        }
      }
    }

    // 7. Fuzzy: check if any individual word from the term appears in the dataset
    if (!bestMatch) {
      const words = normTerm.split(" ").filter((w) => w.length > 3);
      for (const word of words) {
        // Check ICD
        for (const icd of icdCodes) {
          if (normalize(icd.description).includes(word)) {
            bestMatch = {
              extractedTerm: term,
              matchedCode: icd.code,
              matchedDescription: icd.description,
              sourceFile: "ICD Codes.xlsx",
              matchType: "fuzzy",
              confidence: 0.4,
            };
            break;
          }
        }
        if (bestMatch) break;

        // Check SNOMED
        for (const sn of snomedCodes) {
          if (normalize(sn.term).includes(word)) {
            bestMatch = {
              extractedTerm: term,
              matchedCode: sn.code,
              matchedDescription: sn.term,
              sourceFile: "Snomed Data",
              matchType: "fuzzy",
              confidence: 0.4,
            };
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    if (bestMatch) {
      matched.push(bestMatch);
    } else {
      unmatched.push(term);
    }
  }

  const totalExtracted = extractedTerms.filter(
    (t) => t.trim() && t.trim() !== "(empty)",
  ).length;

  return {
    matched,
    unmatched,
    totalExtracted,
    totalMatched: matched.length,
    totalUnmatched: unmatched.length,
    accuracy:
      totalExtracted > 0
        ? Math.round((matched.length / totalExtracted) * 100)
        : 0,
  };
}

/**
 * Extract clinical terms from a note section's text content.
 * Splits by newlines, list markers (•, -, *), and numbered items.
 */
export function extractTermsFromText(text: string): string[] {
  if (!text || text === "(empty)") return [];

  return text
    .split(/[\n\r]+/)
    .map((line) => line.replace(/^[\s•\-\*\d.]+/, "").trim())
    .filter((line) => line.length > 0 && line !== "(empty)");
}
