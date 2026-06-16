from collections.abc import Iterator

from fastapi import Header, Request
from sqlalchemy.orm import Session

from app.core.errors import ApiError


def get_db(request: Request) -> Iterator[Session]:
    session_factory = request.app.state.SessionLocal
    with session_factory() as session:
        yield session


def require_admin(
    request: Request,
    x_admin_token: str | None = Header(default=None),
) -> None:
    settings = request.app.state.settings
    if str(settings.enable_admin_token).lower() != "true":
        return
    if x_admin_token and x_admin_token == settings.admin_token:
        return
    raise ApiError("管理员令牌无效", "ADMIN_TOKEN_INVALID", 401)
