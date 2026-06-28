/**
 * Shared helpers for the data contracts (Architecture Document §6).
 *
 * Contract conventions: camelCase field names on the JSON wire, ISO-8601 (UTC)
 * timestamps, optional fields marked `?`. The TypeScript contracts are defined
 * directly in camelCase, so serialization is a plain JSON.stringify — no alias
 * layer is needed (unlike the previous Python/Pydantic backend).
 */

/** Current time as an ISO-8601 UTC string (time contract, §6). */
export function utcNowIso(): string {
  return new Date().toISOString();
}
