"use client";

import { useState } from "react";

type Opt = { gr_code: string; name: string };
type Platform = { key: string; name: string };

export function NewJobForm({
  companies,
  platforms,
  action,
}: {
  companies: Opt[];
  platforms: Platform[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [outputType, setOutputType] = useState("shipstation");
  const isDashboard = outputType === "dashboard";

  return (
    <form action={action} className="panel" style={{ marginTop: 16 }}>
      <div className="row">
        <div>
          <label htmlFor="grCode">Company</label>
          <select id="grCode" name="grCode" required defaultValue="">
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
          <select id="platform" name="platform" required defaultValue="beagle">
            {platforms.map((p) => (
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
            name="outputType"
            value={outputType}
            onChange={(e) => setOutputType(e.target.value)}
          >
            <option value="shipstation">ShipStation import</option>
            <option value="dashboard">Update Filter Sizes (dashboard)</option>
          </select>
        </div>
        <div>
          <label htmlFor="file">Tenant export (.csv / .xlsx)</label>
          <input id="file" name="file" type="file" accept=".csv,.xlsx,.xls" required />
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
          name="autoFill"
          disabled={isDashboard}
          style={{ width: "auto" }}
        />
        Auto-fill missing sizes with the company default
        {isDashboard && (
          <span className="muted"> — disabled for dashboard output</span>
        )}
      </label>

      <div style={{ marginTop: 18 }}>
        <button type="submit">Process file</button>
      </div>
    </form>
  );
}
