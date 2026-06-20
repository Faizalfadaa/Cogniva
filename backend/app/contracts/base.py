"""Base model for all Cogniva data contracts.

Konvensi kontrak (Dokumen Arsitektur §6):
- Nama field memakai camelCase saat pertukaran JSON.
- Waktu memakai ISO-8601 (UTC).
- Field bertanda tanya (?) di dokumen bersifat opsional.

Di sisi Python kita memakai snake_case secara internal dan meng-alias-kan
ke camelCase untuk serialisasi/deserialisasi JSON, sehingga kontrak di kawat
tetap sama persis dengan dokumen sementara kode Python tetap idiomatik.
"""

from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base: serialisasi camelCase, terima camelCase maupun snake_case."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        use_enum_values=True,
        # Validasi saat assignment agar status sesi yang diubah mesin status
        # tetap tersimpan sebagai nilai string (mis. "EVALUASI"), bukan objek
        # enum — menjaga konsistensi serialisasi di REST maupun WebSocket.
        validate_assignment=True,
    )


def utc_now_iso() -> str:
    """Waktu sekarang sebagai string ISO-8601 UTC (kontrak waktu §6)."""
    return datetime.now(timezone.utc).isoformat()
