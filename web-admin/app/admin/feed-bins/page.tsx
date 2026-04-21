import { FeedBinsView } from "@/app/admin/feed-bins/feed-bins-view";

type FeedBinsPageProps = {
  searchParams?: Promise<{
    farm?: string | string[];
    barn?: string | string[];
    notice?: string | string[];
    error?: string | string[];
  }>;
};

export default function FeedBinsPage({ searchParams }: FeedBinsPageProps) {
  return <FeedBinsView routeBase="/admin/feed-bins" searchParams={searchParams} />;
}
