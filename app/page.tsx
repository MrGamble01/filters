"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  buildJob,
  downloadCsv,
  getHistoryMap,
  jobCsvs,
  listCompanies,
  listJobs,
  saveJob,
  uid,
  type Job,
} from "@/lib/clientStore";
import { SEED_PLATFORMS } from "@/lib/seed/companies";
import type { Company, OutputType, PlatformKey } from "@/lib/engine/types";

type Settings = {
  grCode: string;
  platform: PlatformKey;
  outputType: OutputType;
  autoFill: boolean;
};

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [recent, setRecent] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsCompany, setNeedsCompany] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [settings, setSettings] = useState<Settings>({
    grCode: "",
    platform: "appfolio",
    outputType: "shipstation",
    autoFill: false,
  });
  const fileRef = useRef<File | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanies(listCompanies());
    setRecent(listJobs().slice(0, 6));
  }, []);

  async function process(file: File, override?: Partial<Settings>) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("filename", file.name);
      fd.append("historyByGr", JSON.stringify(getHistoryMap()));
      const s = { ...settings, ...override };
      if (override?.grCode || settings.grCode) {
        const c = companies.find((x) => x.gr_code === (override?.grCode ?? settings.grCode));
        if (c) fd.append("company", JSON.stringify(c));
      }
      if (override?.platform || s.platform) fd.append("platform", s.platform);
      fd.append("outputType", s.outputType);
      fd.append("autoFill", String(s.autoFill));

      const res = await fetch("/api/process", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Processing failed.");

      if (data.needsCompany) {
        setNeedsCompany(true);
        setJob(null);
        setSettings((p) => ({ ...p, platform: data.detected.platform }));
        return;
      }

      setNeedsCompany(false);
      const company: Company = data.detected.company;
      const next: Settings = {
        grCode: company.gr_code,
        platform: data.detected.platform,
        outputType: s.outputType,
        autoFill: s.autoFill,
      };
      setSettings(next);

      const built = buildJob({
        company,
        platform: next.platform,
        outputType: next.outputType,
        autoFill: next.autoFill,
        sourceFile: file.name,
        inputRowCount: data.inputRowCount,
        send: data.send,
        flags: data.flags,
      });
      // Reuse one job id across re-runs of the same dropped file.
      built.id = jobIdRef.current ?? (jobIdRef.current = uid("job"));
      saveJob(built);
      setJob(built);
      setRecent(listJobs().slice(0, 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File | null | undefined) {
    if (!file) return;
    fileRef.current = file;
    jobIdRef.current = null;
    setJob(null);
    setNeedsCompany(false);
    process(file);
  }

  function rerun(override: Partial<Settings>) {
    setSettings((p) => ({ ...p, ...override }));
    if (fileRef.current) process(fileRef.current, override);
  }

  function download(kind: "send" | "flags") {
    if (!job) return;
    const { sendCsv, flagsCsv } = jobCsvs(job);
    downloadCsv(
      `${job.company.gr_code}_${job.outputType}_${kind}.csv`,
      kind === "flags" ? flagsCsv : sendCsv,
    );
  }

  const isShip = settings.outputType === "shipstation";

  return (
    <main>
      <h1>Format a file</h1>
      <p className="sub">
        Drop a tenant export. It’s auto-detected and formatted into a ShipStation
        CSV. <Link href="/history">Shipment history →</Link>
      </p>

      <div
        className={`dropzone${drag ? " drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="big">
          {busy ? "Processing…" : "Drop a CSV or XLSX here"}
        </div>
        <div className="hint">
          {fileRef.current ? fileRef.current.name : "or click to choose a file"}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {needsCompany && (
        <div className="panel" style={{ marginTop: 16 }}>
          <p style={{ marginTop: 0 }}>
            Couldn’t detect the company from the filename — pick it:
          </p>
          <div className="bar">
            <div style={{ flex: "1 1 320px" }}>
              <select
                defaultValue=""
                onChange={(e) => rerun({ grCode: e.target.value })}
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
          </div>
        </div>
      )}

      {job && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="bar" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {job.company.name}{" "}
                <span className="mono muted">({job.company.gr_code})</span>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {job.inputRowCount} input rows · detected {settings.platform}
              </div>
            </div>
            <div className="bar">
              <button onClick={() => download("send")}>
                Download {isShip ? "ShipStation" : "Dashboard"} CSV ({job.send.length})
              </button>
              <button className="secondary" onClick={() => download("flags")}>
                Flags ({job.flags.length})
              </button>
              <Link className="btn ghost" href={`/jobs/${job.id}`}>
                Review
              </Link>
            </div>
          </div>

          <div className="bar" style={{ marginTop: 16 }}>
            <div>
              <label>Company</label>
              <select
                value={settings.grCode}
                onChange={(e) => rerun({ grCode: e.target.value })}
              >
                {companies.map((c) => (
                  <option key={c.gr_code} value={c.gr_code}>
                    {c.name} ({c.gr_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Platform</label>
              <select
                value={settings.platform}
                onChange={(e) =>
                  rerun({ platform: e.target.value as PlatformKey })
                }
              >
                {SEED_PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Output</label>
              <select
                value={settings.outputType}
                onChange={(e) =>
                  rerun({ outputType: e.target.value as OutputType })
                }
              >
                <option value="shipstation">ShipStation</option>
                <option value="dashboard">Dashboard</option>
              </select>
            </div>
            {isShip && (
              <div>
                <label>Auto-fill</label>
                <label
                  style={{
                    textTransform: "none",
                    margin: 0,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    color: "var(--fg)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settings.autoFill}
                    onChange={(e) => rerun({ autoFill: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                  default size
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h2>Recent files</h2>
          <div className="panel" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Company</th>
                  <th>Output</th>
                  <th className="right">Send</th>
                  <th className="right">Flags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((j) => (
                  <tr key={j.id}>
                    <td>{j.sourceFile}</td>
                    <td>{j.company.name}</td>
                    <td>{j.outputType}</td>
                    <td className="right">{j.send.length}</td>
                    <td className="right">{j.flags.length}</td>
                    <td className="right">
                      <Link href={`/jobs/${j.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
