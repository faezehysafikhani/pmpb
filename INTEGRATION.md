# Backend integration (branch `feature/backend-integration`)

The UI is being connected to the NexusCore backend (`PostBank.Api`) one area at a time. The rule: **the UI holds no business
logic** - it renders, collects input and calls the API; every decision (validation, calculation, permission, approval) is the backend's.
Plan and the list of backend additions: `docs/ui-integration/PLAN.md` in the backend repository.

## Running it

1. Backend: run the SQL scripts from `docs/upgrade` of the backend repository, then start `PostBank.Api` (NOT `NexusCore.Api`: that host does not register the project-management modules) (default `http://localhost:5251`).
2. UI: `npm install`, copy `.env.example` to `.env.local`, set `BACKEND_URL` if the backend is elsewhere, `npm run dev` (http://localhost:3000).
   `server.ts` forwards every `/api` request that is not an AI route to the backend, so the browser never talks to it directly (no CORS).
3. Sign in with the backend's administrator account (a username - the national code - and password; after a failed attempt a CAPTCHA is asked for).

## Where the connection lives

* `services/api.ts` - the only HTTP door: token handling, refresh on 401, the backend's error messages.
* `services/backend/*.ts` - one typed file per backend area (`auth`, `directory`: users, roles, organisation chart, calendars).
* `services/backend/mappers.ts` - shape adapters only (backend records -> the objects the screens use). No rules.
* `directory/AuthContext.tsx`, `directory/DirectoryContext.tsx` - the session and the directory data; every change goes to the backend and the lists are read back.
* `directory/ProjectsContext.tsx` - the projects the signed-in user may see (the backend decides which: `GET /api/portfolio/projects`), and create / update / status / submit / delete.
  The backend owns a project's charter, people, unit, calendar, dates, status, team and approval state, and (phase 3) its registers: risks, stakeholders, status reports,
  delay reasons and documents, with the risk matrix settings and the stakeholder strategy wording. The remaining parts a screen keeps inside the project object
  (schedule, agile board, tab settings ...) are **not connected yet**: they are kept in this browser per project id (`pms_project_extras`) until their own phase.
* `services/backend/registers.ts`, `registerMappers.ts`, `registerLoad.ts` - the register endpoints, their shape adapters and the batch loader
  (one call per register for all visible projects, plus the Workflow lookup that gives each item its approval state / next approver / decision history).
  Approving or rejecting a register item is `POST /api/workflow/approval-center/{id}/approve|reject` (`ProjectsContext.decide`); nothing about stages is computed in the browser.
* Two small pieces are still kept in the browser, keyed by item id (`pms_register_local`): the second approval round on a risk's response (risk response verification,
  connected with the task centre in a later phase) and the AI summary notes of a document.
* The status report's planned / actual progress are sent as the screen shows them today (`enrichProjectWithProgress`) until the schedule is connected (phase 4).
* `services/backend/errors.ts` - the words (Persian / English) for the backend's project error codes. The rules themselves live in the backend.
* `services/backend/runtimeDirectory.ts` - hands the backend-fed unit tree and calendars to plain helper functions that cannot use React context.
* Ids are strings (the backend's GUIDs).

## Status per area

| Area | State |
|---|---|
| Sign-in, session, CAPTCHA | **connected** |
| Users, roles, placement in the organisation chart | **connected** |
| Organisation chart (reference tables page) | **connected** |
| Work calendars (+ official holidays, work hours) | **connected** |
| Projects: list, create, edit charter, team, work status, send for approval, delete (guarded), portfolio visibility | **connected** (phase 2) |
| Risks (+ response status, matrix colours, level definitions), stakeholders (+ strategy wording), status reports, delay reasons, documents (real upload / download), their approval via the Workflow backend | **connected** (phase 3) |
| Project statuses list (reference tables page) | the backend's fixed set, shown read-only (a custom status could not be saved) |
| Schedule, agile, actions, contracts, strategy, knowledge, dashboards, reports | still the old local/mock data (phases 4-8) |
| Approval centre (register items) | decisions go to the backend workflow; delegation, stage editor and the full centre are phase 7 |

Approving a submitted project needs the approval centre (phase 7): until a workflow is defined for projects the backend approves a project as soon as it is sent.
Until a phase is done, its screens still run on the mock data in `data.ts`/`localStorage` and may not work with real user ids.
The AI features are not part of this work and are unchanged.
