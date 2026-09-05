/**
 * Deterministic offline suggestions — used with no credential, USE_MOCK_AI, or
 * after a failed search (the same fallback rule every agent follows).
 *
 * The hard constraint here is honesty. Offline there is no way to know which
 * article about a topic exists, and a made-up title over an invented URL is
 * worse than no suggestion at all: it looks authoritative and leads nowhere.
 * So the offline list never names a document. It points at the *catalog* of
 * well-known open libraries, pre-filtered to the topic, and says so plainly.
 * Every URL is a stable entry point that resolves whatever the topic is.
 *
 * Wikipedia is queried through Special:Search with go=Go, which jumps straight
 * to the article when the title matches exactly and shows results otherwise —
 * so the most common case lands on real reference text, not a search page.
 */

import * as config from "../../config/index.js";
import type { ReferenceOption, ReferenceSuggestions, SuggestReferencesArgs } from "./referencer.types.js";

interface Library {
  id: string;
  title: (topic: string) => string;
  url: (query: string) => string;
  source: string;
  kind: ReferenceOption["kind"];
  summary: string;
  whyRelevant: string;
}

const LIBRARIES: Library[] = [
  {
    id: "wikipedia",
    title: (topic) => `Wikipedia: ${topic}`,
    url: (q) => `https://en.wikipedia.org/wiki/Special:Search?search=${q}&go=Go`,
    source: "Wikipedia",
    kind: "article",
    summary:
      "Ringkasan ensiklopedis dengan definisi, istilah kunci, dan daftar rujukan di bagian bawah.",
    whyRelevant:
      "Cakupan luas dan struktur berjudul — cocok dipakai sebagai kerangka awal saat menjelaskan.",
  },
  {
    id: "khan-academy",
    title: (topic) => `Khan Academy — materi tentang ${topic}`,
    url: (q) => `https://www.khanacademy.org/search?page_search_query=${q}`,
    source: "Khan Academy",
    kind: "course",
    summary: "Pelajaran singkat dan latihan bertingkat, ditulis untuk pelajar sekolah.",
    whyRelevant: "Bahasanya paling dekat dengan cara seseorang menjelaskan ke pemula.",
  },
  {
    id: "openstax",
    title: (topic) => `OpenStax — buku teks terbuka tentang ${topic}`,
    url: (q) => `https://openstax.org/search?q=${q}`,
    source: "OpenStax",
    kind: "pdf",
    summary: "Buku teks kuliah gratis, tersedia dalam bentuk PDF utuh per bab.",
    whyRelevant: "Kalau butuh referensi yang bisa diunduh sebagai PDF, ini sumber paling rapi.",
  },
  {
    id: "mit-ocw",
    title: (topic) => `MIT OpenCourseWare — kuliah tentang ${topic}`,
    url: (q) => `https://ocw.mit.edu/search/?q=${q}`,
    source: "MIT OpenCourseWare",
    kind: "course",
    summary: "Catatan kuliah, slide, dan soal dari mata kuliah MIT yang dibuka untuk umum.",
    whyRelevant: "Kedalamannya paling tinggi di daftar ini; berguna untuk topik tingkat lanjut.",
  },
  {
    id: "semantic-scholar",
    title: (topic) => `Semantic Scholar — artikel ilmiah tentang ${topic}`,
    url: (q) => `https://www.semanticscholar.org/search?q=${q}`,
    source: "Semantic Scholar",
    kind: "article",
    summary: "Mesin pencari makalah ilmiah, banyak di antaranya berbentuk PDF terbuka.",
    whyRelevant: "Dipakai kalau topiknya menuntut sumber primer, bukan ringkasan.",
  },
];

const NOTICE =
  "Pencarian daring sedang tidak aktif, jadi ini adalah pintu masuk ke perpustakaan terbuka " +
  "yang sudah disaring untuk topikmu — bukan judul dokumen tertentu. Buka salah satu, lalu " +
  "unggah PDF-nya kalau kamu menemukan yang cocok.";

/** Build the offline option list. Pure and deterministic. */
export function suggestOffline(args: SuggestReferencesArgs): ReferenceSuggestions {
  const topic = args.topic.trim() || "topik ini";
  const query = encodeURIComponent([topic, args.hint].filter(Boolean).join(" ").trim());
  const count = Math.max(1, args.count ?? config.REFERENCER_OPTIONS);

  const options: ReferenceOption[] = LIBRARIES.slice(0, count).map((library) => ({
    id: library.id,
    title: library.title(topic),
    url: library.url(query),
    source: library.source,
    kind: library.kind,
    summary: library.summary,
    whyRelevant: library.whyRelevant,
    // Nothing was searched, so nothing is corroborated. Saying "verified" here
    // would be the exact lie this fallback exists to avoid.
    verified: false,
  }));

  return { topic, options, source: "offline", notice: NOTICE };
}
