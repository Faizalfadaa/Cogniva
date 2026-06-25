import type { Topic, Session, EvaluationResult } from '../contracts/dto';

export const MOCK_TOPICS: Topic[] = [
  { topicId: 't1', title: 'Fisika Kuantum', description: 'Mekanika gelombang, superposisi, dan pengukuran', difficulty: 'lanjut', estimatedTurns: '6–8 giliran', icon: '⚛️' },
  { topicId: 't2', title: 'Genetika Mendel', description: 'Pewarisan sifat, dominan resesif, persilangan', difficulty: 'menengah', estimatedTurns: '5–6 giliran', icon: '🧬' },
  { topicId: 't3', title: 'Kalkulus Integral', description: 'Integral tentu, teknik integrasi, luas kurva', difficulty: 'lanjut', estimatedTurns: '7–9 giliran', icon: '📐' },
  { topicId: 't4', title: 'Ekosistem & Rantai Makanan', description: 'Aliran energi, produsen, konsumen, dekomposer', difficulty: 'dasar', estimatedTurns: '4–5 giliran', icon: '🌍' },
  { topicId: 't5', title: 'Reaksi Kimia', description: 'Stoikiometri, tipe reaksi, kesetimbangan kimia', difficulty: 'menengah', estimatedTurns: '5–7 giliran', icon: '⚗️' },
  { topicId: 't6', title: 'Sejarah Renaissance', description: 'Kesenian, ilmu pengetahuan, reformasi gereja', difficulty: 'dasar', estimatedTurns: '4–6 giliran', icon: '📜' },
  { topicId: 't7', title: 'Hukum Newton', description: 'Hukum I, II, III Newton dan aplikasinya', difficulty: 'menengah', estimatedTurns: '5–6 giliran', icon: '🍎' },
  { topicId: 't8', title: 'Fotosintesis', description: 'Reaksi terang, siklus Calvin, klorofil', difficulty: 'dasar', estimatedTurns: '4–5 giliran', icon: '🌿' },
];

export const MOCK_RECENT_SESSIONS: (Session & { score?: number })[] = [
  { sessionId: 's1', topicId: 't7', topicTitle: 'Hukum Newton', status: 'EVALUASI', turnCount: 5, createdAt: '2025-06-18', score: 78 },
  { sessionId: 's2', topicId: 't8', topicTitle: 'Fotosintesis', status: 'EVALUASI', turnCount: 7, createdAt: '2025-06-15', score: 91 },
  { sessionId: 's3', topicId: 't3', topicTitle: 'Sistem Periodik Unsur', status: 'EVALUASI', turnCount: 4, createdAt: '2025-06-12', score: 63 },
];

export const MOCK_EVALUATION: EvaluationResult = {
  evaluationId: 'ev_8f2a',
  sessionId: 'ses_41c0',
  score: 78,
  findings: [
    { category: 'BENAR', concept: 'Penjelasan gaya aksi-reaksi', detail: 'Penjelasan aksi-reaksi pada dua benda berbeda dijelaskan dengan tepat.', evidenceTurnIndex: 2 },
    { category: 'BENAR', concept: 'Definisi massa dan percepatan', detail: 'Hubungan F=ma disampaikan dengan jelas.', evidenceTurnIndex: 1 },
    { category: 'BENAR', concept: 'Hukum I Newton', detail: 'Konsep inersia dijelaskan dengan contoh konkret.', evidenceTurnIndex: 3 },
    { category: 'KELIRU', concept: 'Arah gaya pada benda diam', detail: 'Penjelasan tentang arah resultan gaya kurang tepat.', evidenceTurnIndex: 4 },
    { category: 'KELIRU', concept: 'Contoh gerak melingkar', detail: 'Aplikasi hukum Newton pada gerak melingkar masih keliru.', evidenceTurnIndex: 5 },
    { category: 'TERLEWAT', concept: 'Aplikasi di kehidupan nyata', detail: 'Contoh aplikasi sehari-hari tidak disebutkan sama sekali.' },
    { category: 'TERLEWAT', concept: 'Perbedaan berat vs massa', detail: 'Perbedaan konsep berat dan massa tidak dibahas.' },
    { category: 'MEMBINGUNGKAN', concept: 'Hukum III dan pasangan gaya', detail: 'Penjelasan pasangan aksi-reaksi membingungkan Reka.', evidenceTurnIndex: 3 },
    { category: 'MEMBINGUNGKAN', concept: 'Konsep inersia', detail: 'Definisi inersia di giliran 2 dan 4 saling kontradiksi.', evidenceTurnIndex: 4 },
  ],
  summary: 'Penjelasan kuat di tahap terang, lemah di tahap gelap dan aplikasi praktis.',
  strengths: [
    'Kamu sangat jelas ketika menjelaskan perbedaan massa dan gaya',
    'Strukturmu teratur — dari definisi lalu ke contoh konkret',
    'Kamu sabar merespon pertanyaan Reka satu per satu',
  ],
  improvements: [
    'Coba tambahkan analogi sehari-hari untuk konsep inersia',
    'Kurangi istilah teknis tanpa penjelasan tambahan',
    'Gambar atau diagram akan sangat membantu Reka',
  ],
  generatedAt: '2025-06-21T09:14:00Z',
};
