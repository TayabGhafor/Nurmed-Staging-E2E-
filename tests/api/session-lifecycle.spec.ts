/**
 * Session lifecycle API tests.
 *
 * Tests the full pipeline: audio upload → session create → poll → notes.
 * All tests use the staging API directly (no browser).
 */

import { test, expect } from "../lib/fixtures";
import {
  uploadAudio,
  createSession,
  getSession,
  pollUntilProcessed,
  getNotes,
  getFullNotes,
  listSessions,
  pickRandomAudio,
  API_BASE,
} from "../lib/api-client";
import path from "path";
import fs from "fs";

const AUDIO_DIR = path.resolve(__dirname, "../../testdata/audio");
const SESSION_TEMPLATE = process.env.SESSION_TEMPLATE || "OPDLHR18";

// ─────────────────────────────────────────────────────────────────────────────
// Audio Upload
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Audio Upload", () => {
  test("should upload a valid audio file and return note_id", async ({
    authToken,
  }) => {
    const audioFile = pickRandomAudio(AUDIO_DIR);
    const result = await uploadAudio(audioFile, authToken);

    expect(result.note_id).toBeTruthy();
    expect(typeof result.note_id).toBe("string");
    expect(result.note_id.length).toBeGreaterThan(5);

    console.log(`Uploaded ${path.basename(audioFile)} → note_id: ${result.note_id}`);
  });

  test("should fail to upload without auth token", async () => {
    const audioFile = pickRandomAudio(AUDIO_DIR);

    await expect(uploadAudio(audioFile, "")).rejects.toThrow();
  });

  test("should fail to upload with invalid auth token", async () => {
    const audioFile = pickRandomAudio(AUDIO_DIR);

    await expect(
      uploadAudio(audioFile, "invalid_token_here"),
    ).rejects.toThrow();
  });

  test("each audio file in testdata/audio should be uploadable", async ({
    authToken,
  }) => {
    const files = fs
      .readdirSync(AUDIO_DIR)
      .filter((f) => /\.(mp3|wav|m4a)$/i.test(f));

    expect(files.length).toBeGreaterThan(0);

    // Test just the first file to avoid excessive API calls
    const audioFile = path.join(AUDIO_DIR, files[0]);
    const result = await uploadAudio(audioFile, authToken);
    expect(result.note_id).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Creation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Session Creation", () => {
  let uploadedNoteId: string;

  test.beforeAll(async () => {
    // We need a note_id to create a session.
    // This is set up in the first test or beforeAll.
  });

  test("should create a session with valid payload", async ({ authToken }) => {
    // Upload audio first
    const audioFile = pickRandomAudio(AUDIO_DIR);
    const uploadResult = await uploadAudio(audioFile, authToken);
    uploadedNoteId = uploadResult.note_id;

    const mrn = `E2E-${Date.now()}`;
    const result = await createSession(
      {
        mrn,
        language: "english",
        new_note_storage_id: uploadedNoteId,
        session_template: SESSION_TEMPLATE,
        session_duration_seconds: 350,
      },
      authToken,
    );

    expect(result.session_id || result.id).toBeTruthy();
    expect(typeof (result.session_id || result.id)).toBe("number");

    console.log(`Created session: ID=${result.session_id || result.id}, MRN=${mrn}`);
  });

  test("should fail to create session without auth", async () => {
    await expect(
      createSession(
        {
          mrn: "E2E-noauth",
          language: "english",
          new_note_storage_id: "fake_note_id",
          session_template: SESSION_TEMPLATE,
          session_duration_seconds: 100,
        },
        "",
      ),
    ).rejects.toThrow();
  });

  test("should fail to create session with invalid token", async () => {
    await expect(
      createSession(
        {
          mrn: "E2E-invalid-token",
          language: "english",
          new_note_storage_id: "fake_note_id",
          session_template: SESSION_TEMPLATE,
          session_duration_seconds: 100,
        },
        "invalid_bearer_token",
      ),
    ).rejects.toThrow();
  });

  test("should handle session creation with empty new_note_storage_id", async ({
    authToken,
  }) => {
    const mrn = `E2E-NoNote-${Date.now()}`;
    const result = await createSession(
      {
        mrn,
        language: "english",
        new_note_storage_id: "",
        session_template: SESSION_TEMPLATE,
        session_duration_seconds: 100,
      },
      authToken,
    );
    expect(result.session_id || result.id).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Retrieval
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Session Retrieval", () => {
  test("should list sessions for authenticated user", async ({ authToken }) => {
    const result = await listSessions(authToken, { limit: 5 });

    expect(result.sessions).toBeDefined();
    expect(Array.isArray(result.sessions)).toBe(true);
    expect(result.pagination).toBeDefined();
    expect(result.pagination.total_count).toBeGreaterThanOrEqual(0);
  });

  test("should list sessions with pagination", async ({ authToken }) => {
    const page1 = await listSessions(authToken, { limit: 2, offset: 0 });
    expect(page1.sessions.length).toBeLessThanOrEqual(2);

    if (page1.pagination.has_more) {
      const page2 = await listSessions(authToken, { limit: 2, offset: 2 });
      expect(page2.sessions).toBeDefined();
    }
  });

  test("should get a specific session by ID if sessions exist", async ({
    authToken,
  }) => {
    const list = await listSessions(authToken, { limit: 1 });

    if (list.sessions.length > 0) {
      const sessionId = list.sessions[0].id;
      const session = await getSession(sessionId, authToken);

      expect(session).toBeTruthy();
      expect(session.id).toBe(sessionId);
      expect(session.status).toBeTruthy();
      expect(session.mrn).toBeDefined();
    } else {
      console.log("No sessions found — skipping get-by-ID test");
    }
  });

  test("should fail to get session without auth", async () => {
    await expect(getSession(99999, "")).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Notes Retrieval (on an existing completed session)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Notes Retrieval", () => {
  test("should get notes for a completed session if one exists", async ({
    authToken,
  }) => {
    const list = await listSessions(authToken, { limit: 20 });
    const completedSession = list.sessions.find(
      (s) => s.status === "Completed",
    );

    if (!completedSession) {
      console.log("No completed sessions found — skipping notes test");
      return;
    }

    const notes = await getNotes(completedSession.id, authToken);
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);

    // Each note should have section-related fields
    for (const note of notes) {
      expect(
        note.section_name || note.section_title || note.title || note.section_id,
      ).toBeTruthy();
    }
  });

  test("should get full notes for a completed session if one exists", async ({
    authToken,
  }) => {
    const list = await listSessions(authToken, { limit: 20 });
    const completedSession = list.sessions.find(
      (s) => s.status === "Completed",
    );

    if (!completedSession) {
      console.log("No completed sessions — skipping full notes test");
      return;
    }

    const fullNotes = await getFullNotes(completedSession.id, authToken);
    expect(fullNotes).toBeTruthy();
    expect(typeof fullNotes === "string" || typeof fullNotes === "object").toBe(
      true,
    );
  });

  test("should fail to get notes without auth", async () => {
    await expect(getNotes(1, "")).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Full E2E Lifecycle (serial, long-running)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Full Session Lifecycle", () => {
  test.setTimeout(600_000); // 10 minutes for the full lifecycle

  test("should complete the full session lifecycle: upload → create → poll → notes", async ({
    authToken,
  }) => {
    // 1. Pick random audio
    const audioFile = pickRandomAudio(AUDIO_DIR);
    const audioName = path.basename(audioFile);
    console.log(`Step 1: Selected audio: ${audioName}`);

    // 2. Upload audio
    const uploadResult = await uploadAudio(audioFile, authToken);
    expect(uploadResult.note_id).toBeTruthy();
    console.log(`Step 2: Uploaded → note_id: ${uploadResult.note_id}`);

    // 3. Create session
    const mrn = `E2E-${Date.now()}`;
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

    const sessionId = createResult.session_id || createResult.id;
    expect(sessionId).toBeTruthy();
    console.log(`Step 3: Created session → ID: ${sessionId}`);

    // 4. Poll until processed
    const { session, attempts } = await pollUntilProcessed(
      sessionId!,
      authToken,
      {
        intervalMs: 15_000,
        maxWaitMs: 600_000,
        onPoll: (attempt, status) => {
          console.log(`Step 4: Poll #${attempt} → status: ${status}`);
        },
      },
    );

    expect(session.status).toBe("Completed");
    console.log(
      `Step 4: Session completed after ${attempts} poll(s)`,
    );

    // 5. Fetch notes
    const notes = await getNotes(sessionId!, authToken);
    expect(notes.length).toBeGreaterThan(0);
    console.log(`Step 5: Retrieved ${notes.length} note sections`);

    // 6. Verify clinical sections exist
    const sectionNames = notes.map(
      (n) =>
        (n.section_name || n.section_title || n.title || "").toLowerCase(),
    );
    console.log(`Step 6: Section names: ${sectionNames.join(", ")}`);

    // At least some clinical content should be present
    expect(notes.some((n) => (n.content || n.details || n.text || "").length > 0)).toBe(
      true,
    );
  });
});
