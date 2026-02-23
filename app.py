import streamlit as st
import openpyxl
import csv
import re
import io

st.set_page_config(page_title="Air Filter CSV Converter", page_icon="🌬️")

st.title("🌬️ Air Filter CSV Converter")
st.write("Upload a Beagle xlsx report and get a ShipStation-ready CSV back.")

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

property_name = st.text_input("Property Name", placeholder="e.g. Freedom House")
uploaded_file = st.file_uploader("Upload Beagle xlsx report", type=["xlsx"])

if uploaded_file and property_name:
    with st.spinner("Converting..."):
        try:
            rows = parse_beagle_xlsx(uploaded_file, property_name)
            csv_bytes = rows_to_csv_bytes(rows)

            st.success(f"✅ Done! {len(rows)} rows converted.")

            st.download_button(
                label="⬇️ Download CSV",
                data=csv_bytes,
                file_name=f"{property_name.replace(' ', '_')}_normalized.csv",
                mime="text/csv"
            )
        except Exception as e:
            st.error(f"Something went wrong: {e}")

elif uploaded_file and not property_name:
    st.warning("Enter a property name above to continue.")
