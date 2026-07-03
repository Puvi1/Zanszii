"""Backend tests for role management (teams), reports, and RBAC scoping.

Covers:
- Teams CRUD (super_admin only)
- Team assign / remove members
- /my-team (team_leader only)
- /reports/me, /reports/team, /reports/global
- Scoped /admin/users and /admin/analytics
- Leaderboard team_id filter
- Seed backfill verification
"""
import os
import uuid
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        # Fallback: read from frontend/.env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        v = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert v, "REACT_APP_BACKEND_URL not set"
    return v.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@spartans.com", "password": "Spartan123!"}
LEADER = {"email": "leader@spartans.com", "password": "Leader123!"}
MEMBER = {"email": "member@spartans.com", "password": "Member123!"}


def _client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(creds):
    s = _client()
    r = s.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return s, data


# ---------- Fixtures ----------
@pytest.fixture
def admin_session():
    s, _ = _login(ADMIN)
    return s


@pytest.fixture
def leader_session():
    s, _ = _login(LEADER)
    return s


@pytest.fixture
def member_session():
    s, _ = _login(MEMBER)
    return s


@pytest.fixture
def alpha_team(admin_session):
    """Grab Alpha team info from admin listing."""
    r = admin_session.get(f"{API}/teams")
    assert r.status_code == 200
    teams = r.json()
    alpha = next((t for t in teams if t["name"] == "Alpha"), None)
    assert alpha is not None, "Alpha team not seeded"
    return alpha


@pytest.fixture(scope="module")
def created_test_team():
    """Create a fresh test team; clean it up at the end."""
    s, _ = _login(ADMIN)
    name = f"TEST_Titans_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/teams", json={"name": name})
    assert r.status_code == 200, r.text
    team = r.json()
    yield team
    # cleanup
    s2, _ = _login(ADMIN)
    s2.delete(f"{API}/teams/{team['team_id']}")


# ---------- Teams RBAC ----------
class TestTeamsRBAC:
    def test_list_teams_super_admin(self, admin_session):
        r = admin_session.get(f"{API}/teams")
        assert r.status_code == 200
        teams = r.json()
        assert isinstance(teams, list) and len(teams) >= 3
        keys = {"team_id", "name", "leader_id", "leader", "member_count"}
        for t in teams:
            assert keys.issubset(t.keys()), f"missing keys in {t}"

    def test_list_teams_forbidden_leader(self, leader_session):
        r = leader_session.get(f"{API}/teams")
        assert r.status_code == 403

    def test_list_teams_forbidden_member(self, member_session):
        r = member_session.get(f"{API}/teams")
        assert r.status_code == 403


