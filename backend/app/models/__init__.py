"""SQLAlchemy models."""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utc_now() -> datetime:
    return datetime.now(UTC)


class ScenicSpot(Base):
    __tablename__ = "scenic_spot"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    story: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    visit_minutes: Mapped[int] = mapped_column(Integer, default=30)
    crowd_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    image_url: Mapped[str] = mapped_column(String(500), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    route_spots: Mapped[list["RouteSpot"]] = relationship(back_populates="spot")


class Route(Base):
    __tablename__ = "route"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    theme: Mapped[str] = mapped_column(String(80), default="")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=120)
    suitable_crowd: Mapped[list[str]] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")

    spots: Mapped[list["RouteSpot"]] = relationship(back_populates="route")


class RouteSpot(Base):
    __tablename__ = "route_spot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    route_id: Mapped[str] = mapped_column(ForeignKey("route.id"), nullable=False)
    spot_id: Mapped[str] = mapped_column(ForeignKey("scenic_spot.id"), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    stay_minutes: Mapped[int] = mapped_column(Integer, default=20)
    reason: Mapped[str] = mapped_column(Text, default="")

    route: Mapped[Route] = relationship(back_populates="spots")
    spot: Mapped[ScenicSpot] = relationship(back_populates="route_spots")


class KnowledgeDoc(Base):
    __tablename__ = "knowledge_doc"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    path: Mapped[str] = mapped_column(String(600), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    chunks: Mapped[list["KnowledgeChunk"]] = relationship(back_populates="doc")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunk"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(ForeignKey("knowledge_doc.id"), nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    spot_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vector_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    doc: Mapped[KnowledgeDoc] = relationship(back_populates="chunks")


class SpotFact(Base):
    __tablename__ = "spot_fact"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    spot_id: Mapped[str] = mapped_column(ForeignKey("scenic_spot.id"), nullable=False)
    fact_key: Mapped[str] = mapped_column(String(120), nullable=False)
    fact_label: Mapped[str] = mapped_column(String(120), nullable=False)
    fact_value: Mapped[str] = mapped_column(Text, nullable=False)
    fact_unit: Mapped[str] = mapped_column(String(40), default="")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    source_type: Mapped[str] = mapped_column(String(40), default="database")
    source_ref: Mapped[str] = mapped_column(String(120), default="")
    source_url: Mapped[str] = mapped_column(String(600), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class EntityAlias(Base):
    __tablename__ = "entity_alias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(120), nullable=False)
    alias: Mapped[str] = mapped_column(String(160), nullable=False)


class TagAlias(Base):
    __tablename__ = "tag_alias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tag: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="")
    alias: Mapped[str] = mapped_column(String(160), nullable=False)


class SourceRef(Base):
    __tablename__ = "source_ref"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    path: Mapped[str] = mapped_column(String(600), default="")


class ApprovedWebSource(Base):
    __tablename__ = "approved_web_source"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(240), nullable=False)
    title: Mapped[str] = mapped_column(String(240), default="")
    source_level: Mapped[str] = mapped_column(String(40), default="")
    allowed: Mapped[bool] = mapped_column(Boolean, default=True)


class ApprovedWebFact(Base):
    __tablename__ = "approved_web_fact"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(40), default="spot")
    entity_id: Mapped[str] = mapped_column(String(120), default="")
    fact_key: Mapped[str] = mapped_column(String(120), nullable=False)
    fact_label: Mapped[str] = mapped_column(String(120), default="")
    fact_value: Mapped[str] = mapped_column(Text, nullable=False)
    fact_unit: Mapped[str] = mapped_column(String(40), default="")
    source_url: Mapped[str] = mapped_column(String(600), nullable=False)
    source_level: Mapped[str] = mapped_column(String(40), default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class WebFactCandidate(Base):
    __tablename__ = "web_fact_candidate"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(40), default="spot")
    entity_id: Mapped[str] = mapped_column(String(120), default="")
    entity_name: Mapped[str] = mapped_column(String(160), default="")
    fact_key: Mapped[str] = mapped_column(String(120), default="")
    fact_value: Mapped[str] = mapped_column(Text, default="")
    source_url: Mapped[str] = mapped_column(String(600), default="")
    source_level: Mapped[str] = mapped_column(String(40), default="")
    question: Mapped[str] = mapped_column(Text, default="")
    answer_excerpt: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(40), default="pending_review")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class ChatSession(Base):
    __tablename__ = "chat_session"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    visitor_type: Mapped[str] = mapped_column(String(80), default="")
    preference: Mapped[str] = mapped_column(String(200), default="")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session")


class ChatMessage(Base):
    __tablename__ = "chat_message"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("chat_session.id"),
        nullable=False,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    sources_json: Mapped[list[dict]] = mapped_column(JSON, default=list)
    metrics_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    session: Mapped[ChatSession] = relationship(back_populates="messages")
