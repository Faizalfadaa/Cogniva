"""Titik masuk aplikasi FastAPI Cogniva (backend modular-monolith, §2.1).

Menggabungkan lapisan REST (siklus hidup sesi) dan WebSocket (jalur sesi
real-time). Untuk M0 ini adalah kerangka: kontrak data & mesin status sudah
ditegakkan, sementara logika agen AI menyusul di milestone berikutnya.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import rest, websocket

app = FastAPI(
    title="Cogniva",
    description="Platform Belajar dengan Prinsip Learning by Teaching — backend M0",
    version="0.1.0-m0",
)

# Frontend SPA (Vite dev server) memanggil backend lintas origin saat dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rest.router)
app.include_router(websocket.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Cek kesehatan sederhana untuk deployment/uji."""
    return {"status": "ok", "milestone": "M0"}
