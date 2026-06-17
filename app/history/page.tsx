"use client";

import Papa from "papaparse";
import { useEffect, useState } from "react";
import {
  appendHistory,
  getCompany,
  listCompanies,
  listHistory,
} from "@/lib/clientStore";
import type { Company } from "@/lib/engine/types";

const NAME_KEYS = ["Recipient Name", "Ship To - Name", "Name"];

function namesFromCsv(text: string): string[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const rows = parsed.data;
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0] ?? {});
  const key =
    NAME_KEYS.find((k) => headers.includes(k)) ?? headers[0] ?? "";
  return rows.map((r) => (r[key] ?? "").trim()).filter(Boolean);
}

export default function HistoryPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [history, setHistory] = useState<
    { grCode: string; batches: number; names: number; lastDate: string | null }[]
  >([]);
  const [grCode, setGrCode] = useState("");
  const [names, setNames] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function refresh() {
    setCompanies(listCompanies());
    setHistory(listHistory());
  }
  useEffect(refresh, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!grCode) return setMsg("Pick a company.");
    let list: string[] = [];
    if (file) {
      const text = await file.text();
      list = namesFromCsv(text);
    } else {
      list = names.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
    if (list.length === 0) return setMsg("No names found.");
    appendHistory(grCode, list, file ? file.name : "pasted");
    setNames("");
    setFile(null);
    setMsg(`Added a batch of ${list.length} names for this company.`);
    refresh();
  }

  return (
    <main>
      <h1>Shipment History</h1>
      <p className="sub">
        Per-company shipped-name lists used to dedup ShipStation outputs.
        Single-filter repeats matching history are flagged; multi-filter are
        released. Downloaded SEND files are recorded here automatically — you can
        also upload a ShipStation “last shipped” export or a previous SEND file.
      </p>

      <form onSubmit={onSubmit} className="panel">
        <div className="row">
          <div>
            <label htmlFor="grCode">Company</label>
            <select
              id="grCode"
              value={grCode}
              onChange={(e) => setGrCode(e.target.value)}
              required
            >
              <option value="" disabled>
                Select a company…
              </option>
              {companies.map((c) => (
                <option key={c.gr_code} value={c.gr_code}>
                  {c.name} ({c.gr_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="file">
              Upload a ShipStation export or a previous SEND file (optional)
            </label>
            <input
              id="file"
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="muted" style={{ fontSize: 12 }}>
              Reads a Recipient Name / Ship To - Name / Name column, else the
              first column.
            </p>
          </div>
        </div>
        <label htmlFor="names">…or paste names, one per line</label>
        <textarea
          id="names"
          rows={4}
          value={names}
          onChange={(e) => setNames(e.target.value)}
          placeholder={"JANE DOE\nJOHN SMITH"}
        />
        {msg && <p style={{ color: "var(--accent)", marginTop: 10 }}>{msg}</p>}
        <div style={{ marginTop: 14 }}>
          <button type="submit">Append to history</button>
        </div>
      </form>

      <h2>Current history</h2>
      {history.length === 0 ? (
        <p className="muted">No history loaded yet.</p>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>GR</th>
                <th className="right">Batches</th>
                <th className="right">Unique names</th>
                <th>Last shipped</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.grCode}>
                  <td>{getCompany(h.grCode)?.name ?? "—"}</td>
                  <td className="mono">{h.grCode}</td>
                  <td className="right">{h.batches}</td>
                  <td className="right">{h.names}</td>
                  <td className="muted">
                    {h.lastDate && new Date(h.lastDate).getTime() > 0
                      ? new Date(h.lastDate).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
