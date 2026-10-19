# vortomi-frontend

Panel of **Vortomi**, the multi-company WhatsApp CRM. Angular 22, standalone components,
signals, zoneless, SCSS.

**Current stage: visual prototype.** There is no backend yet. Every screen reads JSON files in
`public/data` as if they were database tables, and edits made while the page is open (sent
messages, notes, assignments) live in memory until reload. The goal is to settle the screens
before building the backend and the database.

## Commands

```bash
npm install
npm start            # http://localhost:4200
npm test             # Vitest, single run with: npx ng test --watch=false
npm run build        # production build in dist/
```

## Demo accounts

Any password works; the login page has shortcuts.

| Email | Role | Notes |
|---|---|---|
| `laura@repuestosandinos.com` | Company admin | Sees every conversation of Repuestos Andinos |
| `carlos@repuestosandinos.com` | Agent | Only the Ventas number, own + unassigned chats |
| `elena@muebleriavalle.com` | Company admin | Mueblería Valle: sells with pipeline and made-to-order products |
| `gabriela@dentalsonrisa.com` | Company admin | Clínica Dental Sonrisa: customer service only, no pipeline or inventory; its number is disconnected |
| `valeria.gil@gmail.com` | Two companies | Agent at Mueblería Valle and admin at Clínica Dental Sonrisa: picks a company and can switch |
| `yornel@vortomi.com` | Platform super admin | Asks for a 6-digit code (any except `000000`), then the console |

Invitation links: `/invitation/demo-jesus` (valid), `/invitation/demo-expired`, `/invitation/demo-used`.
Password reset link: `/reset-password/demo-reset`.
Meta account ids in the sign-up wizard: `300000000000001` (new, free number),
`200000000000001` (numbers owned by another company), anything else (not found).

The session survives a reload (sessionStorage); edits to data do not.

## Sample data

Seven companies exist; three have full data (chats, contacts, templates, settings...). The others
appear in the console, the usage meter and the reports, but their panels are empty.

| Company | How it works | Highlights |
|---|---|---|
| Repuestos Andinos | Sells: pipeline + inventory by units | Two numbers, one agent with limited access, the reference company of the mockups |
| Mueblería Valle | Sells: pipeline + made-to-order products | A number over its 1,000 free replies, an unattended lead, a claim |
| Clínica Dental Sonrisa | Customer service only | No pipeline or inventory, number disconnected, Valeria is admin here |

Every table is one JSON file shared by all companies, each row tagged with `tenantId`, exactly as
the database will be. Two scripts rebuild the generated parts; both are deterministic:

```bash
node scripts/seed-sample-companies.mjs   # Mueblería Valle and Clínica Dental Sonrisa rows, Valeria in both
node scripts/generate-report-days.mjs    # public/data/report-days.json (daily attention figures since 1 Sep)
```

Meta usage (`usage.json`) is stored **per number**: Meta gives 1,000 free replies a month to each
number, not to each company (`shared/billing/meta-pricing.ts`).

## Structure

```
public/data/              Mock tables (one JSON per table, field names = future DB columns)
scripts/                  Deterministic generators of the sample data (see "Sample data")
src/styles/               _tokens.scss (mockup colours), _mixins.scss, _sidebar.scss, styles.scss
src/app/
├── app.routes.ts         Lazy routes. Paths in English, visible text in Spanish
├── core/                 Directory (platform tables), CompanyData (company config tables), Auth, Session,
│                         Workspace (active company slice), guards, landing rules, Clock
├── shared/
│   ├── api/              models.ts, labels.ts (visible text per value), mock-db.ts, editable-table.ts
│   ├── billing/          Meta spend estimate: 1,000 free replies per number, reference rates
│   ├── files/            CSV read/write (with formula-injection protection) and downloads
│   ├── format/           Dates in the company's time zone, money in cents, durations, phones (wa_id), slugs
│   ├── security/         Password policy and the shared "new password" form schema
│   └── ui/               Icon, Avatar, Pill, ChannelBadge, Dialog, Switch, FieldError, PasswordMeter, Toaster
├── layout/               Auth, company panel and platform console frames, navigation, user menu
└── features/
    ├── auth/             Login, second factor, choose company, forgot/reset password, invitation
    ├── account/          My profile
    ├── inbox/            Shared inbox (mockup web-1)
    ├── contacts/         List, detail, CSV import (mockup web-3)
    ├── templates/        List and editor with Meta's rules (mockup web-4)
    ├── team/             Numbers, team, invitations, permissions (mockup web-6)
    ├── settings/         Company, exchange rate, tags, pipeline stages, quick replies
    ├── pipeline/         Sales board by stage (mockup web-2)
    ├── inventory/        Products, variants, stock movements, CSV import
    ├── reports/          Attention per day and per person, Meta spend, number health (mockup web-5)
    └── platform/         Console: companies, company detail, 4-step sign-up, alerts, usage
```

## Rules of the prototype

- **Screens never read JSON directly.** Each feature has a store (`inbox.data.ts`) that does.
  When the backend exists, only the stores change their URLs.
- **Everything is scoped to the active company** (`tenantId`), as the backend will enforce.
  Stores keep every company's rows and filter on read, so edits survive switching company.
- **No business rules are enforced here.** The panel shows the 24 h window, permissions and
  Meta limits; the backend is the one that enforces them.
- **Time is frozen** at `DEMO_NOW` (`core/clock.ts`) so the sample timestamps keep their meaning.
- **English names** for files, functions, routes and data ids. Spanish only in visible text.
- No source file over 1000 lines.

## Screens

| Route | Status |
|---|---|
| `/login`, `/login/verify`, `/select-company`, `/forgot-password`, `/reset-password/:token`, `/invitation/:token` | Done |
| `/inbox`, `/inbox/:conversationId`, `/profile` | Done |
| `/contacts`, `/contacts/new`, `/contacts/:contactId` (CSV import/export) | Done |
| `/templates`, `/templates/new` (simulated Meta review) | Done |
| `/channels-and-team`, `/settings` (admins only) | Done |
| `/pipeline` (drag and drop, waiting times) | Done |
| `/inventory`, `/inventory/new`, `/inventory/:productId` (CSV import/export, stock movements) | Done |
| `/reports` (admins only; Meta spend with 1,000 free replies per number) | Done |
| `/platform/tenants`, `/platform/tenants/:id`, `/platform/tenants/new`, `/platform/alerts`, `/platform/usage`, `/platform/profile` | Done |
| `/platform/subscriptions` | Placeholder (billing model still open) |

Guards (`core/guards.ts`) only shape the experience. Every permission is enforced again by the backend.

Approved designs: `../graphics/web-1` to `web-13`.
