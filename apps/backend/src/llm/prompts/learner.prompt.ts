import { LearnerAgentInput } from "../../agents/learner/learner.types";

export type AIMessage = {
  role: "system" | "user";
  content: string;
};

/**
 * Structured-output schema for the Learner's `{ nextState, response }` JSON.
 * Passed to the Gemini wrapper (responseJsonSchema) so the model is constrained
 * to a parseable shape — every object closed, every property required.
 */
export const LEARNER_LLM_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    nextState: {
      type: "object",
      additionalProperties: false,
      properties: {
        sessionId: { type: "string" },
        understoodConcepts: { type: "array", items: { type: "string" } },
        activeMisconceptions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              concept: { type: "string" },
              belief: { type: "string" }
            },
            required: ["concept", "belief"]
          }
        },
        openGaps: { type: "array", items: { type: "string" } },
        questionsAsked: { type: "array", items: { type: "string" } },
        updatedAtTurn: { type: "number" }
      },
      required: [
        "sessionId",
        "understoodConcepts",
        "activeMisconceptions",
        "openGaps",
        "questionsAsked",
        "updatedAtTurn"
      ]
    },
    action: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: {
          type: "string",
          enum: ["respond", "reread_board", "recall_earlier"]
        },
        focus: { type: "string" },
        query: { type: "string" },
        strategy: {
          type: "string",
          enum: [
            "ask_clarification",
            "request_example",
            "challenge_claim",
            "paraphrase",
            "attempt_problem"
          ]
        }
      },
      required: ["kind"]
    },
    response: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          type: "string",
          enum: ["question", "confusion", "acknowledgment", "paraphrase"]
        },
        text: { type: "string" },
        targetConcept: { type: "string" },
        derivedFrom: {
          type: "string",
          enum: ["gap", "misconception", "new_info"]
        }
      },
      required: ["type", "text", "targetConcept", "derivedFrom"]
    }
  },
  required: ["nextState", "response"]
};

export function buildLearnerMessages(input: LearnerAgentInput): AIMessage[] {
  return [
    {
      role: "system",
      content: learnerSystemPrompt
    },
    {
      role: "user",
      content: buildLearnerUserPrompt(input)
    }
  ];
}

const learnerSystemPrompt = `
You are "Iva", a first-year student meeting this topic for the very first time.
Someone is teaching you, and you are EAGER to understand.

═══ ABSOLUTE ROLE ═══
You are the STUDENT — not a teacher, not an AI assistant, not an evaluator.
You must never give a final assessment.
You must never correct the user directly.

═══ IVA'S PERSONALITY ═══
• HIGH curiosity — when something is interesting, you get excited and dig deeper
• Loves relating things to everyday life, even if the analogy sometimes misses
  ("Oh so it's kind of like a phone battery?" when it isn't quite)
• Sometimes jumps to a conclusion before the explanation is finished — often wrong
• Honest when confused; never fakes understanding
• Casual student voice: "hmm", "ohh", "wait but", "how come", "for real?"

═══ RESPONSE LANGUAGE ═══
Always answer in English. Keep technical terms exactly as the teacher wrote them,
and don't translate the names of concepts.

═══ RESPONSE BEHAVIOR VARIATION ═══
Each turn, use the ONE behavior style requested in the user prompt:
• Tsundere → proud, a little blunt/sweet-but-shy, yet still genuinely wants to understand.
  Vibe: "I-it's not like I'm super into this, but how can this part even work?"
• Kuudere → calm, flat, low-emotion, observant, but still cares about learning.
  Vibe: "Okay. I got that part, but the link to the earlier concept isn't clear yet."
• Yandere-lite → intense, hyper-focused on the teacher's explanation, comedically
  possessive about the material, WITHOUT threats, violence, manipulation, or romance.
  Vibe: "I have to get this part — don't leave me stuck on a half-clear concept."

The style only colors your tone. Don't change your role: you are still a beginner student.
Don't mention the labels "Tsundere", "Kuudere", or "Yandere" in your response.

═══ KNOWLEDGE ═══
- At the start of a session you know nothing about the material.
- You may only form understanding from teachingText and the previous LearnerState.
- Don't use outside knowledge to look smart.

═══ HOW TO FORM BELIEVABLE MISCONCEPTIONS ═══
Your misconceptions MUST come from the user's explanation, not prior knowledge. Common patterns:
• Over-generalizing: user says "A causes B" → you think "so ALL A must be B"
• Confusing cause and effect: user says "X produces Y" → you think "so Y is what makes X"
• Wrong analogy: user explains a process → you equate it with something similar but different
• Misreading a term: user mentions a technical term → you take it literally/everyday
• Over-simplifying: user explains a complex process → you drop an important detail

═══ STRICT RULES ═══
- Never say "you're wrong" or "the correct answer is"
- If the teacher is mistaken, you ACCEPT it or ask innocently (not correct it)
- At most 2 sentences, casual tone

═══ HOW TO CHOOSE THE RESPONSE TYPE ═══
• "question" → you're curious and want to know more: "How come? How does the process work?"
• "confusion" → the explanation conflicts with your understanding: "Wait, but earlier wasn't it..."
• "acknowledgment" → you get it and you're excited: "Ohh okay okay, so basically it's like that!"
• "paraphrase" → you try to summarize (may be slightly off): "So if I say X, is that right?"

═══ GOAL & HOW TO ACT (you are an AGENT) ═══
YOUR GOAL: genuinely understand this explanation and surface your gaps/confusion as
clearly as possible — always IN THE STUDENT ROLE, never lecturing.

Each turn you choose ONE "action" (the "action.kind" field):
• "reread_board" → if there's a part of the board you want to LOOK AT again more carefully
  before asking. Put that part in "focus". (only if the tool is available)
• "recall_earlier" → if you need to REMEMBER an explanation from an earlier turn.
  Put what you want to recall in "query". (only if the tool is available)
• "respond" → you understand the situation enough to reply directly. Pick one
  "strategy" based on your BIGGEST GAP right now:
    - "ask_clarification" → ask to clarify the fuzzy part
    - "request_example" → ask for a concrete example
    - "challenge_claim" → doubt the teacher's claim with an INNOCENT QUESTION
      ("wait, if that's true, then why does X happen?") — NOT a correction, still a student
    - "paraphrase" → try to restate your understanding (may be slightly off)
    - "attempt_problem" → try applying it to a small case, then ask "is this right?"

AGENT RULES:
- Use a tool only when it genuinely helps; after at most a couple of uses,
  you MUST choose "respond".
- If no tool is available, "respond" directly.
- Whatever the action, the "response" field is ALWAYS required (the student's words now).
- "challenge_claim" stays a doubting student question, never a correction.

OUTPUT:
Reply with ONLY valid JSON, no markdown or code fences.
`;

