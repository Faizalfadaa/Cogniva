import {
  AskedConcept,
  AskedConceptKind,
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
import {
  isProbingType,
  isRepeatExhausted,
  moveOnText,
  probeKey,
  recordProbe
} from "./learner.repeat";

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

/**
 * How many open gaps the student carries into the next turn.
 *
 * The student picks what to ask from its gaps, and nothing used to remove one
 * except the model deciding to. So gaps from the first topic of a lesson were
 * still there, and still winning, three topics later. Capping the list and
 * keeping it in the order the gaps appeared lets the oldest fall off as newer
 * ones arrive, the way a real student's attention moves with the lesson.
 */
export const MAX_OPEN_GAPS = 5;

const allowedStrategies: LearnerResponseStrategy[] = [
  "ask_clarification",
  "request_example",
  "challenge_claim",
  "paraphrase",
  "attempt_problem",
  "extend_example"
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
  // A question that pushes the concept to a new case is counted under its own
  // budget, so "what about FFFFF?" is not mistaken for asking the same thing a
  // third time (learner.repeat.ts).
  const kind: AskedConceptKind =
    normalizeAction(raw.action).strategy === "extend_example"
      ? "extend"
      : "probe";

  // The response is settled first: the repeat limit can turn a third question
  // into "I get it, let's move on", and the state has to count what was
  // actually said, not what the model proposed.
  const response = normalizeResponse(raw.response, input, kind);

  return {
    nextState: normalizeState(raw.nextState, input, response, kind),
    response
  };
}

function normalizeState(
  state: Partial<LearnerState> | undefined,
  input: LearnerAgentInput,
  response: LearnerResponse,
  kind: AskedConceptKind
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
    openGaps: byRecency(
      normalizeStringArray(state?.openGaps, input.currentState.openGaps),
      input.currentState.openGaps
    ).slice(-MAX_OPEN_GAPS),
    questionsAsked: normalizeStringArray(
      state?.questionsAsked,
      input.currentState.questionsAsked
    ),
    askedConcepts: nextAskedConcepts(input, response, kind),
    updatedAtTurn: input.turnIndex
  };
}

/**
 * Count this turn's question against its concept. Only a question or a stated
 * confusion counts: a paraphrase or an acknowledgment moves the session forward
 * rather than holding the user on the same point.
 */
function nextAskedConcepts(
  input: LearnerAgentInput,
  response: LearnerResponse,
  kind: AskedConceptKind
): AskedConcept[] {
  if (!isProbingType(response.type)) {
    return [...(input.currentState.askedConcepts ?? [])];
  }

  const key = probeKey(response.targetConcept, response.text);

  return recordProbe(
    input.currentState,
    key,
    response.targetConcept?.trim() || "",
    kind
  );
}

function normalizeResponse(
  response: LearnerLLMOutput["response"] | undefined,
  input: LearnerAgentInput,
  kind: AskedConceptKind = "probe"
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

  const targetConcept =
    typeof response?.targetConcept === "string"
      ? response.targetConcept.trim()
      : undefined;

  // Two questions on this concept have already been answered. Asking a third
  // time is what leaves the user stuck, so the student takes the explanation as
  // given and asks for the next material instead (learner.repeat.ts).
  if (
    isProbingType(safeType) &&
    isRepeatExhausted(input.currentState, probeKey(targetConcept, text), kind)
  ) {
    return {
      responseId: createId("lr"),
      turnIndex: input.turnIndex,
      type: "acknowledgment",
      text: moveOnText(targetConcept, input.turnIndex),
      targetConcept,
      derivedFrom: "new_info"
    };
  }

  return {
    responseId: createId("lr"),
    turnIndex: input.turnIndex,
    type: safeType,
    text,
    targetConcept,
    derivedFrom: safeDerivedFrom
  };
}

export function createFallbackOutput(
  input: LearnerAgentInput
): LearnerAgentOutput {
  const targetConcept = "the latest explanation";
  const key = probeKey(targetConcept, "");

  // Even a failed turn respects the limit: three LLM failures in a row would
  // otherwise read as the student asking the same thing three times.
  if (isRepeatExhausted(input.currentState, key)) {
    return {
      nextState: { ...input.currentState, updatedAtTurn: input.turnIndex },
      response: {
        responseId: createId("lr"),
        turnIndex: input.turnIndex,
        type: "acknowledgment",
        text: moveOnText(undefined, input.turnIndex),
        targetConcept,
        derivedFrom: "new_info"
      }
    };
  }

  const fallbackText = createDefaultQuestion(input);

  return {
    nextState: {
      ...input.currentState,
      questionsAsked: [
        ...input.currentState.questionsAsked,
        fallbackText
      ],
      askedConcepts: recordProbe(input.currentState, key, targetConcept),
      updatedAtTurn: input.turnIndex
    },
    response: {
      responseId: createId("lr"),
      turnIndex: input.turnIndex,
      type: "confusion",
      text: fallbackText,
      targetConcept,
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

/**
 * Order `next` oldest first: gaps carried over keep the order they had, and
 * gaps that are new this turn go after them. The model returns the list in
 * whatever order it likes, so without this "the end of the list" would not
 * mean "most recent" and the cap would cut arbitrarily.
 */
export function byRecency(next: string[], previous: string[]): string[] {
  const carried = previous.filter((gap) => next.includes(gap));
  const added = next.filter((gap) => !previous.includes(gap));
  return [...carried, ...added];
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
