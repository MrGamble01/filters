import type {
  Company,
  FlagReason,
  OutputType,
  PlatformKey,
  ProcessedRow,
} from "./engine/types";
import { renderCsvs } from "./engine/output/render";
import { normNameKey } from "./engine/util";
import { SEED_COMPANIES } from "./seed/companies";

/**
 * Client-side persistence (localStorage). Stands in for Supabase so the app
 * works on serverless hosting without a database; replace with Supabase tables
 * in the next pass.
 */

export type JobRow = ProcessedRow & { id: string };

export interface Job {
  id: string;
  company: Company;
  platform: PlatformKey;
  outputType: OutputType;
  autoFill: boolean;
  createdAt: string;
  sourceFile: string;
  inputRowCount: number;
  send: JobRow[];
  flags: JobRow[];
}

const JOBS_KEY = "aff.jobs.v1";
const HISTORY_KEY = "aff.history.v1";
const OVERRIDES_KEY = "aff.companyOverrides.v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Companies ----------------------------------------------------------

export function listCompanies(): Company[] {
  const overrides = read<Record<string, Company>>(OVERRIDES_KEY, {});
  return SEED_COMPANIES.map((c) => overrides[c.gr_code] ?? c);
}

export function getCompany(grCode: string): Company | undefined {
  return listCompanies().find((c) => c.gr_code === grCode);
}

export function upsertCompany(company: Company): void {
  const overrides = read<Record<string, Company>>(OVERRIDES_KEY, {});
  overrides[company.gr_code] = company;
  write(OVERRIDES_KEY, overrides);
}

// ---- History ------------------------------------------------------------

type HistoryMap = Record<string, string[]>;

export function getHistory(grCode: string): string[] {
  return read<HistoryMap>(HISTORY_KEY, {})[grCode] ?? [];
}

/** The whole history map (sent to the API so detected companies get deduped). */
export function getHistoryMap(): HistoryMap {
  return read<HistoryMap>(HISTORY_KEY, {});
}

export function appendHistory(grCode: string, names: string[]): number {
  const map = read<HistoryMap>(HISTORY_KEY, {});
  const list = map[grCode] ?? [];
  const seen = new Set(list.map(normNameKey));
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = normNameKey(name);
    if (!seen.has(key)) {
      seen.add(key);
      list.push(name);
    }
  }
  map[grCode] = list;
  write(HISTORY_KEY, map);
  return list.length;
}

/**
 * Record a downloaded ShipStation report's recipients into that company's
 * shipment history, so the next report dedups them automatically.
 */
export function recordShipment(job: Job): number {
  if (job.outputType !== "shipstation") return 0;
  const names = job.send.map((r) => r.recipient_name).filter(Boolean);
  return appendHistory(job.company.gr_code, names);
}

export function listHistory(): { grCode: string; count: number }[] {
  const map = read<HistoryMap>(HISTORY_KEY, {});
  return Object.entries(map)
    .map(([grCode, names]) => ({ grCode, count: names.length }))
    .sort((a, b) => b.count - a.count);
}

// ---- Jobs ---------------------------------------------------------------

export function listJobs(): Job[] {
  return read<Job[]>(JOBS_KEY, []).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getJob(id: string): Job | undefined {
  return listJobs().find((j) => j.id === id);
}

export function saveJob(job: Job): void {
  const jobs = read<Job[]>(JOBS_KEY, []).filter((j) => j.id !== job.id);
  write(JOBS_KEY, [job, ...jobs]);
}

export function deleteJob(id: string): void {
  write(
    JOBS_KEY,
    read<Job[]>(JOBS_KEY, []).filter((j) => j.id !== id),
  );
}

/** Build a Job from a processing result, assigning row ids. */
export function buildJob(input: {
  company: Company;
  platform: PlatformKey;
  outputType: OutputType;
  autoFill: boolean;
  sourceFile: string;
  inputRowCount: number;
  send: ProcessedRow[];
  flags: ProcessedRow[];
}): Job {
  return {
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
}

const SIZE_REASONS: FlagReason[] = ["missing_size", "ambiguous_size_review"];

/** Resolve a flagged row in place; move it to SEND when no reasons remain. */
export function resolveFlag(
  job: Job,
  rowId: string,
  edits: { sizes?: string; postalCode?: string; name?: string; force?: boolean },
): Job {
  const row = job.flags.find((r) => r.id === rowId);
  if (!row) return job;

  if (edits.sizes && edits.sizes.trim()) {
    row.filter_sizes = edits.sizes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    row.flag_reasons = row.flag_reasons.filter(
      (r) => !SIZE_REASONS.includes(r),
    );
  }
  if (edits.postalCode && edits.postalCode.trim()) {
    row.postal_code = edits.postalCode.trim();
    row.flag_reasons = row.flag_reasons.filter((r) => r !== "ambiguous_zip");
  }
  if (edits.name && edits.name.trim()) {
    row.recipient_name = edits.name.trim();
    row.flag_reasons = row.flag_reasons.filter((r) => r !== "unparseable_name");
  }
  if (edits.force) row.flag_reasons = [];

  if (row.flag_reasons.length === 0) {
    row.destination = "send";
    job.flags = job.flags.filter((r) => r.id !== rowId);
    job.send.push(row);
  }
  saveJob(job);
  return { ...job };
}

// ---- CSV download -------------------------------------------------------

export function jobCsvs(job: Job): { sendCsv: string; flagsCsv: string } {
  return renderCsvs({
    outputType: job.outputType,
    send: job.send,
    flags: job.flags,
    company: job.company,
  });
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
