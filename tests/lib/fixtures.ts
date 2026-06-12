/**
 * Shared Playwright test fixtures.
 *
 * Extends the base `test` object with:
 *  - authToken   — a fresh Bearer token (cached per worker)
 *  - excelData   — loaded ICD/SNOMED reference data (loaded once)
 */

import { test as base } from "@playwright/test";
import { getAuthToken } from "./auth";
import { loadAllReferenceData } from "./excel-loader";
import type { ICDEntry, SnomedEntry } from "./excel-loader";
import path from "path";

// ── Custom fixture types ───────────────────────────────────────────────────

interface NurmedFixtures {
  authToken: string;
  excelData: {
    icdCodes: ICDEntry[];
    snomedCodes: SnomedEntry[];
    fileStatus: {
      file: string;
      path: string;
      loaded: boolean;
      entries: number;
    }[];
  };
}

// ── Extended test with fixtures ────────────────────────────────────────────

export const test = base.extend<NurmedFixtures>({
  /**
   * Provides a fresh Supabase access_token (Bearer).
   * Cached per worker — each parallel worker gets its own token.
   */
  authToken: async ({}, use) => {
    const token = await getAuthToken();
    await use(token);
  },

  /**
   * Loads ICD/SNOMED reference data from docs/Data/.
   * Loaded once and reused for all tests in the worker.
   */
  excelData: async ({}, use) => {
    const dataDir = path.resolve(
      __dirname,
      "../../docs/Data",
    );
    const data = loadAllReferenceData(dataDir);
    await use(data);
  },
});

export { expect } from "@playwright/test";
