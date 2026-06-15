"""SQLAlchemy ORM models mapping the eight WebBrief AI tables."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analyses: Mapped[list[WebsiteAnalysis]] = relationship(back_populates="user")


class WebsiteAnalysis(Base):
    __tablename__ = "website_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    website_title: Mapped[str | None] = mapped_column(String(500))
    root_url: Mapped[str] = mapped_column(String(2048))
    normalized_url: Mapped[str] = mapped_column(String(2048), index=True)
    summary: Mapped[str | None] = mapped_column(Text)
    key_topics: Mapped[list | None] = mapped_column(JSON)
    suggested_questions: Mapped[list | None] = mapped_column(JSON)
    pages_crawled: Mapped[int] = mapped_column(Integer, default=0)
    chunks_indexed: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User | None] = relationship(back_populates="analyses")
    pages: Mapped[list[CrawledPage]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )
    chunks: Mapped[list[ContentChunk]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )
    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )
    reports: Mapped[list[GeneratedReport]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )
    scores: Mapped[list[WebsiteScore]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )
    saved_entry: Mapped[SavedAnalysis | None] = relationship(
        back_populates="analysis", cascade="all, delete-orphan", uselist=False
    )


class CrawledPage(Base):
    __tablename__ = "crawled_pages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("website_analyses.id", ondelete="CASCADE"), index=True
    )
    page_url: Mapped[str] = mapped_column(String(2048))
    page_title: Mapped[str | None] = mapped_column(String(500))
    raw_text: Mapped[str | None] = mapped_column(Text)
    cleaned_text: Mapped[str | None] = mapped_column(Text)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    crawl_status: Mapped[str] = mapped_column(String(32), default="ok")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped[WebsiteAnalysis] = relationship(back_populates="pages")
    chunks: Mapped[list[ContentChunk]] = relationship(
        back_populates="page", cascade="all, delete-orphan"
    )


class ContentChunk(Base):
    __tablename__ = "content_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("website_analyses.id", ondelete="CASCADE"), index=True
    )
    page_id: Mapped[str] = mapped_column(ForeignKey("crawled_pages.id", ondelete="CASCADE"))
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    chunk_text: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    qdrant_point_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped[WebsiteAnalysis] = relationship(back_populates="chunks")
    page: Mapped[CrawledPage] = relationship(back_populates="chunks")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("website_analyses.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    citations: Mapped[list | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped[WebsiteAnalysis] = relationship(back_populates="messages")


class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("website_analyses.id", ondelete="CASCADE"), index=True
    )
    report_type: Mapped[str] = mapped_column(String(64), default="research_brief")
    report_json: Mapped[dict | None] = mapped_column(JSON)
    report_markdown: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped[WebsiteAnalysis] = relationship(back_populates="reports")


class WebsiteScore(Base):
    __tablename__ = "website_scores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("website_analyses.id", ondelete="CASCADE"), index=True
    )
    clarity_score: Mapped[int | None] = mapped_column(Integer)
    trustworthiness_score: Mapped[int | None] = mapped_column(Integer)
    pricing_transparency_score: Mapped[int | None] = mapped_column(Integer)
    content_completeness_score: Mapped[int | None] = mapped_column(Integer)
    navigation_quality_score: Mapped[int | None] = mapped_column(Integer)
    customer_readiness_score: Mapped[int | None] = mapped_column(Integer)
    overall_usefulness_score: Mapped[int | None] = mapped_column(Integer)
    explanations_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped[WebsiteAnalysis] = relationship(back_populates="scores")


class WebsiteComparison(Base):
    __tablename__ = "website_comparisons"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_id_a: Mapped[str] = mapped_column(String(36), index=True)
    analysis_id_b: Mapped[str] = mapped_column(String(36), index=True)
    comparison_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SavedAnalysis(Base):
    __tablename__ = "saved_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(
        ForeignKey("website_analyses.id", ondelete="CASCADE"), unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped[WebsiteAnalysis] = relationship(back_populates="saved_entry")


class HistorySettings(Base):
    __tablename__ = "history_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    retention_days: Mapped[int | None] = mapped_column(Integer, default=30)
    cleanup_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
