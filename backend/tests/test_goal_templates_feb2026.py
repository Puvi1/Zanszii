"""Backend tests for Feb 2026: Goal Templates (Super Admin) + user-side HQ-assigned protection."""
import os
import uuid
import pytest
import requests
from datetime import date, timedelta

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Fallback: read from frontend/.env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert url, "REACT_APP_BACKEND_URL missing"
    return url.rstrip("/")

BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@spartans.com"
ADMIN_PASSWORD = "Spartan123!"


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def member_creds():
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_member_{suffix}@example.com"
    password = "MemberPass123!"
    payload = {
        "email": email,
        "password": password,
        "name": f"TEST Member {suffix}",
        "nexus_id": "BC-TEST",
    }
    r = requests.post(f"{API}/auth/register", json=payload)
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    # If register did not return token, login
    if not token:
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
        assert r2.status_code == 200
        token = r2.json()["access_token"]
    return {"email": email, "password": password, "token": token}


@pytest.fixture(scope="module")
def member_headers(member_creds):
    return {"Authorization": f"Bearer {member_creds['token']}"}


@pytest.fixture(scope="module")
def cleanup_state():
    return {"created_templates": []}


@pytest.fixture(scope="module", autouse=True)
def cleanup_after(admin_headers, cleanup_state):
    yield
    for tid in cleanup_state["created_templates"]:
        try:
            requests.delete(f"{API}/admin/goal-templates/{tid}", headers=admin_headers)
        except Exception:
            pass


def _mk_payload(period="weekly", **overrides):
    today = date.today()
    p = {
        "title": f"TEST_Add Prospects {uuid.uuid4().hex[:6]}",
        "target": 10,
        "xp_reward": 200,
        "period": period,
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=7 if period == "weekly" else 30)).isoformat(),
        "active": True,
    }
    p.update(overrides)
    return p


# ---------- Cleanup any prior TEST templates ----------

def test_pre_cleanup_prior_test_templates(admin_headers):
    r = requests.get(f"{API}/admin/goal-templates", headers=admin_headers)
    assert r.status_code == 200
    for t in r.json():
        title = t.get("title", "")
        if title.startswith("TEST_") or title == "Add 10 Prospects":
            requests.delete(f"{API}/admin/goal-templates/{t['template_id']}", headers=admin_headers)


# ---------- CREATE + auto-assign ----------

def test_create_template_assigns_to_all_active_users(admin_headers, cleanup_state, member_creds):
    # Ensure our test member exists first (fixture ran)
    _ = member_creds
    # Count active users
    users_r = requests.get(f"{API}/admin/users", headers=admin_headers)
    assert users_r.status_code == 200
    active_users = [u for u in users_r.json() if u.get("active", True) is not False]
    n_active = len(active_users)

    payload = _mk_payload(period="weekly", title="TEST_Add 10 Prospects")
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    assert r.status_code in (200, 201), f"{r.status_code} {r.text}"
    body = r.json()
    assert "template" in body and "assigned_to" in body
    tid = body["template"]["template_id"]
    cleanup_state["created_templates"].append(tid)

    assert body["assigned_to"] == n_active, f"Assigned {body['assigned_to']} vs active {n_active}"


def test_new_member_gets_active_templates(admin_headers, cleanup_state):
    # Create a template first, then register a fresh member
    payload = _mk_payload(period="monthly", title="TEST_Monthly Rev Push")
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    assert r.status_code in (200, 201)
    tid = r.json()["template"]["template_id"]
    cleanup_state["created_templates"].append(tid)

    # Register a new member
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_new_{suffix}@example.com"
    reg = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Pass1234!", "name": f"New {suffix}", "nexus_id": "BC-NEW",
    })
    assert reg.status_code in (200, 201), reg.text
    token = reg.json().get("access_token") or reg.json().get("token")
    if not token:
        token = requests.post(f"{API}/auth/login", json={"email": email, "password": "Pass1234!"}).json()["access_token"]

    goals_r = requests.get(f"{API}/goals", headers={"Authorization": f"Bearer {token}"})
    assert goals_r.status_code == 200
    goals = goals_r.json()
    template_ids = [g.get("template_id") for g in goals]
    assert tid in template_ids, f"New member missing template. Got: {template_ids}"


