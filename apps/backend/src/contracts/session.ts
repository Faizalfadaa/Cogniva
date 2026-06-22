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
  evaluationId: z.string().optional(),
});

export type Session = z.infer<typeof sessionSchema>;
