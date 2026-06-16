"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildJob,
  getHistory,
  listCompanies,
  saveJob,
  type Job,
} from "@/lib/clientStore";
import { SEED_PLATFORMS } from "@/lib/seed/companies";
import type { Company, OutputType, PlatformKey } from "@/lib/engine/types";

export default function NewJobPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [grCode, setGrCode] = useState("");
  const [platform, setPlatform] = useState<PlatformKey>("beagle");
  const [outputType, setOutputType] = useState<OutputType>("shipstation");
  const [autoFill, setAutoFill] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCompanies(listCompanies());
  }, []);

  const isDashboard = outputType === "dashboard";
  const company = useMemo(
    () => companies.find((c) => c.gr_code === grCode),
    [companies, grCode],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!company) return setError("Pick a company.");
    if (!file) return setError("Choose a file.");

    setBusy(true);
    try {
      const options = {
        company,
        platform,
        outputType,
        autoFill: autoFill && !isDashboard,
        history: outputType === "shipstation" ? getHistory(grCode) : [],
      };
      const fd = new FormData();
      fd.append("file", file);
      fd.append("options", JSON.stringify(options));

      const res = await fetch("/api/process", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Processing failed.");

      const job: Job = buildJob({
        company,
        platform,
        outputType,
        autoFill: options.autoFill,
        sourceFile: file.name,
        inputRowCount: data.inputRowCount,
        send: data.send,
        flags: data.flags,
      });
      saveJob(job);
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed.");
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>New Job</h1>
      <p className="sub">
        Pick a company and platform, choose the output, and upload the export.
      </p>

      <form onSubmit={onSubmit} className="panel" style={{ marginTop: 16 }}>
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
            <label htmlFor="platform">Platform</label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformKey)}
            >
              {SEED_PLATFORMS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row">
          <div>
            <label htmlFor="outputType">Output type</label>
            <select
              id="outputType"
              value={outputType}
              onChange={(e) => setOutputType(e.target.value as OutputType)}
            >
              <option value="shipstation">ShipStation import</option>
              <option value="dashboard">Update Filter Sizes (dashboard)</option>
            </select>
          </div>
          <div>
            <label htmlFor="file">Tenant export (.csv / .xlsx)</label>
            <input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
        </div>

        <label
          style={{
            textTransform: "none",
            marginTop: 16,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            checked={autoFill && !isDashboard}
            disabled={isDashboard}
            onChange={(e) => setAutoFill(e.target.checked)}
            style={{ width: "auto" }}
          />
          Auto-fill missing sizes with the company default
          {isDashboard && (
            <span className="muted"> — disabled for dashboard output</span>
          )}
        </label>

        {error && (
          <p style={{ color: "var(--danger)", marginTop: 14 }}>{error}</p>
        )}

        <div style={{ marginTop: 18 }}>
          <button type="submit" disabled={busy}>
            {busy ? "Processing…" : "Process file"}
          </button>
        </div>
      </form>
    </main>
  );
}
