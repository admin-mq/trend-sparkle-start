// src/lib/score.ts
//
// PR scores are AI/heuristic-derived on a 0–100 scale. Their real precision
// is roughly ±5 points — the same prompt run twice will easily wobble that
// much. Showing them as exact integers ("73") or with decimals ("67.5%")
// implies certainty the signal doesn't support, and tempts users to read
// meaning into 73-vs-74 noise.
//
// We therefore:
//   • round every displayed score to the nearest 5,
//   • only surface a delta if the (rounded) move is ≥ 5,
//   • offer a band label for cases where a qualitative cue is clearer
//     than a number (e.g. sentiment chips that already say "positive").
//
// This file is the single source of truth for that policy. Everywhere
// the UI shows a 0–100 PR score, route through these helpers so the
// rounding rule stays consistent.
//
// NOTE: scores stay precise in the database. Rounding is purely a
// presentation concern — sorting, deltas, and trend math should still
// run against the raw value, then format at render time.

export type ScoreBand = "low" | "medium" | "high";

/** Round a 0–100 score to the nearest 5, clamped. Returns null for null/undefined. */
export function roundScore(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(100, n));
  return Math.round(clamped / 5) * 5;
}

/** Format a score for display: rounded to 5, or `placeholder` if missing. */
export function formatScore(
  n: number | null | undefined,
  placeholder = "—",
): string {
  const r = roundScore(n);
  return r == null ? placeholder : String(r);
}

/**
 * Compute the change between two scores, but only return it if the rounded
 * move is meaningful (≥ 5 points). Smaller swings are within noise and
 * should not be shown — showing "+2 since last scan" implies precision the
 * model doesn't have.
 *
 * Returns:
 *   - null   → no prior value, or move is within ±5 (don't render a delta)
 *   - number → signed integer, already a multiple of 5
 */
export function meaningfulDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  const c = roundScore(current);
  const p = roundScore(previous);
  if (c == null || p == null) return null;
  const diff = c - p;
  if (Math.abs(diff) < 5) return null;
  return diff;
}

/**
 * Bucket a 0–100 score into a qualitative band. Useful for chips/badges
 * where the number adds noise (e.g. "positive · 83" — the label already
 * conveys direction; the digits just imply false precision).
 */
export function scoreBand(n: number | null | undefined): ScoreBand | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n >= 67) return "high";
  if (n >= 34) return "medium";
  return "low";
}

/** Y-axis tick set for charts plotting 0–100 scores. Five buckets, no false granularity. */
export const SCORE_AXIS_TICKS = [0, 25, 50, 75, 100] as const;
