# FiberApp

A field-documentation and billing module for fiber construction crews, modelled on
[fiberfield.app](https://fiberfield.app). Lives entirely under `/fiber-app` and uses
MongoDB collections prefixed `FiberApp_` — it never touches DTAP, BSPD, Splicing or
Tree Trim data.

## The core loop

```
Create project → crews report markers/lines + photos + billing codes
              → foreman inspects → one-click billing doc → invoice
```

## Screens

| Route | Purpose |
|---|---|
| `/fiber-app` | Dashboard — KPIs, reported-vs-invoiced trend, top codes, activity feed |
| `/fiber-app/projects` | Project list with live progress/budget rollups + create dialog |
| `/fiber-app/projects/[id]` | Project workspace — plan view, markers, billing, photos, forms, documents |
| `/fiber-app/map` | Every GPS-tagged marker plotted, filterable |
| `/fiber-app/markers` | All markers and line runs across projects |
| `/fiber-app/photos` | GPS-tagged proof-of-work library |
| `/fiber-app/forms` | Field form submissions |
| `/fiber-app/documents` | Plans, permits, locate tickets, closeout packages |
| `/fiber-app/billing` | Entries, batches and code summary with CSV export |
| `/fiber-app/billing-codes` | Unit-price catalogue with crew rate / bill rate / margin |
| `/fiber-app/customers` | Who you bill and on what terms |
| `/fiber-app/users` | Crew seats and role capabilities |
| `/fiber-app/field` | **Field Mode** — phone-first crew reporting with offline sync queue |
| `/fiber-app/sync-status` | Which devices have pushed their offline work |
| `/fiber-app/settings` | Role matrix, catalogues, integrations, demo data controls |

## API

All routes under `app/api/fiber-app/`, wrapped in `withAuth` (401 when logged out).
`[id]` routes use an inline `auth()` guard because `withAuth` cannot forward route params.

- `GET|POST /api/fiber-app/projects`
- `GET|PATCH|DELETE /api/fiber-app/projects/[id]` — full workspace payload in one round trip
- `GET|POST /api/fiber-app/markers`, `PATCH|DELETE /api/fiber-app/markers/[id]`
- `GET|POST` for `photos`, `forms`, `documents`, `customers`, `users`, `billing-codes`
- `GET|PATCH /api/fiber-app/billing` — entries + summary + batches
- `POST /api/fiber-app/billing/generate` — the one-click billing step
- `GET /api/fiber-app/dashboard` — KPIs, trend, breakdowns, activity
- `POST|DELETE /api/fiber-app/seed` — load / clear the demo dataset

## Collections

`FiberApp_Projects`, `FiberApp_Markers`, `FiberApp_Lines`, `FiberApp_Photos`,
`FiberApp_BillingCodes`, `FiberApp_BillingEntries`, `FiberApp_BillingBatches`,
`FiberApp_FormTemplates`, `FiberApp_FormInstances`, `FiberApp_Documents`,
`FiberApp_Customers`, `FiberApp_Members`, `FiberApp_Inspections`, `FiberApp_Activity`

Names are centralised in `lib/fiber-app.ts` (the `FA` object) — never hard-code them.

## Roles

Mirrors FiberField's per-seat plan matrix. See `capabilitiesFor()` in `lib/fiber-app.ts`.

| | Manager $149 | Foreman $129 | Crew $49 |
|---|---|---|---|
| View all projects | ✓ | | |
| Create projects | ✓ | | |
| Manage users | ✓ | | |
| View pricing | ✓ | | |
| Mark invoiced | ✓ | | |
| Perform inspections | ✓ | ✓ | |
| Report work | ✓ | ✓ | ✓ |
| Download reports | ✓ | ✓ | |

## Demo data

The dashboard and Settings → Data both expose a **Load demo data** button
(`POST /api/fiber-app/seed?reset=1`). It builds 7 projects, ~90 markers, line runs,
billing entries, photos, forms, documents and batches from a deterministic seed, so
every screen is populated for a walkthrough. **Clear all FiberApp data** wipes only
the `FiberApp_*` collections.

## Shared building blocks

- `lib/fiber-app.ts` — collections, enums, role capabilities, money/status formatters
- `lib/fiber-list.ts` — `listHandler()` powers every simple paginated collection route
- `components/fiber-app/fa-page.tsx` — standard page chrome (sidebar + inset)
- `components/fiber-app/fa-kit.tsx` — `StatCard`, `StatusPill`, `ProgressBar`, `SectionCard`, `BarList`, `EmptyState`
- `components/fiber-app/fa-list-page.tsx` — search + filters + `DataTable` in one component

Theming comes entirely from the app's existing tokens (`--primary`, `--chart-1..5`),
so FiberApp follows the Dono Utilities theme and light/dark mode automatically.
