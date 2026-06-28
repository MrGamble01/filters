import type { FlagReason } from "../types";
import { normalizeTriple, normalize2DPublic } from "./filterSize";
import { pushUnique } from "../util";

/**
 * Targeted size recovery from free-form notes (e.g. AppFolio Tenant Notes).
 * Only matches a dimension that appears right after the word "filter", so the
 * many other numbers in notes (dates, money, phone numbers) can't be mistaken
 * for a size.
 */
const NEAR_FILTER =
  /filter[^.;\n]{0,24}?(?<!\d)(\d{1,2}(?:\.\d)?)\s*x\s*(\d{1,2}(?:\.\d)?)(?:\s*x\s*(\d{1,2}(?:\.\d)?))?(?!\d)/gi;

export function extractSizesFromNotes(notes: string): {
  sizes: string[];
  flags: FlagReason[];
} {
  const text = (notes ?? "").replace(/×/g, "x").replace(/[*X]/g, "x");
  const sizes: string[] = [];
  const flags: FlagReason[] = [];
  let m: RegExpExecArray | null;
  NEAR_FILTER.lastIndex = 0;
  while ((m = NEAR_FILTER.exec(text)) !== null) {
    if (m[3] !== undefined) {
      const { size, flag } = normalizeTriple(+m[1], +m[2], +m[3]);
      if (size) pushUnique(sizes, size);
      if (flag) pushUnique(flags, flag);
    } else {
      pushUnique(sizes, normalize2DPublic(+m[1], +m[2]));
    }
  }
  return { sizes, flags };
}
