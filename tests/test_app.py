"""
Unit tests for the pure-Python helper functions in app.py.

Run with:  pytest tests/
"""
import io
import sys
import os
import re

import pytest

# conftest.py stubs heavy deps before this import
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import app


# ── normalize_filter_size ────────────────────────────────────────────────────

class TestNormalizeFilterSize:
    def test_standard_size(self):
        s, is_std, qty = app.normalize_filter_size("16x20x1")
        assert s == "16x20x1"
        assert is_std is True
        assert qty == 1

    def test_mixed_case_separator(self):
        s, is_std, qty = app.normalize_filter_size("16X20X1")
        assert s == "16x20x1"
        assert is_std is True

    def test_unicode_times_separator(self):
        s, is_std, qty = app.normalize_filter_size("16×20×1")
        assert s == "16x20x1"
        assert is_std is True

    def test_spaces_around_separator(self):
        s, _, _ = app.normalize_filter_size("16 x 20 x 1")
        assert s == "16x20x1"

    def test_dash_qty_notation(self):
        s, _, qty = app.normalize_filter_size("16x25x1-3")
        assert s == "16x25x1"
        assert qty == 3

    def test_decimal_size(self):
        s, is_std, _ = app.normalize_filter_size("16.25x20x1")
        assert "16.25" in s
        assert is_std is True

    def test_empty_returns_none(self):
        s, is_std, qty = app.normalize_filter_size("")
        assert s is None
        assert is_std is False
        assert qty == 1

    def test_trailing_dot_stripped(self):
        s, _, _ = app.normalize_filter_size("16x20x1.")
        assert not s.endswith(".")


# ── normalize_fractional_filter ──────────────────────────────────────────────

class TestNormalizeFractionalFilter:
    def test_simple_fraction(self):
        result = app.normalize_fractional_filter("16-1/4x20x1")
        assert result == "16.25x20x1"

    def test_half_fraction(self):
        result = app.normalize_fractional_filter("20-1/2x25x1")
        assert result == "20.5x25x1"

    def test_three_quarter_fraction(self):
        result = app.normalize_fractional_filter("14-3/4x25x1")
        assert result == "14.75x25x1"

    def test_no_fraction_unchanged(self):
        result = app.normalize_fractional_filter("16x20x1")
        assert "16" in result and "20" in result

    def test_spaces_removed(self):
        result = app.normalize_fractional_filter("16 x 20 x 1")
        assert " " not in result


# ── is_po_box ────────────────────────────────────────────────────────────────

class TestIsPoBox:
    @pytest.mark.parametrize("addr", [
        "PO Box 123",
        "P.O. Box 456",
        "P O BOX 7",
        "Post Office Box 99",
        "PMB 45",
        "PMB45",
        "General Delivery",
        "GENERAL DELIVERY",
    ])
    def test_detects_po_box(self, addr):
        assert app.is_po_box(addr) is True

    @pytest.mark.parametrize("addr", [
        "123 Main Street",
        "456 Broad Ave",
        "1 Postal Road",    # contains "postal" but not "post office box"
        "",
    ])
    def test_rejects_normal_address(self, addr):
        assert app.is_po_box(addr) is False


# ── normalize_zip ────────────────────────────────────────────────────────────

class TestNormalizeZip:
    def test_pads_short_zip(self):
        assert app.normalize_zip("1234") == "01234"

    def test_strips_extension(self):
        assert app.normalize_zip("78701-1234") == "78701"

    def test_strips_dot_zero(self):
        assert app.normalize_zip("78701.0") == "78701"

    def test_passthrough_valid(self):
        assert app.normalize_zip("78701") == "78701"

    def test_empty(self):
        assert app.normalize_zip("") == ""


# ── parse_issues_csv_notes ───────────────────────────────────────────────────

class TestParseIssuesCsvNotes:
    def test_plain_single_size(self):
        result = app.parse_issues_csv_notes("16x20x1")
        assert result == [("16x20x1", 1)]

    def test_plain_multiple_sizes(self):
        result = app.parse_issues_csv_notes("16x20x1, 20x25x1")
        sizes = [s for s, _ in result]
        assert "16x20x1" in sizes
        assert "20x25x1" in sizes
        assert len(result) == 2

    def test_qty_in_parens_format(self):
        result = app.parse_issues_csv_notes("(2) 16x20x1")
        assert result == [("16x20x1", 2)]

    def test_multiple_qty_in_parens(self):
        result = app.parse_issues_csv_notes("(1) 16x20x1,(1) 15x20x1")
        assert len(result) == 2
        assert ("16x20x1", 1) in result
        assert ("15x20x1", 1) in result

    def test_trailing_qty(self):
        result = app.parse_issues_csv_notes("20x25x1 (4)")
        assert result == [("20x25x1", 4)]

    def test_empty_returns_empty(self):
        assert app.parse_issues_csv_notes("") == []
        assert app.parse_issues_csv_notes(None) == []

    def test_non_filter_note_returns_empty(self):
        assert app.parse_issues_csv_notes("Wrong address") == []


