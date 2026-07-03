"""Spartans Growth League — FastAPI backend.
Handles auth (JWT + Emergent Google), gamification, CRM, challenges, leaderboard, admin.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import math
import logging
import secrets
import httpx
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from auth_utils import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies,
    get_current_user, require_role,
    get_jwt_secret,
)
import jwt

# ---------- Setup ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Spartans Growth League API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spartans")

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# ---------- Gamification helpers ----------
def level_from_xp(xp: int) -> int:
    if xp <= 0:
        return 1
    return int(math.floor(math.sqrt(xp / 100.0))) + 1


def xp_to_level(level: int) -> int:
    return (level - 1) ** 2 * 100


def xp_progress(xp: int):
    lvl = level_from_xp(xp)
    curr = xp_to_level(lvl)
    nxt = xp_to_level(lvl + 1)
    return {"level": lvl, "xp": xp, "current_level_xp": curr, "next_level_xp": nxt,
            "progress_pct": round(((xp - curr) / max(1, nxt - curr)) * 100, 1)}


XP_RULES = {
    "daily_checkin": 10,
    "prospect_added": 5,
    "prospect_won": 50,
    "followup_done": 8,
    "attendance": 15,
    "challenge_completed": 100,
}

# Master badge catalog (seeded)
BADGE_CATALOG = [
    {"key": "first_step", "name": "First Step", "description": "Complete your first daily check-in.", "icon": "Sword", "req_type": "checkins", "req_value": 1, "xp_reward": 25, "tier": "bronze"},
    {"key": "streak_7", "name": "Warrior Week", "description": "Maintain a 7-day check-in streak.", "icon": "Fire", "req_type": "streak", "req_value": 7, "xp_reward": 75, "tier": "silver"},
    {"key": "streak_30", "name": "Spartan Iron", "description": "Maintain a 30-day check-in streak.", "icon": "Flame", "req_type": "streak", "req_value": 30, "xp_reward": 300, "tier": "gold"},
    {"key": "prospect_10", "name": "Hunter", "description": "Add 10 prospects.", "icon": "Target", "req_type": "prospects", "req_value": 10, "xp_reward": 50, "tier": "bronze"},
    {"key": "prospect_50", "name": "Elite Recruiter", "description": "Add 50 prospects.", "icon": "Crosshair", "req_type": "prospects", "req_value": 50, "xp_reward": 250, "tier": "silver"},
    {"key": "closer_5", "name": "Closer", "description": "Convert 5 prospects to won.", "icon": "Trophy", "req_type": "prospects_won", "req_value": 5, "xp_reward": 200, "tier": "gold"},
    {"key": "followup_25", "name": "Persistent", "description": "Complete 25 follow-ups.", "icon": "Phone", "req_type": "followups_done", "req_value": 25, "xp_reward": 100, "tier": "silver"},
    {"key": "attendance_10", "name": "Committed", "description": "Attend 10 events.", "icon": "Calendar", "req_type": "attendance", "req_value": 10, "xp_reward": 120, "tier": "silver"},
    {"key": "level_5", "name": "Rising Spartan", "description": "Reach level 5.", "icon": "Star", "req_type": "level", "req_value": 5, "xp_reward": 150, "tier": "silver"},
    {"key": "level_10", "name": "Battle Master", "description": "Reach level 10.", "icon": "ShieldStar", "req_type": "level", "req_value": 10, "xp_reward": 500, "tier": "gold"},
]


# ---------- Pydantic Models ----------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: EmailStr
    name: str
    role: str = "member"
    avatar_url: Optional[str] = None
    picture: Optional[str] = None
    xp: int = 0
    level: int = 1
    streak_current: int = 0
    streak_longest: int = 0
    last_checkin_date: Optional[str] = None
    team: Optional[str] = None
    badges: List[str] = []
    created_at: Optional[str] = None


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class ProspectIn(BaseModel):
    name: str
    contact: Optional[str] = None
    status: Literal["new", "contacted", "qualified", "won", "lost"] = "new"
    notes: Optional[str] = None
    source: Optional[str] = None


class ProspectUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    status: Optional[Literal["new", "contacted", "qualified", "won", "lost"]] = None
    notes: Optional[str] = None
    source: Optional[str] = None


class FollowUpIn(BaseModel):
    title: str
    due_date: str  # ISO date
    prospect_id: Optional[str] = None
    notes: Optional[str] = None


class FollowUpUpdate(BaseModel):
    status: Optional[Literal["pending", "done"]] = None
    title: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None


class AttendanceIn(BaseModel):
    event_name: str
    event_date: str  # ISO date
    event_type: Literal["meeting", "training", "webinar", "call"] = "meeting"
    notes: Optional[str] = None


class ChallengeIn(BaseModel):
    title: str
    description: str
    type: Literal["weekly", "monthly"] = "weekly"
    goal_type: Literal["checkins", "prospects", "followups", "attendance", "xp"]
    goal: int
    start_date: str
    end_date: str
    xp_reward: int = 100
    badge_reward: Optional[str] = None


class RoleUpdate(BaseModel):
    role: Literal["super_admin", "team_leader", "member"]


# ---------- Utility ----------
def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


async def award_xp(user_id: str, amount: int, reason: str):
    """Add XP, update level, check badges. Returns event summary."""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return None
    new_xp = int(user.get("xp", 0)) + int(amount)
    new_level = level_from_xp(new_xp)
    old_level = int(user.get("level", 1))
    await db.users.update_one({"user_id": user_id}, {"$set": {"xp": new_xp, "level": new_level}})
    await db.xp_events.insert_one({
        "event_id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    unlocked = await check_and_unlock_badges(user_id)
    leveled_up = new_level > old_level
    return {"xp": new_xp, "level": new_level, "leveled_up": leveled_up, "unlocked_badges": unlocked}


async def check_and_unlock_badges(user_id: str) -> list:
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        return []
    owned = set(user.get("badges", []))
    unlocked = []
    checkins = await db.checkins.count_documents({"user_id": user_id})
    prospects = await db.prospects.count_documents({"user_id": user_id})
    prospects_won = await db.prospects.count_documents({"user_id": user_id, "status": "won"})
    followups_done = await db.followups.count_documents({"user_id": user_id, "status": "done"})
    attendance = await db.attendance.count_documents({"user_id": user_id})
    for b in BADGE_CATALOG:
        if b["key"] in owned:
            continue
        cond = False
        rt = b["req_type"]
        if rt == "checkins":
            cond = checkins >= b["req_value"]
        elif rt == "streak":
            cond = user.get("streak_current", 0) >= b["req_value"]
        elif rt == "prospects":
            cond = prospects >= b["req_value"]
        elif rt == "prospects_won":
            cond = prospects_won >= b["req_value"]
        elif rt == "followups_done":
            cond = followups_done >= b["req_value"]
        elif rt == "attendance":
            cond = attendance >= b["req_value"]
        elif rt == "level":
            cond = user.get("level", 1) >= b["req_value"]
        if cond:
            await db.users.update_one({"user_id": user_id}, {"$addToSet": {"badges": b["key"]}, "$inc": {"xp": b["xp_reward"]}})
            await db.user_badges.insert_one({"user_id": user_id, "badge_key": b["key"], "unlocked_at": _iso(datetime.now(timezone.utc))})
            unlocked.append(b)
            owned.add(b["key"])
    if unlocked:
        u2 = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        await db.users.update_one({"user_id": user_id}, {"$set": {"level": level_from_xp(u2.get("xp", 0))}})
    return unlocked


# ---------- Auth Endpoints ----------
async def _login_lockout_check(identifier: str):
    doc = await db.login_attempts.find_one({"identifier": identifier})
    if doc and doc.get("locked_until"):
        lu = doc["locked_until"]
        if isinstance(lu, str):
            lu = datetime.fromisoformat(lu)
        if lu.tzinfo is None:
            lu = lu.replace(tzinfo=timezone.utc)
        if lu > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")


async def _login_record_failure(identifier: str):
    doc = await db.login_attempts.find_one({"identifier": identifier}) or {"identifier": identifier, "attempts": 0}
    attempts = doc.get("attempts", 0) + 1
    update = {"attempts": attempts, "identifier": identifier}
    if attempts >= 5:
        update["locked_until"] = _iso(datetime.now(timezone.utc) + timedelta(minutes=15))
        update["attempts"] = 0
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)


async def _login_clear(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


def _user_to_public(u: dict) -> dict:
    if not u:
        return u
    u.pop("password_hash", None)
    u.pop("_id", None)
    return u


@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    exists = await db.users.find_one({"email": email})
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "name": payload.name.strip(),
        "password_hash": hash_password(payload.password),
        "role": "member",
        "avatar_url": None,
        "picture": None,
        "xp": 0,
        "level": 1,
        "streak_current": 0,
        "streak_longest": 0,
        "last_checkin_date": None,
        "team": "Alpha",
        "badges": [],
        "created_at": _iso(datetime.now(timezone.utc)),
        "active": True,
    }
    await db.users.insert_one(doc)
    at = create_access_token(user_id, email)
    rt = create_refresh_token(user_id)
    set_auth_cookies(response, at, rt)
    return {"user": _user_to_public(doc), "access_token": at}


@api.post("/auth/login")
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.lower().strip()
    xff = request.headers.get("x-forwarded-for", "")
    ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "unknown")
    ident = f"{ip}:{email}"
    await _login_lockout_check(ident)
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(payload.password, user["password_hash"]):
        await _login_record_failure(ident)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await _login_clear(ident)
    at = create_access_token(user["user_id"], email)
    rt = create_refresh_token(user["user_id"])
    set_auth_cookies(response, at, rt)
    return {"user": _user_to_public(user), "access_token": at}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(request: Request):
    user = await get_current_user(request, db)
    return _user_to_public(user)


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(rt, get_jwt_secret(), algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        at = create_access_token(user["user_id"], user["email"])
        new_rt = create_refresh_token(user["user_id"])
        set_auth_cookies(response, at, new_rt)
        return {"ok": True}
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api.post("/auth/google-session")
async def google_session(payload: GoogleSessionIn, response: Response):
    """Exchange Emergent session_id for a stored session_token cookie."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": payload.session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google session")
        data = r.json()

    email = (data.get("email") or "").lower()
    name = data.get("name") or "Spartan"
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Incomplete Google session data")

    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id, "email": email, "name": name, "password_hash": None,
            "role": "member", "picture": picture, "avatar_url": picture,
            "xp": 0, "level": 1, "streak_current": 0, "streak_longest": 0,
            "last_checkin_date": None, "team": "Alpha", "badges": [],
            "created_at": _iso(datetime.now(timezone.utc)), "active": True,
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"email": email}, {"$set": {"picture": picture, "avatar_url": picture}})

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "expires_at": _iso(expires_at),
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    response.set_cookie(key="session_token", value=session_token,
                        httponly=True, secure=True, samesite="none",
                        max_age=7 * 24 * 3600, path="/")
    return {"user": _user_to_public(user)}


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    user = await get_current_user(request, db)
    uid = user["user_id"]
    today = date.today().isoformat()
    checked_today = await db.checkins.find_one({"user_id": uid, "date": today})
    prospects_count = await db.prospects.count_documents({"user_id": uid})
    prospects_won = await db.prospects.count_documents({"user_id": uid, "status": "won"})
    pending_followups = await db.followups.count_documents({"user_id": uid, "status": "pending"})
    total_attendance = await db.attendance.count_documents({"user_id": uid})
    active_challenges = await db.challenge_progress.count_documents({"user_id": uid, "completed": False})

    # weekly XP
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    weekly_xp_events = await db.xp_events.find({"user_id": uid, "created_at": {"$gte": week_start}}).to_list(1000)
    weekly_xp = sum(e.get("amount", 0) for e in weekly_xp_events)

    prog = xp_progress(user.get("xp", 0))
    return {
        "user": _user_to_public(user),
        **prog,
        "checked_in_today": bool(checked_today),
        "streak_current": user.get("streak_current", 0),
        "streak_longest": user.get("streak_longest", 0),
        "prospects_count": prospects_count,
        "prospects_won": prospects_won,
        "pending_followups": pending_followups,
        "total_attendance": total_attendance,
        "active_challenges": active_challenges,
        "weekly_xp": weekly_xp,
    }


