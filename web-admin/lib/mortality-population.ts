export type MortalityPopulationHaul = {
  date: string;
  head: number;
  sex: "female" | "male" | null;
};

// Unknown-sex hauls are allocated across the birds present on the haul date.
export function removeLivehaulBirds(female: number, male: number, hauls: MortalityPopulationHaul[]) {
  let removed = 0;
  for (const haul of hauls) {
    const head = Math.max(0, haul.head);
    removed += head;
    const femaleHead = haul.sex === "female" ? head : haul.sex === "male" ? 0
      : Math.floor(head * (female + male > 0 ? female / (female + male) : 0.5));
    female = Math.max(0, female - femaleHead);
    male = Math.max(0, male - (head - femaleHead));
  }
  return { female, male, removed };
}
