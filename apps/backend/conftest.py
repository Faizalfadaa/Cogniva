"""Ensure the `app` package is importable when running pytest from backend/."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
