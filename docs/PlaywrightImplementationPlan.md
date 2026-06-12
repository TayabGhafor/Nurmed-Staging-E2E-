# NurMed Backend — End-to-End Test Coverage Plan

## Project Analysis

NurMed is a **medical consultation platform** (FastAPI + Supabase + Celery + S3) that:
- Records doctor consultations, transcribes audio, generates structured medical notes
- Supports SNOMED/ICD clinical coding, AI copilot suggestions, admin AI tasks
- Manages hospitals, billing, templates, languages, and EHR integrations
- Has a staging UI at `https://staging.nurmed.ai` and API at `https://stg-api.nurmed.ai`

### Current Test Coverage

| Layer | Files | Tests | Coverage |
|-------|-------|-------|----------|
| **API – Login** | [login.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/login.spec.ts) | ~30 cases | ✅ Comprehensive (positive, negative, validation, security, HTTP semantics) |
| **API – Auth** | [auth.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/auth.spec.ts) | 1 smoke test | ⚠️ Minimal |
| **API – Health** | [health.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/health.spec.ts) | 2 tests | ✅ Adequate for health/docs |
| **E2E – Login UI** | [login.ui.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/e2e/login.ui.spec.ts) | ~12 cases | ✅ Good (positive, negative, edge) |
| **E2E – Session** | [session-validation.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/e2e/session-validation.spec.ts) | 1 monolith test | ⚠️ Single flow only |
| **Unit – Validation** | [validation.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/unit/validation.spec.ts) | 3 tests | ✅ Adequate |
| **Unit – Report** | [report-writer.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/unit/report-writer.spec.ts) | 1 test | ⚠️ Minimal |

### API Endpoints with NO Test Coverage

Based on analysis of [main.py](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/main.py) (2614 lines, 50+ endpoints):

| Category | Endpoints | Priority |
|----------|-----------|----------|
| **Session CRUD** | `POST /session/create`, `GET /session/{id}`, `GET /sessions/list`, `POST /session/retry`, `POST /session/update/{id}` | 🔴 Critical |
| **Session Notes** | `GET /session/get_notes/{id}`, `GET /session/get_full_notes/{id}`, `POST /session/update_notes/{id}` | 🔴 Critical |
| **Diagnosis Codes** | `GET /session/get_diagnosis_codes/{id}`, `POST /session/post_diagnosis_codes/{id}` | 🔴 Critical |
| **AI Copilot** | `GET /session/ai-copilot/{id}`, `GET /session/ai-copilot-v2/{id}` | 🟡 High |
| **Admin AI** | `POST /session/admin-ai/{id}`, `POST /session/save-ai-admin/{id}` | 🟡 High |
| **File Upload** | `POST /upload-file-to-s3/` | 🔴 Critical |
| **User Profile** | `POST /self`, `POST /verify-password`, `POST /update-password`, `POST /reset-password` | 🟡 High |
| **Token Mgmt** | `POST /refresh-token` | 🔴 Critical |
| **Templates CRUD** | `POST/GET/PUT/DELETE /templates*` | 🟡 High |
| **Languages CRUD** | `POST/GET/PUT/DELETE /languages*` | 🟡 High |
| **Hospitals** | `POST /create-hospital`, `GET /list-hospitals`, `GET /hospital/preferred-language` | 🟡 High |
| **Analytics** | `GET /encounters`, `GET /institutions/costs`, `GET /doctors/costs`, `GET /ai-tools/breakdown` | 🟢 Medium |
| **Billing** | `GET/PUT /hospital-billing/*`, `POST /billing/*`, invoices | 🟢 Medium |
| **EHR** | `POST /session/{id}/notes/send-to-ehr` | 🟢 Medium |
| **Session Costs** | `GET /sessions/{id}/cost`, `GET /users/{id}/cost` | 🟢 Medium |
| **Session Counts** | `GET /session/{id}/counts` | 🟢 Medium |
| **Failed Sessions** | `GET /sessions/failed` | 🟢 Medium |
| **Audio URL** | `GET /get-final-note-url/{id}` | 🟢 Medium |

---

## Open Questions

> [!IMPORTANT]
> **Q1: Test environment scope** — Should we write tests against the **staging API** (`stg-api.nurmed.ai`) only, **local** (`127.0.0.1:8000`) only, or both? The current setup supports both via `E2E_TARGET`.

