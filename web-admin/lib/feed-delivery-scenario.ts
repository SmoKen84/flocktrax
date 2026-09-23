export type ScenarioDay = { date: string; starter: number | null; grower: number | null };
export type ScenarioDelivery = { id: string; date: string; pounds: number; feedType: string; included: boolean };

export function projectFeedDeliveries(starter: number | null | undefined, grower: number | null | undefined, daily: ScenarioDay[], deliveries: ScenarioDelivery[]) {
  const invalid = starter == null || grower == null || !Number.isFinite(starter) || !Number.isFinite(grower) || !daily.length ||
    daily.some(day => day.starter == null || day.grower == null || !Number.isFinite(day.starter) || !Number.isFinite(day.grower));
  if (invalid) return { error: "Current inventory and a complete feed projection are required.", days: [], firstShortfall: null, totalShortfall: 0 };
  const selected = deliveries.filter(order => order.included);
  if (selected.some(order => !/^\d{4}-\d{2}-\d{2}$/.test(order.date) || !Number.isFinite(Date.parse(order.date)) || order.date < daily[0].date || !Number.isFinite(order.pounds) || order.pounds <= 0 || !["starter", "grower"].includes(order.feedType))) {
    return { error: "Each included delivery needs a date on or after the report start, positive pounds, and a feed type.", days: [], firstShortfall: null, totalShortfall: 0 };
  }
  let starterBalance = Math.max(0, starter!);
  let growerBalance = Math.max(0, grower!);
  let firstShortfall: string | null = null;
  let totalShortfall = 0;
  const days = daily.map(day => {
    const arrivals = selected.filter(order => order.date === day.date);
    starterBalance += arrivals.filter(order => order.feedType === "starter").reduce((sum, order) => sum + order.pounds, 0);
    growerBalance += arrivals.filter(order => order.feedType === "grower").reduce((sum, order) => sum + order.pounds, 0);
    const starterUsed = Math.min(starterBalance, day.starter!);
    starterBalance -= starterUsed;
    const starterShortfall = day.starter! - starterUsed;
    // Match the report: remaining starter can supply grower demand, but not vice versa.
    const carryUsed = Math.min(starterBalance, day.grower!);
    starterBalance -= carryUsed;
    const growerDemand = day.grower! - carryUsed;
    const growerUsed = Math.min(growerBalance, growerDemand);
    growerBalance -= growerUsed;
    const shortfall = starterShortfall + growerDemand - growerUsed;
    if (shortfall > 0 && firstShortfall === null) firstShortfall = day.date;
    totalShortfall += shortfall;
    return { date: day.date, arriving: arrivals.reduce((sum, order) => sum + order.pounds, 0), demand: day.starter! + day.grower!, balance: starterBalance + growerBalance, shortfall };
  });
  return { error: null, days, firstShortfall, totalShortfall };
}