# ---------- LIST with counts ----------

def test_list_templates_has_counts(admin_headers):
    r = requests.get(f"{API}/admin/goal-templates", headers=admin_headers)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    for t in items:
        assert "assigned_count" in t
        assert "completed_count" in t
        assert isinstance(t["assigned_count"], int)


# ---------- RBAC ----------

def test_non_admin_cannot_access_goal_templates(member_headers):
    r_get = requests.get(f"{API}/admin/goal-templates", headers=member_headers)
    assert r_get.status_code in (401, 403), f"GET got {r_get.status_code}"

    r_post = requests.post(f"{API}/admin/goal-templates", json=_mk_payload(), headers=member_headers)
    assert r_post.status_code in (401, 403)

    r_patch = requests.patch(f"{API}/admin/goal-templates/anything", json={"active": False}, headers=member_headers)
    assert r_patch.status_code in (401, 403, 404)  # may 404 before role check but usually role first

    r_del = requests.delete(f"{API}/admin/goal-templates/anything", headers=member_headers)
    assert r_del.status_code in (401, 403, 404)


# ---------- PATCH cascades ----------

def test_patch_cascades_to_open_goals(admin_headers, cleanup_state, member_creds):
    payload = _mk_payload(period="weekly", title="TEST_Cascade Original", target=5, xp_reward=50)
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    tid = r.json()["template"]["template_id"]
    cleanup_state["created_templates"].append(tid)

    # Fetch member goal
    mh = {"Authorization": f"Bearer {member_creds['token']}"}
    g_before = requests.get(f"{API}/goals", headers=mh).json()
    my_goal = next((g for g in g_before if g.get("template_id") == tid), None)
    assert my_goal is not None
    assert my_goal["title"] == "TEST_Cascade Original"
    assert my_goal["target"] == 5

    # PATCH template
    rp = requests.patch(f"{API}/admin/goal-templates/{tid}",
                       json={"title": "TEST_Cascade Updated", "target": 15}, headers=admin_headers)
    assert rp.status_code == 200

    # Re-fetch
    g_after = requests.get(f"{API}/goals", headers=mh).json()
    updated = next((g for g in g_after if g.get("template_id") == tid), None)
    assert updated is not None
    assert updated["title"] == "TEST_Cascade Updated"
    assert updated["target"] == 15


def test_patch_active_false_stops_assignment(admin_headers, cleanup_state):
    payload = _mk_payload(period="weekly", title="TEST_ToggleOff")
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    tid = r.json()["template"]["template_id"]
    cleanup_state["created_templates"].append(tid)

    rp = requests.patch(f"{API}/admin/goal-templates/{tid}", json={"active": False}, headers=admin_headers)
    assert rp.status_code == 200

    # Register a fresh user AFTER deactivation
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_after_off_{suffix}@example.com"
    reg = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Pass1234!", "name": "X", "nexus_id": "BC-OFF",
    })
    assert reg.status_code in (200, 201)
    token = reg.json().get("access_token") or requests.post(
        f"{API}/auth/login", json={"email": email, "password": "Pass1234!"}
    ).json()["access_token"]
    goals = requests.get(f"{API}/goals", headers={"Authorization": f"Bearer {token}"}).json()
    assert tid not in [g.get("template_id") for g in goals], "Inactive template should not auto-assign"


# ---------- DELETE ----------

def test_delete_template_removes_open_goals_only(admin_headers, cleanup_state, member_creds):
    payload = _mk_payload(period="weekly", title="TEST_DeleteMe")
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    tid = r.json()["template"]["template_id"]

    rd = requests.delete(f"{API}/admin/goal-templates/{tid}", headers=admin_headers)
    assert rd.status_code == 200
    body = rd.json()
    assert "removed_open_goals" in body
    assert body["removed_open_goals"] >= 1

    # Verify template gone
    assert requests.delete(f"{API}/admin/goal-templates/{tid}", headers=admin_headers).status_code == 404


