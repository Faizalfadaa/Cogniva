// Shared error shape for the teaching session, mirroring whiteboardTypes.ts:
// the hooks raise these and ErrorBanner renders them, so neither has to import
// the other.

export type SessionErrorKind =
  /** The session ran out of its token budget (backend errorKind). */
  | 'budget_exceeded'
  /** The browser is offline. */
  | 'network'
  /** The request reached nobody, or the backend answered with a failure. */
  | 'ai_unavailable'

export interface SessionError {
  kind: SessionErrorKind
  /** Raw error text, shown small for bug reports. Absent for non-exceptions. */
  detail?: string
}
