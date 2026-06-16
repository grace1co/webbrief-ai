from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    url: str
    max_pages: int = Field(default=10, ge=1, le=25)


class AnalyzeResponse(BaseModel):
    analysis_id: str
    website_title: str | None
    url: str
    pages_crawled: int
    chunks_indexed: int
    status: str


class ScorePreview(BaseModel):
    overall_usefulness: int | None = None


class AnalysisDetail(BaseModel):
    analysis_id: str
    website_title: str | None
    url: str
    date_analyzed: datetime
    summary: str | None
    key_topics: list[str] = []
    suggested_questions: list[str] = []
    pages_crawled: int
    chunks_indexed: int
    status: str
    score_preview: ScorePreview | None = None
    website_type: str = ""
    has_pricing: bool = False
    is_saved: bool = False


class AnalysisListItem(BaseModel):
    analysis_id: str
    website_title: str | None
    url: str
    date_analyzed: datetime
    pages_crawled: int
    summary_preview: str | None
    overall_score: int | None = None
    is_saved: bool = False


class HistorySettingsResponse(BaseModel):
    retention_days: int | None = 30


class HistorySettingsUpdate(BaseModel):
    retention_days: Literal[7, 30, 90] | None = 30


class ChunkOut(BaseModel):
    id: str
    chunk_index: int
    chunk_text: str
    token_count: int


class SourcePage(BaseModel):
    id: str
    page_title: str | None
    page_url: str
    crawl_status: str
    word_count: int
    chunk_count: int
    date_crawled: datetime
    preview: str | None
    chunks: list[ChunkOut] = []


class ChatRequest(BaseModel):
    analysis_id: str
    question: str


class Citation(BaseModel):
    page_title: str | None
    page_url: str
    excerpt: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation] = []


class GenerateReportRequest(BaseModel):
    analysis_id: str


class ReportSection(BaseModel):
    key: str
    label: str
    content: str = ""
    tone: str = ""


class ResearchBrief(BaseModel):
    # Keep older saved reports readable while current reports use sections.
    sections: list[ReportSection] = []
    executive_summary: str = ""
    products_services: str = ""
    target_audience: str = ""
    pricing: str = ""
    trust_signals: str = ""
    missing_information: str = ""
    strengths: str = ""
    weaknesses: str = ""
    final_recommendation: str = ""


class GenerateReportResponse(BaseModel):
    report_id: str
    report: ResearchBrief
    website_type: str = ""
    has_pricing: bool = False


class ScoreRequest(BaseModel):
    analysis_id: str


class ScoreItem(BaseModel):
    score: int
    explanation: str


class DynamicScoreDimension(BaseModel):
    key: str
    label: str
    score: int
    explanation: str


class ScoreResponse(BaseModel):
    analysis_id: str
    # Current scores use dimensions; the score map supports older clients.
    dimensions: list[DynamicScoreDimension] = []
    website_type: str = ""
    has_pricing: bool = False
    scores: dict[str, ScoreItem] = {}


class CompareSiteInput(BaseModel):
    analysis_id: str | None = None
    url: str | None = None
    label: str | None = None


class CompareRequest(BaseModel):
    analysis_id_a: str | None = None
    analysis_id_b: str | None = None
    url_a: str | None = None
    url_b: str | None = None
    sites: list[CompareSiteInput] | None = None


class ComparisonSite(BaseModel):
    site_key: str
    label: str = ""
    summary: str = ""
    website_type: str = ""
    has_pricing: bool = False


class ComparisonValue(BaseModel):
    site_key: str
    finding: str = ""


class ComparisonDimension(BaseModel):
    key: str
    label: str
    site_a: str = ""
    site_b: str = ""
    values: list[ComparisonValue] = []


class CompareResponse(BaseModel):
    comparison_id: str
    sites: list[ComparisonSite] = []
    website_a_summary: str = ""
    website_b_summary: str = ""
    website_a_type: str = ""
    website_b_type: str = ""
    has_pricing_a: bool = False
    has_pricing_b: bool = False
    # Comparison criteria vary by website type, so they are stored as dimensions.
    dimensions: list[ComparisonDimension] = []
    similarities: list[str] = []
    differences: list[str] = []
    final_summary: str = ""
    # Older comparison records may populate these instead of dimensions.
    product_service_comparison: str = ""
    pricing_comparison: str = ""
    trust_comparison: str = ""
    clarity_comparison: str = ""
    winner_for_clarity: str = ""
    winner_for_completeness: str = ""
