# Air Filter Fulfillment Platform — Build Specification

This document is the complete build spec for Claude Code. It describes a web application that
ingests tenant/lease exports from property-management platforms, extracts HVAC filter sizes,
deduplicates tenants, and produces two kinds of output: **ShipStation import CSVs** and
**"Update Filter Sizes" dashboard staging files**.

The processing logic in Sections 6–14 is the core of the product and must be implemented
exactly. The architecture in Sections 2–5 is a recommended default; the logic is written to be
stack-independent so it can be implemented in whatever language the build uses.

---

## 1. What the app does (one paragraph)

A user picks a **company** (which determines its GR code), picks the **source platform**
(AppFolio, Rentvine, Buildium, RentManager, Beagle), and uploads the platform's tenant/lease
export. The app parses the file, selects the correct tenant per unit, extracts and normalizes
filter sizes, parses addresses, normalizes names, backfills missing ZIPs, and then produces the
requested output. Rows it can fully resolve go to a **SEND** file ready to use; rows with
problems (missing size, ambiguous ZIP, unparseable name, etc.) go to a **FLAGS** file for manual
review. For ShipStation outputs the app also deduplicates against prior shipment history.

---

## 2. Recommended architecture

| Concern | Default choice | Notes |
|---|---|---|
| App framework | Next.js (App Router, TypeScript) | Single deployable |
| Hosting | Vercel | Already connected |
| DB / Auth / File storage | Supabase (Postgres + Auth + Storage) | Already connected |
| CSV parsing | `papaparse` | Streaming-capable |
| XLSX parsing | `SheetJS` (`xlsx`) | AppFolio/Buildium often export .xlsx |
| CSV writing | `papaparse` unparse | Exact column order control |
| Processing engine | TypeScript module inside the Next.js app | Runs in server actions / route handlers |

**Decision baked in (change if you disagree):** the parsing/transform engine is implemented in
**TypeScript as a shared server module**, not a separate Python service. The logic is regex +
tabular transforms and ports cleanly. If you'd rather reuse your existing pandas code verbatim,
stand up a small FastAPI service instead — every rule below maps 1:1 — and have Next.js call it.

**Decision baked in:** outputs are **downloadable CSVs** (matches the current ShipStation-import
and dashboard-upload workflow). Direct ShipStation API push is listed as a future enhancement in
Section 17, not built now.

---

## 3. Data model (Postgres)

```
companies
  id              uuid pk
  name            text not null
  gr_code         text not null            -- e.g. 'GR0296'
  default_filter_size text null            -- most-common size, used ONLY for opt-in ShipStation auto-fill
  address_quirk   text null                -- enum: null | 'unit_field_is_address' (Edisto, AppFolio multi-unit)
  created_at      timestamptz default now()

company_aliases                            -- maps export-name variants to one company
  id              uuid pk
  company_id      uuid fk -> companies
  alias           text not null            -- e.g. 'Sig Property Management' -> Keystone

platforms
  id              uuid pk
  key             text not null            -- 'appfolio' | 'rentvine' | 'buildium' | 'rentmanager' | 'beagle'
  name            text not null

jobs
  id              uuid pk
  company_id      uuid fk -> companies
  platform_id     uuid fk -> platforms
  output_type     text not null            -- 'shipstation' | 'dashboard'
  status          text not null            -- 'uploaded' | 'processing' | 'review' | 'complete' | 'error'
  auto_fill_size  boolean default false    -- ShipStation only; never true for dashboard
  created_at      timestamptz default now()

job_rows                                   -- one row per output line after processing
  id              uuid pk
  job_id          uuid fk -> jobs
  unit_key        text                     -- canonical key used for dedup
  recipient_name  text
  filter_sizes    text[]                   -- normalized WxHxD strings; 1+ entries
  address1        text
  address2        text
  city            text
  state           text
  postal_code     text
  email           text
  destination     text not null            -- 'send' | 'flag'
  flag_reasons    text[]                   -- populated when destination='flag'
  raw             jsonb                    -- original source row(s) for audit

shipment_history                           -- per-company name list for ShipStation dedup
  id              uuid pk
  company_id      uuid fk -> companies
  recipient_name  text not null
  imported_at     timestamptz default now()
```

