// Phrases passed to Azure Speech's PhraseListGrammar to bias recognition toward
// domain-specific vocabulary. Add drug names, conditions, dosage units, common
// clinician/patient names, hospital-specific jargon, abbreviations spoken aloud.
//
// A few hundred entries is a healthy starting size; the SDK accepts thousands.
// One phrase per array entry. Multi-word phrases are fine ("blood pressure cuff").

export const AZURE_PHRASE_LIST: string[] = [
  // e.g. "amoxicillin", "tachycardia", "150 mg", "Dr. Al Mansoori"
];
