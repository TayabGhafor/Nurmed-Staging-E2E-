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
const API_BASE_WITH_TRAILING_SLASH = `${API_BASE.replace(/\/+$/, "")}/`;

const SESSION_TEMPLATE = process.env.SESSION_TEMPLATE || "OPDLHR18";
const INVALID_4XX = [400, 401, 403, 404, 409, 422];

function formatFailureSummary(check: {
  name: string;
  status: number | null;
  errorMessage?: string;
  validationNote?: string;
  responsePreview: string;
}): string {
  const reason = check.errorMessage || check.validationNote || "failed";
  const responseSnippet = check.responsePreview
    ? check.responsePreview.replace(/\s+/g, " ").slice(0, 240)
    : "(empty response)";
  return `${check.name}: status=${check.status ?? "n/a"} | ${reason} | response=${responseSnippet}`;
}

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

function getJwtSubject(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf-8"));
    return decoded?.sub ? String(decoded.sub) : null;
  } catch {
    return null;
  }
}

test.describe("Quick API backend coverage", () => {
  test.setTimeout(600_000);

  test("covers backend-facing API responses with endpoint logs", async ({
    authToken,
  }) => {
    const reporter = new ApiQuickCheckReporter();
    const outputDir = path.resolve(__dirname, "../../testResults");
    const api = await request.newContext({
      baseURL: API_BASE_WITH_TRAILING_SLASH,
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
    userId = getJwtSubject(authToken);
    const uniqueTemplateCode = `QK${Date.now()}`.slice(-8);
    const uniqueTemplateName = `Quick Check Template ${Date.now()}`;
    const uniqueApiKeyName = `quick-check-${Date.now()}`;

    try {
      await test.step("Auth and discovery endpoints", async () => {
        await executeApiCheck(api, reporter, {
          name: "Protected auth token check",
          category: "auth",
          method: "GET",
          path: "hospital/preferred-language",
          expectedStatuses: [200],
          validate: (body) => {
            const preferredLanguage = getNestedValue<string>(body, [
              "preferred_language",
              "data.preferred_language",
            ]);
            if (!preferredLanguage) {
              throw new Error("Protected auth check did not return preferred_language");
            }
            return `preferred_language=${preferredLanguage}`;
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
          name: "List specialities",
          category: "discovery",
          method: "GET",
          path: "speciality/",
          expectedStatuses: [200],
          blocking: false,
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

        await executeApiCheck(api, reporter, {
          name: "Get feature flags for current user context",
          category: "feature-flags",
          method: "GET",
          path: `feature-flags/users?user_id=${encodeURIComponent(userId || "")}`,
          expectedStatuses: [200],
          validate: (body) => {
            const features = getNestedArray(body, ["features", "data.features", "data"]);
            return `count=${features.length}`;
          },
        });
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
          blocking: false,
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
          blocking: false,
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
            name: "Post diagnosis codes accepts empty list",
            category: "notes",
            method: "POST",
            path: `note/post_diagnosis_codes/${createdSessionId}`,
            expectedStatuses: [200, 201],
            data: {
              diagnosis_codes: [],
            },
            validate: (body) => {
              const message = getNestedValue<string>(body, ["message", "data.message"]);
              if (!message) {
                throw new Error("Diagnosis codes response missing message");
              }
              return message;
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
          validate: (body) => {
            const hospitals = getNestedArray(body, ["hospitals", "data.hospitals"]);
            const firstHospital = asRecord(hospitals[0]);
            if (firstHospital.hospital_id) {
              hospitalId = Number(firstHospital.hospital_id);
            }
            return `hospital_count=${hospitals.length}`;
          },
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
            code: uniqueTemplateCode,
            name: uniqueTemplateName,
            description: "Temporary template created by API quick check",
            is_active: true,
            sections: [
              {
                text: "Quick Check Section",
                sort_order: 0,
              },
            ],
          },
        });

        if (hospitalId) {
          await executeApiCheck(api, reporter, {
            name: "Discover created template",
            category: "template",
            method: "GET",
            path: `hospital/${hospitalId}/session-templates`,
            expectedStatuses: [200],
            validate: (body) => {
              const templates = extractTemplateList(body);
              const matchedTemplate = templates.find((template) => {
                const flat = asRecord(template.session_template ?? template);
                return (
                  String(flat.code || "") === uniqueTemplateCode ||
                  String(flat.name || "") === uniqueTemplateName
                );
              });
              if (!matchedTemplate) {
                throw new Error("Created template was not discoverable in hospital template list");
              }
              const flat = asRecord(matchedTemplate.session_template ?? matchedTemplate);
              createdTemplateId = Number(flat.id);
              return `template_id=${createdTemplateId}`;
            },
          });
        }

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
            name: uniqueApiKeyName,
            scopes: ["sessions.read"],
          },
          validate: (body) => {
            const apiKeyId = getNestedValue<string>(body, [
              "api_key.id",
              "data.api_key.id",
              "id",
              "data.id",
            ]);
            if (apiKeyId) {
              createdApiKeyId = String(apiKeyId);
              return `api_key_id=${createdApiKeyId}`;
            }
            return "api key created";
          },
        });

        if (hospitalId) {
          await executeApiCheck(api, reporter, {
            name: "Discover created API key",
            category: "admin",
            method: "GET",
            path: `admin/hospitals/${hospitalId}/api-keys`,
            expectedStatuses: [200],
            validate: (body) => {
              const keys = Array.isArray(body)
                ? (body as Record<string, any>[])
                : getNestedArray(body, ["items", "data", "keys", "api_keys"]).map((item) =>
                    asRecord(item),
                  );
              const matchedKey = keys.find(
                (key) => String(asRecord(key).name || "") === uniqueApiKeyName,
              );
              if (!matchedKey) {
                throw new Error("Created API key was not discoverable in API key list");
              }
              createdApiKeyId = String(asRecord(matchedKey).id);
              return `api_key_id=${createdApiKeyId}`;
            },
          });
        }

        await executeApiCheck(api, reporter, {
          name: "List scribes",
          category: "scribe",
          method: "GET",
          path: "scribe/get_scribes",
          expectedStatuses: [200],
          blocking: false,
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
      failedChecks.map((check) => formatFailureSummary(check)).join("\n"),
    ).toEqual([]);
  });
});
