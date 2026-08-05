import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase, FakeTable

client = TestClient(app)
SERVICE_AUTH = {"Authorization": "Bearer test-service-key"}


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    fake.tables["profiles"] = FakeTable([{"auth_user_id": "expert1", "role": "expert"}])
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _auth(user="u1"):
    return {"Authorization": f"Bearer {create_test_token({'sub': user})}"}


async def _ok_url(url, client_factory=httpx.AsyncClient):
    return [{"section": "Botol PET", "text": "Cuci botol."}]


async def _bad_url(url, client_factory=httpx.AsyncClient):
    raise ValueError("timeout")


def test_create_url_requires_expert(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _ok_url)
    r = client.post(
        "/documents",
        json={
            "title": "A",
            "source_type": "url",
            "url": "https://x.com/a",
            "materials": ["plastik_pet"],
        },
        headers=_auth(),
    )
    assert r.status_code == 403


def test_create_url_service_role_ok(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _ok_url)
    r = client.post(
        "/documents",
        json={
            "title": "A",
            "source_type": "url",
            "url": "https://x.com/a",
            "materials": ["plastik_pet"],
        },
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 201
    assert r.json()["status"] == "pending"
    assert r.json()["created_by"] is None  # service key has no JWT sub


def test_create_url_expert_profile_ok(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _ok_url)
    r = client.post(
        "/documents",
        json={
            "title": "A",
            "source_type": "url",
            "url": "https://x.com/a",
            "materials": ["plastik_pet"],
        },
        headers=_auth("expert1"),
    )
    assert r.status_code == 201
    assert r.json()["created_by"] == "expert1"


def test_create_url_unreadable_returns_400(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_url", _bad_url)
    r = client.post(
        "/documents",
        json={
            "title": "A",
            "source_type": "url",
            "url": "https://x.com/a",
            "materials": ["plastik_pet"],
        },
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 400


def test_create_url_invalid_material_returns_422(fake_sb, monkeypatch):
    # Schema (list[Material], Task 2) rejects unknown materials with 422 before
    # the endpoint runs; the brief's 400 is unreachable with that contract.
    monkeypatch.setattr("app.api.documents.extract_url", _ok_url)
    r = client.post(
        "/documents",
        json={"title": "A", "source_type": "url", "url": "https://x.com/a", "materials": ["besi"]},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 422


def test_create_pdf_uploads_and_pends(fake_sb, monkeypatch):
    monkeypatch.setattr("app.api.documents.extract_pdf", lambda data: [{"page": 1, "text": "x"}])
    r = client.post(
        "/documents/pdf",
        files={"file": ("buku.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"title": "Buku", "materials": "plastik_pet,kardus"},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 201
    assert r.json()["source_type"] == "pdf"
    assert r.json()["status"] == "pending"
    assert r.json()["materials"] == ["plastik_pet", "kardus"]
    assert fake_sb.storage.from_("documents").uploads  # stored in bucket


def test_create_pdf_unreadable_returns_400(fake_sb, monkeypatch):
    def bad(data):
        raise ValueError("corrupt")

    monkeypatch.setattr("app.api.documents.extract_pdf", bad)
    r = client.post(
        "/documents/pdf",
        files={"file": ("buku.pdf", b"garbage", "application/pdf")},
        data={"title": "Buku", "materials": "plastik_pet"},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 400


def test_list_documents_filters_status(fake_sb):
    fake_sb.table("documents").insert(
        {
            "title": "A",
            "source_type": "url",
            "url": "https://x.com",
            "materials": [],
            "status": "pending",
            "created_by": "u1",
        }
    )
    fake_sb.table("documents").insert(
        {
            "title": "B",
            "source_type": "url",
            "url": "https://x.com",
            "materials": [],
            "status": "approved",
            "created_by": "u1",
        }
    )
    r = client.get("/documents?status=approved", headers=SERVICE_AUTH)
    assert r.status_code == 200
    assert [d["title"] for d in r.json()] == ["B"]


async def _ingest(sb, document_id):
    return 3


def test_patch_approve_triggers_ingest(fake_sb, monkeypatch):
    fake_sb.table("documents").insert(
        {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "title": "A",
            "source_type": "url",
            "url": "https://x.com",
            "materials": ["plastik_pet"],
            "status": "pending",
            "created_by": "u1",
        }
    )
    calls = []

    async def fake_ingest(sb, document_id):
        calls.append(str(document_id))
        return 3

    monkeypatch.setattr("app.api.documents.ingest_document", fake_ingest)
    r = client.patch(
        "/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/status",
        json={"status": "approved", "reviewed_by": "expert1"},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    # TestClient runs Starlette BackgroundTasks synchronously before returning.
    assert calls == ["3fa85f64-5717-4562-b3fc-2c963f66afa6"]


def test_patch_status_unknown_404(fake_sb):
    r = client.patch(
        "/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/status",
        json={"status": "rejected", "reviewed_by": "expert1"},
        headers=SERVICE_AUTH,
    )
    assert r.status_code == 404


def test_reingest_requires_approved(fake_sb, monkeypatch):
    fake_sb.table("documents").insert(
        {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "title": "A",
            "source_type": "url",
            "url": "https://x.com",
            "materials": [],
            "status": "pending",
            "created_by": "u1",
        }
    )
    monkeypatch.setattr("app.api.documents.ingest_document", _ingest)
    r = client.post(
        "/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/reingest", headers=SERVICE_AUTH
    )
    assert r.status_code == 400


def test_reingest_returns_count(fake_sb, monkeypatch):
    fake_sb.table("documents").insert(
        {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "title": "A",
            "source_type": "url",
            "url": "https://x.com",
            "materials": [],
            "status": "approved",
            "created_by": "u1",
            "indexed_at": None,
        }
    )
    monkeypatch.setattr("app.api.documents.ingest_document", _ingest)
    r = client.post(
        "/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/reingest", headers=SERVICE_AUTH
    )
    assert r.status_code == 200
    assert r.json() == {"ingested": 3}


def test_reingest_500_on_failure(fake_sb, monkeypatch):
    fake_sb.table("documents").insert(
        {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "title": "A",
            "source_type": "url",
            "url": "https://x.com",
            "materials": [],
            "status": "approved",
            "created_by": "u1",
        }
    )

    async def boom(sb, document_id):
        raise ValueError("extract failed")

    monkeypatch.setattr("app.api.documents.ingest_document", boom)
    r = client.post(
        "/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6/reingest", headers=SERVICE_AUTH
    )
    assert r.status_code == 500


def test_delete_removes_row_and_storage(fake_sb):
    fake_sb.table("documents").insert(
        {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "title": "A",
            "source_type": "pdf",
            "file_path": "documents/x.pdf",
            "materials": [],
            "status": "approved",
            "created_by": "u1",
        }
    )
    r = client.delete("/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6", headers=SERVICE_AUTH)
    assert r.status_code == 200
    assert fake_sb.storage.from_("documents").removed == ["documents/x.pdf"]
    assert fake_sb.table("documents").rows == []


def test_delete_unknown_404(fake_sb):
    r = client.delete("/documents/3fa85f64-5717-4562-b3fc-2c963f66afa6", headers=SERVICE_AUTH)
    assert r.status_code == 404
