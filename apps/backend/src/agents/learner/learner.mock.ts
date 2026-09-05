import {
  LearnerAgentInput,
  LearnerLLMOutput,
  LearnerState
} from "./learner.types";

export function mockLearnerAI(input: LearnerAgentInput): LearnerLLMOutput {
  const text = input.teachingText.trim();

  const nextState: LearnerState = {
    ...input.currentState,
    understoodConcepts: [...input.currentState.understoodConcepts],
    activeMisconceptions: [...input.currentState.activeMisconceptions],
    openGaps: [...input.currentState.openGaps],
    questionsAsked: [...input.currentState.questionsAsked],
    updatedAtTurn: input.turnIndex
  };

  if (!text) {
    const question =
      "I haven't gotten the explanation yet. Could you start from the very basics?";

    addUnique(nextState.openGaps, "the basics");
    addUnique(nextState.questionsAsked, question);

    return {
      nextState,
      action: { kind: "respond", strategy: "ask_clarification" },
      response: {
        type: "question",
        text: question,
        targetConcept: "the basics",
        derivedFrom: "gap"
      }
    };
  }

  const concept = extractPossibleConcept(text);
  const unclearTerm = extractUnclearTerm(text);

  if (concept) {
    addUnique(nextState.understoodConcepts, concept);
  }

  if (unclearTerm) {
    addUnique(nextState.openGaps, unclearTerm);
  }

  const responseText = createMockResponse(concept, unclearTerm, input.turnIndex);
  if (unclearTerm) {
    addUnique(nextState.questionsAsked, responseText);
  }

  // Agentic demo (offline): on the first step, if a directed board re-read is
  // available and there's an unclear term, investigate it before asking — so the
  // tool loop is exercised even without an LLM. After observing (or with no tool
  // available) the student responds normally.
  const canReread = (input.availableTools ?? []).includes("reread_board");
  const alreadyInvestigated = (input.observations ?? []).length > 0;
  if (unclearTerm && canReread && !alreadyInvestigated) {
    return {
      nextState,
      action: { kind: "reread_board", focus: unclearTerm },
      response: {
        type: "question",
        text: responseText,
        targetConcept: unclearTerm,
        derivedFrom: "gap"
      }
    };
  }

  return {
    nextState,
    action: {
      kind: "respond",
      strategy: unclearTerm ? "ask_clarification" : "paraphrase"
    },
    response: {
      type: unclearTerm ? "question" : "paraphrase",
      text: responseText,
      targetConcept: unclearTerm ?? concept ?? "the latest explanation",
      derivedFrom: unclearTerm ? "gap" : "new_info"
    }
  };
}

function extractPossibleConcept(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();

  const patterns = [
    /(.+?)\s+is\s+(.+)/i,
    /(.+?)\s+are\s+(.+)/i,
    /(.+?)\s+means\s+(.+)/i,
    // Indonesian fallbacks (kept so mixed input still extracts a concept).
    /(.+?)\s+adalah\s+(.+)/i,
    /(.+?)\s+merupakan\s+(.+)/i
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1]) {
      return cleanupConcept(match[1]);
    }
  }

  const words = normalized
    .split(/\s+/)
    .map((word) => word.replace(/[.,!?]/g, ""))
    .filter(Boolean);

  if (words.length >= 3) {
    return words.slice(0, 4).join(" ");
  }

  return null;
}

function extractUnclearTerm(text: string): string | null {
  const quoted = text.match(/"([^"]+)"/);

  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const words = text
    .split(/\s+/)
    .map((word) => word.replace(/[.,!?]/g, ""))
    .filter(Boolean);

  return words.find((word) => word.length > 10) ?? null;
}

function createMockResponse(
  concept: string | null,
  unclearTerm: string | null,
  turnIndex: number
): string {
  // styleIndex 0/1/2 -> tsundere / kuudere / yandere-lite tone.
  const styleIndex = Math.abs(turnIndex) % 3;

  if (unclearTerm) {
    const templates = styleIndex === 0
      ? [
          `Hmm, what does "${unclearTerm}" mean? I have not heard that before.`,
          `I-it's not like I am super curious, but what does "${unclearTerm}" mean?`,
          `Hmph, explain "${unclearTerm}" a bit. I do not want to misunderstand it.`
        ]
      : styleIndex === 1
      ? [
          `The term "${unclearTerm}" is not clear to me yet. What is the definition?`,
          `I do not have a handle on "${unclearTerm}" yet. Explain it briefly.`,
          `Where does "${unclearTerm}" fit in? I need the context.`
        ]
      : [
          `Wait, which part is "${unclearTerm}"? I missed it.`,
          `I need to understand "${unclearTerm}" now. Do not leave that concept blurry for me.`,
          `"${unclearTerm}" is stuck in my head but not clear yet. Explain it again, okay?`
        ];

    return templates[turnIndex % templates.length];
  }

  if (concept) {
    const templates = styleIndex === 0
      ? [
          `Ohh, so ${concept} works like that. N-not that I am impressed, but it is starting to click.`,
          `Hmm, ${concept} is interesting. Do not get smug though, I still want to know why it works.`,
          `So ${concept} is basically the main idea, right? I am just checking.`
        ]
      : styleIndex === 1
      ? [
          `Okay. ${concept} is starting to make sense, but the details still need clarification.`,
          `I understand ${concept} as the core idea from that explanation. There are still gaps.`,
          `I get the outline of ${concept}. A concrete example would help.`
        ]
      : [
          `I am starting to get ${concept}, but I need the next part so the idea does not slip away.`,
          `${concept} is landing, but I want to stay with the flow until it is fully clear.`,
          `So ${concept} is the center of it? Do not move on yet, I need to make sure this is right.`
        ];

    return templates[turnIndex % templates.length];
  }

  const fallback = [
    "I am starting to understand a little, but can you explain it again with an easier example?",
    "I am not ignoring it, okay? I just need a simpler example.",
    "I caught a little. A simpler example would help.",
    "I am starting to get it, but do not leave me with this half-clear part."
  ];

  return fallback[styleIndex];
}

function cleanupConcept(value: string): string {
  return value
    .replace(/[.,!?]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
}

function addUnique(array: string[], value: string): void {
  const cleaned = value.trim();

  if (!cleaned) return;

  if (!array.includes(cleaned)) {
    array.push(cleaned);
  }
}
