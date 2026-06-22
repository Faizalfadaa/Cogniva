"""Cogniva FastAPI application entrypoint (modular-monolith backend, §2.1).

Combines the REST layer (session lifecycle) and the WebSocket layer (real-time
session channel). For M0 this is a skeleton: the data contracts & state machine
are already enforced, while the AI agent logic comes in later milestones.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import rest, websocket

app = FastAPI(
    title="Cogniva",
    description="A Learning-by-Teaching study platform — backend M0",
    version="0.1.0-m0",
)

# The frontend SPA (Vite dev server) calls the backend cross-origin in dev.
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
    """Simple health check for deployment/testing."""
    return {"status": "ok", "milestone": "M0"}
