export function normalizeRoles(role: unknown): string[] {
  if (role == null) return [];
  if (Array.isArray(role)) {
    return role.map((r) => String(r));
  }
  return [String(role)];
}

/**
 * True when the roles array includes `scribe`. Such users may not use the NurMed
 * web dashboard — including combined roles (e.g. `['scribe', 'hospitalAdmin']`).
 */
export function hasScribeRole(role: unknown): boolean {
  return normalizeRoles(role).includes("scribe");
}
