# SPARTANS GROWTH LEAGUE — PRD

## Problem Statement
Gamified performance tracking & accountability platform for a Crypto Network Marketing team. Feels like Duolingo + Habitica + modern CRM. Premium Black + Gold + Blue aesthetic, mobile-first, dark theme, glass UI, confetti on achievements, smooth animations.

## Stack
- **Backend**: FastAPI + MongoDB (motor)
- **Frontend**: React 19 + Tailwind + Framer Motion + Shadcn UI + Phosphor icons + canvas-confetti
- **Auth**: JWT (email/password, bcrypt) + Emergent Google OAuth

## User Personas
- **Super Admin** — Manages all users + teams + all reports + leaderboards
- **Team Leader** — Views only their team + member performance + team reports
- **Member** — Submits missions (check-in, prospects, follow-ups, attendance) + own dashboard + own reports + own leaderboard

## Core Requirements (Static)
- Scale to thousands of members
- Mobile-first responsive
- No placeholder pages
- Reusable components
- Modern professional animations
- Dark theme

## What's Been Implemented (Feb 2026)

### Auth
- JWT email/password with bcrypt hashing, cookies (httpOnly, samesite=none) + Bearer fallback
- Emergent Google OAuth session exchange
- Brute-force lockout (5 fail → 15 min, using X-Forwarded-For)
- Roles: super_admin, team_leader, member

### Gamification
- Daily check-ins with streaks (current + longest)
- XP system (10/check-in, 5/prospect, 50/won, 8/followup done, 15/attendance)
- Level formula: `floor(sqrt(xp/100)) + 1`
- 10-badge catalog with auto-unlock on milestones (streak, prospects, wins, level, etc.)
- Confetti on check-in, wins, achievements
- Individual + team leaderboards (weekly, monthly, all-time) with podium

### CRM / Missions
- Prospects CRUD with pipeline stages (new/contacted/qualified/won/lost)
- Follow-ups with urgency indicators (overdue/today/soon/upcoming)
- Attendance tracker (meeting/training/webinar/call)

### Challenges
- Weekly + monthly challenges with auto-progress tracking
- Team leaders + super admins can create challenges
- XP rewards on completion

### Role Management System (Complete)
- **Teams** collection (super_admin CRUD): create, rename, assign leader, add/remove members, delete
- **/my-team** (team_leader only): full team overview + squad breakdown
- **/reports** (adaptive): Personal (all), Team (leader+admin), Global (admin only)
- Reports include 14-day XP timeline, per-user stats, conversion rates, team standings
- Role-aware sidebar navigation (BASE_NAV + LEADER/ADMIN extras)
- Route guards via ProtectedRoute (roles=[...])
- Team-scoped /admin/users and /admin/analytics for team_leader
- Leaderboard `?team_id=` filter for team-scoped rankings

### Test Coverage
- Backend: 29/29 role mgmt + 24/25 core = 53/54 pass (98%)
- Frontend: 21/21 role mgmt + 15/15 core = 36/36 (100%)

## Backlog / Next Actions
- **P1**: Team invitation links / bulk import
- **P1**: Password reset UI (backend endpoint exists)
- **P2**: Push notifications for pending follow-ups
- **P2**: CSV export of team reports
- **P2**: Aggregate DB queries for reports (currently N+1)
- **P2**: Team leader ability to create challenges scoped to their team only
- **P3**: Direct messages / team chat
- **P3**: Custom badge creation UI for super admin

## Daily Mission System (Feb 2026)

### Implemented
- **New collection**: `missions` (mission_id UUID unique, user_id, prospect_name, mobile_number, notes, status, lat, lng, google_maps_url, accuracy, photo_data base64, created_at, updated_at)
- **Indexes**: `mission_id` unique + `(user_id, created_at desc)` compound
- **XP Rules**: `mission_logged: +10`, `mission_converted: +40` (PATCH new→converted adds +30 delta)
- **Endpoints**:
  - `GET /api/missions` — user's mission list (owner-scoped)
  - `POST /api/missions` — create, auto-generate google_maps_url from lat/lng, awards XP, auto-progress prospect challenges
  - `PATCH /api/missions/{id}` — status/notes update; XP delta on conversion
  - `DELETE /api/missions/{id}` — owner-only, 404 for others (data isolation verified)
