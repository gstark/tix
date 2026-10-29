const UNITS: [string, number][] = [
  ["d", 86_400_000],
  ["h", 3_600_000],
  ["m", 60_000],
];

/** A short relative time, for example "3h ago". */
export function ago(ms: number, now: number): string {
  const elapsed = Math.max(0, now - ms);
  for (const [unit, size] of UNITS) {
    if (elapsed >= size) return `${Math.floor(elapsed / size)}${unit} ago`;
  }
  return "just now";
}
