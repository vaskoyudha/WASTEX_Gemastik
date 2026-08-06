"""End-to-end test of the full AI skill flow against a live backend.

Covers: scan -> recommend (RAG) -> proposals -> verify -> create -> approve
-> retrievable. Requires a live backend + real Supabase keys in backend/.env
(SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET).

Usage:
    uv run python eval/e2e_skill_flow.py [--base-url http://localhost:8000]
"""

import argparse
import sys
from pathlib import Path
from uuid import uuid4

import httpx
import jwt

from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env"
sys.path.insert(0, str(ROOT))  # make `app.*` importable (script runs from eval/)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from smoke_e2e import TINY_JPEG


def _env(key: str) -> str:
    for line in ENV.read_text().splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"{key} missing from backend/.env")


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" ({detail})" if detail else ""))
    return ok


def main(base: str) -> int:
    ok = True
    sb = create_client(_env("SUPABASE_URL"), _env("SUPABASE_SERVICE_KEY"))

    # Create a real E2E user (skills.created_by references auth.users(id)).
    user_id = str(uuid4())
    email = f"e2e-{user_id[:8]}@wastex.test"
    sb.auth.admin.create_user({"id": user_id, "email": email, "password": "e2e-password-123"})
    token = jwt.encode({"sub": user_id}, _env("SUPABASE_JWT_SECRET"), algorithm="HS256")
    AUTH = {"Authorization": f"Bearer {token}"}
    SERVICE_AUTH = {"Authorization": f"Bearer {_env('SUPABASE_SERVICE_KEY')}"}  # noqa: F841 (kept for parity with brief)

    try:
        with httpx.Client(timeout=120) as client:
            # 1. scan
            r = client.post(f"{base}/scan", files={"file": ("t.jpg", TINY_JPEG, "image/jpeg")})
            ok &= _check("scan 200", r.status_code == 200, f"status={r.status_code}")
            material = (r.json().get("identification") or {}).get("material") or "plastik_pet"

            # 2. recommend (RAG path) — assert grounded per spec
            r = client.post(
                f"{base}/recommend",
                json={"material": material, "user_intent": "buat vas dari botol kaca"},
            )
            ok &= _check(
                "recommend grounded",
                r.status_code == 200 and r.json().get("status") == "grounded",
                f"status={r.json().get('status') if r.status_code == 200 else r.status_code}",
            )

            # 3. proposals (auth required)
            r = client.post(
                f"{base}/skills/proposals",
                json={"material": material, "condition": "bersih"},
                headers=AUTH,
            )
            ok &= _check("proposals 200", r.status_code == 200, f"status={r.status_code}")
            proposals = r.json() if r.status_code == 200 else []
            ok &= _check("proposals returned", len(proposals) >= 1, f"count={len(proposals)}")

            # 4. verify
            draft = (
                proposals[0]
                if proposals
                else {
                    "title": "Pot dari Botol",
                    "description": "Pot tanaman sederhana dari botol plastik bekas.",
                    "material": material,
                    "difficulty": "pemula",
                    "steps": [
                        {"order": 1, "instruction": "Cuci botol", "warning": "Sarung tangan"}
                    ],
                    "tools": [{"name": "gunting"}],
                    "est_cost_idr": 5000,
                    "est_price_idr": 25000,
                }
            )
            r = client.post(
                f"{base}/skills/verify", json={"draft": draft, "chat_history": []}, headers=AUTH
            )
            ok &= _check(
                "verify 200",
                r.status_code == 200,
                f"verdict={r.json().get('verdict') if r.status_code == 200 else '?'}",
            )

            # 5. create (title prefixed [E2E] for cleanup)
            draft["title"] = f"[E2E] {draft['title']}"
            r = client.post(f"{base}/skills", json=draft, headers=AUTH)
            ok &= _check("create 201", r.status_code == 201, f"status={r.status_code}")
            skill_id = r.json().get("id") if r.status_code == 201 else None

            # 6. approve via DIRECT DB update + awaited ingest_skill — NOT the
            #    PATCH API (which would fire paid generate_all_visuals and race
            #    the chunks check via background tasks).
            if skill_id:
                sb.table("skills").update({"status": "approved", "reviewed_by": "e2e"}).eq(
                    "id", skill_id
                ).execute()
                chunks = await_ingest(sb, skill_id)
                ok &= _check("ingest ran", chunks > 0, f"chunks={chunks}")

                # 7. retrievable: chunks exist (deterministic) + /recommend re-run
                rows = sb.table("skill_chunks").select("id").eq("skill_id", skill_id).execute().data
                ok &= _check("skill retrievable (chunks > 0)", len(rows) > 0, f"chunks={len(rows)}")
                r = client.post(
                    f"{base}/recommend", json={"material": material, "user_intent": draft["title"]}
                )
                ok &= _check(
                    "recommend after create",
                    r.status_code == 200,
                    f"status={r.json().get('status') if r.status_code == 200 else r.status_code}",
                )

                # cleanup: skill (cascade chunks) + E2E user
                sb.table("skills").delete().eq("id", skill_id).execute()
                print("  [INFO] cleaned up [E2E] skill")
    finally:
        try:
            sb.auth.admin.delete_user(user_id)
            print("  [INFO] cleaned up E2E user")
        except Exception:  # noqa: S110 — cleanup is best-effort; user may already be gone
            pass

    print("\n" + ("ALL GREEN" if ok else "FAILURES PRESENT"))
    return 0 if ok else 1


def await_ingest(sb, skill_id: str) -> int:
    import asyncio

    from app.rag.ingest import ingest_skill

    return asyncio.new_event_loop().run_until_complete(ingest_skill(sb, skill_id))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()
    sys.exit(main(args.base_url))