- **Photo storage**: base64 data URL inline in MongoDB, 1.5MB limit (returns 413 if exceeded), client-side JPEG compression to ≤1200px @ 0.72 quality
- **Frontend**:
  - `/missions` page with 4-way filter chips (All/New/Follow-up/Converted)
  - **Live GPS capture** via navigator.geolocation with accuracy display + refresh button + Google Maps preview link
  - **Camera capture** via `<input type=file accept="image/*" capture="environment">` for direct mobile camera
  - Card grid history (3 col desktop / 2 tablet / 1 mobile) with photo thumbnail, status chip, GPS badge, phone tap-to-call, map link, inline status edit, delete
  - Detail modal on card click showing full photo + all fields
  - Added to sidebar nav (Crosshair icon) + mobile bottom nav (2nd slot)

### Test Results
- Backend: 13/13 mission tests passing (after index fix)
- Frontend: verified via screenshot (missions page + modal render correctly, GPS permission flow works)

## Weekly + Season Attendance + Believer + Tasks (Feb 2026)

### Collections
- `weekly_events` — event_id UUID unique, name, weekday (0-6), is_believer bool, active
- `event_attendance` — compound unique (user_id, event_id, event_date). Fields: status (present|absent|na), season_id (nullable), locked (computed)
- `seasons` — season_id, name, start_date, end_date, is_believer, created_by
- `tasks` — task_id unique, assigned_to+due_date compound, title, description, xp_reward, status (pending|completed), completed_at

### Auto-Lock (Critical)
- Timezone: **IST (Asia/Kolkata)**, cutoff **8:00 AM** on event day
- `_is_locked(event_date)` returns True once `now_ist >= combine(event_date, 08:00, IST)`
- Backend rejects `POST /event-attendance/mark` with 403 when locked

### Seeded Defaults (on startup if empty)
- Tuesday — Believer Season Meeting (is_believer=true)
- Thursday — MCM (Meta Champion Meet)
- Saturday — Spartans Team Meeting

### Endpoints
- `GET /api/weekly-events` (auth)
- `POST/PATCH/DELETE /api/weekly-events[/<id>]` (super_admin)
- `GET /api/event-attendance/week?week_of=YYYY-MM-DD`
- `POST /api/event-attendance/mark` — upsert on (user, event, date), auto-season assignment
- `GET/POST/DELETE /api/seasons[/<id>]` (create/delete super_admin only)
- `GET /api/seasons/{id}/my-report` — personal attendance stats + per-event breakdown + attendance_pct
- `GET /api/seasons/{id}/team-report` — team_leader (own team) or super_admin (all users; believer season scopes to is_believer=true users)
- `PATCH /api/admin/users/{uid}/believer` (super_admin)
- `GET /api/tasks` (own) or `?all_users=true` (super_admin)
- `POST /api/tasks` (super_admin)
- `PATCH /api/tasks/{id}/complete` (assignee or super_admin) — awards XP
- `DELETE /api/tasks/{id}` (super_admin)

### Believer Module
- `user.is_believer` boolean flag (super_admin toggle)
- Believer seasons filter events to weekday=1 (Tuesday) only in `_compute_report`
- Team-report for believer season only counts `is_believer=true` users

### Frontend Pages
- `/weekly-attendance` — week nav, 3 event cards, colored borders on marked status, LOCKED/OPEN chips, 8 AM IST notice
- `/seasons` — All/Regular/Believer filter, card grid, admin create modal (name/dates/believer toggle), tap-to-open report modal with % + progress bar + per-event breakdown
- `/tasks` — Mine/All toggle (admin), Assign Task modal (admin), pending list with Complete button (assignee), Recently Crushed archive

### Attendance Percentage Formula
`attendance_pct = present / (present + absent) * 100` — NA and unmarked excluded from denominator

