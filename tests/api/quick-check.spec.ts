import path from "path";
import { request } from "@playwright/test";
import { test, expect } from "../lib/fixtures";
import {
  ApiQuickCheckReporter,
  executeApiCheck,
  getNestedArray,
  getNestedValue,
} from "../lib/api-quick-check";

const API_BASE =
  process.env.STG_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://stg-api.nurmed.ai/api/v1";

const SESSION_TEMPLATE = process.env.SESSION_TEMPLATE || "OPDLHR18";
const INVALID_4XX = [400, 401, 403, 404, 409, 422];

function asRecord(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
}

function pickSessionId(body: unknown): number | null {
  const sessions = getNestedArray(body, ["sessions", "data.sessions", "data"]);
  const firstSession = sessions.find(
    (entry) => entry && typeof entry === "object" && "id" in (entry as Record<string, unknown>),
  ) as Record<string, any> | undefined;
  return firstSession?.id ? Number(firstSession.id) : null;
}

function pickCompletedSession(body: unknown): Record<string, any> | null {
  const sessions = getNestedArray(body, ["sessions", "data.sessions", "data"]);
  const completed = sessions.find((entry) => {
    const session = asRecord(entry);
    return String(session.status || "").toLowerCase() === "completed";
  });
  return completed ? asRecord(completed) : null;
}

function extractTemplateList(body: unknown): Record<string, any>[] {
  const directTemplates = getNestedArray(body, ["templates", "data.templates", "data"]);
  return directTemplates.map((item) => asRecord(item));
}

