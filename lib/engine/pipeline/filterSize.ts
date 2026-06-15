import type { FlagReason } from "../types";
import { pushUnique } from "../util";

/**
 * Filter-size extraction, normalization and validation (Section 8).
 *
 * Output sizes are canonical "WxHxD" with width <= height and a plausible depth.
 */

const FILTER_KEYWORDS = /\b(filter|hvac|air)\b/i;

/** Normalize separators: ×, *, X all become lowercase x. */
function preclean(s: string): string {
  return (s ?? "")
    .replace(/×/g, "x") // ×
    .replace(/[*X]/g, "x");
}

/**
 * Strip leading quantity prefixes such as "2 x 25x25x1" or "2-20x20x1",
 * but ONLY when what follows is a full 3-dimension match. Operates globally so
 * an embedded prefix (e.g. "Air Filter 2 x 25x25x1") is also removed.
 */
function stripQuantityPrefixes(token: string): string {
  return token.replace(
    /\b\d{1,2}\s*[x-]\s*(?=\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2})/gi,
    "",
  );
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

  // Depth implausible — attempt the misplaced-1 fix.
  const dims = [a, b, c];
  const ones = dims.filter((d) => d === 1).length;
  if (ones === 1) {
    const rest = dims.filter((d) => d !== 1);
    const [w, h] = order2(rest[0], rest[1]);
    return { size: `${w}x${h}x1` };
  }

  // Zero or multiple 1s with an implausible depth -> ambiguous, do not guess.
  return { flag: "ambiguous_size_review" };
}

/** Normalize a 2-dimension match using the default depth of 1. */
function normalize2D(a: number, b: number): string {
  const [w, h] = order2(a, b);
  return `${w}x${h}x1`;
}

/**
 * Extract all distinct normalized filter sizes from a free-form tag string.
 *
 * - 3D matches are primary.
 * - 2D matches are accepted only when a filter keyword appears in the string.
 * - Quantity prefixes are stripped first.
 * - Any implausible/ambiguous size yields a flag (the unit is routed to review).
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
    token = stripQuantityPrefixes(token);

    const re3 = /(\d{1,2})\s*x\s*(\d{1,2})\s*x\s*(\d{1,2})/gi;
    let found3 = false;
    let m: RegExpExecArray | null;
    while ((m = re3.exec(token)) !== null) {
      found3 = true;
      const { size, flag } = normalizeTriple(+m[1], +m[2], +m[3]);
      if (size) pushUnique(sizes, size);
      if (flag) pushUnique(flags, flag);
    }

    if (!found3) {
      const m2 = /(\d{1,2})\s*x\s*(\d{1,2})/i.exec(token);
      if (m2 && hasKeyword) {
        pushUnique(sizes, normalize2D(+m2[1], +m2[2]));
      }
    }
  }

  return { sizes, flags };
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
