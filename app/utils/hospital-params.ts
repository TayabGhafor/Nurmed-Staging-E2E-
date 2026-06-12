/**
 * Utility functions for handling hospital redirect parameters
 */

export interface HospitalParams {
    mrn?: string;
    template?: string;
    doctorId?: string;
    encounterId?: string;
    new?: string;
    language?: string;
  }
  
  /**
   * Parse hospital parameters from URL search params
   */
  export function parseHospitalParams(searchParams: URLSearchParams): HospitalParams {
    const params: HospitalParams = {};

    if (searchParams.has('mrn')) {
      params.mrn = searchParams.get('mrn') || undefined;
    }
    if (searchParams.has('template')) {
      params.template = searchParams.get('template') || undefined;
    }
    // Accept both camelCase (doctorId) and snake_case (doctor_id) variants
    if (searchParams.has('doctorId') || searchParams.has('doctor_id')) {
      params.doctorId =
        searchParams.get('doctorId') ||
        searchParams.get('doctor_id') ||
        undefined;
    }
    if (searchParams.has('encounterId') || searchParams.has('encounter_id')) {
      params.encounterId =
        searchParams.get('encounterId') ||
        searchParams.get('encounter_id') ||
        undefined;
    }
    if (searchParams.has('new')) {
      params.new = searchParams.get('new') || undefined;
    }
    if (searchParams.has('language')) {
      params.language = searchParams.get('language') || undefined;
    }

    return params;
  }
  
  /**
   * Check if URL contains hospital parameters
   */
  export function hasHospitalParams(searchParams: URLSearchParams): boolean {
    const hospitalParamKeys = ['mrn', 'template', 'doctorId', 'encounterId', 'new'];
    return hospitalParamKeys.some(key => searchParams.has(key));
  }
  
  /**
   * Check if this is a new session request from hospital
   */
  export function isNewHospitalSession(searchParams: URLSearchParams): boolean {
    return searchParams.get('new') === 'true';
  }
  
  /**
   * Store hospital parameters in session storage for later use
   */
  export function storeHospitalParams(params: HospitalParams): void {
    if (Object.keys(params).length > 0) {
      sessionStorage.setItem('hospitalParams', JSON.stringify(params));
    }
  }
  
  /**
   * Retrieve stored hospital parameters from session storage
   */
  export function getStoredHospitalParams(): HospitalParams | null {
    try {
      const stored = sessionStorage.getItem('hospitalParams');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error retrieving stored hospital params:', error);
      return null;
    }
  }
  
  /**
   * Clear stored hospital parameters from session storage
   */
  export function clearStoredHospitalParams(): void {
    sessionStorage.removeItem('hospitalParams');
  }
  
  /**
   * Build URL with hospital parameters for redirect
   */
  export function buildHospitalUrl(baseUrl: string, params: HospitalParams): string {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });
    return url.toString();
  }
  
  /**
   * Remove hospital parameters from current URL without causing a page reload.
   * Also clears the magic-link sessionStorage params so the fallback path in
   * `getHospitalParamsFromUrl()` doesn't reintroduce them on the next read.
   */
  export function clearHospitalParamsFromUrl(): void {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const hospitalParamKeys = [
        'mrn',
        'template',
        'doctorId',
        'doctor_id',
        'encounterId',
        'encounter_id',
        'language',
        'new',
      ];

      hospitalParamKeys.forEach(key => {
        url.searchParams.delete(key);
      });

      // Update URL without causing page reload
      window.history.replaceState({}, '', url.pathname + url.search);

      clearMagicLinkHospitalParams();
    }
  }
  
  /**
   * Read magic-link hospital params that were stashed in sessionStorage by
   * the callback / MagicLinkHandler when the URL was cleared post-auth.
   * Keys are populated in `app/(pages)/(auth)/callback/page.tsx` and
   * `app/components/MagicLinkHandler.tsx`.
   */
  export function getHospitalParamsFromMagicLinkStorage(): HospitalParams {
    if (typeof window === 'undefined') return {};
    const params: HospitalParams = {};

    const mrn = sessionStorage.getItem('magic_link_mrn');
    const template = sessionStorage.getItem('magic_link_template');
    const language = sessionStorage.getItem('magic_link_language');
    const encounterId = sessionStorage.getItem('magic_link_encounter_id');
    const doctorId = sessionStorage.getItem('magic_link_doctor_id');

    if (mrn) params.mrn = mrn;
    if (template) params.template = template;
    if (language) params.language = language;
    if (encounterId) params.encounterId = encounterId;
    if (doctorId) params.doctorId = doctorId;

    // Also merge anything from the opaque `params` JSON blob (snake_case or camelCase)
    const paramsBlob = sessionStorage.getItem('magic_link_params');
    if (paramsBlob) {
      try {
        const parsed = JSON.parse(paramsBlob) as Record<string, unknown>;
        if (!params.mrn && typeof parsed.mrn === 'string') params.mrn = parsed.mrn;
        if (!params.template && typeof parsed.template === 'string') params.template = parsed.template;
        if (!params.language && typeof parsed.language === 'string') params.language = parsed.language;
        if (!params.encounterId) {
          const v = parsed.encounterId ?? parsed.encounter_id;
          if (typeof v === 'string') params.encounterId = v;
        }
        if (!params.doctorId) {
          const v = parsed.doctorId ?? parsed.doctor_id;
          if (typeof v === 'string') params.doctorId = v;
        }
      } catch {
        // Ignore invalid JSON
      }
    }

    return params;
  }

  /**
   * Clear the magic-link hospital params from sessionStorage. Call after the
   * params have been consumed (e.g. after a recording session is started)
   * so a subsequent recording doesn't pick up stale values.
   */
  export function clearMagicLinkHospitalParams(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('magic_link_mrn');
    sessionStorage.removeItem('magic_link_template');
    sessionStorage.removeItem('magic_link_language');
    sessionStorage.removeItem('magic_link_encounter_id');
    sessionStorage.removeItem('magic_link_doctor_id');
    sessionStorage.removeItem('magic_link_params');
  }

  /**
   * Get hospital parameters from the current URL, falling back to params
   * stashed in sessionStorage by the magic-link auth flow (which clears
   * the URL after authentication).
   */
  export function getHospitalParamsFromUrl(): HospitalParams {
    if (typeof window === 'undefined') return {};

    const searchParams = new URLSearchParams(window.location.search);
    const fromUrl = parseHospitalParams(searchParams);

    if (Object.keys(fromUrl).length > 0) {
      return fromUrl;
    }

    return getHospitalParamsFromMagicLinkStorage();
  }