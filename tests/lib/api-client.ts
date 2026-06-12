/**
 * Typed API client for E2E tests.
 *
 * Wraps the staging API endpoints using plain `fetch()` so tests have
 * zero dependency on the app's Ky client or React context.
 */

import fs from "fs";
import path from "path";

// ── Configuration ──────────────────────────────────────────────────────────

const API_BASE =
  process.env.STG_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://stg-api.nurmed.ai/api/v1";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UploadAudioResponse {
  note_id: string;
}

export interface CreateSessionRequest {
  mrn: string;
  language: string;
  new_note_storage_id: string;
  session_template: string;
  session_duration_seconds: number;
}

export interface CreateSessionResponse {
  session_id?: number;
  id?: number;
  message?: string;
}

export interface SessionStatus {
  id: number;
  status: string;
  mrn: string;
  language: string;
  session_template: string;
  created_at: string;
  session_duration_seconds?: string;
  session_duration_minutes?: string;
}

export interface NoteSection {
  id?: number;
  section_id?: string;
  section_name?: string;
  section_title?: string;
  title?: string;
  content?: string;
  details?: string;
  text?: string;
  sort_order?: number;
}

export interface PollOptions {
  intervalMs?: number;
  maxWaitMs?: number;
  onPoll?: (attempt: number, status: string) => void;
}

// ── Helper ─────────────────────────────────────────────────────────────────

function url(endpoint: string): string {
  const base = API_BASE.replace(/\/+$/, "");
  const ep = endpoint.replace(/^\/+/, "");
  return `${base}/${ep}`;
}

// ── API Client ─────────────────────────────────────────────────────────────

/**
 * Upload an audio file to S3 via the staging API.
 * Returns the `note_id` (storage ID) to use with session creation.
 */
export async function uploadAudio(
  filePath: string,
  token: string,
): Promise<UploadAudioResponse> {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Audio file not found: ${absolutePath}`);
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const fileName = path.basename(absolutePath);

  // Build multipart form data
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "audio/mpeg" });
  formData.append("file", blob, fileName);

  const response = await fetch(url("session/upload-final-note"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Upload audio failed (${response.status}): ${body}`,
    );
  }

  const data = await response.json();

  // The API may return the note_id in various structures
  const noteId =
    data.note_id ||
    data.data?.note_id ||
    data.data?.storage_id ||
    data.storage_id ||
    data.data?.file_id;

  if (!noteId) {
    throw new Error(
      `Upload succeeded but no note_id found in response: ${JSON.stringify(data)}`,
    );
  }

  return { note_id: noteId };
}

/**
 * Create a session with a previously uploaded audio file.
 */
export async function createSession(
  params: CreateSessionRequest,
  token: string,
): Promise<CreateSessionResponse> {
  const response = await fetch(url("session/create"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Create session failed (${response.status}): ${body}`,
    );
  }

  const data = await response.json();

  // Normalize response — session_id might come from different places
  const sessionId =
    data.session_id ||
    data.id ||
    data.data?.session_id ||
    data.data?.id;

  return {
    session_id: sessionId,
    id: sessionId,
    message: data.message || data.data?.message,
  };
}

/**
 * Get a single session by ID.
 */
export async function getSession(
  sessionId: number,
  token: string,
): Promise<SessionStatus> {
  const response = await fetch(url(`session/${sessionId}`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Get session ${sessionId} failed (${response.status}): ${body}`,
    );
  }

  const data = await response.json();
  // API might wrap in data or return directly
  return data.data || data;
}

/**
 * Poll a session until its status is "Completed" (or "Failed").
 *
 * @param sessionId - session to poll
 * @param token     - bearer token
 * @param opts      - polling options
 * @returns final session object + polling attempt count
 */
export async function pollUntilProcessed(
  sessionId: number,
  token: string,
  opts: PollOptions = {},
): Promise<{ session: SessionStatus; attempts: number }> {
  const intervalMs = opts.intervalMs ?? 15_000; // 15 seconds
  const maxWaitMs = opts.maxWaitMs ?? 600_000; // 10 minutes
  const onPoll = opts.onPoll ?? (() => {});

  const deadline = Date.now() + maxWaitMs;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts++;
    const session = await getSession(sessionId, token);
    const status = session.status;

    onPoll(attempts, status);

    if (status === "Completed") {
      return { session, attempts };
    }

    if (status === "Failed") {
      throw new Error(
        `Session ${sessionId} failed after ${attempts} poll(s)`,
      );
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Session ${sessionId} did not complete within ${maxWaitMs / 1000}s (${attempts} attempts)`,
  );
}

/**
 * Get notes for a session.
 */
export async function getNotes(
  sessionId: number,
  token: string,
): Promise<NoteSection[]> {
  const response = await fetch(url(`note/get_notes/${sessionId}`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Get notes for session ${sessionId} failed (${response.status}): ${body}`,
    );
  }

  const data = await response.json();
  // Normalize — might be wrapped in data or be an array directly
  const notes = data.data || data;
  return Array.isArray(notes) ? notes : [];
}

/**
 * Get full formatted notes for a session.
 */
export async function getFullNotes(
  sessionId: number,
  token: string,
): Promise<string> {
  const response = await fetch(
    url(`note/get_full_notes/${sessionId}`),
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Get full notes for session ${sessionId} failed (${response.status}): ${body}`,
    );
  }

  const data = await response.json();
  return data.data || data.full_notes || data.notes || JSON.stringify(data);
}

/**
 * List sessions with pagination.
 */
export async function listSessions(
  token: string,
  params?: { limit?: number; offset?: number },
): Promise<{
  sessions: SessionStatus[];
  pagination: { total_count: number; has_more: boolean };
}> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set("limit", String(params.limit));
  if (params?.offset) queryParams.set("offset", String(params.offset));

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `session/list?${queryString}`
    : "session/list";

  const response = await fetch(url(endpoint), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`List sessions failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const payload = data.data || data;

  return {
    sessions: payload.sessions || [],
    pagination: payload.pagination || {
      total_count: 0,
      has_more: false,
    },
  };
}

/**
 * Pick a random audio file from the testdata/audio/ directory.
 */
export function pickRandomAudio(audioDir: string): string {
  const files = fs
    .readdirSync(audioDir)
    .filter((f) => /\.(mp3|wav|m4a)$/i.test(f));

  if (files.length === 0) {
    throw new Error(`No audio files found in ${audioDir}`);
  }

  const picked = files[Math.floor(Math.random() * files.length)];
  return path.join(audioDir, picked);
}

export { API_BASE };
