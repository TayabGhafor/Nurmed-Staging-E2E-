# NurMed Platform — QA Test Strategy, User Stories & Test Cases

**Scope:** Doctor Portal (clinical notes creation) and Hospital Admin Portal (Doctor Management, API Key Management, Template Management)
**Test types covered:** Functional (UI), API, Boundary Value Analysis (BVA), Negative/Invalid input, Edge cases
**CI/CD:** Playwright + GitHub Actions, triggered automatically on every commit/PR
**Last updated:** 2026-06-30 (rev 2 — added Section 17.5 Quick API Smoke Suite)

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [System Workflow Diagrams](#2-system-workflow-diagrams)
3. [Test Environment & Conventions](#3-test-environment--conventions)
4. [Epic 1 — Authentication & Role Routing](#epic-1--authentication--role-routing)
5. [Epic 2 — Session Creation (Notes Creation Entry)](#epic-2--session-creation-notes-creation-entry)
6. [Epic 3 — Microphone Permission & Recording](#epic-3--microphone-permission--recording)
7. [Epic 4 — Backend Processing (Audio → Structured Note)](#epic-4--backend-processing-audio--structured-note)
8. [Epic 5 — Session Review & Note Fields](#epic-5--session-review--note-fields)
9. [Epic 6 — AI Copilot (Inline Field Editing)](#epic-6--ai-copilot-inline-field-editing)
10. [Epic 7 — Administration AI](#epic-7--administration-ai)
11. [Epic 8 — Optimise Coding (ICD-11)](#epic-8--optimise-coding-icd-11)
12. [Epic 9 — View Full Note](#epic-9--view-full-note)
13. [Epic 10 — Send to EHR](#epic-10--send-to-ehr)
14. [Epic 11 — Hospital Admin: Doctor Management](#epic-11--hospital-admin-doctor-management)
15. [Epic 12 — Hospital Admin: API Key Management](#epic-12--hospital-admin-api-key-management)
16. [Epic 13 — Hospital Admin: Template Management](#epic-13--hospital-admin-template-management)
17. [API Test Matrix](#17-api-test-matrix)
    - [17.5 Quick API Smoke Suite (per-commit, fast layer)](#175-quick-api-smoke-suite-per-commit-fast-layer)
18. [Cross-Cutting Non-Functional Test Cases](#18-cross-cutting-non-functional-test-cases)
19. [Playwright Project Structure](#19-playwright-project-structure)
20. [CI/CD Pipeline Design (GitHub Actions)](#20-cicd-pipeline-design-github-actions)
21. [Flakiness Prevention Checklist](#21-flakiness-prevention-checklist)
22. [Definition of Done per Test](#22-definition-of-done-per-test)

---

## 1. Document Purpose

This document is the single source of truth for QA coverage of the NurMed platform. It maps every user-facing flow (captured via UI walkthrough and screenshots) into:

- **User stories** in standard `As a / I want / So that` format with explicit acceptance criteria
- **Test cases** tagged by type: `Valid`, `Invalid`, `Edge`, `Boundary`, each with preconditions, steps, expected result, and priority
- **API-level checks** for every network call implied by the UI flow
- A **Playwright automation plan** wired into CI/CD so every commit is verified automatically and regressions are caught before merge

Every epic below is traceable to a specific screen or modal already validated against the staging environment (`staging.nurmed.ai`).

**Priority legend:** `P0` = blocks release if broken · `P1` = high impact, must fix before next release · `P2` = should fix · `P3` = nice to have / cosmetic

---

## 2. System Workflow Diagrams

The diagrams below (already generated and shared earlier in this conversation) are the authoritative reference for flow coverage in this document. They should be embedded in the team wiki / PR description alongside this file.

### 2.1 Notes Creation Flow (Login → Send to EHR)
Covers: login, session start, microphone permission decision, recording, backend processing, note review, the optional AI tools group (AI Copilot / Administration AI / Optimise Coding / View Full Note), and the two-step Send to EHR confirmation with cancel paths at each step.

> Diagram reference: `nurmed_notes_creation_flow` (rendered earlier in this conversation thread)

### 2.2 Session Note-Action Sub-flows
Detailed branch logic for each of the four toolbar tools: Administration AI (prompt → generate → add-to-note/cancel), Optimise Coding (ICD-11 checkbox suggestions → apply-selected/cancel), View Full Note (read-only → export/copy/close), AI Copilot (inline edit).

> Diagram reference: `nurmed_note_actions_flow`

### 2.3 Hospital Admin Flow
Covers: Doctor Management dashboard, Doctor/Location management, API Key Management (add/delete), Template Management (add/view/deactivate).

> Diagram reference: `nurmed_admin_flow`

### 2.4 Top-Level Role Routing
Login → role decision → Doctor Portal or Hospital Admin Portal, with a toggle to switch roles at any time.

> Diagram reference: `nurmed_overview_flow`

**Note for the engineering team:** these four SVGs should be exported as PNG/SVG assets and placed under `/docs/diagrams/` in the repository, then referenced via standard markdown image syntax once exported, e.g.:
```markdown
![Notes creation flow](./docs/diagrams/notes_creation_flow.svg)
```

---

## 3. Test Environment & Conventions

| Item | Value |
|---|---|
| Staging URL | `https://staging.nurmed.ai` |
| Doctor test account | `testnurmed@mailinator.com` |
| Hospital Admin test account | Same account (dual role: Doctor + Hospital Admin) |
| Browser matrix | Chromium (primary), Firefox, WebKit |
| Viewport matrix | Desktop 1440×900, Tablet 768×1024, Mobile 390×844 |
| Test data isolation | Each test run creates its own MRN/session/API key/template using a unique run-id suffix; nothing is shared across parallel workers |
| Network mocking | Playwright `route()` used for negative/edge API cases (5xx, timeout, malformed payload) that can't be reliably reproduced against live staging |

**Test case ID format:** `EPIC-XX-TYPE-NNN` e.g. `EPIC-02-VALID-001`, `EPIC-12-BOUNDARY-003`

**Test case types:**
- **Valid** — happy path, correct input, expected success
- **Invalid** — malformed/wrong-type/forbidden input, expected graceful rejection
- **Edge** — unusual but technically valid conditions (empty lists, slow network, concurrent actions, special characters)
- **Boundary** — values at or just past a defined limit (min length, max length, zero, max+1, expiry exactly now, etc.)


---

## Epic 1 — Authentication & Role Routing

**User Story 1.1**
> As a registered NurMed user, I want to log in with my email and password, so that I can access either the Doctor Portal or Hospital Admin Portal based on my role.

**Acceptance Criteria**
- Valid credentials route to the correct landing page (Doctor Portal by default for dual-role accounts)
- Invalid credentials show an inline error without leaking whether the email or password was wrong
- Session persists across page refresh until logout or token expiry
- A role-switch toggle is visible in the top nav once logged in, for accounts with multiple roles

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-01-VALID-001 | Valid | Login with correct credentials | 1. Go to `/login` 2. Enter `testnurmed@mailinator.com` / correct password 3. Submit | Redirected to Doctor Portal session list | P0 |
| EPIC-01-VALID-002 | Valid | Session persists on refresh | 1. Log in 2. Refresh page | User remains authenticated, no redirect to login | P0 |
| EPIC-01-VALID-003 | Valid | Role toggle switches portals | 1. Log in 2. Click "Hospital Admin" toggle | Hospital Admin dashboard loads with same session | P0 |
| EPIC-01-VALID-004 | Valid | Logout clears session | 1. Log in 2. Click logout icon | Redirected to login; back-navigation does not restore session | P1 |
| EPIC-01-INVALID-001 | Invalid | Wrong password | 1. Enter valid email, incorrect password | Generic "invalid email or password" error; no account enumeration | P0 |
| EPIC-01-INVALID-002 | Invalid | Unregistered email | 1. Enter non-existent email | Same generic error as wrong-password case (no enumeration) | P0 |
| EPIC-01-INVALID-003 | Invalid | Empty email field | 1. Leave email blank, submit | Inline required-field validation, no network call fired | P1 |
| EPIC-01-INVALID-004 | Invalid | Empty password field | 1. Leave password blank, submit | Inline required-field validation, no network call fired | P1 |
| EPIC-01-INVALID-005 | Invalid | Malformed email (no @) | 1. Enter `testnurmed` as email | Client-side format validation error | P2 |
| EPIC-01-INVALID-006 | Invalid | SQL-injection-style input | 1. Enter `' OR '1'='1` in both fields | Rejected as invalid credentials; no 500 error, no auth bypass | P0 |
| EPIC-01-EDGE-001 | Edge | Expired session token | 1. Log in 2. Manually expire/clear auth token in storage 3. Attempt navigation | Redirected to login with session-expired message | P1 |
| EPIC-01-EDGE-002 | Edge | Concurrent login same account, two tabs | 1. Log in on tab A 2. Log in on tab B | Both sessions remain valid (or one invalidates the other per spec — confirm with product) | P2 |
| EPIC-01-EDGE-003 | Edge | Login during network throttling (slow 3G) | 1. Throttle network 2. Submit valid credentials | Loading state shown; no duplicate submission if user double-clicks | P1 |
| EPIC-01-BOUNDARY-001 | Boundary | Password field max length input | 1. Enter a 500-character password | Field accepts up to defined max, rejects beyond it without crashing | P3 |
| EPIC-01-BOUNDARY-002 | Boundary | Rapid repeated failed logins | 1. Submit wrong password 5+ times in a row | Rate limiting / lockout behavior triggers per spec (confirm threshold with backend team) | P1 |

---

## Epic 2 — Session Creation (Notes Creation Entry)

**User Story 2.1**
> As a doctor, I want to start a new recording session by entering the patient MRN, selecting a template, and selecting a language, so that the system knows how to structure the resulting note.

**Acceptance Criteria**
- "Start New Recording" is reachable from the session list at all times
- MRN, template, and language are all required before recording can begin
- Only active templates (per Template Management) appear in the template dropdown
- Selecting an invalid/inactive template is not possible via the UI

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-02-VALID-001 | Valid | Create session with valid MRN, template, language | 1. Click "+ Start New Recording" 2. Enter valid MRN 3. Select active template 4. Select language 5. Proceed | Session created; mic-permission step is reached | P0 |
| EPIC-02-VALID-002 | Valid | Template dropdown lists only active templates | 1. Deactivate a template via admin 2. Open template dropdown in session creation | Deactivated template does not appear | P0 |
| EPIC-02-VALID-003 | Valid | MRN field accepts existing patient MRN | 1. Enter an MRN that already has prior sessions | Session created and grouped correctly under same MRN in sidebar | P1 |
| EPIC-02-INVALID-001 | Invalid | Empty MRN | 1. Leave MRN blank, attempt to proceed | Inline validation blocks progression | P0 |
| EPIC-02-INVALID-002 | Invalid | No template selected | 1. Leave template unselected, attempt to proceed | Inline validation blocks progression | P0 |
| EPIC-02-INVALID-003 | Invalid | No language selected | 1. Leave language unselected, attempt to proceed | Inline validation blocks progression | P0 |
| EPIC-02-INVALID-004 | Invalid | MRN with special characters / script injection | 1. Enter `<script>alert(1)</script>` as MRN | Input sanitized/rejected; no script execution, no stored XSS | P0 |
| EPIC-02-EDGE-001 | Edge | MRN with leading/trailing whitespace | 1. Enter `  000126006  ` | Trimmed and treated identically to `000126006` | P2 |
| EPIC-02-EDGE-002 | Edge | Network failure during session creation | 1. Throttle/disconnect network 2. Submit session details | Clear error state shown; no orphaned/partial session record created | P1 |
| EPIC-02-EDGE-003 | Edge | Template list empty (hospital has zero active templates) | 1. Deactivate all templates 2. Open session creation | Empty state message shown; recording cannot start without a template | P2 |
| EPIC-02-BOUNDARY-001 | Boundary | MRN minimum length (1 character) | 1. Enter a single-character MRN | Accepted if backend allows, or rejected with clear message — confirm min length with backend | P2 |
| EPIC-02-BOUNDARY-002 | Boundary | MRN maximum length | 1. Enter MRN at defined max length 2. Enter MRN at max+1 | Max length accepted; max+1 rejected or truncated, not silently dropped | P2 |

---

## Epic 3 — Microphone Permission & Recording

**User Story 3.1**
> As a doctor, I want to be prompted for microphone access and be able to record, stop, and save a consultation, so that the conversation can be transcribed into a note.

**Acceptance Criteria**
- If mic permission is denied, the user is clearly prompted to allow access and recording does not silently fail
- Recording can be stopped and saved, producing a session that proceeds to backend processing
- Recording state (active/inactive) is visually unambiguous at all times

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-03-VALID-001 | Valid | Mic permission granted, recording starts | 1. Complete session details 2. Grant mic permission when prompted | Recording UI becomes active (waveform/indicator visible) | P0 |
| EPIC-03-VALID-002 | Valid | Stop and save recording | 1. Start recording 2. Speak for several seconds 3. Click stop/save | Session saved and appears in sidebar list with correct timestamp | P0 |
| EPIC-03-INVALID-001 | Invalid | Mic permission denied | 1. Deny browser mic permission prompt | User is shown a clear instruction to enable mic access; recording does not start | P0 |
| EPIC-03-INVALID-002 | Invalid | No microphone device available | 1. Simulate environment with no audio input device | Graceful error message; no unhandled exception | P1 |
| EPIC-03-EDGE-001 | Edge | Mic permission revoked mid-recording | 1. Start recording 2. Revoke mic permission via browser settings mid-session | Recording stops gracefully; partial audio is either saved or discarded with clear messaging | P1 |
| EPIC-03-EDGE-002 | Edge | Very short recording (under 2 seconds) | 1. Start and immediately stop recording | System handles gracefully — either processes minimal audio or shows "too short" message, not a crash | P2 |
| EPIC-03-EDGE-003 | Edge | Very long recording (60+ minutes) | 1. Record continuously for an extended duration | No silent truncation; system either supports the duration or warns before a defined limit | P2 |
| EPIC-03-EDGE-004 | Edge | Browser tab backgrounded during recording | 1. Start recording 2. Switch to another tab for several minutes 3. Return and stop | Recording continues uninterrupted in background | P2 |
| EPIC-03-EDGE-005 | Edge | Network drops during active recording | 1. Start recording 2. Disconnect network 3. Reconnect 4. Stop and save | Local audio buffer preserved; save succeeds once network restored, or clear retry path offered | P1 |
| EPIC-03-BOUNDARY-001 | Boundary | Recording length at system-defined max limit | 1. Record up to the documented max session length | System stops/warns exactly at limit, not before or after | P2 |

---

## Epic 4 — Backend Processing (Audio → Structured Note)

**User Story 4.1**
> As a doctor, I want my saved recording to be automatically transcribed and structured into note fields, so that I don't have to manually type the consultation summary.

**Acceptance Criteria**
- Processing status is visible to the user (not a silent black box)
- Note fields are populated according to the selected template's sections
- Processing failures are surfaced, not silently swallowed

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-04-VALID-001 | Valid | Successful processing produces populated note | 1. Save a recording with clear speech | Note fields (Allergies, Diagnosis Code, Chief Complaint, etc.) are populated matching spoken content | P0 |
| EPIC-04-VALID-002 | Valid | Note fields match selected template's sections | 1. Use a custom template with non-default sections (e.g. COPD template) 2. Complete a session | Resulting note only shows the sections defined in that template | P0 |
| EPIC-04-EDGE-001 | Edge | Processing with silent/inaudible recording | 1. Save a recording with no speech | Fields remain empty/default rather than hallucinated content; user is informed | P1 |
| EPIC-04-EDGE-002 | Edge | Processing with heavy background noise | 1. Save a recording with significant background noise | Best-effort transcription; no crash; degraded-confidence indication if available | P2 |
| EPIC-04-EDGE-003 | Edge | Processing takes longer than expected (backend slow) | 1. Save a recording 2. Backend processing delayed | UI shows pending/processing state, not a false "ready" state; eventually resolves or times out gracefully | P1 |
| EPIC-04-INVALID-001 | Invalid | Backend processing failure (mocked 500) | 1. Mock processing API to return 500 | Session marked as failed/needs-retry; user notified, not stuck in infinite spinner | P0 |
| EPIC-04-BOUNDARY-001 | Boundary | Multiple sessions queued for processing simultaneously | 1. Save 5+ recordings back-to-back | All sessions eventually process correctly; no cross-contamination of data between sessions | P1 |

---

## Epic 5 — Session Review & Note Fields

**User Story 5.1**
> As a doctor, I want to open a processed session and review all generated note fields, so that I can verify clinical accuracy before sending to EHR.

**Acceptance Criteria**
- All template-defined sections render with their generated content
- Fields are directly editable (copy/edit icons present per field, per screenshots)
- Sidebar session list is accurate and correctly grouped/sorted by date

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-05-VALID-001 | Valid | Open a processed session from sidebar | 1. Click a session row in sidebar | All note fields render with generated content | P0 |
| EPIC-05-VALID-002 | Valid | Copy icon copies field content | 1. Click copy icon next to "Diagnosis" field | Field content copied to clipboard | P2 |
| EPIC-05-VALID-003 | Valid | Edit icon allows manual field correction | 1. Click edit icon on "Chief Complaint" 2. Modify text 3. Save | Updated text persists on reload | P0 |
| EPIC-05-VALID-004 | Valid | Sessions grouped correctly by date in sidebar | 1. Create sessions on different dates | Sidebar groups sessions under correct date headers | P1 |
| EPIC-05-EDGE-001 | Edge | Manual edit with empty value | 1. Edit a required field 2. Clear all text 3. Save | Either reverts to prior value or shows validation; field is not silently left blank if required downstream (e.g. for EHR send) | P1 |
| EPIC-05-EDGE-002 | Edge | Manual edit with very long text | 1. Paste several thousand characters into a single field | Field handles gracefully (scroll/expand), no UI breakage, no silent truncation without warning | P2 |
| EPIC-05-EDGE-003 | Edge | Switching sessions while an edit is unsaved | 1. Start editing a field 2. Click a different session in sidebar without saving | User is warned about unsaved changes, or change is auto-saved — confirm intended behavior with product | P1 |
| EPIC-05-INVALID-001 | Invalid | Edit field with script injection | 1. Enter `<img src=x onerror=alert(1)>` into a field 2. Save | Rendered as plain text, not executed; stored safely | P0 |

---

## Epic 6 — AI Copilot (Inline Field Editing)

**User Story 6.1**
> As a doctor, I want to optionally use AI Copilot to refine any note field, so that I can quickly improve note quality without retyping everything manually.

> **Note:** All four tools in this epic group (AI Copilot, Administration AI, Optimise Coding, View Full Note) are **optional** — a doctor can proceed directly from "Review generated note" to "Send to EHR" without invoking any of them. Test coverage must explicitly verify the skip path works (see EPIC-10-VALID-001).

**Acceptance Criteria**
- AI Copilot is accessible from the session toolbar at any time after processing completes
- Using AI Copilot does not block or gate the Send to EHR action — it remains fully optional

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-06-VALID-001 | Valid | Skip AI Copilot entirely | 1. Open processed session 2. Do not click AI Copilot 3. Proceed to Send to EHR | Send to EHR flow works identically to a session that used AI Copilot | P0 |
| EPIC-06-VALID-002 | Valid | Use AI Copilot to refine a field | 1. Click AI Copilot 2. Request a field refinement | Field updates accordingly; change is persisted | P1 |
| EPIC-06-EDGE-001 | Edge | AI Copilot invoked on an empty field | 1. Click AI Copilot on a field with no content | Tool handles gracefully — either generates fresh content or shows an appropriate message | P2 |
| EPIC-06-INVALID-001 | Invalid | AI Copilot backend failure (mocked) | 1. Mock AI Copilot API to fail | Error surfaced to user; field reverts to last known-good state, no data loss | P1 |

---

## Epic 7 — Administration AI

**User Story 7.1**
> As a doctor, I want to optionally generate an administrative summary by entering a free-text prompt, so that I can quickly produce supporting documentation without writing it by hand.

**Acceptance Criteria**
- Administration AI is fully optional and does not gate Send to EHR
- The modal supports: enter prompt → Generate → review output → Add to note OR Cancel
- "Add to note" persists output into the note; "Cancel" discards it with no side effects

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-07-VALID-001 | Valid | Generate a summary with a valid prompt | 1. Click "Administration AI" 2. Enter "Give me the summary" 3. Click "Generate" | AI output populates the text area below the prompt | P0 |
| EPIC-07-VALID-002 | Valid | Add generated output to note | 1. Generate output 2. Click "Add to note" | Output content appended/merged into the session note; modal closes | P0 |
| EPIC-07-VALID-003 | Valid | Cancel discards generated output | 1. Generate output 2. Click "Cancel" | Modal closes; note is unchanged; re-opening modal does not retain prior prompt/output | P1 |
| EPIC-07-VALID-004 | Valid | Skip Administration AI entirely | 1. Do not open Administration AI 2. Proceed to Send to EHR | Flow proceeds normally without it | P0 |
| EPIC-07-INVALID-001 | Invalid | Click Generate with empty prompt | 1. Open modal 2. Leave prompt blank 3. Click "Generate" | Inline validation blocks the call, or a sensible default summary is generated — confirm intended behavior; must not error/crash | P1 |
| EPIC-07-INVALID-002 | Invalid | Generate API failure (mocked 500) | 1. Mock Administration AI generate endpoint to fail | Clear error message in modal; "Generate" remains retryable; "Add to note" disabled while no valid output exists | P0 |
| EPIC-07-INVALID-003 | Invalid | Prompt with script injection | 1. Enter `<script>alert(1)</script>` as prompt 2. Generate | Treated as literal text input to the AI; no script execution in UI; output (if any) rendered safely | P0 |
| EPIC-07-EDGE-001 | Edge | Generate clicked multiple times rapidly | 1. Click "Generate" several times in quick succession | Only one in-flight request processed at a time (button disabled while loading); no duplicate content appended | P1 |
| EPIC-07-EDGE-002 | Edge | Very long prompt | 1. Enter several thousand characters as the prompt | Handled gracefully — accepted up to a sane limit or rejected with a clear message, not a silent failure | P2 |
| EPIC-07-EDGE-003 | Edge | Generate, then edit prompt, then Generate again | 1. Generate once 2. Modify prompt text 3. Generate again | Second output replaces the first; no stale/duplicated content in modal | P2 |
| EPIC-07-BOUNDARY-001 | Boundary | Prompt at minimum viable length (1 character) | 1. Enter a single character as prompt 2. Generate | Accepted or rejected per defined minimum, not crashing | P3 |

---

## Epic 8 — Optimise Coding (ICD-11)

**User Story 8.1**
> As a doctor, I want to optionally review AI-suggested diagnosis codes using the ICD-11 classification, so that I can quickly apply accurate billing/diagnosis codes without manually looking them up.

**Acceptance Criteria**
- "Optimise Coding" is fully optional and does not gate Send to EHR
- Suggestions are sourced from the **ICD-11** coding standard (not ICD-9 or ICD-10) — this must be explicitly verified, since the platform may evolve its coding standard over time and a regression to an older standard should be caught by tests
- Each suggestion shows a checkbox, the ICD-11 code, the code's display name, and a description
- At least one suggestion may be pre-checked based on AI confidence; user can change selections before applying
- "Apply Selected" commits only the checked codes; "Cancel" discards all suggestions with no side effects

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-08-VALID-001 | Valid | Open Coding Suggestions modal | 1. Click "Optimise Coding" | Modal opens listing ICD-11 coded suggestions with checkboxes and descriptions | P0 |
| EPIC-08-VALID-002 | Valid | Verify codes conform to ICD-11 format/standard | 1. Open Coding Suggestions 2. Inspect each suggested code | Each code matches valid ICD-11 code structure (e.g. alphanumeric category codes per WHO ICD-11) and is **not** an ICD-9/ICD-10-only code | P0 |
| EPIC-08-VALID-003 | Valid | Apply a single pre-checked suggestion | 1. Open modal with one item pre-checked 2. Click "Apply Selected (1)" | Selected code is added to the Diagnosis/Medical Diagnosis Code field; modal closes | P0 |
| EPIC-08-VALID-004 | Valid | Check an additional unchecked suggestion before applying | 1. Open modal 2. Check the second (unchecked) suggestion 3. Click "Apply Selected (2)" | Button label updates count correctly; both codes applied | P0 |
| EPIC-08-VALID-005 | Valid | Uncheck the pre-checked suggestion, apply zero | 1. Uncheck the pre-checked item 2. Click "Apply Selected (0)" / button disabled | No codes applied if zero selected, or button disables — confirm intended UX; must not apply unintended codes | P1 |
| EPIC-08-VALID-006 | Valid | Cancel discards all suggestions | 1. Open modal, check items 2. Click "Cancel" | Modal closes; Diagnosis field unchanged | P1 |
| EPIC-08-VALID-007 | Valid | Skip Optimise Coding entirely | 1. Do not open Optimise Coding 2. Proceed to Send to EHR | Flow proceeds normally using only the originally generated diagnosis code | P0 |
| EPIC-08-INVALID-001 | Invalid | Coding suggestion API failure (mocked 500) | 1. Mock suggestions endpoint to fail | Clear error/empty state in modal; no crash; "Apply Selected" not actionable | P0 |
| EPIC-08-INVALID-002 | Invalid | Mocked response containing a malformed/non-ICD-11 code | 1. Mock API to return a code outside ICD-11 format | UI either rejects/flags the malformed entry or this is caught as a backend contract test failure before reaching UI | P1 |
| EPIC-08-EDGE-001 | Edge | No suggestions available for a session | 1. Use a session with minimal/ambiguous clinical content 2. Open Optimise Coding | Empty state message shown, not a blank/broken modal | P2 |
| EPIC-08-EDGE-002 | Edge | Large number of suggestions (10+) | 1. Mock API to return 10+ suggestions | Modal scrolls correctly; all checkboxes remain independently functional | P2 |
| EPIC-08-EDGE-003 | Edge | Applying codes twice in the same session | 1. Apply selected codes 2. Re-open Optimise Coding 3. Apply again | No duplicate codes appended to Diagnosis field on second apply | P1 |
| EPIC-08-BOUNDARY-001 | Boundary | Apply with all suggestions checked (maximum selection) | 1. Check every available suggestion 2. Apply | All codes applied correctly, button count matches total | P2 |

---

## Epic 9 — View Full Note

**User Story 9.1**
> As a doctor, I want to optionally view the fully consolidated note in read-only form, so that I can do a final readability check and export or copy it before sending to EHR.

**Acceptance Criteria**
- "View Full Note" is fully optional and does not gate Send to EHR
- The modal is read-only — no field in this view is directly editable
- Export Note, Copy Note, and Close are all independently functional

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-09-VALID-001 | Valid | Open Final Note modal | 1. Click "View Full Note" | Modal opens showing all populated fields concatenated in readable format | P0 |
| EPIC-09-VALID-002 | Valid | Final Note reflects latest edits | 1. Edit a field on the session 2. Open "View Full Note" | Modal shows the updated value, not stale cached content | P0 |
| EPIC-09-VALID-003 | Valid | Export Note | 1. Click "Export Note" | A downloadable file is produced containing the note content | P1 |
| EPIC-09-VALID-004 | Valid | Copy Note | 1. Click "Copy Note" | Full note content copied to clipboard | P1 |
| EPIC-09-VALID-005 | Valid | Close modal | 1. Click "Close" | Modal closes; underlying session view unaffected | P0 |
| EPIC-09-VALID-006 | Valid | Skip View Full Note entirely | 1. Do not open it 2. Proceed to Send to EHR | Flow proceeds normally | P0 |
| EPIC-09-EDGE-001 | Edge | View Full Note with one or more empty sections | 1. Use a session where a section has no content 2. Open modal | Empty section either omitted or shown clearly as empty, not rendered as "undefined"/"null" | P2 |
| EPIC-09-EDGE-002 | Edge | Export Note when content is very long | 1. Use a session with maximal note content 2. Export | Export completes without truncation or timeout | P2 |

---

## Epic 10 — Send to EHR

**User Story 10.1**
> As a doctor, I want to send the completed note to the hospital's EHR system through a two-step confirmation, so that I have a final safeguard against sending unreviewed or incorrect data.

**Acceptance Criteria**
- Step 1 ("Send Data to {Hospital}") confirms intent to send and shows the hospital identifier
- Step 2 ("Review Notes" modal) requires the "I have read and reviewed all the notes" checkbox before "Send to EHR" is enabled
- Cancelling at either step returns the user to the session with no data sent and no partial state
- The flow works identically regardless of which optional tools (Epics 6–9) were or weren't used beforehand

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-10-VALID-001 | Valid | Full happy path with zero optional tools used | 1. Complete a session 2. Skip AI Copilot, Administration AI, Optimise Coding, View Full Note entirely 3. Click "Send to EHR" 4. Confirm step 1 5. Check review checkbox 6. Click "Send to EHR" in modal | Note sent successfully; session marked as sent | P0 |
| EPIC-10-VALID-002 | Valid | Full happy path using all optional tools | 1. Use AI Copilot, Administration AI (add to note), Optimise Coding (apply), View Full Note 2. Send to EHR through both confirmation steps | Note sent successfully reflecting all the changes made via the optional tools | P0 |
| EPIC-10-VALID-003 | Valid | Step 1 confirm dialog shows correct hospital | 1. Click "Send to EHR" | Dialog title shows the correct hospital name (e.g. "Send Data to Evercare Lahore") matching the logged-in hospital | P0 |
| EPIC-10-VALID-004 | Valid | "Send to EHR" disabled until checkbox is checked | 1. Reach Review Notes modal 2. Do not check the checkbox | "Send to EHR" button is disabled/non-functional until checkbox is checked | P0 |
| EPIC-10-VALID-005 | Valid | Review Notes modal shows complete, accurate content | 1. Reach Review Notes modal | All sections (Chief Complaint, HPI, Past Medical/Social History, Allergies, Diagnosis ICD, Local Exam) match the session's current field values exactly | P0 |
| EPIC-10-INVALID-001 | Invalid | Cancel at step 1 | 1. Click "Send to EHR" 2. Click "No, Cancel" | Returns to session unchanged; no API call made | P0 |
| EPIC-10-INVALID-002 | Invalid | Cancel at step 2 (Review Notes modal) | 1. Reach Review Notes modal 2. Click "Cancel" | Returns to session unchanged; no API call made; checkbox state not retained on reopen | P0 |
| EPIC-10-INVALID-003 | Invalid | EHR send API failure (mocked 500) | 1. Mock the send-to-EHR endpoint to fail 2. Complete both confirmation steps | Clear error message shown; session is NOT marked as sent; user can retry | P0 |
| EPIC-10-INVALID-004 | Invalid | EHR send with missing required field (e.g. blank Diagnosis) | 1. Clear a required field 2. Attempt to send to EHR | Validation blocks the send with a clear message identifying the missing field | P1 |
| EPIC-10-EDGE-001 | Edge | Network drops between step 1 and step 2 | 1. Confirm step 1 2. Disconnect network before Review Notes modal fully loads | Clear error/retry state; user not left in an ambiguous "maybe sent" state | P1 |
| EPIC-10-EDGE-002 | Edge | Double-click "Send to EHR" in Review Notes modal | 1. Rapidly double-click the final send button | Only one send request is fired; no duplicate EHR records created | P0 |
| EPIC-10-EDGE-003 | Edge | Re-sending an already-sent session | 1. Successfully send a session 2. Attempt to send it again | System either blocks duplicate sends or clearly flags it as a re-send — confirm intended behavior with product | P1 |
| EPIC-10-EDGE-004 | Edge | Session edited after being sent | 1. Send a session 2. Attempt to edit a field afterward | Either fields become read-only post-send, or edits are allowed but flagged as "modified after send" — confirm intended behavior | P2 |
| EPIC-10-BOUNDARY-001 | Boundary | Checkbox toggled on then off then on again before submit | 1. Check, uncheck, recheck the review checkbox 2. Submit | Final state (checked) is what's evaluated; button correctly enabled | P3 |

---

## Epic 11 — Hospital Admin: Doctor Management

**User Story 11.1**
> As a hospital administrator, I want to view, search, filter, and manage doctors and locations, so that I can maintain accurate staffing and usage records for my hospital.

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-11-VALID-001 | Valid | Dashboard stats load correctly | 1. Open Doctor Management | Total Doctors, Active, Inactive, Total Encounters, Administrators all display accurate counts | P0 |
| EPIC-11-VALID-002 | Valid | Add a new doctor with valid details | 1. Click "+ Add New Doctor" 2. Fill valid name/email/department/role 3. Save | New doctor appears in table with correct fields and "Active" status | P0 |
| EPIC-11-VALID-003 | Valid | Add a new location | 1. Click "Add Location" 2. Enter valid address details 3. Save | New location available for assignment to doctors | P1 |
| EPIC-11-VALID-004 | Valid | Search doctors by name | 1. Type a known doctor's name into search | Table filters to matching rows only | P1 |
| EPIC-11-VALID-005 | Valid | Filter by role | 1. Select "Doctor" from All Roles dropdown | Only rows with Doctor role badge shown | P1 |
| EPIC-11-VALID-006 | Valid | Filter by status | 1. Select "Active" from All Status dropdown | Only active doctors shown | P1 |
| EPIC-11-VALID-007 | Valid | Filter by date range | 1. Set a "Usage by Date Range" matching known sessions | Encounter counts reflect only the filtered date range | P1 |
| EPIC-11-VALID-008 | Valid | Filter by encounter count min/max | 1. Set Min/Max encounter count bounds | Only doctors within that encounter range shown | P2 |
| EPIC-11-VALID-009 | Valid | Download CSV | 1. Click "Download CSV" | A CSV file downloads containing the currently visible (or full) doctor dataset matching the UI | P1 |
| EPIC-11-INVALID-001 | Invalid | Add doctor with duplicate email | 1. Add a doctor using an email already in the system | Clear validation error; no duplicate record created | P0 |
| EPIC-11-INVALID-002 | Invalid | Add doctor with malformed email | 1. Enter `notanemail` as email | Client-side validation blocks submission | P1 |
| EPIC-11-INVALID-003 | Invalid | Add doctor with empty required fields | 1. Leave name/email blank, submit | Inline validation blocks submission | P0 |
| EPIC-11-EDGE-001 | Edge | Search with no matching results | 1. Search for a nonsense string | Empty state message, not a blank/broken table | P2 |
| EPIC-11-EDGE-002 | Edge | Filter combination yields zero results | 1. Combine filters that logically exclude all doctors | Empty state shown; filters remain visible/adjustable | P2 |
| EPIC-11-EDGE-003 | Edge | CSV export with zero doctors matching filters | 1. Filter to zero results 2. Download CSV | CSV downloads with headers only, not an error | P2 |
| EPIC-11-BOUNDARY-001 | Boundary | Encounter count filter at exact min/max values | 1. Set Min and Max to the same value matching exactly one doctor's count | Exactly that one doctor returned (inclusive boundary) | P2 |
| EPIC-11-BOUNDARY-002 | Boundary | Date range with start date after end date | 1. Set "to" date earlier than "from" date | Validation error or auto-correction, not silently empty/incorrect results | P2 |

---

## Epic 12 — Hospital Admin: API Key Management

**User Story 12.1**
> As a hospital administrator, I want to create, view, and delete API keys with defined scopes and optional expiry, so that I can securely manage third-party/system integrations.

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-12-VALID-001 | Valid | Create API key with name + scope, no expiry | 1. Click "+ Add New API Key" 2. Enter Name 3. Enter scope, click "Add" 4. Leave Expires At blank 5. Click "Create API Key" | New key appears in table, Status = Active, Expires At = "Never" | P0 |
| EPIC-12-VALID-002 | Valid | Create API key with expiry date set | 1. Repeat creation flow with a future Expires At date/time | Key created; Expires At column reflects the chosen date/time exactly | P0 |
| EPIC-12-VALID-003 | Valid | Create API key with multiple scopes | 1. Add two or more scopes before submitting | All scopes saved and displayed (or "all" badge shown per existing UI pattern) | P1 |
| EPIC-12-VALID-004 | Valid | Delete an existing API key | 1. Click "Delete" on a key row 2. Confirm if a confirmation step exists | Key removed from the table; subsequent API calls using that key are rejected | P0 |
| EPIC-12-VALID-005 | Valid | Key usage counter increments on use | 1. Use a newly created key to make an authenticated API call 2. Refresh table | "Usage" count increments by 1; "Last Used" timestamp updates | P1 |
| EPIC-12-INVALID-001 | Invalid | Create key with empty Name | 1. Leave Name blank 2. Attempt to create | Inline validation blocks submission (Name is marked required) | P0 |
| EPIC-12-INVALID-002 | Invalid | Create key with no scope added | 1. Leave Scopes empty 2. Attempt to create | Inline validation blocks submission (Scopes marked required) | P0 |
| EPIC-12-INVALID-003 | Invalid | Create key with duplicate name | 1. Use a Name identical to an existing key | Either allowed (names are not unique) or blocked with a clear message — confirm with backend contract | P2 |
| EPIC-12-INVALID-004 | Invalid | Create API key request fails (mocked 500) | 1. Mock create endpoint to fail | Clear error shown in modal; modal stays open with entered data retained for retry | P1 |
| EPIC-12-INVALID-005 | Invalid | Use a deleted key to call the API | 1. Delete a key 2. Attempt an API call using that key's value | 401/403 returned; call rejected | P0 |
| EPIC-12-INVALID-006 | Invalid | Use an expired key to call the API | 1. Create a key with Expires At in the past (if permitted by UI) or wait for natural expiry 2. Call API | 401/403 returned with an "expired" reason if available | P0 |
| EPIC-12-EDGE-001 | Edge | Add same scope twice | 1. Enter the same scope text twice, clicking "Add" both times | Duplicate scope is either deduplicated or both shown without breaking the UI | P2 |
| EPIC-12-EDGE-002 | Edge | Expires At set to current date/time | 1. Set Expires At to right now | Key is created already-expired or rejected at creation — confirm with product whether this is allowed | P2 |
| EPIC-12-EDGE-003 | Edge | Very long key name | 1. Enter several hundred characters as Name | Handled gracefully; UI does not break in the table column rendering | P3 |
| EPIC-12-EDGE-004 | Edge | Delete the same key twice rapidly (double click) | 1. Double-click "Delete" quickly | Only one deletion processed; no error on the second (already-gone) request, or a graceful "already deleted" message | P2 |
| EPIC-12-BOUNDARY-001 | Boundary | Expires At exactly 1 minute in the future | 1. Set expiry to now + 1 minute 2. Wait past that minute 3. Use the key | Key correctly becomes invalid right at/after the expiry boundary | P1 |
| EPIC-12-BOUNDARY-002 | Boundary | Name field at maximum allowed length | 1. Enter Name at exactly the documented max character limit | Accepted; one character beyond max is rejected/truncated, not silently dropped | P2 |

---

## Epic 13 — Hospital Admin: Template Management

**User Story 13.1**
> As a hospital administrator, I want to create, view, and deactivate clinical note templates with ordered sections, so that doctors record consistent, structured notes per visit type.

### Test Cases

| ID | Type | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| EPIC-13-VALID-001 | Valid | Create template with required fields and 1+ section | 1. Click "+ Add Template" 2. Enter Code, Name, Description 3. Leave Active checked 4. Add at least one section 5. Click "Create Template" | Template appears in table with Status = Active | P0 |
| EPIC-13-VALID-002 | Valid | Create template with multiple ordered sections | 1. Add 3 sections (e.g. Chief Complaint, Allergy, Medication History) 2. Create | All 3 sections saved in the order entered; this order is reflected when the template is later used in a session | P0 |
| EPIC-13-VALID-003 | Valid | Reorder sections before creating | 1. Add 3 sections 2. Use ↑/↓ to move the 3rd section to position 1 3. Create | Final saved order matches the reordered sequence, not the entry order | P0 |
| EPIC-13-VALID-004 | Valid | Remove a section before creating | 1. Add 3 sections 2. Click "X" on the 2nd section 3. Create | Template saved with only the 2 remaining sections, correctly re-numbered | P1 |
| EPIC-13-VALID-005 | Valid | Create template with Active unchecked | 1. Uncheck "Active" 2. Create | Template saved with Status = Inactive; does not appear in session-creation template dropdown | P1 |
| EPIC-13-VALID-006 | Valid | View an existing template via row "..." menu | 1. Click "..." on a template row 2. Click "View" | Template details (code, name, description, sections) displayed read-only | P1 |
| EPIC-13-VALID-007 | Valid | Deactivate a template via row "..." menu | 1. Click "..." 2. Click "Deactivate" | Status changes to Inactive in the table; template no longer selectable in new sessions | P0 |
| EPIC-13-INVALID-001 | Invalid | Create template with empty Code | 1. Leave Code blank 2. Attempt to create | Inline validation blocks submission | P0 |
| EPIC-13-INVALID-002 | Invalid | Create template with empty Name | 1. Leave Name blank 2. Attempt to create | Inline validation blocks submission | P0 |
| EPIC-13-INVALID-003 | Invalid | Create template with zero sections | 1. Add no sections 2. Attempt to create | Inline validation blocks submission (Sections marked required) | P0 |
| EPIC-13-INVALID-004 | Invalid | Create template with duplicate Code | 1. Use a Code identical to an existing template (e.g. `OPDLHR18`) | Validation error indicating Code must be unique; no duplicate record created | P0 |
| EPIC-13-INVALID-005 | Invalid | Create template API failure (mocked 500) | 1. Mock create-template endpoint to fail | Clear error; modal data retained for retry | P1 |
| EPIC-13-INVALID-006 | Invalid | Section name with script injection | 1. Enter `<script>alert(1)</script>` as a section name 2. Create | Stored/rendered as literal text; no script execution anywhere it's later displayed (admin table, session note) | P0 |
| EPIC-13-EDGE-001 | Edge | Add and remove all sections repeatedly | 1. Add 5 sections, remove all 5, add 2 more | Final state matches only the last 2 added; no leftover empty rows | P2 |
| EPIC-13-EDGE-002 | Edge | Reorder section to the very top, then very bottom | 1. With 4 sections, move section 4 to position 1, then back to position 4 | Up/down controls correctly disable at the respective top/bottom boundary | P2 |
| EPIC-13-EDGE-003 | Edge | Deactivate a template currently mid-use in an open session draft | 1. Doctor has an in-progress session using Template X 2. Admin deactivates Template X | Confirm intended behavior: does the in-progress session continue unaffected, or is the doctor warned? | P2 |
| EPIC-13-EDGE-004 | Edge | Very long Description field | 1. Enter several thousand characters as Description | Field handles gracefully (scrollable textarea), no UI break | P3 |
| EPIC-13-BOUNDARY-001 | Boundary | Template with exactly 1 section (minimum valid) | 1. Add exactly 1 section 2. Create | Accepted as the minimum valid configuration | P1 |
| EPIC-13-BOUNDARY-002 | Boundary | Template with a large number of sections (e.g. 20+) | 1. Add 20+ sections 2. Create | All sections saved correctly in order; UI remains usable (scrollable) without breaking | P2 |
| EPIC-13-BOUNDARY-003 | Boundary | Code field at maximum allowed length | 1. Enter Code at documented max length, then max+1 | Max accepted; max+1 rejected/truncated, not silently dropped | P2 |

---

## 17. API Test Matrix

> **Status: inferred, not yet verified against the live schema.** The staging Swagger UI at `http://stg-api.nurmed.ai/docs` is a client-rendered shell — its underlying `openapi.json`/`openapi.yaml` was not reachable for automated analysis in this session (not publicly indexed, and outside the set of URLs this tool is permitted to fetch directly). Every path, payload, and status code below is **inferred from observed UI behavior**, not confirmed against the real schema. Before any of this is implemented in code, replace this matrix by either (a) pasting the raw OpenAPI JSON/YAML into chat, (b) exporting the Postman/Insomnia collection from Swagger UI and sharing the file, or (c) giving the exact spec file path if it differs from the FastAPI default `/openapi.json`. Section 17.5 below gives the per-commit smoke-suite design so the team can wire this up immediately with whatever subset of confirmed endpoints exists today, without blocking on full schema access.

Every UI flow above implies network calls. These should be tested at the API layer directly (faster, less flaky than UI-driven equivalents) in addition to the E2E coverage above. Exact endpoint paths/payloads need to be confirmed against the actual backend API spec (OpenAPI/Postman collection) before implementation — placeholders below use inferred REST conventions.

| Flow | Method & Endpoint (inferred) | Valid case | Invalid case | Edge/Boundary case |
|---|---|---|---|---|
| Login | `POST /api/auth/login` | 200 + token for correct creds | 401 for wrong creds; 400 for missing fields | Rate-limit headers after repeated failures; very long password string |
| Start session | `POST /api/sessions` | 201 with session id, given MRN/template/language | 400 if any required field missing; 404 if template id invalid/inactive | Duplicate MRN across sessions; concurrent session creation for same MRN |
| Upload/save recording | `POST /api/sessions/{id}/recording` | 200/202, recording stored | 415 for unsupported audio format; 413 for oversized file | Zero-byte audio file; recording at max duration |
| Trigger/poll processing status | `GET /api/sessions/{id}/status` | 200 with `processing`/`completed`/`failed` | 404 for unknown session id | Polling after processing already completed; polling immediately after creation (still `pending`) |
| Get session note | `GET /api/sessions/{id}` | 200 with full structured note matching template sections | 404 for nonexistent id; 403 for a session belonging to another hospital/doctor | Session with partially-failed processing (some fields null) |
| Update note field | `PATCH /api/sessions/{id}/fields/{field}` | 200, field updated | 400 for invalid field name; 422 for value violating server-side rules | Empty string vs. null vs. omitted field — confirm each is handled distinctly |
| Administration AI generate | `POST /api/sessions/{id}/admin-ai/generate` | 200 with generated text, given a prompt | 400 for empty prompt (if disallowed); 500 surfaced cleanly | Prompt with only whitespace; prompt at max length boundary |
| Administration AI add-to-note | `POST /api/sessions/{id}/admin-ai/apply` | 200, note updated | 409 if note was changed concurrently elsewhere — confirm conflict handling | Re-applying identical content twice |
| Optimise Coding suggestions | `GET /api/sessions/{id}/coding-suggestions` | 200 with array of ICD-11-coded suggestions | 404/empty array when nothing applicable | Verify every returned `code` matches ICD-11 pattern; assert API contract test fails the build if a non-ICD-11 code is ever returned |
| Optimise Coding apply | `POST /api/sessions/{id}/coding-suggestions/apply` | 200, selected codes merged into diagnosis field | 400 if `selectedIds` references a suggestion not in the original list | Empty `selectedIds` array; all ids selected |
| View full note | `GET /api/sessions/{id}/full-note` | 200 with consolidated note | 404 for unknown id | Full note for a session with empty optional sections |
| Send to EHR | `POST /api/sessions/{id}/send-to-ehr` | 200/202, session marked sent | 400 if required field missing; 502 if downstream EHR system unreachable (must not silently mark as sent) | Double-submit (idempotency key or equivalent guard expected); resend of already-sent session |
| Doctor list | `GET /api/hospital-admin/doctors` | 200 with paginated/filterable list | 401 if caller lacks Hospital Admin role | Empty result set for filters matching nothing; pagination at last page boundary |
| Add doctor | `POST /api/hospital-admin/doctors` | 201 | 409 for duplicate email; 400 for missing required fields | Email with leading/trailing whitespace; case-insensitive duplicate email check |
| API key list | `GET /api/hospital-admin/api-keys` | 200, key prefixes only (never full secret) returned | 401 if caller lacks Hospital Admin role | Confirm full secret key value is returned exactly once at creation time and never again |
| Create API key | `POST /api/hospital-admin/api-keys` | 201 with key value shown once | 400 for missing Name/Scopes | `expiresAt` in the past rejected at creation; `expiresAt` omitted defaults to never |
| Delete API key | `DELETE /api/hospital-admin/api-keys/{id}` | 200/204 | 404 for already-deleted key (idempotent delete expected, not 500) | Using the key for an in-flight request at the exact moment of deletion |
| Template list | `GET /api/hospital-admin/templates` | 200 | 401 if caller lacks Hospital Admin role | Empty template list (newly provisioned hospital) |
| Create template | `POST /api/hospital-admin/templates` | 201 | 409 for duplicate Code; 400 for zero sections | Section order persisted exactly as submitted array order |
| Deactivate template | `PATCH /api/hospital-admin/templates/{id}` `{status: inactive}` | 200 | 404 for unknown id | Deactivating an already-inactive template (idempotent, not an error) |

**API contract testing note:** every endpoint above should additionally have a JSON-schema assertion test (e.g. via `ajv` or Playwright's `expect(response).toMatchSchema()` pattern) so that a backend change which silently alters a response shape (e.g. renaming a field, or switching coding standard from ICD-11 back to ICD-10) fails CI immediately rather than being caught visually.

---

## 17.5 Quick API Smoke Suite (per-commit, fast layer)

**Purpose.** The full API Test Matrix in Section 17 (every valid/invalid/edge/boundary case per endpoint) is comprehensive but not fast — it's the right depth for a PR-level gate, not for "run on every single commit, in the background, in under two minutes" that you asked for. This section defines a deliberately small, fast, high-signal subset: one happy-path check and one auth/contract check per critical endpoint, nothing else. Its only job is to catch "the build is broken" within minutes of a push, not to replace the full suite.

**Design rules for this layer**

- **Target runtime: under 2 minutes total**, run serially or with light parallelism on a single runner — no browser, no sharding, no matrix.
- **One test per endpoint, two assertions max**: status code is correct, and response shape matches a lightweight JSON-schema check. No exhaustive field-by-field assertions here — that's what the full Section 17 matrix is for.
- **No test data cleanup logic** — every smoke test creates uniquely-suffixed throwaway data (`smoke-${commitSha}-${timestamp}`) and never asserts on or depends on existing staging data, so it's safe to run unattended on every push without a human watching.
- **Fails the build, doesn't just warn** — a smoke suite failure blocks the commit from being considered "green" even though it doesn't block merge by itself (that's the full suite's job per Section 20's branch protection). Treat it as a fast early-warning signal surfaced directly on the commit, not as a merge gate.
- **Runs in the background automatically** — no developer action needed; triggered identically to the full pipeline but as its own short-circuiting first job.

**Smoke suite endpoint list** (pending real schema confirmation — see status note in Section 17; replace `<<TBD>>` paths once the actual OpenAPI spec is available)

| # | Check | Method & endpoint (inferred) | Pass condition | Why it's in the smoke tier |
|---|---|---|---|---|
| 1 | Auth — login succeeds | `POST <<TBD>>/auth/login` | 200 + token present in response | If login is broken, nothing else in the product works — must be caught first |
| 2 | Auth — invalid credentials rejected | `POST <<TBD>>/auth/login` (bad password) | 401, no token leaked | Cheapest possible security regression check |
| 3 | Session — create session | `POST <<TBD>>/sessions` | 201 + session id returned | Core entry point to the entire notes-creation flow |
| 4 | Session — fetch created session | `GET <<TBD>>/sessions/{id}` | 200 + response matches minimal schema (id, mrn, status fields present) | Confirms read path and response contract are intact |
| 5 | Optimise Coding — suggestions endpoint responds | `GET <<TBD>>/sessions/{id}/coding-suggestions` | 200 + array; if non-empty, first item's `code` matches ICD-11 pattern | Directly enforces the ICD-11 requirement on every commit, not just in the full suite |
| 6 | Administration AI — generate endpoint responds | `POST <<TBD>>/sessions/{id}/admin-ai/generate` | 200 + non-empty text field in response | Confirms the AI integration hasn't silently broken |
| 7 | Send to EHR — happy path | `POST <<TBD>>/sessions/{id}/send-to-ehr` | 200/202 + session status reflects "sent" | Highest-value clinical action in the product; must always work |
| 8 | Hospital Admin — doctor list loads | `GET <<TBD>>/hospital-admin/doctors` | 200 + array response | Confirms admin-side auth + read path |
| 9 | Hospital Admin — API key create + delete | `POST` then `DELETE <<TBD>>/hospital-admin/api-keys` | 201 on create, 200/204 on delete | Exercises both write and delete in one fast round-trip |
| 10 | Hospital Admin — template list loads | `GET <<TBD>>/hospital-admin/templates` | 200 + array response | Confirms the third admin sub-domain is reachable |
| 11 | Unauthorized access blocked | `GET <<TBD>>/hospital-admin/doctors` with a doctor-role token (not admin) | 403 | Single fastest possible check that role isolation hasn't regressed |
| 12 | Unknown route returns 404, not 500 | `GET <<TBD>>/sessions/00000000-0000-0000-0000-000000000000` | 404, not 500 | Cheap general-health signal; a 500 here often means the whole error-handling layer broke |

**What's deliberately excluded from this tier** (covered instead by the full Section 17 matrix on PRs): every invalid/edge/boundary case, pagination, filter combinations, expiry-boundary timing, concurrent-write conflict handling, CSV export content verification, and all UI-driven E2E specs. Keeping those out is what makes the 2-minute target achievable — the smoke suite proves the build isn't *broken*, the full suite proves the build is *correct*.

**Example Playwright spec for this tier** (`tests/api/smoke.spec.ts`):

```typescript
import { test, expect, request } from '@playwright/test';

const BASE_URL = process.env.STAGING_API_URL!;
const runId = `${process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'}-${Date.now()}`;
const ICD11_PATTERN = /^[A-Z0-9]{1,4}(\.[A-Z0-9]{1,4})?$/; // confirm against real ICD-11 examples once schema is available

test.describe('Quick API smoke suite — per commit', () => {
  let api: ReturnType<typeof request.newContext> extends Promise<infer T> ? T : never;
  let token: string;
  let sessionId: string;

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: BASE_URL });
  });

  test('1. login succeeds with valid credentials', async () => {
    const res = await api.post('/auth/login', {
      data: { email: process.env.TEST_DOCTOR_EMAIL, password: process.env.TEST_DOCTOR_PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    token = body.token;
  });

  test('2. login rejects invalid credentials', async () => {
    const res = await api.post('/auth/login', {
      data: { email: process.env.TEST_DOCTOR_EMAIL, password: 'wrong-password-smoke-test' },
    });
    expect(res.status()).toBe(401);
  });

  test('3. session creation succeeds', async () => {
    const res = await api.post('/sessions', {
      headers: { Authorization: `Bearer ${token}` },
      data: { mrn: `SMOKE-${runId}`, templateId: process.env.TEST_TEMPLATE_ID, language: 'en' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    sessionId = body.id;
  });

  test('4. session fetch returns expected shape', async () => {
    const res = await api.get(`/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id', sessionId);
    expect(body).toHaveProperty('mrn');
    expect(body).toHaveProperty('status');
  });

  test('5. coding suggestions are ICD-11 formatted', async () => {
    const res = await api.get(`/sessions/${sessionId}/coding-suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const suggestions = await res.json();
    expect(Array.isArray(suggestions)).toBe(true);
    if (suggestions.length > 0) {
      expect(suggestions[0].code).toMatch(ICD11_PATTERN);
    }
  });

  test('11. doctor-role token is rejected on admin-only route', async () => {
    const res = await api.get('/hospital-admin/doctors', {
      headers: { Authorization: `Bearer ${token}` }, // doctor-scoped token
    });
    expect(res.status()).toBe(403);
  });

  test('12. unknown session id returns 404, not 500', async () => {
    const res = await api.get('/sessions/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  test.afterAll(async () => {
    await api.dispose();
  });
});
```

**CI wiring for the smoke tier** — runs as its own job, in parallel with `lint`, ahead of the full `api-tests` and `e2e-tests` jobs, so a developer gets a pass/fail signal within roughly two minutes of pushing, well before the full suite finishes:

```yaml
  smoke-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 3
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Run quick smoke suite
        run: npx playwright test tests/api/smoke.spec.ts --reporter=line
        env:
          STAGING_API_URL: ${{ secrets.STAGING_API_URL }}
          TEST_DOCTOR_EMAIL: ${{ secrets.TEST_DOCTOR_EMAIL }}
          TEST_DOCTOR_PASSWORD: ${{ secrets.TEST_DOCTOR_PASSWORD }}
          TEST_TEMPLATE_ID: ${{ secrets.TEST_TEMPLATE_ID }}
      - name: Post failure summary
        if: failure()
        run: echo "::error::Quick API smoke suite failed — build likely broken. Check job logs before waiting on the full suite."
```

This job has no `needs:` dependency on `lint`, so it starts immediately in parallel and gives the fastest possible signal. The full `api-tests` job from Section 20 still runs independently and remains the actual merge-blocking gate — the smoke suite is an early warning, not a replacement.

---

## 18. Cross-Cutting Non-Functional Test Cases

| ID | Type | Title | Expected Result | Priority |
|---|---|---|---|---|
| NFR-001 | Security | All admin-only endpoints reject doctor-role tokens | 403 returned; verified for every `hospital-admin/*` endpoint | P0 |
| NFR-002 | Security | All hospital-scoped data is hospital-isolated | A user from Hospital A can never read/write Hospital B's sessions, doctors, keys, or templates | P0 |
| NFR-003 | Security | API key secrets are never exposed after creation | Table view always shows only `KEY PREFIX`, never the full key | P0 |
| NFR-004 | Security | XSS sweep across all free-text inputs | Run the script-injection payload across every text field in this document (prompt boxes, MRN, section names, doctor name, key name, template code/name/description) — none execute | P0 |
| NFR-005 | Accessibility | Modals trap focus and are dismissible via Escape | Tab cycles only within an open modal; Escape closes it | P1 |
| NFR-006 | Accessibility | All interactive controls reachable via keyboard | Tab/Shift+Tab/Enter/Space operate every button, checkbox, and dropdown in this document | P2 |
| NFR-007 | Performance | Session list with 100+ sessions loads within SLA | Sidebar renders within an agreed budget (e.g. < 2s) — confirm SLA with team | P2 |
| NFR-008 | Performance | Backend processing completion within SLA | Note generation completes within an agreed budget for a 5-minute recording | P2 |
| NFR-009 | Resilience | Full app behavior under intermittent network | Login, session creation, and EHR send all show clear loading/retry states rather than silent failure | P1 |
| NFR-010 | Data integrity | No orphaned records on any failed multi-step flow | A failed session creation, API key creation, or template creation leaves zero partial DB rows | P1 |

---

## 19. Playwright Project Structure

```
nurmed-e2e/
├── playwright.config.ts
├── package.json
├── .env.example
├── tests/
│   ├── api/
│   │   ├── smoke.spec.ts                     # quick per-commit suite, see Section 17.5
│   │   ├── auth.spec.ts
│   │   ├── sessions.spec.ts
│   │   ├── admin-ai.spec.ts
│   │   ├── coding-suggestions.spec.ts        # asserts ICD-11 contract
│   │   ├── send-to-ehr.spec.ts
│   │   ├── doctors.spec.ts
│   │   ├── api-keys.spec.ts
│   │   └── templates.spec.ts
│   ├── e2e/
│   │   ├── auth/
│   │   │   ├── login.spec.ts
│   │   │   └── role-routing.spec.ts
│   │   ├── notes-creation/
│   │   │   ├── session-creation.spec.ts
│   │   │   ├── mic-permission.spec.ts
│   │   │   ├── recording.spec.ts
│   │   │   ├── note-review.spec.ts
│   │   │   ├── ai-copilot.spec.ts
│   │   │   ├── administration-ai.spec.ts
│   │   │   ├── optimise-coding.spec.ts       # asserts ICD-11 + optional skip
│   │   │   ├── view-full-note.spec.ts
│   │   │   └── send-to-ehr.spec.ts
│   │   └── hospital-admin/
│   │       ├── doctor-management.spec.ts
│   │       ├── api-key-management.spec.ts
│   │       └── template-management.spec.ts
│   ├── fixtures/
│   │   ├── auth.fixture.ts                   # logged-in storageState per role
│   │   ├── test-data.fixture.ts              # unique MRN/key-name/template-code generators
│   │   └── mock-routes.fixture.ts            # shared page.route() mocks for 5xx/timeout cases
│   └── utils/
│       ├── api-client.ts
│       ├── icd11-validator.ts                # regex/format validator reused by API + E2E specs
│       └── selectors.ts
├── docs/
│   └── diagrams/                             # exported SVGs from this document, Section 2
└── .github/
    └── workflows/
        └── playwright.yml
```

**Key conventions**

- Every spec file uses a fresh `storageState` per role (doctor / hospital admin) generated once in a setup project, not via UI login per test — this alone removes a large share of flakiness and runtime.
- Each test generates its own uniquely-suffixed test data (`MRN-${runId}-${testId}`, `key-${runId}`, `TPL-${runId}`) so parallel workers never collide and tests are fully re-runnable without manual cleanup.
- Microphone access for recording tests uses Chromium's `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream` launch flags to deterministically grant mic permission and feed a fake audio stream — never relies on a real device or a real human clicking "Allow."
- API-layer tests (`tests/api/`) run independently of the browser via Playwright's `request` fixture — these are the fast, low-flake layer that should catch most backend regressions before the slower E2E layer even runs.

---

## 20. CI/CD Pipeline Design (GitHub Actions)

**Trigger:** every `push` to any branch and every `pull_request` targeting `main`/`develop` — fully automatic, no manual trigger required, runs in the background on GitHub's runners.

**Pipeline stages**

1. **Lint & type-check** and **Quick API smoke suite** (Section 17.5) — run in parallel, both target under 2-3 minutes, give the earliest possible signal on every single commit
2. **API test suite** (full matrix, Section 17) — runs after smoke passes, blocks the pipeline early on backend contract breaks
3. **E2E test suite** — sharded across multiple parallel jobs by browser (Chromium/Firefox/WebKit) and by test directory, only runs if stage 2 passes
4. **Report & artifact upload** — HTML report, screenshots, and videos for any failure uploaded as a build artifact and linked in the PR check
5. **Required status check** — the PR cannot be merged unless all shards pass (branch protection rule); the smoke suite from stage 1 is surfaced as an early commit-level signal but is not itself a merge gate — the full suite in stages 2-3 is

```yaml
name: Playwright CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main, develop]

concurrency:
  group: playwright-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  smoke-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 3
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Run quick smoke suite
        run: npx playwright test tests/api/smoke.spec.ts --reporter=line
        env:
          STAGING_API_URL: ${{ secrets.STAGING_API_URL }}
          TEST_DOCTOR_EMAIL: ${{ secrets.TEST_DOCTOR_EMAIL }}
          TEST_DOCTOR_PASSWORD: ${{ secrets.TEST_DOCTOR_PASSWORD }}
          TEST_TEMPLATE_ID: ${{ secrets.TEST_TEMPLATE_ID }}
      - name: Post failure summary
        if: failure()
        run: echo "::error::Quick API smoke suite failed — build likely broken. Check job logs before waiting on the full suite."

  api-tests:
    needs: [lint, smoke-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run full API test suite (excludes smoke spec, already covered above)
        run: npx playwright test tests/api --grep-invert "smoke.spec" --reporter=html
        env:
          BASE_URL: ${{ secrets.STAGING_BASE_URL }}
          TEST_DOCTOR_EMAIL: ${{ secrets.TEST_DOCTOR_EMAIL }}
          TEST_DOCTOR_PASSWORD: ${{ secrets.TEST_DOCTOR_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: api-test-report
          path: playwright-report/
          retention-days: 14

  e2e-tests:
    needs: api-tests
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]
        shard: [1/3, 2/3, 3/3]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps ${{ matrix.browser }}
      - name: Run E2E suite (shard)
        run: >
          npx playwright test tests/e2e
          --project=${{ matrix.browser }}
          --shard=${{ matrix.shard }}
          --reporter=html
        env:
          BASE_URL: ${{ secrets.STAGING_BASE_URL }}
          TEST_DOCTOR_EMAIL: ${{ secrets.TEST_DOCTOR_EMAIL }}
          TEST_DOCTOR_PASSWORD: ${{ secrets.TEST_DOCTOR_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-report-${{ matrix.browser }}-${{ strategy.job-index }}
          path: |
            playwright-report/
            test-results/
          retention-days: 14

  required-check:
    needs: [lint, smoke-tests, api-tests, e2e-tests]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Fail if any dependency failed
        if: contains(needs.*.result, 'failure')
        run: exit 1
      - name: All checks passed
        if: ${{ !contains(needs.*.result, 'failure') }}
        run: echo "All test layers passed — safe to merge"
```

**Branch protection setup (one-time, done in GitHub repo settings, not in YAML):**
- Require the `required-check` status check to pass before merging into `main`/`develop`
- Require branches to be up to date before merging
- Optionally require the API layer to pass even before allowing a push to a feature branch's draft PR, to give earliest possible signal

**Secrets required:** `STAGING_BASE_URL`, `TEST_DOCTOR_EMAIL`, `TEST_DOCTOR_PASSWORD` (and a separate Hospital Admin set if using a distinct test account) stored in GitHub repo → Settings → Secrets and variables → Actions.

---

## 21. Flakiness Prevention Checklist

Apply this checklist to every spec file in code review — a PR introducing a new test should not merge if any of these are violated:

- [ ] No hardcoded `page.waitForTimeout(n)` — use `expect(locator).toBeVisible()` / `toHaveText()` with Playwright's built-in auto-waiting instead
- [ ] No shared/static test data (e.g. a fixed MRN like `000126006` reused across parallel tests) — every test generates its own unique identifiers
- [ ] No test depends on the execution order or leftover state of another test — each test is independently runnable via `npx playwright test -g "test name"`
- [ ] Network-dependent negative/edge cases (5xx, timeout, malformed response) are mocked via `page.route()`, not dependent on staging actually being broken in that way
- [ ] Microphone/recording tests use fake-device launch flags, never a real device or manual permission click
- [ ] Assertions target semantic locators (`getByRole`, `getByLabel`, `getByText`) over brittle CSS selectors tied to styling/class names that may change
- [ ] Every test that creates data (session, API key, template, doctor) either cleans up after itself in an `afterEach`/`afterAll`, or is designed to be safely re-runnable without cleanup (uniquely suffixed, non-colliding)
- [ ] Tests asserting on dates/times account for timezone — never assume the CI runner's timezone matches the app's expected timezone
- [ ] Visual/file-download assertions (CSV export, Export Note) check actual content, not just "a file appeared"
- [ ] Retries are configured in `playwright.config.ts` for CI (e.g. `retries: 2`) as a safety net, but a test that needs retries to reliably pass is flagged for a root-cause fix, not left relying on retries indefinitely

---

## 22. Definition of Done per Test

A test case from this document is considered "Done" only when:

1. It is automated in Playwright under the correct directory per Section 19's structure
2. It passes consistently across 10 consecutive CI runs (no flake) before being marked stable
3. It is tagged with its ID from this document (e.g. `test('EPIC-10-VALID-001: full happy path with zero optional tools', ...)`) so failures map directly back to this document
4. It runs unattended in CI on every commit per Section 20 — no manual trigger needed
5. A failure produces a clear, actionable artifact (screenshot + trace + video) attached to the PR check

---

*End of document.*
