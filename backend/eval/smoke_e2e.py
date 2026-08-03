"""End-to-end smoke test for the WASTEX backend.

Runs against a live server (default http://localhost:8000).
Verifies health, scan, recommend, and skills endpoints.

Usage:
    uv run python eval/smoke_e2e.py                    # default localhost:8000
    uv run python eval/smoke_e2e.py --base-url http://staging:8000
"""

import argparse
import sys
import time

import httpx

# Minimal synthetic JPEG header (1x1 pixel).
TINY_JPEG = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
    b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
    b"\x1f\x1e\x1d\x1a\x1c\x1c $.\x27 ,#\x1c\x1c(7),01444\x1f\x2744444444444444"
    b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
    b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00"
    b"\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
    b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x7f\xa0"
    b"\xff\xd9"
)

SERVICE_KEY = "test-service-key"


def _check(label: str, ok: bool, detail: str = "") -> bool:
    icon = "PASS" if ok else "FAIL"
    suffix = f" ({detail})" if detail else ""
    print(f"  [{icon}] {label}{suffix}")
    return ok


def smoke_health(base: str, client: httpx.Client) -> bool:
    print("\n-- Health --")
    r = client.get(f"{base}/health")
    return _check("GET /health 200", r.status_code == 200 and r.json().get("status") == "ok")


def smoke_scan(base: str, client: httpx.Client) -> bool:
    print("\n-- Scan --")
    r = client.post(f"{base}/scan", files={"file": ("test.jpg", TINY_JPEG, "image/jpeg")})
    if r.status_code == 200:
        body = r.json()
        return _check(
            "POST /scan 200",
            body.get("status") in ("identified", "needs_manual_verification"),
            f"status={body.get('status')}",
        )
    if r.status_code == 503:
        return _check("POST /scan 503 (vision unavailable)", False, "vision providers down")
    return _check(f"POST /scan {r.status_code}", False, r.text[:200])


def smoke_recommend(base: str, client: httpx.Client) -> bool:
    print("\n-- Recommend --")
    r = client.post(
        f"{base}/recommend",
        json={"material": "plastik_pet", "user_intent": "buat pot tanaman"},
    )
    if r.status_code != 200:
        return _check(f"POST /recommend {r.status_code}", False, r.text[:200])
    body = r.json()
    ok = body.get("status") in ("grounded", "generic_safe_procedure")
    gate = body.get("gate_path", [])
    pkg = body.get("package", {})
    has_rec = bool(pkg.get("recommendation"))
    return (
        _check("status valid", ok, f"status={body.get('status')}")
        and _check("gate_path populated", len(gate) > 0, str(gate))
        and _check("recommendation non-empty", has_rec)
    )


def smoke_recommend_fallback(base: str, client: httpx.Client) -> bool:
    print("\n-- Recommend (gap fallback) --")
    r = client.post(
        f"{base}/recommend",
        json={"material": "sachet", "user_intent": "kerajinan 3D打印"},
    )
    if r.status_code != 200:
        return _check(f"POST /recommend (gap) {r.status_code}", False, r.text[:200])
    body = r.json()
    is_gap = body.get("status") == "generic_safe_procedure"
    has_fallback = "fallback" in body.get("gate_path", [])
    return _check("gap_detected + fallback", is_gap and has_fallback)


def smoke_skills_list(base: str, client: httpx.Client) -> bool:
    print("\n-- Skills List --")
    r = client.get(f"{base}/skills")
    if r.status_code != 200:
        return _check(f"GET /skills {r.status_code}", False, r.text[:200])
    return _check("GET /skills 200", isinstance(r.json(), list))


def smoke_skills_status_requires_auth(base: str, client: httpx.Client) -> bool:
    print("\n-- Skills Status (no auth) --")
    fake_id = "00000000-0000-0000-0000-000000000000"
    r = client.patch(f"{base}/skills/{fake_id}/status", json={"status": "approved"})
    return _check("PATCH /skills without auth -> 403", r.status_code == 403)


def smoke_skills_create_requires_auth(base: str, client: httpx.Client) -> bool:
    print("\n-- Skills Create (no auth) --")
    r = client.post(f"{base}/skills", json={"title": "x"})
    ok = r.status_code == 401
    if not ok:
        return _check("POST /skills without auth -> 401", ok, r.text[:200])
    r = client.get(f"{base}/skills?mine=true")
    ok = r.status_code == 401
    if not ok:
        return _check("GET /skills?mine=true without auth -> 401", ok, r.text[:200])
    return _check("POST /skills + GET /skills?mine=true require auth (401)", True)


def smoke_ingest_requires_auth(base: str, client: httpx.Client) -> bool:
    print("\n-- Ingest (no auth) --")
    fake_id = "00000000-0000-0000-0000-000000000000"
    r = client.post(f"{base}/ingest/{fake_id}")
    return _check("POST /ingest without auth -> 403", r.status_code == 403)


def main() -> None:
    parser = argparse.ArgumentParser(description="WASTEX E2E smoke test")
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    print(f"smoke testing {base} ...")
    passed = True
    start = time.monotonic()

    with httpx.Client(timeout=30) as client:
        for test_fn in [
            smoke_health,
            smoke_scan,
            smoke_recommend,
            smoke_recommend_fallback,
            smoke_skills_list,
            smoke_skills_status_requires_auth,
            smoke_skills_create_requires_auth,
            smoke_ingest_requires_auth,
        ]:
            try:
                if not test_fn(base, client):
                    passed = False
            except Exception as e:
                _check(test_fn.__name__, False, str(e))
                passed = False

    elapsed = time.monotonic() - start
    print(f"\n{'ALL PASSED' if passed else 'SOME FAILED'} ({elapsed:.1f}s)")
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
