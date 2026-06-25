import "dotenv/config";
import { RawChatSession } from "./agents/transcript/types";
import { buildTranscript } from "./agents/transcript/transcriptBuilder";
import { runEvaluator } from "./agents/evaluator";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is not set in your .env file or environment variables.");
    process.exit(1);
  }

  console.log("=== 1. Starting Tutoring Session ===");
  // This is your simulated tutoring session chat history. 
  // You can easily change this to test different conversations!
  const rawSession: RawChatSession = {
    sessionId: "demo-session-001",
    messages: [
      {
        messageId: "msg-1",
        sessionId: "demo-session-001",
        role: "system",
        content: "You are a helpful biology tutor.",
        createdAt: new Date(Date.now() - 50000).toISOString(),
      },
      {
        messageId: "msg-2",
        sessionId: "demo-session-001",
        role: "assistant",
        content: "Hello! Today we are learning about Photosynthesis. Can you tell me what plants need to make their own food?",
        createdAt: new Date(Date.now() - 40000).toISOString(),
      },
      {
        messageId: "msg-3",
        sessionId: "demo-session-001",
        role: "user",
        content: "I think they need water, sunlight, and maybe oxygen?",
        createdAt: new Date(Date.now() - 30000).toISOString(),
      },
      {
        messageId: "msg-4",
        sessionId: "demo-session-001",
        role: "assistant",
        content: "Close! They do need water and sunlight, but instead of oxygen, they need carbon dioxide. They actually release oxygen! Make sense?",
        createdAt: new Date(Date.now() - 20000).toISOString(),
      },
      {
        messageId: "msg-5",
        sessionId: "demo-session-001",
        role: "user",
        content: "Oh yeah, I got it mixed up. Thanks!",
        createdAt: new Date(Date.now() - 10000).toISOString(),
      }
    ],
  };

  console.log(`Loaded chat session with ${rawSession.messages.length} messages.`);
  
  console.log("\n=== 2. Building Transcript ===");
  const turns = buildTranscript(rawSession);
  console.log(`Extracted ${turns.length} teaching turns (student responses).`);
  
  console.log("\n=== 3. Evaluating Transcript ===");
  
  // Here is where you input your sources, concepts, and materials!
  const inputData = {
    sessionId: rawSession.sessionId,
    turns: turns,
    referenceMaterial: `
      Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight and turn it into chemical energy.
      The inputs for photosynthesis are Light Energy, Water (H2O), and Carbon Dioxide (CO2).
      The outputs are Glucose (Sugar/Food) and Oxygen (O2).
    `.trim(),
    keyConcepts: [
      "Plants need Light, Water, and Carbon Dioxide for photosynthesis.",
      "Plants produce Oxygen and Glucose.",
    ],
    commonMisconceptions: [
      "Plants breathe in oxygen to make food (they actually use carbon dioxide).",
      "Plants get their food from the soil."
    ],
  };

  console.log("Running evaluator with Gemini... (this might take a few seconds)");
  try {
    const evaluation = await runEvaluator(inputData, apiKey);
    
    console.log("\n✅ === Evaluation Result ===");
    console.log(`Score: ${evaluation.score}/100`);
    console.log(`Summary: ${evaluation.summary}`);
    
    console.log("\nStrengths:");
    evaluation.strengths.forEach(s => console.log(` - ${s}`));
    
    console.log("\nAreas for Improvement:");
    evaluation.improvements.forEach(i => console.log(` - ${i}`));
    
    console.log(`\nFindings (${evaluation.findings.length}):`);
    evaluation.findings.forEach(f => {
      console.log(` [${f.category}] Concept: ${f.concept}`);
      console.log(`   Detail: ${f.detail}`);
      console.log(`   Turn Index: ${f.evidenceTurnIndex}`);
    });
    
  } catch (error: any) {
    console.error("❌ Evaluation Failed:", error.message);
  }
}

main();
