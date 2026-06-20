"""SpeechTranscript — hasil transkripsi suara pengajar pada satu giliran.

(Dokumen Arsitektur §6.5). Menjadi masukan inti bagi Learner dan bagian
transkrip yang dibaca Evaluator. Dihasilkan oleh ASR. Bila keyakinan rendah,
transkrip ditampilkan agar pengguna dapat mengoreksinya (§3.5).
"""

from __future__ import annotations

from pydantic import Field

from .base import CamelModel


class SpeechTranscript(CamelModel):
    segment_id: str = Field(description="Pengenal unik segmen suara")
    session_id: str = Field(description="Sesi pemilik segmen")
    turn_index: int = Field(description="Indeks giliran terkait")
    transcript: str = Field(description="Teks hasil transkripsi ucapan pengajar")
    audio_ref: str | None = Field(
        default=None, description="Referensi/URL klip audio bila disimpan"
    )
    confidence: float = Field(description="Tingkat keyakinan ASR 0..1")
    language: str = Field(description='Kode bahasa, mis. "id-ID"')
    captured_at: str = Field(description="Waktu rekam (ISO-8601)")
