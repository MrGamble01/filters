"use client";

import { useEffect, useMemo, useState } from "react";
import { listCompanies, upsertCompany } from "@/lib/clientStore";
import type { Company } from "@/lib/engine/types";

const LIMIT = 40;

export default function SettingsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [savedGr, setSavedGr] = useState<string | null>(null);

  useEffect(() => {
    setCompanies(listCompanies());
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.gr_code.toLowerCase().includes(q),
    );
  }, [companies, query]);

  const shown = matches.slice(0, LIMIT);

  function save(e: React.FormEvent<HTMLFormElement>, company: Company) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const updated: Company = {
      ...company,
      name: String(data.get("name") ?? company.name).trim() || company.name,
      default_filter_size: String(data.get("defaultFilterSize") ?? "").trim() || null,
      address_quirk: data.get("addressQuirk") === "on" ? "unit_field_is_address" : null,
    };
    upsertCompany(updated);
    setCompanies(listCompanies());
    setSavedGr(company.gr_code);
    setTimeout(() => setSavedGr(null), 1500);
  }

  return (
    <main>
      <h1>Settings — Companies</h1>
      <p className="sub">
        {companies.length} companies (GR codes from the legacy lookup). Edit
        display name, default size, and the unit-field-is-address quirk.
      </p>

      <div className="panel" style={{ marginBottom: 16 }}>
        <label htmlFor="q">Search companies</label>
        <input
          id="q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or GR code…"
        />
      </div>

      <p className="muted">
        Showing {shown.length} of {matches.length} match
        {matches.length === 1 ? "" : "es"}
        {matches.length > LIMIT ? " (refine your search to see more)" : ""}.
      </p>

      <div className="panel" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>GR</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.gr_code}>
                <td className="mono">{c.gr_code}</td>
                <td style={{ paddingTop: 8, paddingBottom: 8 }}>
                  <form className="inline-form" onSubmit={(e) => save(e, c)}>
                    <input
                      type="text"
                      name="name"
                      defaultValue={c.name}
                      style={{ minWidth: 220 }}
                      aria-label="Name"
                    />
                    <input
                      type="text"
                      name="defaultFilterSize"
                      defaultValue={c.default_filter_size ?? ""}
                      placeholder="default size"
                      aria-label="Default size"
                    />
                    <label
                      style={{
                        textTransform: "none",
                        margin: 0,
                        display: "inline-flex",
                        gap: 4,
                        alignItems: "center",
                        color: "var(--fg)",
                      }}
                    >
                      <input
                        type="checkbox"
                        name="addressQuirk"
                        defaultChecked={c.address_quirk === "unit_field_is_address"}
                        style={{ width: "auto" }}
                      />
                      unit=addr
                    </label>
                    <button type="submit" className="secondary">
                      Save
                    </button>
                    {savedGr === c.gr_code && (
                      <span style={{ color: "var(--accent)" }}>✓</span>
                    )}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
