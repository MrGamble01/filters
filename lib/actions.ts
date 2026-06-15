"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OutputType, PlatformKey } from "./engine/types";
import { processRaw } from "./engine/process";
import { parseUpload } from "./ingest/parseFile";
import {
  appendHistory,
  createJob,
  getCompany,
  getHistory,
  resolveFlag,
  upsertCompany,
} from "./store/jobStore";

/** Create a job from an uploaded file, then go to its Review page. */
export async function createJobAction(formData: FormData): Promise<void> {
  const grCode = String(formData.get("grCode") ?? "");
  const platform = String(formData.get("platform") ?? "") as PlatformKey;
  const outputType = String(formData.get("outputType") ?? "") as OutputType;
  const autoFill =
    outputType === "shipstation" && formData.get("autoFill") === "on";
  const file = formData.get("file");

  const company = getCompany(grCode);
  if (!company) throw new Error("Pick a company.");
  if (!(file instanceof File) || file.size === 0)
    throw new Error("Upload a file.");

  const rawRows = await parseUpload(file);
  const result = processRaw(rawRows, {
    company,
    platform,
    outputType,
    autoFillSize: autoFill,
    history: outputType === "shipstation" ? getHistory(grCode) : [],
  });

  const job = createJob({
    company,
    platform,
    outputType,
    autoFill,
    sourceFile: file.name,
    inputRowCount: rawRows.length,
    send: result.send,
    flags: result.flags,
  });

  redirect(`/jobs/${job.id}`);
}

export async function resolveFlagAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "");
  const rowId = String(formData.get("rowId") ?? "");
  resolveFlag(jobId, rowId, {
    sizes: formData.get("sizes") ? String(formData.get("sizes")) : undefined,
    postalCode: formData.get("postalCode")
      ? String(formData.get("postalCode"))
      : undefined,
    name: formData.get("name") ? String(formData.get("name")) : undefined,
    force: formData.get("force") === "1",
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function appendHistoryAction(formData: FormData): Promise<void> {
  const grCode = String(formData.get("grCode") ?? "");
  const raw = String(formData.get("names") ?? "");
  const file = formData.get("file");

  let names: string[] = [];
  if (file instanceof File && file.size > 0) {
    const rows = await parseUpload(file);
    names = rows
      .map(
        (r) =>
          r["Recipient Name"] ??
          r["Ship To - Name"] ??
          r["Name"] ??
          Object.values(r)[0] ??
          "",
      )
      .filter(Boolean);
  } else {
    names = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  appendHistory(grCode, names);
  revalidatePath("/history");
}

export async function upsertCompanyAction(formData: FormData): Promise<void> {
  const grCode = String(formData.get("grCode") ?? "");
  const existing = getCompany(grCode);
  if (!existing) return;
  upsertCompany({
    ...existing,
    name: String(formData.get("name") ?? existing.name).trim() || existing.name,
    gr_code: grCode,
    default_filter_size:
      String(formData.get("defaultFilterSize") ?? "").trim() || null,
    address_quirk:
      formData.get("addressQuirk") === "on" ? "unit_field_is_address" : null,
  });
  revalidatePath("/settings");
}
