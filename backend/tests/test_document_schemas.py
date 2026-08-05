import pytest
from pydantic import ValidationError

from app.schemas import DocumentCreateRequest, DocumentSourceType, Material


def test_document_create_url_accepts_valid_materials():
    doc = DocumentCreateRequest(
        title="Buku Sampah",
        source_type=DocumentSourceType.url,
        url="https://example.com/artikel",
        materials=[Material.plastik_pet, Material.kardus],
    )
    assert doc.materials == [Material.plastik_pet, Material.kardus]
    assert doc.url == "https://example.com/artikel"


def test_document_create_rejects_unknown_material():
    with pytest.raises(ValidationError):
        DocumentCreateRequest(title="X", source_type=DocumentSourceType.pdf, materials=["besi"])


def test_document_status_update_restricts_values():
    from app.schemas import DocumentStatusUpdate

    ok = DocumentStatusUpdate(status="approved", reviewed_by="expert1")
    assert ok.status == "approved"
    with pytest.raises(ValidationError):
        DocumentStatusUpdate(status="pending", reviewed_by="expert1")
