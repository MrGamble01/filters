# CLAUDE.md — Air Filter Fulfillment Manager

This file documents the codebase for AI assistants working in this repository.

## Project Purpose

This is a **Streamlit web application** that helps property management companies process air filter distribution orders. It:

1. Converts Beagle air filter response reports (XLSX) into ShipStation-compatible CSV files
2. Validates orders against historical shipment data to avoid re-shipping
3. Validates orders against charge detail reports to flag non-paying tenants

## Repository Structure

```
/home/user/filters/
├── app.py                         # Main Streamlit app (~2,450 lines)
├── parse_beagle_xlsx.py           # Standalone CLI utility for XLSX → CSV
├── requirements.txt               # Python dependencies
├── .github/workflows/
│   └── auto-merge-claude.yml     # Auto-merges claude/* branches via squash
└── .gitignore
```

## Tech Stack

- **Language:** Python 3.11
- **UI Framework:** Streamlit
- **Data Processing:** pandas, openpyxl
- **No build step, no tests, no linter configured**

## Running the Application

```bash
# Install dependencies
pip install -r requirements.txt

# Start the Streamlit app
streamlit run app.py

# CLI utility (standalone XLSX conversion)
python3 parse_beagle_xlsx.py <input.xlsx> <property_name> [output.csv]
```

## Application Workflow (3 Steps)

### Step 1 — Convert
- Upload one or more Beagle XLSX or CSV files
- App parses and normalizes each file into ShipStation row format
- Download combined CSV or continue to Step 2

### Step 2 — Validate Against Shipments
- Upload a ShipStation export (CSV or XLSX) of recent shipments
- App removes any rows with addresses already shipped within 90 days
- Review excluded rows; download validated CSV or continue to Step 3

### Step 3 — Validate Charges
- Upload a charge detail report (CSV)
- App matches against tenant emails/addresses
- Separates rows into "Approved" and "Flagged" (non-payers) downloads

## Key Source Files

### `app.py`

The entire application lives in this single file. Key sections:

**Constants (top of file):**
- `LOGO_B64` — Base64-encoded logo image
- `GAME_HTML` — Easter egg canvas game (dog jumping game)
- `BASELINE_SHIPMENTS_B64` — Hardcoded historical ShipStation CSV (early 2024–Dec 2024), base64-encoded
- `PROPERTY_GR_MAP` — Dict of 900+ property name → GreenRooms ID mappings

**Core data processing functions:**
| Function | Purpose |
|---|---|
| `normalize_filter_size(s)` | Standardizes filter dimensions (e.g., "16×20×1" → "16x20x1") |
| `normalize_zip(z)` | Cleans and zero-pads zip codes |
| `normalize_address_key(addr)` | Normalizes address strings for matching/deduplication |
| `merge_address(street, unit)` | Combines street + unit into a single address field |
| `is_po_box(addr)` | Returns True if address appears to be a PO Box |
| `parse_beagle_xlsx(file, prop)` | Main parser — reads Beagle XLSX, returns list of row dicts |
| `parse_tenant_directory_v1/v2(file)` | CSV parsers for two tenant directory formats |
| `parse_issues_csv(file)` | Parses property management issue reports |
| `detect_csv_format(file)` | Auto-detects uploaded CSV format |

**Validation & analytics functions:**
| Function | Purpose |
|---|---|
| `detect_duplicates(rows)` | Flags duplicate records within a batch |
| `get_filter_size_breakdown(rows)` | Returns dict of filter size → count |
| `compute_quality_score(rows)` | Returns data quality % (email coverage, etc.) |
| `get_geographic_breakdown(rows)` | Returns state/city distribution |
| `validate_rows(rows, shipped)` | Removes rows with addresses in shipped set |

**Shipment data functions:**
| Function | Purpose |
|---|---|
| `get_baseline_addresses()` | Decodes and returns historical shipment set from `BASELINE_SHIPMENTS_B64` |
| `get_shipped_addresses(file)` | Parses user-uploaded ShipStation export |
| `rows_to_csv_bytes(rows)` | Serializes row dicts to CSV bytes for download |

**Enrichment:**
| Function | Purpose |
|---|---|
| `lookup_gr(property_name)` | Looks up GreenRooms ID from `PROPERTY_GR_MAP` |
| `enrich_rows_with_gr(rows)` | Adds `Custom Field 2` (GR ID) to each row |

**Session state keys** (Streamlit `st.session_state`):
- `step` — current workflow step (1, 2, or 3)
- `normalized_rows` — output of Step 1
- `validated_rows` — output of Step 2
- `approved_rows`, `flagged_rows` — outputs of Step 3

### `parse_beagle_xlsx.py`

Standalone CLI version of the Beagle parser. Handles the same XLSX format but without the Streamlit UI. Useful for scripting or batch processing outside the web interface.

**Output CSV columns:**
```
Order #, Shipping Service, Height(in), Length(in), Width(in), Weight(oz),
Custom Field 1, Custom Field 2, Recipient Name, Address, City, State,
Postal Code, Country Code, Tenant Email
```

## Code Conventions

- **snake_case** for all function and variable names
- **UPPER_CASE** for module-level constants
- Streamlit session state keys use lowercase with underscores
- CSS variables for theming: `--bg`, `--orange`, `--green`, etc.
- Dark theme with orange (`#f97316`) accent; fonts: IBM Plex Mono (body), Syne (headers)
- All reference data (historical shipments, property→GR mappings) is hardcoded in `app.py` — no external APIs or databases

## No Tests / No Linter

There are currently no automated tests and no linter configuration. When making changes:

- Manually verify with `streamlit run app.py`
- Test file parsing by uploading representative XLSX/CSV samples through the UI
- Check that downloaded CSVs have the correct column headers and data

## Git & Branch Strategy

- **Main branch:** `master`
- **Claude branches:** Prefixed with `claude/` — automatically squash-merged to `master` via `.github/workflows/auto-merge-claude.yml`
- Git commits are GPG-signed (SSH key at `/home/claude/.ssh/commit_signing_key.pub`)

When working as Claude Code:
- Develop on the designated `claude/` branch
- Commit with descriptive messages
- Push with `git push -u origin <branch-name>`

## Common Tasks for AI Assistants

### Adding a new Beagle column mapping
Edit `parse_beagle_xlsx()` in `app.py`. The function does case-insensitive header detection — add new column aliases to the relevant header-scanning loop.

### Updating `PROPERTY_GR_MAP`
The dict is near the top of `app.py` after the base64 constants. Keys are lowercase property names; values are GreenRooms IDs (`GR####`).

### Updating baseline shipment history
`BASELINE_SHIPMENTS_B64` is a base64-encoded CSV string. To update:
1. Prepare the new CSV data
2. Base64-encode it: `base64.b64encode(csv_bytes).decode()`
3. Replace the string in `app.py`

### Changing the 90-day deduplication window
Search for `90` or `timedelta` in `app.py` to find the shipment age cutoff logic in `get_shipped_addresses()` or `validate_rows()`.

### Adding a new Step 2 / Step 3 output column
Update `OUTPUT_FIELDNAMES` (or equivalent output field list) and the corresponding row-building logic in the relevant parse function.

## Environment

- No environment variables required
- No external API calls
- No database
- Self-contained: all reference data embedded in `app.py`