### Test Coverage
- Backend: **30/30** (100%) — /app/backend/tests/test_weekly_attendance.py
- Frontend: **30/30** (100%) across all 3 roles + mobile responsive at 375x812

## Team League + Reward Store + Profile Completion + Report Exports (Feb 2026)

### Team League
- `GET /api/team-league` returns ranked teams with: xp, weekly_xp, monthly_xp, weekly_attendance_pct, monthly_attendance_pct, attendance_bonus_xp, streak, members
- **Attendance → Bonus XP** table: 100%→50, 90%→40, 80%→30, 70%→20, 60%→10, <60%→0
- Rank sorted by (monthly_attendance_pct + xp/1000) desc
- SPARTANS team seeded alongside Alpha/Bravo/Command/Delta
- Frontend `/team-league` page with tier table, ranked team rows, per-team attendance bars, "Your team" indicator

### Reward Store (2 new collections)
- `rewards` — reward_id, name, description, cost_xp, category (dinner/movie/outing/voucher/other), stock, image_url, active, created_by
- `redemptions` — redemption_id, user_id, user_name, reward_id, reward_name, cost_xp, status (pending/fulfilled), fulfilled_at, fulfilled_by
- 4 default rewards seeded: Team Dinner Voucher (300), Movie Ticket (500), Team Outing Pass (1500), Amazon Gift Voucher ₹500 (2000)
- Endpoints:
  - `GET/POST/PATCH/DELETE /api/rewards[/<id>]` (super_admin for mutations)
  - `POST /api/rewards/{id}/redeem` (member) — checks XP, deducts, decrements stock, logs xp_events(-cost_xp), creates pending redemption
  - `GET /api/redemptions` (own) / `?all_users=true` (admin)
  - `PATCH /api/redemptions/{id}/fulfill` (super_admin)
- Frontend `/rewards` page with Store/My Redemptions/All Redemptions tabs, category-themed cards, XP balance chip, admin CRUD modal

### Profile Completion
- Fields tracked: name, email, avatar_url, team_id, phone, bio (6 total)
- Backend `GET /api/profile/completion` returns filled/total/pct/missing/completion_xp_awarded
- Backend `PATCH /api/profile` updates {phone, bio, avatar_url}; awards one-time +50 XP when reaching 100% (idempotent via profile_completed_awarded flag)
- Frontend widget in Profile page: progress bar, missing-field chips, Edit form with confetti + toast on completion

### Report Exports (CSV + PDF)
- Dependencies added: `reportlab==5.0.0`, `openpyxl==3.1.5` (in requirements.txt)
- Endpoints (all require super_admin or team_leader):
  - `GET /api/exports/team-performance?format=csv|pdf`
  - `GET /api/exports/attendance?season_id=...&format=csv|pdf`
  - `GET /api/exports/xp-leaderboard?scope=weekly|monthly|all&format=csv|pdf`
  - `GET /api/exports/daily?day=YYYY-MM-DD&format=csv|pdf`
- CSV: `StreamingResponse` with proper `Content-Disposition`, Excel-compatible
- PDF: reportlab landscape A4, branded header, striped table rows, gold header row
- Frontend: `ExportBar` component in Reports page (visible to admin/leader only) with Excel/CSV + PDF buttons that trigger browser download

### Test Coverage
- Backend: **18/18** (100%) — attendance bonus formula, redeem XP deduction, insufficient XP 400, stock=0 400, admin-only mutations, PDF/CSV Content-Type checks, profile completion idempotency
- Frontend: **14/14** (100%) — sidebar nav, role visibility, admin CRUD flow, member redeem UI, export downloads, mobile responsive

## Member Profile System — Expanded (Feb 2026)

### New User Fields
**Basic**: dob, gender, marital_status, anniversary_date, anniversary_photo, city, state
**Business**: joining_date, club_type (decider/believer/converter/builder), position
**Personal**: favourite_food, favourite_place, favourite_hobby
(existing: name, email, phone, avatar_url, bio, team, team_id, is_believer)