# ---------- RESYNC ----------

def test_resync_is_idempotent(admin_headers, cleanup_state):
    payload = _mk_payload(period="weekly", title="TEST_Resync")
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    tid = r.json()["template"]["template_id"]
    cleanup_state["created_templates"].append(tid)

    r1 = requests.post(f"{API}/admin/goal-templates/{tid}/resync", headers=admin_headers)
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/admin/goal-templates/{tid}/resync", headers=admin_headers)
    assert r2.status_code == 200
    assert r2.json()["assigned_to"] == 0, "Second resync should assign 0"


# ---------- User-side: HQ-assigned protection ----------

def test_member_cannot_delete_hq_assigned_goal(admin_headers, cleanup_state, member_creds):
    payload = _mk_payload(period="weekly", title="TEST_HQProtect")
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    tid = r.json()["template"]["template_id"]
    cleanup_state["created_templates"].append(tid)

    mh = {"Authorization": f"Bearer {member_creds['token']}"}
    goals = requests.get(f"{API}/goals", headers=mh).json()
    my_goal = next((g for g in goals if g.get("template_id") == tid), None)
    assert my_goal is not None
    gid = my_goal["goal_id"]

    rd = requests.delete(f"{API}/goals/{gid}", headers=mh)
    assert rd.status_code == 403
    assert "HQ" in rd.text or "admin" in rd.text.lower()


def test_member_can_delete_personal_goal(member_creds):
    mh = {"Authorization": f"Bearer {member_creds['token']}"}
    # Create personal goal
    r = requests.post(f"{API}/goals", json={
        "title": "TEST_Personal",
        "target": 3,
        "xp_reward": 30,
        "period": "weekly",
    }, headers=mh)
    if r.status_code not in (200, 201):
        pytest.skip(f"Personal goal creation endpoint unavailable: {r.status_code}")
    body = r.json()
    gid = body.get("goal_id") or body.get("goal", {}).get("goal_id")
    if not gid:
        pytest.skip(f"No goal_id returned: {body}")
    rd = requests.delete(f"{API}/goals/{gid}", headers=mh)
    assert rd.status_code == 200, f"delete failed body={body} resp={rd.text}"


def test_progress_awards_xp_on_completion(admin_headers, cleanup_state, member_creds):
    payload = _mk_payload(period="weekly", title="TEST_XPComplete", target=2, xp_reward=100)
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    tid = r.json()["template"]["template_id"]
    cleanup_state["created_templates"].append(tid)

    mh = {"Authorization": f"Bearer {member_creds['token']}"}
    goals = requests.get(f"{API}/goals", headers=mh).json()
    my_goal = next((g for g in goals if g.get("template_id") == tid), None)
    assert my_goal is not None
    gid = my_goal["goal_id"]

    # Get xp before
    me_before = requests.get(f"{API}/auth/me", headers=mh).json()
    xp_before = me_before.get("xp", 0)

    # Bump progress to hit target (endpoint expects absolute `progress`, not delta)
    rp = requests.patch(f"{API}/goals/{gid}/progress", json={"progress": 2}, headers=mh)
    assert rp.status_code == 200, rp.text

    me_after = requests.get(f"{API}/auth/me", headers=mh).json()
    xp_after = me_after.get("xp", 0)
    assert xp_after >= xp_before + 100, f"XP not awarded: {xp_before} -> {xp_after}"


# ---------- Validation ----------

def test_end_before_start_returns_400(admin_headers):
    payload = _mk_payload()
    payload["start_date"] = "2026-03-10"
    payload["end_date"] = "2026-03-01"
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    assert r.status_code == 400


def test_missing_required_field_422(admin_headers):
    bad = {"title": "x", "period": "weekly"}  # missing target/dates
    r = requests.post(f"{API}/admin/goal-templates", json=bad, headers=admin_headers)
    assert r.status_code == 422


def test_target_zero_422(admin_headers):
    payload = _mk_payload(target=0)
    r = requests.post(f"{API}/admin/goal-templates", json=payload, headers=admin_headers)
    assert r.status_code == 422
