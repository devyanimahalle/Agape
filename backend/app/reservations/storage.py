"""Proof file storage: the single swap point for Role C's upload service.

Until Role C's service is merged this implements the contract's rule 8 itself:
PDF/JPG/PNG only (checked by content, not just extension), size cap, random filenames,
stored under PRIVATE_UPLOAD_DIR (or /tmp/agape/private on ephemeral hosts). To use Role C's
service, replace the body of `save_proof_file` / `delete_file`; nothing else in this
module's callers changes.
"""
import os
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.db.models import Document
from app.reservations.errors import ApiError

MAX_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))
_SIGNATURES = {
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "pdf": (b"%PDF-",),
}


def _upload_dir() -> Path:
    path = Path(os.environ.get("PRIVATE_UPLOAD_DIR", "/tmp/agape/private")) / "proofs"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _detect(head: bytes) -> str | None:
    for ext, sigs in _SIGNATURES.items():
        if any(head.startswith(s) for s in sigs):
            return ext
    return None


def save_proof_file(db: Session, owner_id: int, upload: UploadFile) -> Document:
    data = upload.file.read(MAX_BYTES + 1)
    if not data:
        raise ApiError(400, "INVALID_FILE", f"{upload.filename or 'file'} is empty")
    if len(data) > MAX_BYTES:
        raise ApiError(400, "FILE_TOO_LARGE", f"Files must be at most {MAX_BYTES // (1024 * 1024)} MB")
    ext = _detect(data[:8])
    if ext is None:
        raise ApiError(400, "INVALID_FILE_TYPE", "Only PDF, JPG or PNG files are allowed")
    path = _upload_dir() / f"{uuid.uuid4().hex}.{ext}"
    path.write_bytes(data)
    doc = Document(
        owner_id=owner_id,
        kind="proof_letter" if ext == "pdf" else "proof_photo",
        private_path=str(path),
    )
    db.add(doc)
    db.flush()
    return doc


def delete_file(path: str) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:  # pragma: no cover - best-effort cleanup
        pass
