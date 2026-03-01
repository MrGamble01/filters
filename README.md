# Filter Tools

A Streamlit app for processing air filter fulfillment orders. Takes a raw Beagle survey export and produces a clean, validated CSV ready to ship — in about 60 seconds.

## What it does

Three steps, each optional:

**Step 1 — Convert**
Upload a Beagle `.xlsx` report. The app parses tenant names, addresses, filter sizes, and emails, normalizes everything, and outputs a standardized CSV. Property name is auto-detected from the filename.

**Step 2 — Validate Against Shipments**
Cross-references against ShipStation history to remove tenants who already received filters within the last 90 days. Shipment history through early 2024 is baked in — just upload a recent ShipStation export to cover anything newer.

**Step 3 — Validate Against Charges**
Upload a charge detail file. Tenants who aren't paying get flagged (not deleted) and download as a separate CSV for manual review.

## Running locally

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Requirements

- Python 3.8+
- `streamlit`
- `openpyxl`
- `pandas`

## Input formats

| File | Format | Used in |
|------|--------|---------|
| Beagle survey export | `.xlsx` | Step 1 |
| ShipStation shipments export | `.csv` | Step 2 |
| Charge detail | `.csv` | Step 3 |

## Output

- A normalized CSV of tenants to ship to
- A separate CSV of flagged (non-paying) tenants if Step 3 is run
