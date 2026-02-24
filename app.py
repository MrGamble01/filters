import streamlit as st
import streamlit.components.v1 as components
import anthropic
import openpyxl
import csv
import re
import io
import pandas as pd
import base64
from PIL import Image

# Baseline ShipStation shipments file (all-time through Dec 2024) — baked in permanently
# Baseline snapshot: ShipStation all-time history through Feb 2026, stored as sidecar CSV.
# To update: export fresh history from ShipStation and replace baseline_shipments.csv.
BASELINE_SNAPSHOT = "Feb 2026"

# Beagle logo as favicon
import io as _io
_FAVICON_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAgACADASIAAhEBAxEB/8QAGgAAAgIDAAAAAAAAAAAAAAAABwgBBgMEBf/EACwQAAIBAwQBAgUEAwAAAAAAAAECAwQFEQAGEiEHE0EVUVJhgQgxN3UysrP/xAAZAQACAwEAAAAAAAAAAAAAAAABBwACBQb/xAAiEQABAwQCAgMAAAAAAAAAAAABAgMRBAUhQQAxElETobH/2gAMAwEAAhEDEQA/AMXiz+ONvf18X+o1WvIHmCybWuslpgo5rpWwnEyo4SOM/SWIOT9gPzrZsV8p7B4f29VVBrlWWjiiV6ONHkVvTLDAfrvjxHzLAe+dLxNuDcF23X8RoZ5p61XlamPoR81VuRJ4qvHlgk5A/ckjvvSvtNkRXVT7r4lCSrZEmTsDr3xk3S8qoqVlpkwsgaBgQNE98POzPM9hvtfBQ19FUWiaobhDJKweF2+nn1g9j2x3++rd5M/jvcX9bUf8zpVby7jaFsecgzVlbVVYCqFVVPppkAdDLI3Qx/iNH+gvE99/TtVXGqLNObNURSO3Zdo1dCxPuTxz+dWu1kZo3WainEJK/EiZyDqc6PBa7y9VtusPmVBHkDEYI3rY5ZPGcMU/jPb8U8SSxm3w5V1BBwoI6P30PfI237Ve913S1We4Wzbs9DRrUXFzSRr6sT8ubeooDjAK5GcMG71z9oebLPZNqW20S2avllo6ZIWdXQKxUYyO9TsK+7b3BUeQNwXqsiopLhTmLhMRzjpihTr6jngMD3C/MaDVurqF96qWkgTiIMkqA6zqdffI7X0dYwzTIUCYzMiAEk943G/rg/uly2bJR0dldLxV01sLrDXRMkbTh25MPTYHgue17J7OfkGG3LQ222+G7nRWdAtBHZpvQwc5Uxk5z7k5zn76UXRbofLVIvi19pVluqpKv4fJRLUKy8MFSqEg99DiPxrob5aH3PgNPKglUkT7yVfvXvA5g2W7Mt/MH4SVJgGPWI/O/Wef/9k="
def _get_favicon():
    try:
        return Image.open(_io.BytesIO(base64.b64decode(_FAVICON_B64)))
    except:
        return "⚡"

st.set_page_config(
    page_title="Filter Tools",
    page_icon=_get_favicon(),
    layout="centered"
)

LOGO_B64 = "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"

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

:root {
    --bg: #080808;
    --surface: #111111;
    --border: #1f1f1f;
    --border-bright: #2a2a2a;
    --text: #e8e8e8;
    --muted: #444;
    --orange: #f97316;
    --orange-dim: rgba(249,115,22,0.08);
    --green: #22c55e;
    --yellow: #eab308;
    --red: #ef4444;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, [class*="css"] {
    font-family: 'Syne', sans-serif;
    background-color: var(--bg) !important;
    color: var(--text);
}

/* Subtle dot grid background */
.stApp {
    background-color: var(--bg) !important;
    background-image: radial-gradient(circle, #1e1e1e 1px, transparent 1px) !important;
    background-size: 28px 28px !important;
}

/* Fixed top navbar */
.stApp > div:first-child {
    padding-top: 64px !important;
}

#MainMenu, footer, header { visibility: hidden; }

/* No horizontal scroll */
html, body { overflow-x: hidden !important; max-width: 100vw !important; }
[data-testid="stAppViewContainer"] { overflow-x: hidden !important; }
[data-testid="stMain"] { overflow-x: hidden !important; }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }

/* Inputs */
[data-testid="stTextInput"] input {
    background-color: var(--surface) !important;
    border: 1px solid var(--border-bright) !important;
    border-radius: 4px !important;
    color: var(--text) !important;
    font-family: 'IBM Plex Mono', monospace !important;
    font-size: 13px !important;
    letter-spacing: 0.3px !important;
    transition: border-color 0.15s ease !important;
}
[data-testid="stTextInput"] input:focus {
    border-color: var(--orange) !important;
    box-shadow: 0 0 0 2px var(--orange-dim) !important;
    outline: none !important;
}
[data-testid="stTextInput"] label {
    color: var(--muted) !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 1px !important;
    font-family: 'IBM Plex Mono', monospace !important;
}

/* File uploader */
[data-testid="stFileUploader"] {
    background: var(--surface) !important;
    border: 1px dashed var(--border-bright) !important;
    border-radius: 4px !important;
    transition: border-color 0.15s ease !important;
}
[data-testid="stFileUploader"]:hover {
    border-color: var(--orange) !important;
}
[data-testid="stFileUploader"] * { color: var(--muted) !important; }
[data-testid="stFileUploaderDropzone"] { background: var(--surface) !important; }

/* Buttons - download */
/* Game toggle — looks like a dim label */
button[data-testid="baseButton-secondary"][kind="secondary"]:has(+ *) { display:none; }
div:has(> button[key="game_toggle"]) button {
    background: transparent !important;
    border: none !important;
    color: #1e1e1e !important;
    font-family: 'IBM Plex Mono', monospace !important;
    font-size: 10px !important;
    padding: 0 !important;
    width: auto !important;
    letter-spacing: 0.5px !important;
    cursor: pointer !important;
    transition: color 0.2s ease !important;
    margin-top: 32px !important;
}
div:has(> button[key="game_toggle"]) button:hover {
    color: #333 !important;
    background: transparent !important;
    border: none !important;
}

/* Footer action buttons - tutorial and restart */
[data-testid="stHorizontalBlock"]:last-of-type .stButton > button {
    background: transparent !important;
    border: none !important;
    color: #7a3a10 !important;
    font-family: 'IBM Plex Mono', monospace !important;
    font-size: 11px !important;
    padding: 2px 0 !important;
    width: auto !important;
    letter-spacing: 0.5px !important;
    transition: color 0.15s ease !important;
}
[data-testid="stHorizontalBlock"]:last-of-type .stButton > button:hover {
    color: #f97316 !important;
    background: transparent !important;
    border: none !important;
}

.stDownloadButton > button {
    background-color: var(--orange) !important;
    color: #000 !important;
    border: none !important;
    border-radius: 4px !important;
    font-family: 'IBM Plex Mono', monospace !important;
    font-weight: 500 !important;
    font-size: 12px !important;
    letter-spacing: 0.5px !important;
    padding: 10px 20px !important;
    width: 100% !important;
    margin-top: 4px !important;
    transition: background-color 0.15s ease !important;
}
.stDownloadButton > button:hover {
    background-color: #ea6c0a !important;
}

/* Buttons - action */
.stButton > button {
    background-color: transparent !important;
    color: var(--orange) !important;
    border: 1px solid var(--orange) !important;
    border-radius: 4px !important;
    font-family: 'IBM Plex Mono', monospace !important;
    font-weight: 500 !important;
    font-size: 12px !important;
    letter-spacing: 0.5px !important;
    padding: 10px 20px !important;
    width: 100% !important;
    margin-top: 4px !important;
    transition: all 0.15s ease !important;
}
.stButton > button:hover {
    background-color: var(--orange-dim) !important;
}

/* Alerts */
[data-testid="stAlert"] {
    background-color: var(--surface) !important;
    border-radius: 4px !important;
    border: 1px solid var(--border-bright) !important;
    font-family: 'IBM Plex Mono', monospace !important;
    font-size: 12px !important;
}

/* Expander */
[data-testid="stExpander"] {
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-radius: 4px !important;
}
[data-testid="stExpander"] summary {
    color: var(--muted) !important;
    font-size: 12px !important;
    font-family: 'IBM Plex Mono', monospace !important;
}

/* Dataframe */
[data-testid="stDataFrame"] {
    border: 1px solid var(--border) !important;
    border-radius: 4px !important;
}

/* Divider */
hr { border-color: var(--border) !important; margin: 24px 0 !important; }

/* Step badge */
.step-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 1px solid var(--border-bright);
    border-radius: 2px;
    padding: 4px 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--muted);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 14px;
}
.step-badge.active {
    border-color: var(--orange);
    color: var(--orange);
    background: var(--orange-dim);
}
.step-badge.done {
    border-color: #1a3a25;
    color: var(--green);
    background: rgba(34,197,94,0.05);
}

/* Stat */
.stat { margin-bottom: 20px; }
.stat-num {
    font-family: 'Syne', sans-serif;
    font-size: 36px;
    font-weight: 800;
    color: var(--orange);
    line-height: 1;
    letter-spacing: -1px;
}
.stat-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--muted);
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
}

</style>
""", unsafe_allow_html=True)


# --- Core logic ---

STANDARD_FILTER_PATTERN = re.compile(r'^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$', re.IGNORECASE)
PO_BOX_PATTERN = re.compile(r'(p\.?\s*o\.?\s*box|post\s+office\s+box)', re.IGNORECASE)
# Filter dash notation: 16x25x1-3 means qty 3 of 16x25x1
FILTER_DASH_QTY_PATTERN = re.compile(r'^(.+?)-(\d+)$')

def normalize_filter_size(s):
    """Normalize filter size to NxNxN format. Returns (normalized, is_standard, qty_from_dash)."""
    if not s:
        return None, False, 1
    s = str(s).strip()
    # Check for dash-quantity notation: 16x25x1-3
    qty_from_dash = 1
    dash_match = FILTER_DASH_QTY_PATTERN.match(s)
    if dash_match:
        potential_size = dash_match.group(1).strip()
        potential_qty = int(dash_match.group(2))
        # Only treat as qty if the base looks like a filter size
        if re.search(r'[xX×]', potential_size):
            s = potential_size
            qty_from_dash = potential_qty
    s = re.sub(r'\s*[×x]\s*', 'x', s, flags=re.IGNORECASE)
    s = s.rstrip('.')
    s = s.strip()
    is_standard = bool(STANDARD_FILTER_PATTERN.match(s))
    return s, is_standard, qty_from_dash

def normalize_zip(zipcode):
    """Normalize zip code — fix leading zeros, strip 9-digit extension."""
    if not zipcode:
        return ''
    z = str(zipcode).strip()
    # Remove .0 from Excel numeric conversion
    if z.endswith('.0'):
        z = z[:-2]
    # Strip 9-digit extension (78701-1234 -> 78701)
    z = z.split('-')[0].strip()
    # Pad leading zeros to 5 digits
    if z.isdigit() and len(z) < 5:
        z = z.zfill(5)
    return z

def parse_email_with_claude(email_text):
    """Use Claude API to extract addresses + filter sizes from a freeform email."""
    try:
        client = anthropic.Anthropic()
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": f"""Extract all property addresses and their HVAC filter sizes from this email.
Return ONLY valid JSON in this exact format, no other text:
{{
  "orders": [
    {{
      "address": "full street address",
      "city": "city name or empty string",
      "state": "2-letter state code or empty string",
      "zip": "5-digit zip or empty string",
      "filters": ["16x20x1", "20x25x1"]
    }}
  ]
}}

Rules:
- Each address gets its own entry even if in the same email
- filters should be normalized to NxNxN format (e.g. 16x20x1)
- If no filter size given for an address, use empty list
- If city/state/zip not in email, use empty string

Email:
{email_text}"""
            }]
        )
        import json
        raw = response.content[0].text.strip()
        # Strip markdown fences if present
        raw = re.sub(r'^```json\s*|^```\s*|\s*```$', '', raw, flags=re.MULTILINE).strip()
        data = json.loads(raw)
        return data.get('orders', []), None
    except Exception as e:
        return [], str(e)

def email_orders_to_rows(orders, property_name='Email Order'):
    """Convert parsed email orders into normalized row dicts."""
    rows = []
    for order in orders:
        addr = order.get('address', '').strip()
        city = order.get('city', '').strip()
        state = order.get('state', '').strip()
        zipcode = order.get('zip', '').strip()
        filters = order.get('filters', [])
        # Normalize each filter
        normalized = []
        has_nonstandard = False
        for f in filters:
            s, is_std, _ = normalize_filter_size(f)
            normalized.append((s, is_std))
            if not is_std:
                has_nonstandard = True
        filter_str = ', '.join(f for f, _ in normalized)
        filter_count = len(normalized)
        _multi_note = ''
        _multi_flag = False
        if filter_count >= 4:
            _multi_flag = True
            _multi_note = f'{filter_count} filters requested — review before shipping'
        elif filter_count in (2, 3):
            _multi_note = f'{filter_count} filters'
        rows.append({
            'Order #': '', 'Shipping Service': '', 'Height(in)': '',
            'Length(in)': '', 'Width(in)': '', 'Weight(oz)': '',
            'Custom Field 1': filter_str,
            'Custom Field 2': property_name,
            'Recipient Name': addr,
            'Address': addr,
            'City': city,
            'State': state,
            'Postal Code': zipcode,
            'Country Code': 'US',
            'Tenant Email': '',
            '_nonstandard_filter': has_nonstandard,
            '_po_box': is_po_box(addr),
            '_multi_note': _multi_note,
            '_multi_flag': _multi_flag,
            '_filter_count': filter_count,
            '_issue_note': '',
            '_tracking': '',
        })
    return rows


def is_po_box(address):
    """Return True if address appears to be a PO Box."""
    return bool(PO_BOX_PATTERN.search(str(address)))

# Fuzzy column name mapping — handles Beagle format variations
COLUMN_ALIASES = {
    'First Name': ['first name', 'firstname', 'first', 'fname', 'given name'],
    'Last Name': ['last name', 'lastname', 'last', 'lname', 'surname', 'family name'],
    'Email': ['email', 'email address', 'e-mail', 'tenant email', 'resident email'],
    'Street Address': ['street address', 'address', 'street', 'address 1', 'addr', 'property address'],
    'UNIT': ['unit', 'apt', 'apartment', 'suite', 'unit #', 'apt #', 'unit number'],
    'City': ['city', 'town', 'municipality'],
    'State': ['state', 'st', 'province'],
    'Zip Code': ['zip code', 'zip', 'postal code', 'zipcode', 'post code'],
    'Filter Size': ['filter size', 'filter', 'size', 'filter dimensions', 'air filter size'],
    'Quantity': ['quantity', 'qty', 'count', 'amount', 'number'],
}

def fuzzy_col_idx(headers, canonical_name):
    """Find column index using fuzzy matching against known aliases."""
    aliases = COLUMN_ALIASES.get(canonical_name, [canonical_name.lower()])
    for i, h in enumerate(headers):
        if h and str(h).strip().lower() in aliases:
            return i
    # Fallback: partial match
    for i, h in enumerate(headers):
        if h and canonical_name.lower() in str(h).strip().lower():
            return i
    return None

def merge_address(street, unit):
    street = str(street).strip() if street else ''
    unit = str(unit).strip() if unit and str(unit).lower() not in ('none', '') else ''
    if not unit:
        return street
    if re.search(r'(UNIT|APT|#)\s*' + re.escape(unit) + r'\s*$', street, re.IGNORECASE):
        return street
    if re.search(r'\bUNIT\s*$', street, re.IGNORECASE):
        return street.rstrip() + ' ' + unit
    return f'{street} UNIT {unit}'

def normalize_address_key(addr):
    """Normalize address for fuzzy matching — handles APT/UNIT/# variations."""
    if not addr:
        return ''
    addr = str(addr).lower().strip()
    # Standardize unit designators (longest first)
    addr = re.sub(r'\bapartment\b', 'apt', addr)
    addr = re.sub(r'\bsuite\b', 'apt', addr)
    addr = re.sub(r'\bunit\b', 'apt', addr)
    addr = re.sub(r'\bste\b', 'apt', addr)
    addr = re.sub(r'\bno\.?\b', 'apt', addr)
    addr = re.sub(r'#\s*', 'apt ', addr)
    # Remove punctuation except spaces
    addr = re.sub(r'[^\w\s]', '', addr)
    # Collapse whitespace
    addr = re.sub(r'\s+', ' ', addr).strip()
    # Standardize street type suffixes (longest first to avoid prefix collisions)
    addr = re.sub(r'\bboulevard\b', 'blvd', addr)
    addr = re.sub(r'\bavenue\b', 'ave', addr)
    addr = re.sub(r'\bstreet\b', 'st', addr)
    addr = re.sub(r'\bdrive\b', 'dr', addr)
    addr = re.sub(r'\bcircle\b', 'cir', addr)
    addr = re.sub(r'\bcourt\b', 'ct', addr)
    addr = re.sub(r'\bplace\b', 'pl', addr)
    addr = re.sub(r'\broad\b', 'rd', addr)
    addr = re.sub(r'\blane\b', 'ln', addr)
    # Cardinal directions (\b prevents mangling "Northwood", "Eastern", etc.)
    addr = re.sub(r'\bnorth\b', 'n', addr)
    addr = re.sub(r'\bsouth\b', 's', addr)
    addr = re.sub(r'\beast\b', 'e', addr)
    addr = re.sub(r'\bwest\b', 'w', addr)
    return addr

