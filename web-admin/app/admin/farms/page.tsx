import { FarmStructureView } from "@/app/admin/farm-structure/structure-view";

type FarmsPageProps = {
  searchParams?: Promise<{
    group?: string | string[];
    farm?: string | string[];
    barn?: string | string[];
  }>;
};

export default function FarmsPage({ searchParams }: FarmsPageProps) {
  return <FarmStructureView routeBase="/admin/farms" searchParams={searchParams} />;
}
