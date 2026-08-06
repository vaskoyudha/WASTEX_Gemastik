import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

SKILL = {"id": "s1", "title": "Pot", "material": "plastik_pet", "status": "approved"}
JPEG = b"\xff\xd8\xff fakejpegdata"


@pytest.fixture()
def fake_sb():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _auth(user="u1"):
    return {"Authorization": f"Bearer {create_test_token({'sub': user})}"}


def _post(
    client, skill_id="s1", rating="5", comment="bagus", user="u1", ctype="image/jpeg", body=JPEG
):
    return client.post(
        f"/skills/{skill_id}/complete",
        files={"file": ("x.jpg", body, ctype)},
        data={"rating": rating, "comment": comment},
        headers=_auth(user),
    )


def test_complete_requires_auth(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = TestClient(app).post(
        "/skills/s1/complete",
        files={"file": ("x.jpg", JPEG, "image/jpeg")},
        data={"rating": "5"},
    )
    assert r.status_code == 401


def test_complete_creates_row_and_uploads(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = _post(TestClient(app))
    assert r.status_code == 201
    body = r.json()
    assert body["rating"] == 5
    assert body["skill_id"] == "s1"
    assert body["photo_path"].endswith(".jpeg")
    row = fake_sb.table("skill_completions").inserted[0]
    assert row["user_id"] == "u1"
    assert len(fake_sb.storage.from_("completions").uploads) == 1


def test_complete_duplicate_409(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    fake_sb.table("skill_completions").insert(
        {"user_id": "u1", "skill_id": "s1", "photo_path": "a.jpeg", "rating": 4}
    )
    r = _post(TestClient(app))
    assert r.status_code == 409


def test_complete_skill_not_found_404(fake_sb):
    r = _post(TestClient(app), skill_id="nope")
    assert r.status_code == 404


def test_complete_bad_rating_422(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = _post(TestClient(app), rating="9")
    assert r.status_code == 422


def test_complete_bad_type_415(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = _post(TestClient(app), ctype="text/plain")
    assert r.status_code == 415
