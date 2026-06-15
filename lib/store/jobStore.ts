import type {
  Company,
  FlagReason,
  OutputType,
  PlatformKey,
  ProcessedRow,
} from "../engine/types";
import { renderCsvs } from "../engine/output/render";
import { SEED_COMPANIES } from "../seed/companies";

/**
 * In-memory store — the temporary stand-in for Supabase (UI-first milestone).
 * State lives on globalThis so it survives Next.js dev hot-reloads, and resets
 * when the server restarts. Replace with Supabase tables in the next pass.
 */

export type JobRow = ProcessedRow & { id: string };

export interface Job {
  id: string;
  company: Company;
  platform: PlatformKey;
  outputType: OutputType;
  autoFill: boolean;
  createdAt: string;
  send: JobRow[];
  flags: JobRow[];
  sourceFile: string;
  inputRowCount: number;
}

interface Store {
  jobs: Map<string, Job>;
  history: Map<string, string[]>; // gr_code -> recipient names
  companyOverrides: Map<string, Company>; // gr_code -> edited company
}

const g = globalThis as unknown as { __filterStore?: Store };
const store: Store =
  g.__filterStore ??
  (g.__filterStore = {
    jobs: new Map(),
    history: new Map(),
    companyOverrides: new Map(),
  });

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Companies ----------------------------------------------------------

export function listCompanies(): Company[] {
  return SEED_COMPANIES.map((c) => store.companyOverrides.get(c.gr_code) ?? c);
}

export function getCompany(grCode: string): Company | undefined {
  return listCompanies().find((c) => c.gr_code === grCode);
}

export function upsertCompany(company: Company): void {
  store.companyOverrides.set(company.gr_code, company);
}

// ---- History ------------------------------------------------------------

export function getHistory(grCode: string): string[] {
  return store.history.get(grCode) ?? [];
}

export function listHistory(): { grCode: string; count: number }[] {
  return [...store.history.entries()]
    .map(([grCode, names]) => ({ grCode, count: names.length }))
    .sort((a, b) => b.count - a.count);
}

export function appendHistory(grCode: string, names: string[]): number {
  const existing = store.history.get(grCode) ?? [];
  const merged = [...existing, ...names.map((n) => n.trim()).filter(Boolean)];
  store.history.set(grCode, merged);
  return merged.length;
}

// ---- Jobs ---------------------------------------------------------------

export function listJobs(): Job[] {
  return [...store.jobs.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getJob(id: string): Job | undefined {
  return store.jobs.get(id);
}

export function createJob(input: {
  company: Company;
  platform: PlatformKey;
  outputType: OutputType;
  autoFill: boolean;
  sourceFile: string;
  inputRowCount: number;
  send: ProcessedRow[];
  flags: ProcessedRow[];
}): Job {
  const job: Job = {
    id: uid("job"),
    company: input.company,
    platform: input.platform,
    outputType: input.outputType,
    autoFill: input.autoFill,
    createdAt: new Date().toISOString(),
    sourceFile: input.sourceFile,
    inputRowCount: input.inputRowCount,
    send: input.send.map((r) => ({ ...r, id: uid("row") })),
    flags: input.flags.map((r) => ({ ...r, id: uid("row") })),
  };
  store.jobs.set(job.id, job);
  return job;
}

const SIZE_REASONS: FlagReason[] = ["missing_size", "ambiguous_size_review"];

/**
 * Apply an inline flag resolution. Editing a field clears the matching reason;
 * `force` clears all remaining reasons (reviewer override for past_only /
 * likely_duplicate). When no reasons remain, the row moves to SEND.
 */
export function resolveFlag(
  jobId: string,
  rowId: string,
  edits: {
    sizes?: string;
    postalCode?: string;
    name?: string;
    force?: boolean;
  },
): Job | undefined {
  const job = store.jobs.get(jobId);
  if (!job) return undefined;
  const row = job.flags.find((r) => r.id === rowId);
  if (!row) return job;

  if (edits.sizes !== undefined && edits.sizes.trim()) {
    row.filter_sizes = edits.sizes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    row.flag_reasons = row.flag_reasons.filter(
      (r) => !SIZE_REASONS.includes(r),
    );
  }
  if (edits.postalCode !== undefined && edits.postalCode.trim()) {
    row.postal_code = edits.postalCode.trim();
    row.flag_reasons = row.flag_reasons.filter((r) => r !== "ambiguous_zip");
  }
  if (edits.name !== undefined && edits.name.trim()) {
    row.recipient_name = edits.name.trim();
    row.flag_reasons = row.flag_reasons.filter((r) => r !== "unparseable_name");
  }
  if (edits.force) row.flag_reasons = [];

  if (row.flag_reasons.length === 0) {
    row.destination = "send";
    job.flags = job.flags.filter((r) => r.id !== rowId);
    job.send.push(row);
  }
  return job;
}

/** Render current SEND/FLAGS CSVs for a job. */
export function jobCsvs(job: Job): { sendCsv: string; flagsCsv: string } {
  return renderCsvs({
    outputType: job.outputType,
    send: job.send,
    flags: job.flags,
    company: job.company,
  });
}
