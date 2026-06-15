import Link from "next/link";
import { listJobs } from "@/lib/store/jobStore";

export const dynamic = "force-dynamic";

export default function JobsPage() {
  const jobs = listJobs();
  return (
    <main>
      <h1>Jobs</h1>
      <p className="sub">
        Process tenant exports into ShipStation imports or dashboard files.{" "}
        <Link href="/new">New job →</Link>
      </p>

      {jobs.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No jobs yet. <Link href="/new">Create one</Link> by uploading a
            tenant export.
          </p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>GR</th>
                <th>Platform</th>
                <th>Output</th>
                <th className="right">Send</th>
                <th className="right">Flags</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.company.name}</td>
                  <td className="mono">{j.company.gr_code}</td>
                  <td>{j.platform}</td>
                  <td>{j.outputType}</td>
                  <td className="right">{j.send.length}</td>
                  <td className="right">{j.flags.length}</td>
                  <td className="muted">
                    {new Date(j.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <Link href={`/jobs/${j.id}`}>Review →</Link>
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
