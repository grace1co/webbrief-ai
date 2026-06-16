from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import (
    ChatMessage,
    GeneratedReport,
    WebsiteAnalysis,
    WebsiteComparison,
    WebsiteScore,
)
from app.schemas import (
    ChatRequest,
    ChatResponse,
    CompareRequest,
    CompareResponse,
    ComparisonDimension,
    ComparisonSite,
    ComparisonValue,
    DynamicScoreDimension,
    GenerateReportRequest,
    GenerateReportResponse,
    ReportSection,
    ResearchBrief,
    ScoreItem,
    ScoreRequest,
    ScoreResponse,
)
from app.services import analysis_service, generation, rag_service
from app.utils.url_guard import UrlValidationError, validate_public_url

router = APIRouter(prefix="/api", tags=["ai"])


def _require_analysis(db: Session, analysis_id: str) -> WebsiteAnalysis:
    obj = db.get(WebsiteAnalysis, analysis_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return obj


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    _require_analysis(db, body.analysis_id)
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    db.add(ChatMessage(analysis_id=body.analysis_id, role="user", content=body.question))
    db.commit()

    try:
        result = rag_service.answer_question(body.analysis_id, body.question)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Chat failed: {exc}") from exc

    db.add(
        ChatMessage(
            analysis_id=body.analysis_id,
            role="assistant",
            content=result.answer,
            citations=result.citations,
        )
    )
    db.commit()
    return ChatResponse(answer=result.answer, citations=result.citations)


@router.post("/chat/stream")
def chat_stream(body: ChatRequest) -> StreamingResponse:
    """Stream the answer and save the final assistant message after completion."""
    with SessionLocal() as db:
        if db.get(WebsiteAnalysis, body.analysis_id) is None:
            raise HTTPException(status_code=404, detail="Analysis not found.")
        if not body.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty.")
        db.add(ChatMessage(analysis_id=body.analysis_id, role="user", content=body.question))
        db.commit()

    analysis_id = body.analysis_id
    question = body.question
    answer_parts: list[str] = []
    saved_citations: list[dict] = []

    def _gen():
        for event_json in rag_service.answer_question_stream(analysis_id, question):
            data = json.loads(event_json)
            if data["event"] == "token":
                answer_parts.append(data["data"])
            elif data["event"] == "citations":
                saved_citations.extend(data["data"])
            yield f"data: {event_json}\n\n"
        with SessionLocal() as db2:
            db2.add(ChatMessage(
                analysis_id=analysis_id,
                role="assistant",
                content="".join(answer_parts),
                citations=saved_citations,
            ))
            db2.commit()

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/generate-report", response_model=GenerateReportResponse)
def generate_report(
    body: GenerateReportRequest, db: Session = Depends(get_db)
) -> GenerateReportResponse:
    a = _require_analysis(db, body.analysis_id)
    try:
        row, report_dict = generation.create_report_record(db, a)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Report failed: {exc}") from exc

    return GenerateReportResponse(
        report_id=row.id,
        report=ResearchBrief(**report_dict),
        website_type=report_dict.get("website_type", ""),
        has_pricing=bool(report_dict.get("has_pricing", False)),
    )


@router.get("/analysis/{analysis_id}/report", response_model=GenerateReportResponse)
def get_latest_report(
    analysis_id: str, db: Session = Depends(get_db)
) -> GenerateReportResponse:
    _require_analysis(db, analysis_id)
    row = db.scalar(
        select(GeneratedReport)
        .where(
            GeneratedReport.analysis_id == analysis_id,
            GeneratedReport.report_type == "research_brief",
        )
        .order_by(GeneratedReport.created_at.desc())
    )
    if row is None or not row.report_json:
        raise HTTPException(status_code=404, detail="Research brief is not available yet.")

    report_dict = row.report_json
    return GenerateReportResponse(
        report_id=row.id,
        report=ResearchBrief(**report_dict),
        website_type=report_dict.get("website_type", ""),
        has_pricing=bool(report_dict.get("has_pricing", False)),
    )


@router.post("/score-website", response_model=ScoreResponse)
def score_website(body: ScoreRequest, db: Session = Depends(get_db)) -> ScoreResponse:
    _require_analysis(db, body.analysis_id)
    try:
        _, result = generation.create_score_record(db, body.analysis_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Scoring failed: {exc}") from exc

    return _build_score_response(body.analysis_id, result)


@router.get("/analysis/{analysis_id}/score", response_model=ScoreResponse)
def get_latest_score(analysis_id: str, db: Session = Depends(get_db)) -> ScoreResponse:
    _require_analysis(db, analysis_id)
    row = db.scalar(
        select(WebsiteScore)
        .where(WebsiteScore.analysis_id == analysis_id)
        .order_by(WebsiteScore.created_at.desc())
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Website score is not available yet.")

    explanations = row.explanations_json or {}
    dynamic_dims = explanations.get("_dynamic", [])

    if dynamic_dims:
        # Current score records keep flexible dimensions in the JSON payload.
        return ScoreResponse(
            analysis_id=analysis_id,
            dimensions=[DynamicScoreDimension(**d) for d in dynamic_dims],
            website_type=explanations.get("website_type", ""),
            has_pricing=bool(explanations.get("has_pricing", False)),
            scores={
                d["key"]: ScoreItem(score=d["score"], explanation=d["explanation"])
                for d in dynamic_dims
            },
        )

    # Older score records use fixed database columns instead of dimensions.
    values = {
        "clarity": row.clarity_score,
        "trustworthiness": row.trustworthiness_score,
        "pricing_transparency": row.pricing_transparency_score,
        "content_completeness": row.content_completeness_score,
        "navigation_quality": row.navigation_quality_score,
        "customer_readiness": row.customer_readiness_score,
        "overall_usefulness": row.overall_usefulness_score,
    }
    legacy_labels = {
        "clarity": "Clarity",
        "trustworthiness": "Trustworthiness",
        "pricing_transparency": "Pricing Transparency",
        "content_completeness": "Content Completeness",
        "navigation_quality": "Navigation Quality",
        "customer_readiness": "Customer Readiness",
        "overall_usefulness": "Overall Usefulness",
    }
    dimensions = [
        DynamicScoreDimension(
            key=key,
            label=legacy_labels[key],
            score=value or 0,
            explanation=explanations.get(key, ""),
        )
        for key, value in values.items()
        if value is not None
    ]
    return ScoreResponse(
        analysis_id=analysis_id,
        dimensions=dimensions,
        scores={d.key: ScoreItem(score=d.score, explanation=d.explanation) for d in dimensions},
    )


def _build_score_response(analysis_id: str, result: dict) -> ScoreResponse:
    dimensions = [DynamicScoreDimension(**d) for d in result.get("dimensions", [])]
    scores = result.get("scores", {})
    return ScoreResponse(
        analysis_id=analysis_id,
        dimensions=dimensions,
        website_type=result.get("website_type", ""),
        has_pricing=bool(result.get("has_pricing", False)),
        scores={k: ScoreItem(**v) for k, v in scores.items()},
    )


@router.post("/compare-websites", response_model=CompareResponse)
def compare_websites(body: CompareRequest, db: Session = Depends(get_db)) -> CompareResponse:
    def resolve(analysis_id: str | None, url: str | None) -> WebsiteAnalysis:
        if analysis_id:
            return _require_analysis(db, analysis_id)
        if url:
            try:
                normalized = validate_public_url(url)
            except UrlValidationError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            a = WebsiteAnalysis(root_url=url, normalized_url=normalized, status="pending")
            db.add(a)
            db.commit()
            db.refresh(a)
            try:
                analysis_service.run_analysis(db, a, max_pages=8)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=502, detail=f"Analysis failed: {exc}") from exc
            return a
        raise HTTPException(status_code=400, detail="Provide an analysis_id or url for both sides.")

    if body.sites:
        if not 2 <= len(body.sites) <= 5:
            raise HTTPException(status_code=400, detail="Compare between 2 and 5 websites.")
        analyses = [resolve(site.analysis_id, site.url) for site in body.sites]
        labels = [
            site.label or analysis.website_title or analysis.normalized_url
            for site, analysis in zip(body.sites, analyses, strict=False)
        ]
    else:
        analyses = [resolve(body.analysis_id_a, body.url_a), resolve(body.analysis_id_b, body.url_b)]
        labels = [
            analyses[0].website_title or "Current Website",
            analyses[1].website_title or "Competitor Website",
        ]

    try:
        comp = generation.generate_multi_comparison([a.id for a in analyses], labels)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Comparison failed: {exc}") from exc

    row = WebsiteComparison(analysis_id_a=analyses[0].id, analysis_id_b=analyses[1].id, comparison_json=comp)
    db.add(row)
    db.commit()
    db.refresh(row)

    # Skip dimensions without keys because the UI needs stable identifiers.
    raw_dims = comp.get("dimensions", [])
    dimensions = [
        ComparisonDimension(
            key=str(d.get("key", "")),
            label=str(d.get("label", "")),
            site_a=str(d.get("site_a", "")),
            site_b=str(d.get("site_b", "")),
            values=[
                ComparisonValue(site_key=str(v.get("site_key", "")), finding=str(v.get("finding", "")))
                for v in d.get("values", [])
            ],
        )
        for d in raw_dims
        if d.get("key")
    ]

    return CompareResponse(
        comparison_id=row.id,
        sites=[ComparisonSite(**site) for site in comp.get("sites", [])],
        website_a_summary=comp.get("website_a_summary", ""),
        website_b_summary=comp.get("website_b_summary", ""),
        website_a_type=comp.get("website_a_type", ""),
        website_b_type=comp.get("website_b_type", ""),
        has_pricing_a=bool(comp.get("has_pricing_a", False)),
        has_pricing_b=bool(comp.get("has_pricing_b", False)),
        dimensions=dimensions,
        similarities=comp.get("similarities", []),
        differences=comp.get("differences", []),
        final_summary=comp.get("final_summary", ""),
        # Older clients still read these fixed comparison fields.
        product_service_comparison=comp.get("product_service_comparison", ""),
        pricing_comparison=comp.get("pricing_comparison", ""),
        trust_comparison=comp.get("trust_comparison", ""),
        clarity_comparison=comp.get("clarity_comparison", ""),
        winner_for_clarity=comp.get("winner_for_clarity", ""),
        winner_for_completeness=comp.get("winner_for_completeness", ""),
    )
