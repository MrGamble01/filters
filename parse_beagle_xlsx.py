"""
parse_beagle_xlsx.py
--------------------
CLI wrapper around the canonical Beagle xlsx parser that lives in app.py.

Usage:
    python3 parse_beagle_xlsx.py <input.xlsx> <property_name> [output.csv]

If no output filename is given, it defaults to <input_basename>_normalized.csv.

NOTE: The authoritative implementation of parse_beagle_xlsx() and all helper
functions (normalize_filter_size, fuzzy_col_idx, merge_address, etc.) lives in
app.py.  This script imports directly from there so the two never diverge.
"""

import sys
import os
import csv

# Allow importing from app.py (which is Streamlit-based) without triggering the
# Streamlit runtime.  We stub out the 'streamlit' module before the import so
# that top-level st.* calls in app.py are silently ignored.
import types
_st_stub = types.ModuleType('streamlit')
for _attr in ('set_page_config', 'markdown', 'session_state', 'columns',
              'file_uploader', 'button', 'text_input', 'expander',
              'download_button', 'spinner', 'warning', 'error', 'info',
              'checkbox', 'dataframe', 'rerun', 'components'):
    setattr(_st_stub, _attr, lambda *a, **kw: None)
_st_stub.session_state = {}
_st_stub.components = types.ModuleType('streamlit.components.v1')
_st_stub.components.html = lambda *a, **kw: None
sys.modules.setdefault('streamlit', _st_stub)
sys.modules.setdefault('streamlit.components', _st_stub.components)
sys.modules.setdefault('streamlit.components.v1', _st_stub.components)

# Also stub anthropic and PIL if not installed (not needed for parsing)
for _mod in ('anthropic', 'PIL', 'PIL.Image'):
    sys.modules.setdefault(_mod, types.ModuleType(_mod))

_here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _here)

from app import parse_beagle_xlsx, rows_to_csv_bytes, OUTPUT_FIELDNAMES  # noqa: E402


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 parse_beagle_xlsx.py <input.xlsx> <property_name> [output.csv]")
        sys.exit(1)

    input_path = sys.argv[1]
    property_name = sys.argv[2]

    if len(sys.argv) >= 4:
        output_path = sys.argv[3]
    else:
        base = os.path.splitext(os.path.basename(input_path))[0]
        output_path = f'{base}_normalized.csv'

    with open(input_path, 'rb') as fh:
        rows = parse_beagle_xlsx(fh, property_name)

    csv_bytes = rows_to_csv_bytes(rows)
    with open(output_path, 'wb') as f:
        f.write(csv_bytes)

    print(f"Done. {len(rows)} rows written to {output_path}")


if __name__ == '__main__':
    main()
