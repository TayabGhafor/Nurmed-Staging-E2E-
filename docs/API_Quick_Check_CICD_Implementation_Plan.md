# API Quick Check CI/CD Implementation Plan

Last updated: 2026-06-30

## Purpose

This document turns the QA strategy into an implementation plan that matches the current `nurmed-frontend-staging` repository.

The goal is to add a fast API quick-check pipeline that:

- runs automatically on every commit and pull request
- fails fast when a critical API path breaks
- generates an API health report at the end of the workflow
- improves confidence in the existing Playwright suite without making the pipeline slow or flaky

## Current State Summary

### What exists today

- Playwright is already configured with `api`, `data-validation`, and `e2e` projects.
- There is one GitHub Actions workflow at `.github/workflows/e2e-tests.yml`.
- API coverage exists for login and a long session lifecycle path.
- There is an HTML report writer for the data-validation flow.

### Main gaps

- The current workflow does not run on every commit or every PR.
- There is no dedicated quick API smoke suite.
- API, validation, and UI tests are bundled into one workflow/job path, which delays feedback.
- There is no commit-level API health summary that lists endpoint pass/fail results.
- The current test inventory does not cover the critical admin and clinical endpoints used by the app.
- Several UI tests use brittle waits/selectors and do not follow the flakiness guidance in the QA strategy.

## Repo Findings

### CI/CD

- `e2e-tests.yml` currently runs on:
  - a schedule every 10 minutes
  - manual dispatch
  - pushes to `main` only when test files/workflow files change
- It does not run on all branch pushes.
- It does not run on `pull_request`.
- It does not separate a fast quick-check lane from the slower validation and UI suites.

### Playwright setup

- `playwright.config.ts` defines three projects:
  - `api`
  - `data-validation`
  - `e2e`
- The config always starts the local Next.js dev server through `webServer`, even for API-only projects.
- Tests run serially with one worker, which is safe but not optimized for fast feedback.

### Test coverage

- Current API specs:
  - `tests/api/login.spec.ts`
  - `tests/api/session-lifecycle.spec.ts`
- Current UI specs:
  - `tests/e2e/login-ui.spec.ts`
  - `tests/e2e/dashboard.spec.ts`
- Current report generation is focused on the session validation flow, not endpoint health.

### Real API surface used by the frontend

The frontend currently uses these high-value backend endpoints that should drive the quick-check design:

- `session/create`
- `session/list`
- `session/{id}`
- `note/get_notes/{id}`
- `note/get_full_notes/{id}`
- `note/get_diagnosis_codes/{id}`
- `note/post_diagnosis_codes/{id}`
- `note/admin_ai/{id}`
- `note/add_admin_note`
- `note/ai-copilot-v2/{id}`
- `session/{id}/send-to-ehr`
- `session/get-final-note-url/{id}`
- `hospital/doctor/languages-and-templates`
- `hospital/{hospitalId}/session-templates`
- `admin/hospitals/{hospitalId}/api-keys`
- `admin/api-keys`

### Important architecture note

Not every hospital-admin screen is API-backed through the backend service layer. Some pages query Supabase directly. That means the API quick check is necessary, but it will not fully validate every admin screen by itself. Those Supabase-driven paths should stay covered by separate UI/integration tests.

## Target CI/CD Design

## 1. Workflow split

Replace the current single scheduled-style workflow with a commit-driven pipeline:

- `api-quick-check.yml`
  - trigger on every `push`
  - trigger on every `pull_request`
  - run the fast smoke layer only
  - publish an API health summary
  - fail immediately if any critical endpoint fails

- `playwright-full.yml`
  - trigger on `pull_request`
  - optional trigger on `push` to `main`/`develop`
  - run full API tests, data validation tests, and E2E tests
  - upload Playwright HTML artifacts

- keep a separate scheduled workflow only if the team still wants recurring unattended synthetic monitoring

## 2. Job order

The quick-check workflow should use this order:

1. Checkout and install dependencies
2. Run the API smoke suite only
3. Generate machine-readable JSON results
4. Convert JSON results into a human-readable API health report
5. Upload the report as an artifact
6. Publish a GitHub Step Summary
7. Fail the workflow if any critical endpoint failed

## 3. Runtime budget

Target total duration: 2 to 4 minutes

Rules:

- no browser project
- no local `webServer`
- no long polling for note generation
- no Excel validation
- no large media upload loops
- no scheduled-only logic in the quick-check path

## Quick-Check Scope

The quick-check suite should validate only the highest-signal paths that the frontend actively depends on.

### Tier 1: always run on every commit

1. Authentication bootstrap
   - obtain an auth token using the existing Supabase-based test login helper
   - verify token can access a protected backend endpoint such as `POST /self`

2. Session list
   - `GET session/list`
   - assert `200`
   - assert response shape includes `sessions` and `pagination`

3. Session fetch on an existing session
   - use the first returned session id from `session/list`
   - `GET session/{id}`
   - assert `200`
   - assert shape includes `id`, `mrn`, and `status`

4. Notes fetch on a completed session
   - find a completed session from the list
   - `GET note/get_notes/{id}`
   - assert `200`
   - assert array shape

5. Full notes fetch
   - `GET note/get_full_notes/{id}`
   - assert `200`
   - assert non-empty text/object payload

6. Coding suggestions
   - `GET note/get_diagnosis_codes/{id}`
   - assert `200`
   - if data exists, assert `code`, `name`, and `summary` fields

7. AI copilot
   - `GET note/ai-copilot-v2/{id}`
   - assert non-5xx response

8. Admin AI generate
   - `POST note/admin_ai/{id}`
   - assert non-empty response body

9. Doctor languages and templates
   - `GET hospital/doctor/languages-and-templates`
   - assert `200`
   - assert hospital/template structure exists

10. Hospital templates
    - `GET hospital/{hospitalId}/session-templates`
    - assert `200`

11. API keys list
    - `GET admin/hospitals/{hospitalId}/api-keys`
    - assert non-5xx response for an admin-capable account

### Tier 2: add once stable

These should be introduced after the Tier 1 suite is stable:

- create and delete API key
- create session with uniquely suffixed MRN
- post diagnosis codes to a throwaway session
- send to EHR against a controlled test record

These are valuable, but they mutate state and need tighter cleanup and test-account controls.

## Recommended File Layout

Add the following files:

```text
tests/
  api/
    quick-check.spec.ts
  lib/
    api-health.ts
    api-health-report.ts
    quick-check-context.ts

.github/
  workflows/
    api-quick-check.yml
```

### Responsibilities

- `tests/api/quick-check.spec.ts`
  - contains the fast endpoint checks
  - uses shared helpers only
  - records structured health results

- `tests/lib/quick-check-context.ts`
  - resolves auth token
  - discovers hospital id
  - discovers a usable existing session
  - picks a completed session when needed

- `tests/lib/api-health.ts`
  - defines health result types
  - appends endpoint results to an in-memory collection
  - writes JSON output to disk in `testResults/api-health.json`

- `tests/lib/api-health-report.ts`
  - converts JSON to:
    - markdown summary for GitHub Step Summary
    - optional HTML artifact for download

## Reporting Design

The API health report should be generated at the end of every quick-check run.

### Report outputs

1. `testResults/api-health.json`
2. `testResults/api-health.md`
3. `testResults/api-health.html`

### Minimum fields per endpoint

- endpoint name
- method
- path
- status
- result: `PASS` or `FAIL`
- response time in ms
- short assertion summary
- failure reason
- commit sha
- run timestamp

### GitHub summary format

The workflow should publish a compact table like this:

| Check | Method | Path | Result | Status | Time |
|---|---|---|---|---|---|
| Auth self | POST | `/self` | PASS | 200 | 312ms |
| Session list | GET | `/session/list` | PASS | 200 | 428ms |
| Notes fetch | GET | `/note/get_notes/{id}` | FAIL | 500 | 819ms |

Add a final summary block:

- total checks
- passed
- failed
- slowest endpoint
- artifact link name

## Workflow Implementation Outline

```yaml
name: API Quick Check

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

concurrency:
  group: api-quick-check-${{ github.ref }}
  cancel-in-progress: true

jobs:
  api-quick-check:
    runs-on: ubuntu-latest
    timeout-minutes: 8
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright test --project=api tests/api/quick-check.spec.ts --reporter=list,json
        env:
          STG_API_URL: ${{ secrets.STG_API_URL }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
      - run: pnpm exec tsx tests/lib/api-health-report.ts
      - name: Publish summary
        if: always()
        run: cat testResults/api-health.md >> "$GITHUB_STEP_SUMMARY"
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: api-health-report
          path: |
            testResults/api-health.json
            testResults/api-health.md
            testResults/api-health.html
```

## Required Playwright Changes

### 1. Prevent API tests from starting the Next.js server

The current global `webServer` setting should not apply to the quick-check suite.

Recommended options:

- split API quick-check into a dedicated Playwright config without `webServer`
- or make `webServer` conditional, for example only when running the `e2e` project

This is required to keep the quick-check fast and independent from frontend boot issues.

### 2. Add granular scripts

Add scripts such as:

```json
"test:api:quick": "playwright test --project=api tests/api/quick-check.spec.ts",
"test:api:full": "playwright test --project=api tests/api",
"test:ci:quick": "pnpm test:api:quick"
```

### 3. Keep quick checks read-heavy first

The first version should avoid creating sessions or deleting resources unless the endpoint absolutely cannot be validated any other way.

That keeps the suite:

- faster
- safer on staging
- easier to debug
- less likely to fail because of data cleanup problems

## Test Maintenance Plan

To make sure every test is maintained properly and accurately, apply these cleanup items immediately after the quick-check lane is added.

### High priority cleanup

1. Replace `page.waitForTimeout(...)` usage in UI specs with semantic waits.
2. Stop relying on optional "if data exists, skip" assertions for quick-check coverage.
3. Move repeated login setup into shared helpers or storage state for UI tests.
4. Separate smoke, full API, validation, and browser suites clearly in scripts and workflows.
5. Add test IDs or stable semantic locators where selectors are currently fragile.

### Medium priority cleanup

1. Convert current session lifecycle tests into:
   - one quick-read health test
   - one slower long-running lifecycle test
2. Add endpoint-specific assertions for admin API paths.
3. Add schema-level validation for high-value responses.
4. Record response-time metrics so slow regressions become visible over time.

## Rollout Plan

### Phase 1

- create `quick-check.spec.ts`
- add JSON/Markdown/HTML health reporting
- add `api-quick-check.yml`
- run on every push and pull request

### Phase 2

- make Playwright API config independent from `webServer`
- add granular npm/pnpm scripts
- publish branch protection guidance for the new status check

### Phase 3

- expand quick-check with controlled mutation tests
- add more admin and template coverage
- keep the existing full session validation flow as a deeper, slower gate

### Phase 4

- refactor brittle UI tests
- align the repo layout more closely with `docs/NurMed_QA_Test_Strategy.md`
- split scheduled synthetic monitoring from commit-level CI

## Secrets and Test Data

Required secrets:

- `STG_API_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `TEST_EMAIL`
- `TEST_PASSWORD`

Optional but useful later:

- `TEST_ADMIN_EMAIL`
- `TEST_ADMIN_PASSWORD`
- `TEST_HOSPITAL_ID`
- `TEST_COMPLETED_SESSION_ID`

If admin and doctor capabilities are not both available on one account, create dedicated test identities and keep them stable.

## Definition Of Done

This implementation is complete when:

- every push and every PR triggers the quick-check workflow automatically
- the workflow fails if any critical API check fails
- the workflow produces a readable API health report artifact
- the GitHub job summary shows endpoint-by-endpoint health
- quick checks finish in under 4 minutes consistently
- the existing full API/validation/E2E workflows remain available for deeper regression coverage

