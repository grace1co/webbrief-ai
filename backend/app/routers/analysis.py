from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import ContentChunk, CrawledPage, SavedAnalysis, WebsiteAnalysis, WebsiteScore
from app.schemas import (
    AnalysisDetail,
    AnalysisListItem,
    AnalyzeRequest,
    AnalyzeResponse,
    ChunkOut,
    HistorySettingsResponse,
    HistorySettingsUpdate,
    ScorePreview,
    SourcePage,
)
from app.services import analysis_service, history_service, qdrant_service
from app.utils.url_guard import UrlValidationError, validate_public_url

router = APIRouter(prefix="/api", tags=["analysis"])

# Keywords used to estimate pricing availability when score metadata is missing.
_PRICING_KEYWORDS = {
    "pricing", "price", "prices", "plan", "plans", "cost", "costs",
    "subscription", "subscriptions", "buy", "purchase", "paid", "fee",
    "fees", "payment", "payments", "shop", "checkout", "donate",
    "donation", "donations", "hire", "billing", "trial",
}


def _detect_has_pricing(summary: str | None, key_topics: list | None) -> bool:
    """Estimate pricing availability when score metadata does not exist yet."""
    text = ((summary or "") + " " + " ".join(key_topics or [])).lower()
    return bool(set(text.split()).intersection(_PRICING_KEYWORDS))


@router.post("/analyze-url", response_model=AnalyzeResponse)
def analyze_url(body: AnalyzeRequest, db: Session = Depends(get_db)) -> AnalyzeResponse:
    try:
        normalized = validate_public_url(body.url)
    except UrlValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    analysis = WebsiteAnalysis(
        root_url=body.url, normalized_url=normalized, status="pending"
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    try:
        analysis_service.run_analysis(db, analysis, body.max_pages)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        analysis.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}") from exc

    return AnalyzeResponse(
        analysis_id=analysis.id,
        website_title=analysis.website_title,
        url=analysis.normalized_url,
        pages_crawled=analysis.pages_crawled,
        chunks_indexed=analysis.chunks_indexed,
        status=analysis.status,
    )


