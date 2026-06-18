import { detectCompany, detectPlatform } from "./ingest/detect";
import { parseUpload } from "./ingest/parseFile";
import { processRaw } from "./engine/process";
import { SEED_COMPANIES } from "./seed/companies";
import type {
  Company,
  OutputType,
  PlatformKey,
  ProcessedRow,
} from "./engine/types";

export interface ProcessFileResult {
  needsCompany?: boolean;
  send: ProcessedRow[];
  flags: ProcessedRow[];
  inputRowCount: number;
  detected: { platform: PlatformKey; company?: Company };
}

/**
 * Run the whole pipeline in the browser (parse + detect + format). No upload,
 * so there's no serverless body-size limit and large exports work fine.
 */
export async function processFileClient(
  file: File,
  opts: {
    company?: Company;
    platform?: PlatformKey;
    outputType: OutputType;
    autoFill?: boolean;
    historyByGr?: Record<string, string[]>;
  },
): Promise<ProcessFileResult> {
  const rows = await parseUpload(file);
  if (rows.length === 0) throw new Error("No data rows found in the file.");

  const headers = Object.keys(rows[0]);
  const platform = opts.platform ?? detectPlatform(headers).platform;
  const company =
    opts.company ?? detectCompany(file.name, SEED_COMPANIES)?.company;

  if (!company) {
    return {
      needsCompany: true,
      send: [],
      flags: [],
      inputRowCount: rows.length,
      detected: { platform },
    };
  }

  const autoFill = !!opts.autoFill && opts.outputType === "shipstation";
  const history =
    opts.outputType === "shipstation"
      ? (opts.historyByGr?.[company.gr_code] ?? [])
      : [];

  const result = processRaw(rows, {
    company,
    platform,
    outputType: opts.outputType,
    autoFillSize: autoFill,
    history,
  });

  return {
    send: result.send,
    flags: result.flags,
    inputRowCount: rows.length,
    detected: { platform, company },
  };
}