# ── parse_address_field ──────────────────────────────────────────────────────

class TestParseAddressField:
    def test_simple_address(self):
        street, city, state, zip_ = app.parse_address_field("123 Main St, Austin, TX 78701")
        assert street == "123 Main St"
        assert city == "Austin"
        assert state == "TX"
        assert zip_ == "78701"

    def test_comma_in_street_name(self):
        street, city, state, zip_ = app.parse_address_field(
            "123 Martin Luther King, Jr. Blvd, Austin, TX 78701"
        )
        assert street == "123 Martin Luther King, Jr. Blvd"
        assert city == "Austin"
        assert state == "TX"
        assert zip_ == "78701"

    def test_multi_word_city(self):
        street, city, state, zip_ = app.parse_address_field(
            "456 Oak Ave, Round Rock, TX 78664"
        )
        assert street == "456 Oak Ave"
        assert city == "Round Rock"
        assert zip_ == "78664"

    def test_no_city_state(self):
        street, city, state, zip_ = app.parse_address_field("789 Elm St")
        assert street == "789 Elm St"
        assert city == ""
        assert state == ""
        assert zip_ == ""

    def test_empty(self):
        assert app.parse_address_field("") == ("", "", "", "")
        assert app.parse_address_field(None) == ("", "", "", "")

    def test_strips_address_prefix(self):
        street, city, state, _ = app.parse_address_field("Address: 1 Oak Rd, Dallas, TX 75201")
        assert street == "1 Oak Rd"
        assert city == "Dallas"


# ── detect_csv_format ────────────────────────────────────────────────────────

class TestDetectCsvFormat:
    def _fake_file(self, header_line: str):
        raw = (header_line + "\n").encode("utf-8")
        f = io.BytesIO(raw)
        f.name = "test.csv"
        return f

    def test_tenant_dir_v1(self):
        f = self._fake_file("First Name,Last Name,Unit Street Address 1,Unit Tags")
        assert app.detect_csv_format(f) == "tenant_dir_v1"

    def test_tenant_dir_v2(self):
        f = self._fake_file("Property,Unit,Tenant,Unit Tags,Tenant Tags")
        assert app.detect_csv_format(f) == "tenant_dir_v2"

    def test_issues_csv(self):
        f = self._fake_file("Property Address,PM Company,Notes,Tracking")
        assert app.detect_csv_format(f) == "issues_csv"

    def test_unrecognized_returns_none(self):
        f = self._fake_file("foo,bar,baz")
        assert app.detect_csv_format(f) is None


# ── compute_quality_score ────────────────────────────────────────────────────

def _row(filter_size="16x20x1", email="a@b.com", address=None, nonstandard=False, _counter=[0]):
    # Use a unique address by default so rows don't accidentally trigger dupe detection.
    _counter[0] += 1
    return {
        "Custom Field 1": filter_size,
        "Tenant Email": email,
        "Address": address if address is not None else f"{_counter[0]} Unique St",
        "_nonstandard_filter": nonstandard,
    }


class TestComputeQualityScore:
    def test_perfect_data(self):
        rows = [_row() for _ in range(5)]
        score, issues = app.compute_quality_score(rows)
        assert score == 100
        assert issues == []

    def test_missing_filter_deducts(self):
        rows = [_row(filter_size="")] + [_row() for _ in range(4)]
        score, issues = app.compute_quality_score(rows)
        assert score < 100
        labels = [label for _, _, label in issues]
        assert any("missing filter" in l for l in labels)

    def test_missing_email_deducts(self):
        rows = [_row(email="")] + [_row() for _ in range(4)]
        score, issues = app.compute_quality_score(rows)
        assert score < 100
        labels = [label for _, _, label in issues]
        assert any("missing email" in l for l in labels)

    def test_duplicate_address_deducts_at_least_10(self):
        rows = [_row(address="123 Main St"), _row(address="123 Main St")]
        score, issues = app.compute_quality_score(rows)
        assert score <= 90  # at least 10 pts deducted
        assert any(kind == "dupe" for kind, _, _ in issues)

    def test_nonstandard_filter_deducts(self):
        rows = [_row(nonstandard=True)] + [_row() for _ in range(4)]
        score, issues = app.compute_quality_score(rows)
        labels = [label for _, _, label in issues]
        assert any("non-standard" in l for l in labels)

    def test_score_floors_at_zero(self):
        # All rows: missing filter + email + nonstandard, all same address (→ dupes).
        # Deductions: filter 40 + email 20 + nonstandard 20 + dupes 20 = 100 → score 0.
        rows = [_row(filter_size="", email="", nonstandard=True, address="Same St")
                for _ in range(5)]
        score, _ = app.compute_quality_score(rows)
        assert score == 0

    def test_empty_rows_returns_zero(self):
        score, issues = app.compute_quality_score([])
        assert score == 0
        assert issues == []


