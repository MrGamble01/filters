"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  downloadCsv,
  getJob,
  jobCsvs,
  recordShipment,
  resolveFlag,
  type Job,
  type JobRow,
} from "@/lib/clientStore";

function fullAddress(r: JobRow): string {
  return [r.address1, r.address2].filter(Boolean).join(" ");
}

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [tab, setTab] = useState<"send" | "flags">("send");

  useEffect(() => {
    setJob(getJob(params.id) ?? null);
  }, [params.id]);

  if (job === undefined) return <main><p className="muted">Loading…</p></main>;
  if (job === null)
    return (
      <main>
        <h1>Job not found</h1>
        <p className="sub">
          This job isn’t in this browser. <Link href="/new">Create a new one</Link>.
        </p>
      </main>
    );

  const isShip = job.outputType === "shipstation";

  function download(type: "send" | "flags") {
    const { sendCsv, flagsCsv } = jobCsvs(job!);
    downloadCsv(
      `${job!.company.gr_code}_${job!.outputType}_${type}.csv`,
      type === "flags" ? flagsCsv : sendCsv,
    );
    if (type === "send") recordShipment(job!);
  }

  function onResolve(e: React.FormEvent<HTMLFormElement>, rowId: string, force = false) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const updated = resolveFlag(job!, rowId, {
      sizes: data.get("sizes") ? String(data.get("sizes")) : undefined,
      postalCode: data.get("postalCode") ? String(data.get("postalCode")) : undefined,
      name: data.get("name") ? String(data.get("name")) : undefined,
      force,
    });
    setJob(updated);
  }

  return (
    <main>
      <h1>{job.company.name}</h1>
      <p className="sub">
        <span className="mono">{job.company.gr_code}</span> · {job.platform} ·{" "}
        {job.outputType} · {job.sourceFile}
      </p>

      <div className="stats">
        <div className="stat">
          <div className="num">{job.inputRowCount}</div>
          <div className="lbl">Input rows</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: "var(--accent)" }}>
            {job.send.length}
          </div>
          <div className="lbl">Send</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: "var(--warn)" }}>
            {job.flags.length}
          </div>
          <div className="lbl">Flags</div>
        </div>
      </div>

      <div style={{ margin: "10px 0 4px" }}>
        <button onClick={() => download("send")}>Download SEND CSV</button>{" "}
        <button className="secondary" onClick={() => download("flags")}>
          Download FLAGS CSV
        </button>
      </div>

      <div className="tabs">
        <a
          onClick={() => setTab("send")}
          className={tab === "send" ? "active" : ""}
          style={{ cursor: "pointer" }}
        >
          Send ({job.send.length})
        </a>
        <a
          onClick={() => setTab("flags")}
          className={tab === "flags" ? "active" : ""}
          style={{ cursor: "pointer" }}
        >
          Flags ({job.flags.length})
        </a>
      </div>

      {tab === "send" ? (
        <div className="panel" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Recipient</th>
                <th>{isShip ? "Sizes (CF1)" : "Size"}</th>
                <th>Address</th>
                <th>City</th>
                <th>State</th>
                <th>ZIP</th>
                {isShip && <th>Email</th>}
              </tr>
            </thead>
            <tbody>
              {job.send.map((r) => (
                <tr key={r.id}>
                  <td>{r.recipient_name}</td>
                  <td className="mono">{r.filter_sizes.join(", ")}</td>
                  <td>{fullAddress(r)}</td>
                  <td>{r.city}</td>
                  <td>{r.state}</td>
                  <td className="mono">{r.postal_code}</td>
                  {isShip && <td className="muted">{r.email}</td>}
                </tr>
              ))}
              {job.send.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No send-ready rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Reasons</th>
                <th>Resolve</th>
              </tr>
            </thead>
            <tbody>
              {job.flags.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.recipient_name}
                    <div className="muted mono" style={{ fontSize: 11 }}>
                      {[fullAddress(r), r.city, r.state, r.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                    {r.filter_sizes.length > 0 && (
                      <div className="mono" style={{ fontSize: 11 }}>
                        {r.filter_sizes.join(", ")}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.flag_reasons.map((reason) => (
                      <span key={reason} className="tag flag">
                        {reason}
                      </span>
                    ))}
                  </td>
                  <td>
                    <form
                      className="inline-form"
                      onSubmit={(e) => onResolve(e, r.id)}
                    >
                      {r.flag_reasons.some((x) => x.includes("size")) && (
                        <input type="text" name="sizes" placeholder="e.g. 16x20x1" aria-label="Sizes" />
                      )}
                      {r.flag_reasons.includes("ambiguous_zip") && (
                        <input type="text" name="postalCode" placeholder="ZIP" aria-label="ZIP" />
                      )}
                      {r.flag_reasons.includes("unparseable_name") && (
                        <input type="text" name="name" placeholder="Name" aria-label="Name" />
                      )}
                      <button type="submit">Resolve</button>
                      <button
                        type="button"
                        className="ghost"
                        title="Clear all flags and move to SEND"
                        onClick={() =>
                          setJob(resolveFlag(job!, r.id, { force: true }))
                        }
                      >
                        Send anyway
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {job.flags.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No flags — everything resolved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
