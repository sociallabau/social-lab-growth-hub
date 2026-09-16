import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PlaceholderCard } from "@/components/shell/page-header";

export const Route = createFileRoute("/_authenticated/capacity")({
  head: () => ({
    meta: [
      { title: "Capacity — Social Lab Growth Hub" },
      { name: "description", content: "Staff hours, packages and delivery capacity planning." },
      { property: "og:title", content: "Capacity — Social Lab Growth Hub" },
      { property: "og:description", content: "Capacity planning for the Social Lab team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CapacityPage,
});

function CapacityPage() {
  return (
    <>
      <PageHeader title="Capacity" description="Team hours, packages and delivery headroom." />
      <PlaceholderCard text="Capacity planning will appear here." />
    </>
  );
}