Seed `companies` from the table in Section 18. Seed `platforms` with the five keys above.

---

## 4. Pages / UI

1. **Jobs list** — table of past jobs (company, platform, type, status, date), with download links.
2. **New Job** — select company (GR code shown read-only once selected), select platform, select
   output type (ShipStation / Dashboard), upload file(s), optional "auto-fill missing sizes with
   company default" checkbox (disabled and forced off when output type = Dashboard).
3. **Review** — after processing, two tabs:
   - **SEND** (count + preview table, "Download SEND CSV").
   - **FLAGS** (count + table with a `reason` column). Each flagged row is editable inline:
     enter a missing size, confirm/enter a ZIP, fix a name. Resolving a flag moves the row to
     SEND. "Download FLAGS CSV" exports unresolved flags.
4. **History** (ShipStation) — per company, upload/maintain `shipment_history` (name list) used
   for dedup. Show current count, allow CSV upload to append.
5. **Settings** — CRUD on `companies` (name, GR code, default size, address quirk) and
   `company_aliases`. This is where the GR-code table lives and stays editable.

---

## 5. Processing pipeline (ordered stages)

The engine runs these stages in order. Each is detailed in its own section.

1. **Parse** raw file → normalized intermediate rows (Section 6).
2. **Status filter + unit dedup** (Section 7).
3. **Tenant selection** within each unit (Section 7).
4. **Filter-size extraction + normalization + validation** (Section 8).
5. **Address parsing** → Address1 / Address2 (Section 9).
6. **Name normalization** (Section 10).
7. **ZIP backfill** (Section 11).
8. **Multi-size handling** — consolidate vs expand by output type (Section 12).
9. **History dedup** — ShipStation only (Section 13).
10. **Split** SEND vs FLAGS (Section 14).
11. **Generate output CSV** in the canonical column order (Section 15/16).

A row that fails any stage in a way that can't be auto-resolved is routed to FLAGS with a reason
appended; it does **not** silently disappear, and guessed data is **never** written into a
dashboard (system-of-record) output.

---

## 6. Ingestion & platform adapters

Each platform has an adapter that maps its export into a normalized intermediate row:

```
IntermediateRow {
  property_name, unit, unit_tags, street_address1,
  tenant_name, is_primary_tenant, tenant_type, lease_status,
  city, state, postal_code, email
}
```

Adapters must be config-driven (a column-name map per platform) so new platforms/columns can be
added without code changes. Known platform quirks to encode:

- **AppFolio**: exports contain **charge-date triplicates** — the same unit appears multiple times
  with different charge dates. Deduplicate by unit key (Section 7). For **multi-unit complexes the
  per-unit mailing address lives in the `Unit` column**, not the property street address. Status
  values present in the export drive the status filter.
- **Edisto** (company-level quirk `unit_field_is_address`): the actual mailable unit address is
  stored in the **`Unit` field**.
- **Rentvine / Beagle**: response files from the Beagle air-filter form. Beagle contact:
  greg@beagleforpm.com.
- **Buildium**: e.g. Freedom House exports.
- **RentManager**: standard adapter; add column map as samples arrive.

When the company has `address_quirk = 'unit_field_is_address'`, treat the `Unit` column as the
mailable street address rather than as a unit designator.

---

## 7. Status filter, unit dedup, tenant selection

**Lease-status rank** (higher wins): `Current(4) > Notice(3) > Evict(2) > Future(1)`.

- **ShipStation output** considers statuses Current, Notice, Evict, Future. Units whose only rows
  are **Past** are excluded → routed to FLAGS (not silently dropped).
