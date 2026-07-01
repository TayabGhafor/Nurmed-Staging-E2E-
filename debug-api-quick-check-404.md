# Debug Session: API Quick Check 404

Status: [OPEN]

## Symptom

The quick API coverage suite runs, but many expected success checks fail with `404 Not Found` against the configured staging API target.

## Scope

- `tests/api/quick-check.spec.ts`
- `tests/lib/api-quick-check.ts`
- API environment/base URL resolution

## Initial Evidence

- Live quick-check run reached the server and logged responses.
- Several positive endpoints returned `404`.
- Some negative-path checks also returned `404`, which may indicate a base URL or route-prefix mismatch rather than per-endpoint contract failures.

## Hypotheses

1. The resolved API base URL is wrong for the backend routes used by the frontend tests.
2. The backend requires an additional path prefix or a different versioned base than `.../api/v1`.
3. Some routes are frontend-client paths that do not exist on the deployed staging backend as written.
4. Auth succeeded at the token layer, but the bearer token does not map to the backend environment serving these routes.
5. A subset of endpoints may be intentionally unavailable in staging, so the suite needs route-specific expectations rather than assuming `200`.

## Plan

1. Capture the exact resolved base URL and per-request final URL at runtime.
2. Compare failing endpoints with the older API helper/tests and frontend client configuration.
3. Fix the suite only after evidence confirms whether the issue is base resolution, path mapping, or expectation logic.

## Evidence Review

- `.dbg/trae-debug-log-api-quick-check-404.ndjson:2` shows `self` resolved to `https://stg-api.nurmed.ai/api/self`.
- `.dbg/trae-debug-log-api-quick-check-404.ndjson:16` shows `session/list?limit=20` resolved to `https://stg-api.nurmed.ai/api/session/list?limit=20`.
- `.dbg/trae-debug-log-api-quick-check-404.ndjson:30` shows `template/setup` resolved to `https://stg-api.nurmed.ai/api/template/setup`.

These logs prove the request context is dropping the trailing `v1` path segment from the configured base.

## Hypothesis Status

- H1: The resolved API base URL is wrong for the backend routes used by the frontend tests. -> CONFIRMED
- H2: The backend requires an additional path prefix or a different versioned base than `.../api/v1`. -> REJECTED for the quick-check harness; the configured value already contains `v1`, but URL resolution strips it.
- H3: Some routes are frontend-client paths that do not exist on the deployed staging backend as written. -> INCONCLUSIVE until the `v1` loss is fixed.
- H4: Auth succeeded at the token layer, but the bearer token does not map to the backend environment serving these routes. -> INCONCLUSIVE
- H5: A subset of endpoints may be intentionally unavailable in staging, so the suite needs route-specific expectations rather than assuming `200`. -> INCONCLUSIVE

## Post-Fix Verification

- After normalizing the Playwright request context to use a trailing slash, the quick-check suite now resolves requests under `https://stg-api.nurmed.ai/api/v1/...` correctly.
- The suite no longer fails on false negatives caused by URL resolution, template/API-key response parsing, or API-key discovery.

### Remaining Failing Endpoints

1. `GET speciality/` -> `500` with `relation "public.speciality" does not exist`
2. `POST session/generate-realtime-update-session/999999999` -> `500 Internal Server Error`
3. `PUT session/update_session/999999999` -> `500 Internal Server Error`
4. `GET scribe/get_scribes` -> `500` with `relation "public.scribe" does not exist`

## Current Conclusion

The quick-check harness is now functioning correctly and accurately. The remaining failures are live backend health issues in staging, not test-resolution bugs in the new suite.
