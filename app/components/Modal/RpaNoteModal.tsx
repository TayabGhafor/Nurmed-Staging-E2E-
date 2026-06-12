import Modal from ".";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../../hooks/useSession";
import { Patient } from "../../(pages)/(dashboard)/interfaces";
import { SendToEhrRequest } from "../../kyClient/dashboard";
import toast from "react-hot-toast";

interface RpaNoteModalProps {
    onClose: () => void;
    patient: Patient | null;
    /** When set (e.g. EverCare payload from EhrModel), used for sendToEhr instead of legacy Dubai defaults */
    sendToEhrRequest?: SendToEhrRequest;
    /** Refreshes notes in the parent after a successful EHR send (EverCare / hospital-specific flow) */
    fetchAndTransformNotes?: (sessionId: number) => void;
}

type RpaNoteApiResponse = any;

// Celery status from getRpaNotes (Dubai / send-to-EHR flow)
const CELERY_STATUS = {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
} as const;

function isCeleryInProgress(status: string | undefined): boolean {
    if (!status) return false;
    const u = status.toUpperCase();
    return u === CELERY_STATUS.PENDING || u === CELERY_STATUS.PROCESSING;
}



// Mapping for new-style note section keys to user-facing section titles
const apiFieldTitles: { [key: string]: string } = {
    chief_complaint: "Chief Complaint",
    review_of_systems: "Review of Systems",
    allergies: "Allergies",
    medical_history: "Medical History",
    surgical_history: "Surgical History",
    social_habits: "Social Habits",
    medication_history: "Medication History",
    family_history: "Family History",
    physical_exams: "Physical Examination",
    diagnoses: "Diagnoses",
    orders: "Orders",
    procedure_note: "Procedure Note",
    outpatient_referral: "Outpatient Referral",
    evaluation_and_management: "Evaluation and Management",
    admission_request: "Admission Request",
    care_plan: "Care Plan",
    carePlan: "Care Plan"
};

// Helper for category names in review_of_systems/physical_exams, etc.
const categoryTitles: { [key: string]: string } = {
    "Gastrointestinal System": "Gastrointestinal System",
    "Neurological System": "Neurological System",
    "Constitutional": "Constitutional",
    "Cardiovascular System": "Cardiovascular System",
    "Male Genitourinary System": "Male Genitourinary System",
    "Female Genitourinary System": "Female Genitourinary System",
    "Musculoskeletal System": "Musculoskeletal System",
    "Integumentary (Skin & Breast)": "Integumentary (Skin & Breast)",
    "Allergic/Immunologic": "Allergic/Immunologic",
    "Hematologic/Lymphatic System": "Hematologic/Lymphatic System",
    "Psychiatric": "Psychiatric",
    "Eyes": "Eyes",
    "Ear, Nose, Mouth And Throat": "Ear, Nose, Mouth And Throat",
    "Respiratory System": "Respiratory System",
    "Endocrine System": "Endocrine System",
    "Notes": "Notes",
    "Constitutional/General": "Constitutional/General",
    "ENT & Mouth": "ENT & Mouth",
    "Cardiovascular": "Cardiovascular",
    "Gastrointestinal": "Gastrointestinal",
    "Respiratory": "Respiratory",
    "Genitourinary (Female)": "Genitourinary (Female)",
    "Genitourinary (Male)": "Genitourinary (Male)",
    "Musculoskeletal": "Musculoskeletal",
    "Integumentary/Breast/Skin": "Integumentary/Breast/Skin",
    "Hemato/Immunologic/Lymphatic": "Hemato/Immunologic/Lymphatic",
    "Integumentary / Skin / Breast": "Integumentary / Skin / Breast",
    "Ear, Nose,Mouth and Throat": "Ear, Nose, Mouth And Throat",
};

// Helper: test if a value is not empty
function isNonEmpty(val: any): boolean {
    if (val == null) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (Array.isArray(val)) return val.some(isNonEmpty);
    if (typeof val === "object") return Object.values(val).some(isNonEmpty);
    return true;
}

/** EverCare / RPA `request_payload` field codes → section titles */
const EVERCARE_REQUEST_PAYLOAD_LABELS: Record<string, string> = {
    VCOMPLAIN: "Chief complaint",
    VHOPI: "History of present illness",
    VPMDH: "Past Medical, dental and Surgical History",
    VSFH: "Social & family history",
    VALLERGY: "Allergies",
    VICDCODE: "Diagnosis (ICD)",
    VLOCALEXAM: "Local examination",
    VMEDHISTORY: "Medication history",
    VNOTES: "Treatment plan and Goal",
    VINRESULT: "Investigations results",
};

/** Shown only when at least one value is present (live send uses form / send-to-ehr). */
const EVERCARE_IDENTIFIER_KEYS = ["VMRNO", "VENCOUNTERID", "VDRID"] as const;

const EVERCARE_IDENTIFIER_LABELS: Record<string, string> = {
    VMRNO: "MRN",
    VENCOUNTERID: "Encounter ID",
    VDRID: "Doctor (VDR) ID",
};

function evercarePayloadValueIsPresent(val: unknown): boolean {
    if (val == null) return false;
    if (typeof val === "string") return val.trim().length > 0;
    if (Array.isArray(val)) return val.some(evercarePayloadValueIsPresent);
    if (typeof val === "object") return Object.values(val).some(evercarePayloadValueIsPresent);
    return true;
}

