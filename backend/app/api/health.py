from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "a5-ai-guide-backend",
    }