# ── tenant_directory_v1 status filter ───────────────────────────────────────

class TestTenantDirV1StatusFilter:
    """Verify that various active-tenant status values are all accepted."""

    def _make_csv(self, status):
        header = (
            "Status,First Name,Last Name,Unit Street Address 1,Unit Street Address 2,"
            "Unit City,Unit State,Unit Zip,Emails,Unit Tags\n"
        )
        row = f"{status},Jane,Doe,123 Main St,,Austin,TX,78701,jane@example.com,16x20x1\n"
        raw = (header + row).encode("utf-8")
        f = io.BytesIO(raw)
        f.name = "dir.csv"
        return f

    @pytest.mark.parametrize("status", ["Current", "Active", "Occupied", "", "active", "ACTIVE"])
    def test_active_statuses_included(self, status):
        f = self._make_csv(status)
        rows = app.parse_tenant_directory_v1(f)
        # Row should not be filtered out (may be 0 rows if no filter tag, but not skipped for status)
        # Unit Tags has "16x20x1" so it should produce a row
        assert len(rows) >= 1, f"Status '{status}' should not be filtered out"

    @pytest.mark.parametrize("status", ["Former", "Evicted", "Terminated", "Inactive", "Vacated"])
    def test_inactive_statuses_excluded(self, status):
        f = self._make_csv(status)
        rows = app.parse_tenant_directory_v1(f)
        assert len(rows) == 0, f"Status '{status}' should be excluded"


# ── tenant_directory_v2 name reversal ────────────────────────────────────────

class TestTenantDirV2NameReversal:
    def _make_csv(self, tenant_name):
        import csv as _csv
        buf = io.StringIO()
        writer = _csv.writer(buf)
        writer.writerow(["Property", "Unit", "Tenant", "Unit Tags", "Tenant Tags"])
        # Quote address and tenant name properly so commas inside fields don't misalign columns.
        writer.writerow(["CODE - 123 Oak St, Austin, TX 78701", "", tenant_name, "16x20x1", ""])
        raw = buf.getvalue().encode("utf-8")
        f = io.BytesIO(raw)
        f.name = "dir.csv"
        return f

    def test_last_first_reversed(self):
        rows = app.parse_tenant_directory_v2(self._make_csv("Doe, Jane"))
        assert rows[0]["Recipient Name"] == "Jane Doe"

    def test_first_last_unchanged(self):
        # No comma → keep as-is
        rows = app.parse_tenant_directory_v2(self._make_csv("Jane Doe"))
        assert rows[0]["Recipient Name"] == "Jane Doe"

    def test_two_word_surname_reversed(self):
        rows = app.parse_tenant_directory_v2(self._make_csv("Van Halen, Alex"))
        assert rows[0]["Recipient Name"] == "Alex Van Halen"


# ── lookup_gr with custom overrides ─────────────────────────────────────────

class TestLookupGrCustom:
    def test_custom_override_wins_over_builtin(self, tmp_path, monkeypatch):
        import json
        custom = {"acme property mgmt": "GR9999"}
        p = tmp_path / "gr_lookup_custom.json"
        p.write_text(json.dumps(custom))
        monkeypatch.setattr(app, '_custom_gr_path', lambda: str(p))
        assert app.lookup_gr("Acme Property Mgmt") == "GR9999"

    def test_fallback_to_builtin_when_no_custom(self, tmp_path, monkeypatch):
        p = tmp_path / "gr_lookup_custom.json"
        # Don't create the file — should fall back to hardcoded table gracefully
        monkeypatch.setattr(app, '_custom_gr_path', lambda: str(p))
        # Unknown company should return ''
        assert app.lookup_gr("completely unknown company xyz") == ''

    def test_save_normalises_case(self, tmp_path, monkeypatch):
        import json
        p = tmp_path / "gr_lookup_custom.json"
        monkeypatch.setattr(app, '_custom_gr_path', lambda: str(p))
        app.save_custom_gr({"Acme MGMT": "gr0123"})
        saved = json.loads(p.read_text())
        assert "acme mgmt" in saved
        assert saved["acme mgmt"] == "GR0123"

    def test_load_returns_empty_dict_on_missing_file(self, tmp_path, monkeypatch):
        p = tmp_path / "gr_lookup_custom.json"
        monkeypatch.setattr(app, '_custom_gr_path', lambda: str(p))
        assert app.load_custom_gr() == {}

    def test_load_returns_empty_dict_on_corrupt_file(self, tmp_path, monkeypatch):
        p = tmp_path / "gr_lookup_custom.json"
        p.write_text("not valid json {{{")
        monkeypatch.setattr(app, '_custom_gr_path', lambda: str(p))
        assert app.load_custom_gr() == {}
