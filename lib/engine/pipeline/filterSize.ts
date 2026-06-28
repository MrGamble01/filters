import type { FlagReason } from "../types";
import { pushUnique } from "../util";

/**
 * Filter-size extraction, normalization and validation (Section 8), with
 * repeat-by-quantity semantics confirmed against real output:
 * a unit needing 2x 14x24x1 yields ["14x24x1", "14x24x1"] (sizes are NOT
 * deduped). Quantity may be expressed as a leading prefix ("2 x 25x25x1",
 * "2-20x20x1") or, for Beagle, paired Filter Size / Quantity columns assembled
 * by the adapter into repeated entries.
 */

const FILTER_KEYWORDS = /\b(filter|hvac|air)\b/i;
// A dimension: 1–2 digits with an optional half/decimal (e.g. 15.5), and NOT
// part of a longer number ("165" must not yield "65"). Decimals matter — HVAC
// filters come in sizes like 15.5 / 19.5 / 21.5.
const NUM = "(?<!\\d)\\d{1,2}(?:\\.\\d)?(?!\\d)";
const DIM3_SOURCE = `(${NUM})\\s*x\\s*(${NUM})\\s*x\\s*(${NUM})`;
const DIM3_LOOKAHEAD = `${NUM}\\s*x\\s*${NUM}\\s*x\\s*${NUM}`;
const QTY_PREFIX = new RegExp(
  `^\\s*(\\d{1,2})\\s*[x-]\\s*(?=${DIM3_LOOKAHEAD})`,
  "i",
);
const EMBEDDED_QTY = new RegExp(
  `\\b\\d{1,2}\\s*[x-]\\s*(?=${DIM3_LOOKAHEAD})`,
  "gi",
);
const DIM2 = new RegExp(`(${NUM})\\s*x\\s*(${NUM})`, "i");

/** Normalize separators: ×, *, X all become lowercase x. */
function preclean(s: string): string {
  return (s ?? "").replace(/×/g, "x").replace(/[*X]/g, "x");
}

function depthOk(d: number): boolean {
  return d >= 1 && d <= 6;
}

function order2(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

/**
 * Normalize a matched 3-tuple into a canonical size, or return a flag.
 * Implements the depth rules and the misplaced-1 fix (Section 8).
 */
export function normalizeTriple(
  a: number,
  b: number,
  c: number,
): { size?: string; flag?: FlagReason } {
  if (depthOk(c)) {
    const [w, h] = order2(a, b);
    return { size: `${w}x${h}x${c}` };
  }

  const dims = [a, b, c];
  const ones = dims.filter((d) => d === 1).length;
  if (ones === 1) {
    const rest = dims.filter((d) => d !== 1);
    const [w, h] = order2(rest[0], rest[1]);
    return { size: `${w}x${h}x1` };
  }

  return { flag: "ambiguous_size_review" };
}

function normalize2D(a: number, b: number): string {
  const [w, h] = order2(a, b);
  return `${w}x${h}x1`;
}

/**
 * Extract normalized filter sizes from a free-form tag string, preserving
 * repeats (quantity). Returns sizes in source order plus any validation flags.
 */
export function extractFilterSizes(raw: string): {
  sizes: string[];
  flags: FlagReason[];
} {
  const text = preclean(raw ?? "");
  const hasKeyword = FILTER_KEYWORDS.test(text);
  const tokens = text.split(/[,;/\n]+|\band\b/i);

  const sizes: string[] = [];
  const flags: FlagReason[] = [];

  for (let token of tokens) {
    // Leading quantity prefix -> multiplier for the size that follows.
    let multiplier = 1;
    const lead = QTY_PREFIX.exec(token);
    if (lead) {
      multiplier = Math.min(Math.max(parseInt(lead[1], 10) || 1, 1), 24);
      token = token.slice(lead[0].length);
    }
    // Strip any further embedded quantity markers (avoids mis-matching them as
    // dimensions); their multiplier is not separately tracked.
    token = token.replace(EMBEDDED_QTY, "");

    const re3 = new RegExp(DIM3_SOURCE, "gi");
    let found3 = false;
    let m: RegExpExecArray | null;
    while ((m = re3.exec(token)) !== null) {
      found3 = true;
      const { size, flag } = normalizeTriple(+m[1], +m[2], +m[3]);
      if (size) for (let i = 0; i < multiplier; i++) sizes.push(size);
      if (flag) pushUnique(flags, flag);
    }

    if (!found3) {
      const m2 = new RegExp(DIM2.source, "i").exec(token);
      if (m2 && hasKeyword) {
        const size = normalize2D(+m2[1], +m2[2]);
        for (let i = 0; i < multiplier; i++) sizes.push(size);
      }
    }
  }

  return { sizes, flags };
}

/** Public 2D normalizer (used by the notes-based size recovery). */
export function normalize2DPublic(a: number, b: number): string {
  return normalize2D(a, b);
}

/**
 * Resolve the final size list for a unit, applying opt-in auto-fill.
 *
 * Auto-fill with the company default is permitted ONLY for ShipStation and ONLY
 * when explicitly enabled. A dashboard (system-of-record) output never receives
 * a guessed size (Section 8 / 14).
 */
export function resolveUnitSizes(
  unitTags: string,
  opts: {
    outputType: "shipstation" | "dashboard";
    autoFillSize?: boolean;
    defaultFilterSize?: string | null;
  },
): { sizes: string[]; flags: FlagReason[] } {
  const { sizes, flags } = extractFilterSizes(unitTags);

  if (sizes.length === 0) {
    const canAutoFill =
      opts.outputType === "shipstation" &&
      !!opts.autoFillSize &&
      !!opts.defaultFilterSize;
    if (canAutoFill) {
      return { sizes: [opts.defaultFilterSize as string], flags };
    }
    if (!flags.includes("missing_size")) flags.push("missing_size");
  }

  return { sizes, flags };
}