- **Dashboard output** ("active leases" = leases currently in force) considers **Current + Notice
  + Evict only**. Exclude **Past and Future** entirely.

**Unit dedup:** group rows by `unit_key` (company + property + unit). Within a group:
1. Sort by status rank descending; keep the top status tier.
2. Among remaining rows, prefer `is_primary_tenant = Yes`.
3. Then prefer the row whose `tenant_type` is Financially Responsible.
4. Use the **longest `unit_tags` string** in the group as the canonical tags (rows vary; the
   longest is most complete).

This collapses AppFolio's charge-date triplicates to one row per unit.

---

## 8. Filter-size extraction, normalization, validation

**3D regex (primary):**
```
(\d{1,2})\s*[xX*]\s*(\d{1,2})\s*[xX*]\s*(\d{1,2})
```

**Pre-step — strip quantity prefixes** before matching, e.g. `2 x 25x25x1`, `2-20x20x1` → strip
the leading `2 x` / `2-` so the dimension match starts at `25x25x1` / `20x20x1`.

**Normalization** of a matched triple into canonical **WxHxD**:
- Width and Height: order so the **smaller of the two comes first** (width ≤ height).
- Depth is **last**.

**Depth rules:**
- Depths **1–6 inches are normal** — no flag.
- Flag/exclude depths **> 6** or **< 1** as implausible.
- **Missing depth defaults to 1 inch.**
- **Misplaced-1 fix:** if a string yields an implausible depth caused by a misplaced `1`
  (e.g. `1x20x20` → `20x20x1`; `1x20x24` → `20x24x1`), reorder to put the `1` last. This applies
  **only when exactly one dimension equals 1**. If more than one dimension is implausible or the
  misplacement is ambiguous, **flag for manual review** instead of guessing.

**2D-only matches:** accept a 2-dimension match as a filter **only if** a filter-related keyword
(`filter`, `hvac`, `air`) appears nearby in the **same tag string**. Otherwise do not treat it as
a size. When accepted, apply the default depth of 1.

**Multiple distinct sizes in one unit:** keep all distinct normalized sizes on the row's
`filter_sizes` array. Consolidation vs expansion happens later (Section 12).

**No parseable size:** route the unit to **FLAGS** with reason `missing_size`. Never auto-fill a
guessed size into a **dashboard** output. Auto-fill with the company's `default_filter_size` is
permitted **only** for ShipStation shipment-building and **only** when the job's `auto_fill_size`
flag is explicitly enabled by the user.

---

## 9. Address handling

- Put the base street address in **Address 1**.
- Separate unit designators (`Unit`, `Apt`, `Ste`, `#`, etc.) into **Address 2**.
- When the `Unit` field **equals the property name**, the property is single-unit → leave
  **Address 2 blank**.
- **AppFolio multi-unit complexes:** the per-unit mailing address is in the **`Unit` column**, not
  in property street address 1 — use the Unit column value as the address source.
- **Edisto** (and any company with `address_quirk = 'unit_field_is_address'`): the mailable unit
  address is in the **`Unit` field**.
- **Address 2 fallback rule:** suppress property **nickname** values — only accept genuine unit
  designators into Address 2. If the candidate Address 2 value is just a property nickname, leave
  Address 2 blank.

---

## 10. Name normalization

- Strip parenthetical aliases and quoted nicknames from name fields,
  e.g. `John Smith (Johnny)` → `John Smith`; `Mary "May" Lee` → `Mary Lee`.
- When the tenant name is missing or a placeholder, use **`[Company Name] Resident`**
  (e.g. `Keystone Signature Properties Resident`).
- **LLC names:** standardize to `Name LLC` format, stripping trailing commas and periods
  (e.g. `Acme Holdings, LLC.` → `Acme Holdings LLC`).

---

## 11. Missing postal codes (ZIP backfill)