@api.post("/checkins/daily")
async def daily_checkin(request: Request):
    user = await get_current_user(request, db)
    uid = user["user_id"]
    today = date.today()
    today_str = today.isoformat()
    exists = await db.checkins.find_one({"user_id": uid, "date": today_str})
    if exists:
        raise HTTPException(status_code=400, detail="Already checked in today")

    last = user.get("last_checkin_date")
    streak = user.get("streak_current", 0)
    longest = user.get("streak_longest", 0)
    if last:
        last_d = date.fromisoformat(last)
        delta_days = (today - last_d).days
        if delta_days == 1:
            streak += 1
        else:
            streak = 1
    else:
        streak = 1
    longest = max(longest, streak)

    await db.users.update_one({"user_id": uid}, {"$set": {
        "streak_current": streak, "streak_longest": longest, "last_checkin_date": today_str
    }})
    await db.checkins.insert_one({
        "checkin_id": str(uuid.uuid4()), "user_id": uid, "date": today_str,
        "xp_earned": XP_RULES["daily_checkin"],
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    result = await award_xp(uid, XP_RULES["daily_checkin"], "daily_checkin")
    await _update_challenge_progress(uid, "checkins", 1)
    return {"streak_current": streak, "streak_longest": longest, **(result or {})}


# ---------- Prospects ----------
def _clean(doc):
    doc.pop("_id", None)
    return doc


@api.get("/prospects")
async def list_prospects(request: Request):
    user = await get_current_user(request, db)
    items = await db.prospects.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/prospects")
async def add_prospect(payload: ProspectIn, request: Request):
    user = await get_current_user(request, db)
    doc = payload.model_dump()
    doc.update({
        "prospect_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "created_at": _iso(datetime.now(timezone.utc)),
        "updated_at": _iso(datetime.now(timezone.utc)),
    })
    await db.prospects.insert_one(doc)
    xp = await award_xp(user["user_id"], XP_RULES["prospect_added"], "prospect_added")
    await _update_challenge_progress(user["user_id"], "prospects", 1)
    return {"prospect": _clean(doc), "xp": xp}


@api.patch("/prospects/{pid}")
async def update_prospect(pid: str, payload: ProspectUpdate, request: Request):
    user = await get_current_user(request, db)
    existing = await db.prospects.find_one({"prospect_id": pid, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Prospect not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = _iso(datetime.now(timezone.utc))
    await db.prospects.update_one({"prospect_id": pid}, {"$set": updates})
    xp_event = None
    if updates.get("status") == "won" and existing.get("status") != "won":
        xp_event = await award_xp(user["user_id"], XP_RULES["prospect_won"], "prospect_won")
    updated = await db.prospects.find_one({"prospect_id": pid}, {"_id": 0})
    return {"prospect": updated, "xp": xp_event}


@api.delete("/prospects/{pid}")
async def delete_prospect(pid: str, request: Request):
    user = await get_current_user(request, db)
    r = await db.prospects.delete_one({"prospect_id": pid, "user_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    return {"ok": True}


# ---------- Follow-ups ----------
@api.get("/followups")
async def list_followups(request: Request):
    user = await get_current_user(request, db)
    items = await db.followups.find({"user_id": user["user_id"]}, {"_id": 0}).sort("due_date", 1).to_list(500)
    return items


@api.post("/followups")
async def add_followup(payload: FollowUpIn, request: Request):
    user = await get_current_user(request, db)
    doc = payload.model_dump()
    doc.update({
        "followup_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "status": "pending",
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    await db.followups.insert_one(doc)
    return _clean(doc)


@api.patch("/followups/{fid}")
async def update_followup(fid: str, payload: FollowUpUpdate, request: Request):
    user = await get_current_user(request, db)
    existing = await db.followups.find_one({"followup_id": fid, "user_id": user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.followups.update_one({"followup_id": fid}, {"$set": updates})
    xp_event = None
    if updates.get("status") == "done" and existing.get("status") != "done":
        xp_event = await award_xp(user["user_id"], XP_RULES["followup_done"], "followup_done")
        await _update_challenge_progress(user["user_id"], "followups", 1)
    updated = await db.followups.find_one({"followup_id": fid}, {"_id": 0})
    return {"followup": updated, "xp": xp_event}


@api.delete("/followups/{fid}")
async def delete_followup(fid: str, request: Request):
    user = await get_current_user(request, db)
    r = await db.followups.delete_one({"followup_id": fid, "user_id": user["user_id"]})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------- Attendance ----------
@api.get("/attendance")
async def list_attendance(request: Request):
    user = await get_current_user(request, db)
    items = await db.attendance.find({"user_id": user["user_id"]}, {"_id": 0}).sort("event_date", -1).to_list(500)
    return items


@api.post("/attendance")
async def add_attendance(payload: AttendanceIn, request: Request):
    user = await get_current_user(request, db)
    doc = payload.model_dump()
    doc.update({
        "attendance_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "xp_earned": XP_RULES["attendance"],
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    await db.attendance.insert_one(doc)
    xp = await award_xp(user["user_id"], XP_RULES["attendance"], "attendance")
    await _update_challenge_progress(user["user_id"], "attendance", 1)
    return {"attendance": _clean(doc), "xp": xp}


# ---------- Challenges ----------
@api.get("/challenges")
async def list_challenges(request: Request):
    user = await get_current_user(request, db)
    chs = await db.challenges.find({"end_date": {"$gte": date.today().isoformat()}}, {"_id": 0}).sort("start_date", 1).to_list(200)
    # Attach my progress
    progs = await db.challenge_progress.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    prog_by = {p["challenge_id"]: p for p in progs}
    for c in chs:
        p = prog_by.get(c["challenge_id"])
        c["joined"] = bool(p)
        c["progress"] = p["progress"] if p else 0
        c["completed"] = p["completed"] if p else False
    return chs


@api.post("/challenges")
async def create_challenge(payload: ChallengeIn, request: Request):
    user = await get_current_user(request, db)
    require_role(user, ["super_admin", "team_leader"])
    doc = payload.model_dump()
    doc.update({
        "challenge_id": str(uuid.uuid4()),
        "created_by": user["user_id"],
        "created_at": _iso(datetime.now(timezone.utc)),
    })
    await db.challenges.insert_one(doc)
    return _clean(doc)


@api.post("/challenges/{cid}/join")
async def join_challenge(cid: str, request: Request):
    user = await get_current_user(request, db)
    ch = await db.challenges.find_one({"challenge_id": cid}, {"_id": 0})
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    existing = await db.challenge_progress.find_one({"challenge_id": cid, "user_id": user["user_id"]})
    if existing:
        return {"ok": True, "already_joined": True}
    await db.challenge_progress.insert_one({
        "progress_id": str(uuid.uuid4()),
        "challenge_id": cid,
        "user_id": user["user_id"],
        "progress": 0,
        "completed": False,
        "joined_at": _iso(datetime.now(timezone.utc)),
    })
    return {"ok": True}


async def _update_challenge_progress(user_id: str, goal_type: str, inc: int):
    today = date.today().isoformat()
    chs = await db.challenges.find({
        "goal_type": goal_type,
        "start_date": {"$lte": today},
        "end_date": {"$gte": today},
    }, {"_id": 0}).to_list(100)
    for ch in chs:
        prog = await db.challenge_progress.find_one({"challenge_id": ch["challenge_id"], "user_id": user_id})
        if not prog:
            continue
        if prog.get("completed"):
            continue
        new_progress = prog.get("progress", 0) + inc
        completed = new_progress >= ch["goal"]
        await db.challenge_progress.update_one(
            {"progress_id": prog["progress_id"]},
            {"$set": {"progress": new_progress, "completed": completed,
                      "completed_at": _iso(datetime.now(timezone.utc)) if completed else None}}
        )
        if completed:
            await award_xp(user_id, ch.get("xp_reward", 100), f"challenge:{ch['challenge_id']}")
            if ch.get("badge_reward"):
                await db.users.update_one({"user_id": user_id}, {"$addToSet": {"badges": ch["badge_reward"]}})


# ---------- Leaderboard ----------
@api.get("/leaderboard")
async def leaderboard(request: Request, scope: str = "all", limit: int = 50):
    await get_current_user(request, db)  # auth check
    if scope == "weekly":
        since = _iso(datetime.now(timezone.utc) - timedelta(days=7))
        pipeline = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {"_id": "$user_id", "xp": {"$sum": "$amount"}}},
            {"$sort": {"xp": -1}},
            {"$limit": limit},
        ]
        rows = await db.xp_events.aggregate(pipeline).to_list(limit)
        user_ids = [r["_id"] for r in rows]
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(limit)
        u_by = {u["user_id"]: u for u in users}
        result = []
        for i, r in enumerate(rows):
            u = u_by.get(r["_id"])
            if not u:
                continue
            result.append({"rank": i + 1, "user_id": u["user_id"], "name": u["name"],
                           "avatar_url": u.get("avatar_url") or u.get("picture"),
                           "team": u.get("team"), "xp": r["xp"], "level": u.get("level", 1),
                           "streak_current": u.get("streak_current", 0)})
        return result
    elif scope == "monthly":
        since = _iso(datetime.now(timezone.utc) - timedelta(days=30))
        pipeline = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {"_id": "$user_id", "xp": {"$sum": "$amount"}}},
            {"$sort": {"xp": -1}},
            {"$limit": limit},
        ]
        rows = await db.xp_events.aggregate(pipeline).to_list(limit)
        user_ids = [r["_id"] for r in rows]
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(limit)
        u_by = {u["user_id"]: u for u in users}
        result = []
        for i, r in enumerate(rows):
            u = u_by.get(r["_id"])
            if not u:
                continue
            result.append({"rank": i + 1, "user_id": u["user_id"], "name": u["name"],
                           "avatar_url": u.get("avatar_url") or u.get("picture"),
                           "team": u.get("team"), "xp": r["xp"], "level": u.get("level", 1),
                           "streak_current": u.get("streak_current", 0)})
        return result
    else:
        users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("xp", -1).limit(limit).to_list(limit)
        return [{"rank": i + 1, "user_id": u["user_id"], "name": u["name"],
                 "avatar_url": u.get("avatar_url") or u.get("picture"),
                 "team": u.get("team"), "xp": u.get("xp", 0), "level": u.get("level", 1),
                 "streak_current": u.get("streak_current", 0)}
                for i, u in enumerate(users)]


@api.get("/leaderboard/teams")
async def team_leaderboard(request: Request):
    await get_current_user(request, db)
    pipeline = [
        {"$group": {"_id": "$team", "xp": {"$sum": "$xp"}, "members": {"$sum": 1}}},
        {"$sort": {"xp": -1}},
    ]
    rows = await db.users.aggregate(pipeline).to_list(50)
    return [{"rank": i + 1, "team": r["_id"] or "Unassigned", "xp": r["xp"], "members": r["members"]}
            for i, r in enumerate(rows)]


# ---------- Badges ----------
@api.get("/badges")
async def list_badges(request: Request):
    user = await get_current_user(request, db)
    owned = set(user.get("badges", []))
    return [{**b, "unlocked": b["key"] in owned} for b in BADGE_CATALOG]


# ---------- Admin ----------
@api.get("/admin/users")
async def admin_users(request: Request):
    user = await get_current_user(request, db)
    require_role(user, ["super_admin", "team_leader"])
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("xp", -1).to_list(1000)
    return users


@api.patch("/admin/users/{uid}/role")
async def admin_update_role(uid: str, payload: RoleUpdate, request: Request):
    user = await get_current_user(request, db)
    require_role(user, ["super_admin"])
    r = await db.users.update_one({"user_id": uid}, {"$set": {"role": payload.role}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@api.get("/admin/analytics")
async def admin_analytics(request: Request):
    user = await get_current_user(request, db)
    require_role(user, ["super_admin", "team_leader"])
    total_users = await db.users.count_documents({})
    total_prospects = await db.prospects.count_documents({})
    total_won = await db.prospects.count_documents({"status": "won"})
    total_attendance = await db.attendance.count_documents({})
    total_checkins = await db.checkins.count_documents({})
    active_today = await db.checkins.count_documents({"date": date.today().isoformat()})
    since = _iso(datetime.now(timezone.utc) - timedelta(days=7))
    weekly = await db.xp_events.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": None, "xp": {"$sum": "$amount"}}},
    ]).to_list(1)
    weekly_xp = weekly[0]["xp"] if weekly else 0
    return {
        "total_users": total_users, "total_prospects": total_prospects, "total_won": total_won,
        "total_attendance": total_attendance, "total_checkins": total_checkins,
        "active_today": active_today, "weekly_xp": weekly_xp,
        "conversion_rate": round((total_won / total_prospects) * 100, 1) if total_prospects else 0.0,
    }


@api.get("/")
async def root():
    return {"message": "Spartans Growth League API", "version": "1.0"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup ----------
async def seed_admin_and_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index([("xp", -1)])
    await db.checkins.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.prospects.create_index([("user_id", 1), ("status", 1)])
    await db.followups.create_index([("user_id", 1), ("due_date", 1)])
    await db.attendance.create_index([("user_id", 1), ("event_date", -1)])
    await db.challenges.create_index([("start_date", 1), ("end_date", 1)])
    await db.challenge_progress.create_index([("user_id", 1), ("challenge_id", 1)], unique=True)
    await db.xp_events.create_index([("user_id", 1), ("created_at", -1)])
    await db.user_sessions.create_index("session_token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")

    async def upsert_seed_user(email, password, name, role, team):
        existing = await db.users.find_one({"email": email})
        if existing is None:
            await db.users.insert_one({
                "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": name,
                "password_hash": hash_password(password), "role": role,
                "avatar_url": None, "picture": None, "xp": 0, "level": 1,
                "streak_current": 0, "streak_longest": 0, "last_checkin_date": None,
                "team": team, "badges": [],
                "created_at": _iso(datetime.now(timezone.utc)), "active": True,
            })
        else:
            updates = {"role": role, "name": name}
            if not existing.get("password_hash") or not verify_password(password, existing["password_hash"]):
                updates["password_hash"] = hash_password(password)
            await db.users.update_one({"email": email}, {"$set": updates})

    await upsert_seed_user(os.environ.get("ADMIN_EMAIL", "admin@spartans.com"),
                           os.environ.get("ADMIN_PASSWORD", "Spartan123!"),
                           "Spartan Commander", "super_admin", "Command")
    await upsert_seed_user("leader@spartans.com", "Leader123!", "Team Leader Leonidas", "team_leader", "Alpha")
    await upsert_seed_user("member@spartans.com", "Member123!", "Spartan Recruit", "member", "Alpha")

    # Seed a few demo members if we have very few users
    users_count = await db.users.count_documents({})
    if users_count < 10:
        demo_names = [
            ("achilles@spartans.com", "Achilles Warrior", "Alpha", 3200, 12, 5),
            ("hector@spartans.com", "Hector Steel", "Bravo", 2400, 6, 8),
            ("odysseus@spartans.com", "Odysseus Sharp", "Bravo", 4100, 9, 15),
            ("ajax@spartans.com", "Ajax Storm", "Alpha", 1800, 4, 3),
            ("perseus@spartans.com", "Perseus Blade", "Delta", 5600, 21, 20),
            ("theseus@spartans.com", "Theseus Bold", "Delta", 2900, 7, 6),
            ("jason@spartans.com", "Jason Vault", "Bravo", 1250, 3, 2),
        ]
        for email, name, team, xp, streak, checkins in demo_names:
            if await db.users.find_one({"email": email}):
                continue
            uid = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id": uid, "email": email, "name": name,
                "password_hash": hash_password("Demo123!"), "role": "member",
                "avatar_url": None, "picture": None, "xp": xp, "level": level_from_xp(xp),
                "streak_current": streak, "streak_longest": streak, "last_checkin_date": None,
                "team": team, "badges": [],
                "created_at": _iso(datetime.now(timezone.utc)), "active": True,
            })
            # Seed some xp events distributed across last month
            for d in range(checkins):
                dt = datetime.now(timezone.utc) - timedelta(days=d)
                await db.xp_events.insert_one({
                    "event_id": str(uuid.uuid4()), "user_id": uid,
                    "amount": xp // max(1, checkins), "reason": "seed",
                    "created_at": _iso(dt),
                })

    # Seed a couple of demo challenges if empty
    ch_count = await db.challenges.count_documents({})
    if ch_count == 0:
        today = date.today()
        await db.challenges.insert_many([
            {"challenge_id": str(uuid.uuid4()),
             "title": "Weekly Warrior", "description": "Check in 5 days this week to earn massive XP.",
             "type": "weekly", "goal_type": "checkins", "goal": 5,
             "start_date": today.isoformat(), "end_date": (today + timedelta(days=7)).isoformat(),
             "xp_reward": 150, "badge_reward": None,
             "created_by": "system", "created_at": _iso(datetime.now(timezone.utc))},
            {"challenge_id": str(uuid.uuid4()),
             "title": "Prospect Blitz", "description": "Add 10 new prospects this week.",
             "type": "weekly", "goal_type": "prospects", "goal": 10,
             "start_date": today.isoformat(), "end_date": (today + timedelta(days=7)).isoformat(),
             "xp_reward": 200, "badge_reward": None,
             "created_by": "system", "created_at": _iso(datetime.now(timezone.utc))},
            {"challenge_id": str(uuid.uuid4()),
             "title": "Monthly Momentum", "description": "Complete 20 follow-ups in 30 days.",
             "type": "monthly", "goal_type": "followups", "goal": 20,
             "start_date": today.isoformat(), "end_date": (today + timedelta(days=30)).isoformat(),
             "xp_reward": 500, "badge_reward": None,
             "created_by": "system", "created_at": _iso(datetime.now(timezone.utc))},
        ])


@app.on_event("startup")
async def on_startup():
    try:
        await seed_admin_and_indexes()
        logger.info("Startup: seeded admin, users, challenges & indexes")
    except Exception as e:
        logger.exception("Startup seed error: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
