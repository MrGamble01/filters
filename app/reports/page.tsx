"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteJob,
  downloadCsv,
  jobCsvs,
  listJobs,
  recordShipment,
  type Job,
} from "@/lib/clientStore";

export default function ReportsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    setJobs(listJobs());
  }, []);

  function remove(id: string) {
    deleteJob(id);
    setJobs(listJobs());
  }

  function download(job: Job, kind: "send" | "flags") {
    const { sendCsv, flagsCsv } = jobCsvs(job);
    downloadCsv(
      `${job.company.gr_code}_${job.outputType}_${kind}.csv`,
      kind === "flags" ? flagsCsv : sendCsv,
    );
    if (kind === "send") recordShipment(job);
  }

  return (
    <main>
      <h1>Reports</h1>
      <p className="sub">
        Every file you’ve formatted, newest first. <Link href="/">Format another →</Link>
      </p>

      {jobs === null ? (
        <p className="muted">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No reports yet. <Link href="/">Drop a file</Link> to create one.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>File</th>
                <th>Company</th>
                <th>Output</th>
                <th className="right">Send</th>
                <th className="right">Flags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="muted">
                    {new Date(j.createdAt).toLocaleString()}
                  </td>
                  <td>{j.sourceFile}</td>
                  <td>
                    {j.company.name}{" "}
                    <span className="mono muted">({j.company.gr_code})</span>
                  </td>
                  <td>{j.outputType}</td>
                  <td className="right">{j.send.length}</td>
                  <td className="right">{j.flags.length}</td>
                  <td className="right" style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="secondary"
                      style={{ padding: "4px 10px" }}
                      onClick={() => download(j, "send")}
                    >
                      CSV
                    </button>{" "}
                    <Link href={`/jobs/${j.id}`}>Open</Link>{" "}
                    <button
                      className="ghost"
                      style={{ padding: "4px 10px" }}
                      onClick={() => remove(j.id)}
                    >
                      Delete
                    </button>
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
