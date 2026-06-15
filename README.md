# Air Filter Fulfillment Platform

Ingests property-management tenant/lease exports (AppFolio, Rentvine, Buildium,
RentManager, Beagle), extracts HVAC filter sizes, deduplicates tenants, and
produces **ShipStation import CSVs** and **"Update Filter Sizes" dashboard**
files. Requirements: [`BUILD_SPEC.md`](./BUILD_SPEC.md).

> Rebuild of the original Streamlit prototype (`app.py`, `parse_beagle_xlsx.py`,
> kept for reference) onto Next.js + Supabase + Vercel.

## Status

Working end-to-end **UI-first** build: upload a file → process → review SEND /
FLAGS → download CSVs. Job/history/company state is **in-memory** (resets on
restart); Supabase persistence + Auth is the next milestone.

| Area | State |
|---|---|
| Processing engine (`lib/engine`) | ✅ Sections 6–16 |
| File ingestion (`lib/ingest`, CSV + XLSX) | ✅ duplicate-header safe |
| Company data (`lib/seed`) | ✅ 794 companies from the legacy `GR_LOOKUP` |
| UI: Jobs / New Job / Review (inline flag edit) / History / Settings | ✅ in-memory |
| Unit + integration tests (`tests/`) | ✅ 46 tests |
| Supabase persistence + Auth | ⏳ next |

## Reconciled with real output

Verified against a real ShipStation-ready file; three spec rules were corrected
to match production data:

- **Sizes repeat by quantity** (e.g. `14x24x1, 14x24x1`) — not deduped — for
  ShipStation. Dashboard still expands to distinct sizes.
- **Company → GR source** is the legacy 794-entry `GR_LOOKUP`, not the spec's
  26-row table.
- **Names keep parentheticals** (`KIMBERLY DORN (COOPERMAN)`) rather than
  stripping them.

## Engine architecture

Framework-agnostic TypeScript (no Next/React imports), unit-testable, run from
server actions.

```
lib/engine/
  adapters/    platform column maps → IntermediateRow (Section 6)
  pipeline/    status, filterSize, address, name, zip, multiSize,
               historyDedup, split (Sections 7–14)
  output/      ShipStation + Dashboard CSV (Sections 15–16) + render()
  process.ts   ordered pipeline (Section 5)
lib/ingest/    CSV (papaparse) + XLSX (SheetJS) → RawRow[]
lib/store/     in-memory jobs/history/companies (Supabase stand-in)
lib/actions.ts server actions (create job, resolve flag, history, settings)
```

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest — 46 tests
npm run typecheck
npm run build
```

## Database

`supabase/migrations/0001_init.sql` + `supabase/seed.sql` define the schema
(Section 3). Not yet applied; the live wiring replaces `lib/store` next.

## Decisions (spec §20)

1. ShipStation Address 2 **appended** to the single `Address` column (matches
   the real file; toggle in `ShipStationDefaults`).
2. Carton dims/weight/service blank, exposed as settings.
3. Unknown lease status → `Past` (routed to review).
4. Unresolvable ZIP → flagged `ambiguous_zip`.

> Legacy Python files remain at the repo root for reference; point Vercel at the
> Next.js project. We still need a raw *input* export (Beagle/AppFolio/etc.) to
> verify the parsing adapters against real data — the sample provided was an
> output file.
