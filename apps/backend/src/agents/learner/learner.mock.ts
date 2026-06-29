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
      action: { kind: "respond", strategy: "ask_clarification" },
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

  const responseText = createMockResponse(concept, unclearTerm, input.turnIndex, text);
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
  unclearTerm: string | null,
  turnIndex: number,
  teachingText: string
): string {
  const styleIndex = Math.abs(turnIndex) % 3;
  if (isLikelyEnglish(teachingText)) {
    return createEnglishMockResponse(concept, unclearTerm, turnIndex, styleIndex);
  }

  if (unclearTerm) {
    const templates = styleIndex === 0
      ? [
          `Hmm, istilah "${unclearTerm}" itu maksudnya apa ya? Aku baru denger.`,
          `B-bukan berarti aku kepo banget ya, tapi "${unclearTerm}" itu maksudnya apa?`,
          `Aku bukannya gak ngerti semua, cuma "${unclearTerm}" itu apaan sih?`,
          `Hmph, jelasin "${unclearTerm}" dikit dong. Biar aku gak salah nangkep.`
        ]
      : styleIndex === 1
      ? [
          `Eh "${unclearTerm}" itu apa sih? Kayak nama alat gitu?`,
          `Istilah "${unclearTerm}" belum jelas buatku. Definisinya apa?`,
          `Aku belum punya pegangan untuk "${unclearTerm}". Jelaskan singkat.`,
          `"${unclearTerm}" itu bagian mana? Aku perlu konteksnya.`
        ]
      : [
          `Wait, "${unclearTerm}" itu yang mana? Aku ketinggalan.`,
          `Aku harus ngerti "${unclearTerm}" sekarang, jangan biarin konsep itu kabur dari aku.`,
          `"${unclearTerm}" masih nempel di kepala tapi belum kebuka. Jelasin lagi, ya?`,
          `Tunggu, aku gak mau kehilangan bagian "${unclearTerm}" ini. Itu maksudnya apa?`
        ];

    return templates[turnIndex % templates.length];
  }

  if (concept) {
    const templates = styleIndex === 0
      ? [
          `Ohh jadi ${concept} itu kayak gitu ya! Aku mulai ngerti deh.`,
          `Ohh jadi ${concept} itu kayak gitu ya. B-bukan berarti aku kagum, tapi mulai masuk sih.`,
          `Hmm menarik sih soal ${concept}. Tapi jangan seneng dulu, aku masih mau tanya kenapa bisa gitu.`,
          `Berarti ${concept} intinya begitu kan? Aku cuma ngecek, bukan karena bingung banget.`
        ]
      : styleIndex === 1
      ? [
          `Hmm menarik sih soal ${concept}. Tapi kok bisa gitu ya?`,
          `Oke. ${concept} mulai terbaca, tapi hubungan detailnya masih perlu diperjelas.`,
          `${concept} aku tangkap sebagai inti penjelasan tadi. Masih ada bagian yang kosong.`,
          `Aku memahami garis besar ${concept}. Contohnya masih kurang konkret.`
        ]
      : [
          `Berarti ${concept} itu intinya kayak yang tadi kan? Bener ga kak?`,
          `Oh ${concept} toh. Aku mikirnya beda loh tadi, kirain kayak yang di kehidupan sehari-hari.`,
          `Aku mulai nangkep ${concept}, tapi aku butuh bagian lanjutannya biar pemahamanku gak lepas.`,
          `${concept} udah masuk, tapi aku masih pengin nempel ke alurnya sampai jelas semua.`,
          `Jadi ${concept} itu pusatnya ya? Jangan pindah dulu, aku mau pastiin ini bener.`
        ];

    return templates[turnIndex % templates.length];
  }

  const fallback = [
    "Aku mulai paham sedikit, tapi bisa jelasin lagi pakai contoh yang lebih gampang?",
    "Aku bukannya gak merhatiin, tapi bisa jelasin lagi pakai contoh yang lebih gampang?",
    "Aku menangkap sedikit. Contoh yang lebih sederhana akan membantu.",
    "Aku mulai paham sedikit, tapi jangan tinggalin aku di bagian yang masih setengah jelas ini."
  ];

  return fallback[styleIndex];
}

function createEnglishMockResponse(
  concept: string | null,
  unclearTerm: string | null,
  turnIndex: number,
  styleIndex: number
): string {
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

function isLikelyEnglish(text: string): boolean {
  const normalized = ` ${text.toLowerCase()} `;
  const englishMarkers = [
    " the ",
    " and ",
    " is ",
    " are ",
    " because ",
    " means ",
    " process ",
    " example ",
    " concept ",
    " function ",
    " variable "
  ];
  const indonesianMarkers = [
    " yang ",
    " dan ",
    " adalah ",
    " karena ",
    " yaitu ",
    " contoh ",
    " konsep ",
    " proses ",
    " fungsi ",
    " variabel "
  ];

  const englishScore = englishMarkers.filter((marker) => normalized.includes(marker)).length;
  const indonesianScore = indonesianMarkers.filter((marker) => normalized.includes(marker)).length;

  return englishScore > indonesianScore;
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
