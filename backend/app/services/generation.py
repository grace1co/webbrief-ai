"""Generate summaries, reports, scores, and comparisons from retrieved website content."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import GeneratedReport, WebsiteAnalysis, WebsiteScore
from app.services import rag_service
from app.services.llm import chat_json
from app.services.prompts import (
    COMPARE_SYSTEM,
    REPORT_SYSTEM,
    SCORE_SYSTEM,
    SUMMARY_SYSTEM,
    TOPICS_SYSTEM,
)

# Keep reports created before dynamic sections readable.
REPORT_FIELDS = [
    "executive_summary", "products_services", "target_audience", "pricing",
    "trust_signals", "missing_information", "strengths", "weaknesses",
    "final_recommendation",
]

# Keep fixed score fields populated for older score records and clients.
LEGACY_SCORE_KEYS = {
    "clarity", "trustworthiness", "pricing_transparency", "content_completeness",
    "navigation_quality", "customer_readiness", "overall_usefulness",
}


def create_report_record(db: Session, analysis: WebsiteAnalysis) -> tuple[GeneratedReport, dict]:
    report = generate_report(analysis.id)
    row = GeneratedReport(
        analysis_id=analysis.id,
        report_type="research_brief",
        report_json=report,
        report_markdown=render_report_markdown(report, analysis.website_title),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, report


def create_score_record(db: Session, analysis_id: str) -> tuple[WebsiteScore, dict]:
    result = generate_scores(analysis_id)
    dimensions = result["dimensions"]
    scores = result["scores"]

    row = WebsiteScore(
        analysis_id=analysis_id,
        clarity_score=scores.get("clarity", {}).get("score", 0),
        trustworthiness_score=scores.get("trustworthiness", {}).get("score", 0),
        pricing_transparency_score=scores.get("pricing_transparency", {}).get("score", 0),
        content_completeness_score=scores.get("content_completeness", {}).get("score", 0),
        navigation_quality_score=scores.get("navigation_quality", {}).get("score", 0),
        customer_readiness_score=scores.get("customer_readiness", {}).get("score", 0),
        overall_usefulness_score=scores.get("overall_usefulness", {}).get("score", 0),
        explanations_json={
            "_dynamic": dimensions,
            "website_type": result["website_type"],
            "has_pricing": result["has_pricing"],
        },
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, result


def generate_summary(analysis_id: str) -> str:
    context = rag_service.gather_context(analysis_id, "what this website is about overview", top_k=10)
    return chat_json(
        SUMMARY_SYSTEM + " Return JSON {\"summary\": str}.",
        f"Context:\n{context}\n\nWrite the summary.",
    ).get("summary", "")


def generate_topics(analysis_id: str) -> dict:
    context = rag_service.gather_context(analysis_id, "main topics and key offerings", top_k=10)
    data = chat_json(TOPICS_SYSTEM, f"Context:\n{context}\n\nReturn the JSON.")
    return {
        "key_topics": data.get("key_topics", []),
        "suggested_questions": data.get("suggested_questions", []),
        "website_type": data.get("website_type", "other"),
        "has_pricing": bool(data.get("has_pricing", False)),
    }


def generate_report(analysis_id: str) -> dict:
    context = rag_service.gather_context(
        analysis_id,
        (
            "website overview products services key offerings target audience pricing "
            "trust signals strengths weaknesses missing information recommendation"
        ),
        top_k=16,
    )
    data = chat_json(REPORT_SYSTEM, f"Context:\n{context}\n\nReturn the research brief JSON.")

    website_type = str(data.get("website_type", "other"))
    has_pricing = bool(data.get("has_pricing", False))
    raw_sections = data.get("sections", [])

    sections: list[dict] = []
    for sec in raw_sections:
        key = str(sec.get("key", "")).strip()
        if not key:
            continue
        sections.append({
            "key": key,
            "label": str(sec.get("label", key.replace("_", " ").title())),
            "content": str(sec.get("content", "")),
            "tone": str(sec.get("tone", "")),
        })

    # Older stored reports and clients still read the fixed fields.
    legacy: dict[str, str] = {field: "" for field in REPORT_FIELDS}
    for sec in sections:
        if sec["key"] in legacy:
            legacy[sec["key"]] = sec["content"]

    return {
        "sections": sections,
        "website_type": website_type,
        "has_pricing": has_pricing,
        **legacy,
    }


def render_report_markdown(report: dict, title: str | None) -> str:
    heading = title or "Website"
    lines = [f"# Research Brief — {heading}", ""]

    sections = report.get("sections", [])

    # New reports use dynamic sections; older reports fall back to fixed fields.
    if sections:
        for sec in sections:
            lines.append(f"## {sec['label']}")
            lines.append(sec.get("content", "") or "_Not found in the crawled website sources._")
            lines.append("")
    else:
        label = {
            "executive_summary": "Executive Summary",
            "products_services": "Products & Services or Key Offerings",
            "target_audience": "Target Audience",
            "pricing": "Pricing Information",
            "trust_signals": "Trust Signals",
            "missing_information": "Information Gaps",
            "strengths": "Strengths",
            "weaknesses": "Weaknesses",
            "final_recommendation": "Final Recommendation",
        }
        for field in REPORT_FIELDS:
            lines.append(f"## {label[field]}")
            lines.append(report.get(field, "") or "_Not found in the crawled website sources._")
            lines.append("")

    return "\n".join(lines)


def generate_scores(analysis_id: str) -> dict:
    context = rag_service.gather_context(
        analysis_id, "clarity trust pricing completeness navigation", top_k=16
    )
    data = chat_json(SCORE_SYSTEM, f"Context:\n{context}\n\nReturn the scores JSON.")

    website_type = str(data.get("website_type", "other"))
    has_pricing = bool(data.get("has_pricing", False))

    raw_dimensions = data.get("dimensions", [])
    dimensions: list[dict] = []
    for dim in raw_dimensions:
        key = str(dim.get("key", "")).strip()
        if not key:
            continue
        try:
            score = max(0, min(10, int(dim.get("score", 0))))
        except (TypeError, ValueError):
            score = 0
        dimensions.append({
            "key": key,
            "label": str(dim.get("label", key.replace("_", " ").title())),
            "score": score,
            "explanation": str(dim.get("explanation", "")),
        })

    # Older score records still depend on the fixed database columns.
    scores: dict[str, dict] = {}
    for dim in dimensions:
        scores[dim["key"]] = {"score": dim["score"], "explanation": dim["explanation"]}
    for legacy_key in LEGACY_SCORE_KEYS:
        if legacy_key not in scores:
            scores[legacy_key] = {"score": 0, "explanation": ""}

    return {
        "dimensions": dimensions,
        "website_type": website_type,
        "has_pricing": has_pricing,
        "scores": scores,
    }


def generate_comparison(analysis_id_a: str, analysis_id_b: str) -> dict:
    ctx_a = rag_service.gather_context(analysis_id_a, "overview products pricing trust", top_k=12)
    ctx_b = rag_service.gather_context(analysis_id_b, "overview products pricing trust", top_k=12)
    user = (
        f"WEBSITE A CONTEXT:\n{ctx_a}\n\n"
        f"WEBSITE B CONTEXT:\n{ctx_b}\n\n"
        "Return the comparison JSON."
    )
    return chat_json(COMPARE_SYSTEM, user)