class TestTeamsCRUD:
    def test_create_and_duplicate(self, admin_session, created_test_team):
        # duplicate should fail
        r = admin_session.post(f"{API}/teams", json={"name": created_test_team["name"]})
        assert r.status_code == 400

    def test_create_forbidden_leader(self, leader_session):
        r = leader_session.post(f"{API}/teams", json={"name": f"TEST_x_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 403

    def test_patch_rename(self, admin_session, created_test_team):
        tid = created_test_team["team_id"]
        new_name = created_test_team["name"] + "_renamed"
        r = admin_session.patch(f"{API}/teams/{tid}", json={"name": new_name})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name
        created_test_team["name"] = new_name  # update fixture

    def test_patch_forbidden_leader(self, leader_session, created_test_team):
        r = leader_session.patch(
            f"{API}/teams/{created_test_team['team_id']}", json={"name": "hack"}
        )
        assert r.status_code == 403


class TestTeamAssignRemove:
    def test_assign_member_and_verify(self, admin_session, created_test_team):
        # Register a new user to assign
        email = f"TEST_assign_{uuid.uuid4().hex[:6]}@spartans.com"
        r = admin_session.post(
            f"{API}/auth/register",
            json={"email": email, "password": "Password123!", "name": "Assignee"},
        )
        assert r.status_code == 200
        uid = r.json()["user"]["user_id"]

        # Re-login admin (register may have reset auth cookie on same session)
        s, _ = _login(ADMIN)

        r = s.post(
            f"{API}/teams/{created_test_team['team_id']}/assign",
            json={"user_id": uid, "is_leader": False},
        )
        assert r.status_code == 200, r.text

        # Verify user shows up under admin_users with team_id
        r = s.get(f"{API}/admin/users")
        assert r.status_code == 200
        u = next((x for x in r.json() if x["user_id"] == uid), None)
        assert u and u.get("team_id") == created_test_team["team_id"]

        # Now promote to leader
        r = s.post(
            f"{API}/teams/{created_test_team['team_id']}/assign",
            json={"user_id": uid, "is_leader": True},
        )
        assert r.status_code == 200

        # Verify team leader_id updated & role=team_leader
        r = s.get(f"{API}/teams")
        team = next(t for t in r.json() if t["team_id"] == created_test_team["team_id"])
        assert team["leader_id"] == uid
        assert team["leader"]["email"] == email.lower()

        # Remove member
        r = s.delete(f"{API}/teams/{created_test_team['team_id']}/members/{uid}")
        assert r.status_code == 200
        # After removal, leader_id should be cleared and user demoted
        r = s.get(f"{API}/teams")
        team = next(t for t in r.json() if t["team_id"] == created_test_team["team_id"])
        assert team["leader_id"] is None

    def test_assign_forbidden_leader(self, leader_session, created_test_team, admin_session):
        # Get any user id
        uid = next(
            u["user_id"] for u in admin_session.get(f"{API}/admin/users").json()
            if u["email"] == MEMBER["email"]
        )
        r = leader_session.post(
            f"{API}/teams/{created_test_team['team_id']}/assign",
            json={"user_id": uid},
        )
        assert r.status_code == 403


# ---------- /my-team ----------
class TestMyTeam:
    def test_leader_gets_my_team(self, leader_session):
        r = leader_session.get(f"{API}/my-team")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["team"]["name"] == "Alpha"
        assert isinstance(d["members"], list)
        assert any(m["email"] == MEMBER["email"] for m in d["members"])

    def test_admin_my_team_400(self, admin_session):
        r = admin_session.get(f"{API}/my-team")
        assert r.status_code == 400

    def test_member_my_team_403(self, member_session):
        r = member_session.get(f"{API}/my-team")
        assert r.status_code == 403


# ---------- Reports ----------
class TestReports:
    def test_report_me_member(self, member_session):
        r = member_session.get(f"{API}/reports/me")
        assert r.status_code == 200
        d = r.json()
        for k in ("user", "checkins", "prospects", "won", "xp_30d", "timeline"):
            assert k in d, f"missing {k}"
        assert isinstance(d["timeline"], list) and len(d["timeline"]) == 14
        assert all("date" in t and "xp" in t for t in d["timeline"])

    def test_report_me_admin_allowed(self, admin_session):
        r = admin_session.get(f"{API}/reports/me")
        assert r.status_code == 200

    def test_report_team_leader(self, leader_session):
        r = leader_session.get(f"{API}/reports/team")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["team"]["name"] == "Alpha"
        assert "totals" in d and "members" in d
        for k in ("members", "prospects", "won", "checkins", "attendance", "xp", "conversion_rate"):
            assert k in d["totals"]

    def test_report_team_admin_requires_team_id(self, admin_session):
        r = admin_session.get(f"{API}/reports/team")
        assert r.status_code == 400

    def test_report_team_admin_with_team_id(self, admin_session, alpha_team):
        r = admin_session.get(f"{API}/reports/team", params={"team_id": alpha_team["team_id"]})
        assert r.status_code == 200
        assert r.json()["team"]["team_id"] == alpha_team["team_id"]

    def test_report_team_forbidden_member(self, member_session):
        r = member_session.get(f"{API}/reports/team")
        assert r.status_code == 403

    def test_report_global_admin(self, admin_session):
        r = admin_session.get(f"{API}/reports/global")
        assert r.status_code == 200
        d = r.json()
        assert "totals" in d and "teams" in d
        assert d["totals"]["teams"] >= 3
        assert isinstance(d["teams"], list) and len(d["teams"]) >= 3
        # Sorted by xp (desc) — not strictly required by spec, just verify shape
        for t in d["teams"]:
            for k in ("team_id", "name", "members", "prospects", "won", "xp"):
                assert k in t

    def test_report_global_forbidden_leader(self, leader_session):
        r = leader_session.get(f"{API}/reports/global")
        assert r.status_code == 403

    def test_report_global_forbidden_member(self, member_session):
        r = member_session.get(f"{API}/reports/global")
        assert r.status_code == 403


# ---------- Scoped admin endpoints ----------
class TestAdminScoping:
    def test_admin_users_leader_scoped(self, leader_session, member_session):
        r = leader_session.get(f"{API}/admin/users")
        assert r.status_code == 200
        users = r.json()
        # Leader should ONLY see own team members (Alpha)
        teams_seen = {u.get("team") for u in users}
        assert teams_seen.issubset({"Alpha"}), f"leader saw teams {teams_seen}"
        emails = {u["email"] for u in users}
        assert LEADER["email"] in emails
        assert MEMBER["email"] in emails

    def test_admin_users_admin_sees_all(self, admin_session):
        r = admin_session.get(f"{API}/admin/users")
        assert r.status_code == 200
        users = r.json()
        teams_seen = {u.get("team") for u in users if u.get("team")}
        # Should include multiple teams
        assert len(teams_seen) >= 2

    def test_admin_analytics_scope_field(self, leader_session, admin_session, member_session):
        r = leader_session.get(f"{API}/admin/analytics")
        assert r.status_code == 200
        assert r.json().get("scope") == "team"

        r = admin_session.get(f"{API}/admin/analytics")
        assert r.status_code == 200
        assert r.json().get("scope") == "global"

        r = member_session.get(f"{API}/admin/analytics")
        assert r.status_code == 403


# ---------- Leaderboard team filter ----------
class TestLeaderboardTeamFilter:
    def test_leaderboard_team_filter(self, member_session, admin_session, alpha_team):
        # Fetch Alpha members via admin to compute expected user_ids
        users = admin_session.get(f"{API}/admin/users").json()
        alpha_uids = {u["user_id"] for u in users if u.get("team_id") == alpha_team["team_id"]}
        assert len(alpha_uids) >= 2, "Alpha should have multiple seeded members"

        r = member_session.get(f"{API}/leaderboard", params={"team_id": alpha_team["team_id"]})
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        for row in rows:
            assert row["user_id"] in alpha_uids, f"non-Alpha user {row['user_id']} in filtered leaderboard"


# ---------- Seed backfill ----------
class TestSeedBackfill:
    def test_demo_users_have_team_id(self, admin_session):
        users = admin_session.get(f"{API}/admin/users").json()
        # Any user whose team is Alpha/Bravo/Delta/Command should have a non-null team_id
        for u in users:
            if u.get("team") in ("Alpha", "Bravo", "Delta", "Command"):
                assert u.get("team_id"), f"{u['email']} team={u['team']} missing team_id"

    def test_alpha_has_multiple_members(self, admin_session):
        teams = admin_session.get(f"{API}/teams").json()
        alpha = next(t for t in teams if t["name"] == "Alpha")
        assert alpha["member_count"] >= 2, f"Alpha only has {alpha['member_count']} members"
        assert alpha.get("leader") and alpha["leader"]["email"] == LEADER["email"]


# ---------- JWT bearer sanity ----------
class TestBearerAuth:
    def test_bearer_token_works(self):
        # Login, extract bearer, use in a raw request without session cookies
        r = requests.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        r2 = requests.get(f"{API}/teams", headers={"Authorization": f"Bearer {tok}"})
        assert r2.status_code == 200

    def test_no_auth_401(self):
        r = requests.get(f"{API}/teams")
        assert r.status_code == 401
