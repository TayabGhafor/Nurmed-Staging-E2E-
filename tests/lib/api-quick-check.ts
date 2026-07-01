import fs from "fs";
import path from "path";
import type { APIRequestContext, APIResponse } from "@playwright/test";

export type ApiCheckCategory =
  | "auth"
  | "discovery"
  | "session"
  | "notes"
  | "admin"
  | "feature-flags"
  | "template"
  | "location"
  | "scribe"
  | "rpa";

export interface ApiCheckResult {
  name: string;
  category: ApiCheckCategory;
  method: string;
  path: string;
  expectedStatuses: number[];
  status: number | null;
  durationMs: number;
  passed: boolean;
  requestPreview: string;
  responsePreview: string;
  validationNote?: string;
  errorMessage?: string;
  timestamp: string;
  blocking: boolean;
  outcome: "pass" | "warn" | "fail";
}

export interface ExecuteApiCheckOptions {
  name: string;
  category: ApiCheckCategory;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  expectedStatuses: number[];
  data?: unknown;
  headers?: Record<string, string>;
  blocking?: boolean;
  validate?: (
    body: unknown,
    response: APIResponse,
  ) => string | void | Promise<string | void>;
}

export interface ExecuteApiCheckResult {
  body: unknown;
  status: number;
  passed: boolean;
  response: APIResponse;
}

