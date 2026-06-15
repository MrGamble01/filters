import { listCompanies, listHistory, getCompany } from "@/lib/store/jobStore";
import { appendHistoryAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const companies = listCompanies();
  const history = listHistory();

  return (
    <main>
      <h1>Shipment History</h1>
      <p className="sub">
        Per-company recipient name lists used to dedup ShipStation outputs.
        Names matching history are flagged (single-filter) or released
        (multi-filter).
      </p>

      <form action={appendHistoryAction} className="panel">
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
            <label htmlFor="file">Upload a CSV of shipped names (optional)</label>
            <input id="file" name="file" type="file" accept=".csv,.xlsx,.xls" />
            <p className="muted" style={{ fontSize: 12 }}>
              Uses a Recipient Name / Ship To - Name / Name column, else the
              first column.
            </p>
          </div>
        </div>
        <label htmlFor="names">…or paste names, one per line</label>
        <textarea id="names" name="names" rows={4} placeholder="JANE DOE&#10;JOHN SMITH" />
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
                <th className="right">Names on file</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.grCode}>
                  <td>{getCompany(h.grCode)?.name ?? "—"}</td>
                  <td className="mono">{h.grCode}</td>
                  <td className="right">{h.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