def extract_property_from_filename(filename):
    """Try to extract property name from Beagle report filename."""
    name = filename.rsplit('.', 1)[0]
    # Pattern: air-filter-responses-PROPERTY-NAME or Report_from_Beagle_air-filter-responses-PROPERTY-NAME
    match = re.search(r'air-filter-responses-(.+?)(?:__\d+_)*$', name, re.IGNORECASE)
    if match:
        prop = match.group(1).replace('-', ' ').replace('_', ' ').strip()
        # Title case but preserve all-caps abbreviations
        return prop.title()
    return None

# ── GR Number Lookup ─────────────────────────────────────────────────────────
# Keyed by lowercase full company name → GR number
GR_LOOKUP = {
    '101 property managment': 'GR0066',
    '1410 on richmond llc': 'GR0943',
    '1st choice property management': 'GR0050',
    '2 spuds llc': 'GR0850',
    '3 tier properties dba elevate miami property': 'GR0653',
    '4:10 property management': 'GR0630',
    '43 realty': 'GR0265',
    '4two realty': 'GR1073',
    '607 property management llc': 'GR0699',
    '7g property management': 'GR0379',
    'a b acq. property management': 'GR0436',
    'abc rental management llc': 'GR1020',
    'abode management': 'GR0441',
    'accent homes inc.': 'GR0037',
    'access more property management': 'GR0936',
    'active renter': 'GR1046',
    'ad astra property management group': 'GR0285',
    'advantage management inc': 'GR0849',
    'aksarben property management': 'GR0070',
    'albany student housing': 'GR0884',
    'alf properties': 'GR0814',
    'allan domb real estate': 'GR0817',
    'all county desert sea property management': 'GR0998',
    'allegiance property management, llc': 'GR0494',
    'allen properties': 'GR0812',
    'all phase property solutions llcc': 'GR0713',
    'all properties, llc': 'GR0977',
    'all property management and sales': 'GR0276',
    'allstates property management,': 'GR0250',
    'ally property management': 'GR0999',
    'ally property management, llc': 'GR0896',
    'altos realty & property management': 'GR1021',
    'ameritru': 'GR9999',
    'ameritrue real estate & management': 'GR0314',
    'ammt property management': 'GR1018',
    'amoriss pnw': 'GR0390',
    'ampere capital group': 'GR0376',
    'andersen, jung & co.': 'GR0421',
    'andren homes': 'GR0286',
    'apco living': 'GR1016',
    'apex legacy property management, llc': 'GR0785',
    'apm property management': 'GR0360',
    'apollo associates realty, llc': 'GR0396',
    'apple realty': 'GR0870',
    'applewood estates inc': 'GR0651',
    'arden': 'GR0829',
    'ariza 290 west': 'GR1055',
    'arizona management partners': 'GR0018',
    'arkansas property ~ management & real estate': 'GR0435',
    'arp commercial residential properties': 'GR1070',
    'a&r rentals': 'GR0623',
    'arrow property management, inc. (al)': 'GR0294',
    'arrow property management, inc. (tn)': 'GR0295',
    'artline apartments': 'GR0875',
    'asia pacific groups': 'GR0549',
    'aspen haus': 'GR0120',
    'aspire property management': 'GR0795',
    'aspm': 'GR1060',
    'asset management': 'GR0532',
    'associates property management': 'GR1040',
    'atlanta marietta': 'GR0921',
    'atom management': 'GR0717',
    'austin property management group': 'GR0818',
    'av property management, llc': 'GR0894',
    'aweigh real estate pm': 'GR0891',
    'aw manage llc': 'GR0942',
    'axe property management, inc.': 'GR0458',
    'az rental homes': 'GR0737',
    'aztex brownstone': 'GR0164',
    'aztex contigo': 'GR0169',
    'aztex greenpoint urban living': 'GR0171',
    'aztex mission terrace 1': 'GR0172',
    'aztex mission terrace ii': 'GR0173',
    'aztex the current at 37': 'GR0170',
    'babcock management': 'GR0608',
    'baker & nulf management': 'GR0553',
    'b and b real estate & investments': 'GR0455',
    'barker & co real estate, llc': 'GR0684',
    'bart gray realty property management': 'GR0407',
    'bearden rentals, llc': 'GR0643',
    'bellevue tower': 'GR0971',
    'belmont brokerage': 'GR1036',
    'berkshire hathaway homeservices newlin-miller, realtors': 'GR0473',
    'best property management & realty': 'GR0932',
    'better properties - metro': 'GR0481',
    'better property management': 'GR0778',
    'beverly springs 58 llc': 'GR0937',
    'bhj property management, llc': 'GR0362',
    'bigfoot management group': 'GR0351',
    'big skye properties': 'GR0477',
    'birmingham property management': 'GR0819',
    'bk management group llc': 'GR0720',
    'black & gold realty': 'GR0871',
    'blest investment group': 'GR0335',
    'bluebird west llc': 'GR0568',
    'blue chariot management': 'GR0686',
    'blue crown investments llc': 'GR0624',
    'bluefin property management': 'GR0298',
    'blue fox properties, llc': 'GR0003',
    'blueprint property management': 'GR0693',
    'bollin ligon walker': 'GR0528',
    "bonnie's blue star investments llc": 'GR0887',
    'boots asset management llc-s': 'GR0801',
    'bpm real estate': 'GR0703',
    'braden property management': 'GR0372',
    'bradway enterprises': 'GR0652',
    'brant rock': 'GR0762',
    'braum': 'GR0851',
    'brevard property experts & management': 'GR0338',
    'brick + willow property management': 'GR0872',
    'brickwood properties': 'GR0384',
    'bridge city properties': 'GR0754',
    'brighton real estate advisors': 'GR0616',
    'bristol on union': 'GR0760',
    'broadmoor property management': 'GR0635',
    'bronte holdings ii llc': 'GR0463',
    'brooks realty group': 'GR0388',
    'bruin property management': 'GR0820',
    'bruins properties': 'GR0640',
    'btt management': 'GR0844',
    'buck realty': 'GR0788',
    'budslick management co inc': 'GR0979',
    'buffalo management group': 'GR0748',
    'burton star properties': 'GR0714',
    'caf management': 'GR0710',
    'caliber group property management, co.': 'GR0611',
    'cal property management': 'GR0508',
    'candlewood property management, llc': 'GR0442',
    'cantey & company, inc': 'GR0756',
    'cardinal property management': 'GR0485',
    'ca realty managers': 'GR0579',
    'carriage real estate': 'GR0783',
    'casa realty & investments, inc.': 'GR0406',
    'century 21 ellensburg/center point realty llc': 'GR0461',
    'century 21 magnolia': 'GR0750',
    'century 21 north homes realty': 'GR0291',
    'century 21 prestige realty': 'GR0352',
    'century 21 wilbur realty': 'GR0391',
    'champagne property management llc': 'GR0842',
    'chautauqua': 'GR0948',
    'ci management': 'GR0395',
    'clearstone property management': 'GR0326',
    'clt prime properties': 'GR0443',
    'coastal pioneer realty': 'GR0984',
    'coastal view property management': 'GR0956',
    'coldwell banker real estate group': 'GR1002',
    'coldwell banker smith homes': 'GR0385',
    'colorado home sales inc': 'GR0816',
    'comfort property management llc': 'GR0567',
    'community studios llc': 'GR0519',
    'complete property management': 'GR0605',
    'complete re services inc': 'GR0597',
    'contra costa': 'GR0987',
    'contra costa property management': 'GR1014',
    'convenient rentals': 'GR0669',
    'conway property mgmt berryhill hoa': 'GR0888',
    'copper bottom property management': 'GR0846',
    'cornerstone management': 'GR0324',
    'cornerstone property management': 'GR0253',
    'cornerstone property management (maryland)': 'GR0610',
    'cornerstone rentals mgt': 'GR0488',
    'creative property management': 'GR0543',
    'cu property management': 'GR0700',
    'cwe': 'GR0763',
    'dakota property management llc': 'GR0444',
    "d'amico agency": 'GR0751',
    'davis stirling management': 'GR0469',
    'day & associates': 'GR0869',
    'dazcon properties': 'GR0905',
    'delmar': 'GR0764',
    'dickson co.': 'GR0914',
    'dobson property management llc': 'GR0880',
    'dolce vita property management': 'GR0426',
    'doss & spaulding properties': 'GR0613',
    'doud realty services, inc': 'GR0573',
    'dream big ventures inc.': 'GR0454',
    'dream huge realty': 'GR0382',
    'dreamteam property management, llc': 'GR0383',
    'd|r property management': 'GR0555',
    'duck brothers property management': 'GR0601',
    'dwc property group': 'GR0830',
    'dwm properties': 'GR0578',
    'e2 rentals': 'GR0725',
    'eagle real estate and property management, inc.': 'GR0889',
    'eagle realty group & associates': 'GR0501',
    'eastern property management': 'GR0841',
    'easyrent llc': 'GR0556',
    'echo rec llc': 'GR0478',
    'edinson property management llc': 'GR0559',
    'edisto property management group': 'GR0270',
    'eh james realty': 'GR1042',
    'element studio': 'GR0993',
    'elevate hawaii management llc': 'GR0789',
    'elite home realty and property managment': 'GR0497',
    'elite property management services, llc': 'GR0828',
    'elite real estate & professional management': 'GR0946',
    'ellis real estate': 'GR0344',
    'emerald creek mgt serviced': 'GR0030',
    'emerald property management': 'GR0620',
    'emerald property management il': 'GR0791',
    'encore': 'GR0258',
    'encore property management': 'GR0581',
    'encore real estate services': 'GR0394',
    'endeavour realty': 'GR0792',
    'ensuvi property management inc.': 'GR0336',
    'envision property management': 'GR0612',
    'evanir property management': 'GR0594',
    'evergreen property management group': 'GR0702',
    'evolution management company': 'GR0500',
    'evolve property management group llc': 'GR1059',
    'excalibur homes llc': 'GR0027',
    'expert property management': 'GR0949',
    'fairhaven property solutions llc': 'GR0874',
    'farnsworth realty & management': 'GR0930',
    'farran property management': 'GR1065',
    'farran property mgmt.': 'GR1066',
    'fertilis property management': 'GR0449',
    'fett management': 'GR0718',
    'fidelity management services, inc.': 'GR0368',
    'fidelity property management llc': 'GR0827',
    'fifth principle properties': 'GR0493',
    'fireside property management': 'GR0510',
    'first capitol real estate': 'GR0340',
    'first class realty & mgmt': 'GR0004',
    'first management inc.': 'GR0780',
    'first properties of the carolinas, inc': 'GR0920',
    'first realty': 'GR0975',
    'five star property management': 'GR0439',
    'five star real estate & property management': 'GR0299',
    'flagler duval management': 'GR0852',
    'flag property management inc.': 'GR0704',
    'flagship property management': 'GR0279',
    'flatmint': 'GR0627',
    'florida suncoast property management, llc': 'GR0633',
    'focus realty and management': 'GR0648',
    'folkstone properties': 'GR0981',
    'fordgang properties llc': 'GR0632',
    'forefront property management': 'GR0029',
    'fort lowell realty and propert': 'GR0251',
    'fortune real property management services inc': 'GR0672',
    'foundation homes property management': 'GR0268',
    'four points property management': 'GR1051',
    'four walls llc': 'GR0939',
    'fowler property management': 'GR0843',
    'fox and hound realty, inc.': 'GR1005',
    'frankson properties llc': 'GR0951',
    'freedom house property management': 'GR0387',
    'frrm ready llc': 'GR0938',
    'full spectrum property management': 'GR0918',
    'gage realty': 'GR1058',
    'gardner properties': 'GR0697',
    'garnet real estate services': 'GR0069',
    'garretts properties': 'GR0782',
    'gateway realty services inc.': 'GR0397',
    'gc realty & development llc': 'GR1053',
    'george goodwin realty, inc.': 'GR0414',
    'gill family properties': 'GR0708',
    'gill family properties llc': 'GR0709',
    'global realty group llc': 'GR0267',
    'goldberg group prop mgmt': 'GR0264',
    'golden rule real estate team': 'GR0284',
    'gold star property management llc': 'GR0636',
    'goodman property management': 'GR0689',
    'goodman property management - afh': 'GR0690',
    'good tenants services': 'GR0281',
    'granite key llc': 'GR0978',
    'great day property management': 'GR0521',
    'greater boston property management': 'GR0252',
    'greater orlando property management': 'GR0318',
    'green keys property management llc': 'GR0438',
    'green property management': 'GR0424',
    'green property management - oakwood': 'GR0540',
    'green property management - pinery group llc': 'GR0539',
    'group3 real estate': 'GR0403',
    'gulf coast palms property mgmt': 'GR0256',
    'gunn investment services, inc.': 'GR0740',
    'habitation realty': 'GR0468',
    'hallmark adams': 'GR0705',
    'hampshire property management': 'GR0674',
    'hampton': 'GR0876',
    'happy homes property management': 'GR0504',
    'h&a property management': 'GR0544',
    'harborlight property management, llc': 'GR0625',
    'harding lofts llc': 'GR0696',
    'hart management company, inc.': 'GR0637',
    'hartsville realty property management inc': 'GR1045',
    'haus realty & management': 'GR0924',
    'hawaii noa properties, inc.': 'GR0576',
    'hawkstone property management': 'GR0283',
    'hb rentals': 'GR0273',
    'heathwood': 'GR0647',
    'hein property management': 'GR0845',
    'helios property management': 'GR0498',
    'hendricks property management': 'GR0060',
    'hermiston property management': 'GR0912',
    'hidden coast homes': 'GR0327',
    'hidden ridge management, llc': 'GR0815',
    'high tech property management': 'GR0423',
    'hill & co. property management': 'GR0063',
    'holbrook & hawes management llc': 'GR0928',
    'home basics real estate': 'GR0437',
    'home finders realty, llc': 'GR0534',
    'hometown holdings': 'GR0537',
    'hometown property management': 'GR0306',
    'hometown realty': 'GR0305',
    'homeward property management llc': 'GR0288',
    'hope realty': 'GR0347',
    'house match': 'GR0058',
    'housing hub llc': 'GR0902',
    'housing opportunity development corporation': 'GR0886',
    'houston 4 lease': 'GR0729',
    'htip llc': 'GR0545',
    'hylton & company': 'GR0592',
    'imperial asset management': 'GR0822',
    'imt realty llc': 'GR0429',
    'income properties inc': 'GR0452',
    'indigo realty llc': 'GR0900',
    'ineto real estate services': 'GR0683',
    'infinite rentals': 'GR0923',
    'innago llc': 'GR1003',
    'innovative realty llc': 'GR0802',
    'insight property, inc.': 'GR0514',
    'integrity place realty & property management': 'GR0516',
    'intempus parent company, inc.': 'GR0472',
    'island club': 'GR0769',
    'itxprop management llc': 'GR1000',
    'ja property management': 'GR0988',
    'jaxon': 'GR0834',
    'jaz property management llc': 'GR0357',
    'jensen property management and leasing': 'GR0361',
    'jericho properties realty llc': 'GR0940',
    'jesse allen homes': 'GR1031',
    'jgm properties, llc': 'GR0542',
    'j&j investment properties llc': 'GR0897',
    'j & l holding corporation': 'GR1062',
    'johnson property mgmt llc': 'GR0006',
    'j. scott property management': 'GR0952',
    'jts real estate services, inc': 'GR0644',
    'just right property management, llc': 'GR0638',
    'jw property services llc': 'GR0614',
    'kader property management': 'GR0590',
    'kalasho co.': 'GR0629',
    'kanga property management': 'GR0301',
    'katzakian property management, ltd.': 'GR0799',
    'kcb realty & management': 'GR0955',
    'k clark property management ltd': 'GR0413',
    'kcp real estate llc': 'GR0995',
    'kearns & associates inc.': 'GR0593',
    'keaty real estate & property management': 'GR0847',
    'kellar realty & property management inc': 'GR0619',
    'key realty & property management llc': 'GR0358',
    'keyrenter property management overland park': 'GR0287',
    'keyrenter provo': 'GR0333',
    'keyrenter san diego': 'GR1030',
    'keyrenter st. louis west': 'GR0331',
    'keyrenter st pete': 'GR0320',
    'keyrenter tulsa pm': 'GR0167',
    'keyrenter washington dc': 'GR0366',
    'keyrenter west seattle': 'GR0369',
    'keystone of modesto properties': 'GR0280',
    'keystone properties': 'GR0996',
    'keystone signature properties -storehouse': 'GR0296',
    'keyway properties, inc': 'GR0811',
    'king and society': 'GR0563',
    'king properties unlimited inc.': 'GR0405',
    'kjax property': 'GR0839',
    'kjl properties': 'GR0467',
    'kmg properties': 'GR0730',
    'krs property management': 'GR0618',
    'k&s property management': 'GR0867',
    'l2 property management': 'GR0381',
    'lacy management inc': 'GR1035',
    'lahood property management': 'GR0308',
    'landbank realty': 'GR0453',
    'land headquarters - fl': 'GR0240',
    'land headquarters - tx': 'GR0241',
    'landmark resources': 'GR0602',
    'landseer management': 'GR0546',
    'lantana': 'GR0994',
    'lb2 communities co': 'GR0393',
    'leader group realty, llc': 'GR0738',
    'legacy living inc': 'GR0341',
    'legacy management services': 'GR0796',
    'legacy property management': 'GR0731',
    'lineage property management': 'GR0911',
    'liro property management co.': 'GR0562',
    'lisenby properties': 'GR0961',
    'living good property management company': 'GR0662',
    'ljj parkchester ny llc': 'GR0307',
    'local property management': 'GR0777',
    'locator property management': 'GR0721',
    'lockhart rentals llc': 'GR0536',
    'lofty property management': 'GR0901',
    'long beach living/dwg management company': 'GR0355',
    'love las vegas realty': 'GR0692',
    'lubin property management': 'GR0989',
    'lufkin property management, inc.': 'GR0434',
    'lux': 'GR1019',
    'lux management group': 'GR0838',
    'maddox management llc': 'GR0312',
    'magdieli property management llc': 'GR0275',
    'magellan chicago landlord': 'GR1037',
    'mahoney davidson': 'GR0052',
    'main street property management': 'GR0274',
    'maison management, inc': 'GR0476',
    'mann and myers realty group': 'GR0378',
    'maple street property management': 'GR0825',
    'marietta life': 'GR0904',
    'marin realty & prop. mgmt. group': 'GR0925',
    'martin investment properties inc': 'GR0560',
    'maselle & associates': 'GR0641',
    'masters property management': 'GR0328',
    'masters real estate': 'GR0677',
    'maxwell construction': 'GR0574',
    'mccaw property management': 'GR0364',
    'mccourt property management': 'GR0626',
    'mcpm, inc.': 'GR0582',
    'messina property managment': 'GR0681',
    'metallic properties': 'GR0448',
    'metro tucson': 'GR0963',
    'millard realty and construction': 'GR1034',
    'mille real estate/drg realty': 'GR0277',
    'mirror lake property, llc': 'GR0807',
    'mission real estate llc': 'GR0798',
    'mlr property management services llc': 'GR0615',
    'modern property management': 'GR0278',
    'morehouse property management, inc.': 'GR1012',
    'mountain place home management': 'GR0419',
    'mount diablo realty and property management': 'GR0343',
    'moyer properties': 'GR0430',
    'mre property management': 'GR0538',
    'mtl properties': 'GR0821',
    'myers property management': 'GR0954',
    'my management company': 'GR0899',
    'nashdom realty': 'GR0909',
    'nearby property management': 'GR0292',
    'nestwell property management': 'GR0465',
    'newton & sons real estate': 'GR0645',
    'nexthome park place homes group': 'GR0513',
    'next home the agency group': 'GR0716',
    'next step property management': 'GR0460',
    'nh prime property management': 'GR0480',
    'n & l property management, llc': 'GR0895',
    'noble management': 'GR0293',
    'nordic real estate llc': 'GR0487',
    'north county property group': 'GR0021',
    'northern utah property management': 'GR0471',
    'northpath property management': 'GR0749',
    'northstar management': 'GR0464',
    'northstar property management': 'GR0507',
    'nps management': 'GR0596',
    'nwp management & brokerage': 'GR0408',
    'oak creek management': 'GR0694',
    'obsidian greenwood': 'GR0836',
    'ocean pacific property management, inc.': 'GR0561',
    'oc signature properties': 'GR0399',
    'okc homes 4 you': 'GR0745',
    'olive & co. property management': 'GR1001',
    'one source property management': 'GR0459',
    'onward property management llc': 'GR0547',
    'open door properties, llc': 'GR0456',
    'orange door property management': 'GR0960',
    'organ mountain property management': 'GR0670',
    'otp rentals': 'GR0595',
    'oz accommodations, inc': 'GR0945',
    'ozark gateway realty': 'GR0422',
    'pace enterprises llc': 'GR0309',
    'pacific apartment homes': 'GR0724',
    'pacific one properties': 'GR0679',
    'palisade flats': 'GR0970',
    'palm tree properties': 'GR0470',
    'palomar property management': 'GR0073',
    'pam t properties': 'GR0840',
    'pana realty llc': 'GR0575',
    'parc property management': 'GR0409',
    'park place property management': 'GR0055',
    'parks at treepoint': 'GR0837',
    'parkway properties': 'GR0657',
    'patos property management': 'GR0315',
    'patriot real estate partners': 'GR0739',
    'paul law realty': 'GR0931',
    'penn oak realty': 'GR0330',
    'penn station': 'GR0833',
    'performance property management': 'GR0451',
    'philly pm llc': 'GR0377',
    'pikus real estate and property management inc. powered by hackenberg realty group': 'GR0474',
    'pistilli management llc': 'GR0927',
    'platinum property management llc': 'GR0300',
    'platinum real estate': 'GR0908',
    'playa vista property management': 'GR0520',
    'pmi american river': 'GR0321',
    'pmi bay state': 'GR0617',
    'pmi bridgetown': 'GR0551',
    'pmi central oregon llc': 'GR0530',
    'pmi cuyahoga valley ral': 'GR0313',
    'pmi daytona beach': 'GR0933',
    'pmi dfw properties': 'GR0282',
    'pmi glen allen': 'GR0523',
    'pmi home team': 'GR0719',
    'pmi james river': 'GR0496',
    'pmi jcm realty group': 'GR0400',
    'pmi merced': 'GR0586',
    'pmi metro and suburban': 'GR1067',
    'pmi northbay': 'GR0980',
    'pmi northern utah': 'GR0685',
    'pmi of fairfax': 'GR0727',
    'pmi patron': 'GR0322',
    'pmi phx gateway': 'GR0462',
    'pmi pinellas': 'GR1039',
    'pmi raleighwood': 'GR0680',
    'pmi realty group inc': 'GR0639',
    'pmi santa cruz': 'GR0776',
    'pmi smart choice': 'GR0339',
    'pmi st. george': 'GR0446',
    'pmi sunny oc': 'GR0334',
    'pmi tyler': 'GR0797',
    'pmi united': 'GR1072',
    'pmi upstate sc': 'GR0342',
    'pmi wasatch': 'GR1068',
    'pmi wasatch - propertyware': 'GR1069',
    'pmi worcester': 'GR0992',
    'poised properties': 'GR0371',
    'pono property management llc': 'GR0365',
    'port city management': 'GR0346',
    'porter realty': 'GR0779',
    'portola property mgmt': 'GR0042',
    'ppm services of florida, llc': 'GR0753',
    'preferred properties steamboat': 'GR0634',
    'premier utah real estate': 'GR1054',
    'prestige management': 'GR0427',
    'price property management': 'GR0744',
    'prime properties': 'GR0100',
    'prime resource property management inc': 'GR0941',
    'progressive property management, inc.': 'GR0375',
    'project collective management': 'GR0599',
    'pro management realty': 'GR0667',
    'prop4lease': 'GR0417',
    'property management associates of atlanta, llc': 'GR0445',
    'property technology group': 'GR0621',
    'pros pm': 'GR0457',
    'province land company': 'GR0374',
    'pure pm of al-birmingham': 'GR0011',
    'pure pm of al-huntsville': 'GR0133',
    'pure pm of al-montgomery': 'GR0134',
    'pure pm of al-tuscaloosa': 'GR0056',
    'pure pm of az-scottsdale': 'GR0035',
    'pure pm of ca-antioch': 'GR0013',
    'pure pm of ca-chico-oroville': 'GR0067',
    'pure pm of ca-los angeles': 'GR0247',
    'pure pm of ca-northbay': 'GR0016',
    'pure pm of ca-orange county': 'GR0154',
    'pure pm of ca-sacramento': 'GR0012',
    'pure pm of ca-san diego': 'GR0054',
    'pure pm of ca-silicon': 'GR0015',
    'pure pm of ca-temecula': 'GR0059',
    'pure pm of co-denver': 'GR0118',
    'pure pm of fl-bonita springs': 'GR0136',
    'pure pm of fl-ocala': 'GR0068',
    'pure pm of fl-orlando': 'GR0412',
    'pure pm of ga-atlanta': 'GR0041',
    'pure pm of ga-augusta': 'GR0038',
    'pure pm of ia-omaha': 'GR0008',
    'pure pm of ks-topeka': 'GR0017',
    'pure pm of ky-lexington': 'GR0053',
    'pure pm of mn-twin cities': 'GR0024',
    'pure pm of nc-asheville': 'GR0039',
    'pure pm of nc-charlotte': 'GR0033',
    'pure pm of nm-albuquerque': 'GR0036',
    'pure pm of nv-las vegas': 'GR0031',
    'pure pm of ok-oklahoma city': 'GR0135',
    'pure pm of or-portland': 'GR0057',
    'pure pm of sc-charleston': 'GR0001',
    'pure pm of sc-columbia': 'GR0032',
    'pure pm of tn-nashville': 'GR0064',
    'pure pm of tx-austin': 'GR0002',
    'pure pm of tx-corpus christi': 'GR0019',
    'pure pm of tx-dallas': 'GR0010',
    'pure pm of wa-bellingham': 'GR0014',
    'pure pm of wa-tacoma': 'GR0034',
    'pure property management - brick by brick': 'GR0983',
    'quantive management bsd llc': 'GR0655',
    'ralston team properties': 'GR0072',
    'ram property management': 'GR0373',
    'ranch-n-home rentals, inc': 'GR0755',
    'raquel rath property management': 'GR0531',
    'raven real estate management': 'GR0263',
    'rde capital group llc': 'GR0349',
    'real estate brokers of arizona': 'GR0661',
    'real estate connection': 'GR0440',
    'real estate management partners llc': 'GR0580',
    'realiant property management': 'GR0650',
    'real property management absolute': 'GR0506',
    'real property management associates': 'GR0589',
    'real property management bay area': 'GR0316',
    'real property management bella': 'GR0348',
    'real property management connection': 'GR0664',
    'real property management crossroads': 'GR0505',
    'real property management expand': 'GR0919',
    'real property management folsom lake': 'GR0415',
    'real property management ignite': 'GR0515',
    'real property management legend': 'GR0486',
    'real property management masters': 'GR0297',
    'real property management north puget sound': 'GR0944',
    'real property management partners': 'GR0524',
    'real property management piedmont': 'GR0711',
    'real property management pinnacle': 'GR0518',
    'real property management priority': 'GR0678',
    'real property management reliance': 'GR0794',
    'real property management reliant': 'GR0707',
    'real property management upcountry': 'GR0447',
    'realsource property management, llc': 'GR0743',
    'realty one group heritage': 'GR0848',
    'red bird ga': 'GR0526',
    'red brick property management': 'GR0323',
    'red brick wv': 'GR0354',
    'red door equities management': 'GR0325',
    'red door investment grp, llc': 'GR0883',
    'red door property management': 'GR0386',
    'red house property management': 'GR0380',
    'red key management solutions': 'GR0598',
    'red moose management': 'GR0915',
    'red oak properties': 'GR0607',
    'redt homes': 'GR0646',
    're-homing texas llc': 'GR0260',
    'reliant property management': 'GR0025',
    'remax legacy': 'GR0416',
    'remi emerson residential': 'GR0303',
    'renewal property management': 'GR1047',
    'rentfy property management': 'GR0800',
    'rentix properties inc': 'GR0803',
    'r.e.n.t., llc': 'GR0483',
    'rentomatic property management': 'GR0959',
    'rentor': 'GR0420',
    'rentpros': 'GR0492',
    'rent solutions property management, llc': 'GR0722',
    'rentwerx llc': 'GR0023',
    'rentwise property management': 'GR0168',
    'residential matchmakers llc': 'GR0917',
    'residential premier real estate': 'GR0735',
    'rezen property management llc': 'GR0554',
    'richard realty': 'GR0418',
    'richmond area housing': 'GR0903',
    'r.i.c. property management': 'GR0691',
    'ridge rentals llc': 'GR0663',
    'rkak realty & property mgmt, inc': 'GR0628',
    'rochester property solutions': 'GR0410',
    'roi assets and property management': 'GR0569',
    'roma management': 'GR0533',
    'rowan property management': 'GR0319',
    'rowcal management tn  llc': 'GR0101',
    'royal gate management': 'GR0353',
    'royal realty': 'GR0311',
    'royce realty & property management': 'GR0793',
    'rpm experts': 'GR0588',
    'rpm inspired': 'GR0517',
    'rpm tidal': 'GR1010',
    'ruesch companies llc': 'GR0752',
    'saguaro villas': 'GR0972',
    'sail properties inc': 'GR0688',
    'salsberry property management, llc.': 'GR0701',
    'san miguel management lp': 'GR0957',
    'san simeon': 'GR0973',
    'santa fe property management, llc': 'GR0706',
    'santhosh real estate llc': 'GR0907',
    'scarlet properties': 'GR1052',
    'schermerhorn & co': 'GR0310',
    'sc property management': 'GR0558',
    'scudo llc': 'GR0269',
    'selecta homes, llc': 'GR0557',
    'select rental services': 'GR0550',
    'serene pm, llc': 'GR1011',
    'sermol properties llc': 'GR0986',
    'service star realty': 'GR0255',
    'shannon ellis & associates realty, llc': 'GR0503',
    'sheffield property management llc': 'GR0734',
    'shp property management llc': 'GR0698',
    'sia group': 'GR0882',
    'sienna properties': 'GR0007',
    'sierralv property management': 'GR0254',
    'sig property management': 'GR0332',
    'silver canyon realty inc': 'GR0565',
    'silver state realty & investments': 'GR0742',
    'simple property management llc': 'GR0317',
    'si property management': 'GR0682',
    'skidmore realty': 'GR0603',
    'skyline properties': 'GR0359',
    'skywater realty': 'GR1048',
    'sleep sound pm inc': 'GR0160',
    'solid rock realty': 'GR0898',
    'soulard properties': 'GR0935',
    'southern cal property management': 'GR0490',
    'southern family rentals': 'GR0712',
    'southern investors management inc/circle property management': 'GR0585',
    'southern living property management, llc': 'GR0600',
    'southern realty pm,llc': 'GR0695',
    'sowesco property management': 'GR0723',
    'sparks and company real estate': 'GR0411',
    'spectrum property management': 'GR0484',
    'spectrum rental properties': 'GR0922',
    'spirit rentals property management': 'GR0741',
    'springs homes for rent': 'GR0583',
    's & s property management': 'GR0982',
    'standard property management': 'GR0450',
    'standard property management - gallagher': 'GR0656',
    'starboard real estate/new door properties': 'GR0466',
    'starpointe realty management': 'GR0022',
    'stars and stripes homes, inc -partner': 'GR0302',
    'sterling properties & management llc': 'GR0893',
    'stever and associates': 'GR0304',
    'stl homes for rent llc': 'GR0289',
    'stone gate property group': 'GR0363',
    'stonepoint properties inc': 'GR1009',
    'story property management': 'GR0736',
    'strong properties, llc': 'GR1071',
    'summit properties international': 'GR1041',
    'summit property management': 'GR0673',
    'sunburst properties': 'GR0061',
    'suncoast property management services': 'GR0541',
    'sunshine property management': 'GR0809',
    'surelines financial group, llc': 'GR0495',
    'surpur & hugar': 'GR0491',
    'swoope real estate & property management': 'GR0350',
    'syrus properties, inc.': 'GR0906',
    'tailored homes property management, llc': 'GR0402',
    'tautfest rentals llc.': 'GR0715',
    'tcock llc': 'GR0389',
    'tc property management & rentals': 'GR0881',
    'td real estate llc': 'GR0259',
    'teicher group llc': 'GR0675',
    'texan property management': 'GR0892',
    'texas highview': 'GR1006',
    'texas prime real estate': 'GR0976',
    'texasrenters.com llc': 'GR0732',
    'tgo company': 'GR0432',
    'thara properties': 'GR0885',
    'thats right property management': 'GR0665',
    'thcd management': 'GR0475',
    'three pillars property management/abarim realty': 'GR0631',
    'thrive property group llc': 'GR0666',
    'tiber': 'GR0040',
    'tierra verde property management': 'GR0398',
    'timothy toye & associates': 'GR0784',
    'title one management., llc': 'GR0026',
    'tkp management llc': 'GR1015',
    'total realty associates inc': 'GR0668',
    'trademark real estate services': 'GR1013',
    'tree realty, llc': 'GR0813',
    'triad rental management': 'GR0826',
    'trilitco llc': 'GR0005',
    'trinity management and real estate services': 'GR0649',
    'trower realtors inc': 'GR0392',
    'troy property management': 'GR0577',
    'true property management': 'GR0525',
    'trybe property management': 'GR0890',
    'tu casa realty': 'GR0804',
    'turner brothers property management': 'GR0428',
    'turn-key property solutions, llc': 'GR0609',
    'turnkey rentals llc': 'GR0787',
    'twins property managers, llc': 'GR0604',
    'txc realty property management & hoa services': 'GR0824',
    'umt properties llc': 'GR0916',
    'unicorn properties': 'GR1049',
    'unified residential managment, llc': 'GR0953',
    'union realty group': 'GR0502',
    'urban equities': 'GR0257',
    'urban hive properties llc': 'GR0659',
    'usko realty inc': 'GR0356',
    'valley pacific realty and investments': 'GR0790',
    'vanderright': 'GR0654',
    'ventura property group': 'GR0985',
    'verra terra property management': 'GR0527',
    'vesta-now': 'GR0676',
    'vesta properties': 'GR0548',
    'vesta property management': 'GR0671',
    'victory north': 'GR0831',
    'vienna property management': 'GR0489',
    'vigilant property managment': 'GR0529',
    'vital homes property management': 'GR0810',
    'vybe home llc': 'GR0929',
    'washington metro management': 'GR1007',
    'watts realty co. inc.': 'GR0071',
    'weber realty management llc': 'GR0606',
    'weichert realtors home source': 'GR0571',
    'welcome home properties tn inc': 'GR0733',
    'white glove property management, inc.': 'GR0509',
    'wilson property management': 'GR0512',
    'windermere re/cb': 'GR0747',
    'winning realty': 'GR0570',
    'without worry property management': 'GR0431',
    'wj real estate llc': 'GR0272',
    'woda cooper companies, inc.': 'GR0958',
    'w property management': 'GR0020',
    'ws residential': 'GR0482',
    'yorktowne property management': 'GR0425',
    'your properties, inc. - pmi river city': 'GR0806',
    'ziser realty & property management': 'GR0271',
}

