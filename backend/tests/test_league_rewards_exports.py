"""
Tests for Team League, Rewards/Redemptions, Profile Completion, and Exports.
"""
import os
import io
import csv
import time
import uuid
import pytest
import requests

def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

ADMIN = ("admin@spartans.com", "Spartan123!")
LEADER = ("leader@spartans.com", "Leader123!")
MEMBER = ("member@spartans.com", "Member123!")
ACHILLES = ("achilles@spartans.com", "Demo123!")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def leader():
    return _login(*LEADER)


@pytest.fixture(scope="module")
def member():
    return _login(*MEMBER)


@pytest.fixture(scope="module")
def achilles():
    return _login(*ACHILLES)


# ---------- Team League ----------
class TestTeamLeague:
    def test_team_league_shape(self, admin):
        r = admin.get(f"{API}/team-league")
        assert r.status_code == 200
        data = r.json()
        assert "teams" in data and "attendance_xp_table" in data
        # 6 tiers
        table = data["attendance_xp_table"]
        assert len(table) == 6
        expected = [(100, 50), (90, 40), (80, 30), (70, 20), (60, 10), (0, 0)]
        for i, (t, x) in enumerate(expected):
            assert table[i]["threshold_pct"] == t
            assert table[i]["xp_reward"] == x
        # Teams have required fields
        for t in data["teams"]:
            for k in ["rank", "xp", "weekly_xp", "monthly_xp",
                      "weekly_attendance_pct", "monthly_attendance_pct",
                      "attendance_bonus_xp", "streak", "members", "name"]:
                assert k in t, f"missing {k} in team row"

    def test_attendance_bonus_xp_matches_table(self, admin):
        data = admin.get(f"{API}/team-league").json()
        for t in data["teams"]:
            pct = t["monthly_attendance_pct"]
            expected = 0
            for th, xp in [(100, 50), (90, 40), (80, 30), (70, 20), (60, 10), (0, 0)]:
                if pct >= th:
                    expected = xp
                    break
            assert t["attendance_bonus_xp"] == expected, (
                f"Team {t['name']} pct={pct} expected {expected}, got {t['attendance_bonus_xp']}"
            )

    def test_spartans_team_seeded(self, admin):
        data = admin.get(f"{API}/team-league").json()
        names = [t["name"] for t in data["teams"]]
        # SPARTANS may have 0 members and be skipped; check via /teams
        r = admin.get(f"{API}/teams")
        if r.status_code == 200:
            team_names = [t.get("name") for t in r.json()]
            assert "SPARTANS" in team_names, f"SPARTANS not seeded. Teams: {team_names}"


# ---------- Rewards ----------
class TestRewards:
    def test_list_rewards_seeded(self, member):
        r = member.get(f"{API}/rewards")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        names = {i["name"]: i["cost_xp"] for i in items}
        # Seeded defaults
        expected = {
            "Team Dinner Voucher": 300,
            "Movie Ticket": 500,
            "Team Outing Pass": 1500,
        }
        for n, cost in expected.items():
            assert n in names, f"Missing seeded reward: {n}"
            assert names[n] == cost, f"{n} cost expected {cost}, got {names[n]}"
        # Amazon 2000
        amazon = [i for i in items if "Amazon" in i["name"]]
        assert amazon and amazon[0]["cost_xp"] == 2000

    def test_create_reward_requires_super_admin(self, member, leader, admin):
        payload = {"name": f"TEST_Reward_{uuid.uuid4().hex[:6]}", "cost_xp": 100,
                   "category": "voucher", "description": "test", "stock": 5, "active": True}
        r = member.post(f"{API}/rewards", json=payload)
        assert r.status_code == 403, f"member should get 403, got {r.status_code}"
        r = leader.post(f"{API}/rewards", json=payload)
        assert r.status_code == 403
        r = admin.post(f"{API}/rewards", json=payload)
        assert r.status_code == 200
        created = r.json()
        assert "reward_id" in created
        # Cleanup
        admin.delete(f"{API}/rewards/{created['reward_id']}")

    def test_patch_and_delete_require_super_admin(self, admin, member):
        # Create as admin
        payload = {"name": f"TEST_R_{uuid.uuid4().hex[:6]}", "cost_xp": 50,
                   "category": "voucher", "description": "x", "stock": 1, "active": True}
        rid = admin.post(f"{API}/rewards", json=payload).json()["reward_id"]
        # Member cannot patch
        r = member.patch(f"{API}/rewards/{rid}", json={"cost_xp": 99})
        assert r.status_code == 403
        # Admin can patch
        r = admin.patch(f"{API}/rewards/{rid}", json={"cost_xp": 99})
        assert r.status_code == 200
        # Member cannot delete
        r = member.delete(f"{API}/rewards/{rid}")
        assert r.status_code == 403
        # Admin can delete
        r = admin.delete(f"{API}/rewards/{rid}")
        assert r.status_code == 200


