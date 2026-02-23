
import streamlit as st
import openpyxl
import csv
import re
import io
import zipfile

st.set_page_config(
    page_title="Air Filter CSV Converter",
    page_icon="🌬️",
    layout="centered"
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

html, body, [class*="css"] {
    font-family: 'DM Sans', sans-serif;
}

.stApp {
    background-color: #f7f7f5;
}

#MainMenu, footer, header {visibility: hidden;}

.top-bar {
    background: white;
    border-bottom: 1px solid #ebebeb;
    padding: 16px 32px;
    margin: -1rem -1rem 2rem -1rem;
    display: flex;
    align-items: center;
    gap: 10px;
}

.logo-icon {
    width: 36px;
    height: 36px;
    background: #f97316;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.brand {
    font-size: 20px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.3px;
}

.brand span { color: #f97316; }

.card {
    background: white;
    border-radius: 12px;
    border: 1px solid #ebebeb;
    padding: 28px 32px;
    margin-bottom: 16px;
}

.card-title {
    font-size: 15px;
    font-weight: 600;
    color: #111;
    margin-bottom: 4px;
}

.card-sub {
    font-size: 13px;
    color: #888;
}

.stButton > button {
    background-color: #f97316 !important;
    color: white !important;
    border: none !important;
    border-radius: 8px !important;
    font-family: 'DM Sans', sans-serif !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    width: 100%;
}

.stDownloadButton > button {
    background-color: #f97316 !important;
    color: white !important;
    border: none !important;
    border-radius: 8px !important;
    font-family: 'DM Sans', sans-serif !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    width: 100%;
}

[data-testid="stFileUploader"] {
    background: #fafafa;
    border: 1.5px dashed #ddd;
    border-radius: 10px;
    padding: 8px;
}

[data-testid="stTextInput"] input {
    border-radius: 8px !important;
    border: 1.5px solid #e0e0e0 !important;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 14px !important;
}

[data-testid="stTextInput"] input:focus {
    border-color: #f97316 !important;
    box-shadow: 0 0 0 3px rgba(249,115,22,0.1) !important;
}

.stat-box {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 16px;
}

.stat-number {
    font-size: 32px;
    font-weight: 700;
    color: #f97316;
    line-height: 1;
}

.stat-label {
    font-size: 13px;
    color: #888;
    margin-top: 2px;
}

.section-label {
    font-size: 12px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    margin-bottom: 8px;
    margin-top: 20px;
}

.file-result {
    background: #fafafa;
    border: 1px solid #ebebeb;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 6px;
    font-size: 13px;
    color: #333;
}
</style>

<div class="top-bar">
    <div class="logo-icon">🌬️</div>
    <div class="brand">filter<span>tools</span></div>
</div>
""", unsafe_allow_html=True)

# --- Core logic ---

def normalize_filter_size(s):
    if not s:
        return None
    s = str(s).strip()
    s = re.sub(r'\s*[×x]\s*', 'x', s, flags=re.IGNORECASE)
    s = s.rstrip('.')
    return s.strip()

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

def parse_beagle_xlsx(file, property_name):
    wb = openpyxl.load_workbook(file)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = rows[0]

    def col_idx(name):
        for i, h in enumerate(headers):
            if h and str(h).strip().lower() == name.lower():
                return i
        return None

    first_name_col = col_idx('First Name')
    last_name_col = col_idx('Last Name')
    email_col = col_idx('Email')
    street_col = col_idx('Street Address')
    unit_col = col_idx('UNIT')
    city_col = col_idx('City')
    state_col = col_idx('State')
    zip_col = col_idx('Zip Code')

    filter_size_cols = [i for i, h in enumerate(headers) if h and str(h).strip().lower() == 'filter size']
    qty_cols = [i for i, h in enumerate(headers) if h and str(h).strip().lower() == 'quantity']

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
        zipcode = str(row[zip_col]).strip() if row[zip_col] else ''
        if zipcode.endswith('.0'):
            zipcode = zipcode[:-2]

        filter_sizes = []
        for i, fs_col in enumerate(filter_size_cols):
            fs = row[fs_col]
            qty_val = row[qty_cols[i]] if i < len(qty_cols) else 1
            if fs:
                normalized = normalize_filter_size(fs)
                try:
                    qty = int(float(str(qty_val))) if qty_val else 1
                except (ValueError, TypeError):
                    qty = 1
                for _ in range(qty):
                    filter_sizes.append(normalized)

        if not filter_sizes:
            continue

        output_rows.append({
            'Order #': '', 'Shipping Service': '', 'Height(in)': '',
            'Length(in)': '', 'Width(in)': '', 'Weight(oz)': '',
            'Custom Field 1': ', '.join(filter_sizes),
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

def rows_to_csv_bytes(rows):
    fieldnames = [
        'Order #', 'Shipping Service', 'Height(in)', 'Length(in)', 'Width(in)',
        'Weight(oz)', 'Custom Field 1', 'Custom Field 2', 'Recipient Name',
        'Address', 'City', 'State', 'Postal Code', 'Country Code', 'Tenant Email'
    ]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode('utf-8')

# --- UI ---

st.markdown("""
<div class="card">
    <div class="card-title">Convert Beagle Reports to ShipStation CSV</div>
    <div class="card-sub">Upload one or more Beagle xlsx reports and download a ready-to-import CSV.</div>
</div>
""", unsafe_allow_html=True)

st.markdown('<div class="section-label">Property Name</div>', unsafe_allow_html=True)
property_name = st.text_input("", placeholder="e.g. Freedom House", label_visibility="collapsed")

st.markdown('<div class="section-label">Upload Files</div>', unsafe_allow_html=True)
uploaded_files = st.file_uploader(
    "",
    type=["xlsx"],
    accept_multiple_files=True,
    label_visibility="collapsed"
)

if uploaded_files and property_name:
    all_rows = []
    file_results = []
    errors = []

    for f in uploaded_files:
        try:
            rows = parse_beagle_xlsx(f, property_name)
            all_rows.extend(rows)
            file_results.append((f.name, len(rows)))
        except Exception as e:
            errors.append((f.name, str(e)))

    if all_rows:
        total = len(all_rows)
        st.markdown(f"""
        <div class="stat-box">
            <div class="stat-number">{total}</div>
            <div class="stat-label">rows ready to import</div>
        </div>
        """, unsafe_allow_html=True)

        if len(file_results) > 1:
            st.markdown('<div class="section-label">File Breakdown</div>', unsafe_allow_html=True)
            for fname, count in file_results:
                st.markdown(f'<div class="file-result">📄 {fname} — <strong>{count} rows</strong></div>', unsafe_allow_html=True)

        csv_bytes = rows_to_csv_bytes(all_rows)
        filename = f"{property_name.replace(' ', '_')}_normalized.csv"
        st.download_button("⬇️ Download CSV", data=csv_bytes, file_name=filename, mime="text/csv")

    for fname, err in errors:
        st.error(f"❌ {fname}: {err}")

elif uploaded_files and not property_name:
    st.warning("⚠️ Enter a property name above to continue.")