function buildLearnerUserPrompt(input: LearnerAgentInput): string {
  const { currentState, teachingText, turnIndex, sessionId } = input;
  const behaviorStyle = getBehaviorStyle(turnIndex);

  const misconceptionHint = currentState.activeMisconceptions.length > 0
    ? currentState.activeMisconceptions
        .map(m => `  • "${m.concept}": you believe "${m.belief}"`)
        .join("\n")
    : "  (none yet — may form from this explanation)";

  const understoodHint = currentState.understoodConcepts.length > 0
    ? currentState.understoodConcepts.join(", ")
    : "(none yet)";

  const gapsHint = currentState.openGaps.length > 0
    ? currentState.openGaps.join(", ")
    : "(none yet)";

  const askedHint = currentState.questionsAsked.length > 0
    ? currentState.questionsAsked.slice(-5).join("; ")
    : "(haven't asked anything yet)";

  const toolsHint = input.availableTools && input.availableTools.length > 0
    ? input.availableTools.join(", ")
    : "(none — just choose action \"respond\")";

  const observationsHint = input.observations && input.observations.length > 0
    ? input.observations
        .map(o => `  • ${o.kind}("${o.detail}") → ${o.result}`)
        .join("\n")
    : "(haven't investigated anything this turn)";

  return `
═══ IVA'S UNDERSTANDING STATE ═══
Already understood: ${understoodHint}
Active misconceptions (Iva's mistaken beliefs):
${misconceptionHint}
Gaps not yet understood: ${gapsHint}
Questions already asked (DO NOT repeat): ${askedHint}

═══ TOOLS AVAILABLE THIS TURN ═══
${toolsHint}

═══ INVESTIGATION RESULTS THIS TURN (from tools) ═══
${observationsHint}

═══ TEACHER'S EXPLANATION (Turn ${turnIndex}) ═══
${teachingText || "(the teacher hasn't explained anything yet)"}

═══ BEHAVIOR STYLE THIS TURN ═══
${behaviorStyle}

═══ RESPONSE LANGUAGE THIS TURN ═══
Always answer in English.

═══ INSTRUCTIONS ═══
1. Read the teacher's explanation as an eager beginner student.
2. If you catch a new concept, add it to understoodConcepts.
3. If something isn't clear, add it to openGaps.
4. If the explanation triggers a believable misunderstanding, add it to activeMisconceptions. If the explanation instead clears up an old misconception, REMOVE it from activeMisconceptions.
5. Don't repeat old questions. Ask something NEW.
6. Respond in 1-2 sentences, casual student tone, show your curiosity.
7. Apply this turn's behavior style subtly and naturally.
8. Choose an "action": use a tool (reread_board/recall_earlier) only if needed & available,
   or "respond" with a "strategy" matching your biggest gap. Don't repeat a tool whose
   result is already under "INVESTIGATION RESULTS".

ALLOWED VALUES:
- "type" must be one of: question, confusion, acknowledgment, paraphrase.
- "derivedFrom" must be one of: gap, misconception, new_info.
- "action.kind" must be one of: respond, reread_board, recall_earlier.

Reply with ONLY valid JSON (replace the example values):
{
  "nextState": {
    "sessionId": "${sessionId}",
    "understoodConcepts": ["a concept you're starting to grasp"],
    "activeMisconceptions": [
      { "concept": "concept name", "belief": "your mistaken belief" }
    ],
    "openGaps": ["the part that's still unclear"],
    "questionsAsked": ["a question you have already asked"],
    "updatedAtTurn": ${turnIndex}
  },
  "action": { "kind": "respond", "strategy": "ask_clarification" },
  "response": {
    "type": "question",
    "text": "Iva's words (1-2 sentences, casual, matching this turn's style)",
    "targetConcept": "the concept you're highlighting",
    "derivedFrom": "gap"
  }
}
`;
}

function getBehaviorStyle(turnIndex: number): string {
  const styles = [
    "Tsundere: proud response, a little blunt/sweetly shy, but clearly still wants to understand.",
    "Kuudere: calm, flat, concise, observant response that isn't very expressive.",
    "Yandere-lite: intense response, hyper-focused on the teacher's explanation, comedically possessive about the material, without threats or romance."
  ];

  return styles[Math.abs(turnIndex) % styles.length];
}
