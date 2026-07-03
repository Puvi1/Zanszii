# Auth Testing Playbook (JWT + Emergent Google OAuth)

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "super_admin"}).pretty()
db.users.getIndexes()
db.user_sessions.getIndexes()
```
Verify:
- bcrypt hash starts with `$2b$`
- users.email unique index exists
- login_attempts.identifier index exists
- password_reset_tokens.expires_at TTL index exists

## Step 2: JWT API Testing
```
# Login (email/password)
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@spartans.com","password":"Spartan123!"}'

cat cookies.txt

curl -b cookies.txt http://localhost:8001/api/auth/me
```

Expected:
- Login sets `access_token` + `refresh_token` cookies
- `/api/auth/me` returns user object
- Failed login (5x) triggers 15-min lockout

## Step 3: Emergent Google OAuth Testing
- Frontend redirects to `https://auth.emergentagent.com/?redirect=<origin>/auth/callback`
- Google callback lands at `<origin>/auth/callback#session_id=<id>`
- Frontend AuthCallback POSTs `{session_id}` to `/api/auth/google-session`
- Backend calls `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` with `X-Session-ID` header
- Backend upserts user by email, sets `session_token` httpOnly cookie
- `/api/auth/me` accepts either `access_token` (JWT) OR `session_token` (Google)

## Test Credentials
Super Admin:
- email: admin@spartans.com
- password: Spartan123!
- role: super_admin

Team Leader:
- email: leader@spartans.com
- password: Leader123!
- role: team_leader

Member:
- email: member@spartans.com
- password: Member123!
- role: member

## Endpoints
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/refresh
POST   /api/auth/google-session
GET    /api/dashboard/stats
POST   /api/checkins/daily
GET    /api/prospects
POST   /api/prospects
PATCH  /api/prospects/{id}
DELETE /api/prospects/{id}
GET    /api/followups
POST   /api/followups
PATCH  /api/followups/{id}
GET    /api/attendance
POST   /api/attendance
GET    /api/challenges
POST   /api/challenges (leader/admin)
POST   /api/challenges/{id}/join
POST   /api/challenges/{id}/progress
GET    /api/leaderboard?scope=weekly|monthly|all
GET    /api/badges
GET    /api/admin/users (admin)
PATCH  /api/admin/users/{id}/role (admin)
GET    /api/admin/analytics (admin)
