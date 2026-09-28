/** Blank/zero samples must not replace a sex's last measured weight. */
export function isNewerValidWeight(weight: number | null | undefined, date: string | null, currentDate: string | null) {
 return typeof weight === "number" && Number.isFinite(weight) && weight > 0 && !!date && (!currentDate || date > currentDate);
}