### Registration
- `RegisterIn` accepts optional: phone, dob, gender, city, state
- All fields persist on user document immediately

### Profile Editing
- `PATCH /api/profile` accepts all 16+ fields (see ProfileUpdate)
- Pydantic enum validation for club_type / marital_status / gender (422 on invalid)
- One-time +50 XP when all 16 completion fields filled (idempotent)
- Frontend Profile page has 3-section edit form: Basic Info / Business / Personal Favourites; DetailRow display cards for view mode; anniversary photo displayed as image

### Celebrations
- `GET /api/celebrations/me` — is_birthday, is_anniversary (only if married)
- `GET /api/celebrations/today` — global list of all users with birthday/anniversary today
- Match logic: MM-DD comparison, timezone-independent
- Frontend `CelebrationBanner` component (rendered on Dashboard): fetches celebrations/today, fires big confetti on mount, localStorage-dismissible per day, shows warriors with birthday cake or heart icon in themed gradient card

### Test Coverage
- Backend: **11/11** (100%) — registration new fields, PATCH accepts all fields, enum 422 rejection, celebrations logic (birthday vs anniversary, married check), 16-field completion pct

## Refactor + PWA (Feb 2026)

### Simplified Signup Flow
- Register form reduced to **4 fields**: Full Name, Email, Password, Mobile Number
- All richer fields (DOB, gender, city, state, club, etc.) moved to Profile page

### Force Profile Completion
- New guard in `ProtectedRoute.jsx`: `REQUIRED_PROFILE_FIELDS = [dob, gender, marital_status, city, state, club_type]`
- Users missing any of these are auto-redirected to `/profile` with `first_time: true` state
- Profile page shows a **welcome banner** for first-time users, auto-opens the Edit form

### Team Self-Selection
- New endpoint `GET /api/teams/public` (any auth user) returns id+name of all teams
- New endpoint `POST /api/profile/join-team?team_id=<id>` (any auth user) — self-assigns to a team
- Team dropdown added to Profile edit form's Basic Info section

### Club-Based Nav Hiding
- `navForRole(role, club_type)` in `AppLayout.jsx` filters BASE_NAV
- Items marked `requiresSeasonAccess: true` are hidden when `club_type === "decider"`
- Currently hides `/seasons` for Deciders — matching spec

### Nav Cleanup
- Renamed sidebar labels: `Weekly` → `Attendance`, `Leaderboard` → `League`
- Removed duplicate `Attendance` route (was for XP-event logging; the meaningful attendance is now the weekly attendance system)

### PWA Support
- `/app/frontend/public/manifest.json` — Spartans branding, theme_color #EAB308, standalone display, portrait orientation
- `/app/frontend/public/service-worker.js` — CACHE_NAME=sgl-v1, network-first for `/api/`, network-first for navigations with cache fallback for offline, cache-first for static assets
- Registered in `index.js` on `window.load`
- Meta tags added to `index.html`: theme-color, apple-mobile-web-app-capable, status-bar-style

### Test Coverage
- Backend: **5/5** (100%) — minimal register, `/teams/public` auth+listing, `/profile/join-team` happy+404
- Frontend: **20/20** (100%) — simplified form, first-time redirect, admin bypass, team selector, sidebar labels, decider hides Seasons, PWA manifest/SW served + registered

---

## Iteration 12 — Feb 2026 (Spartans League v2 batch)

**Completed:**
- Phase 1 — Verify & Finish In-Progress Work:
  - Removed old "Current Position" text input from Profile edit form; replaced by admin-controlled Position Badges chip on Profile & Dashboard headers.
  - Dropped `position` from PROFILE_FIELDS (completion now 15 fields).
  - New MyTeam page with Recruit Warrior modal (backend `POST /api/team-leader/add-member`), Search input, Sort dropdown, PositionBadges next to member names.
