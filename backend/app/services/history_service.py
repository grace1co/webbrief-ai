"""Manage saved analyses and automatic history cleanup."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import HistorySettings, SavedAnalysis, WebsiteAnalysis
from app.services import qdrant_service

logger = logging.getLogger(__name__)


def get_settings(db: Session) -> HistorySettings:
    settings = db.get(HistorySettings, "default")
    if settings is None:
        settings = HistorySettings(id="default", retention_days=30, cleanup_enabled=True)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def cleanup_expired_history(db: Session) -> int:
    settings = get_settings(db)
    if not settings.cleanup_enabled or settings.retention_days is None:
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.retention_days)
    rows = db.scalars(
        select(WebsiteAnalysis)
        .outerjoin(SavedAnalysis, SavedAnalysis.analysis_id == WebsiteAnalysis.id)
        .where(SavedAnalysis.id.is_(None), WebsiteAnalysis.created_at < cutoff)
    ).all()
    for analysis in rows:
        try:
            qdrant_service.delete_analysis(analysis.id)
        except Exception:  # noqa: BLE001 - retention cleanup must continue if vectors are unavailable
            logger.warning("Vector cleanup failed for expired analysis %s", analysis.id)
        db.delete(analysis)
    if rows:
        db.commit()
    return len(rows)


def clear_unsaved_history(db: Session) -> int:
    rows = db.scalars(
        select(WebsiteAnalysis)
        .outerjoin(SavedAnalysis, SavedAnalysis.analysis_id == WebsiteAnalysis.id)
        .where(SavedAnalysis.id.is_(None))
    ).all()
    for analysis in rows:
        try:
            qdrant_service.delete_analysis(analysis.id)
        except Exception:  # noqa: BLE001 - database cleanup should survive vector cleanup failures
            logger.warning("Vector cleanup failed for analysis %s", analysis.id)
        db.delete(analysis)
    if rows:
        db.commit()
    return len(rows)