function truncate(value: string, limit = 2500): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n... [truncated ${value.length - limit} chars]`;
}

function safeStringify(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryParseBody(raw: string, response: APIResponse): unknown {
  const contentType = response.headers()["content-type"] ?? "";
  if (!raw) return null;
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// #region debug-point A:debug-server-reporting
function reportDebugEvent(
  hypothesisId: string,
  location: string,
  msg: string,
  data: Record<string, unknown>,
) {
  let debugServerUrl = "http://127.0.0.1:7777/event";
  let debugSessionId = "api-quick-check-404";
  try {
    const envPath = path.resolve(process.cwd(), ".dbg/api-quick-check-404.env");
    const envFile = fs.readFileSync(envPath, "utf-8");
    debugServerUrl =
      envFile.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId =
      envFile.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {}

  fetch(debugServerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: process.env.DEBUG_RUN_ID || "pre-fix",
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

export class ApiQuickCheckReporter {
  readonly results: ApiCheckResult[] = [];

  add(result: ApiCheckResult) {
    this.results.push(result);
  }

  get failures(): ApiCheckResult[] {
    return this.results.filter(
      (result) => result.outcome === "fail" && result.blocking,
    );
  }

  get warnings(): ApiCheckResult[] {
    return this.results.filter(
      (result) => result.outcome === "warn" && !result.blocking,
    );
  }

  async writeArtifacts(outputDir: string): Promise<void> {
    fs.mkdirSync(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, "api-health.json");
    const mdPath = path.join(outputDir, "api-health.md");
    const htmlPath = path.join(outputDir, "api-health.html");
    const logPath = path.join(outputDir, "api-response-log.txt");

    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2), "utf-8");
    fs.writeFileSync(mdPath, this.toMarkdown(), "utf-8");
    fs.writeFileSync(htmlPath, this.toHtml(), "utf-8");
    fs.writeFileSync(logPath, this.toLogText(), "utf-8");
  }

  private toMarkdown(): string {
    const total = this.results.length;
    const passed = this.results.filter((result) => result.outcome === "pass").length;
    const warnings = this.warnings.length;
    const failed = this.failures.length;
    const slowest = [...this.results].sort(
      (left, right) => right.durationMs - left.durationMs,
    )[0];

    const lines = [
      "## API Quick Check Summary",
      "",
      `- Total checks: ${total}`,
      `- Passed: ${passed}`,
      `- Warnings: ${warnings}`,
      `- Failed: ${failed}`,
      slowest
        ? `- Slowest endpoint: ${slowest.method} ${slowest.path} (${slowest.durationMs}ms)`
        : "- Slowest endpoint: n/a",
      "",
      "| Check | Category | Method | Path | Result | Status | Time |",
      "|---|---|---|---|---|---|---|",
      ...this.results.map((result) => {
        const resultLabel =
          result.outcome === "pass"
            ? "PASS"
            : result.outcome === "warn"
              ? "WARN"
              : "FAIL";
        const statusLabel = result.status == null ? "n/a" : String(result.status);
        return `| ${result.name} | ${result.category} | ${result.method} | \`${result.path}\` | ${resultLabel} | ${statusLabel} | ${result.durationMs}ms |`;
      }),
      "",
    ];

    if (warnings > 0) {
      lines.push("### Warning Checks", "");
      for (const result of this.warnings) {
        const reason =
          result.errorMessage || result.validationNote || "Unexpected response";
        const responseLine = result.responsePreview
          ? ` | response=${truncate(result.responsePreview.replace(/\s+/g, " "), 240)}`
          : "";
        lines.push(
          `- ${result.name}: status=${result.status == null ? "n/a" : result.status} | ${reason}${responseLine}`,
        );
      }
      lines.push("");
    }

    if (failed > 0) {
      lines.push("### Failed Checks", "");
      for (const result of this.failures) {
        const reason = result.errorMessage || result.validationNote || "Unexpected response";
        const responseLine = result.responsePreview
          ? ` | response=${truncate(result.responsePreview.replace(/\s+/g, " "), 240)}`
          : "";
        lines.push(
          `- ${result.name}: status=${result.status == null ? "n/a" : result.status} | ${reason}${responseLine}`,
        );
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  private toHtml(): string {
    const rows = this.results
      .map((result) => {
        const resultLabel = result.passed ? "PASS" : "FAIL";
        const resultClass = result.passed ? "pass" : "fail";
        return `<tr>
  <td>${escapeHtml(result.name)}</td>
  <td>${escapeHtml(result.category)}</td>
  <td>${escapeHtml(result.method)}</td>
  <td><code>${escapeHtml(result.path)}</code></td>
  <td class="${resultClass}">${resultLabel}</td>
  <td>${result.status == null ? "n/a" : result.status}</td>
  <td>${result.durationMs}ms</td>
  <td>${escapeHtml(result.validationNote || result.errorMessage || "")}</td>
  <td><pre>${escapeHtml(result.requestPreview)}</pre></td>
  <td><pre>${escapeHtml(result.responsePreview)}</pre></td>
</tr>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>API Quick Check Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #f3f4f6; }
    .pass { color: #166534; font-weight: 700; }
    .fail { color: #991b1b; font-weight: 700; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
    code { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>API Quick Check Report</h1>
  <table>
    <thead>
      <tr>
        <th>Check</th>
        <th>Category</th>
        <th>Method</th>
        <th>Path</th>
        <th>Result</th>
        <th>Status</th>
        <th>Time</th>
        <th>Note</th>
        <th>Request</th>
        <th>Response</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;
  }

  private toLogText(): string {
    return this.results
      .map((result) => {
        const resultLabel =
          result.outcome === "pass"
            ? "PASS"
            : result.outcome === "warn"
              ? "WARN"
              : "FAIL";
        const lines = [
          `[${resultLabel}] ${result.name}`,
          `Category: ${result.category}`,
          `Request: ${result.method} ${result.path}`,
          `Expected status: ${result.expectedStatuses.join(", ")}`,
          `Actual status: ${result.status == null ? "n/a" : result.status}`,
          `Duration: ${result.durationMs}ms`,
          `Blocking: ${result.blocking ? "yes" : "no"}`,
        ];

        if (result.validationNote) {
          lines.push(`Note: ${result.validationNote}`);
        }
        if (result.errorMessage) {
          lines.push(`Error: ${result.errorMessage}`);
        }

        lines.push("Request payload:");
        lines.push(result.requestPreview || "(empty)");
        lines.push("Response body:");
        lines.push(result.responsePreview || "(empty)");

        return lines.join("\n");
      })
      .join("\n\n----------------------------------------\n\n");
  }
}

export async function executeApiCheck(
  api: APIRequestContext,
  reporter: ApiQuickCheckReporter,
  options: ExecuteApiCheckOptions,
): Promise<ExecuteApiCheckResult> {
  const requestPreview = truncate(safeStringify(options.data));
  const startedAt = Date.now();
  const blocking = options.blocking ?? true;
  let response: APIResponse | null = null;
  let body: unknown = null;
  let validationNote: string | undefined;
  let errorMessage: string | undefined;
  let status: number | null = null;
  let passed = false;

  try {
    // #region debug-point A:request-input
    reportDebugEvent(
      "A",
      "tests/lib/api-quick-check.ts:executeApiCheck:request",
      "[DEBUG] About to execute API quick check request",
      {
        method: options.method,
        path: options.path,
        expectedStatuses: options.expectedStatuses,
        hasPayload: options.data != null,
      },
    );
    // #endregion
    response = await api.fetch(options.path, {
      method: options.method,
      data: options.data,
      headers: options.headers,
      failOnStatusCode: false,
    });

    status = response.status();
    const rawBody = await response.text();
    body = tryParseBody(rawBody, response);

    const hasExpectedStatus = options.expectedStatuses.includes(status);
    let validationError: string | undefined;
    if (hasExpectedStatus && options.validate) {
      try {
        validationNote = (await options.validate(body, response)) || undefined;
      } catch (error) {
        validationError =
          error instanceof Error ? error.message : String(error);
      }
    }

    passed = hasExpectedStatus && !validationError;
    if (validationError) {
      errorMessage = validationError;
    } else if (!hasExpectedStatus) {
      errorMessage = `Expected status ${options.expectedStatuses.join(", ")} but got ${status}`;
    }

    // #region debug-point B:response-shape
    reportDebugEvent(
      "B",
      "tests/lib/api-quick-check.ts:executeApiCheck:response",
      "[DEBUG] API quick check response received",
      {
        method: options.method,
        path: options.path,
        responseUrl: response.url(),
        status,
        passed: hasExpectedStatus,
        responsePreview: truncate(safeStringify(body), 800),
      },
    );
    // #endregion

    reporter.add({
      name: options.name,
      category: options.category,
      method: options.method,
      path: options.path,
      expectedStatuses: options.expectedStatuses,
      status,
      durationMs: Date.now() - startedAt,
      passed,
      requestPreview,
      responsePreview: truncate(safeStringify(body)),
      validationNote,
      errorMessage,
      timestamp: new Date().toISOString(),
      blocking,
      outcome: passed ? "pass" : blocking ? "fail" : "warn",
    });

    logApiExchange({
      name: options.name,
      method: options.method,
      path: options.path,
      status,
      durationMs: Date.now() - startedAt,
      requestPreview,
      responsePreview: truncate(safeStringify(body)),
      passed,
      blocking,
    });

    return { body, status, passed, response };
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    // #region debug-point C:error-path
    reportDebugEvent(
      "C",
      "tests/lib/api-quick-check.ts:executeApiCheck:error",
      "[DEBUG] API quick check threw before result handling",
      {
        method: options.method,
        path: options.path,
        errorMessage,
      },
    );
    // #endregion
    reporter.add({
      name: options.name,
      category: options.category,
      method: options.method,
      path: options.path,
      expectedStatuses: options.expectedStatuses,
      status,
      durationMs: Date.now() - startedAt,
      passed: false,
      requestPreview,
      responsePreview: "",
      errorMessage,
      timestamp: new Date().toISOString(),
      blocking,
      outcome: blocking ? "fail" : "warn",
    });

    logApiExchange({
      name: options.name,
      method: options.method,
      path: options.path,
      status,
      durationMs: Date.now() - startedAt,
      requestPreview,
      responsePreview: "",
      passed: false,
      blocking,
      errorMessage,
    });

    return { body: null, status: status ?? 0, passed: false, response: response as APIResponse };
  }
}

function logApiExchange(entry: {
  name: string;
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  requestPreview: string;
  responsePreview: string;
  passed: boolean;
  blocking: boolean;
  errorMessage?: string;
}) {
  const statusLabel = entry.status == null ? "n/a" : String(entry.status);
  const resultLabel = entry.passed ? "PASS" : entry.blocking ? "FAIL" : "WARN";
  console.log(`\n[API QUICK CHECK] ${resultLabel} - ${entry.name}`);
  console.log(`[API QUICK CHECK] Request: ${entry.method} ${entry.path}`);
  console.log(`[API QUICK CHECK] Status: ${statusLabel} (${entry.durationMs}ms)`);
  if (entry.requestPreview) {
    console.log(`[API QUICK CHECK] Request payload:\n${entry.requestPreview}`);
  }
  if (entry.responsePreview) {
    console.log(`[API QUICK CHECK] Response body:\n${entry.responsePreview}`);
  }
  if (entry.errorMessage) {
    console.log(`[API QUICK CHECK] Error: ${entry.errorMessage}`);
  }
}

export function getNestedValue<T = unknown>(
  input: unknown,
  paths: string[],
): T | null {
  for (const currentPath of paths) {
    const segments = currentPath.split(".");
    let cursor: any = input;
    let resolved = true;
    for (const segment of segments) {
      if (cursor == null || !(segment in cursor)) {
        resolved = false;
        break;
      }
      cursor = cursor[segment];
    }
    if (resolved && cursor != null) {
      return cursor as T;
    }
  }
  return null;
}

export function getNestedArray(input: unknown, paths: string[]): unknown[] {
  const value = getNestedValue<unknown>(input, paths);
  return Array.isArray(value) ? value : [];
}