- Phase 2 — Spartans League System (P0):
  - Backend endpoints: `/api/spartans-league/active-season`, `/api/spartans-league/individual`, `/api/spartans-league/team` (formula 40% XP + 25% Attendance + 15% Missions + 10% Tasks + 10% Goals, all scoped to season).
  - New `/spartans-league` page with 3 tabs (Individual / Team / Season) and podium, breakdown expander per team, season selector.
  - Consolidated old `/leaderboard` and `/team-league` nav into single "Spartans League" entry.
- Phase 3 — Admin Dashboard Widgets (P1):
  - Backend `/api/admin/dashboard-widgets` returns missions_today, missions_converted_today, pending_tasks, overdue_tasks, top_individual, top_team, season_champion, upcoming_birthdays (14d), upcoming_anniversaries (14d).
  - Admin.jsx renders 6 widget cards (ActivityCard, ChampionCard x3, UpcomingCard x2) plus improved roster with position-badges column and modal editor.
- Phase 4 — Unified Reports & Export Center (P1):
  - New backend exports: `/api/exports/missions`, `/tasks`, `/goals`, `/followups`, `/spartans-league?scope=individual|team` (CSV + PDF).
  - Reports.jsx now has "Report Export Center" section with 11 report types (each with CSV + PDF buttons).
- Phase 5 — Team Members Enhancements (P2): Search + Sort in MyTeam.jsx.

**Seed data improvements:** Leader/Member/Admin seed users now have complete profiles (phone, dob, gender, marital_status, city, state, club_type, joining_date) so ProtectedRoute doesn't block on fresh sessions.

**Testing:** iteration_12.json — 24/24 backend pytest PASS, all critical frontend flows verified including mobile 390x844 responsiveness.

**Next backlog:**
- P1: Season history archive (auto-snapshot standings when season ends).
- P2: Export button next to each Admin widget for granular CSV/PDF snapshots.
- P2: Email/SMS notifications for birthdays/anniversaries.

---

## Iteration 13 — Feb 2026 (Massive Refactor v3)

**Delivered (5 phases, all tested — 39/39 backend + frontend flows):**

### Phase A — Auth + Rename + Validation
- **Nexus ID (Business Centre)** required on signup (free-text, uppercase, min 3 chars). Displayed on Profile header + Admin roster; editable in Profile form.
- Renamed navigation label "Missions" → "Daily Missions" everywhere.
- Removed URL text inputs for profile photo & anniversary photo (per new rule: images only via upload).

### Phase B — Attendance Gating + Admin CRUD
- **Attendance now hides future meeting sessions** for non-admin users; POST `/event-attendance/mark` returns 403 for future or past dates.
- **Admin user management**: PATCH/DELETE `/admin/users/{uid}` — edit name/team/role, delete with cascade (goals, prospects, followups, missions, tasks, xp_events, attendance, redemptions, user_business, files).
- **Teams CRUD**: POST/PATCH/DELETE `/admin/teams` — create, rename (cascades to members), reassign leader, delete (blocked if members exist).
- Admin panel: Edit/Delete icon buttons per row + Edit User modal.

### Phase C — Season PV/Earnings + Follow-up Time Slot + Notifications
- Season model now has `total_pv` + `total_earnings` (super_admin only). Displayed on SeasonCards + business-totals endpoint. Per-user business entries via `POST /admin/users/{uid}/business`.
- Follow-ups now support `time_slot` ("8-10am" / "10-12pm" / "2-4pm" / "6-8pm").
- Follow-Ups page split into **Pending / Overdue / Completed** tabs.
- **In-app NotificationBell** with red badge — pulls `/notifications` every 60 s and shows overdue follow-ups, follow-ups due today, pending weekly/monthly goals, overdue tasks.

### Phase D — Object Storage + League Enrichment + Season Archive
- **Emergent Object Storage integration**: `POST /uploads/avatar` (multipart, ≤ 2 MB, image MIME only) + `GET /files/{id}?auth=<token>` (query-token for `<img>` tags).
- New `<Avatar>` + `<AvatarUploader>` components — used across Profile hero, Spartans League podium & rows, Team League leader, Admin roster.
- **Spartans League** now returns club_type, nexus_id, avatar_url, position_badges (individual) + leader_name, leader_avatar_url, leader_badges, mission_pct (team).
- **Season history archive**: `POST /admin/seasons/{id}/finalize` snapshots individual + team standings + business ledger permanently; retrievable via `/season-history` list & `/season-history/{id}`.

