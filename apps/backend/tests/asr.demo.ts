import "dotenv/config";

// Default ke mock biar bisa langsung jalan tanpa .env -- sama seperti
// vision.demo.ts. Set USE_MOCK_AI=false (dan GEMINI_API_KEY di .env) untuk
// memanggil Gemini sungguhan dan menguji transkripsi audio asli.
process.env.USE_MOCK_AI = process.env.USE_MOCK_AI ?? "true";

import { readFileSync } from "node:fs";
import { runAsrTurn } from "../src/agents/asr/asr.agent";

function mimeFromPath(path: string): string {
  const p = path.toLowerCase();
  if (p.endsWith(".wav")) return "audio/wav";
  if (p.endsWith(".mp3")) return "audio/mp3";
  if (p.endsWith(".m4a") || p.endsWith(".aac")) return "audio/mp4";
  if (p.endsWith(".ogg")) return "audio/ogg";
  return "audio/webm";
}

async function main() {
  const args = process.argv.slice(2);
  const audioPath = args[0];
  const topic = args[1] ?? "Fotosintesis";

  if (!audioPath) {
    console.log(
      'Pakai: npm run demo:asr -- ./suara.wav "Fotosintesis"\n' +
        "(set USE_MOCK_AI=false dan GEMINI_API_KEY di .env untuk transkripsi sungguhan)",
    );
    process.exit(1);
  }

  const audioBase64 = readFileSync(audioPath).toString("base64");
  const mimeType = mimeFromPath(audioPath);

  console.log(`\n=== Mentranskripsi ${audioPath} (topik: "${topic}") ===`);
  console.log(`(mode: ${process.env.USE_MOCK_AI === "true" ? "mock" : "model nyata"})`);

  const result = await runAsrTurn({
    segmentId: "seg_demo",
    sessionId: "ses_demo",
    turnIndex: 0,
    topic,
    audioBase64,
    mimeType,
    capturedAt: new Date().toISOString(),
  });

  console.log("\n=== SpeechTranscript (kontrak resmi) ===");
  console.log(JSON.stringify(result, null, 2));

  if (result.confidence < 0.6) {
    console.log(`\n[!] Confidence rendah (${result.confidence}) -> tampilkan transkrip agar pengguna bisa mengoreksi.`);
  }
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exit(1);
});
