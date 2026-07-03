"""Backend tests for Daily Missions (GPS + Photo).

Covers:
- Auth requirement
- Create/List/Update/Delete missions
- XP awards (mission_logged=+10, mission_converted=+40, PATCH delta=+30)
- google_maps_url auto-generated from lat/lng
- Photo upload success + 1.5MB limit (413)
- Data isolation between users
- Auto-increment 'prospects' challenge progress
- Indexes on missions collection
"""
import os
import uuid
import base64
import pytest
import requests
from datetime import date, timedelta


def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    v = line.split("=", 1)[1].strip()
                    break
    assert v, "REACT_APP_BACKEND_URL not set"
    return v.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@spartans.com", "password": "Spartan123!"}
LEADER = {"email": "leader@spartans.com", "password": "Leader123!"}
MEMBER = {"email": "member@spartans.com", "password": "Member123!"}

SMALL_JPEG_B64 = (
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAoHBwgHBgoICAgLCgoLDhg"
    "QDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDh"
    "wQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wA"
    "ARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA"
    "/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8H/9k="
)


def _login(creds):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return s, data


@pytest.fixture(scope="module")
def member_session():
    s, _ = _login(MEMBER)
    return s


@pytest.fixture(scope="module")
def leader_session():
    s, _ = _login(LEADER)
    return s


@pytest.fixture(scope="module")
def admin_session():
    s, _ = _login(ADMIN)
    return s


@pytest.fixture(scope="module", autouse=True)
def _cleanup_missions_before(member_session, leader_session):
    # Clean up any previous test data
    for s in (member_session, leader_session):
        try:
            r = s.get(f"{API}/missions?limit=500")
            if r.status_code == 200:
                for m in r.json():
                    if isinstance(m, dict) and m.get("prospect_name", "").startswith("TEST_"):
                        s.delete(f"{API}/missions/{m['mission_id']}")
        except Exception:
            pass
    yield


# ---------- Auth ----------
def test_missions_requires_auth():
    r = requests.get(f"{API}/missions")
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"


def test_missions_list_returns_array(member_session):
    r = member_session.get(f"{API}/missions")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


# ---------- Create + XP + maps url ----------
def test_create_mission_new_awards_10xp_and_maps_url(member_session):
    # Baseline XP
    me = member_session.get(f"{API}/auth/me").json()
    xp_before = me.get("xp", 0)

    payload = {
        "prospect_name": f"TEST_new_{uuid.uuid4().hex[:6]}",
        "mobile_number": "9990001111",
        "notes": "unit test new",
        "status": "new",
        "lat": 12.9716,
        "lng": 77.5946,
    }
    r = member_session.post(f"{API}/missions", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    m = body["mission"]
    assert m["prospect_name"] == payload["prospect_name"]
    assert m["status"] == "new"
    assert m["google_maps_url"] == "https://www.google.com/maps?q=12.9716,77.5946"
    assert "mission_id" in m
    assert "created_at" in m

    # GET verifies persistence
    r2 = member_session.get(f"{API}/missions?limit=500")
    assert r2.status_code == 200
    assert any(x["mission_id"] == m["mission_id"] for x in r2.json())

    me2 = member_session.get(f"{API}/auth/me").json()
    assert me2["xp"] - xp_before == 10, f"expected +10 xp, got delta {me2['xp'] - xp_before}"


def test_create_mission_converted_awards_40xp(member_session):
    me = member_session.get(f"{API}/auth/me").json()
    xp_before = me.get("xp", 0)

    payload = {
        "prospect_name": f"TEST_conv_{uuid.uuid4().hex[:6]}",
        "status": "converted",
        "lat": 10.0,
        "lng": 20.0,
    }
    r = member_session.post(f"{API}/missions", json=payload)
    assert r.status_code == 200, r.text
    m = r.json()["mission"]
    assert m["status"] == "converted"

    me2 = member_session.get(f"{API}/auth/me").json()
    assert me2["xp"] - xp_before == 40, f"expected +40 xp, got delta {me2['xp'] - xp_before}"


# ---------- Photo ----------
def test_create_mission_with_photo(member_session):
    payload = {
        "prospect_name": f"TEST_photo_{uuid.uuid4().hex[:6]}",
        "status": "new",
        "photo_data": SMALL_JPEG_B64,
        "lat": 1.0,
        "lng": 2.0,
    }
    r = member_session.post(f"{API}/missions", json=payload)
    assert r.status_code == 200, r.text
    mid = r.json()["mission"]["mission_id"]
    # Verify photo persisted
    got = next((x for x in member_session.get(f"{API}/missions?limit=500").json() if x["mission_id"] == mid), None)
    assert got is not None
    assert got.get("photo_data", "").startswith("data:image/jpeg;base64,")


def test_create_mission_with_oversized_photo_returns_413(member_session):
    # Create a photo_data string > 1.5MB
    big = "data:image/jpeg;base64," + ("A" * 1_600_000)
    payload = {
        "prospect_name": f"TEST_big_{uuid.uuid4().hex[:6]}",
        "status": "new",
        "photo_data": big,
    }
    r = member_session.post(f"{API}/missions", json=payload)
    assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text[:200]}"


# ---------- PATCH delta XP ----------
def test_patch_mission_new_to_converted_awards_delta_30(member_session):
    # Create new mission
    r = member_session.post(f"{API}/missions", json={
        "prospect_name": f"TEST_patch_{uuid.uuid4().hex[:6]}",
        "status": "new",
    })
    assert r.status_code == 200
    mid = r.json()["mission"]["mission_id"]

    me = member_session.get(f"{API}/auth/me").json()
    xp_before = me["xp"]

    r2 = member_session.patch(f"{API}/missions/{mid}", json={"status": "converted"})
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["mission"]["status"] == "converted"
    assert body.get("xp") is not None, "expected xp event on new->converted"

    me2 = member_session.get(f"{API}/auth/me").json()
    assert me2["xp"] - xp_before == 30, f"expected +30 delta, got {me2['xp'] - xp_before}"


