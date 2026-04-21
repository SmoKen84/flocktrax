import { FarmStructureView } from "@/app/admin/farm-structure/structure-view";

type FarmGroupsPageProps = {
  searchParams?: Promise<{
    group?: string | string[];
    farm?: string | string[];
    barn?: string | string[];
  }>;
};

export default function FarmGroupsPage({ searchParams }: FarmGroupsPageProps) {
  return <FarmStructureView routeBase="/admin/farm-groups" searchParams={searchParams} />;
}