test.describe("Quick API backend coverage", () => {
  test.setTimeout(600_000);

  test("covers backend-facing API responses with endpoint logs", async ({
    authToken,
  }) => {
    const reporter = new ApiQuickCheckReporter();
    const outputDir = path.resolve(__dirname, "../../testResults");
    const api = await request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: {
        Authorization: `Bearer ${authToken}`,
        Accept: "application/json",
      },
    });

    let userId: string | null = null;
    let hospitalId: number | null = null;
    let listSessionId: number | null = null;
    let completedSessionId: number | null = null;
    let completedSessionMrn: string | null = null;
    let createdSessionId: number | null = null;
    let createdTemplateId: number | null = null;
    let createdApiKeyId: string | null = null;

    try {
      await test.step("Auth and discovery endpoints", async () => {
        await executeApiCheck(api, reporter, {
          name: "Get current user",
          category: "auth",
          method: "POST",
          path: "self",
          expectedStatuses: [200],
          validate: (body) => {
            const user =
              getNestedValue<Record<string, any>>(body, ["data.user", "data", "user"]) ||
              asRecord(body);
            const id = user.id || user.user_id;
            const resolvedHospitalId = user.hospital_id ?? user.hospital?.id;
            if (!id) {
              throw new Error("Current user response did not include a user id");
            }
            if (!resolvedHospitalId) {
              throw new Error("Current user response did not include a hospital id");
            }
            userId = String(id);
            hospitalId = Number(resolvedHospitalId);
            return `user_id=${userId}, hospital_id=${hospitalId}`;
          },
        });

        await executeApiCheck(api, reporter, {
          name: "Embed exchange rejects invalid token",
          category: "auth",
          method: "POST",
          path: "auth/embed/exchange",
          expectedStatuses: INVALID_4XX,
          data: { token: "invalid-quick-check-token" },
        });

        await executeApiCheck(api, reporter, {
          name: "Get preferred hospital language",
          category: "discovery",
          method: "GET",
          path: "hospital/preferred-language",
          expectedStatuses: [200],
        });

        await executeApiCheck(api, reporter, {
          name: "List specialities",
          category: "discovery",
          method: "GET",
          path: "speciality/",
          expectedStatuses: [200],
          validate: (body) => {
            if (!Array.isArray(body)) {
              throw new Error("Specialities response was not an array");
            }
            return `count=${body.length}`;
          },
        });

        await executeApiCheck(api, reporter, {
          name: "List feature flags",
          category: "feature-flags",
          method: "GET",
          path: "feature-flags/list",
          expectedStatuses: [200],
          validate: (body) => {
            const features = getNestedArray(body, [
              "data.features",
              "features",
              "data",
            ]);
            if (features.length === 0) {
              throw new Error("Feature flag list was empty");
            }
            return `count=${features.length}`;
          },
        });

        if (userId) {
          await executeApiCheck(api, reporter, {
            name: "Get user feature flags",
            category: "feature-flags",
            method: "GET",
            path: `feature-flags/users?user_id=${encodeURIComponent(userId)}`,
            expectedStatuses: [200],
            validate: (body) => {
              const features = getNestedArray(body, ["features", "data.features", "data"]);
              if (!Array.isArray(features)) {
                throw new Error("User feature response was not array-like");
              }
              return `count=${features.length}`;
            },
          });
        }
      });

      await test.step("Session and notes endpoints", async () => {
        await executeApiCheck(api, reporter, {
          name: "Realtime session generation rejects invalid payload",
          category: "session",
          method: "POST",
          path: "session/generate-realtime-session",
          expectedStatuses: INVALID_4XX,
          data: {},
        });

        await executeApiCheck(api, reporter, {
          name: "Realtime session update rejects invalid payload",
          category: "session",
          method: "POST",
          path: "session/generate-realtime-update-session/999999999",
          expectedStatuses: INVALID_4XX,
          data: {},
        });

        await executeApiCheck(api, reporter, {
          name: "List sessions",
          category: "session",
          method: "GET",
          path: "session/list?limit=20",
          expectedStatuses: [200],
          validate: (body) => {
            const sessions = getNestedArray(body, ["sessions", "data.sessions"]);
            const pagination = getNestedValue(body, ["pagination", "data.pagination"]);
            if (!Array.isArray(sessions)) {
              throw new Error("Session list did not return sessions array");
            }
            if (!pagination) {
              throw new Error("Session list did not return pagination");
            }
            listSessionId = pickSessionId(body);
            const completedSession = pickCompletedSession(body);
            if (completedSession?.id) {
              completedSessionId = Number(completedSession.id);
              completedSessionMrn = String(completedSession.mrn || "");
            }
            if (!listSessionId) {
              throw new Error("No session id could be discovered from session list");
            }
            if (!completedSessionId) {
              throw new Error("No completed session could be discovered for note checks");
            }
            return `sessions=${sessions.length}, completed_session_id=${completedSessionId}`;
          },
        });

        if (listSessionId) {
          await executeApiCheck(api, reporter, {
            name: "Get single session",
            category: "session",
            method: "GET",
            path: `session/${listSessionId}`,
            expectedStatuses: [200],
            validate: (body) => {
              const session =
                getNestedValue<Record<string, any>>(body, ["data", "session"]) ||
                asRecord(body);
              if (!session.id) {
                throw new Error("Single session response missing id");
              }
              if (!session.status) {
                throw new Error("Single session response missing status");
              }
              return `mrn=${session.mrn || "n/a"}, status=${session.status}`;
            },
          });
        }

        await executeApiCheck(api, reporter, {
          name: "Create quick-check session",
          category: "session",
          method: "POST",
          path: "session/create",
          expectedStatuses: [200, 201],
          data: {
            mrn: `API-QUICK-${Date.now()}`,
            language: "english",
            new_note_storage_id: "",
            session_template: SESSION_TEMPLATE,
            session_duration_seconds: 60,
          },
          validate: (body) => {
            const id = getNestedValue<number>(body, ["id", "session_id", "data.id", "data.session_id"]);
            if (!id) {
              throw new Error("Create session response missing id");
            }
            createdSessionId = Number(id);
            return `created_session_id=${createdSessionId}`;
          },
        });

        await executeApiCheck(api, reporter, {
          name: "Session update rejects invalid target",
          category: "session",
          method: "PUT",
          path: "session/update_session/999999999",
          expectedStatuses: INVALID_4XX,
          data: {
            storage_id: `quick-check-storage-${Date.now()}`,
            transcription_status: "Failed",
          },
        });

        await executeApiCheck(api, reporter, {
          name: "Upload file endpoint rejects missing file",
          category: "session",
          method: "POST",
          path: "note/upload-file-to-s3/?note_type=create_session",
          expectedStatuses: INVALID_4XX,
        });

        if (completedSessionId) {
          await executeApiCheck(api, reporter, {
            name: "Get session notes",
            category: "notes",
            method: "GET",
            path: `note/get_notes/${completedSessionId}`,
            expectedStatuses: [200],
            validate: (body) => {
              const notes = getNestedArray(body, ["data", "notes"]);
              if (notes.length === 0) {
                throw new Error("Session notes response was empty");
              }
              return `note_count=${notes.length}`;
            },
          });

          await executeApiCheck(api, reporter, {
            name: "Get diagnosis codes",
            category: "notes",
            method: "GET",
            path: `note/get_diagnosis_codes/${completedSessionId}`,
            expectedStatuses: [200],
          });

          await executeApiCheck(api, reporter, {
            name: "Run administration AI",
            category: "notes",
            method: "POST",
            path: `note/admin_ai/${completedSessionId}`,
            expectedStatuses: [200],
            data: {
              query: "Return a short administration summary for quick API health verification.",
              variables: {},
            },
            validate: (body) => {
              const text = typeof body === "string" ? body : JSON.stringify(body);
              if (!text || text.length < 3) {
                throw new Error("Administration AI response was empty");
              }
              return `response_length=${text.length}`;
            },
          });

          await executeApiCheck(api, reporter, {
            name: "Get AI copilot",
            category: "notes",
            method: "GET",
            path: `note/ai-copilot-v2/${completedSessionId}`,
            expectedStatuses: [200],
          });

          await executeApiCheck(api, reporter, {
            name: "Get final note storage id",
            category: "notes",
            method: "GET",
            path: `session/get-final-note-url/${completedSessionId}`,
            expectedStatuses: [200],
          });

          await executeApiCheck(api, reporter, {
            name: "Get full notes",
            category: "notes",
            method: "GET",
            path: `note/get_full_notes/${completedSessionId}`,
            expectedStatuses: [200],
          });

          await executeApiCheck(api, reporter, {
            name: "Get RPA notes",
            category: "rpa",
            method: "GET",
            path: `rpa/rpa_notes/${completedSessionId}`,
            expectedStatuses: [200, 404],
          });
        }

        if (createdSessionId) {
          await executeApiCheck(api, reporter, {
            name: "Update notes rejects invalid section",
            category: "notes",
            method: "PUT",
            path: `note/update_notes/${createdSessionId}`,
            expectedStatuses: INVALID_4XX,
            data: {
              section_id: 999999999,
              updated_details: "quick-check-invalid-section",
            },
          });

          await executeApiCheck(api, reporter, {
            name: "Post diagnosis codes rejects invalid payload",
            category: "notes",
            method: "POST",
            path: `note/post_diagnosis_codes/${createdSessionId}`,
            expectedStatuses: INVALID_4XX,
            data: {
              diagnosis_codes: [],
            },
          });

          await executeApiCheck(api, reporter, {
            name: "Save admin AI note",
            category: "notes",
            method: "POST",
            path: "note/add_admin_note",
            expectedStatuses: [200, 201],
            data: {
              session_id: createdSessionId,
              note: "Quick API health note",
            },
          });

          await executeApiCheck(api, reporter, {
            name: "Send to EHR rejects invalid payload",
            category: "notes",
            method: "POST",
            path: `session/${createdSessionId}/send-to-ehr`,
            expectedStatuses: INVALID_4XX,
            data: {
              hospital: "",
              mrn: completedSessionMrn || "",
              encounter_id: "",
              vdr_id: "",
            },
          });
        }
      });

      await test.step("Hospital admin and configuration endpoints", async () => {
        await executeApiCheck(api, reporter, {
          name: "Get doctor languages and templates",
          category: "admin",
          method: "GET",
          path: "hospital/doctor/languages-and-templates",
          expectedStatuses: [200],
        });

        await executeApiCheck(api, reporter, {
          name: "Get RPA cloudflow URL",
          category: "rpa",
          method: "GET",
          path: "rpa/cloudflow_url",
          expectedStatuses: [200, 404],
        });

        await executeApiCheck(api, reporter, {
          name: "Set RPA webhook rejects invalid URL",
          category: "rpa",
          method: "POST",
          path: "rpa/webhoook_url/?url=not-a-valid-url",
          expectedStatuses: INVALID_4XX,
        });

        if (hospitalId) {
          await executeApiCheck(api, reporter, {
            name: "List hospital templates",
            category: "template",
            method: "GET",
            path: `hospital/${hospitalId}/session-templates`,
            expectedStatuses: [200],
            validate: (body) => {
              const templates = extractTemplateList(body);
              return `template_count=${templates.length}`;
            },
          });

          await executeApiCheck(api, reporter, {
            name: "Add hospital template rejects invalid payload",
            category: "template",
            method: "POST",
            path: `hospital/${hospitalId}/session-templates`,
            expectedStatuses: INVALID_4XX,
            data: {},
          });

          await executeApiCheck(api, reporter, {
            name: "Remove hospital template rejects unknown id",
            category: "template",
            method: "DELETE",
            path: "hospital/session-templates/999999999",
            expectedStatuses: INVALID_4XX,
          });

          await executeApiCheck(api, reporter, {
            name: "List hospital locations",
            category: "location",
            method: "GET",
            path: `location/hospital/${hospitalId}`,
            expectedStatuses: [200],
          });

          await executeApiCheck(api, reporter, {
            name: "Create location rejects invalid payload",
            category: "location",
            method: "POST",
            path: "location/",
            expectedStatuses: INVALID_4XX,
            data: {},
          });

          await executeApiCheck(api, reporter, {
            name: "Get hospital statistics",
            category: "admin",
            method: "GET",
            path: `hospital/${hospitalId}`,
            expectedStatuses: [200, 404],
          });

          await executeApiCheck(api, reporter, {
            name: "List API keys",
            category: "admin",
            method: "GET",
            path: `admin/hospitals/${hospitalId}/api-keys`,
            expectedStatuses: [200],
          });
        }

        await executeApiCheck(api, reporter, {
          name: "Create template",
          category: "template",
          method: "POST",
          path: "template/setup",
          expectedStatuses: [200, 201],
          data: {
            code: `QK${Date.now()}`.slice(-8),
            name: `Quick Check Template ${Date.now()}`,
            description: "Temporary template created by API quick check",
            is_active: true,
            sections: [
              {
                text: "Quick Check Section",
                sort_order: 0,
              },
            ],
          },
          validate: (body) => {
            const templateId = getNestedValue<number>(body, [
              "id",
              "data.id",
              "template_id",
              "data.template_id",
            ]);
            if (!templateId) {
              throw new Error("Create template response missing id");
            }
            createdTemplateId = Number(templateId);
            return `template_id=${createdTemplateId}`;
          },
        });

        if (createdTemplateId) {
          await executeApiCheck(api, reporter, {
            name: "Get template by id",
            category: "template",
            method: "GET",
            path: `template/${createdTemplateId}?include_sections=true`,
            expectedStatuses: [200],
          });

          await executeApiCheck(api, reporter, {
            name: "Update template",
            category: "template",
            method: "PUT",
            path: `template/${createdTemplateId}/setup`,
            expectedStatuses: [200],
            data: {
              name: `Quick Check Template Updated ${Date.now()}`,
              is_active: true,
              sections: [
                {
                  text: "Quick Check Section Updated",
                  sort_order: 0,
                },
              ],
            },
          });
        }

        await executeApiCheck(api, reporter, {
          name: "Create API key",
          category: "admin",
          method: "POST",
          path: "admin/api-keys",
          expectedStatuses: [200, 201],
          data: {
            name: `quick-check-${Date.now()}`,
            scopes: ["sessions.read"],
          },
          validate: (body) => {
            const apiKeyId = getNestedValue<string>(body, ["id", "data.id"]);
            if (!apiKeyId) {
              throw new Error("Create API key response missing id");
            }
            createdApiKeyId = String(apiKeyId);
            return `api_key_id=${createdApiKeyId}`;
          },
        });

        await executeApiCheck(api, reporter, {
          name: "List scribes",
          category: "scribe",
          method: "GET",
          path: "scribe/get_scribes",
          expectedStatuses: [200],
        });

        await executeApiCheck(api, reporter, {
          name: "Add scribe rejects invalid payload",
          category: "scribe",
          method: "POST",
          path: "scribe/add_scribe",
          expectedStatuses: INVALID_4XX,
          data: {},
        });

        await executeApiCheck(api, reporter, {
          name: "Set scribe doctors rejects unknown scribe",
          category: "scribe",
          method: "POST",
          path: "scribe/999999999/doctors",
          expectedStatuses: INVALID_4XX,
          data: {
            doctor_ids: [],
          },
        });
      });
    } finally {
      if (createdApiKeyId) {
        await executeApiCheck(api, reporter, {
          name: "Delete API key",
          category: "admin",
          method: "DELETE",
          path: `admin/api-keys/${encodeURIComponent(createdApiKeyId)}`,
          expectedStatuses: [200, 204],
        });
      }

      if (createdTemplateId) {
        await executeApiCheck(api, reporter, {
          name: "Delete template",
          category: "template",
          method: "DELETE",
          path: `template/${createdTemplateId}/setup`,
          expectedStatuses: [200, 204],
        });
      }

      await reporter.writeArtifacts(outputDir);
      await api.dispose();
    }

    const failedChecks = reporter.failures;
    expect(
      failedChecks,
      failedChecks
        .map((check) => `${check.name}: ${check.errorMessage || check.validationNote || "failed"}`)
        .join("\n"),
    ).toEqual([]);
  });
});