def lookup_gr(company_name):
    """Look up GR number for a company name. Tries exact match, then partial match."""
    if not company_name:
        return ''
    key = company_name.strip().lower()
    # Exact match
    if key in GR_LOOKUP:
        return GR_LOOKUP[key]
    # Try stripping trailing punctuation/whitespace variants
    key_clean = re.sub(r'[\s,\.]+$', '', key)
    if key_clean in GR_LOOKUP:
        return GR_LOOKUP[key_clean]
    # Partial match — key is contained in a lookup entry or vice versa
    for lookup_key, gr in GR_LOOKUP.items():
        if key_clean in lookup_key or lookup_key in key_clean:
            return gr
    return ''

def enrich_rows_with_gr(rows):
    """Populate Custom Field 3 with GR number based on Custom Field 2 (company name)."""
    for row in rows:
        if not row.get('Custom Field 3'):
            row['Custom Field 3'] = lookup_gr(row.get('Custom Field 2', ''))
    return rows

def parse_beagle_xlsx(file, property_name):
    wb = openpyxl.load_workbook(file)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = rows[0]

    first_name_col = fuzzy_col_idx(headers, 'First Name')
    last_name_col = fuzzy_col_idx(headers, 'Last Name')
    email_col = fuzzy_col_idx(headers, 'Email')
    street_col = fuzzy_col_idx(headers, 'Street Address')
    unit_col = fuzzy_col_idx(headers, 'UNIT')
    city_col = fuzzy_col_idx(headers, 'City')
    state_col = fuzzy_col_idx(headers, 'State')
    zip_col = fuzzy_col_idx(headers, 'Zip Code')
    filter_size_aliases = COLUMN_ALIASES['Filter Size']
    qty_aliases = COLUMN_ALIASES['Quantity']
    filter_size_cols = [i for i, h in enumerate(headers) if h and str(h).strip().lower() in filter_size_aliases]
    qty_cols = [i for i, h in enumerate(headers) if h and str(h).strip().lower() in qty_aliases]
    
    # Warn if critical columns missing
    missing_cols = []
    if first_name_col is None and last_name_col is None: missing_cols.append('Name')
    if street_col is None: missing_cols.append('Street Address')
    if zip_col is None: missing_cols.append('Zip Code')
    if missing_cols:
        raise ValueError(f"Could not find required columns: {', '.join(missing_cols)}. Headers found: {[h for h in headers if h]}")

    output_rows = []
    for row in rows[1:]:
        if not any(row):
            continue
        first = str(row[first_name_col]).strip() if row[first_name_col] else ''
        last = str(row[last_name_col]).strip() if row[last_name_col] else ''
        name = f'{first} {last}'.strip()
        email = str(row[email_col]).strip() if row[email_col] else ''
        address = merge_address(row[street_col], row[unit_col])
        city = str(row[city_col]).strip() if row[city_col] else ''
        state = str(row[state_col]).strip() if row[state_col] else ''
        zipcode = normalize_zip(row[zip_col] if zip_col is not None else '')

        filter_sizes = []
        for i, fs_col in enumerate(filter_size_cols):
            fs = row[fs_col]
            qty_val = row[qty_cols[i]] if i < len(qty_cols) else 1
            if fs:
                normalized, is_std, dash_qty = normalize_filter_size(fs)
                try:
                    qty = int(float(str(qty_val))) if qty_val else 1
                except (ValueError, TypeError):
                    qty = 1
                # dash notation overrides qty column
                qty = max(qty, dash_qty)
                for _ in range(qty):
                    filter_sizes.append((normalized, is_std))

        if not filter_sizes:
            continue

        filter_str = ', '.join(f for f, _ in filter_sizes)
        has_nonstandard = any(not s for _, s in filter_sizes)
        filter_count = len(filter_sizes)
        # Flag high quantity orders
        _multi_note = ''
        _multi_flag = False
        if filter_count >= 4:
            _multi_flag = True
            _multi_note = f'{filter_count} filters requested — review before shipping'
        elif filter_count in (2, 3):
            _multi_note = f'{filter_count} filters'

        output_rows.append({
            'Order #': '', 'Shipping Service': '', 'Height(in)': '',
            'Length(in)': '', 'Width(in)': '', 'Weight(oz)': '',
            'Custom Field 1': filter_str,
            '_nonstandard_filter': has_nonstandard,
            '_po_box': is_po_box(address),
            '_multi_note': _multi_note,
            '_multi_flag': _multi_flag,
            '_filter_count': filter_count,
            'Custom Field 2': property_name,
            'Recipient Name': name,
            'Address': address,
            'City': city,
            'State': state,
            'Postal Code': zipcode,
            'Country Code': 'US',
            'Tenant Email': email,
        })

    return output_rows

