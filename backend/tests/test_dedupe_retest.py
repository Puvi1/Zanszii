"""Focused retest for POST /api/admin/dedupe-data routing fix (iteration_16)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://growth-gamified-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@spartans.com"
ADMIN_PASSWORD = "Sp4rt@n-Cmd-2026!F0rge"
OLD_PASSWORD = "Spartan123!"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    return s, r


@pytest.fixture(scope="module")
def admin_session():
    s, r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def member_session():
    """Create/login a regular member for 403 test."""
    email = "TEST_dedupe_member@example.com"
    password = "MemberPass123!"
    # try signup
    requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "name": "Test Member", "nexus_id": "TEST_MEM_DEDUPE"
    }, timeout=30)
    s, r = _login(email, password)
    if r.status_code != 200:
        pytest.skip(f"Could not create/login member user: {r.status_code} {r.text}")
    return s


# ------------ Dedupe endpoint tests ------------

def test_dedupe_no_auth_returns_401():
    r = requests.post(f"{API}/admin/dedupe-data", timeout=30)
    assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"


def test_dedupe_as_member_returns_403(member_session):
    r = member_session.post(f"{API}/admin/dedupe-data", timeout=30)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


def test_dedupe_as_admin_returns_200_with_breakdown(admin_session):
    r = admin_session.post(f"{API}/admin/dedupe-data", timeout=60)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("ok") is True, f"ok field missing/false: {body}"
    assert "duplicates_removed" in body and isinstance(body["duplicates_removed"], int)
    assert "breakdown" in body and isinstance(body["breakdown"], dict)


# ------------ Smoke tests on other routes ------------

@pytest.mark.parametrize("path", [
    "/",
    "/admin/analytics",
    "/spartans-league/individual",
    "/reports/global",
    "/notifications",
])
def test_route_smoke_admin(admin_session, path):
    r = admin_session.get(f"{API}{path}", timeout=30)
    assert r.status_code == 200, f"GET {path} returned {r.status_code}: {r.text[:300]}"


def test_exports_missions_xlsx(admin_session):
    r = admin_session.get(f"{API}/exports/missions", params={"format": "xlsx"}, timeout=60)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
    ctype = r.headers.get("content-type", "")
    assert "spreadsheet" in ctype or "xlsx" in ctype or "openxmlformats" in ctype, f"Unexpected content-type: {ctype}"


# ------------ Password policy tests ------------

def test_old_password_fails():
    _, r = _login(ADMIN_EMAIL, OLD_PASSWORD)
    assert r.status_code == 401, f"Old password should fail, got {r.status_code}: {r.text}"


def test_new_password_succeeds():
    _, r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"New password should succeed, got {r.status_code}: {r.text}"
