import { NextRequest, NextResponse } from "next/server";
import { processRaw } from "@/lib/engine/process";
import { parseUpload } from "@/lib/ingest/parseFile";
import type { Company, OutputType, PlatformKey } from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stateless processing endpoint: file + options in, SEND/FLAGS rows out.
 * Persistence lives client-side (localStorage) so the app works on serverless
 * without a database (Supabase persistence is the planned follow-up).
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

  let opt: {
    company?: Company;
    platform?: PlatformKey;
    outputType?: OutputType;
    autoFill?: boolean;
    history?: string[];
  };
  try {
    opt = JSON.parse(String(form.get("options") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "Invalid options." }, { status: 400 });
  }

  if (!opt.company || !opt.platform || !opt.outputType) {
    return NextResponse.json(
      { error: "Select a company, platform and output type." },
      { status: 400 },
    );
  }

  const autoFill = !!opt.autoFill && opt.outputType === "shipstation";
  const history =
    opt.outputType === "shipstation" && Array.isArray(opt.history)
      ? opt.history
      : [];

  try {
    const rows = await parseUpload(file);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in the file." },
        { status: 400 },
      );
    }
    const result = processRaw(rows, {
      company: opt.company,
      platform: opt.platform,
      outputType: opt.outputType,
      autoFillSize: autoFill,
      history,
    });
    return NextResponse.json({
      send: result.send,
      flags: result.flags,
      inputRowCount: rows.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
