from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.errors import ApiError
from app.models import KnowledgeDoc, ScenicSpot
from app.schemas import SpotDetail, SpotListItem, SpotListResponse, SpotSummaryResponse

router = APIRouter(prefix="/api/spots", tags=["spots"])


@router.get("", response_model=SpotListResponse)
def list_spots(db: Session = Depends(get_db)) -> SpotListResponse:
    spots = db.scalars(
        select(ScenicSpot).order_by(ScenicSpot.sort_order, ScenicSpot.id)
    ).all()
    return SpotListResponse(
        items=[SpotListItem.model_validate(spot) for spot in spots],
        total=len(spots),
    )


@router.get("/summary", response_model=SpotSummaryResponse)
def get_spot_summary(db: Session = Depends(get_db)) -> SpotSummaryResponse:
    listed_spot_count = db.scalar(select(func.count(ScenicSpot.id))) or 0
    derived_spot_count = (
        db.scalar(
            select(func.count(KnowledgeDoc.id)).where(
                or_(KnowledgeDoc.title.like("LS-%"), KnowledgeDoc.title.like("NH-%"))
            )
        )
        or 0
    )
    return SpotSummaryResponse(
        listed_spot_count=listed_spot_count,
        collected_spot_count=derived_spot_count or listed_spot_count,
    )


@router.get("/{spot_id}", response_model=SpotDetail)
def get_spot_detail(
    spot_id: str,
    db: Session = Depends(get_db),
) -> SpotDetail:
    spot = db.get(ScenicSpot, spot_id)
    if spot is None:
        raise ApiError("景点不存在", "SPOT_NOT_FOUND", 404)
    return SpotDetail.model_validate(spot)
