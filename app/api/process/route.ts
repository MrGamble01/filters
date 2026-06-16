import { NextRequest, NextResponse } from "next/server";
import { processRaw } from "@/lib/engine/process";
import { parseUpload } from "@/lib/ingest/parseFile";
import { detectCompany, detectPlatform } from "@/lib/ingest/detect";
import { SEED_COMPANIES } from "@/lib/seed/companies";
import type { Company, OutputType, PlatformKey } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJson<T>(value: FormDataEntryValue | null): T | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Drop-a-file endpoint. Auto-detects platform (from headers) and company (from
 * the filename) when not supplied, runs the pipeline, and returns the rows plus
 * what was detected so the UI can show/adjust it.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Upload a file." }, { status: 400 });
  }
  const filename = String(form.get("filename") || file.name || "");

  const outputType = (String(form.get("outputType") || "shipstation") ===
  "dashboard"
    ? "dashboard"
    : "shipstation") as OutputType;
  const autoFill = form.get("autoFill") === "true" && outputType === "shipstation";
  const overrideCompany = parseJson<Company>(form.get("company"));
  const overridePlatform = form.get("platform")
    ? (String(form.get("platform")) as PlatformKey)
    : undefined;
  const historyByGr =
    parseJson<Record<string, string[]>>(form.get("historyByGr")) ?? {};

  let rows;
  try {
    rows = await parseUpload(file);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No data rows found in the file." },
      { status: 400 },
    );
  }

  const headers = Object.keys(rows[0]);
  const detectedPlatform = detectPlatform(headers);
  const platform = overridePlatform ?? detectedPlatform.platform;

  const company =
    overrideCompany ?? detectCompany(filename, SEED_COMPANIES)?.company;

  if (!company) {
    return NextResponse.json({
      needsCompany: true,
      detected: { platform, platformScore: detectedPlatform.score },
      inputRowCount: rows.length,
    });
  }

  const history =
    outputType === "shipstation" ? (historyByGr[company.gr_code] ?? []) : [];

  try {
    const result = processRaw(rows, {
      company,
      platform,
      outputType,
      autoFillSize: autoFill,
      history,
    });
    return NextResponse.json({
      send: result.send,
      flags: result.flags,
      inputRowCount: rows.length,
      detected: {
        platform,
        platformScore: detectedPlatform.score,
        company,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
