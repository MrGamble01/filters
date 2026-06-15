import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob, type JobRow } from "@/lib/store/jobStore";
import { resolveFlagAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

function fullAddress(r: JobRow): string {
  return [r.address1, r.address2].filter(Boolean).join(" ");
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const job = getJob(id);
  if (!job) notFound();

  const activeTab = tab === "flags" ? "flags" : "send";
  const isShip = job.outputType === "shipstation";

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
        <a className="btn" href={`/jobs/${job.id}/download?type=send`}>
          Download SEND CSV
        </a>{" "}
        <a
          className="btn secondary"
          href={`/jobs/${job.id}/download?type=flags`}
        >
          Download FLAGS CSV
        </a>
      </div>

      <div className="tabs">
        <Link
          href={`/jobs/${job.id}?tab=send`}
          className={activeTab === "send" ? "active" : ""}
        >
          Send ({job.send.length})
        </Link>
        <Link
          href={`/jobs/${job.id}?tab=flags`}
          className={activeTab === "flags" ? "active" : ""}
        >
          Flags ({job.flags.length})
        </Link>
      </div>

      {activeTab === "send" ? (
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
                    <form action={resolveFlagAction} className="inline-form">
                      <input type="hidden" name="jobId" value={job.id} />
                      <input type="hidden" name="rowId" value={r.id} />
                      {r.flag_reasons.some((x) =>
                        x.includes("size"),
                      ) && (
                        <input
                          type="text"
                          name="sizes"
                          placeholder="e.g. 16x20x1"
                          aria-label="Sizes"
                        />
                      )}
                      {r.flag_reasons.includes("ambiguous_zip") && (
                        <input
                          type="text"
                          name="postalCode"
                          placeholder="ZIP"
                          aria-label="ZIP"
                        />
                      )}
                      {r.flag_reasons.includes("unparseable_name") && (
                        <input
                          type="text"
                          name="name"
                          placeholder="Name"
                          aria-label="Name"
                        />
                      )}
                      <button type="submit">Resolve</button>
                      <button
                        type="submit"
                        name="force"
                        value="1"
                        className="ghost"
                        title="Clear all flags and move to SEND"
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
