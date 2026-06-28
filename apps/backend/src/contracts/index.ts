/**
 * Cogniva inter-component data contracts — backend side (Architecture Document §6).
 *
 * Defined with Zod (runtime validation + inferred TypeScript types), in
 * camelCase to match the JSON wire exactly. These MUST stay in sync with the
 * frontend mirror in apps/frontend/src/contracts/index.ts. Any change to these
 * contracts must be agreed with the tech lead.
 */

export * from "./common.js";
export * from "./enums.js";
export * from "./topic.js";
export * from "./session.js";
export * from "./board.js";
export * from "./speech.js";
export * from "./teaching.js";
export * from "./learner.js";
export * from "./evaluation.js";
export * from "./messages.js";
