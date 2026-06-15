from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import ContentChunk, CrawledPage, WebsiteAnalysis
from app.services import chunker, cleaner, crawler, generation, qdrant_service
from app.services.embeddings import embed_texts

logger = logging.getLogger(__name__)


def run_analysis(
    db: Session,
    analysis: WebsiteAnalysis,
    max_pages: int,
    on_progress: Callable[[str, str], None] | None = None,
) -> WebsiteAnalysis:
    """Run the website analysis pipeline and update the analysis record."""
    def _p(step: str, message: str) -> None:
        if on_progress:
            on_progress(step, message)

    qdrant_service.ensure_collection()

    analysis.status = "crawling"
    # Save each phase so the workspace can show progress if a later step fails.
    db.commit()
    _p("crawling", "Crawling website")

    crawl_result = crawler.crawl_site(analysis.normalized_url, max_pages)
    analysis.website_title = crawl_result.site_title
    _p("cleaning", "Extracting readable text")

    all_chunk_rows: list[ContentChunk] = []
    chunk_texts: list[str] = []
    upsert_meta: list[tuple[ContentChunk, str, str | None]] = []

    pages_ok = 0
    for page_data in crawl_result.pages:
        cleaned = cleaner.clean_html(page_data.raw_html) if page_data.status == "ok" else ""
        page = CrawledPage(
            analysis_id=analysis.id,
            page_url=page_data.url,
            page_title=page_data.title,
            raw_text=page_data.raw_html[:200_000] if page_data.raw_html else None,
            cleaned_text=cleaned,
            word_count=cleaner.word_count(cleaned),
            crawl_status=page_data.status,
        )
        db.add(page)
        db.flush()  # Flush to generate page.id before creating chunks that reference it.

        if page_data.status != "ok" or not cleaned:
            continue
        pages_ok += 1

        for ch in chunker.chunk_text(cleaned):
            row = ContentChunk(
                analysis_id=analysis.id,
                page_id=page.id,
                chunk_index=ch.index,
                chunk_text=ch.text,
                token_count=ch.token_count,
            )
            db.add(row)
            db.flush()
            all_chunk_rows.append(row)
            chunk_texts.append(ch.text)
            upsert_meta.append((row, page.page_url, page.page_title))

    _p("chunking", "Creating chunks")

    if not chunk_texts:
        analysis.status = "failed"
        analysis.pages_crawled = pages_ok
        db.commit()
        raise ValueError("No readable content found on the website.")

    # Keep embedding requests within provider batch limits.
    analysis.status = "embedding"
    db.commit()
    _p("embedding", "Generating embeddings")

    vectors: list[list[float]] = []
    batch = 64
    for i in range(0, len(chunk_texts), batch):
        vectors.extend(embed_texts(chunk_texts[i : i + batch]))

    _p("indexing", "Indexing in Qdrant")

    now = datetime.now(timezone.utc).isoformat()
    points = [
        qdrant_service.UpsertPoint(
            chunk_id=row.id,
            analysis_id=analysis.id,
            page_id=row.page_id,
            page_url=page_url,
            page_title=page_title,
            chunk_text=row.chunk_text,
            chunk_index=row.chunk_index,
            created_at=now,
            vector=vec,
        )
        for (row, page_url, page_title), vec in zip(upsert_meta, vectors, strict=True)
    ]
    point_ids = qdrant_service.upsert_chunks(points)
    for row, pid in zip(all_chunk_rows, point_ids, strict=True):
        row.qdrant_point_id = pid

    analysis.pages_crawled = pages_ok
    analysis.chunks_indexed = len(all_chunk_rows)
    db.commit()

    # Generate only from indexed content so derived outputs remain source-backed.
    analysis.status = "summarizing"
    db.commit()
    _p("summarizing", "Creating website summary")

    try:
        analysis.summary = generation.generate_summary(analysis.id)
        topics = generation.generate_topics(analysis.id)
        analysis.key_topics = topics["key_topics"]
        analysis.suggested_questions = topics["suggested_questions"]
    except Exception as exc:  # noqa: BLE001 - keep the indexed analysis if summaries fail
        logger.warning("Summary generation failed: %s", exc)

    analysis.status = "scoring"
    db.commit()
    _p("scoring", "Generating website score")
    try:
        generation.create_score_record(db, analysis.id)
    except Exception as exc:  # noqa: BLE001 - scoring can be retried from the workspace
        db.rollback()
        logger.warning("Automatic score generation failed: %s", exc)

    analysis.status = "reporting"
    db.commit()
    _p("reporting", "Generating research brief")
    try:
        generation.create_report_record(db, analysis)
    except Exception as exc:  # noqa: BLE001 - report generation can be retried from the workspace
        db.rollback()
        logger.warning("Automatic brief generation failed: %s", exc)

    analysis.status = "completed"
    db.commit()
    _p("completing", "Building dashboard")
    db.refresh(analysis)
    return analysis
