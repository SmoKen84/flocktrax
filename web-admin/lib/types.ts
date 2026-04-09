export type OverviewStats = {
  activePlacements: number;
  farmsOnline: number;
  barnsReady: number;
  flocksInCycle: number;
};

export type OverviewAlert = {
  id: string;
  title: string;
  body: string;
  tone: "good" | "warn" | "danger";
};

export type FarmGroupRecord = {
  id: string;
  groupName: string;
  legalName: string;
  integrator: string;
  homeBase: string;
  farmCount: number;
  activePlacements: number;
  primaryContact: string;
  status: "active" | "seasonal" | "inactive";
};

export type FarmRecord = {
  id: string;
  farmGroupId: string;
  farmGroupName: string;
  farmName: string;
  city: string;
  state: string;
  barnCount: number;
  activePlacements: number;
  managerName: string;
  status: "active" | "seasonal" | "inactive";
};

export type BarnRecord = {
  id: string;
  barnCode: string;
  capacity: number;
  currentPlacementCode: string | null;
  nextAvailableDate: string;
};

export type FlockRecord = {
  id: string;
  flockCode: string;
  integrator: string;
  placedDate: string;
  estimatedFirstCatch: string;
  femaleCount: number;
  maleCount: number;
  status: "scheduled" | "active" | "complete";
};

export type PlacementDraftHint = {
  placementCode: string;
  farmName: string;
  barnCode: string;
  startDate: string;
  projectedEndDate: string;
  flockCode: string;
};

export type ActivePlacementRecord = {
  id: string;
  placementCode: string;
  placementId: string;
  farmGroupId: string;
  farmGroupName: string;
  farmId: string;
  farmName: string;
  barnId: string;
  barnCode: string;
  flockCode: string;
  integrator: string;
  placedDate: string;
  estimatedFirstCatch: string;
  ageDays: number;
  headCount: number;
  completionPercent: number;
  submissionStatus: "submitted" | "pending" | "attention";
  dashboardStatusLabel: string;
  dashboardStatusTone: "good" | "warn" | "danger" | "neutral";
  startedFemaleCount: number;
  startedMaleCount: number;
  mortalityFemaleTotal: number;
  mortalityMaleTotal: number;
  currentFemaleCount: number;
  currentMaleCount: number;
  mortalityFemaleLast7Days: number;
  mortalityMaleLast7Days: number;
  mortalityFemaleFirst7Days: number;
  mortalityMaleFirst7Days: number;
  latestFemaleWeight: number | null;
  latestMaleWeight: number | null;
  latestFemaleWeightCount: number | null;
  latestMaleWeightCount: number | null;
  latestFemaleWeightDate: string | null;
  latestMaleWeightDate: string | null;
  hasWeightData: boolean;
};

export type AdminDataBundle = {
  stats: OverviewStats;
  alerts: OverviewAlert[];
  farmGroups: FarmGroupRecord[];
  farms: FarmRecord[];
  barnsByFarmId: Record<string, BarnRecord[]>;
  flocks: FlockRecord[];
  placementHints: PlacementDraftHint[];
  activePlacements: ActivePlacementRecord[];
};
