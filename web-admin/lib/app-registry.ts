export type FeaturePreference = {
  key: string;
  label: string;
  status: "enabled" | "disabled" | "planned";
  note: string;
};

export type RegistryField = {
  label: string;
  value: string;
};

export const applicationRegistry = {
  title: "FlockTrax application registry",
  summary:
    "Maintain ownership text, legal naming, and rollout toggles here so the admin shell has one clean source of truth.",
  subtitleLine: [
    "FlockTrax-Admin",
    "FlockTrax-Mobile",
    "Integrated Flock Management Platform",
  ],
  descriptorLine:
    "In-Barn Data Collection - Enterprise Scalable Information Analysis - Backend Sync Pipeline to Corporate / IS Platforms",
  ownershipStatement:
    "FlockTrax is the named poultry-operations application and administrative system maintained by its designated owner-operator. Branding, workflow design, and supporting operational logic are reserved to the FlockTrax program as maintained by its current owner.",
  fields: [
    { label: "Application name", value: "FlockTrax" },
    { label: "Product role", value: "Poultry operations admin and reporting console" },
    { label: "Owner / steward", value: "FlockTrax program owner" },
    { label: "Copyright line", value: "Copyright 2026 FlockTrax. All rights reserved." },
    { label: "Operating entity", value: "Smotherman Farms, Ltd. West, Texas." },
    { label: "Support contact", value: "Update this field when the support mailbox is finalized." },
  ] satisfies RegistryField[],
  featurePreferences: [
    {
      key: "mobile-live-submit",
      label: "Live mobile placement submit",
      status: "enabled",
      note: "Worker submissions can post through the active placement submit flow.",
    },
    {
      key: "adalo-debug-echo",
      label: "Adalo debug echo mode",
      status: "planned",
      note: "Keep available during integration work, then retire once request payloads are stable.",
    },
    {
      key: "ownership-banner",
      label: "Ownership and legal banner",
      status: "enabled",
      note: "Shows the formal ownership statement on the admin landing page.",
    },
    {
      key: "advanced-feature-tags",
      label: "Expandable feature tags",
      status: "enabled",
      note: "Use this registry as the place to turn future desktop features on, off, or into preview.",
    },
  ] satisfies FeaturePreference[],
} as const;
