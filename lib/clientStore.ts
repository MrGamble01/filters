import type {
  Company,
  FlagReason,
  OutputType,
  PlatformKey,
  ProcessedRow,
} from "./engine/types";
import { renderCsvs } from "./engine/output/render";
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
const HISTORY_KEY = "aff.history.v1"; // legacy flat map (migrated to shipments)
const SHIPMENTS_KEY = "aff.shipments.v1";
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

// ---- Shipment history (dated batches) -----------------------------------

/** One shipment batch — the recipients from a single SEND file or upload. */
export interface Shipment {
  id: string;
  grCode: string;
  date: string; // ISO
  source: string; // filename / "pasted" / "legacy"
  names: string[];
}

/** Dedup scope. Default is the single most recent batch (last send file). */
export type DedupPolicy =
  | { mode: "last"; count: number }
  | { mode: "days"; days: number }
  | { mode: "all" };

export const DEFAULT_DEDUP_KEY = "last:1";

export function dedupPolicyFromKey(key: string): DedupPolicy {
  if (key === "all") return { mode: "all" };
  const [mode, n] = key.split(":");
  const value = Number(n) || 1;
  if (mode === "days") return { mode: "days", days: value };
  return { mode: "last", count: value };
}

function readShipments(): Shipment[] {
  const list = read<Shipment[]>(SHIPMENTS_KEY, []);
  if (list.length > 0) return list;
  // One-time migration from the old flat per-company name map.
  const legacy = read<Record<string, string[]>>(HISTORY_KEY, {});
  const migrated: Shipment[] = Object.entries(legacy)
    .filter(([, names]) => names.length > 0)
    .map(([grCode, names]) => ({
      id: uid("ship"),
      grCode,
      date: new Date(0).toISOString(),
      source: "legacy",
      names,
    }));
  if (migrated.length > 0) write(SHIPMENTS_KEY, migrated);
  return migrated;
}

export function addShipment(
  grCode: string,
  names: string[],
  source: string,
): number {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return 0;
  const list = readShipments();
  list.push({
    id: uid("ship"),
    grCode,
    date: new Date().toISOString(),
    source,
    names: clean,
  });
  write(SHIPMENTS_KEY, list);
  return clean.length;
}

/** Record a downloaded ShipStation report as a new shipment batch. */
export function recordShipment(job: Job): number {
  if (job.outputType !== "shipstation") return 0;
  return addShipment(
    job.company.gr_code,
    job.send.map((r) => r.recipient_name),
    job.sourceFile || "report",
  );
}

/** Manual add from the Shipment History page (upload / paste). */
export function appendHistory(
  grCode: string,
  names: string[],
  source = "upload",
): number {
  return addShipment(grCode, names, source);
}

export function listShipments(grCode: string): Shipment[] {
  return readShipments()
    .filter((s) => s.grCode === grCode)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Pure: pick the batches a policy keeps (newest first). */
export function applyDedupPolicy(
  shipments: Shipment[],
  policy: DedupPolicy,
  now: number = Date.now(),
): Shipment[] {
  const all = [...shipments].sort((a, b) => b.date.localeCompare(a.date));
  if (policy.mode === "all") return all;
  if (policy.mode === "last") return all.slice(0, Math.max(1, policy.count));
  const cutoff = now - policy.days * 86_400_000;
  return all.filter((s) => new Date(s.date).getTime() >= cutoff);
}

/** Pure: union of recipient names across the batches a policy keeps. */
export function dedupNames(
  shipments: Shipment[],
  policy: DedupPolicy,
  now?: number,
): string[] {
  const names = new Set<string>();
  for (const s of applyDedupPolicy(shipments, policy, now))
    for (const n of s.names) names.add(n);
  return [...names];
}

/** Dedup names per company under a policy (sent to the API). */
export function buildHistoryByGr(policy: DedupPolicy): Record<string, string[]> {
  const byGr = new Map<string, Shipment[]>();
  for (const s of readShipments()) {
    const arr = byGr.get(s.grCode) ?? [];
    arr.push(s);
    byGr.set(s.grCode, arr);
  }
  const out: Record<string, string[]> = {};
  for (const [grCode, list] of byGr) out[grCode] = dedupNames(list, policy);
  return out;
}

export function listHistory(): {
  grCode: string;
  batches: number;
  names: number;
  lastDate: string | null;
}[] {
  const byGr = new Map<string, Shipment[]>();
  for (const s of readShipments()) {
    const arr = byGr.get(s.grCode) ?? [];
    arr.push(s);
    byGr.set(s.grCode, arr);
  }
  return [...byGr.entries()]
    .map(([grCode, list]) => {
      const names = new Set<string>();
      for (const s of list) for (const n of s.names) names.add(n);
      const lastDate = list
        .map((s) => s.date)
        .sort()
        .at(-1) ?? null;
      return { grCode, batches: list.length, names: names.size, lastDate };
    })
    .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
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
