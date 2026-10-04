/** Centralized LLM-call wrapper (Architecture Document §3.3, §7.3). */

export { LLMClient, LLMError, EmbeddingClient, normalize } from "./providers/gemini.js";
export type {
  GenAILike,
  LLM,
  LLMClientOptions,
  StructuredArgs,
  EmbedArgs,
  Embedder,
  EmbeddingClientOptions,
  EmbeddingTask,
  GroundedArgs,
  GroundedResult,
  GroundedSource,
} from "./providers/gemini.js";