OUTPUT_FIELDNAMES = [
    'Order #', 'Shipping Service', 'Height(in)', 'Length(in)', 'Width(in)',
    'Weight(oz)', 'Custom Field 1', 'Custom Field 2', 'Custom Field 3', 'Recipient Name',
    'Address', 'City', 'State', 'Postal Code', 'Country Code', 'Tenant Email'
]

def rows_to_csv_bytes(rows):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=OUTPUT_FIELDNAMES, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode('utf-8')

REQUIRED_FIELDS = {
    'Address': 'Street address',
    'City': 'City',
    'State': 'State',
    'Postal Code': 'Zip code',
    'Custom Field 1': 'Filter size',
}

def get_missing_fields(row):
    """Return list of missing required field labels for a row."""
    missing = []
    for field, label in REQUIRED_FIELDS.items():
        val = row.get(field, '')
        if not str(val).strip():
            missing.append(label)
    return missing

def split_complete_incomplete(rows):
    """Split rows into (complete, incomplete). Incomplete = any required field missing."""
    complete = []
    incomplete = []
    for row in rows:
        missing = get_missing_fields(row)
        if missing:
            row = dict(row)
            row['_missing_fields'] = ', '.join(missing)
            incomplete.append(row)
        else:
            complete.append(row)
    return complete, incomplete

def incomplete_to_csv_bytes(rows):
    """CSV for sending to AM/PM — shows what's missing."""
    if not rows:
        return b''
    fieldnames = ['Recipient Name', 'Address', 'City', 'State', 'Postal Code',
                  'Custom Field 1', 'Tenant Email', 'Custom Field 2', 'Custom Field 3', '_missing_fields']
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode('utf-8')

def detect_duplicates(rows):
    """Find rows with the same normalized address within the same upload."""
    seen = {}
    dupes = []
    for i, row in enumerate(rows):
        key = normalize_address_key(row['Address'])
        if key in seen:
            dupes.append((seen[key], i, row))
        else:
            seen[key] = i
    return dupes

def compute_quality_score(rows):
    """0-100 score grading overall data quality."""
    if not rows:
        return 0, []
    total = len(rows)
    issues = []
    score = 100

    # Filter coverage (worth 40 pts)
    missing_filter = sum(1 for r in rows if not r.get('Custom Field 1','').strip())
    if missing_filter:
        pct = missing_filter / total
        deduction = int(pct * 40)
        score -= deduction
        issues.append(('filter', missing_filter, f"{missing_filter} missing filter size"))

    # Email coverage (worth 20 pts)
    missing_email = sum(1 for r in rows if not r.get('Tenant Email','').strip())
    if missing_email:
        pct = missing_email / total
        deduction = int(pct * 20)
        score -= deduction
        issues.append(('email', missing_email, f"{missing_email} missing email"))

    # Duplicate addresses (worth 20 pts)
    dupes = detect_duplicates(rows)
    if dupes:
        deduction = min(20, len(dupes) * 5)
        score -= deduction
        issues.append(('dupe', len(dupes), f"{len(dupes)} duplicate address{'es' if len(dupes) > 1 else ''}"))

    # Non-standard filter sizes (worth 20 pts)
    nonstandard = sum(1 for r in rows if r.get('_nonstandard_filter'))
    if nonstandard:
        pct = nonstandard / total
        deduction = int(pct * 20)
        score -= deduction
        issues.append(('nonstandard', nonstandard, f"{nonstandard} non-standard filter size{'s' if nonstandard > 1 else ''}"))

    return max(0, score), issues

