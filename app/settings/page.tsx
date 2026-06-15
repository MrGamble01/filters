import { listCompanies } from "@/lib/store/jobStore";
import { upsertCompanyAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

const LIMIT = 40;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const all = listCompanies();
  const matches = query
    ? all.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.gr_code.toLowerCase().includes(query),
      )
    : all;
  const shown = matches.slice(0, LIMIT);

  return (
    <main>
      <h1>Settings — Companies</h1>
      <p className="sub">
        {all.length} companies (GR codes from the legacy lookup). Edit display
        name, default size, and the unit-field-is-address quirk.
      </p>

      <form method="get" className="panel" style={{ marginBottom: 16 }}>
        <label htmlFor="q">Search companies</label>
        <div className="row">
          <div style={{ flex: "3 1 320px" }}>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Name or GR code…"
            />
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <button type="submit" style={{ marginTop: 0 }}>
              Search
            </button>
          </div>
        </div>
      </form>

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
              <th>Name</th>
              <th>Default size</th>
              <th>Unit=address</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.gr_code}>
                <td className="mono">{c.gr_code}</td>
                <td colSpan={4} style={{ paddingTop: 8, paddingBottom: 8 }}>
                  <form action={upsertCompanyAction} className="inline-form">
                    <input type="hidden" name="grCode" value={c.gr_code} />
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
                        defaultChecked={
                          c.address_quirk === "unit_field_is_address"
                        }
                        style={{ width: "auto" }}
                      />
                      unit=addr
                    </label>
                    <button type="submit" className="secondary">
                      Save
                    </button>
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
