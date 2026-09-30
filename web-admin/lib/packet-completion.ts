type MortalityDay = {
  log_date: string;
  dead_female: number | null;
  dead_male: number | null;
  cull_female: number | null;
  cull_male: number | null;
};

export function hasMortalityEnteredToday(days: MortalityDay[], today: string): boolean {
  return days.some((day) => day.log_date === today &&
    [day.dead_female, day.dead_male, day.cull_female, day.cull_male]
      .some((value) => typeof value === "number" && Number.isFinite(value) && value >= 0));
}

export function capPacketCompletion(percent: number, hasMortality: boolean): number {
  return hasMortality ? percent : Math.min(percent, 50);
}
