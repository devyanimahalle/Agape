"""Tests for secure upload handling and validation."""
import io
from pathlib import Path

from fastapi import UploadFile
import pytest

from app.common.uploads import (
    DocumentNotFoundError,
    FileTooLargeError,
    InvalidDocumentKindError,
    InvalidFileTypeError,
    delete_document,
    resolve_path,
    save_upload,
)
from app.db.models import Document, User

# Valid sample content
PNG_HEADER = b"\x89PNG\r\n\x1a\n" + b"extra_bytes_here"
JPG_HEADER = b"\xff\xd8\xff" + b"extra_jpeg_bytes"
PDF_HEADER = b"%PDF-1.4\n" + b"dummy_pdf_content"


@pytest.fixture()
def owner_id(db):
    user = User(
        email="upload_tester@example.com",
        password_hash="fakehash",
        role="provider",
        name="Tester",
        phone="1234567890",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.id


def _make_upload(filename: str, content: bytes) -> UploadFile:
    return UploadFile(filename=filename, file=io.BytesIO(content))


def test_save_valid_proof_photo(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    upload = _make_upload("photo.png", PNG_HEADER)

    doc = save_upload(db, upload, owner_id, "proof_photo")
    db.commit()

    assert doc.id is not None
    assert doc.kind == "proof_photo"
    assert "proofs" in doc.private_path
    assert Path(doc.private_path).exists()
    assert Path(doc.private_path).read_bytes() == PNG_HEADER


def test_save_valid_identity_doc(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    upload = _make_upload("id.pdf", PDF_HEADER)

    doc = save_upload(db, upload, owner_id, "pan")
    db.commit()

    assert doc.id is not None
    assert doc.kind == "pan"
    assert "identity" in doc.private_path
    assert Path(doc.private_path).exists()


def test_invalid_document_kind(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    upload = _make_upload("photo.png", PNG_HEADER)

    with pytest.raises(InvalidDocumentKindError) as exc_info:
        save_upload(db, upload, owner_id, "unsupported_kind")
    assert exc_info.value.code == "INVALID_DOCUMENT_KIND"


def test_invalid_file_extension(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    upload = _make_upload("malicious.exe", b"MZexecutable")

    with pytest.raises(InvalidFileTypeError) as exc_info:
        save_upload(db, upload, owner_id, "business_proof")
    assert exc_info.value.code == "INVALID_FILE_TYPE"


def test_magic_mismatch(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    # PDF extension but PNG magic
    upload = _make_upload("trick.pdf", PNG_HEADER)

    with pytest.raises(InvalidFileTypeError) as exc_info:
        save_upload(db, upload, owner_id, "business_proof")
    assert exc_info.value.code == "INVALID_FILE_TYPE"


def test_empty_upload(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    upload = _make_upload("empty.png", b"")

    with pytest.raises(InvalidFileTypeError) as exc_info:
        save_upload(db, upload, owner_id, "proof_photo")
    assert exc_info.value.code == "INVALID_FILE_TYPE"


def test_oversized_upload(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "100")
    large_content = PNG_HEADER + (b"A" * 200)
    upload = _make_upload("big.png", large_content)

    with pytest.raises(FileTooLargeError) as exc_info:
        save_upload(db, upload, owner_id, "proof_photo")
    assert exc_info.value.code == "FILE_TOO_LARGE"


def test_random_filename_uniqueness(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    u1 = _make_upload("same_name.jpg", JPG_HEADER)
    u2 = _make_upload("same_name.jpg", JPG_HEADER)

    d1 = save_upload(db, u1, owner_id, "proof_photo")
    d2 = save_upload(db, u2, owner_id, "proof_photo")
    db.commit()

    assert d1.private_path != d2.private_path
    assert Path(d1.private_path).name != Path(d2.private_path).name


def test_resolve_path_and_traversal(db, owner_id, tmp_path, monkeypatch):
    upload_dir = tmp_path / "private"
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(upload_dir))
    upload = _make_upload("photo.png", PNG_HEADER)

    doc = save_upload(db, upload, owner_id, "proof_photo")
    db.commit()

    # Valid resolution
    resolved = resolve_path(doc)
    assert resolved == Path(doc.private_path).resolve()

    # Outside traversal attempt
    traversal_doc = Document(
        owner_id=owner_id,
        kind="proof_photo",
        private_path=str((tmp_path / "outside.txt").resolve()),
    )
    with pytest.raises(DocumentNotFoundError) as exc_info:
        resolve_path(traversal_doc)
    assert exc_info.value.code == "DOCUMENT_NOT_FOUND"


def test_delete_document_behavior(db, owner_id, tmp_path, monkeypatch):
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    upload = _make_upload("letter.pdf", PDF_HEADER)

    doc = save_upload(db, upload, owner_id, "proof_letter")
    db.commit()
    file_path = Path(doc.private_path)
    assert file_path.exists()

    # Delete
    delete_document(db, doc)
    db.commit()

    # File unlinked from disk
    assert not file_path.exists()
    # Row still exists in DB
    db.refresh(doc)
    assert doc.deleted_at is not None
    # Resolving path now raises 404
    with pytest.raises(DocumentNotFoundError) as exc_info:
        resolve_path(doc)
    assert exc_info.value.code == "DOCUMENT_NOT_FOUND"
