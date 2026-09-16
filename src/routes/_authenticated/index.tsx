import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PlaceholderCard } from "@/components/shell/page-header";
import { useServiceLine } from "@/context/service-line";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Social Lab Growth Hub" },
      {
        name: "description",
        content: "Leads, conversion, revenue and capacity at a glance for Social Lab.",
      },
      { property: "og:title", content: "Dashboard — Social Lab Growth Hub" },
      { property: "og:description", content: "Growth metrics at a glance for the Social Lab team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { serviceLine } = useServiceLine();
  return (
    <>
      <PageHeader title="Dashboard" description={`Service line: ${serviceLine}`} />
      <PlaceholderCard text="Growth metrics will appear here." />
    </>
  );
}
