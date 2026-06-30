/**
 * Manual Evaluator demo (run with: npx tsx src/demo.ts).
 *
 * Exercises the integrated Evaluator against a hand-written transcript. With a
 * GEMINI_API_KEY set it calls the real model; without one it uses the
 * deterministic offline evaluator — either way it prints a canonical
 * EvaluationResult.
 */

import "dotenv/config";

import { runEvaluator, type EvaluatorInput } from "./agents/evaluator/index.js";
import { newId } from "./modules/storage/sessionStore.js";

async function main(): Promise<void> {
  const input: EvaluatorInput = {
    sessionId: "demo-session-001",
    turns: [
      {
        turnIndex: 0,
        boardText: "Photosynthesis makes food using sunlight, water and CO2.",
        learnerUtterance: "So the plant eats from the soil, right?",
      },
      {
        turnIndex: 1,
        boardText: "Outputs are glucose and oxygen. Oxygen comes from splitting water.",
        learnerUtterance: "Oh, the oxygen comes from water, not from CO2.",
      },
    ],
    referenceMaterial:
      "Photosynthesis converts light energy into chemical energy (glucose). " +
      "Inputs: CO2 + water + light. Outputs: glucose + oxygen. The oxygen comes " +
      "from splitting water, not CO2. The Calvin cycle fixes CO2 in the stroma.",
    keyConcepts: [
      "Inputs are CO2, water, and light",
      "Outputs are glucose and oxygen",
      "Oxygen comes from splitting water, not CO2",
      "The Calvin cycle fixes CO2 into glucose",
    ],
    commonMisconceptions: ["Plants get their food from the soil"],
  };

  console.log("Running evaluator...\n");
  const result = await runEvaluator(input, newId("ev"));

  console.log(`Score: ${result.score}/100`);
  console.log(`Summary: ${result.summary}\n`);
  console.log("Strengths:");
  result.strengths.forEach((s) => console.log(` - ${s}`));
  console.log("\nImprovements:");
  result.improvements.forEach((i) => console.log(` - ${i}`));
  console.log(`\nFindings (${result.findings.length}):`);
  result.findings.forEach((f) => {
    console.log(` [${f.category}] ${f.concept} (turn ${f.evidenceTurnIndex ?? "-"})`);
    console.log(`   ${f.detail}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
