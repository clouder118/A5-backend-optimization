"""Pydantic schemas."""

from pydantic import BaseModel, ConfigDict, Field


class SpotListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    tags: list[str]
    summary: str
    visit_minutes: int
    image_url: str


class SpotListResponse(BaseModel):
    items: list[SpotListItem]
    total: int


class SpotSummaryResponse(BaseModel):
    listed_spot_count: int
    collected_spot_count: int


class SpotDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    summary: str
    story: str
    tags: list[str]
    visit_minutes: int
    crowd_types: list[str]
    image_url: str


class SpotUpsert(BaseModel):
    id: str
    name: str
    summary: str = ""
    story: str = ""
    tags: list[str] = []
    visit_minutes: int = 30
    crowd_types: list[str] = []
    image_url: str = ""
    sort_order: int = 0


class RouteRecommendRequest(BaseModel):
    visitor_type: str
    duration_minutes: int
    physical_level: str
    interest_tags: list[str] = []


class RecommendedRouteSpot(BaseModel):
    id: str
    name: str
    stay_minutes: int
    reason: str


class RecommendedRoute(BaseModel):
    id: str
    name: str
    theme: str
    total_minutes: int
    spots: list[RecommendedRouteSpot]
    recommendation_reason: str


class RouteRecommendResponse(BaseModel):
    items: list[RecommendedRoute]


class RouteSpotUpsert(BaseModel):
    spot_id: str
    sequence: int
    stay_minutes: int = 20
    reason: str = ""


class RouteUpsert(BaseModel):
    id: str
    name: str
    theme: str = ""
    duration_minutes: int = 120
    suitable_crowd: list[str] = []
    description: str = ""
    spots: list[RouteSpotUpsert] = []


class ChatRequest(BaseModel):
    question: str
    spot_id: str | None = None
    profile: dict = {}
    session_id: str | None = None


class KnowledgeSource(BaseModel):
    title: str
    spot_name: str | None = None
    section: str
    snippet: str
    score: float
    source_type: str = "document"
    source_url: str = ""
    source_level: str = ""


class ChatMetrics(BaseModel):
    retrieval_ms: float
    llm_ms: float
    tts_ms: float
    total_ms: float
    cache_hit: bool
    degraded: bool
    classification: dict = {}
    web_supplement_required: bool = False
    web_supplement_status: str = "not_required"


class ChatResponse(BaseModel):
    answer: str
    sources: list[KnowledgeSource]
    session_id: str
    audio_url: str | None
    tts_job_id: str | None = None
    tts_status: str
    mode: str
    degraded: bool
    metrics: ChatMetrics


class ChatLogDeleteRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)
    delete_all: bool = False


class TtsJobResponse(BaseModel):
    id: str
    status: str
    audio_url: str | None = None