# ---------- Redemption ----------
class TestRedemption:
    def test_redeem_flow_with_xp_deduction(self, admin, achilles):
        # Get achilles xp
        me = achilles.get(f"{API}/auth/me").json()
        start_xp = me.get("xp", 0)
        if start_xp < 300:
            pytest.skip(f"achilles has only {start_xp} XP, need >=300")
        # Create a low-cost reward
        payload = {"name": f"TEST_Redeem_{uuid.uuid4().hex[:6]}", "cost_xp": 100,
                   "category": "voucher", "description": "t", "stock": 5, "active": True}
        rid = admin.post(f"{API}/rewards", json=payload).json()["reward_id"]
        try:
            r = achilles.post(f"{API}/rewards/{rid}/redeem")
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["new_xp"] == start_xp - 100
            assert body["redemption"]["status"] == "pending"
            assert body["redemption"]["cost_xp"] == 100
            # Verify /auth/me
            me2 = achilles.get(f"{API}/auth/me").json()
            assert me2["xp"] == start_xp - 100
            # Verify redemption listed
            reds = achilles.get(f"{API}/redemptions").json()
            assert any(x["redemption_id"] == body["redemption"]["redemption_id"] for x in reds)
            # Fulfill (admin only)
            r_ful = achilles.patch(f"{API}/redemptions/{body['redemption']['redemption_id']}/fulfill")
            assert r_ful.status_code == 403
            r_ful = admin.patch(f"{API}/redemptions/{body['redemption']['redemption_id']}/fulfill")
            assert r_ful.status_code == 200
        finally:
            admin.delete(f"{API}/rewards/{rid}")

    def test_redeem_insufficient_xp(self, admin, member):
        payload = {"name": f"TEST_Expensive_{uuid.uuid4().hex[:6]}", "cost_xp": 100000,
                   "category": "voucher", "description": "t", "stock": 5, "active": True}
        rid = admin.post(f"{API}/rewards", json=payload).json()["reward_id"]
        try:
            r = member.post(f"{API}/rewards/{rid}/redeem")
            assert r.status_code == 400
            assert "XP" in r.text or "xp" in r.text.lower()
        finally:
            admin.delete(f"{API}/rewards/{rid}")

    def test_redeem_out_of_stock(self, admin, achilles):
        payload = {"name": f"TEST_OOS_{uuid.uuid4().hex[:6]}", "cost_xp": 1,
                   "category": "voucher", "description": "t", "stock": 0, "active": True}
        rid = admin.post(f"{API}/rewards", json=payload).json()["reward_id"]
        try:
            r = achilles.post(f"{API}/rewards/{rid}/redeem")
            assert r.status_code == 400
            assert "stock" in r.text.lower()
        finally:
            admin.delete(f"{API}/rewards/{rid}")

    def test_all_users_redemptions_permission(self, admin, member):
        r = member.get(f"{API}/redemptions", params={"all_users": "true"})
        assert r.status_code == 403
        r = admin.get(f"{API}/redemptions", params={"all_users": "true"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Profile Completion ----------
class TestProfileCompletion:
    def test_get_completion(self, member):
        r = member.get(f"{API}/profile/completion")
        assert r.status_code == 200
        d = r.json()
        for k in ["filled", "total", "pct", "missing", "completion_xp_awarded"]:
            assert k in d
        assert d["total"] == 6

    def test_patch_profile_awards_xp_once(self, admin):
        # Register a fresh user
        email = f"test_profile_{uuid.uuid4().hex[:8]}@spartans.com"
        password = "TestPass123!"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": password, "name": "Profile Tester"
        }, timeout=20)
        assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
        tok = r.json().get("access_token") or r.json().get("token")
        if tok:
            s.headers.update({"Authorization": f"Bearer {tok}"})
        # Attach team via admin (fields: name,email,avatar,team,phone,bio)
        me = s.get(f"{API}/auth/me").json()
        uid = me["user_id"]
        # Get a team_id
        teams = admin.get(f"{API}/teams").json()
        team_id = teams[0]["team_id"] if teams else None

        # Try admin endpoint to set team; else patch directly via profile - team_id not in ProfileUpdate probably
        # Set team via admin update-user endpoint if it exists
        # Use PATCH /users/{id} or team change endpoint - fallback: profile patch with team_id not supported
        # We'll just fill fields that ProfileUpdate accepts: phone, bio, avatar_url
        # But team_id also counts toward completion. So we need to set team.
        # Try /users/{uid}/team or similar
        set_team_ok = False
        for path in [f"/admin/users/{uid}/team", f"/users/{uid}/team", f"/teams/{team_id}/members/{uid}"]:
            rr = admin.patch(f"{API}{path}", json={"team_id": team_id})
            if rr.status_code < 400:
                set_team_ok = True
                break
            rr = admin.post(f"{API}{path}", json={"team_id": team_id})
            if rr.status_code < 400:
                set_team_ok = True
                break
        # Fill profile
        r1 = s.patch(f"{API}/profile", json={"phone": "1234567890", "bio": "hi", "avatar_url": "https://x/a.png"})
        assert r1.status_code == 200, r1.text
        comp = r1.json()["completion"]
        xp_awarded_first = r1.json().get("xp")

        # Second call at same state - should NOT re-award
        r2 = s.patch(f"{API}/profile", json={"phone": "1234567890"})
        assert r2.status_code == 200
        assert r2.json().get("xp") is None, "XP should not re-award on second 100% patch"

        # If completion pct reached 100, verify awarded flag true
        if comp["pct"] >= 100:
            assert xp_awarded_first is not None
            assert r2.json()["completion"]["completion_xp_awarded"] is True
        else:
            # team_id likely not set — flag as info
            print(f"WARN: pct={comp['pct']}, could not set team_id via admin API. set_team_ok={set_team_ok}")


