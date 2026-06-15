import { listCompanies } from "@/lib/store/jobStore";
import { SEED_PLATFORMS } from "@/lib/seed/companies";
import { createJobAction } from "@/lib/actions";
import { NewJobForm } from "./NewJobForm";

export const dynamic = "force-dynamic";

export default function NewJobPage() {
  const companies = listCompanies().map((c) => ({
    gr_code: c.gr_code,
    name: c.name,
  }));
  const platforms = SEED_PLATFORMS.map((p) => ({ key: p.key, name: p.name }));

  return (
    <main>
      <h1>New Job</h1>
      <p className="sub">
        Pick a company and platform, choose the output, and upload the export.
      </p>
      <NewJobForm
        companies={companies}
        platforms={platforms}
        action={createJobAction}
      />
    </main>
  );
}