- If a row is missing a ZIP, look at other rows in the **same job** with the same **city + state**.
- If **exactly one** distinct ZIP exists for that city+state, backfill it.
- If the city has **multiple** different ZIPs on file, leave the ZIP **blank** and route the row to
  **FLAGS** with reason `ambiguous_zip` for confirmation.

---

## 12. Multi-size handling (consolidate vs expand)

The same unit may need multiple distinct filter sizes. Behavior differs by output:

- **ShipStation:** **one shipment per recipient.** Consolidate **all** sizes for the recipient
  into a single, comma-separated value in **Custom Field 1**, on **one row**. Do **not** split
  into multiple rows per size.
- **Update Filter Sizes dashboard:** **expand to one row per size** (one (Name, Size, Address1,
  Address2) row for each distinct size).

---

## 13. ShipStation dedup against history (ShipStation output only)

History files typically lack address data, so match on **name only** against
`shipment_history` for the job's company:

- A **single-filter** recipient whose name matches history → flag as **likely duplicate**
  (reason `likely_duplicate_history`); route to FLAGS, do not auto-send.
- A **multi-filter** recipient whose name matches history → **release to ship** (receiving
  multiple filters now is a legitimate new order).

Skip this stage entirely for dashboard output.

---

## 14. SEND vs FLAGS split

Produce two files for every job:

- **SEND** — fully resolved rows, ready to use (ShipStation import or dashboard upload).
- **FLAGS** — rows needing manual review, each with one or more `flag_reasons`. Standard reasons:
  `missing_size`, `ambiguous_size_review`, `ambiguous_zip`, `past_only_unit`,
  `likely_duplicate_history`, `unparseable_name`.

In the Review UI, resolving a flag (entering a size, confirming a ZIP, fixing a name) moves the
row to SEND. The **dashboard system-of-record must never** receive guessed/auto-filled sizes —
unknown sizes stay in FLAGS until a human resolves them.

---

## 15. ShipStation output — canonical column order

Emit columns in **exactly** this order:

```
Order #, Shipping Service, Height(in), Length(in), Width(in), Weight(oz),
Custom Field 1, Custom Field 2, Custom Field 3,
Recipient Name, Address, City, State, Postal Code, Country Code, Tenant Email
```

Field mapping:
- **Custom Field 1** = filter size(s) in **WxHxD** (comma-separated if multiple — see Section 12).
- **Custom Field 2** = company name.
- **Custom Field 3** = company **GR code**.
- **Recipient Name / Address / City / State / Postal Code / Tenant Email** = normalized values
  from the pipeline. **Address** = Address 1; if you need Address 2 in ShipStation, append it to
  Address per your current import convention (confirm — see open questions).
- **Country Code** = `US` default.
- **Order #, Shipping Service, Height/Length/Width/Weight** = configurable defaults (expose as
  per-company or global settings; leave editable, don't hardcode silently).

---

## 16. Dashboard output — "Update Filter Sizes"

Emit **exactly four columns, in this order**:

```
Name, Size, Address 1, Address 2
```

- One row per (recipient, size) after expansion (Section 12).
- Active leases only: Current + Notice + Evict.
- No auto-filled/guessed sizes — unknowns are in FLAGS, not here.

---

## 17. Future enhancements (not in scope for first build)

- Direct **ShipStation API** order creation instead of CSV export.
- Direct API pulls from AppFolio/Rentvine/Buildium instead of manual upload.
- Per-company carton dimensions/weight library feeding Height/Length/Width/Weight.
- Automatic history sync (write each shipped batch back into `shipment_history`).

---

## 18. Seed data — companies & GR codes

