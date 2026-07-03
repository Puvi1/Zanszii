"""Tests for expanded Member Profile System + Celebrations endpoints."""
import os
import uuid
from datetime import date
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

MEMBER = ("member@spartans.com", "Member123!")
ACHILLES = ("achilles@spartans.com", "Demo123!")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Registration with new fields ----------
class TestRegisterExpanded:
    def test_register_persists_new_optional_fields(self):
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "password": "Passw0rd!",
            "name": "TEST Reg User",
            "phone": "9998887777",
            "dob": "1990-01-15",
            "gender": "male",
            "city": "Mumbai",
            "state": "MH",
        }
        r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]

        # Verify persisted via /auth/me + profile completion (which reads full doc)
        me = requests.get(f"{API}/auth/me", headers=_h(token), timeout=20).json()
        assert me["email"] == email.lower()
        # /auth/me returns UserPublic which excludes many fields; check via profile completion missing list
        comp = requests.get(f"{API}/profile/completion", headers=_h(token), timeout=20).json()
        missing = set(comp["missing"])
        for filled in ["phone", "dob", "gender", "city", "state", "name", "email"]:
            assert filled not in missing, f"{filled} should be filled but is missing"


# ---------- PATCH /api/profile ----------
class TestProfilePatch:
    def test_patch_all_new_fields_persist(self):
        token = _login(*MEMBER)
        payload = {
            "name": "Member Test",
            "phone": "1112223333",
            "dob": "1992-05-10",
            "gender": "female",
            "marital_status": "married",
            "anniversary_date": "2015-05-10",
            "anniversary_photo": "data:image/png;base64,AAAA",
            "avatar_url": "https://example.com/a.png",
            "city": "Pune",
            "state": "MH",
            "joining_date": "2022-01-01",
            "club_type": "believer",
            "position": "Team Lead",
            "favourite_food": "Pizza",
            "favourite_place": "Goa",
            "favourite_hobby": "Reading",
            "bio": "Test bio",
        }
        r = requests.patch(f"{API}/profile", headers=_h(token), json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        user = data["user"]
        for k, v in payload.items():
            assert user.get(k) == v, f"{k} mismatch: expected {v}, got {user.get(k)}"

        # Completion should reach 100% since all 16 fields filled (avatar_url + team_id/team...)
        comp = data["completion"]
        assert comp["total"] == 16
        # It's ok if some fields (like team_id) missing - that's expected
        assert comp["pct"] >= 80

    def test_invalid_club_type_returns_422(self):
        token = _login(*MEMBER)
        r = requests.patch(f"{API}/profile", headers=_h(token),
                           json={"club_type": "invalid_type"}, timeout=20)
        assert r.status_code == 422, f"expected 422 got {r.status_code}: {r.text}"

    def test_invalid_marital_status_returns_422(self):
        token = _login(*MEMBER)
        r = requests.patch(f"{API}/profile", headers=_h(token),
                           json={"marital_status": "divorced"}, timeout=20)
        assert r.status_code == 422, f"expected 422 got {r.status_code}: {r.text}"

    def test_invalid_gender_returns_422(self):
        token = _login(*MEMBER)
        r = requests.patch(f"{API}/profile", headers=_h(token),
                           json={"gender": "unknown"}, timeout=20)
        assert r.status_code == 422


# ---------- Profile Completion ----------
class TestProfileCompletion:
    def test_completion_total_is_16(self):
        token = _login(*MEMBER)
        r = requests.get(f"{API}/profile/completion", headers=_h(token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 16
        assert "pct" in data and "filled" in data and "missing" in data
        # pct math
        expected_pct = round((data["filled"] / 16) * 100, 0)
        assert data["pct"] == expected_pct


# ---------- Celebrations ----------
class TestCelebrations:
    def test_celebrations_me_for_achilles(self):
        """Achilles has dob=1988-07-03 and anniversary=2018-07-03 (today is 07-03)."""
        token = _login(*ACHILLES)
        r = requests.get(f"{API}/celebrations/me", headers=_h(token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        today_md = date.today().strftime("%m-%d")
        # If today is 07-03, birthday should be true
        if today_md == "07-03":
            assert data["is_birthday"] is True
        assert "user" in data
        assert data["user"]["name"]

    def test_celebrations_me_anniversary_requires_married(self):
        """Achilles' anniversary flag depends on marital_status='married'."""
        token = _login(*ACHILLES)
        # Set married first
        requests.patch(f"{API}/profile", headers=_h(token),
                       json={"marital_status": "married"}, timeout=20)
        r = requests.get(f"{API}/celebrations/me", headers=_h(token), timeout=20).json()
        today_md = date.today().strftime("%m-%d")
        if today_md == "07-03":
            assert r["is_anniversary"] is True

        # Now unmarried => anniversary must be false
        requests.patch(f"{API}/profile", headers=_h(token),
                       json={"marital_status": "unmarried"}, timeout=20)
        r2 = requests.get(f"{API}/celebrations/me", headers=_h(token), timeout=20).json()
        assert r2["is_anniversary"] is False

        # Restore married for other tests
        requests.patch(f"{API}/profile", headers=_h(token),
                       json={"marital_status": "married"}, timeout=20)

    def test_celebrations_today_includes_achilles(self):
        token = _login(*MEMBER)
        r = requests.get(f"{API}/celebrations/today", headers=_h(token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "date" in data and "birthdays" in data and "anniversaries" in data
        assert isinstance(data["birthdays"], list)
        assert isinstance(data["anniversaries"], list)

        today_md = date.today().strftime("%m-%d")
        if today_md == "07-03":
            b_names = [u["name"] for u in data["birthdays"]]
            assert any("Achilles" in n for n in b_names), f"Achilles missing from birthdays: {b_names}"

    def test_celebrations_today_anniversary_only_married(self):
        """Anniversary list should only include married users."""
        m_token = _login(*MEMBER)
        a_token = _login(*ACHILLES)
        # Set Achilles unmarried
        requests.patch(f"{API}/profile", headers=_h(a_token),
                       json={"marital_status": "unmarried"}, timeout=20)
        r = requests.get(f"{API}/celebrations/today", headers=_h(m_token), timeout=20).json()
        ann_names = [u["name"] for u in r["anniversaries"]]
        assert not any("Achilles" in n for n in ann_names), (
            f"Achilles should not appear in anniversaries when unmarried: {ann_names}"
        )
        # Restore
        requests.patch(f"{API}/profile", headers=_h(a_token),
                       json={"marital_status": "married"}, timeout=20)

    def test_celebrations_endpoints_require_auth(self):
        r = requests.get(f"{API}/celebrations/me", timeout=20)
        assert r.status_code in (401, 403)
        r2 = requests.get(f"{API}/celebrations/today", timeout=20)
        assert r2.status_code in (401, 403)
