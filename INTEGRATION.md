# Backend integration (branch `feature/backend-integration`)

The UI is being connected to the NexusCore backend (`PostBank.Api`) one area at a time. The rule: **the UI holds no business
logic** - it renders, collects input and calls the API; every decision (validation, calculation, permission, approval) is the backend's.
Plan and the list of backend additions: `docs/ui-integration/PLAN.md` in the backend repository.

## Running it

1. Backend: run the SQL scripts from `docs/upgrade` of the backend repository, then start `PostBank.Api` (default `http://localhost:5151`).
2. UI: `npm install`, copy `.env.example` to `.env.local`, set `BACKEND_URL` if the backend is elsewhere, `npm run dev` (http://localhost:3000).
   `server.ts` forwards every `/api` request that is not an AI route to the backend, so the browser never talks to it directly (no CORS).
3. Sign in with the backend's administrator account (a username - the national code - and password; after a failed attempt a CAPTCHA is asked for).

## Where the connection lives

* `services/api.ts` - the only HTTP door: token handling, refresh on 401, the backend's error messages.
* `services/backend/*.ts` - one typed file per backend area (`auth`, `directory`: users, roles, organisation chart, calendars).
* `services/backend/mappers.ts` - shape adapters only (backend records -> the objects the screens use). No rules.
* `directory/AuthContext.tsx`, `directory/DirectoryContext.tsx` - the session and the directory data; every change goes to the backend and the lists are read back.
* Ids are strings (the backend's GUIDs).

## Status per area

| Area | State |
|---|---|
| Sign-in, session, CAPTCHA | **connected** |
| Users, roles, placement in the organisation chart | **connected** |
| Organisation chart (reference tables page) | **connected** |
| Work calendars (+ official holidays, work hours) | **connected** |
| Project statuses list (reference tables page) | still local (phase 2) |
| Projects, registers, schedule, agile, actions, contracts, strategy, knowledge, approvals, dashboards, reports | still the old local/mock data (phases 2-8) |

Until a phase is done, its screens still run on the mock data in `data.ts`/`localStorage` and may not work with real user ids.
The AI features are not part of this work and are unchanged.
