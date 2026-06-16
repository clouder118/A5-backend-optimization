from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas import RouteRecommendRequest, RouteRecommendResponse
from app.services.routes import recommend_routes

router = APIRouter(prefix="/api/routes", tags=["routes"])


@router.post("/recommend", response_model=RouteRecommendResponse)
def recommend_route(
    request: RouteRecommendRequest,
    db: Session = Depends(get_db),
) -> RouteRecommendResponse:
    return RouteRecommendResponse(items=recommend_routes(db, request))
