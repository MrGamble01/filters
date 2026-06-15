# Air Filter Fulfillment Platform

Ingests property-management tenant/lease exports (AppFolio, Rentvine, Buildium,
RentManager, Beagle), extracts HVAC filter sizes, deduplicates tenants, and
produces two kinds of output: **ShipStation import CSVs** and **"Update Filter
Sizes" dashboard files**. Full requirements live in [`BUILD_SPEC.md`](./BUILD_SPEC.md).

> Rebuild of the original Streamlit prototype (`app.py`, `parse_beagle_xlsx.py`,
> kept for reference) onto the spec's recommended Next.js + Supabase + Vercel
> stack.

## Status

**This pass: scaffold + core processing engine (spec Sections 6–14) with unit
tests.** The Next.js UI pages, Supabase wiring, and file-upload ingestion are the
next milestone.

| Area | State |
|---|---|
| Next.js (App Router, TS) scaffold | ✅ minimal landing page |
| Processing engine (`lib/engine`) | ✅ Sections 6–16 implemented |
| Unit tests (`tests/`) | ✅ 43 tests, all Section 19 cases |
| Seed data (`lib/seed`) | ✅ companies / GR codes / aliases (Section 18) |
| Supabase schema (`supabase/`) | ✅ migration + seed SQL written (not applied) |
| UI: Jobs / New Job / Review / History / Settings | ⏳ not started |
| File ingestion (papaparse / SheetJS → RawRow) | ⏳ not started |
| Supabase Auth / persistence | ⏳ not started |

## Engine architecture

The engine is a framework-agnostic TypeScript module (no Next/React imports), so
it is unit-testable and can run in server actions or route handlers.

```
lib/engine/
  adapters/        platform column maps → IntermediateRow (Section 6)
  pipeline/
    status.ts      status filter + unit dedup + tenant selection (Section 7)
    filterSize.ts  size extraction / normalization / validation (Section 8)
    address.ts     Address 1 / Address 2 + unit-field quirk (Section 9)
    name.ts        name normalization (Section 10)
    zip.ts         ZIP backfill (Section 11)
    multiSize.ts   consolidate (ShipStation) vs expand (Dashboard) (Section 12)
    historyDedup.ts ShipStation name-only history dedup (Section 13)
    split.ts       SEND vs FLAGS (Section 14)
  output/          ShipStation (Section 15) + Dashboard (Section 16) CSV writers
  process.ts       orchestrates the ordered pipeline (Section 5)
```

`processRaw(rawRows, options)` runs the adapter then the pipeline;
`processIntermediate(rows, options)` skips the adapter. Both return
`{ send, flags, sendCsv, flagsCsv }`.

## Develop

```bash
npm install
npm test          # vitest — 43 tests
npm run typecheck # tsc --noEmit
npm run dev       # Next.js dev server
```

## Database

`supabase/migrations/0001_init.sql` and `supabase/seed.sql` define the schema
(Section 3) and seed data (Section 18). They are **not** applied to a live
project yet — apply them when provisioning Supabase.

## Decisions & open questions

Implemented per spec defaults; confirm before the next pass (spec Section 20):

1. **ShipStation Address 2** — appended to the single `Address` column
   (`append_address2: true`). Toggle in `ShipStationDefaults`.
2. **Carton dimensions / weight / service** — left blank, exposed as
   `ShipStationDefaults` (wire to per-company/global settings later).
3. **Unknown lease status** — treated as `Past` (routed to review, never
   silently shipped).
4. **Unresolvable ZIP** (no known city+state ZIP) — flagged `ambiguous_zip`.

> Note: the legacy Python files and `requirements.txt` remain at the repo root
> for reference. Vercel should be pointed at the Next.js project; we can move the
> Python prototype into `legacy/` in a follow-up.
