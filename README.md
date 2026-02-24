# Air Filter Fulfillment

Streamlit app that converts Beagle property management reports into
ShipStation-ready CSVs, validates against shipment history, and checks
charge detail enrollment before shipping.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # add your Anthropic API key
streamlit run app.py
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Parses filter orders from pasted emails (Step 1 email tab) |

## Sidecar files

| File | Description |
|---|---|
| `baseline_shipments.csv` | Historical ShipStation export used to exclude already-shipped addresses in Step 2. Restore from git if missing. |
| `gr_lookup_custom.json` | Auto-created on first use. Stores company → GR code overrides added via the sidebar. Not committed to git. |

## Running tests

```bash
pytest tests/
```

## Three-step flow

1. **Convert** — Upload a Beagle XLSX report (or paste a filter request email)
   to produce a normalised order list.
2. **Validate** — Exclude addresses already in the shipping baseline; optionally
   add a recent ShipStation export for addresses shipped in the last few days.
3. **Charge Detail** — Upload a charge detail report from your PMS (Buildium,
   AppFolio, etc.) to flag non-paying tenants before shipping.

At the end of a run, use the **Save to baseline** button to record the shipped
addresses so they are excluded in future runs.

## Updating the baseline

The baseline date shown in the UI is read from the file's last-modified time —
it updates automatically whenever `baseline_shipments.csv` is replaced.

To roll in a new ShipStation export as the baseline:
1. Export all shipments from ShipStation (Shipments → Export).
2. Replace `baseline_shipments.csv` with the new file.
3. Commit and push — the UI date updates on next page load.

Alternatively, use the **Save to baseline** button inside the app after each
run to append new addresses incrementally.

## CLI parser

`parse_beagle_xlsx.py` is a thin CLI wrapper around the same parser used by
the app. Useful for bulk conversion without opening a browser:

```bash
python3 parse_beagle_xlsx.py report.xlsx "Property Name" output.csv
```