### Phase E — Final polish
- **Seed data wipe**: removed demo users (Achilles, Hector, etc.), demo challenges & demo rewards from `on_startup`. Only super_admin remains as a seeded user.
- New `POST /admin/wipe-demo-data` endpoint for on-demand cleanup (nukes 14 collections + non-admin users).
- Fixed `/season/business-totals` to correctly treat admin-set 0 (was ignored as falsy).
- Updated `test_credentials.md` reflecting the post-wipe state (only admin remains).

**Files changed / created (this iteration):**
- Backend: `/app/backend/server.py` (grew ~700 LOC — models, storage, admin CRUD, notifications, archive, wipe).
- Frontend: `AppLayout.jsx`, `Profile.jsx`, `AuthPage.jsx`, `Admin.jsx`, `Seasons.jsx`, `FollowUps.jsx`, `SpartansLeague.jsx`.
- New components: `Avatar.jsx`, `AvatarUploader.jsx`, `NotificationBell.jsx`.
- Tests: `/app/backend/tests/test_feb2026_refactor.py` (39 cases).

**Known backlog (P2/P3, non-blocking):**
- Modularize `server.py` into routers (auth/admin/attendance/storage/…).
- Sniff image magic bytes on upload (defense-in-depth).
- Short-lived signed URLs instead of `?auth=<jwt>` on file downloads.
- Replace HTML5 date inputs on Seasons modal with shadcn `<Calendar>` for UI consistency.
- Optional external notification channels (email, WhatsApp) — currently in-app only.

---

## Iteration 14 — Feb 2026 (Goal Settings + Avatar Rollout)

**Delivered:**
- **Goal Settings page (`/goal-settings`)** — super_admin-only.
  - Admin CRUD for weekly & monthly goal templates (Title, Target, XP Reward, Start Date, End Date, Active).
  - Creating a template auto-populates a matching goal for every active member (via `_sync_template_to_users`).
  - New sign-ups (register + team-leader/add-member) automatically inherit all active templates.
  - Per-template stats: Templates / Active / Assigned / Completed. Re-sync + Edit + Delete + Status toggle in-line.
  - Editing metadata cascades to open user goals; completed history preserved on delete.
  - User Goals page marks HQ-assigned goals with "HQ ASSIGNED" chip and hides the delete button.
  - Backend: `DELETE /api/goals/{gid}` returns 403 if the goal is admin-assigned.
- **Avatar consistency pass:**
  - `<Avatar>` (which routes `/api/files/<id>?auth=<token>` via localStorage token) is now used everywhere: Dashboard hero + Top Warriors, Sidebar user chip, Teams roster, MyTeam member table, CelebrationBanner (birthday & anniversary chips), Admin roster, Spartans League podium + rows + team leader.
  - Backend `/reports/team` now returns `avatar_url` + `position_badges` per member so the roster renders full photos.
  - No user-visible surface still shows a bare "initial in a gradient circle" — the fallback is inside `<Avatar>` itself when `avatar_url` / `picture` is null.

**Bug fixed (found by testing agent iteration_14):**
- `DELETE /api/goals/{gid}` was returning 404 for personal (non-admin) goals due to `if not g:` on a projection that returned an empty dict when `assigned_by_admin` field was absent. Changed to `if g is None:`. Verified with live curl (`created … status=200`).

**Testing status:** iteration_14 → 14/15 backend PASS + all critical frontend flows verified; the 1 fail (delete personal goal) was the projection bug now fixed. Retest via `testing_agent_v3` recommended before next feature drop.

**Next backlog:**
- P2: Modularize `server.py` into routers.
- P2: Short-lived signed URLs for `/api/files/<id>`.
- P2: Move ProtectedRoute profile-completion check AFTER role redirect so `/goal-settings` non-admin visitor lands on `/goals` even when their profile is incomplete.