> [!IMPORTANT]
> **Q2: Data isolation** — Some endpoints create real resources (sessions, hospitals, billing records). Should tests use cleanup/teardown to delete test data, or is the staging DB seeded/disposable?

> [!IMPORTANT]
> **Q3: AI/long-running endpoints** — The AI Copilot and Diagnosis Codes endpoints call OpenAI and are expensive. Should we include them in the regular test suite, or mark them as a separate `test:ai` suite that runs on-demand?

> [!WARNING]
> **Q4: Audio files** — The upload/session tests need `.mp3` files in `testdata/audio/`. Are these already available, or should we create stub/mock audio files?

---

## Proposed Changes

### Phase 1 — Shared Test Fixtures & Auth Setup

Create a reusable authenticated API fixture so all new test files share a single login flow.

#### [NEW] [fixtures.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/lib/fixtures.ts)

Custom Playwright `test` and `expect` exports that provide:
- `authenticatedRequest` — An `APIRequestContext` with Bearer token pre-set
- `testToken` — The raw access token for manual header usage
- Re-exports of shared config values

---

### Phase 2 — API Test Suites (Critical Priority)

#### [NEW] [session-crud.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/session-crud.spec.ts)

Tests for the core session lifecycle:
- `GET /sessions/list` — returns array, validates structure
- `POST /session/create` — creates session with valid payload, returns `session_id`
- `GET /session/{id}` — returns session with expected fields (mrn, status, template)
- `POST /session/update/{id}` — updates with new storage_id
- `POST /session/retry` — retries failed session
- `GET /session/{id}/counts` — returns copilot/admintool/optimizecode counts
- `GET /sessions/failed` — returns failed sessions list
- **Negative:** create without auth → 403, missing fields → 422, non-existent ID → 404/500

---

#### [NEW] [session-notes.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/session-notes.spec.ts)

Tests for session notes:
- `GET /session/get_notes/{id}` — returns notes array for a valid completed session
- `GET /session/get_full_notes/{id}` — returns formatted markdown string
- `POST /session/update_notes/{id}` — updates a section
- **Negative:** notes for non-existent session → 404, no auth → 403

---

#### [NEW] [file-upload.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/file-upload.spec.ts)

Tests for S3 file upload:
- `POST /upload-file-to-s3/` with valid audio file → returns `note_id`
- Invalid `note_type` → 400
- No file attached → 422
- No auth → 403

---

#### [NEW] [refresh-token.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/refresh-token.spec.ts)

Tests for token refresh:
- `POST /refresh-token` with valid refresh_token → new session
- Invalid/expired refresh_token → 401
- Missing body → 422

---

#### [NEW] [user-profile.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/user-profile.spec.ts)

Tests for user profile endpoints:
- `POST /self` — returns doctor info (id, first_name, email)
- `POST /verify-password` — correct password → 200, wrong → 422
- `POST /update-password` — updates password (use the same password to avoid state mutation)
- `POST /reset-password` — sends reset email → 200
- No auth → 403/401

---

### Phase 3 — API Test Suites (High Priority)

#### [NEW] [templates-crud.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/templates-crud.spec.ts)

Full CRUD tests:
- `GET /templates` — lists templates (requires auth)
- `GET /templates/{id}` — fetch single template
- `POST /templates` — create template (test + cleanup)
- `PUT /templates/{id}` — update template
- `DELETE /templates/{id}` — delete template
- **Negative:** duplicate code, missing fields, no auth

---

#### [NEW] [languages-crud.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/languages-crud.spec.ts)

Full CRUD tests:
- `GET /languages` — lists languages
- `GET /languages/{id}` — fetch single
- `POST /languages` — create (test + cleanup)
- `PUT /languages/{id}` — update
- `DELETE /languages/{id}` — delete
- **Negative:** missing fields, no auth

---

#### [NEW] [hospitals.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/hospitals.spec.ts)

- `GET /list-hospitals` — returns hospital list
- `POST /create-hospital` — creates hospital (test + cleanup)
- `GET /hospital/preferred-language` — returns preferred language for authenticated doctor
- No auth → 403

---

