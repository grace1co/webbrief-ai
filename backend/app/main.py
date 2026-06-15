"""FastAPI entrypoint for WebBrief AI."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import ai, analysis

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="WebBrief AI",
    description="Turn any website into an instant research brief.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)
app.include_router(ai.router)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "service": "webbrief-ai"}