/** Turn API strings with `- item` lines into blocks the markdown renderer can style as lists. */
function formatEvercareStringField(text: string): string {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) return "";

    const lines = normalized.split("\n");
    const blocks: string[] = [];
    let bulletLines: string[] = [];
    let proseLines: string[] = [];

    const flushBullets = () => {
        if (bulletLines.length) {
            blocks.push(bulletLines.join("\n"));
            bulletLines = [];
        }
    };
    const flushProse = () => {
        if (proseLines.length) {
            blocks.push(proseLines.join(" "));
            proseLines = [];
        }
    };

    for (const raw of lines) {
        const t = raw.trim();
        if (!t) {
            flushBullets();
            flushProse();
            continue;
        }
        const bulletMatch = t.match(/^[-–•]\s*(.+)$/);
        if (bulletMatch) {
            flushProse();
            bulletLines.push(`- ${bulletMatch[1].trim()}`);
        } else {
            flushBullets();
            proseLines.push(t);
        }
    }
    flushBullets();
    flushProse();

    return blocks.join("\n\n");
}

function formatEvercareAllergyArray(items: unknown[]): string {
    return items
        .map((item) => {
            if (typeof item === "string") return `- ${item.trim()}`;
            if (item !== null && typeof item === "object") {
                const o = item as Record<string, unknown>;
                const categoryId =
                    o.category != null && String(o.category).trim()
                        ? String(o.category).trim()
                        : "";
                const categoryName =
                    o.category_name != null && String(o.category_name).trim()
                        ? String(o.category_name).trim()
                        : "";
                const description =
                    o.description != null && String(o.description).trim()
                        ? String(o.description).trim()
                        : "";

                const categoryLabel = categoryName
                    ? categoryId
                        ? `${categoryName} (${categoryId})`
                        : categoryName
                    : categoryId
                      ? categoryId
                      : "";

                if (categoryLabel && description) {
                    return `- <strong>${categoryLabel}:</strong> ${description}`;
                }
                if (description) return `- ${description}`;
                if (categoryLabel) return `- ${categoryLabel}`;
                return `- ${Object.entries(o)
                    .map(
                        ([k, vv]) =>
                            `<strong>${k}:</strong> ${vv === undefined || vv === null ? "" : String(vv)}`,
                    )
                    .join(", ")}`;
            }
            return `- ${String(item)}`;
        })
        .join("\n");
}

function formatEvercareMedicationArray(items: unknown[]): string {
    return items
        .map((item) => {
            if (typeof item === "string") return `- ${item.trim()}`;
            if (item !== null && typeof item === "object") {
                const o = item as Record<string, unknown>;
                const name = o.name != null ? String(o.name).trim() : "";
                const route = o.route != null ? String(o.route).trim() : "";
                const frequency =
                    o.frequency != null ? String(o.frequency).trim() : "";
                const routeName =
                    o.route_name != null ? String(o.route_name).trim() : "";
                const frequencyName =
                    o.frequency_name != null
                        ? String(o.frequency_name).trim()
                        : "";

                const hasRouteName =
                    Boolean(routeName) && routeName.toLowerCase() !== "unknown";
                const hasRoute =
                    Boolean(route) && route.toLowerCase() !== "unknown";
                const hasFrequencyName =
                    Boolean(frequencyName) &&
                    frequencyName.toLowerCase() !== "unknown";
                const hasFrequency =
                    Boolean(frequency) &&
                    frequency.toLowerCase() !== "unknown";

                let routePart: string | null = null;
                if (hasRouteName && hasRoute) {
                    routePart = `Route: ${routeName} (${route})`;
                } else if (hasRouteName) {
                    routePart = `Route: ${routeName}`;
                } else if (hasRoute) {
                    routePart = `Route: ${route}`;
                }

                let frequencyPart: string | null = null;
                if (hasFrequencyName && hasFrequency) {
                    frequencyPart = `Frequency: ${frequencyName} (${frequency})`;
                } else if (hasFrequencyName) {
                    frequencyPart = `Frequency: ${frequencyName}`;
                } else if (hasFrequency) {
                    frequencyPart = `Frequency: ${frequency}`;
                }

                const parts = [
                    name ? `<strong>${name}</strong>` : null,
                    routePart,
                    frequencyPart,
                ].filter(Boolean);
                if (parts.length) return `- ${parts.join(" · ")}`;
                return `- ${Object.entries(o)
                    .map(
                        ([k, vv]) =>
                            `<strong>${k}:</strong> ${vv === undefined || vv === null ? "" : String(vv)}`,
                    )
                    .join(", ")}`;
            }
            return `- ${String(item)}`;
        })
        .join("\n");
}

/**
 * Detects the new template-driven EverCare response shape, where `notes` is an
 * object whose keys are already human-readable section titles (e.g.
 * "Chief complaint", "Clinical Notes") instead of the legacy snake_case keys
 * or the older V*-key `request_payload` envelope.
 */