def is_date_header(val):
    """Detect rows like 'Jan 16', 'Feb 9' that are date headers."""
    if not val:
        return False
    return bool(re.match(r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+$', str(val).strip(), re.IGNORECASE))

FILTER_SIZE_PATTERN = re.compile(r'\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?', re.IGNORECASE)
QTY_IN_PARENS = re.compile(r'\((\d+)\)\s*(.+?)(?:,|$)')
TRAILING_QTY = re.compile(r'^(.+?)\s*\((\d+)\)\s*$')

def parse_issues_csv_notes(notes_str):
    """Extract filter sizes and qty from notes field. Returns list of (size, qty) tuples."""
    if not notes_str or not notes_str.strip():
        return []
    notes_str = notes_str.strip()
    results = []
    # Format: (1) 16x20x1,(1) 15x20x1
    if QTY_IN_PARENS.search(notes_str):
        for m in QTY_IN_PARENS.finditer(notes_str):
            qty, size = int(m.group(1)), m.group(2).strip()
            if FILTER_SIZE_PATTERN.search(size):
                s, _, dq = normalize_filter_size(size)
                results.append((s, qty))
        if results:
            return results
    # Format: 20x25x1 (4)
    trailing = TRAILING_QTY.match(notes_str)
    if trailing:
        size, qty = trailing.group(1).strip(), int(trailing.group(2))
        if FILTER_SIZE_PATTERN.search(size):
            s, _, _ = normalize_filter_size(size)
            return [(s, qty)]
    # Plain: 16x20x1
    if FILTER_SIZE_PATTERN.search(notes_str):
        s, _, _ = normalize_filter_size(notes_str.strip())
        return [(s, 1)]
    return []

def parse_address_field(addr_str):
    """Split a full address string into street, city, state, zip."""
    if not addr_str:
        return '', '', '', ''
    addr_str = str(addr_str).strip()
    # Strip "Address: " prefix
    addr_str = re.sub(r'^Address:\s*', '', addr_str, flags=re.IGNORECASE)
    # Try pattern: street, city, ST zip or street, city, ST
    m = re.match(r'^(.+?),\s*([^,]+?),?\s*([A-Z]{2}),?\s*(\d{5}(?:-\d{4})?)?$', addr_str.strip(), re.IGNORECASE)
    if m:
        return m.group(1).strip(), m.group(2).strip(), m.group(3).strip().upper(), normalize_zip(m.group(4) or '')
    # Try: street city ST zip (no commas)
    m2 = re.search(r'^(.*?)\s+([A-Za-z\s]+?)\s+([A-Z]{2})\s+(\d{5})$', addr_str.strip())
    if m2:
        return m2.group(1).strip(), m2.group(2).strip(), m2.group(3).upper(), m2.group(4)
    # Just street, no city/state
    return addr_str.strip(), '', '', ''

def parse_issues_csv(file, property_override=None):
    """Parse the issues/exceptions CSV format into normalized rows."""
    import csv, io
    raw = file.read()
    try:
        text = raw.decode('utf-8-sig')
    except Exception:
        text = raw.decode('latin-1')
    reader = csv.reader(io.StringIO(text))
    rows_out = []
    for row in reader:
        if len(row) < 2:
            continue
        addr_raw = row[0].strip() if row[0] else ''
        pm_company = row[1].strip() if len(row) > 1 else ''
        notes = row[2].strip() if len(row) > 2 else ''
        tracking = row[3].strip() if len(row) > 3 else ''
        # Skip header row, date headers, empty rows
        if not addr_raw or addr_raw.lower() == 'property address':
            continue
        if is_date_header(addr_raw):
            continue
        # Parse address
        street, city, state, zipcode = parse_address_field(addr_raw)
        if not street:
            continue
        # Parse filter sizes from notes
        filter_pairs = parse_issues_csv_notes(notes)
        filter_sizes_list = []
        for size, qty in filter_pairs:
            for _ in range(qty):
                s, is_std, _ = normalize_filter_size(size)
                filter_sizes_list.append((s, is_std))
        filter_str = ', '.join(f for f, _ in filter_sizes_list) if filter_sizes_list else ''
        has_nonstandard = any(not s for _, s in filter_sizes_list)
        filter_count = len(filter_sizes_list)
        # Multi-filter flags
        _multi_note = ''
        _multi_flag = False
        if filter_count >= 4:
            _multi_flag = True
            _multi_note = f'{filter_count} filters requested — review before shipping'
        elif filter_count in (2, 3):
            _multi_note = f'{filter_count} filters'
        # Notes that aren't filter sizes = issue note
        is_filter_note = bool(filter_pairs)
        issue_note = notes if not is_filter_note and notes else ''
        property_name = property_override or pm_company or 'Unknown'
        rows_out.append({
            'Order #': '', 'Shipping Service': '', 'Height(in)': '',
            'Length(in)': '', 'Width(in)': '', 'Weight(oz)': '',
            'Custom Field 1': filter_str,
            'Custom Field 2': pm_company,
            'Recipient Name': street,  # no name field — use address as identifier
            'Address': street,
            'City': city,
            'State': state,
            'Postal Code': zipcode,
            'Country Code': 'US',
            'Tenant Email': '',
            '_nonstandard_filter': has_nonstandard,
            '_po_box': is_po_box(street),
            '_multi_note': _multi_note,
            '_multi_flag': _multi_flag,
            '_filter_count': filter_count,
            '_issue_note': issue_note,
            '_tracking': tracking,
        })
    return rows_out

def is_filter_size_tag(tag):
    """Return True if a tag string contains a filter size dimension."""
    tag = tag.strip()
    # Matches: 16x20x1, 16-1/4x21-1/2x1, 16.25x21.5x1, 20 x 30 x 1, etc.
    return bool(re.search(r'\d[\d./\-\s]*\s*[x×X]\s*\d[\d./\-\s]*\s*[x×X]\s*\d[\d./\-]*', tag, re.IGNORECASE))

NON_FILTER_UNIT_TAGS = {
    'lease only', 'no filter', 'wall ac', 'septic', 'hsn', 'hsn master lease',
    'flood disclosure needed', 'missing filter size(s)', 'rented', 'vacant',
}

def extract_filter_tags(unit_tags_str):
    """Extract only filter-size tags from a Unit Tags cell, ignoring label tags."""
    if not unit_tags_str or not unit_tags_str.strip():
        return []
    filters = []
    for tag in unit_tags_str.split(','):
        tag = tag.strip()
        if not tag:
            continue
        if tag.lower() in NON_FILTER_UNIT_TAGS:
            continue
        if is_filter_size_tag(tag):
            filters.append(tag)
        # else: ignore label-only tags like "White Cedar Community Association Inc."
    return filters

def normalize_fractional_filter(size_str):
    """Convert fractional/decimal filter sizes to standard NxNxN format."""
    import fractions
    s = size_str.strip()
    # Replace × with x
    s = re.sub(r'[×X]', 'x', s)
    # Normalize separators to x
    s = re.sub(r'\s*x\s*', 'x', s, flags=re.IGNORECASE)
    # Convert fractions like 16-1/4 → 16.25, 21-1/2 → 21.5
    def frac_to_dec(m):
        whole = int(m.group(1)) if m.group(1) else 0
        num = int(m.group(2))
        den = int(m.group(3))
        val = whole + num/den
        # Round to nearest .25
        return str(round(val * 4) / 4).rstrip('0').rstrip('.')
    s = re.sub(r'(\d+)-(\d+)/(\d+)', frac_to_dec, s)
    # Convert decimals like 16.25 → keep as is, just clean spaces
    s = re.sub(r'\s+', '', s)
    return s

def parse_tenant_directory_v1(file, property_override=None):
    """Parse report_builder tenant directory format (full fields including name/email/address)."""
    import csv, io
    raw = file.read()
    try:
        text = raw.decode('utf-8-sig')
    except Exception:
        text = raw.decode('latin-1')
    reader = csv.DictReader(io.StringIO(text))
    rows_out = []
    for row in reader:
        status = row.get('Status', '').strip()
        # Only include current tenants
        if status and status not in ('Current', ''):
            continue
        first = row.get('First Name', '').strip()
        last = row.get('Last Name', '').strip()
        full_name = f"{first} {last}".strip() if (first or last) else row.get('Tenant', '').strip()
        street1 = row.get('Unit Street Address 1', '').strip()
        street2 = row.get('Unit Street Address 2', '').strip()
        street = f"{street1} {street2}".strip() if street2 else street1
        city = row.get('Unit City', '').strip()
        state = row.get('Unit State', '').strip()
        zipcode = row.get('Unit Zip', row.get('Zip', row.get('Postal Code', ''))).strip()
        email = row.get('Emails', row.get('Email', '')).strip()
        unit_tags = row.get('Unit Tags', '').strip()
        filter_tags = extract_filter_tags(unit_tags)
        # Normalize each filter size
        normalized_filters = []
        has_nonstandard = False
        for tag in filter_tags:
            norm = normalize_fractional_filter(tag)
            s, is_std, _ = normalize_filter_size(norm)
            normalized_filters.append((s, is_std))
            if not is_std:
                has_nonstandard = True
        filter_str = ', '.join(f for f, _ in normalized_filters)
        filter_count = len(normalized_filters)
        _multi_note = ''
        _multi_flag = False
        if filter_count >= 4:
            _multi_flag = True
            _multi_note = f'{filter_count} filters requested — review before shipping'
        elif filter_count in (2, 3):
            _multi_note = f'{filter_count} filters'
        prop_name = property_override or 'Tenant Directory'
        rows_out.append({
            'Order #': '', 'Shipping Service': '', 'Height(in)': '',
            'Length(in)': '', 'Width(in)': '', 'Weight(oz)': '',
            'Custom Field 1': filter_str,
            'Custom Field 2': prop_name,
            'Recipient Name': full_name,
            'Address': street,
            'City': city,
            'State': state,
            'Postal Code': zipcode,
            'Country Code': 'US',
            'Tenant Email': email,
            '_nonstandard_filter': has_nonstandard,
            '_po_box': is_po_box(street),
            '_multi_note': _multi_note,
            '_multi_flag': _multi_flag,
            '_filter_count': filter_count,
            '_issue_note': '',
            '_tracking': '',
            '_source_format': 'tenant_dir_v1',
        })
    return rows_out

def parse_tenant_directory_v2(file, property_override=None):
    """Parse simple tenant directory format (Property field contains full address, no email)."""
    import csv, io
    raw = file.read()
    try:
        text = raw.decode('utf-8-sig')
    except Exception:
        text = raw.decode('latin-1')
    reader = csv.DictReader(io.StringIO(text))
    rows_out = []
    seen_units = {}  # unit_code → row index, to handle multiple tenants per unit
    for row in reader:
        property_field = row.get('Property', '').strip()
        unit = row.get('Unit', '').strip()
        tenant_raw = row.get('Tenant', '').strip()
        unit_tags = row.get('Unit Tags', '').strip()
        tenant_tags = row.get('Tenant Tags', '').strip()
        # Parse property field: "CODE - 1234 Street Name City, ST 78745"
        prop_match = re.match(r'^[A-Z0-9]+ - (.+)$', property_field)
        prop_clean = prop_match.group(1).strip() if prop_match else property_field
        # Parse: "Street, City, ST ZIPCODE" or "Street City, ST ZIPCODE"
        addr_match = re.match(
            r'^(.+?),\s*([^,]+?),?\s*([A-Z]{2})\s+(\d{5})\s*$',
            prop_clean, re.IGNORECASE
        )
        if addr_match:
            street = addr_match.group(1).strip()
            city = addr_match.group(2).strip()
            state = addr_match.group(3).strip().upper()
            zipcode = addr_match.group(4).strip()
        else:
            # Try "Street City ST ZIP" with no comma before city
            addr_match2 = re.match(
                r'^(.+?)\s+([A-Za-z\s]+?),\s*([A-Z]{2})\s+(\d{5})\s*$',
                prop_clean, re.IGNORECASE
            )
            if addr_match2:
                street = addr_match2.group(1).strip()
                city = addr_match2.group(2).strip()
                state = addr_match2.group(3).strip().upper()
                zipcode = addr_match2.group(4).strip()
            else:
                street = prop_clean
                city = ''
                state = ''
                zipcode = ''
        # Reverse tenant name: "Last, First" → "First Last"
        if ',' in tenant_raw:
            parts = tenant_raw.split(',', 1)
            full_name = f"{parts[1].strip()} {parts[0].strip()}"
        else:
            full_name = tenant_raw
        # Parse filter sizes
        filter_tags = extract_filter_tags(unit_tags)
        normalized_filters = []
        has_nonstandard = False
        for tag in filter_tags:
            norm = normalize_fractional_filter(tag)
            s, is_std, _ = normalize_filter_size(norm)
            normalized_filters.append((s, is_std))
            if not is_std:
                has_nonstandard = True
        filter_str = ', '.join(f for f, _ in normalized_filters)
        filter_count = len(normalized_filters)
        _multi_note = ''
        _multi_flag = False
        if filter_count >= 4:
            _multi_flag = True
            _multi_note = f'{filter_count} filters requested — review before shipping'
        elif filter_count in (2, 3):
            _multi_note = f'{filter_count} filters'
        prop_name = property_override or prop_clean or 'Tenant Directory'
        rows_out.append({
            'Order #': '', 'Shipping Service': '', 'Height(in)': '',
            'Length(in)': '', 'Width(in)': '', 'Weight(oz)': '',
            'Custom Field 1': filter_str,
            'Custom Field 2': prop_name,
            'Recipient Name': full_name,
            'Address': street,
            'City': city,
            'State': state,
            'Postal Code': zipcode,
            'Country Code': 'US',
            'Tenant Email': '',
            '_nonstandard_filter': has_nonstandard,
            '_po_box': is_po_box(street),
            '_multi_note': _multi_note,
            '_multi_flag': _multi_flag,
            '_filter_count': filter_count,
            '_issue_note': '',
            '_tracking': '',
            '_source_format': 'tenant_dir_v2',
        })
    return rows_out

def detect_csv_format(file):
    """Sniff the first line of a CSV to determine which parser to use."""
    import io
    raw = file.read(512)
    file.seek(0)
    try:
        header = raw.decode('utf-8-sig').split('\n')[0].lower()
    except Exception:
        header = raw.decode('latin-1').split('\n')[0].lower()
    if 'first name' in header and 'unit street address' in header:
        return 'tenant_dir_v1'
    if 'property' in header and 'unit tags' in header and 'tenant tags' in header:
        return 'tenant_dir_v2'
    if 'property address' in header and 'pm company' in header:
        return 'issues_csv'
    return 'issues_csv'  # fallback


def get_row_issues(row, dupe_indices):
    """Return list of issue strings for a single row."""
    issues = []
    if not row.get('Custom Field 1','').strip():
        issues.append('missing filter')
    if not row.get('Tenant Email','').strip():
        issues.append('no email')
    if row.get('_nonstandard_filter'):
        issues.append('unusual size')
    if row.get('_po_box'):
        issues.append('PO Box — UPS cannot deliver')
    if row.get('_multi_flag'):
        issues.append(f"{row.get('_filter_count',0)} filters — review")
    elif row.get('_multi_note') and row.get('_filter_count',1) > 1:
        issues.append(row['_multi_note'])
    return issues

def extract_addresses_from_df(df):
    """Extract normalized addresses from a dataframe."""
    preferred = ['Ship To - Address 1', 'Address', 'Ship To Address', 'address', 'Address 1']
    addr_col = None
    for p in preferred:
        if p in df.columns:
            addr_col = p
            break
    if not addr_col:
        for col in df.columns:
            if 'address' in col.lower():
                addr_col = col
                break
    if not addr_col:
        addr_col = df.columns[0]
    addresses = set()
    for val in df[addr_col].dropna():
        addresses.add(normalize_address_key(val))
    return addresses

def get_baseline_addresses():
    """Load baseline shipments from the sidecar CSV next to app.py."""
    import os
    baseline_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'baseline_shipments.csv')
    df = pd.read_csv(baseline_path, dtype=str)
    return extract_addresses_from_df(df)

def get_shipped_addresses(file):
    """Extract normalized addresses from a ShipStation CSV or other shipment file."""
    fname = file.name.lower()
    if fname.endswith('.xlsx'):
        df = pd.read_excel(file, dtype=str)
    else:
        file.seek(0)
        df = pd.read_csv(file, dtype=str)
    return extract_addresses_from_df(df)

def validate_rows(normalized_rows, shipped_addresses):
    new_rows = []
    excluded = []
    for row in normalized_rows:
        key = normalize_address_key(row['Address'])
        if key in shipped_addresses:
            excluded.append(row)
        else:
            new_rows.append(row)
    return new_rows, excluded


# --- Session state ---
if 'step' not in st.session_state:
    st.session_state.step = 1
if 'normalized_rows' not in st.session_state:
    st.session_state.normalized_rows = None
if 'validated_rows' not in st.session_state:
    st.session_state.validated_rows = None
if 'property_name' not in st.session_state:
    st.session_state.property_name = ''
if 'step1_stats' not in st.session_state:
    st.session_state.step1_stats = None
if 'step2_stats' not in st.session_state:
    st.session_state.step2_stats = None
if 'tutorial_step' not in st.session_state:
    st.session_state.tutorial_step = 0  # 0 = not shown


# --- Header ---
st.markdown(f"""
<div class='navbar'>
    <img src='data:image/png;base64,{LOGO_B64}' style='height:32px;'>
    <span class='navbar-right'>AIR FILTER FULFILLMENT</span>
</div>
""", unsafe_allow_html=True)

# ── TUTORIAL ─────────────────────────────────────────────────────────────

TUTORIAL_STEPS = [
    {
        "title": "How this works",
        "subtitle": "3 steps. Takes about 60 seconds.",
        "demo": """
        <div style='display:flex; gap:8px; margin:16px 0;'>
            <div style='flex:1; padding:12px; background:#111; border:1px solid #f97316; border-radius:4px; font-family:IBM Plex Mono,monospace; font-size:11px; color:#f97316;'>01 Convert</div>
            <div style='display:flex; align-items:center; color:#333; font-size:16px;'>→</div>
            <div style='flex:1; padding:12px; background:#111; border:1px solid #222; border-radius:4px; font-family:IBM Plex Mono,monospace; font-size:11px; color:#444;'>02 Validate Shipments</div>
            <div style='display:flex; align-items:center; color:#333; font-size:16px;'>→</div>
            <div style='flex:1; padding:12px; background:#111; border:1px solid #222; border-radius:4px; font-family:IBM Plex Mono,monospace; font-size:11px; color:#444;'>03 Validate Charges</div>
        </div>
        <p style='font-family:IBM Plex Mono,monospace; font-size:12px; color:#555; margin-top:8px;'>You can download and stop at any step. No step is required.</p>
        """,
    },
    {
        "title": "Step 1 — Upload your Beagle file",
        "subtitle": "This is the air filter response report from your PMS (Buildium, AppFolio, etc.) — pull it yourself or your PM will send it to you.",
        "demo": """
        <div style='background:#111; border:1px dashed #2a2a2a; border-radius:4px; padding:16px; margin:12px 0; text-align:center;'>
            <div style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#444;'>📄 Report_from_Beagle_air-filter-responses-<span style='color:#f97316;'>Freedom-House</span>.xlsx</div>
        </div>
        <div style='margin-top:8px; font-family:IBM Plex Mono,monospace; font-size:11px; color:#555;'>✓ Detected from filename — verify or edit below</div>
        <div style='background:#1a1a1a; border:1px solid #2a2a2a; border-radius:4px; padding:8px 12px; margin-top:6px; font-family:IBM Plex Mono,monospace; font-size:12px; color:#e8e8e8;'>Freedom House</div>
        <div style='display:flex; gap:16px; margin-top:16px;'>
            <div style='text-align:center;'><div style='font-family:Syne,sans-serif; font-size:28px; font-weight:800; color:#f97316;'>149</div><div style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#444; text-transform:uppercase;'>Rows</div></div>
            <div style='text-align:center;'><div style='font-family:Syne,sans-serif; font-size:28px; font-weight:800; color:#22c55e;'>100%</div><div style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#444; text-transform:uppercase;'>Filter Coverage</div></div>
            <div style='text-align:center;'><div style='font-family:Syne,sans-serif; font-size:28px; font-weight:800; color:#f0f0f0;'>100%</div><div style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#444; text-transform:uppercase;'>Email Coverage</div></div>
        </div>
        """,
    },
    {
        "title": "Step 2 — Cut anyone already shipped",
        "subtitle": "Baseline shipment history is already loaded — no file needed for that. If you want to catch very recent shipments, export a CSV from ShipStation (Shipments → Export). Otherwise just skip this step.",
        "demo": """
        <div style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#22c55e; margin-bottom:12px;'>✓ All previously shipped addresses loaded automatically.</div>
        <div style='background:#111; border:1px dashed #2a2a2a; border-radius:4px; padding:12px; margin-bottom:16px; font-family:IBM Plex Mono,monospace; font-size:11px; color:#444;'>📄 shipments_recent.csv — uploaded</div>
        <div style='display:flex; gap:16px;'>
            <div style='text-align:center;'><div style='font-family:Syne,sans-serif; font-size:28px; font-weight:800; color:#f97316;'>149</div><div style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#444; text-transform:uppercase;'>Total</div></div>
            <div style='text-align:center;'><div style='font-family:Syne,sans-serif; font-size:28px; font-weight:800; color:#22c55e;'>23</div><div style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#444; text-transform:uppercase;'>To Ship</div></div>
            <div style='text-align:center;'><div style='font-family:Syne,sans-serif; font-size:28px; font-weight:800; color:#ef4444;'>126</div><div style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#444; text-transform:uppercase;'>Excluded</div></div>
        </div>
        <p style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#555; margin-top:12px;'>The 126 excluded were already shipped filters. Only 23 are new.</p>
        """,
    },
    {
        "title": "Step 3 — Confirm they're paying",
        "subtitle": "This is the Charge Detail report from your PMS (Buildium, AppFolio, etc.) — pull it yourself or ask your PM. Non-payers get flagged for review, not automatically removed.",
        "demo": """
        <div style='display:flex; gap:16px; margin-bottom:16px;'>
            <div style='text-align:center;'><div style='font-family:Syne,sans-serif; font-size:28px; font-weight:800; color:#22c55e;'>19</div><div style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#444; text-transform:uppercase;'>Approved</div></div>
            <div style='text-align:center;'><div style='font-family:Syne,sans-serif; font-size:28px; font-weight:800; color:#eab308;'>4</div><div style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#444; text-transform:uppercase;'>Flagged</div></div>
        </div>
        <div style='background:#1a1a1a; border:1px solid #2a2a2a; border-radius:4px; padding:10px 14px; margin-bottom:6px; font-family:IBM Plex Mono,monospace; font-size:11px; color:#eab308;'>🟡 JOHN SMITH — 123 Main St, Austin TX</div>
        <div style='background:#1a1a1a; border:1px solid #2a2a2a; border-radius:4px; padding:10px 14px; font-family:IBM Plex Mono,monospace; font-size:11px; color:#eab308;'>🟡 JANE DOE — 456 Oak Ave, Round Rock TX</div>
        <p style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#555; margin-top:10px;'>Flagged rows download separately so someone can verify enrollment.</p>
        """,
    },
    {
        "title": "One last thing",
        "subtitle": "Tips that save time.",
        "demo": """
        <div style='display:flex; flex-direction:column; gap:10px; margin-top:8px;'>
            <div style='display:flex; gap:12px; align-items:flex-start;'>
                <span style='color:#f97316; font-family:IBM Plex Mono,monospace; font-size:12px; flex-shrink:0;'>→</span>
                <span style='font-family:IBM Plex Mono,monospace; font-size:12px; color:#666;'><strong style='color:#e8e8e8;'>Master CSV</strong> — upload multiple properties, grab one combined file at the end</span>
            </div>
            <div style='display:flex; gap:12px; align-items:flex-start;'>
                <span style='color:#f97316; font-family:IBM Plex Mono,monospace; font-size:12px; flex-shrink:0;'>→</span>
                <span style='font-family:IBM Plex Mono,monospace; font-size:12px; color:#666;'><strong style='color:#e8e8e8;'>Edit buttons</strong> — go back to any step without losing your data</span>
            </div>
            <div style='display:flex; gap:12px; align-items:flex-start;'>
                <span style='color:#f97316; font-family:IBM Plex Mono,monospace; font-size:12px; flex-shrink:0;'>→</span>
                <span style='font-family:IBM Plex Mono,monospace; font-size:12px; color:#666;'><strong style='color:#e8e8e8;'>Issues only</strong> — toggle in the preview to see only rows that need attention</span>
            </div>
            <div style='display:flex; gap:12px; align-items:flex-start;'>
                <span style='color:#f97316; font-family:IBM Plex Mono,monospace; font-size:12px; flex-shrink:0;'>→</span>
                <span style='font-family:IBM Plex Mono,monospace; font-size:12px; color:#666;'><strong style='color:#e8e8e8;'>Restart</strong> — wipes everything and starts fresh</span>
            </div>
        </div>
        """,
    },
]

# Render tutorial overlay if active
t_step = st.session_state.get('tutorial_step', 0)
if 1 <= t_step <= len(TUTORIAL_STEPS):
    slide = TUTORIAL_STEPS[t_step - 1]
    dots_html = "".join(
        f'<div class="tutorial-dot {"active" if i+1 == t_step else "done" if i+1 < t_step else ""}"></div>'
        for i in range(len(TUTORIAL_STEPS))
    )
    st.markdown(f"""
    <div class="tutorial-overlay"></div>
    <div class="tutorial-card">
        <div class="tutorial-step-num">{t_step} of {len(TUTORIAL_STEPS)}</div>
        <div class="tutorial-title">{slide["title"]}</div>
        <div class="tutorial-subtitle">{slide["subtitle"]}</div>
        <div class="tutorial-demo">{slide["demo"]}</div>
        <div class="tutorial-dots">{dots_html}</div>
    </div>
    """, unsafe_allow_html=True)

    t_col1, t_col2, t_col3 = st.columns([1, 1, 1])
    with t_col1:
        if t_step > 1:
            if st.button("← Back", key="tut_back"):
                st.session_state.tutorial_step -= 1
                st.rerun()
    with t_col2:
        if st.button("Skip Tutorial", key="tut_skip"):
            st.session_state.tutorial_step = 0
            st.rerun()
    with t_col3:
        if t_step < len(TUTORIAL_STEPS):
            if st.button("Next →", key="tut_next"):
                st.session_state.tutorial_step += 1
                st.rerun()
        else:
            if st.button("Let's go →", key="tut_done"):
                st.session_state.tutorial_step = 0
                st.rerun()

# ── SIDEBAR ───────────────────────────────────────────────────────────────



# ── STEP 1 ──────────────────────────────────────────────────────────────

step1_done = st.session_state.step >= 2

# Collapsed mini bar when done
if step1_done:
    col_a, col_b, col_c = st.columns([6, 2, 2])
    with col_a:
        s = st.session_state.step1_stats or {}
        st.markdown(f"""
        <div style='display:flex; align-items:center; gap:16px; padding:10px 0; border-bottom:1px solid #1f1f1f; margin-bottom:20px;'>
            <span style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#f97316; letter-spacing:1px; text-transform:uppercase;'>✓ Step 1</span>
            <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#555;'>{s.get('property','—')}</span>
            <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#555;'>{s.get('total',0)} rows</span>
            <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:{("#22c55e" if s.get("coverage",0) >= 80 else "#eab308" if s.get("coverage",0) >= 50 else "#ef4444")};'>{s.get("coverage",0)}% filter coverage</span>
            <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#555;'>{s.get("email_pct",0)}% email</span>
        </div>
        """, unsafe_allow_html=True)
    with col_c:
        if st.button("← Edit Step 1", key="back1"):
            st.session_state.step = 1
            st.rerun()
else:
    st.markdown('<div class="step-badge active">Step 1 — Convert Report</div>', unsafe_allow_html=True)

    upload_tab, email_tab = st.tabs(["  Upload File  ", "  ✉️ Paste Email  "])

    with email_tab:
        st.markdown("<p style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#555; margin:8px 0;'>Paste any filter request email — Claude will extract the addresses and filter sizes automatically.</p>", unsafe_allow_html=True)
        email_text_input = st.text_area(
            "email",
            height=150,
            placeholder='Paste the email here — any format works. e.g. "I need filters for 1513 Willis St Richmond VA 23224 (16x20x1)(14x24x1) and 849 Bramwell Rd Richmond VA 23225 (24x12x1)"',
            label_visibility="collapsed",
            key="email_paste_box"
        )
        email_prop_input = st.text_input("Property / company name (optional)", placeholder="e.g. StarPointe, Arrow TN", key="email_prop_box", label_visibility="collapsed")
        st.markdown("<p style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#333; margin-top:-4px; margin-bottom:8px;'>Property / company name (optional)</p>", unsafe_allow_html=True)

        if st.button("Extract orders →", key="parse_email_btn"):
            if email_text_input.strip():
                with st.spinner("Reading email..."):
                    orders, err = parse_email_with_claude(email_text_input)
                if err:
                    st.error(f"⚠️ Could not parse email: {err}")
                elif not orders:
                    st.warning("No addresses found. Try pasting more of the email or check it has addresses.")
                else:
                    email_rows = email_orders_to_rows(orders, property_name=email_prop_input.strip() or 'Email Order')
                    st.session_state['_pending_email_rows'] = email_rows
                    st.session_state['_pending_email_prop'] = email_prop_input.strip() or 'Email Order'
            else:
                st.warning("Paste an email first.")

        if st.session_state.get('_pending_email_rows'):
            email_rows = st.session_state['_pending_email_rows']
            st.markdown(f"<p style='color:#22c55e; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:12px;'>✓ Found {len(email_rows)} address(es)</p>", unsafe_allow_html=True)
            for r in email_rows:
                addr_full = ', '.join(x for x in [r['Address'], r['City'], r['State'], r['Postal Code']] if x)
                filter_display = r['Custom Field 1'] or '⚠ no filter'
                st.markdown(f"<div class='excluded-row' style='border-color:#1e3a1e; margin-bottom:4px;'>📍 {addr_full} &nbsp;·&nbsp; <span style='color:#f97316;'>{filter_display}</span></div>", unsafe_allow_html=True)

            st.markdown("<div style='margin-top:12px'></div>", unsafe_allow_html=True)
            if st.button("Add to session & continue →", key="email_confirm_btn"):
                email_rows = st.session_state.pop('_pending_email_rows')
                prop = st.session_state.pop('_pending_email_prop', 'Email Order')
                if 'master_rows' not in st.session_state:
                    st.session_state.master_rows = []
                current = list(st.session_state.get('normalized_rows', []))
                existing_keys = {(r['Recipient Name'], r['Address']) for r in current}
                new_email = [r for r in email_rows if (r['Recipient Name'], r['Address']) not in existing_keys]
                enrich_rows_with_gr(new_email)
                current.extend(new_email)
                st.session_state.normalized_rows = current
                st.session_state.property_name = prop
                master_keys = {(r['Recipient Name'], r['Address']) for r in st.session_state.master_rows}
                st.session_state.master_rows.extend([r for r in new_email if (r['Recipient Name'], r['Address']) not in master_keys])
                st.session_state.step1_stats = {
                    'property': prop, 'total': len(current),
                    'coverage': 100, 'email_pct': 0, 'files': 0, 'incomplete': 0,
                }
                st.session_state.step = 2
                st.rerun()

    with upload_tab:
        uploaded_files = st.file_uploader("Upload air filter response report from your PMS (Buildium, AppFolio, etc.) — pull it yourself or ask your PM to send it. Also accepts Tenant Directory CSV or Issues CSV.", type=["xlsx", "csv"], accept_multiple_files=True)

    file_property_map = {}
    all_confirmed = False
    property_name = None

    if uploaded_files:
        st.markdown("<div style='margin-top:12px'></div>", unsafe_allow_html=True)
        all_names_filled = True

        for uf in uploaded_files:
            detected = extract_property_from_filename(uf.name)
            col_a, col_b = st.columns([2, 2])
            with col_a:
                st.markdown(f"<p style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#555; margin-top:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'>📄 {uf.name}</p>", unsafe_allow_html=True)
            with col_b:
                hint_color = "#555" if detected else "#f97316"
                hint = "✓ Detected — verify" if detected else "⚠ Enter property name"
                st.markdown(f"<p style='font-family:IBM Plex Mono,monospace; font-size:10px; color:{hint_color}; margin-bottom:2px;'>{hint}</p>", unsafe_allow_html=True)
                prop = st.text_input(
                    label="prop",
                    value=detected or "",
                    placeholder="e.g. Freedom House",
                    label_visibility="collapsed",
                    key=f"prop_input_{uf.name}"
                )
                file_property_map[uf.name] = prop.strip()
                if not prop.strip():
                    all_names_filled = False

        if not all_names_filled:
            st.markdown("<p style='color:#f97316; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:4px;'>⚠️ Enter a property name for each file to continue.</p>", unsafe_allow_html=True)

        all_confirmed = all_names_filled
        property_name = next(iter(file_property_map.values()), None)

    # If we already have data from a previous run, show a continue option
    if not uploaded_files and st.session_state.normalized_rows:
        st.markdown(f"<p style='color:#444; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:8px;'>Previous data loaded: <span style='color:#f97316;'>{st.session_state.property_name} · {len(st.session_state.normalized_rows)} rows</span>. Upload a new file to replace, or continue with existing.</p>", unsafe_allow_html=True)
        if st.button("Continue with existing data →", key="continue_existing"):
            st.session_state.step = 2
            st.rerun()

    if uploaded_files and property_name and all_confirmed:
        all_rows = []
        file_results = []
        errors = []

        with st.spinner("Processing..."):
            for f in uploaded_files:
                try:
                    if not f.name.lower().endswith(('.xlsx', '.csv')):
                        errors.append((f.name, "File must be a Beagle .xlsx or issues .csv file"))
                        continue
                    file_prop = file_property_map.get(f.name, property_name)
                    if f.name.lower().endswith('.csv'):
                        csv_fmt = detect_csv_format(f)
                        if csv_fmt == 'tenant_dir_v1':
                            rows = parse_tenant_directory_v1(f, property_override=file_prop if file_prop else None)
                            fmt_label = "tenant directory (full)"
                        elif csv_fmt == 'tenant_dir_v2':
                            rows = parse_tenant_directory_v2(f, property_override=file_prop if file_prop else None)
                            fmt_label = "tenant directory (simple)"
                        else:
                            rows = parse_issues_csv(f, property_override=file_prop if file_prop else None)
                            fmt_label = "issues/exceptions"
                        if not rows:
                            errors.append((f.name, f"No valid rows found — detected as {fmt_label} format, check the file"))
                            continue
                    else:
                        rows = parse_beagle_xlsx(f, file_prop)
                        if not rows:
                            errors.append((f.name, "No valid rows found — check the file format matches the Beagle report template"))
                            continue
                    all_rows.extend(rows)
                    file_results.append((f.name, len(rows)))
                except Exception as e:
                    errors.append((f.name, f"Could not parse file — make sure it's a Beagle xlsx report ({str(e)})"))

        for fname, err in errors:
            st.error(f"❌ {fname}: {err}")

        if all_rows:
            st.markdown("<hr>", unsafe_allow_html=True)

            # Enrich with GR numbers
            enrich_rows_with_gr(all_rows)

            # Split complete vs incomplete
            complete_rows, incomplete_rows = split_complete_incomplete(all_rows)

            total_rows = len(all_rows)
            rows_with_filter = sum(1 for r in complete_rows if r.get('Custom Field 1','').strip())
            rows_with_email = sum(1 for r in complete_rows if r.get('Tenant Email','').strip())
            coverage_pct = int((rows_with_filter / len(complete_rows)) * 100) if complete_rows else 0
            email_pct = int((rows_with_email / len(complete_rows)) * 100) if complete_rows else 0
            dupes = detect_duplicates(complete_rows)
            nonstandard = [r for r in complete_rows if r.get('_nonstandard_filter')]

            # Stat cards
            cols = st.columns(4)
            with cols[0]:
                incomplete_note = f'<div style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#ef4444;margin-top:2px;">{len(incomplete_rows)} incomplete</div>' if incomplete_rows else ''
                st.markdown(f'<div class="stat"><div class="stat-num">{len(complete_rows)}</div><div class="stat-label">Ready Rows</div>{incomplete_note}</div>', unsafe_allow_html=True)
            with cols[1]:
                st.markdown(f'<div class="stat"><div class="stat-num">{len(file_results)}</div><div class="stat-label">Files</div></div>', unsafe_allow_html=True)
            with cols[2]:
                c = "#22c55e" if coverage_pct >= 80 else "#eab308" if coverage_pct >= 50 else "#ef4444"
                st.markdown(f'<div class="stat"><div class="stat-num" style="color:{c}">{coverage_pct}%</div><div class="stat-label">Filter Coverage</div></div>', unsafe_allow_html=True)
            with cols[3]:
                st.markdown(f'<div class="stat"><div class="stat-num">{email_pct}%</div><div class="stat-label">Email Coverage</div></div>', unsafe_allow_html=True)

            # Quality score badge
            qs, qs_issues = compute_quality_score(all_rows)
            qs_color = "#22c55e" if qs >= 80 else "#eab308" if qs >= 60 else "#ef4444"
            qs_issues_txt = " · ".join(d for _, _, d in qs_issues) if qs_issues else "No issues"
            st.markdown(f'''<div style="display:inline-flex;align-items:center;gap:8px;margin:8px 0 4px;font-family:IBM Plex Mono,monospace;font-size:11px;color:#555;">
                <span>Data quality</span>
                <span style="font-size:16px;font-weight:800;color:{qs_color}">{qs}</span><span style="color:{qs_color}">/100</span>
                <span style="color:#333">·</span><span>{qs_issues_txt}</span>
            </div>''', unsafe_allow_html=True)

            # Warnings
            # Incomplete rows banner
            if incomplete_rows:
                st.markdown(f"""
                <div style='background:rgba(239,68,68,0.05); border:1px solid #3a1a1a; border-radius:4px; padding:12px 16px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between;'>
                    <div>
                        <p style='font-family:IBM Plex Mono,monospace; font-size:12px; color:#ef4444; margin:0;'>🚩 {len(incomplete_rows)} row(s) excluded — missing required data</p>
                        <p style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#555; margin:4px 0 0;'>{len(complete_rows)} of {total_rows} rows are complete and ready to process</p>
                    </div>
                </div>
                """, unsafe_allow_html=True)
                with st.expander(f"See {len(incomplete_rows)} incomplete row(s)"):
                    for r in incomplete_rows:
                        addr = r.get('Address') or r.get('Recipient Name') or '—'
                        st.markdown(f'<div class="excluded-row" style="border-color:#3a1010;">⚠ {addr} — <span style="color:#ef4444;">missing: {r.get("_missing_fields","")}</span></div>', unsafe_allow_html=True)

            if coverage_pct < 80:
                st.markdown(f"<p style='color:#eab308; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:4px;'>⚠️ {100 - coverage_pct}% of residents missing a filter size — follow up before shipping.</p>", unsafe_allow_html=True)
            missing_emails = [r for r in all_rows if not r.get('Tenant Email','').strip()]
            if missing_emails:
                st.markdown(f"<p style='color:#444; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:2px;'>ℹ️ {len(missing_emails)} rows missing email — will still be included.</p>", unsafe_allow_html=True)
            if dupes:
                st.markdown(f"<p style='color:#ef4444; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:4px;'>⚠️ {len(dupes)} duplicate address(es) found — review before shipping.</p>", unsafe_allow_html=True)
            if nonstandard:
                st.markdown(f"<p style='color:#eab308; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:4px;'>⚠️ {len(nonstandard)} non-standard filter size(s) — verify before ordering.</p>", unsafe_allow_html=True)

            flagged_multi = [r for r in all_rows if r.get('_multi_flag')]
            noted_multi = [r for r in all_rows if r.get('_multi_note') and not r.get('_multi_flag')]
            if flagged_multi:
                st.markdown(f"<p style='color:#ef4444; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:4px;'>🚩 {len(flagged_multi)} row(s) requesting 4+ filters — flagged for review.</p>", unsafe_allow_html=True)
                with st.expander(f"See {len(flagged_multi)} high-quantity row(s)"):
                    for r in flagged_multi:
                        st.markdown(f'<div class="excluded-row" style="border-color:#3a1010;">🚩 {r["Recipient Name"]} — {r["Address"]} · <span style="color:#ef4444">{r["_multi_note"]}</span></div>', unsafe_allow_html=True)
            if noted_multi:
                st.markdown(f"<p style='color:#555; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:4px;'>ℹ️ {len(noted_multi)} row(s) with 2–3 filters noted.</p>", unsafe_allow_html=True)

            po_boxes = [r for r in all_rows if r.get('_po_box')]
            if po_boxes:
                st.markdown(f"<p style='color:#ef4444; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:4px;'>🚫 {len(po_boxes)} PO Box address(es) detected — UPS cannot deliver to these. They will be flagged in the preview.</p>", unsafe_allow_html=True)

            if len(file_results) > 1:
                for fname, count in file_results:
                    st.markdown(f'<div class="file-row">📄 {fname} <span style="color:#f97316">→ {count} rows</span></div>', unsafe_allow_html=True)

            # Smart preview
            dupe_set = {i for orig, dupe, _ in dupes for i in (orig, dupe)}
            with st.expander(f"Preview {total_rows} rows"):
                show_issues = st.checkbox("Issues only", key="preview_issues_only")
                preview_rows = []
                for i, r in enumerate(all_rows):
                    row_issues = get_row_issues(r, dupe_set)
                    if i in dupe_set:
                        row_issues.append('duplicate')
                    if show_issues and not row_issues:
                        continue
                    row_entry = {
                        'Status': '⚠' if row_issues else '✓',
                        'Name': r['Recipient Name'],
                        'Address': r['Address'],
                        'City': r['City'],
                        'ST': r['State'],
                        'Filter': r['Custom Field 1'] or '—',
                        'Email': '✓' if r.get('Tenant Email','').strip() else '✗',
                        'Issues': ', '.join(row_issues) if row_issues else '',
                    }
                    if r.get('_issue_note'):
                        row_entry['Note'] = r['_issue_note']
                    if r.get('_tracking'):
                        row_entry['Tracking'] = r['_tracking']
                    preview_rows.append(row_entry)
                if preview_rows:
                    st.dataframe(preview_rows, use_container_width=True, hide_index=True)
                else:
                    st.markdown("<p style='color:#22c55e; font-family:IBM Plex Mono,monospace; font-size:12px;'>✓ No issues found</p>", unsafe_allow_html=True)

            st.markdown("<div style='margin-top:16px'></div>", unsafe_allow_html=True)

            if 'master_rows' not in st.session_state:
                st.session_state.master_rows = []
            existing_keys = {(r['Recipient Name'], r['Address']) for r in st.session_state.master_rows}
            new_to_master = [r for r in complete_rows if (r['Recipient Name'], r['Address']) not in existing_keys]
            st.session_state.master_rows.extend(new_to_master)

            # Use only complete rows going forward
            ready_rows = complete_rows

            btn_cols = st.columns(4) if incomplete_rows else st.columns(3)
            with btn_cols[0]:
                csv_bytes = rows_to_csv_bytes(ready_rows)
                filename = f"{property_name.replace(' ', '_')}_normalized.csv"
                st.download_button(f"⬇️ Download ({len(ready_rows)})", data=csv_bytes, file_name=filename, mime="text/csv")
            with btn_cols[1]:
                if len(st.session_state.master_rows) > 0:
                    master_bytes = rows_to_csv_bytes(st.session_state.master_rows)
                    st.download_button(f"⬇️ Master ({len(st.session_state.master_rows)})", data=master_bytes, file_name="master_orders.csv", mime="text/csv")
            if incomplete_rows:
                with btn_cols[2]:
                    inc_bytes = incomplete_to_csv_bytes(incomplete_rows)
                    inc_filename = f"{property_name.replace(' ', '_')}_incomplete.csv"
                    st.download_button(f"⬇️ Incomplete ({len(incomplete_rows)})", data=inc_bytes, file_name=inc_filename, mime="text/csv", help="Send to AM/PM to fill in missing data")
            with btn_cols[-1]:
                if st.button("Validate Shipments →"):
                    st.session_state.normalized_rows = ready_rows
                    st.session_state.property_name = property_name
                    st.session_state.step1_stats = {
                        'property': property_name,
                        'total': len(ready_rows),
                        'coverage': coverage_pct,
                        'email_pct': email_pct,
                        'files': len(file_results),
                        'incomplete': len(incomplete_rows),
                    }
                    st.session_state.step = 2
                    st.rerun()

    elif uploaded_files and not property_name:
        st.warning("Enter a property name to continue.")

# ── STEP 2 ──────────────────────────────────────────────────────────────

if st.session_state.step >= 2:
    step2_done = st.session_state.step >= 3

    if step2_done:
        s = st.session_state.step2_stats or {}
        col_a, col_b, col_c = st.columns([6, 2, 2])
        with col_a:
            st.markdown(f"""
            <div style='display:flex; align-items:center; gap:16px; padding:10px 0; border-bottom:1px solid #1f1f1f; margin-bottom:20px;'>
                <span style='font-family:IBM Plex Mono,monospace; font-size:10px; color:#f97316; letter-spacing:1px; text-transform:uppercase;'>✓ Step 2</span>
                <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#555;'>{s.get("total",0)} checked</span>
                <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#22c55e;'>{s.get("new",0)} new</span>
                <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#ef4444;'>{s.get("excluded",0)} excluded (already shipped)</span>
            </div>
            """, unsafe_allow_html=True)
        with col_c:
            if st.button("← Edit Step 2", key="back2"):
                # Go back but keep all data intact
                st.session_state.step = 2
                st.rerun()
    else:
        st.markdown("<div style='margin-top:28px'></div>", unsafe_allow_html=True)
        st.markdown('<div class="step-badge active">Step 2 — Validate Against Shipments</div>', unsafe_allow_html=True)
        st.markdown("<p style='color:#444; font-family:IBM Plex Mono,monospace; font-size:12px; margin-top:-4px; margin-bottom:16px;'>Previously shipped addresses are automatically excluded — baseline covers all history through " + BASELINE_SNAPSHOT + ".</p>", unsafe_allow_html=True)
        st.markdown(f"<p style='color:#22c55e; font-family:IBM Plex Mono,monospace; font-size:11px; margin-bottom:12px;'>✓ All shipments through {BASELINE_SNAPSHOT} loaded automatically.</p>", unsafe_allow_html=True)

        recent_file = st.file_uploader("Upload recent ShipStation export (.csv) — optional, only needed for shipments in the last few days", type=["csv", "xlsx"], key="recent")
        st.markdown("<p style='color:#333; font-family:IBM Plex Mono,monospace; font-size:11px; margin-top:-8px; margin-bottom:12px;'>To get this file: ShipStation → Shipments → Export. Skip if you don't have ShipStation access — baseline history still applies.</p>", unsafe_allow_html=True)

        run_validation = recent_file is not None
        if not run_validation:
            if st.button("Run with baseline only →", key="baseline_only"):
                run_validation = True
                st.session_state.baseline_only_mode = True
            else:
                st.session_state.baseline_only_mode = False

        if run_validation:
            with st.spinner("Comparing against shipment history..."):
                shipped = get_baseline_addresses()
                if recent_file and recent_file.name.lower().endswith(('.csv', '.xlsx')):
                    shipped |= get_shipped_addresses(recent_file)
                elif recent_file:
                    st.error("⚠️ Please upload a CSV or xlsx file exported from ShipStation.")
                    run_validation = False
                new_rows, excluded = validate_rows(st.session_state.normalized_rows, shipped)

            if run_validation:
                mode_note = " (baseline only)" if st.session_state.get("baseline_only_mode") else ""
                st.markdown("<hr>", unsafe_allow_html=True)
                cols = st.columns(3)
                with cols[0]:
                    st.markdown(f'<div class="stat"><div class="stat-num">{len(st.session_state.normalized_rows)}</div><div class="stat-label">Total</div></div>', unsafe_allow_html=True)
                with cols[1]:
                    st.markdown(f'<div class="stat"><div class="stat-num" style="color:#22c55e">{len(new_rows)}</div><div class="stat-label">To Ship</div></div>', unsafe_allow_html=True)
                with cols[2]:
                    st.markdown(f'<div class="stat"><div class="stat-num" style="color:#ef4444">{len(excluded)}</div><div class="stat-label">Excluded</div></div>', unsafe_allow_html=True)

                if excluded:
                    with st.expander(f"See {len(excluded)} excluded addresses"):
                        for row in excluded:
                            st.markdown(f'<div class="excluded-row">🚫 {row["Recipient Name"]} — {row["Address"]}, {row["City"]}</div>', unsafe_allow_html=True)

                if new_rows:
                    st.markdown("<div style='margin-top:8px'></div>", unsafe_allow_html=True)
                    csv_bytes = rows_to_csv_bytes(new_rows)
                    filename = f"{st.session_state.property_name.replace(' ', '_')}_validated.csv"

                    col1, col2 = st.columns(2)
                    with col1:
                        st.download_button("⬇️ Skip & Download", data=csv_bytes, file_name=filename, mime="text/csv")
                    with col2:
                        if st.button("Validate Charges →"):
                            st.session_state.validated_rows = new_rows
                            st.session_state.step2_stats = {
                                'total': len(st.session_state.normalized_rows),
                                'new': len(new_rows),
                                'excluded': len(excluded),
                            }
                            st.session_state.step = 3
                            st.rerun()
                else:
                    st.warning("All addresses were excluded — nothing new to ship.")

# ── STEP 3 ──────────────────────────────────────────────────────────────

if st.session_state.step >= 3:
    st.markdown("<div style='margin-top:28px'></div>", unsafe_allow_html=True)
    st.markdown('<div class="step-badge active">Step 3 — Charge Detail Validation</div>', unsafe_allow_html=True)
    st.markdown("<p style='color:#555; font-size:13px; margin-top:-4px; margin-bottom:16px;'>Upload the Charge Detail report from your PMS (Buildium, AppFolio, etc.) — pull it yourself or ask your PM. Unmatched addresses get flagged for review, not deleted.</p>", unsafe_allow_html=True)

    charge_file = st.file_uploader("Upload Charge Detail Report — pull from your PMS (Buildium, AppFolio, etc.) or ask your PM", type=["csv", "xlsx"], key="charge")

    # Always show skip option
    if st.session_state.validated_rows:
        csv_bytes = rows_to_csv_bytes(st.session_state.validated_rows)
        filename = f"{st.session_state.property_name.replace(' ', '_')}_final.csv"
        st.markdown("<div style='margin-top:8px'></div>", unsafe_allow_html=True)

        if charge_file:
            # Parse charge detail
            try:
                fname = charge_file.name.lower()
                if fname.endswith('.xlsx'):
                    charge_df = pd.read_excel(charge_file, dtype=str)
                else:
                    charge_file.seek(0)
                    charge_df = pd.read_csv(charge_file, dtype=str)

                # Find address column
                addr_col = None
                preferred = ['Address', 'Ship To - Address 1', 'address', 'Street Address', 'Property Address']
                for p in preferred:
                    if p in charge_df.columns:
                        addr_col = p
                        break
                if not addr_col:
                    for col in charge_df.columns:
                        if 'address' in col.lower():
                            addr_col = col
                            break

                if addr_col:
                    paying_addresses = set()
                    for val in charge_df[addr_col].dropna():
                        paying_addresses.add(normalize_address_key(val))

                    def _fuzzy_match(key, paying_set):
                        """Token-overlap fallback: match if all numeric tokens from key appear in any paying address."""
                        key_nums = set(re.findall(r'\d+', key))
                        if not key_nums:
                            return False
                        key_words = set(key.split())
                        for candidate in paying_set:
                            cand_words = set(candidate.split())
                            # All digits must match and at least one non-numeric token must overlap
                            cand_nums = set(re.findall(r'\d+', candidate))
                            if key_nums == cand_nums and len(key_words & cand_words) >= 2:
                                return True
                        return False

                    approved = []
                    flagged = []
                    for row in st.session_state.validated_rows:
                        key = normalize_address_key(row['Address'])
                        if key in paying_addresses or _fuzzy_match(key, paying_addresses):
                            approved.append(row)
                        else:
                            flagged.append(row)

                    st.markdown("<hr>", unsafe_allow_html=True)
                    cols = st.columns(3)
                    with cols[0]:
                        st.markdown(f'<div class="stat"><div class="stat-num">{len(st.session_state.validated_rows)}</div><div class="stat-label">Total</div></div>', unsafe_allow_html=True)
                    with cols[1]:
                        st.markdown(f'<div class="stat"><div class="stat-num" style="color:#22c55e">{len(approved)}</div><div class="stat-label">Approved</div></div>', unsafe_allow_html=True)
                    with cols[2]:
                        st.markdown(f'<div class="stat"><div class="stat-num" style="color:#eab308">{len(flagged)}</div><div class="stat-label">Flagged</div></div>', unsafe_allow_html=True)

                    if flagged:
                        with st.expander(f"⚠️ {len(flagged)} addresses flagged for review"):
                            st.markdown("<p style='color:#555; font-size:12px; margin-bottom:10px;'>These addresses were not found in the charge detail report. Verify enrollment before shipping.</p>", unsafe_allow_html=True)
                            for row in flagged:
                                st.markdown(f'<div class="excluded-row">🟡 {row["Recipient Name"]} — {row["Address"]}, {row["City"]}</div>', unsafe_allow_html=True)

                            # Download flagged list for review
                            flagged_csv = rows_to_csv_bytes(flagged)
                            st.download_button("⬇️ Download Flagged List", data=flagged_csv, file_name=f"{st.session_state.property_name.replace(' ', '_')}_flagged.csv", mime="text/csv")

                    if approved:
                        st.markdown("<div style='margin-top:8px'></div>", unsafe_allow_html=True)
                        approved_csv = rows_to_csv_bytes(approved)
                        st.download_button("⬇️ Download Approved CSV", data=approved_csv, file_name=f"{st.session_state.property_name.replace(' ', '_')}_approved.csv", mime="text/csv")
                    else:
                        st.warning("No approved addresses — check your charge detail report.")
                else:
                    st.error("Couldn't find an address column in the charge detail report. Please check the file format.")

            except Exception as e:
                st.error(f"Error reading charge detail: {e}")

        else:
            st.markdown("<p style='color:#555; font-size:13px;'>No charge detail uploaded yet.</p>", unsafe_allow_html=True)
            st.download_button("⬇️ Skip & Download", data=csv_bytes, file_name=filename, mime="text/csv")

# ── SUMMARY ─────────────────────────────────────────────────────────────

if st.session_state.step >= 3 and st.session_state.get('validated_rows'):
    st.markdown("<div style='margin-top:28px'></div>", unsafe_allow_html=True)
    st.markdown('<div class="step-badge done">✓ Run Summary</div>', unsafe_allow_html=True)

    total_in = len(st.session_state.normalized_rows) if st.session_state.normalized_rows else 0
    total_after_shipment = len(st.session_state.validated_rows) if st.session_state.validated_rows else 0
    excluded_shipment = total_in - total_after_shipment

    cols = st.columns(3)
    with cols[0]:
        st.markdown(f'<div class="stat"><div class="stat-num">{total_in}</div><div class="stat-label">Started With</div></div>', unsafe_allow_html=True)
    with cols[1]:
        st.markdown(f'<div class="stat"><div class="stat-num" style="color:#ef4444">{excluded_shipment}</div><div class="stat-label">Excluded (Shipped)</div></div>', unsafe_allow_html=True)
    with cols[2]:
        st.markdown(f'<div class="stat"><div class="stat-num" style="color:#22c55e">{total_after_shipment}</div><div class="stat-label">Ready to Ship</div></div>', unsafe_allow_html=True)

    st.markdown("<p style='color:#333; font-size:12px; margin-top:8px;'>Upload a charge detail in Step 3 to further filter by paying tenants.</p>", unsafe_allow_html=True)

# ── EASTER EGG GAME ──────────────────────────────────────────────────────
if 'show_game' not in st.session_state:
    st.session_state.show_game = False

# Dim "game" toggle label
if st.button("game", key="game_toggle"):
    st.session_state.show_game = not st.session_state.show_game
    st.rerun()

if st.session_state.show_game:
    GAME_HTML = (
        "<style>"
        "@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap');"
        "html,body{margin:0;padding:0;background:#080808;overflow:hidden;}"
        "#wrap{display:flex;flex-direction:column;align-items:center;padding-top:10px;}"
        "#gc{display:block;border:1px solid #1a1a1a;border-radius:4px;}"
        "#hud{display:flex;justify-content:space-between;width:640px;margin-bottom:6px;"
        "font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2a2a2a;text-transform:uppercase;letter-spacing:1px;}"
        "#gmsg{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2a2a2a;letter-spacing:2px;"
        "text-transform:uppercase;margin-top:8px;min-height:16px;}"
        "</style>"
        "<div id='wrap'>"
        "<div id='hud'><span id='gsc'>score 0</span><span id='ghi'>best 0</span></div>"
        "<canvas id='gc' width='640' height='130'></canvas>"
        "<div id='gmsg'>space / tap to start</div>"
        "</div>"
        "<script>"
        # canvas setup
        "var C=document.getElementById('gc'),ctx=C.getContext('2d');"
        "var msg=document.getElementById('gmsg'),sc=document.getElementById('gsc'),hi=document.getElementById('ghi');"
        "var W=C.width,H=C.height,GR=H-22;"
        "var state='idle',score=0,hiScore=0,speed=4,frame=0,raf=null;"
        "var obstacles=[],bones=[],parts=[],stars=[];"
        "var dog={x:70,y:GR,vy:0,j:false,lf:0,invince:0};"
        "var G=0.55,JP=-12,camX=0;"
        # init stars
        "for(var i=0;i<40;i++){stars.push({x:Math.random()*W,y:Math.random()*(GR-20),s:Math.random()*1.5+0.3,b:Math.random()});}"
        # helpers
        "function reset(){dog={x:70,y:GR,vy:0,j:false,lf:0,invince:0};obstacles=[];bones=[];parts=[];score=0;speed=4;frame=0;camX=0;state='running';msg.textContent='';}"
        "function jump(){if(state==='idle'||state==='dead'){reset();return;}if(!dog.j){dog.vy=JP;dog.j=true;spawnJumpParts();}}"
        "document.addEventListener('keydown',function(e){if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();jump();}});"
        "C.addEventListener('click',jump);"
        # spawn jump dust
        "function spawnJumpParts(){for(var i=0;i<6;i++){parts.push({x:dog.x+10,y:GR+4,vx:(Math.random()-0.7)*3,vy:-Math.random()*2-1,life:20,r:3,c:'#2a2a2a',type:'dust'});}}"
        # spawn bone collect burst
        "function spawnBurst(x,y){for(var i=0;i<14;i++){var a=Math.random()*Math.PI*2,sp=Math.random()*5+2;parts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:35,r:4,c:Math.random()>0.4?'#f97316':'#fff',type:'burst'});}}"
        # draw dog - improved
        "function drawDog(x,y,lf,dead,inv){"
        "if(inv%4<2&&inv>0)return;"  # flicker when invincible
        # shadow
        "ctx.save();ctx.globalAlpha=0.15;"
        "ctx.fillStyle='#f97316';ctx.beginPath();ctx.ellipse(x+12,GR+3,18,4,0,0,Math.PI*2);ctx.fill();"
        "ctx.restore();"
        # tail wag
        "ctx.save();ctx.translate(x-8,y+4);"
        "var tw=dead?-0.5:Math.sin(frame*(dog.j?0.1:0.35))*0.7-0.2;"
        "ctx.rotate(tw);"
        "ctx.strokeStyle='#f97316';ctx.lineWidth=3.5;ctx.lineCap='round';"
        "ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-6,-8,-12,-14,-8,-22);ctx.stroke();"
        "ctx.restore();"
        # body
        "ctx.fillStyle='#f97316';"
        "ctx.beginPath();ctx.ellipse(x+10,y+5,17,10,dead?0.25:0,0,Math.PI*2);ctx.fill();"
        # belly patch
        "ctx.fillStyle='#ffb366';"
        "ctx.beginPath();ctx.ellipse(x+12,y+8,8,5,0,0,Math.PI*2);ctx.fill();"
        # head
        "ctx.fillStyle='#f97316';"
        "ctx.beginPath();ctx.ellipse(x+24,y-2,11,10,0,0,Math.PI*2);ctx.fill();"
        # ear (floppy)
        "ctx.fillStyle='#c45c0a';"
        "ctx.beginPath();ctx.ellipse(x+28,y-11,6,9,0.4+Math.sin(frame*0.1)*0.15,0,Math.PI*2);ctx.fill();"
        # snout
        "ctx.fillStyle='#e86c10';"
        "ctx.beginPath();ctx.ellipse(x+34,y,5,4,0,0,Math.PI*2);ctx.fill();"
        # nose
        "ctx.fillStyle='#1a0000';"
        "ctx.beginPath();ctx.ellipse(x+37,y-1,2,1.5,0,0,Math.PI*2);ctx.fill();"
        # eye
        "if(!dead){"
        "ctx.fillStyle='#0d0d0d';ctx.beginPath();ctx.arc(x+28,y-4,2.5,0,Math.PI*2);ctx.fill();"
        "ctx.fillStyle='white';ctx.beginPath();ctx.arc(x+29,y-5,1,0,Math.PI*2);ctx.fill();"
        "ctx.fillStyle='#f97316';ctx.beginPath();ctx.arc(x+28,y-4,1,0,Math.PI*2);ctx.fill();"  # orange iris
        "}else{"
        "ctx.strokeStyle='#0d0d0d';ctx.lineWidth=2;"
        "ctx.beginPath();ctx.moveTo(x+26,y-6);ctx.lineTo(x+30,y-2);ctx.moveTo(x+30,y-6);ctx.lineTo(x+26,y-2);ctx.stroke();"
        "}"
        # mouth (smile or sad)
        "ctx.strokeStyle='#c45c0a';ctx.lineWidth=1.5;ctx.lineCap='round';"
        "if(!dead){ctx.beginPath();ctx.arc(x+34,y+1,3,0.2,Math.PI-0.2);ctx.stroke();}"
        "else{ctx.beginPath();ctx.arc(x+34,y+4,3,Math.PI+0.2,-0.2);ctx.stroke();}"
        # legs with running animation
        "var legPairs=[[x-2,x+6],[x+12,x+20]];"
        "legPairs.forEach(function(pair,pi){"
        "pair.forEach(function(lx,li){"
        "var phase=lf+(pi*Math.PI)+(li*Math.PI);"
        "var ang=dead?0.3:Math.sin(phase)*0.55;"
        "ctx.save();ctx.translate(lx+2,y+13);ctx.rotate(ang);"
        "ctx.fillStyle='#c45c0a';"
        "ctx.beginPath();ctx.roundRect(-3,0,6,14,3);ctx.fill();"
        # paw
        "ctx.fillStyle='#a04008';"
        "ctx.beginPath();ctx.ellipse(0,14,4,2.5,0,0,Math.PI*2);ctx.fill();"
        "ctx.restore();});});"
        "}"
        # draw paper stack obstacle  
        "function drawPaper(ob){"
        "var n=Math.ceil(ob.h/10);"
        "for(var i=n;i>=0;i--){"
        "var py=ob.y+i*(ob.h/n),sl=(i%2===0?2:-2),pw=ob.w+(i%3)*2;"
        "ctx.fillStyle=i===0?'#222':'#191919';"
        "ctx.strokeStyle='#2a2a2a';ctx.lineWidth=0.8;"
        "ctx.beginPath();"
        "ctx.moveTo(ob.x+sl,py);ctx.lineTo(ob.x+pw+sl,py);"
        "ctx.lineTo(ob.x+pw-sl,py+(ob.h/n)+3);ctx.lineTo(ob.x-sl,py+(ob.h/n)+3);"
        "ctx.closePath();ctx.fill();ctx.stroke();"
        # ruled lines on paper
        "ctx.strokeStyle='#282828';ctx.lineWidth=0.5;"
        "for(var l=1;l<=3;l++){"
        "ctx.beginPath();ctx.moveTo(ob.x+sl+4,py+l*(ob.h/n/4));ctx.lineTo(ob.x+pw+sl-4,py+l*(ob.h/n/4));ctx.stroke();"
        "}"
        "}"
        "}"
        # draw bone
        "function drawBone(b){"
        "ctx.save();"
        "ctx.translate(b.x,b.y);"
        "ctx.rotate(b.rot||0);"
        # glow
        "ctx.shadowColor='#f97316';ctx.shadowBlur=10;"
        "ctx.fillStyle='#f97316';"
        "ctx.fillRect(-10,-3,20,6);"
        "[[−10,0],[10,0]].forEach(function(p){ctx.beginPath();ctx.arc(p[0],p[1],6,0,Math.PI*2);ctx.fill();});"
        "ctx.shadowBlur=0;"
        "ctx.restore();"
        "}"
        # collision
        "function hit(ob){return dog.x+28>ob.x+4&&dog.x>ob.x-20&&dog.y+12>ob.y+4&&dog.y-8<ob.y+ob.h;}"
        "function hitBone(b){return Math.abs((dog.x+18)-b.x)<20&&Math.abs(dog.y-b.y)<22;}"
        # main loop
        "function loop(){"
        "ctx.fillStyle='#080808';ctx.fillRect(0,0,W,H);"
        # stars
        "stars.forEach(function(s){"
        "s.b+=0.015;var a=0.15+Math.abs(Math.sin(s.b))*0.25;"
        "ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();"
        "});"
        # ground with subtle gradient
        "var grd=ctx.createLinearGradient(0,GR,0,H);"
        "grd.addColorStop(0,'#1a1a1a');grd.addColorStop(1,'#0d0d0d');"
        "ctx.fillStyle=grd;ctx.fillRect(0,GR+4,W,H-GR);"
        "ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1;"
        "ctx.beginPath();ctx.moveTo(0,GR+4);ctx.lineTo(W,GR+4);ctx.stroke();"
        # scrolling ground dots
        "ctx.fillStyle='#1e1e1e';"
        "for(var i=0;i<W;i+=24){var dx=((i-(frame*speed*0.4))%W+W)%W;ctx.beginPath();ctx.arc(dx,GR+10,1.2,0,Math.PI*2);ctx.fill();}"
        "if(state==='running'){"
        "frame++;score++;"
        "sc.textContent='score '+Math.floor(score/5);"
        "speed=4+score/1800;"
        # physics
        "dog.vy+=G;dog.y+=dog.vy;"
        "if(dog.y>=GR){dog.y=GR;dog.vy=0;dog.j=false;}"
        "dog.lf+=dog.j?0:0.22;"
        "if(dog.invince>0)dog.invince--;"
        # spawn obstacles
        "if(frame%Math.max(48,80-Math.floor(score/400))===0){"
        "var h=16+Math.floor(Math.random()*4)*9,w=12+Math.floor(Math.random()*3)*5;"
        "obstacles.push({x:W+10,y:GR-h+4,w:w,h:h});}"
        # spawn bones periodically
        "if(frame%220===150){bones.push({x:W+20,y:GR-28-Math.random()*20,rot:0});}"
        "obstacles=obstacles.filter(function(o){return o.x>-60;});"
        "bones=bones.filter(function(b){return b.x>-40;});"
        # update + draw obstacles
        "obstacles.forEach(function(o){o.x-=speed;drawPaper(o);});"
        # update + draw bones
        "bones.forEach(function(b){b.x-=speed*0.85;b.rot+=0.04;drawBone(b);});"
        # collect bones
        "bones=bones.filter(function(b){if(hitBone(b)){spawnBurst(b.x,b.y);score+=250;return false;}return true;});"
        # particles
        "parts=parts.filter(function(p){return p.life>0;});"
        "parts.forEach(function(p){"
        "p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life--;"
        "ctx.globalAlpha=p.life/35;"
        "ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r*(p.life/35),0,Math.PI*2);ctx.fill();"
        "ctx.globalAlpha=1;});"
        # collision check
        "if(dog.invince===0&&obstacles.some(hit)){"
        "state='dead';var s=Math.floor(score/5);if(s>hiScore){hiScore=s;hi.textContent='best '+hiScore;}"
        "msg.textContent='score '+s+' · space to retry';"
        "for(var i=0;i<20;i++){var a=Math.random()*Math.PI*2,sp=Math.random()*6+2;parts.push({x:dog.x+18,y:dog.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:40,r:5,c:Math.random()>0.5?'#f97316':'#c45c0a',type:'death'});}"
        "}"
        "drawDog(dog.x,dog.y,dog.lf,false,dog.invince);"
        "}else if(state==='dead'){"
        "obstacles.forEach(function(o){drawPaper(o);});"
        "bones.forEach(function(b){drawBone(b);});"
        "parts=parts.filter(function(p){return p.life>0;});"
        "parts.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life--;ctx.globalAlpha=p.life/40;ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;});"
        "drawDog(dog.x,dog.y,dog.lf,true,0);"
        "}else{"  # idle
        "drawDog(dog.x,GR,frame*0.04,false,0);"
        "}"
        "requestAnimationFrame(loop);}"
        "loop();"
        "</script>"
    )
    components.html(GAME_HTML, height=210)

# ── FOOTER ──────────────────────────────────────────────────────────────
master_count = len(st.session_state.get('master_rows', []))
master_txt = f" · {master_count} in master" if master_count else ""

st.markdown(f"""
<div style='height:60px'></div>
<div class='site-footer'>
    <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#2a2a2a;'>FILTER TOOLS v0.1{master_txt}</span>
    <span style='display:flex; align-items:center; gap:24px;'>
        <span style='font-family:IBM Plex Mono,monospace; font-size:11px; color:#2a2a2a;'>Built by <span style='color:#f97316;'>Matthew Gamble</span></span>
    </span>
</div>
""", unsafe_allow_html=True)

# Footer action row — sits just above footer
st.markdown("<div style='height:4px'></div>", unsafe_allow_html=True)
fa_col1, fa_col2, fa_col3 = st.columns([8, 1, 1])
with fa_col2:
    if st.button("tutorial", key="show_tutorial"):
        st.session_state.tutorial_step = 1
        st.rerun()
with fa_col3:
    if st.button("restart", key="start_over"):
        for key in ['step','normalized_rows','validated_rows','property_name','step1_stats','step2_stats','master_rows']:
            if key in st.session_state:
                del st.session_state[key]
        st.rerun()
