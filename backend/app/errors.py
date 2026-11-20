"""Contract error shape: { "detail": "message", "code": "SHORT_CODE" }.

Created by Role B because no role owns the app skeleton (deviation D2).
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_DEFAULT_CODES = {
    400: "BAD_REQUEST",
    401: "NOT_AUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_ERROR",
}


class AppError(Exception):
    """Raise anywhere: raise AppError(409, "ALREADY_RESERVED", "Listing already reserved")."""

    def __init__(self, status_code: int, code: str, detail: str):
        self.status_code = status_code
        self.code = code
        self.detail = detail
        super().__init__(detail)


def _body(detail: str, code: str) -> dict:
    return {"detail": detail, "code": code}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.detail, exc.code), status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code = _DEFAULT_CODES.get(exc.status_code, "ERROR")
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(_body(detail, code), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        parts = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"] if p != "body")
            msg = err.get("msg", "invalid")
            if msg.startswith("Value error, "):
                msg = msg[len("Value error, "):]
            parts.append(f"{loc}: {msg}" if loc else msg)
        return JSONResponse(
            _body("; ".join(parts) or "Invalid request", "VALIDATION_ERROR"),
            status_code=422,
        )