function looksLikeTemplatedEvercareNotes(notes: unknown): boolean {
    if (!notes || typeof notes !== "object" || Array.isArray(notes)) return false;
    const keys = Object.keys(notes as Record<string, unknown>);
    if (keys.length === 0) return false;

    const legacyKeys = new Set([
        "chief_complaint",
        "review_of_systems",
        "allergies",
        "medical_history",
        "surgical_history",
        "social_habits",
        "medication_history",
        "family_history",
        "physical_exams",
        "diagnoses",
        "orders",
        "procedure_note",
        "outpatient_referral",
        "evaluation_and_management",
        "admission_request",
        "care_plan",
        "request_payload",
        "send_result",
    ]);

    return (
        keys.every((k) => !legacyKeys.has(k)) &&
        keys.some((k) => /\s/.test(k) || /[A-Z]/.test(k))
    );
}

function looksLikeAllergyItems(items: unknown[]): boolean {
    return items.some((it) => {
        if (!it || typeof it !== "object") return false;
        const o = it as Record<string, unknown>;
        return "category" in o || "category_name" in o;
    });
}

function looksLikeMedicationItems(items: unknown[]): boolean {
    return items.some((it) => {
        if (!it || typeof it !== "object") return false;
        const o = it as Record<string, unknown>;
        return (
            "name" in o &&
            ("route" in o ||
                "frequency" in o ||
                "route_name" in o ||
                "frequency_name" in o)
        );
    });
}

/**
 * Like formatEvercareStringField, but keeps single-line breaks inside a prose
 * paragraph (the V* formatter joins them with a space). Templated clinical
 * notes — e.g. the "Clinical Notes" payload — embed inline labels followed by
 * line breaks; collapsing them would destroy the section structure when
 * rendered with whitespace-pre-wrap.
 */
function formatTemplatedNotesString(text: string): string {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) return "";

    const lines = normalized.split("\n");
    const blocks: string[] = [];
    let bulletLines: string[] = [];
    let proseLines: string[] = [];

    const flushBullets = () => {
        if (bulletLines.length) {
            blocks.push(bulletLines.join("\n"));
            bulletLines = [];
        }
    };
    const flushProse = () => {
        if (proseLines.length) {
            blocks.push(proseLines.join("\n"));
            proseLines = [];
        }
    };

    for (const raw of lines) {
        const t = raw.replace(/\s+$/, "");
        if (!t.trim()) {
            flushBullets();
            flushProse();
            continue;
        }
        const bulletMatch = t.match(/^[-–•]\s*(.+)$/);
        if (bulletMatch) {
            flushProse();
            bulletLines.push(`- ${bulletMatch[1].trim()}`);
        } else {
            flushBullets();
            proseLines.push(t);
        }
    }
    flushBullets();
    flushProse();

    return blocks.join("\n\n");
}

function getMarkdownForTemplatedEvercareNotes(
    notes: Record<string, unknown>,
): string {
    const sections: string[] = [];

    for (const [title, value] of Object.entries(notes)) {
        if (!isNonEmpty(value)) continue;

        let body = "";

        if (Array.isArray(value)) {
            if (looksLikeAllergyItems(value)) {
                body = formatEvercareAllergyArray(value);
            } else if (looksLikeMedicationItems(value)) {
                body = formatEvercareMedicationArray(value);
            } else {
                body = value
                    .map((item) => {
                        if (typeof item === "string") return `- ${item.trim()}`;
                        if (item !== null && typeof item === "object") {
                            return `- ${Object.entries(item as Record<string, unknown>)
                                .map(
                                    ([k, v]) =>
                                        `<strong>${k}:</strong> ${v === null || v === undefined ? "" : String(v)}`,
                                )
                                .join(", ")}`;
                        }
                        return `- ${String(item)}`;
                    })
                    .join("\n");
            }
        } else if (typeof value === "string") {
            body = formatTemplatedNotesString(value);
        } else if (typeof value === "object" && value !== null) {
            body = Object.entries(value as Record<string, unknown>)
                .map(
                    ([k, v]) =>
                        `- <strong>${k}:</strong> ${v === null || v === undefined ? "" : String(v)}`,
                )
                .join("\n");
        } else {
            body = String(value);
        }

        if (body) sections.push(`### ${title}\n${body}`);
    }

    return sections.filter(Boolean).join("\n\n");
}

interface EvercareResolved {
    payload: Record<string, unknown> | null;
    sendResult: Record<string, unknown> | null;
}

function extractEvercareContainer(container: unknown): EvercareResolved | null {
    if (!container || typeof container !== "object" || Array.isArray(container)) {
        return null;
    }
    const c = container as Record<string, unknown>;
    const rp = c.request_payload;
    const sr = c.send_result;
    const hasPayload = rp && typeof rp === "object" && !Array.isArray(rp);
    const hasResult = sr && typeof sr === "object" && !Array.isArray(sr);
    if (!hasPayload && !hasResult) return null;
    return {
        payload: hasPayload ? (rp as Record<string, unknown>) : null,
        sendResult: hasResult ? (sr as Record<string, unknown>) : null,
    };
}

/**
 * Finds EverCare payload + send_result across the known response shapes:
 *   - root: `{ request_payload, send_result }`
 *   - legacy: `notes.request_payload`
 *   - new: `notes.<hospital_key>.request_payload` (e.g. `evercare_lahore_ehr`)
 */
