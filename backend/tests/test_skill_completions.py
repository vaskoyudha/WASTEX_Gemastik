import pytest
from fastapi.testclient import TestClient

from app.auth import create_test_token
from app.deps import get_supabase
from app.main import app
from tests.fakes import FakeSupabase

SKILL = {
    "id": "77777777-aaaa-4aaa-8aaa-777777777777",
    "title": "Pot",
    "material": "plastik_pet",
    "status": "approved",
}
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
    client,
    skill_id="77777777-aaaa-4aaa-8aaa-777777777777",
    rating="5",
    comment="bagus",
    user="u1",
    ctype="image/jpeg",
    body=JPEG,
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
        "/skills/77777777-aaaa-4aaa-8aaa-777777777777/complete",
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
    assert body["skill_id"] == "77777777-aaaa-4aaa-8aaa-777777777777"
    assert body["photo_path"].endswith(".jpeg")
    row = fake_sb.table("skill_completions").inserted[0]
    assert row["user_id"] == "u1"
    assert len(fake_sb.storage.from_("completions").uploads) == 1


def test_complete_duplicate_409(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    fake_sb.table("skill_completions").insert(
        {
            "user_id": "u1",
            "skill_id": "77777777-aaaa-4aaa-8aaa-777777777777",
            "photo_path": "a.jpeg",
            "rating": 4,
        }
    )
    r = _post(TestClient(app))
    assert r.status_code == 409


def test_complete_insert_race_maps_to_409(fake_sb, monkeypatch):
    # Race backstop: two concurrent requests both pass the Python pre-check; the losing
    # insert violates unique(skill_id, user_id). The endpoint must map that to 409, not 500.
    fake_sb.table("skills").insert(SKILL)

    def _dup_insert(_data):
        raise RuntimeError(
            'duplicate key value violates unique constraint "skill_completions_skill_id_user_id_key"'
        )

    monkeypatch.setattr(fake_sb.table("skill_completions"), "insert", _dup_insert)
    r = _post(TestClient(app, raise_server_exceptions=False))
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


def test_get_completions_summary_and_gallery(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    fake_sb.table("skill_completions").insert(
        [
            {
                "user_id": "u1",
                "skill_id": "77777777-aaaa-4aaa-8aaa-777777777777",
                "photo_path": "a.jpeg",
                "rating": 5,
                "comment": "mantap",
                "created_at": "2026-01-02T00:00:00Z",
            },
            {
                "user_id": "u2",
                "skill_id": "77777777-aaaa-4aaa-8aaa-777777777777",
                "photo_path": "b.jpeg",
                "rating": 3,
                "comment": None,
                "created_at": "2026-01-01T00:00:00Z",
            },
        ]
    )
    fake_sb.table("profiles").insert([{"auth_user_id": "u1", "display_name": "Budi"}])
    r = TestClient(app).get("/skills/77777777-aaaa-4aaa-8aaa-777777777777/completions")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    assert body["avg_rating"] == 4.0
    assert body["gallery"][0]["photo_url"].endswith("completions/a.jpeg")
    assert body["gallery"][0]["user_display_name"] == "Budi"
    assert body["gallery"][0]["rating"] == 5


def test_get_completions_empty(fake_sb):
    fake_sb.table("skills").insert(SKILL)
    r = TestClient(app).get("/skills/77777777-aaaa-4aaa-8aaa-777777777777/completions")
    assert r.status_code == 200
    assert r.json()["count"] == 0
    assert r.json()["gallery"] == []


def test_get_completions_skill_not_found(fake_sb):
    r = TestClient(app).get("/skills/nope/completions")
    assert r.status_code == 404
