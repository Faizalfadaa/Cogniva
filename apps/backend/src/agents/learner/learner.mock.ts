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
      "Aku belum dapat penjelasannya. Bisa mulai dari hal paling dasar?";

    addUnique(nextState.openGaps, "materi dasar");
    addUnique(nextState.questionsAsked, question);

    return {
      nextState,
      response: {
        type: "question",
        text: question,
        targetConcept: "materi dasar",
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

  const responseText = createMockResponse(concept, unclearTerm);
  if (unclearTerm) {
    addUnique(nextState.questionsAsked, responseText);
  }

  return {
    nextState,
    response: {
      type: unclearTerm ? "question" : "paraphrase",
      text: responseText,
      targetConcept: unclearTerm ?? concept ?? "penjelasan terbaru",
      derivedFrom: unclearTerm ? "gap" : "new_info"
    }
  };
}

function extractPossibleConcept(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();

  const patterns = [
    /(.+?)\s+adalah\s+(.+)/i,
    /(.+?)\s+merupakan\s+(.+)/i,
    /(.+?)\s+yaitu\s+(.+)/i
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
  unclearTerm: string | null
): string {
  if (unclearTerm) {
    return `Aku mulai nangkep sedikit, tapi istilah "${unclearTerm}" itu maksudnya apa ya?`;
  }

  if (concept) {
    return `Jadi sejauh ini aku pahamnya, ${concept} itu bagian penting dari materi ini ya?`;
  }

  return "Aku mulai paham sedikit, tapi bisa jelasin lagi dengan contoh yang lebih sederhana?";
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
