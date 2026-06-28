import type {
  IntermediateRow,
  ProcessOptions,
  ProcessResult,
  ProcessedRow,
  ResolvedUnit,
  ShipStationDefaults,
} from "./types";
import { DEFAULT_SHIPSTATION_DEFAULTS } from "./types";
import { runAdapter, type RawRow } from "./adapters";
import { selectUnits } from "./pipeline/status";
import { extractFilterSizes } from "./pipeline/filterSize";
import { extractSizesFromNotes } from "./pipeline/notes";
import { makeUnitKey } from "./util";
import {
  buildUnitFieldIsAddress,
  resolveAddress,
} from "./pipeline/address";
import { normalizeName } from "./pipeline/name";
import { backfillZips } from "./pipeline/zip";
import { applyMultiSize } from "./pipeline/multiSize";
import { historyDedup } from "./pipeline/historyDedup";
import { splitSendFlags } from "./pipeline/split";
import { renderCsvs } from "./output/render";

/** Enrich one selected/flagged unit through stages 4–6 (size/address/name). */
function resolveUnit(
  row: IntermediateRow,
  unitKey: string,
  unitFieldIsAddress: boolean,
  opts: ProcessOptions,
  extraFlags: ResolvedUnit["flag_reasons"],
): ResolvedUnit {
  const { address1, address2 } = resolveAddress(row, unitFieldIsAddress);
  const { name, flag: nameFlag } = normalizeName(
    row.tenant_name,
    opts.company.name,
  );

  // Size resolution: tags -> notes -> learned memory -> company default -> flag.
  const fromTags = extractFilterSizes(row.unit_tags);
  let sizes = fromTags.sizes;
  const flag_reasons = [...extraFlags, ...fromTags.flags];

  if (sizes.length === 0 && row.notes) {
    const fromNotes = extractSizesFromNotes(row.notes);
    if (fromNotes.sizes.length > 0) sizes = fromNotes.sizes;
    for (const f of fromNotes.flags)
      if (!flag_reasons.includes(f)) flag_reasons.push(f);
  }

  if (sizes.length === 0) {
    const ship = opts.outputType === "shipstation";
    const memKey = makeUnitKey(
      opts.company.gr_code,
      address1,
      address2,
      row.city,
      row.state,
    );
    const remembered = ship ? opts.sizeMemory?.[memKey] : undefined;
    if (remembered && remembered.length > 0) {
      sizes = [...remembered]; // previously-confirmed size for this exact unit
    } else if (ship && opts.autoFillSize && opts.company.default_filter_size) {
      sizes = [opts.company.default_filter_size];
    } else if (!flag_reasons.includes("missing_size")) {
      flag_reasons.push("missing_size");
    }
  }

  if (nameFlag && !flag_reasons.includes(nameFlag)) flag_reasons.push(nameFlag);

  return {
    unit_key: unitKey,
    recipient_name: name,
    filter_sizes: sizes,
    address1,
    address2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    email: row.email,
    flag_reasons,
    raw: row.raw,
  };
}

/** Run the full pipeline against already-normalized intermediate rows. */
export function processIntermediate(
  rows: IntermediateRow[],
  options: ProcessOptions,
): ProcessResult {
  const defaults: ShipStationDefaults = {
    ...DEFAULT_SHIPSTATION_DEFAULTS,
    ...(options.shipstationDefaults ?? {}),
  };

  // Stage 2–3: status filter, unit dedup, tenant selection.
  const { selected, flagged } = selectUnits(rows, {
    company: options.company.name,
    outputType: options.outputType,
  });

  // Address quirk detection uses the full pre-dedup row set.
  const unitFieldIsAddress = buildUnitFieldIsAddress(
    rows,
    options.company,
    options.platform,
  );

  // Stage 4–6: size / address / name enrichment.
  const units: ResolvedUnit[] = [];
  for (const s of selected) {
    units.push(
      resolveUnit(s.row, s.unit_key, unitFieldIsAddress(s.row), options, []),
    );
  }
  for (const f of flagged) {
    units.push(
      resolveUnit(f.row, f.unit_key, unitFieldIsAddress(f.row), options, [
        f.reason,
      ]),
    );
  }

  // Stage 7: ZIP backfill across the whole job.
  backfillZips(units);

  // Stage 8: multi-size handling.
  const processed: ProcessedRow[] = applyMultiSize(units, options.outputType);

  // Stage 9: history dedup (ShipStation only).
  if (options.outputType === "shipstation") {
    historyDedup(processed, options.history ?? []);
  }

  // Stage 10: split SEND vs FLAGS.
  const { send, flags } = splitSendFlags(processed);

  // Stage 11: generate output CSVs.
  const { sendCsv, flagsCsv } = renderCsvs({
    outputType: options.outputType,
    send,
    flags,
    company: options.company,
    defaults,
  });

  return { send, flags, sendCsv, flagsCsv };
}

/** Run the adapter for the platform, then the full pipeline. */
export function processRaw(
  rawRows: RawRow[],
  options: ProcessOptions,
): ProcessResult {
  const intermediate = runAdapter(options.platform, rawRows);
  return processIntermediate(intermediate, options);
}
