/** Centralized LLM-call wrapper (Architecture Document §3.3, §7.3). */

export { LLMClient, LLMError } from "./providers/gemini.js";
export type {
  GenAILike,
  LLM,
  LLMClientOptions,
  StructuredArgs,
} from "./providers/gemini.js";
