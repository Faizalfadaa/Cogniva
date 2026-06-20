"""Memastikan paket `app` dapat diimpor saat menjalankan pytest dari backend/."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