def test_patch_mission_already_converted_no_extra_xp(member_session):
    # Create converted mission
    r = member_session.post(f"{API}/missions", json={
        "prospect_name": f"TEST_alreadyconv_{uuid.uuid4().hex[:6]}",
        "status": "converted",
    })
    mid = r.json()["mission"]["mission_id"]

    me = member_session.get(f"{API}/auth/me").json()
    xp_before = me["xp"]

    r2 = member_session.patch(f"{API}/missions/{mid}", json={"status": "converted", "notes": "x"})
    assert r2.status_code == 200
    assert r2.json().get("xp") is None

    me2 = member_session.get(f"{API}/auth/me").json()
    assert me2["xp"] == xp_before


# ---------- DELETE ----------
def test_delete_mission(member_session):
    r = member_session.post(f"{API}/missions", json={
        "prospect_name": f"TEST_del_{uuid.uuid4().hex[:6]}",
        "status": "new",
    })
    mid = r.json()["mission"]["mission_id"]

    r2 = member_session.delete(f"{API}/missions/{mid}")
    assert r2.status_code == 200
    assert r2.json() == {"ok": True}

    # Verify removed
    listing = member_session.get(f"{API}/missions?limit=500").json()
    assert not any(x["mission_id"] == mid for x in listing)


def test_delete_other_users_mission_returns_404(member_session, leader_session):
    # Member creates
    r = member_session.post(f"{API}/missions", json={
        "prospect_name": f"TEST_iso_{uuid.uuid4().hex[:6]}",
        "status": "new",
    })
    mid = r.json()["mission"]["mission_id"]

    # Leader tries to delete
    r2 = leader_session.delete(f"{API}/missions/{mid}")
    assert r2.status_code == 404, f"expected 404, got {r2.status_code}"

    # Cleanup
    member_session.delete(f"{API}/missions/{mid}")


def test_list_missions_data_isolation(member_session, leader_session):
    # Member creates a marker mission
    marker = f"TEST_isoL_{uuid.uuid4().hex[:8]}"
    r = member_session.post(f"{API}/missions", json={
        "prospect_name": marker,
        "status": "new",
    })
    mid = r.json()["mission"]["mission_id"]

    leader_list = leader_session.get(f"{API}/missions?limit=500").json()
    assert not any(x["mission_id"] == mid for x in leader_list), "leader saw member's mission"
    assert not any(x.get("prospect_name") == marker for x in leader_list)

    # Cleanup
    member_session.delete(f"{API}/missions/{mid}")


# ---------- Challenge auto-increment ----------
def test_mission_creation_increments_prospects_challenge(admin_session, member_session):
    # Admin creates a 'prospects' goal_type challenge
    today = date.today()
    ch_payload = {
        "title": f"TEST_ProspectsChallenge_{uuid.uuid4().hex[:6]}",
        "description": "auto-increment test",
        "type": "weekly",
        "goal_type": "prospects",
        "goal": 100,
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=7)).isoformat(),
        "xp_reward": 50,
    }
    rc = admin_session.post(f"{API}/challenges", json=ch_payload)
    assert rc.status_code == 200, rc.text
    cid = rc.json()["challenge_id"]

    # Member joins
    rj = member_session.post(f"{API}/challenges/{cid}/join")
    assert rj.status_code == 200

    # Get current progress for this challenge
    def _get_progress():
        chs = member_session.get(f"{API}/challenges").json()
        for c in chs:
            if c["challenge_id"] == cid:
                return c.get("progress", 0)
        return None

    before = _get_progress()
    assert before is not None, "challenge not visible to member after join"

    # Member creates a mission
    r = member_session.post(f"{API}/missions", json={
        "prospect_name": f"TEST_chg_{uuid.uuid4().hex[:6]}",
        "status": "new",
    })
    assert r.status_code == 200

    after = _get_progress()
    assert after == before + 1, f"progress not incremented (before={before}, after={after})"


# ---------- Indexes ----------
def test_missions_indexes_present():
    # Read MONGO_URL from backend/.env
    mongo_url = None
    db_name = None
    try:
        with open("/app/backend/.env") as f:
            for line in f:
                line = line.strip()
                if line.startswith("MONGO_URL="):
                    mongo_url = line.split("=", 1)[1].strip().strip('"')
                elif line.startswith("DB_NAME="):
                    db_name = line.split("=", 1)[1].strip().strip('"')
    except Exception as e:
        pytest.skip(f"Cannot read backend/.env: {e}")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL/DB_NAME not configured")
    try:
        from pymongo import MongoClient
        cli = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        info = cli[db_name].missions.index_information()
    except Exception as e:
        pytest.skip(f"pymongo not available: {e}")

    # Find any mission_id unique index
    has_mission_id_unique = any(
        idx.get("unique") and any(k[0] == "mission_id" for k in idx.get("key", []))
        for idx in info.values()
    )
    # Compound user_id + created_at
    has_compound = any(
        [k[0] for k in idx.get("key", [])] == ["user_id", "created_at"]
        for idx in info.values()
    )
    assert has_mission_id_unique, f"missing mission_id unique index. indexes={list(info.keys())}"
    assert has_compound, f"missing (user_id, created_at) compound index. indexes={list(info.keys())}"
