from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Route, RouteSpot
from app.schemas import (
    RecommendedRoute,
    RecommendedRouteSpot,
    RouteRecommendRequest,
)


def recommend_routes(
    db: Session,
    request: RouteRecommendRequest,
) -> list[RecommendedRoute]:
    routes = db.scalars(
        select(Route).options(
            selectinload(Route.spots)
            .selectinload(RouteSpot.spot)
        )
    ).all()

    ranked_routes = sorted(
        routes,
        key=lambda route: _route_score(route, request),
        reverse=True,
    )

    return [
        _to_recommended_route(route, request)
        for route in ranked_routes[:3]
        if _route_score(route, request) > -1000
    ]


def _route_score(route: Route, request: RouteRecommendRequest) -> int:
    score = 0
    if request.visitor_type in route.suitable_crowd:
        score += 10
    if request.visitor_type in route.theme:
        score += 1

    route_tags = {
        tag
        for route_spot in route.spots
        for tag in (route_spot.spot.tags if route_spot.spot else [])
    }
    score += 2 * len(route_tags.intersection(request.interest_tags))

    if route.duration_minutes <= int(request.duration_minutes * 1.1):
        score += 3
        score += max(0, 10 - abs(route.duration_minutes - request.duration_minutes) // 10)
    else:
        score -= 20
    return score


def _to_recommended_route(
    route: Route,
    request: RouteRecommendRequest,
) -> RecommendedRoute:
    ordered_route_spots = sorted(route.spots, key=lambda route_spot: route_spot.sequence)
    spots = [
        RecommendedRouteSpot(
            id=route_spot.spot.id,
            name=route_spot.spot.name,
            stay_minutes=route_spot.stay_minutes,
            reason=route_spot.reason,
        )
        for route_spot in ordered_route_spots
        if route_spot.spot is not None
    ]
    reason = (
        f"这条路线匹配{request.visitor_type}，预计{route.duration_minutes}分钟，"
        f"重点覆盖{route.theme}相关景点。"
    )
    return RecommendedRoute(
        id=route.id,
        name=route.name,
        theme=route.theme,
        total_minutes=route.duration_minutes,
        spots=spots,
        recommendation_reason=reason,
    )
