export interface TeachingCheckpointDTO {
  id: string;
  /** Snapshot gambar canvas, dikirim ke Vision saat tombol Teach ditekan */
  snapshotImageUrl: string;
  /** Snapshot dokumen tldraw (JSON) supaya whiteboard bisa di-restore persis */
  whiteboardSnapshot: unknown;
  /** URL audio penjelasan user yang direkam selama editing, di-upload bareng saat Teach ditekan */
  audioUrl?: string;
  /** Respon learner setelah Vision + agent memproses snapshot. Kosong selagi diproses. */
  learnerResponse?: string;
  createdAt: string;
}