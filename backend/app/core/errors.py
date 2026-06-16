from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, message: str, code: str, status: int) -> None:
        self.message = message
        self.code = code
        self.status = status


def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={
            "message": exc.message,
            "code": exc.code,
            "status": exc.status,
        },
    )
