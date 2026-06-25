/**
 * Interactive Learner chat — type your own teaching text and get a real
 * Gemini-backed student reply (not the mock).
 *
 *   npm run chat:learner          # real Gemini (default)
 *   npm run chat:learner -- --mock  # force the offline mock instead
 *
 * Type your explanation as the teacher; press Enter on an empty line (or type
 * "exit") to quit. State is kept across turns so the student "remembers".
 */

import "dotenv/config";

// Decide the mode up front and pin USE_MOCK_AI so an inherited value can't
// silently flip us back to the mock.
const wantMock = process.argv.includes("--mock");
process.env.USE_MOCK_AI = wantMock ? "true" : "false";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { runLearnerTurn } from "../src/agents/learner/learner.agent.js";
import { createInitialLearnerState } from "../src/agents/learner/learner.state.js";
import * as config from "../src/config/index.js";
import type { LearnerState } from "../src/agents/learner/learner.types.js";

async function main(): Promise<void> {
  const usingGemini = !wantMock && config.llmAvailable();
  const mode = usingGemini ? `GEMINI (${config.LEARNER_MODEL})` : "MOCK";

  if (!wantMock && !config.llmAvailable()) {
    console.warn(
      "\n⚠  GEMINI_API_KEY tidak ditemukan di environment — akan jatuh ke MOCK.\n" +
        "   Isi apps/backend/.env lalu jalankan lagi.\n",
    );
  }

  console.log(`\nLearner chat — mode: ${mode}`);
  console.log('Ketik penjelasanmu sebagai pengajar. Baris kosong atau "exit" untuk keluar.\n');

  const rl = createInterface({ input: stdin, output: stdout });
  const sessionId = `ses_chat_${Date.now()}`;
  let state: LearnerState = createInitialLearnerState(sessionId);
  let turnIndex = 0;

  try {
    while (true) {
      let answer: string;
      try {
        answer = await rl.question("Kamu (pengajar) > ");
      } catch {
        break; // stdin closed (e.g. piped input reached EOF)
      }
      const text = answer.trim();
      if (!text || text.toLowerCase() === "exit") break;

      turnIndex += 1;
      const startedAt = Date.now();
      const output = await runLearnerTurn({
        sessionId,
        turnIndex,
        teachingText: text,
        currentState: state,
      });
      state = output.nextState;

      const ms = Date.now() - startedAt;
      console.log(
        `\nMurid (${output.response.type}, ${ms}ms) > ${output.response.text}\n`,
      );
    }
  } finally {
    rl.close();
  }

  console.log("\nState murid terakhir:");
  console.log(JSON.stringify(state, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