function resolveEvercareData(apiResponse: RpaNoteApiResponse): EvercareResolved {
    if (!apiResponse || typeof apiResponse !== "object") {
        return { payload: null, sendResult: null };
    }

    const direct = extractEvercareContainer(apiResponse);
    if (direct) return direct;

    const legacy = extractEvercareContainer(apiResponse.notes);
    if (legacy) return legacy;

    const notes = apiResponse.notes;
    if (notes && typeof notes === "object" && !Array.isArray(notes)) {
        for (const key of Object.keys(notes)) {
            const inner = extractEvercareContainer(
                (notes as Record<string, unknown>)[key],
            );
            if (inner) return inner;
        }
    }

    return { payload: null, sendResult: null };
}

/** Renders `request_payload` (V* keys) as ### sections; avoids raw JSON. */
function getMarkdownForEvercareRequestPayload(
    payload: Record<string, unknown>,
): string {
    const identifierSet = new Set<string>([...EVERCARE_IDENTIFIER_KEYS]);

    const preferredOrder = [
        "VCOMPLAIN",
        "VHOPI",
        "VPMDH",
        "VSFH",
        "VALLERGY",
        "VICDCODE",
        "VLOCALEXAM",
        "VMEDHISTORY",
        "VNOTES",
    ];

    const extraKeys = Object.keys(payload).filter(
        (k) =>
            !preferredOrder.includes(k) &&
            !identifierSet.has(k),
    );

    const keysOrdered = [
        ...preferredOrder.filter((k) => k in payload && !identifierSet.has(k)),
        ...extraKeys,
    ];

    const sections: string[] = [];

    for (const key of keysOrdered) {
        const val = payload[key];
        if (!evercarePayloadValueIsPresent(val)) continue;

        const title =
            EVERCARE_REQUEST_PAYLOAD_LABELS[key] ||
            key.replace(/^V/, "").replace(/_/g, " ");

        if (key === "VALLERGY" && Array.isArray(val)) {
            sections.push(`### ${title}\n${formatEvercareAllergyArray(val)}`);
            continue;
        }

        if (key === "VMEDHISTORY" && Array.isArray(val)) {
            sections.push(`### ${title}\n${formatEvercareMedicationArray(val)}`);
            continue;
        }

        if (Array.isArray(val)) {
            const lines = val
                .map((item: unknown) => {
                    if (typeof item === "string") return `- ${item.trim()}`;
                    if (item !== null && typeof item === "object") {
                        return `- ${Object.entries(item as Record<string, unknown>)
                            .map(
                                ([k, vv]) =>
                                    `<strong>${k}:</strong> ${vv === undefined || vv === null ? "" : String(vv)}`,
                            )
                            .join(", ")}`;
                    }
                    return `- ${String(item)}`;
                })
                .join("\n");
            sections.push(`### ${title}\n${lines}`);
        } else if (typeof val === "string") {
            let s = val;
            if (
                key === "VNOTES" &&
                !s.includes("\n") &&
                /[.!?]\s*,\s*/.test(s)
            ) {
                s = s.replace(/([.!?])\s*,\s+/g, "$1\n");
            }
            const body = formatEvercareStringField(s);
            if (body) sections.push(`### ${title}\n${body}`);
        } else {
            sections.push(`### ${title}\n${String(val)}`);
        }
    }

    const idLines: string[] = [];
    for (const idKey of EVERCARE_IDENTIFIER_KEYS) {
        const raw = payload[idKey];
        if (!evercarePayloadValueIsPresent(raw)) continue;
        const label = EVERCARE_IDENTIFIER_LABELS[idKey] || idKey;
        idLines.push(`- <strong>${label}:</strong> ${String(raw).trim()}`);
    }
    if (idLines.length) {
        sections.push(`### Record identifiers\n${idLines.join("\n")}`);
    }

    return sections.filter(Boolean).join("\n\n");
}

