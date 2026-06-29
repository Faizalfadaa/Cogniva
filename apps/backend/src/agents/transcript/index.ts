// Full pipeline after session ends:
//
// 1. Fetch raw chat history from DB → RawChatSession
// 2. buildTranscript(session) → TeachingTurn[]
// 3. runEvaluator({ sessionId, turns, referenceMaterial, keyConcepts, commonMisconceptions }) → EvaluationResult
// 4. Save EvaluationResult to DB, update session status to EVALUASI

export * from "./types";
export * from "./transcriptBuilder";