@router.post("/analyze-url/stream")
async def analyze_url_stream(body: AnalyzeRequest) -> StreamingResponse:
    """Stream crawl progress while the site is being analyzed."""
    try:
        normalized = validate_public_url(body.url)
    except UrlValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    def _on_progress(step: str, message: str) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, {"event": "progress", "step": step, "message": message})

    # Run crawling in a worker thread so progress streaming does not block the event loop.
    def _thread_work() -> None:
        db = SessionLocal()
        try:
            analysis = WebsiteAnalysis(root_url=body.url, normalized_url=normalized, status="pending")
            db.add(analysis)
            db.commit()
            db.refresh(analysis)
            result = analysis_service.run_analysis(db, analysis, body.max_pages, _on_progress)
            loop.call_soon_threadsafe(queue.put_nowait, {
                "event": "complete",
                "analysis_id": result.id,
                "website_title": result.website_title,
                "url": result.normalized_url,
                "pages_crawled": result.pages_crawled,
                "chunks_indexed": result.chunks_indexed,
                "status": result.status,
            })
        except ValueError as exc:
            loop.call_soon_threadsafe(queue.put_nowait, {"event": "error", "message": str(exc)})
        except Exception as exc:  # noqa: BLE001 - return crawler failures as stream errors
            loop.call_soon_threadsafe(queue.put_nowait, {"event": "error", "message": f"Analysis failed: {exc}"})
        finally:
            db.close()
            loop.call_soon_threadsafe(queue.put_nowait, None)

    async def _event_gen():
        task = asyncio.create_task(asyncio.to_thread(_thread_work))
        try:
            # Send each queued progress message as an SSE event.
            while True:
                msg = await queue.get()
                if msg is None:
                    break
                yield f"data: {json.dumps(msg)}\n\n"
        except GeneratorExit:
            task.cancel()

    return StreamingResponse(
        _event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _get_analysis(db: Session, analysis_id: str) -> WebsiteAnalysis:
    """Return an analysis or raise 404."""
    obj = db.get(WebsiteAnalysis, analysis_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return obj


@router.get("/analysis/{analysis_id}", response_model=AnalysisDetail)
def get_analysis(analysis_id: str, db: Session = Depends(get_db)) -> AnalysisDetail:
    history_service.cleanup_expired_history(db)
    a = _get_analysis(db, analysis_id)
    score = db.scalar(
        select(WebsiteScore).where(WebsiteScore.analysis_id == analysis_id)
        .order_by(WebsiteScore.created_at.desc())
    )

    # Use scoring metadata when available; older analyses require a summary-based fallback.
    score_meta = (score.explanations_json or {}) if score else {}
    website_type = str(score_meta.get("website_type", ""))
    if score_meta.get("has_pricing") is not None:
        has_pricing = bool(score_meta["has_pricing"])
    else:
        has_pricing = _detect_has_pricing(a.summary, a.key_topics)

    return AnalysisDetail(
        analysis_id=a.id,
        website_title=a.website_title,
        url=a.normalized_url,
        date_analyzed=a.created_at,
        summary=a.summary,
        key_topics=a.key_topics or [],
        suggested_questions=a.suggested_questions or [],
        pages_crawled=a.pages_crawled,
        chunks_indexed=a.chunks_indexed,
        status=a.status,
        score_preview=ScorePreview(
            overall_usefulness=score.overall_usefulness_score if score else None
        ),
        website_type=website_type,
        has_pricing=has_pricing,
        is_saved=a.saved_entry is not None,
    )


@router.get("/analyses", response_model=list[AnalysisListItem])
def list_analyses(db: Session = Depends(get_db)) -> list[AnalysisListItem]:
    return list_history(db)


@router.get("/history", response_model=list[AnalysisListItem])
def list_history(db: Session = Depends(get_db)) -> list[AnalysisListItem]:
    history_service.cleanup_expired_history(db)
    rows = db.scalars(
        select(WebsiteAnalysis).order_by(WebsiteAnalysis.created_at.desc())
    ).all()
    items: list[AnalysisListItem] = []
    for a in rows:
        score = db.scalar(
            select(WebsiteScore).where(WebsiteScore.analysis_id == a.id)
            .order_by(WebsiteScore.created_at.desc())
        )
        items.append(
            AnalysisListItem(
                analysis_id=a.id,
                website_title=a.website_title,
                url=a.normalized_url,
                date_analyzed=a.created_at,
                pages_crawled=a.pages_crawled,
                summary_preview=(a.summary or "")[:180] or None,
                overall_score=score.overall_usefulness_score if score else None,
                is_saved=a.saved_entry is not None,
            )
        )
    return items


@router.get("/saved", response_model=list[AnalysisListItem])
def list_saved(db: Session = Depends(get_db)) -> list[AnalysisListItem]:
    rows = db.scalars(
        select(WebsiteAnalysis)
        .join(SavedAnalysis, SavedAnalysis.analysis_id == WebsiteAnalysis.id)
        .order_by(SavedAnalysis.created_at.desc())
    ).all()
    items: list[AnalysisListItem] = []
    for a in rows:
        score = db.scalar(
            select(WebsiteScore).where(WebsiteScore.analysis_id == a.id)
            .order_by(WebsiteScore.created_at.desc())
        )
        items.append(
            AnalysisListItem(
                analysis_id=a.id,
                website_title=a.website_title,
                url=a.normalized_url,
                date_analyzed=a.created_at,
                pages_crawled=a.pages_crawled,
                summary_preview=(a.summary or "")[:180] or None,
                overall_score=score.overall_usefulness_score if score else None,
                is_saved=True,
            )
        )
    return items


@router.put("/analysis/{analysis_id}/saved")
def save_analysis(analysis_id: str, db: Session = Depends(get_db)) -> dict:
    _get_analysis(db, analysis_id)
    row = db.scalar(select(SavedAnalysis).where(SavedAnalysis.analysis_id == analysis_id))
    if row is None:
        db.add(SavedAnalysis(analysis_id=analysis_id))
        db.commit()
    return {"analysis_id": analysis_id, "is_saved": True}


@router.delete("/analysis/{analysis_id}/saved")
def unsave_analysis(analysis_id: str, db: Session = Depends(get_db)) -> dict:
    _get_analysis(db, analysis_id)
    row = db.scalar(select(SavedAnalysis).where(SavedAnalysis.analysis_id == analysis_id))
    if row is not None:
        db.delete(row)
        db.commit()
    return {"analysis_id": analysis_id, "is_saved": False}


@router.get("/history/settings", response_model=HistorySettingsResponse)
def get_history_settings(db: Session = Depends(get_db)) -> HistorySettingsResponse:
    settings = history_service.get_settings(db)
    return HistorySettingsResponse(retention_days=settings.retention_days)


@router.put("/history/settings", response_model=HistorySettingsResponse)
def update_history_settings(
    body: HistorySettingsUpdate, db: Session = Depends(get_db)
) -> HistorySettingsResponse:
    settings = history_service.get_settings(db)
    settings.retention_days = body.retention_days
    settings.cleanup_enabled = body.retention_days is not None
    db.commit()
    history_service.cleanup_expired_history(db)
    return HistorySettingsResponse(retention_days=settings.retention_days)


@router.delete("/history")
def clear_history(db: Session = Depends(get_db)) -> dict:
    deleted = history_service.clear_unsaved_history(db)
    return {"deleted": deleted}


@router.get("/analysis/{analysis_id}/sources", response_model=list[SourcePage])
def get_sources(analysis_id: str, db: Session = Depends(get_db)) -> list[SourcePage]:
    _get_analysis(db, analysis_id)
    pages = db.scalars(
        select(CrawledPage).where(CrawledPage.analysis_id == analysis_id)
        .order_by(CrawledPage.created_at)
    ).all()
    out: list[SourcePage] = []
    for p in pages:
        chunks = db.scalars(
            select(ContentChunk).where(ContentChunk.page_id == p.id)
            .order_by(ContentChunk.chunk_index)
        ).all()
        out.append(
            SourcePage(
                id=p.id,
                page_title=p.page_title,
                page_url=p.page_url,
                crawl_status=p.crawl_status,
                word_count=p.word_count,
                chunk_count=len(chunks),
                date_crawled=p.created_at,
                preview=(p.cleaned_text or "")[:300] or None,
                chunks=[
                    ChunkOut(
                        id=c.id,
                        chunk_index=c.chunk_index,
                        chunk_text=c.chunk_text,
                        token_count=c.token_count,
                    )
                    for c in chunks
                ],
            )
        )
    return out


@router.delete("/analysis/{analysis_id}")
def delete_analysis(analysis_id: str, db: Session = Depends(get_db)) -> dict:
    a = _get_analysis(db, analysis_id)
    try:
        qdrant_service.delete_analysis(analysis_id)
    except Exception:  # noqa: BLE001 - database deletion should survive vector cleanup failures
        pass
    db.delete(a)
    db.commit()
    return {"deleted": analysis_id}