// Formatting each note section based on known API structure
function getMarkdownForNote(apiResponse: RpaNoteApiResponse): string {
    if (!apiResponse) return "";

    // Older EverCare format: V*-keyed request_payload envelope.
    const evercare = resolveEvercareData(apiResponse);
    if (evercare.payload && Object.keys(evercare.payload).length > 0) {
        const body = getMarkdownForEvercareRequestPayload(evercare.payload);
        if (body) {
            return body;
        }
    }

    // Accepts root object with "notes" key
    const notes = apiResponse.notes || {};
    if (!notes || typeof notes !== "object" || Object.keys(notes).length === 0)
        return "";

    // New template-driven EverCare format: `notes` maps human-readable section
    // titles directly to strings or structured arrays.
    if (looksLikeTemplatedEvercareNotes(notes)) {
        const body = getMarkdownForTemplatedEvercareNotes(
            notes as Record<string, unknown>,
        );
        if (body) return body;
    }

    const sections: string[] = [];

    // Chief complaint
    if (isNonEmpty(notes.chief_complaint)) {
        const cc = notes.chief_complaint;
        let str = "";
        if (Array.isArray(cc.codes)) {
            str += cc.codes
                .map(
                    (c: any) =>
                        `- <strong>${c.description}</strong>${c.onset_date ? `, Onset: ${c.onset_date}` : ""}`
                )
                .join("\n");
        }
        if (cc.rationale) {
            str += (str ? "\n\n" : "") + `<strong>Rationale:</strong> ${cc.rationale}`;
        }
        if (str) sections.push(`### ${apiFieldTitles["chief_complaint"]}\n${str}`);
    }

    // Review of Systems
    if (isNonEmpty(notes.review_of_systems)) {
        const rosArr = Array.isArray(notes.review_of_systems.review_of_systems)
            ? notes.review_of_systems.review_of_systems
            : [];
        let str = rosArr
            .filter((item: any) => isNonEmpty(item.items))
            .map(
                (item: any) =>
                    `<strong>${categoryTitles[item.category] || item.category}:</strong>\n` +
                    item.items.map((v: any) => `- ${v}`).join("\n")
            )
            .join("\n\n");
        if (str) sections.push(`### ${apiFieldTitles["review_of_systems"]}\n${str}`);
    }

    // --- UPDATED diagnoses rendering logic to handle both new and legacy shape ---
    if (isNonEmpty(notes.diagnoses)) {
        let diagnosesArr: any[] = [];

        // The new API can have "primaryDiagnosis" and "otherDiagnosis" arrays
        const d = notes.diagnoses;
        if (Array.isArray(d.primaryDiagnosis) && d.primaryDiagnosis.length > 0) {
            diagnosesArr = diagnosesArr.concat(
                d.primaryDiagnosis.map((dx: any) => ({
                    ...dx,
                    _dxLabel: "Primary Diagnosis"
                }))
            );
        }
        if (Array.isArray(d.otherDiagnosis) && d.otherDiagnosis.length > 0) {
            diagnosesArr = diagnosesArr.concat(
                d.otherDiagnosis.map((dx: any) => ({
                    ...dx,
                    _dxLabel: "Other/Secondary Diagnosis"
                }))
            );
        }
        // For backward compatibility, also check diagnoses.diagnoses
        if (Array.isArray(d.diagnoses) && d.diagnoses.length > 0) {
            diagnosesArr = diagnosesArr.concat(
                d.diagnoses.map((dx: any) => ({
                    ...dx,
                    _dxLabel: dx["Diagnosis Type"] || ""
                }))
            );
        }

        let str = diagnosesArr
            .map((dx: any, idx: number) => {
                let lines = [
                    dx._dxLabel ? `<strong>Type:</strong> ${dx._dxLabel}` : null,
                    dx["Diagnosis Type"] && !dx._dxLabel ? `<strong>Type:</strong> ${dx["Diagnosis Type"]}` : null,
                    dx["Diagnosis Description"] && `<strong>Description:</strong> ${dx["Diagnosis Description"]}`,
                    dx["ICD Code"] && `<strong>ICD Code:</strong> ${dx["ICD Code"]}`,
                    dx["Free Text"] && `<strong>Details:</strong> ${dx["Free Text"]}`,
                    dx["Onset Date"] && `<strong>Onset:</strong> ${dx["Onset Date"]}`,
                    dx["Clinical Status"] && `<strong>Status:</strong> ${dx["Clinical Status"]}`,
                ].filter(Boolean);
                return lines.length === 1 ? lines[0] : lines.map((f) => `- ${f}`).join("\n");
            })
            .join("\n\n");

        if (str) sections.push(`### ${apiFieldTitles["diagnoses"]}\n${str}`);
    }
    // --- END UPDATED diagnoses logic ---

    // Orders
    if (isNonEmpty(notes.orders)) {
        const ordersArr = Array.isArray(notes.orders.orders)
            ? notes.orders.orders
            : [];
        let str = ordersArr
            .map((od: any) => {
                let fields = [
                    od["Diagnosis Type"] && `<strong>Diagnosis Type:</strong> ${od["Diagnosis Type"]}`,
                    od["Diagnosis (ICD)"] && `<strong>Diagnosis (ICD):</strong> ${od["Diagnosis (ICD)"]}`,
                    od["Entered As Free text"] && `<strong>Entered:</strong> ${od["Entered As Free text"]}`,
                    od["Add an Order (Mandatory)"] && `<strong>Order:</strong> ${od["Add an Order (Mandatory)"]}`,
                    od["Order"] && `<strong>Order:</strong> ${od["Order"]}`,
                    od["CPT Code"] && `<strong>CPT Code:</strong> ${od["CPT Code"]}`,
                    od["Internal Code"] && `<strong>Internal Code:</strong> ${od["Internal Code"]}`,
                    od["Clinical Indication"] && `<strong>Clinical Indication:</strong> ${od["Clinical Indication"]}`,
                    od["Internal Description"] && `<strong>Internal Description:</strong> ${od["Internal Description"]}`,
                ].filter(Boolean);
                return fields.length === 1 ? fields[0] : fields.map((f) => `- ${f}`).join("\n");
            })
            .join("\n\n");
        if (str) sections.push(`### ${apiFieldTitles["orders"]}\n${str}`);
    }

    // Physical Examination
    if (isNonEmpty(notes.physical_exams)) {
        const examsArr = Array.isArray(notes.physical_exams.exams)
            ? notes.physical_exams.exams
            : [];
        let str = examsArr
            .map((exam: any) => {
                const cat = exam.component || "Component";
                let lines = [];
                if (cat) lines.push(`<strong>${categoryTitles[cat] || cat}:</strong>`);
                let findings = (exam.findings || []).map((f: any) => `- ${f}`);
                if (findings.length) lines.push(findings.join("\n"));
                return lines.join("\n");
            })
            .join("\n\n");
        if (str) sections.push(`### ${apiFieldTitles["physical_exams"]}\n${str}`);
    }

    // Any additional fields
    Object.entries(notes).forEach(([k, v]) => {
        if (
            [
                "chief_complaint",
                "review_of_systems",
                "diagnoses",
                "orders",
                "physical_exams",
                "request_payload",
                "send_result",
            ].includes(k)
        ) {
            return; // already processed or handled by EverCare formatter
        }
        if (!isNonEmpty(v)) return;

        // If value is directly an array (e.g. allergies: [...]), format it
        if (Array.isArray(v)) {
            let str = v
                .map((item: any) => {
                    if (typeof item === "string") return `- ${item}`;
                    else if (typeof item === "object" && item !== null) {
                        // Format object as key-value pairs
                        return `- ${Object.entries(item)
                            .map(([key, vv]) => `<strong>${key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}:</strong> ${vv}`)
                            .join(", ")}`;
                    } else return `- ${String(item)}`;
                })
                .join("\n");
            if (str) {
                sections.push(
                    `### ${apiFieldTitles[k] ||
                    k.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())
                    }\n${str}`
                );
                return;
            }
        }

        // If value is object with a single array (e.g. allergies: { allergies: [...] }), flatten
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            const oneArrKey = Object.keys(v).find((key) => {
                const val = (v as Record<string, unknown>)[key];
                return Array.isArray(val);
            }) as string | undefined;
            if (oneArrKey) {
                const arr = (v as Record<string, unknown>)[oneArrKey] as unknown[];
                if (isNonEmpty(arr)) {
                    let str = arr
                        .map((item: any) => {
                            if (typeof item === "string") return `- ${item}`;
                            else if (typeof item === "object" && item !== null) {
                                // Format object as key-value pairs
                                return `- ${Object.entries(item)
                                    .map(([key, vv]) => `<strong>${key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}:</strong> ${vv}`)
                                    .join(", ")}`;
                            } else return String(item);
                        })
                        .join("\n");
                    sections.push(
                        `### ${apiFieldTitles[k] ||
                        k.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())
                        }\n${str}`
                    );
                    return;
                }
            }
        }

        // Fallback: simple
        let valStr = typeof v === "object" ? JSON.stringify(v, null, 2) : String(v);
        sections.push(
            `### ${apiFieldTitles[k] ||
            k.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())
            }\n${valStr}`
        );
    });

    return sections.filter(Boolean).join("\n\n");
}

