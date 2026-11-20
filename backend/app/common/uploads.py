"""Secure upload handling for private documents and pickup proofs.

Implements contract Business Rule 8:
- Allowed file types: PDF, JPG, PNG (verified by content magic bytes and extension).
- Size capped by MAX_UPLOAD_BYTES (evaluated at runtime).
- Stored under PRIVATE_UPLOAD_DIR in segregated subdirectories with random UUID filenames.
- Traversal-safe path resolution.
- Soft-delete tracking with physical file unlinking.
"""
from datetime import datetime, timezone
import os
from pathlib import Path
import uuid

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.db.models import Document
from app.errors import AppError

# Contract allowed document kinds
VALID_DOCUMENT_KINDS = {
    "business_proof",
    "pan",
    "aadhaar",
    "passport",
    "fssai_cert",
    "ngo_reg",
    "proof_photo",
    "proof_letter",
}

_PROOF_KINDS = {"proof_photo", "proof_letter"}

_MAGIC_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "pdf": (b"%PDF-",),
}

_ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".jpg": "jpg",
    ".jpeg": "jpg",
    ".png": "png",
}


class UploadError(AppError):
    """Base class for upload errors."""


class InvalidFileTypeError(UploadError):
    def __init__(self, detail: str = "Only PDF, JPG, and PNG files are allowed"):
        super().__init__(400, "INVALID_FILE_TYPE", detail)


class FileTooLargeError(UploadError):
    def __init__(self, detail: str = "File exceeds maximum upload size"):
        super().__init__(400, "FILE_TOO_LARGE", detail)


class InvalidDocumentKindError(UploadError):
    def __init__(self, detail: str = "Invalid document kind"):
        super().__init__(400, "INVALID_DOCUMENT_KIND", detail)


class DocumentNotFoundError(UploadError):
    def __init__(self, detail: str = "Document not found"):
        super().__init__(404, "DOCUMENT_NOT_FOUND", detail)


def get_private_upload_dir() -> Path:
    """Read PRIVATE_UPLOAD_DIR at call time to support runtime test overrides."""
    return Path(os.environ.get("PRIVATE_UPLOAD_DIR", "/data/private"))


def get_max_upload_bytes() -> int:
    """Read MAX_UPLOAD_BYTES at call time to support runtime test overrides."""
    return int(os.environ.get("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))


def _detect_magic(data: bytes) -> str | None:
    for ext_type, sigs in _MAGIC_SIGNATURES.items():
        if any(data.startswith(sig) for sig in sigs):
            return ext_type
    return None


def save_upload(
    db: Session,
    upload_file: UploadFile,
    owner_id: int,
    kind: str,
) -> Document:
    """Validate, store an uploaded file to disk, and record a Document in the database.

    TRANSACTION NOTE:
    This function flushes (`db.flush()`) the created Document row so that `doc.id`
    is assigned. It NEVER commits the transaction (`db.commit()`). The calling
    service owns transaction commit/rollback. If an error occurs in downstream
    logic, the caller can rollback the DB transaction and remove the file.
    """
    if kind not in VALID_DOCUMENT_KINDS:
        raise InvalidDocumentKindError(f"Invalid document kind: {kind}")

    filename = upload_file.filename or ""
    suffix = Path(filename).suffix.lower()
    expected_ext = _ALLOWED_EXTENSIONS.get(suffix)
    if expected_ext is None:
        raise InvalidFileTypeError("File extension must be .pdf, .jpg, .jpeg, or .png")

    max_bytes = get_max_upload_bytes()

    # Stream read up to max_bytes + 1 to detect oversize while minimizing memory
    read_limit = max_bytes + 1
    content = upload_file.file.read(read_limit)

    if not content:
        raise InvalidFileTypeError("Upload file is empty")
    if len(content) > max_bytes:
        limit_mb = max_bytes // (1024 * 1024)
        raise FileTooLargeError(f"Files must be at most {limit_mb} MB")

    detected_type = _detect_magic(content[:8])
    if detected_type is None or detected_type != expected_ext:
        raise InvalidFileTypeError("File content does not match allowed format (PDF, JPG, PNG)")

    # Segregate subdirectories: proofs vs identity verification
    subfolder = "proofs" if kind in _PROOF_KINDS else "identity"
    target_dir = get_private_upload_dir() / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid.uuid4().hex}.{detected_type}"
    target_path = target_dir / stored_filename
    target_path.write_bytes(content)

    doc = Document(
        owner_id=owner_id,
        kind=kind,
        private_path=str(target_path.resolve()),
    )
    db.add(doc)
    db.flush()
    return doc


def resolve_path(doc: Document) -> Path:
    """Resolve a Document to a traversal-safe on-disk Path.

    Raises DocumentNotFoundError if the document has been soft-deleted
    or the file does not exist on disk.
    """
    if doc.deleted_at is not None:
        raise DocumentNotFoundError("Document has been deleted")

    target_path = Path(doc.private_path).resolve()
    base_dir = get_private_upload_dir().resolve()

    try:
        target_path.relative_to(base_dir)
    except ValueError:
        raise DocumentNotFoundError("Document path is outside upload directory")

    if not target_path.exists() or not target_path.is_file():
        raise DocumentNotFoundError("Document file not found on disk")

    return target_path


def delete_document(db: Session, doc: Document) -> None:
    """Soft-delete a document record and securely unlink its file from disk.

    TRANSACTION NOTE:
    This function flushes (`db.flush()`) the `deleted_at` timestamp update.
    The caller owns the transaction commit.
    """
    try:
        Path(doc.private_path).unlink(missing_ok=True)
    except OSError:
        pass

    doc.deleted_at = datetime.now(timezone.utc)
    db.flush()
