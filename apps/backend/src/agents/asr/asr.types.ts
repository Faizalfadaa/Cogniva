import type { SpeechTranscript } from "../../contracts/speech.js";

/**
 * Bentuk kaya yang diminta ke model -- transcript, confidence, kode bahasa
 * terdeteksi, dan ambiguitas eksplisit. Lebih detail dari SpeechTranscript
 * resmi (lihat GAPS_ASR.md): kontrak resmi tidak punya field ambiguities/
 * needsConfirmation, jadi sinyal "ada bagian tak jelas" hanya bertahan lewat
 * confidence yang diturunkan saat dipetakan ke kontrak.
 */
export type AsrLLMOutput = {
  transcript: string;
  confidence: number;
  /** Kode bahasa BCP-47 terdeteksi model, mis. "id-ID". */
  language: string;
  ambiguities: string[];
};

/**
 * Klip suara satu giliran. Tidak ada kontrak resmi untuk ini (teaching_input
 * cuma membawa `audio` base64); sessionId/turnIndex/capturedAt diisi
 * orchestrator dari konteks sesi. Lihat GAPS_ASR.md untuk usul kontrak resmi.
 */
export type AudioClip = {
  segmentId: string;
  sessionId: string;
  turnIndex: number;
  /** Base64 (tanpa prefix data:) atau string kosong bila tak ada audio. */
  audio: string;
  /** Format kontainer, mis. "webm" / "wav" / "mp3". */
  format: string;
  capturedAt: string;
  /** Referensi penyimpanan klip (opsional), diteruskan ke audioRef. */
  audioRef?: string;
};

export type AsrAgentInput = {
  segmentId: string;
  sessionId: string;
  turnIndex: number;
  topic: string;
  /** Base64 (tanpa prefix data:) atau string kosong bila tak ada audio. */
  audioBase64: string;
  mimeType: string;
  capturedAt: string;
  audioRef?: string;
};

export type RunAsrOptions = {
  /** Paksa mode mock (dipakai test dan demo offline). */
  useMock?: boolean;
};

export { type SpeechTranscript };