| Company | GR Code |
|---|---|
| StarPointe Realty | GR0022 |
| Reliant | GR0025 |
| Sleep Sound / Sleepy Sound | GR0160 |
| AllStates | GR0250 |
| 43 Realty | GR0265 |
| Global Realty | GR0267 |
| Edisto Property Management Group | GR0270 |
| Flagship Property Management | GR0279 |
| Arrow AL / Arrow TN / Arrow Property Management | GR0294 |
| Keystone Signature Properties | GR0296 |
| Five Star Real Estate & PM | GR0299 |
| Stars & Stripes | GR0302 |
| Remi Emerson / YRIG | GR0303 |
| JAZ | GR0357 |
| Red Door Property Management | GR0386 |
| Freedom House | GR0387 |
| SunCoast | GR0541 |
| Hylton & Company | GR0592 |
| Vesta Property Management | GR0671 |
| PMI Raleighwood | GR0680 |
| Sheffield | GR0734 |
| Endeavour Realty | GR0792 |
| Mission Real Estate | GR0798 |
| Innovative Realty | GR0802 |
| PMI River City | GR0806 |
| JR Grace / J R Grace Realty LLC | GR0159 |

Seed `company_aliases` for known variants (e.g. `Sig Property Management` → Keystone Signature
Properties; `Sleepy Sound` → Sleep Sound; `Arrow AL` / `Arrow TN` → Arrow Property Management).
Set `address_quirk = 'unit_field_is_address'` for **Edisto**.

---

## 19. Test cases (implement as unit tests)

**Size extraction / normalization**
- `2 x 25x25x1` → `25x25x1` (quantity stripped).
- `20x16x1` → `16x20x1` (width ≤ height).
- `1x20x20` → `20x20x1` (misplaced-1 fix).
- `1x20x24` → `20x24x1` (misplaced-1 fix).
- `1x1x20` → **FLAG** `ambiguous_size_review` (more than one dim = 1).
- `20x20` with tag containing "filter" → `20x20x1` (2D + keyword, default depth).
- `20x20` with no filter keyword nearby → not a size.
- depth `8` (e.g. `20x20x8`) → **FLAG** (depth > 6).
- unit with two sizes `16x20x1` and `20x25x1`:
  - ShipStation → one row, Custom Field 1 = `16x20x1, 20x25x1`.
  - Dashboard → two rows.

**Dedup / selection**
- AppFolio unit with three charge-date triplicate rows (all Current) → collapses to one row.
- Unit with rows {Past, Notice} → Notice row selected.
- Unit with only Past rows → **FLAG** `past_only_unit` (ShipStation); excluded entirely (Dashboard).
- Unit with two Current rows, one `Primary=Yes` → the primary is selected.

**Address**
- `Unit` value equals property name → Address 2 blank.
- AppFolio multi-unit → address sourced from `Unit` column.
- Edisto company → address sourced from `Unit` field.
- Address-2 candidate is a property nickname → Address 2 blank.

**Names**
- `John Smith (Johnny)` → `John Smith`.
- missing name, company Keystone → `Keystone Signature Properties Resident`.
- `Acme Holdings, LLC.` → `Acme Holdings LLC`.

**ZIP**
- City with one known ZIP in the job → backfilled.
- City with two different ZIPs in the job → blank + **FLAG** `ambiguous_zip`.

**History dedup (ShipStation)**
- single-filter recipient matching a history name → **FLAG** `likely_duplicate_history`.
- multi-filter recipient matching a history name → released to SEND.

---

## 20. Open questions to confirm before/during build

1. **ShipStation Address 2** — does your ShipStation import use a separate Address-2 field, or
   should unit designators be appended to the single `Address` column? Section 15 assumes the
   latter; confirm.
2. **Default carton dimensions/weight** — global defaults, or per-company? (Affects
   Height/Length/Width/Weight and Shipping Service defaults.)
3. **Multi-user vs single-user** — does anyone besides you use this? Affects whether Supabase Auth
   needs org/role support or just a single login.
4. **History maintenance** — should completed ShipStation batches auto-append to
   `shipment_history`, or stay manual upload only? (Listed as a future enhancement; confirm intent.)
