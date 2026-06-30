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
}

export interface ExecuteApiCheckOptions {
  name: string;
  category: ApiCheckCategory;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  expectedStatuses: number[];
  data?: unknown;
  headers?: Record<string, string>;
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

export class ApiQuickCheckReporter {
  readonly results: ApiCheckResult[] = [];

  add(result: ApiCheckResult) {
    this.results.push(result);
  }

  get failures(): ApiCheckResult[] {
    return this.results.filter((result) => !result.passed);
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
    const passed = this.results.filter((result) => result.passed).length;
    const failed = total - passed;
    const slowest = [...this.results].sort(
      (left, right) => right.durationMs - left.durationMs,
    )[0];

    const lines = [
      "## API Quick Check Summary",
      "",
      `- Total checks: ${total}`,
      `- Passed: ${passed}`,
      `- Failed: ${failed}`,
      slowest
        ? `- Slowest endpoint: ${slowest.method} ${slowest.path} (${slowest.durationMs}ms)`
        : "- Slowest endpoint: n/a",
      "",
      "| Check | Category | Method | Path | Result | Status | Time |",
      "|---|---|---|---|---|---|---|",
      ...this.results.map((result) => {
        const resultLabel = result.passed ? "PASS" : "FAIL";
        const statusLabel = result.status == null ? "n/a" : String(result.status);
        return `| ${result.name} | ${result.category} | ${result.method} | \`${result.path}\` | ${resultLabel} | ${statusLabel} | ${result.durationMs}ms |`;
      }),
      "",
    ];

    if (failed > 0) {
      lines.push("### Failed Checks", "");
      for (const result of this.failures) {
        const reason = result.errorMessage || result.validationNote || "Unexpected response";
        lines.push(`- ${result.name}: ${reason}`);
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
        const lines = [
          `[${result.passed ? "PASS" : "FAIL"}] ${result.name}`,
          `Category: ${result.category}`,
          `Request: ${result.method} ${result.path}`,
          `Expected status: ${result.expectedStatuses.join(", ")}`,
          `Actual status: ${result.status == null ? "n/a" : result.status}`,
          `Duration: ${result.durationMs}ms`,
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
  let response: APIResponse | null = null;
  let body: unknown = null;
  let validationNote: string | undefined;
  let errorMessage: string | undefined;
  let status: number | null = null;
  let passed = false;

  try {
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
    if (hasExpectedStatus && options.validate) {
      validationNote = (await options.validate(body, response)) || undefined;
    }

    passed = hasExpectedStatus;
    if (!hasExpectedStatus) {
      errorMessage = `Expected status ${options.expectedStatuses.join(", ")} but got ${status}`;
    }

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
    });

    return { body, status, passed, response };
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
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
  errorMessage?: string;
}) {
  const statusLabel = entry.status == null ? "n/a" : String(entry.status);
  console.log(`\n[API QUICK CHECK] ${entry.passed ? "PASS" : "FAIL"} - ${entry.name}`);
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