// markdownToReactElements for our markup (our markdown is mainly <strong> and - list items)
function markdownToReactElements(markdown: string) {
    if (!markdown) return null;
    const sections = markdown.split(/^(?=### )/m).filter(Boolean);

    return sections.map((section, i) => {
        const match = section.match(/^### (.+)\n([\s\S]*)$/);
        if (!match) return null;
        const [_, heading, content] = match;
        const contentParts = content
            .trim()
            .split(/\n{2,}/)
            .map((block, j) => {
                // Bold fields and lists
                const htmlBlock = block
                    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>") // legacy
                    .replace(/<strong>(.+?)<\/strong>/g, "<strong>$1</strong>") // new
                    .replace(/^- (.+)$/gm, "<li>$1</li>");
                if (/<li>/.test(htmlBlock)) {
                    return (
                        <ul
                            key={j}
                            className="mb-2 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-secondary-100 marker:text-primary-100"
                            dangerouslySetInnerHTML={{ __html: htmlBlock }}
                        />
                    );
                }
                return (
                    <p
                        key={j}
                        className="mb-2 whitespace-pre-wrap text-[14px] leading-relaxed text-secondary-100"
                        dangerouslySetInnerHTML={{ __html: htmlBlock }}
                    />
                );
            });
        return (
            <div
                key={i}
                className="border-b border-gray-100 py-3 first:pt-1 last:border-b-0 last:pb-1"
            >
                <h3 className="mb-2.5 text-[15px] font-semibold tracking-tight text-[#19213D]">
                    {heading}
                </h3>
                {contentParts}
            </div>
        );
    });
}

type EhrSendPhase = "idle" | "sending" | "polling" | "success" | "failed";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 120; // 5 min at 2.5s

const RpaNoteModal = ({
    onClose,
    patient,
    sendToEhrRequest,
    fetchAndTransformNotes,
}: RpaNoteModalProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [noteData, setNoteData] = useState<RpaNoteApiResponse | null>(null);
    const [isReviewed, setIsReviewed] = useState(false);
    const [ehrSendPhase, setEhrSendPhase] = useState<EhrSendPhase>("idle");
    const [isInitialReviewNotesPolling, setIsInitialReviewNotesPolling] =
        useState(false);
    const [celeryErrorMessage, setCeleryErrorMessage] = useState<string | null>(null);
    const pollAttemptsRef = useRef(0);
    const pollingSourceRef = useRef<"initial" | "send" | null>(null);

    const { getRpaNotes, rpaNotes, rpaNotesLoading, rpaNotesError,
        sendToEhr, sendToEhrLoading, sendToEhrError, sendToEhrResult } = useSession();

    const isSendingOrPolling = ehrSendPhase === "sending" || ehrSendPhase === "polling";

    const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const pollCeleryStatus = useCallback(async (): Promise<{ status: string; data: RpaNoteApiResponse | null }> => {
        if (!patient?.id) return { status: "", data: null };
        const data = await getRpaNotes(patient.id);
        const status = (data?.celery_status ?? "") as string;
        return { status, data };
    }, [patient?.id, getRpaNotes]);

    const runPollLoop = useCallback(() => {
        if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
            setCeleryErrorMessage("Request is taking longer than expected. Please check back later or contact support.");
            setEhrSendPhase("failed");
            setIsInitialReviewNotesPolling(false);
            pollingSourceRef.current = null;
            return;
        }
        pollAttemptsRef.current += 1;

        pollCeleryStatus()
            .then(({ status, data }: { status: string; data: RpaNoteApiResponse | null }) => {
                const statusUpper = (status || "").toUpperCase();

                if (statusUpper === CELERY_STATUS.SUCCESS) {
                    if (data) setNoteData(data);
                    if (pollingSourceRef.current === "initial") {
                        setEhrSendPhase("idle");
                        setIsInitialReviewNotesPolling(false);
                        pollingSourceRef.current = null;
                    } else {
                        if (pollingSourceRef.current === "send" && patient?.id) {
                            fetchAndTransformNotes?.(Number(patient.id));
                            if (sendToEhrRequest) {
                                toast.success("Successfully sent to EHR!", {
                                    duration: 1000,
                                    position: "bottom-right",
                                });
                            }
                        }
                        pollingSourceRef.current = null;
                        setEhrSendPhase("success");
                    }
                    return;
                }
                if (statusUpper === CELERY_STATUS.FAILED) {
                    const reason = data?.celery_failed_reason ?? data?.failure_reason ?? "Processing failed.";
                    setCeleryErrorMessage(reason ?? "Processing failed.");
                    setEhrSendPhase("failed");
                    setIsInitialReviewNotesPolling(false);
                    pollingSourceRef.current = null;
                    return;
                }

                pollTimeoutRef.current = setTimeout(runPollLoop, POLL_INTERVAL_MS);
            })
            .catch((err: unknown) => {
                console.error("Error polling RPA status:", err);
                setCeleryErrorMessage("Failed to check status. Please try again.");
                setEhrSendPhase("failed");
                setIsInitialReviewNotesPolling(false);
                pollingSourceRef.current = null;
            });
    }, [pollCeleryStatus, fetchAndTransformNotes, patient?.id, sendToEhrRequest]);

    const handleClose = () => {
        setEhrSendPhase("idle");
        setIsInitialReviewNotesPolling(false);
        setCeleryErrorMessage(null);
        pollAttemptsRef.current = 0;
        pollingSourceRef.current = null;
        onClose();
    };

    // Guards against React StrictMode's intentional double-fire of effects in
    // dev (which otherwise hits rpa_notes/<id> twice on every modal open and
    // could kick off two concurrent poll loops sharing pollAttemptsRef).
    // Keyed by patient.id so reopening for a different session still fetches.
    const loadedPatientIdRef = useRef<string | null>(null);

    useEffect(() => {
        const fetchRpaNotes = async () => {
            if (!patient?.id) {
                setIsLoading(false);
                return;
            }
            const id = String(patient.id);
            if (loadedPatientIdRef.current === id) return;
            loadedPatientIdRef.current = id;

            try {
                setIsLoading(true);
                const ret = await getRpaNotes(patient.id);

                if (ret && typeof ret === "object") {
                    const celeryStatus = (ret.celery_status ?? ret.status ?? "") as string;
                    if (isCeleryInProgress(celeryStatus)) {
                        setEhrSendPhase("polling");
                        setIsInitialReviewNotesPolling(true);
                        pollingSourceRef.current = "initial";
                        pollAttemptsRef.current = 0;
                        setIsLoading(false);
                        runPollLoop();
                        return;
                    }
                    setNoteData(ret);
                } else if (rpaNotes && typeof rpaNotes === "object") {
                    setNoteData(rpaNotes);
                }
            } catch {
                // handled by rpaNotesError below
            } finally {
                setIsLoading(false);
            }
        };

        fetchRpaNotes();
    }, [patient?.id, getRpaNotes, runPollLoop]);

    useEffect(() => {
        return () => {
            if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
        };
    }, []);

    const handleYesProcessed = async () => {
        if (!patient?.id) {
            console.error("Session ID is undefined, cannot send to EHR");
            return;
        }

        setCeleryErrorMessage(null);
        pollAttemptsRef.current = 0;

        const legacyDubaiPayload: SendToEhrRequest = {
            hospital: "YAS",
            mrn: patient.mrn,
            vdr_id: "36",
            encounter_id: "N-1234",
        };
        const payload = sendToEhrRequest ?? legacyDubaiPayload;

        try {
            setEhrSendPhase("sending");

            const result = await sendToEhr(Number(patient.id), payload);

            if (!result) {
                setEhrSendPhase("idle");
                if (sendToEhrRequest) {
                    toast.error("Error sending to EHR!", {
                        duration: 1000,
                        position: "bottom-right",
                    });
                }
                return;
            }

            console.log("Result of Send to EHR", result);
            setEhrSendPhase("polling");
            pollingSourceRef.current = "send";
            runPollLoop();
        } catch (error) {
            console.error("Error sending to EHR:", error);
            setEhrSendPhase("idle");
            if (sendToEhrRequest) {
                toast.error("Error sending to EHR!", {
                    duration: 1000,
                    position: "bottom-right",
                });
            }
        }
    };

    const isEverCareFlow = Boolean(sendToEhrRequest);

    // Convert data to markdown
    const markdown = noteData ? getMarkdownForNote(noteData) : "";

    const showEhrLoader = isSendingOrPolling;
    const ehrPhaseLoaderLabel =
        ehrSendPhase === "sending"
            ? "Sending to EHR..."
            : isInitialReviewNotesPolling
              ? "Loading review notes..."
              : "Processing...";

    const reviewNotesFetchLoaderLabel = isEverCareFlow
        ? "Loading review notes..."
        : "Loading notes...";

    const renderPreviewLoader = (title: string) => (
        <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 px-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-100 border-t-transparent" />
            <p className="text-center text-sm font-medium text-gray-700">{title}</p>
            <p className="text-center text-xs text-gray-500">
                Please wait. This may take a moment.
            </p>
        </div>
    );

    return (
        <Modal
            className="flex max-h-[80vh] w-ull flex-col bg-white sm:rounded-lg"
            onClose={handleClose}
        >
            {showEhrLoader ? (
                renderPreviewLoader(ehrPhaseLoaderLabel)
            ) : ehrSendPhase === "failed" ? (
                <div className="flex flex-col gap-4 p-6">
                    <h2 className="border-b border-gray-200 pb-2 text-center text-lg font-medium text-[#19213D] sm:text-xl">
                        Send to EHR
                    </h2>
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <p className="text-center text-sm font-medium text-gray-800">Could not complete request</p>
                        <p className="text-center text-xs text-gray-600">{celeryErrorMessage ?? "An error occurred."}</p>
                    </div>
                    <div className="flex justify-end border-t border-gray-200 pt-4">
                        <button
                            onClick={handleClose}
                            className="rounded-lg border border-primary-100 bg-primary-100 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 sm:px-6"
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : ehrSendPhase === "success" ? (
                <div className="flex flex-col gap-4 p-6">
                    <h2 className="border-b border-gray-200 pb-2 text-center text-lg font-medium text-[#19213D] sm:text-xl">
                        Send to EHR
                    </h2>
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-center text-sm font-medium text-gray-800">Successfully sent to EHR</p>
                    </div>
                    <div className="flex justify-end border-t border-gray-200 pt-4">
                        <button
                            onClick={handleClose}
                            className="rounded-lg border border-primary-100 bg-primary-100 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 sm:px-6"
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : isLoading || rpaNotesLoading ? (
                renderPreviewLoader(reviewNotesFetchLoaderLabel)
            ) : (
                <>
                    <h2 className="border-b border-gray-200 py-2 text-center text-lg font-medium sm:text-xl md:text-2xl">
                        Review Notes
                    </h2>
                    <div className="flex-1 overflow-y-auto">
                        {rpaNotesError ? (
                            <div className="flex h-full w-full items-center justify-center p-6 text-center">
                                <p className="text-red-500">
                                    An error occurred while loading Full Notes data. Please try
                                    again.
                                </p>
                            </div>
                        ) : markdown ? (
                            <div className="shadow-xs rounded-xl border border-gray-100 bg-slate-50/60 px-3 py-2 sm:px-5 sm:py-4">
                                {markdownToReactElements(markdown)}
                            </div>
                        ) : (
                            <div className="shadow-xs rounded-lg border border-gray-200 bg-white p-4 sm:p-6">
                                <p className="text-secondary-100">
                                    No full note data available for this session.
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-gray-200 bg-white p-2">
                        <div className="mb-4 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="review-checkbox"
                                checked={isReviewed}
                                onChange={(e) => setIsReviewed(e.target.checked)}
                                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-100 focus:ring-primary-100"
                                disabled={isSendingOrPolling}
                            />
                            <label
                                htmlFor="review-checkbox"
                                className="cursor-pointer text-sm text-gray-700"
                            >
                                I have read and reviewed all the notes
                            </label>
                        </div>
                        <div className="flex w-full items-center justify-end gap-4">
                            <button
                                onClick={handleClose}
                                disabled={isSendingOrPolling}
                                className="flex items-center justify-center rounded-lg border border-primary-100 px-4 py-2 text-sm font-medium text-primary-100 shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed sm:px-6"
                            >
                                {isEverCareFlow ? "Cancel" : "Close"}
                            </button>
                            <button
                                onClick={handleYesProcessed}
                                disabled={!isReviewed || isSendingOrPolling}
                                className="flex items-center justify-center gap-2 rounded-lg border border-primary-100 bg-primary-100 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed sm:px-6"
                            >
                                {isSendingOrPolling && (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                )}
                                {isSendingOrPolling
                                    ? "Sending..."
                                    : isEverCareFlow
                                      ? "Send to EHR"
                                      : "Yes, Proceed"}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </Modal>
    );
}

export default RpaNoteModal;