# Par

_Mason Homes inventory tracker._

Tracks inventory across every Mason Homes unit and the central storage reserve,
and logs every movement from central. Two problems, one app: it **prevents
items walking off** (every central pull is logged with a reason) and gives
**total visibility** (par vs actual across every unit and the central reserve
in one place).

## The core model

> Consumables live in owner's closets and draw down every turnover, refilled
> weekly from central. Linens cycle on site at each unit and only move from
> central when damaged. Both have a par per unit and a central backup reserve,
> and every central pull is logged.

Four tracked things:

- **Consumables** — par per closet, placed out each turnover, refilled to par on
  the weekly restock run. A cleaner's flag lowers the closet to its reorder
  point; only a manager's refill raises it. Anything below par is on the run.
- **Linens** — a flat set that cycles on site. Actual below par signals a
  damaged/lost/stolen linen and triggers a logged replacement pull.
- **Parking passes** — confirmed present each turnover, flagged when missing.
- **Stockroom pull log** — every item pulled from the Stockroom: item, qty,
  unit, reason, date, who. The anti-theft and reconciliation backbone. It also
  sets the Stockroom's reorder points: one week of what actually gets pulled.

## The screens

Two roles. **Cleaners** see Home, their unit pages, and the guide. **Managers**
see everything.

| Screen | Who | What it's for |
| --- | --- | --- |
| **Home** | both | Cleaners: find your unit (recent units, pinned search, buildings that fold). Managers: portfolio KPIs and recent cleans first, then the units. |
| **Unit** (clean flow) | both | Confirm parking, flag consumables that are low, confirm or flag linens, review, record. Items flagged on an earlier clean wait for the restock run; a clean recorded with no signal is saved on the phone and sent later. Managers also get linen par and a pull button here. |
| **Restock** | managers | The weekly run: every closet item below par and how many to bring. One tap refills a unit with what the Stockroom actually has and logs each pull; anything short stays on the run. |
| **Stockroom** | managers | Bulk stock. Reorder is one week of real pulls (last four weeks); par is that × the buffer in Settings. Receive a delivery or adjust a count on any row. |
| **Linens** | managers | Par vs actual per unit, short units first. Replace a short linen with a logged pull in one tap. |
| **Pull log** | managers | Every Stockroom pull: search by item, person or unit; date range; CSV export. |
| **Parking** | managers | Which units have their passes; mark one missing or present. |
| **Activity** | managers | Manual stock changes — counts, targets, linen edits — who and when. |
| **Team** | managers | Add people, send setup links, roles, disable, reset, remove. |
| **Settings** | managers | The three inputs behind calculated par, bagged-bedding flags per unit, and integrations (Slack summary, invite email). |

## Stack

- **Next.js** (App Router) — UI + API route handlers, deploys as one app
- **Supabase Postgres** — source of truth; atomic pulls/restocks via SQL functions
- **Tailwind** — styled to the Mason Design System v4 (midnight, restrained, heavy)
- **Vercel** — hosting

## Setup

### 1. Database (Supabase) — required

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run [`supabase/schema.sql`](supabase/schema.sql).
   It creates the tables, the `log_pull` / `restock_unit` functions, and seeds
   the portfolio (10 properties, 8 consumables, 5 linen types, parking passes).
3. From **Project Settings → API**, copy the **Project URL** and the
   **`service_role`** key.

> The central reserve quantities in the seed are sensible starting numbers.
> Set them to your real bulk counts on the **Central** screen.

### 2. Deploy (Vercel)

1. Import this repository at [vercel.com](https://vercel.com).
2. Add the environment variables below.
3. Deploy.

### 3. Environment variables

See [`.env.example`](.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service role key |
| `APP_PASSWORD` | production | Turns the login gate on (blank = open, for local dev) |
| `SESSION_SECRET` | production | Signs login cookies |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Invite emails |
| `SLACK_WEBHOOK_URL` | no | Daily summary and "post now" from Settings |

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

Open <http://localhost:3000>.
