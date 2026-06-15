import { SEED_COMPANIES } from "@/lib/seed/companies";

const PIPELINE_STAGES = [
  "Parse (platform adapters)",
  "Status filter + unit dedup + tenant selection",
  "Filter-size extraction + normalization",
  "Address parsing (Address 1 / Address 2)",
  "Name normalization",
  "ZIP backfill",
  "Multi-size handling (consolidate vs expand)",
  "History dedup (ShipStation only)",
  "SEND vs FLAGS split",
  "Generate output CSV",
];

export default function Home() {
  return (
    <main>
      <h1>Air Filter Fulfillment Platform</h1>
      <p style={{ color: "var(--muted)" }}>
        Scaffold + core processing engine. UI (Jobs, New Job, Review, History,
        Settings) is the next milestone — see <code>BUILD_SPEC.md</code>.
      </p>

      <h2>Processing pipeline</h2>
      <ol>
        {PIPELINE_STAGES.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <h2>Seeded companies</h2>
      <p style={{ color: "var(--muted)" }}>
        {SEED_COMPANIES.length} companies loaded (GR codes, aliases, address
        quirks).
      </p>
    </main>
  );
}
