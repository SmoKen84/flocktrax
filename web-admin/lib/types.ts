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
  placementCode?: string | null;
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

export type ActivityLogRecord = {
  id: string;
  occurredAt: string;
  entryType: string;
  actionKey: string;
  details: string;
  source: string | null;
  placementCode: string | null;
  farmName: string | null;
  barnCode: string | null;
  userName: string | null;
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
  mortalityFirst7DayBreakdown: Array<{
    date: string;
    label: string;
    male: number;
    female: number;
  }>;
  mortalityLast7DayBreakdown: Array<{
    date: string;
    label: string;
    male: number;
    female: number;
  }>;
  latestFemaleWeight: number | null;
  latestMaleWeight: number | null;
  latestFemaleWeightPercentExpected: number | null;
  latestMaleWeightPercentExpected: number | null;
  latestFemaleWeightCount: number | null;
  latestMaleWeightCount: number | null;
  latestFemaleWeightDate: string | null;
  latestMaleWeightDate: string | null;
  lh1Date: string | null;
  lh3Date: string | null;
  tileState: "live" | "awaiting" | "scheduled" | "empty";
  placementIsActive: boolean;
  flockIsInBarn: boolean;
  barnIsEmpty: boolean;
  canMarkBarnEmpty: boolean;
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

export type AccessScopeType = "integrator_group" | "farm_group" | "farm";

export type AccessCapability = string;

export type AccessRoleKey = string;

export type AccessActionPermission = {
  actionId: string;
  action: string;
  menuAccess: boolean;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
};

export type AccessMembership = {
  id: string;
  scopeType: AccessScopeType;
  scopeId: string;
  scopeLabel: string;
};

export type AccessRoleTemplate = {
  key: AccessRoleKey;
  label: string;
  description: string;
  rank: number;
  homeScope: AccessScopeType;
  capabilities: AccessCapability[];
  permissionRows: AccessActionPermission[];
  assignableRoles: AccessRoleKey[];
};

export type AccessUserRecord = {
  id: string;
  displayName: string;
  email: string;
  role: AccessRoleKey;
  assignedRoles: AccessRoleKey[];
  roleLabel: string;
  status: "active" | "invited" | "inactive";
  memberships: AccessMembership[];
  note: string;
};

export type AccessReview = {
  canView: boolean;
  canEdit: boolean;
  canAssignRole: boolean;
  reason: string;
};

export type UserAccessBundle = {
  actingUserId: string | null;
  roles: AccessRoleTemplate[];
  users: AccessUserRecord[];
};
