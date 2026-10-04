/** Session — the central object for one teaching session and its state (§6.2). */

import { z } from "zod";
import { sessionStatusSchema } from "./enums.js";

export const sessionSchema = z.object({
  sessionId: z.string(),
  topicId: z.string(),
  status: sessionStatusSchema,
  createdAt: z.string(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  turnCount: z.number().int().default(0),
  /** Total LLM tokens (input + output) this session has spent so far. */
  tokensUsed: z.number().int().default(0),
  /** The most recent evaluation (the latest round). */
  evaluationId: z.string().optional(),
  /**
   * All evaluations for this session, oldest first — one per ended round
   * (resume extension to §6.2). The last entry equals `evaluationId`.
   */
  evaluationIds: z.array(z.string()).default([]),
});

export type Session = z.infer<typeof sessionSchema>;
