import "dotenv/config";

// Default ke mock biar bisa langsung jalan tanpa .env -- sama seperti
// learner.demo.ts. Hapus baris ini (atau set USE_MOCK_AI=false) untuk
// memanggil Gemini sungguhan dan menguji pembacaan papan asli.
process.env.USE_MOCK_AI = process.env.USE_MOCK_AI ?? "true";

import { readFileSync } from "node:fs";
import { runVisionTurn } from "../src/agents/vision/vision.agent";

async function main() {
  const args = process.argv.slice(2);
  const imagePath = args[0];
  const topic = args[1] ?? "Fotosintesis";

  if (!imagePath) {
    console.log(
      'Pakai: npm run demo:vision -- ./papan.jpg "Fotosintesis"\n' +
        "(set USE_MOCK_AI=false dan GEMINI_API_KEY di .env untuk baca gambar sungguhan)",
    );
    process.exit(1);
  }

  const imageBase64 = readFileSync(imagePath).toString("base64");
  const mimeType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

  console.log(`\n=== Membaca ${imagePath} (topik: "${topic}") ===`);
  console.log(`(mode: ${process.env.USE_MOCK_AI === "true" ? "mock" : "model nyata"})`);

  const result = await runVisionTurn({
    snapshotId: "snap_demo",
    topic,
    imageBase64,
    mimeType,
  });

  console.log("\n=== VisionInterpretation (kontrak resmi) ===");
  console.log(JSON.stringify(result, null, 2));

  if (result.needsConfirmation) {
    console.log(`\n[!] Minta konfirmasi -> ${result.suggestedClarification}`);
  }
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exit(1);
});
