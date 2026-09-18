export function sortBySortCodeEnabled(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
type BarnSortRow = { sort_code?: string | null; barn_code?: string | null };
export function compareBarnOrder(left: BarnSortRow, right: BarnSortRow, useSortCode = false): number {
  const text = (a: string | null | undefined, b: string | null | undefined) =>
    (a ?? "").trim().localeCompare((b ?? "").trim(), undefined, { numeric: true, sensitivity: "base" });
  if (useSortCode) {
    const a = left.sort_code?.trim();
    const b = right.sort_code?.trim();
    if (a && b) { const result = text(a, b); if (result) return result; }
    else if (a || b) return a ? -1 : 1;
  }
  return text(left.barn_code, right.barn_code);
}
