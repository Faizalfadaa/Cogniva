import {
  LearnerAction,
  LearnerActionKind,
  LearnerAgentInput,
  LearnerAgentOutput,
  LearnerLLMOutput,
  LearnerResponse,
  LearnerResponseDerivedFrom,
  LearnerResponseStrategy,
  LearnerResponseType,
  LearnerState,
  Misconception
} from "./learner.types";

const allowedResponseTypes: LearnerResponseType[] = [
  "question",
  "confusion",
  "acknowledgment",
  "paraphrase"
];

const allowedActionKinds: LearnerActionKind[] = [
  "respond",
  "reread_board",
  "recall_earlier"
];

const allowedStrategies: LearnerResponseStrategy[] = [
  "ask_clarification",
  "request_example",
  "challenge_claim",
  "paraphrase",
  "attempt_problem"
];

/**
 * Coerce the model's chosen action into a safe shape. Unknown/missing -> the
 * terminal "respond" so a malformed action can never stall the agent loop.
 */
export function normalizeAction(raw: unknown): LearnerAction {
  const a = (raw ?? {}) as Partial<LearnerAction>;
  const kind = allowedActionKinds.includes(a.kind as LearnerActionKind)
    ? (a.kind as LearnerActionKind)
    : "respond";
  return {
    kind,
    focus: typeof a.focus === "string" ? a.focus.trim() : undefined,
    query: typeof a.query === "string" ? a.query.trim() : undefined,
    strategy: allowedStrategies.includes(a.strategy as LearnerResponseStrategy)
      ? (a.strategy as LearnerResponseStrategy)
      : undefined
  };
}

const allowedDerivedFrom: LearnerResponseDerivedFrom[] = [
  "gap",
  "misconception",
  "new_info"
];

const teacherLikePhrases = [
  "you're wrong",
  "you are wrong",
  "the correct answer is",
  "it should be",
  "according to theory",
  "the right answer",
  "the full explanation",
  "the official definition",
  "let's discuss",
  "it can be concluded that",
  "this concept is actually",
  "you should know that",
  "scientifically speaking",
  "according to the reference",
  "the fact is",
  "let me explain",
  "i will explain"
];

export function normalizeLearnerOutput(
  raw: LearnerLLMOutput,
  input: LearnerAgentInput
): LearnerAgentOutput {
  return {
    nextState: normalizeState(raw.nextState, input),
    response: normalizeResponse(raw.response, input)
  };
}

function normalizeState(
  state: Partial<LearnerState> | undefined,
  input: LearnerAgentInput
): LearnerState {
  return {
    sessionId: input.sessionId,
    understoodConcepts: normalizeStringArray(
      state?.understoodConcepts,
      input.currentState.understoodConcepts
    ),
    activeMisconceptions: normalizeMisconceptions(
      state?.activeMisconceptions,
      input.currentState.activeMisconceptions
    ),
    openGaps: normalizeStringArray(
      state?.openGaps,
      input.currentState.openGaps
    ),
    questionsAsked: normalizeStringArray(
      state?.questionsAsked,
      input.currentState.questionsAsked
    ),
    updatedAtTurn: input.turnIndex
  };
}

function normalizeResponse(
  response: LearnerLLMOutput["response"] | undefined,
  input: LearnerAgentInput
): LearnerResponse {
  const safeType = getSafeResponseType(response?.type);
  const safeDerivedFrom = getSafeDerivedFrom(response?.derivedFrom);

  let text =
    typeof response?.text === "string" && response.text.trim()
      ? response.text.trim()
      : createDefaultQuestion(input);

  if (!isLearnerTextSafe(text)) {
    text = createDefaultQuestion(input);
  }

  return {
    responseId: createId("lr"),
    turnIndex: input.turnIndex,
    type: safeType,
    text,
    targetConcept:
      typeof response?.targetConcept === "string"
        ? response.targetConcept.trim()
        : undefined,
    derivedFrom: safeDerivedFrom
  };
}

export function createFallbackOutput(
  input: LearnerAgentInput
): LearnerAgentOutput {
  const fallbackText = createDefaultQuestion(input);

  return {
    nextState: {
      ...input.currentState,
      questionsAsked: [
        ...input.currentState.questionsAsked,
        fallbackText
      ],
      updatedAtTurn: input.turnIndex
    },
    response: {
      responseId: createId("lr"),
      turnIndex: input.turnIndex,
      type: "confusion",
      text: fallbackText,
      targetConcept: "the latest explanation",
      derivedFrom: "gap"
    }
  };
}

export function isLearnerTextSafe(text: string): boolean {
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount > 55) {
    return false;
  }

  return !teacherLikePhrases.some((phrase) =>
    lower.includes(phrase)
  );
}

function getSafeResponseType(value: unknown): LearnerResponseType {
  if (
    typeof value === "string" &&
    allowedResponseTypes.includes(value as LearnerResponseType)
  ) {
    return value as LearnerResponseType;
  }

  return "confusion";
}

function getSafeDerivedFrom(value: unknown): LearnerResponseDerivedFrom {
  if (
    typeof value === "string" &&
    allowedDerivedFrom.includes(value as LearnerResponseDerivedFrom)
  ) {
    return value as LearnerResponseDerivedFrom;
  }

  return "gap";
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return unique(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function normalizeMisconceptions(
  value: unknown,
  fallback: Misconception[]
): Misconception[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  return value
    .filter((item): item is Misconception => {
      return (
        item &&
        typeof item.concept === "string" &&
        typeof item.belief === "string"
      );
    })
    .map((item) => ({
      concept: item.concept.trim(),
      belief: item.belief.trim()
    }))
    .filter((item) => item.concept && item.belief);
}

function createDefaultQuestion(input: LearnerAgentInput): string {
  if (!input.teachingText.trim()) {
    return "I haven't caught the explanation yet. Could you start from the most basic part?";
  }

  return "I'm still a bit confused. Could you explain that part with a simpler example?";
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
