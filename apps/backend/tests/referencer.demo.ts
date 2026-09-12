import "dotenv/config";

// Defaults to mock so it runs with no .env at all, like the other demos. Set
// USE_MOCK_AI=false (and GEMINI_API_KEY in .env) to run the real grounded
// search and see the links Google actually returned.
process.env.USE_MOCK_AI = process.env.USE_MOCK_AI ?? "true";

import { fetchReferenceText, suggestReferences } from "../src/agents/referencer/index.js";

async function main() {
  const topic = process.argv[2] ?? "Fotosintesis";
  const hint = process.argv[3];

  console.log(`Mencari referensi untuk: ${topic}${hint ? ` (${hint})` : ""}\n`);
  const result = await suggestReferences({ topic, hint });

  console.log(`sumber daftar: ${result.source}`);
  if (result.notice) console.log(`catatan: ${result.notice}`);
  console.log();

  result.options.forEach((option, i) => {
    console.log(`${i + 1}. [${option.kind}] ${option.title}`);
    console.log(`   ${option.url}`);
    console.log(`   penerbit: ${option.source} | terkonfirmasi: ${option.verified ? "ya" : "belum"}`);
    if (option.summary) console.log(`   ${option.summary}`);
    if (option.whyRelevant) console.log(`   -> ${option.whyRelevant}`);
    console.log();
  });

  // Second half: prove the chosen option can actually be turned into reference
  // text, which is the part that decides whether a suggestion was any use.
  const first = result.options[0];
  if (!first) return;

  console.log(`Mengambil isi opsi 1 ...`);
  const fetched = await fetchReferenceText(first.url, topic);
  if (!fetched.ok) {
    console.log(`gagal: ${fetched.problem}`);
    return;
  }
  console.log(`judul: ${fetched.title}`);
  console.log(`panjang: ${fetched.text.length} karakter`);
  console.log(`cuplikan:\n${fetched.text.slice(0, 500)}...`);
}

void main();
