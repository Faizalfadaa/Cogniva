import "dotenv/config";

// Demo default pakai mock agar bisa langsung jalan meski .env belum dibuat.
process.env.USE_MOCK_AI = process.env.USE_MOCK_AI ?? "true";

import { runLearnerTurn } from "../src/agents/learner/learner.agent";
import { createInitialLearnerState } from "../src/agents/learner/learner.state";
import { LearnerState } from "../src/agents/learner/learner.types";

async function main() {
  const sessionId = "ses_demo_001";

  let learnerState: LearnerState = createInitialLearnerState(sessionId);

  const teachingTextFromCli = process.argv.slice(2).join(" ");

  const firstTeachingText =
    teachingTextFromCli ||
    "Variabel adalah tempat untuk menyimpan nilai dalam program.";

  console.log("\n=== INPUT TEXT TURN 1 ===");
  console.log(firstTeachingText);

  const turn1 = await runLearnerTurn({
    sessionId,
    turnIndex: 1,
    teachingText: firstTeachingText,
    currentState: learnerState
  });

  learnerState = turn1.nextState;

  console.log("\n=== RESPONSE TURN 1 ===");
  console.log(turn1.response.text);

  console.log("\n=== STATE SETELAH TURN 1 ===");
  console.log(JSON.stringify(learnerState, null, 2));

  const secondTeachingText =
    "Nilai dalam variabel bisa berubah saat program berjalan.";

  console.log("\n=== INPUT TEXT TURN 2 ===");
  console.log(secondTeachingText);

  const turn2 = await runLearnerTurn({
    sessionId,
    turnIndex: 2,
    teachingText: secondTeachingText,
    currentState: learnerState
  });

  learnerState = turn2.nextState;

  console.log("\n=== RESPONSE TURN 2 ===");
  console.log(turn2.response.text);

  console.log("\n=== STATE SETELAH TURN 2 ===");
  console.log(JSON.stringify(learnerState, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