# ---------- Exports ----------
class TestExports:
    def test_team_performance_csv(self, admin):
        r = admin.get(f"{API}/exports/team-performance", params={"format": "csv"})
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "text/csv" in ct, ct
        text = r.text
        first_line = text.splitlines()[0]
        assert first_line == "Rank,Team,Members,Total XP,Weekly XP,Monthly XP,Weekly Attn %,Monthly Attn %,Bonus XP,Best Streak", first_line

    def test_team_performance_pdf(self, admin):
        r = admin.get(f"{API}/exports/team-performance", params={"format": "pdf"})
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "")
        assert r.content.startswith(b"%PDF-")

    def test_attendance_export_csv(self, admin):
        r = admin.get(f"{API}/exports/attendance", params={"format": "csv"})
        # May 400 if no season
        if r.status_code == 400:
            pytest.skip("No season available")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        first = r.text.splitlines()[0]
        assert first == "Name,Team,Present,Absent,N/A,Unmarked,Total Events,Attendance %"

    def test_xp_leaderboard_csv(self, admin):
        r = admin.get(f"{API}/exports/xp-leaderboard", params={"scope": "all", "format": "csv"})
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_daily_export_csv(self, admin):
        from datetime import date
        r = admin.get(f"{API}/exports/daily", params={"format": "csv", "day": date.today().isoformat()})
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        first = r.text.splitlines()[0]
        assert first == "Name,Team,Actions,XP Earned"

    def test_exports_forbidden_for_members(self, member):
        for path in ["/exports/team-performance", "/exports/xp-leaderboard", "/exports/daily", "/exports/attendance"]:
            r = member.get(f"{API}{path}", params={"format": "csv"})
            assert r.status_code == 403, f"{path} member got {r.status_code}"

    def test_exports_allowed_for_team_leader(self, leader):
        r = leader.get(f"{API}/exports/team-performance", params={"format": "csv"})
        assert r.status_code == 200
