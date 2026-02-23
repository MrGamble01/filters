import streamlit as st
import openpyxl
import csv
import re
import io

st.set_page_config(
    page_title="Filter Tools",
    page_icon="🌬️",
    layout="centered"
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

* { font-family: 'Inter', sans-serif; }

.stApp { background-color: #0f0f0f; }

#MainMenu, footer, header { visibility: hidden; }

/* Inputs */
[data-testid="stTextInput"] input {
    background-color: #1a1a1a !important;
    border: 1px solid #2e2e2e !important;
    border-radius: 6px !important;
    color: #f0f0f0 !important;
    font-size: 14px !important;
}
[data-testid="stTextInput"] input:focus {
    border-color: #f97316 !important;
    box-shadow: none !important;
}
[data-testid="stTextInput"] label {
    color: #888 !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
}

/* File uploader */
[data-testid="stFileUploader"] {
    background: #1a1a1a !important;
    border: 1px dashed #2e2e2e !important;
    border-radius: 6px !important;
}
[data-testid="stFileUploader"] * { color: #888 !important; }
[data-testid="stFileUploaderDropzone"] { background: #1a1a1a !important; }

/* Download button */
.stDownloadButton > button {
    background-color: #f97316 !important;
    color: white !important;
    border: none !important;
    border-radius: 6px !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    padding: 10px 20px !important;
    width: 100% !important;
    margin-top: 8px !important;
}
.stDownloadButton > button:hover {
    background-color: #ea6c0a !important;
}

/* Alerts */
[data-testid="stAlert"] {
    background-color: #1a1a1a !important;
    border-radius: 6px !important;
    border: 1px solid #2e2e2e !important;
    color: #aaa !important;
}

/* Divider */
hr { border-color: #1e1e1e !important; }
</style>
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
<div style='margin-bottom:32px;'>
    <img src='data:image/png;base64,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' style='height:52px;'>
    <p style='color:#555; font-size:14px; margin-top:12px; margin-bottom:0;'>Convert Beagle reports to ShipStation CSV</p>
</div>
""", unsafe_allow_html=True)

property_name = st.text_input("Property Name", placeholder="e.g. Freedom House")

st.markdown("<div style='margin-top:8px'></div>", unsafe_allow_html=True)

uploaded_files = st.file_uploader(
    "Upload Files",
    type=["xlsx"],
    accept_multiple_files=True
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
        st.markdown("<hr>", unsafe_allow_html=True)
        
        # Stats row
        cols = st.columns(2)
        with cols[0]:
            st.markdown(f"<p style='color:#555; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;'>Rows</p><p style='color:#f97316; font-size:28px; font-weight:700; margin:0;'>{len(all_rows)}</p>", unsafe_allow_html=True)
        with cols[1]:
            st.markdown(f"<p style='color:#555; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;'>Files</p><p style='color:#f0f0f0; font-size:28px; font-weight:700; margin:0;'>{len(file_results)}</p>", unsafe_allow_html=True)

        if len(file_results) > 1:
            st.markdown("<div style='margin-top:16px'></div>", unsafe_allow_html=True)
            for fname, count in file_results:
                st.markdown(f"<p style='color:#555; font-size:13px; margin:4px 0;'>📄 {fname} <span style='color:#f97316'>→ {count} rows</span></p>", unsafe_allow_html=True)

        st.markdown("<div style='margin-top:16px'></div>", unsafe_allow_html=True)
        csv_bytes = rows_to_csv_bytes(all_rows)
        filename = f"{property_name.replace(' ', '_')}_normalized.csv"
        st.download_button("⬇️ Download CSV", data=csv_bytes, file_name=filename, mime="text/csv")

    for fname, err in errors:
        st.error(f"❌ {fname}: {err}")

elif uploaded_files and not property_name:
    st.warning("Enter a property name to continue.")
