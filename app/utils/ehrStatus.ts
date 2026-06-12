/**
 * Parses `ehr_status` from the session API — may be a JSON object or one or more
 * layers of JSON-encoded strings, e.g.
 * `"{\"status_code\": 200, \"status\": \"success\", \"reason\": \"...\"}"`
 */
function parseJsonObjectLoose(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  let v: unknown = raw;
  for (let i = 0; i < 3; i++) {
    if (typeof v === "string") {
      try {
        v = JSON.parse(v);
      } catch {
        return null;
      }
    } else {
      break;
    }
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/**
 * Legacy session shape after refresh: `ehr_status` encodes success with
 * `status_code` 200 and `status` "success".
 */
export function isEhrScribeSendLocked(ehrStatus: unknown): boolean {
  const obj = parseJsonObjectLoose(ehrStatus);
  if (!obj) return false;
  const code = obj.status_code;
  const status = obj.status;
  return (
    code === 200 &&
    typeof status === "string" &&
    status.toLowerCase() === "success"
  );
}

/**
 * After send-to-EHR / session load with the newer shape: `ehr_status: 200` and
 * `ehr_response.scribe_job_queued: true`. Used for immediate UI lock right after POST.
 */
export function isScribeJobQueuedLocked(
  source: {
    ehr_status?: unknown;
    ehr_response?: unknown;
  } | null | undefined,
): boolean {
  if (!source) return false;
  const status = source.ehr_status;
  const codeOk =
    status === 200 || status === "200" || Number(status) === 200;
  if (!codeOk) return false;
  const resp = source.ehr_response;
  if (resp == null || typeof resp !== "object" || Array.isArray(resp)) {
    return false;
  }
  return (resp as { scribe_job_queued?: boolean }).scribe_job_queued === true;
}

/**
 * Lock send / edits if either the legacy session `ehr_status` says success, or the
 * newer queued-scribe response is present (including optimistic patch after send).
 */
export function isEhrOrScribeSendLocked(
  session: { ehr_status?: unknown; ehr_response?: unknown } | null | undefined,
): boolean {
  if (!session) return false;
  return (
    isEhrScribeSendLocked(session.ehr_status) || isScribeJobQueuedLocked(session)
  );
}