#### [NEW] [diagnosis-codes.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/diagnosis-codes.spec.ts)

- `GET /session/get_diagnosis_codes/{id}` — returns codes for completed session (may be slow due to AI call)
- `POST /session/post_diagnosis_codes/{id}` — saves diagnosis codes
- **Negative:** no notes → 404, no auth → 403

---

#### [NEW] [ai-copilot.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/ai-copilot.spec.ts)

- `GET /session/ai-copilot/{id}` — returns treatment suggestions
- `GET /session/ai-copilot-v2/{id}` — returns enhancements
- `POST /session/admin-ai/{id}` — returns admin AI response
- `POST /session/save-ai-admin/{id}` — saves admin note
- **Negative:** no notes → 404

---

### Phase 4 — API Test Suites (Medium Priority)

#### [NEW] [analytics.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/analytics.spec.ts)

- `GET /encounters` — returns encounter analytics with pagination
- `GET /institutions/costs` — returns institutional cost breakdown
- `GET /doctors/costs` — returns doctor cost breakdown with sorting
- `GET /ai-tools/breakdown` — returns AI tools usage breakdown
- `GET /sessions/{id}/cost` — returns session cost
- `GET /users/{id}/cost` — returns user cost

---

#### [NEW] [billing.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/billing.spec.ts)

- `GET /hospital-billing` — lists all billing records
- `GET /hospital-billing/{id}` — single hospital billing
- `PUT /hospital-billing/{id}` — update billing plan
- `POST /billing/run-monthly` — trigger monthly billing
- `POST /billing/get_pdf/{id}/pdf` — generate/download PDF
- `GET /hospital-billing/{id}/invoices` — list invoices
- `POST /hospital-billing/{id}/add-credits` — add credits
- `PUT /hospital-billing/{id}/invoices/{num}/payment-status` — update payment status

---

#### [NEW] [ehr.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/api/ehr.spec.ts)

- `POST /session/{id}/notes/send-to-ehr` — send notes to EHR system
- Negative: invalid hospital name, no auth

---

### Phase 5 — Enhanced E2E Tests

#### [MODIFY] [session-validation.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/e2e/session-validation.spec.ts)

The current monolith test will be kept as-is. We'll add **additional E2E specs**:

#### [NEW] [session-lifecycle.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/e2e/session-lifecycle.spec.ts)

A more focused E2E flow that:
1. Logs in via UI
2. Creates a session via API
3. Polls for completion
4. Fetches notes and verifies structure
5. Fetches diagnosis codes
6. Calls AI copilot
7. Verifies session counts increment

#### [NEW] [dashboard-navigation.spec.ts](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/tests/e2e/dashboard-navigation.spec.ts)

Post-login UI navigation:
- After login, verify dashboard loads
- Session list page renders
- Can navigate to a session detail

---

### Phase 6 — Update package.json Scripts

#### [MODIFY] [package.json](file:///Users/maliktayab/Documents/Playwright/nurmed-backend-staging/package.json)

Add new granular test scripts:
```json
"test:api:sessions": "playwright test --project=api tests/api/session-crud.spec.ts",
"test:api:templates": "playwright test --project=api tests/api/templates-crud.spec.ts",
"test:api:languages": "playwright test --project=api tests/api/languages-crud.spec.ts",
"test:api:billing": "playwright test --project=api tests/api/billing.spec.ts",
"test:api:ai": "playwright test --project=api tests/api/ai-copilot.spec.ts tests/api/diagnosis-codes.spec.ts",
"test:api:all": "playwright test --project=login --project=api",
"test:e2e:all": "playwright test --project=login --project=e2e",
"test:all": "playwright test"
```

---

## Verification Plan

### Automated Tests

```bash
# Phase 1: Run existing tests to ensure no regressions
npm run test:login
npm run test:api
npm run test:unit

# Phase 2-4: Run new API tests
npx playwright test --project=login --project=api

# Phase 5: Run E2E tests
npm run test:e2e

# Full suite
npm run test:all
```

### Manual Verification

- Verify test HTML report with `npm run test:report`
- Check that tests pass against staging API (`E2E_TARGET=staging`)
- Confirm test isolation — new tests don't mutate shared state
- Review test count to confirm coverage increase
