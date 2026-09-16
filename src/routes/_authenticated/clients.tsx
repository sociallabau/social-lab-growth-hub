import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PlaceholderCard } from "@/components/shell/page-header";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Social Lab Growth Hub" },
      { name: "description", content: "Client list, fees, tenure and price review status." },
      { property: "og:title", content: "Clients — Social Lab Growth Hub" },
      { property: "og:description", content: "Client roster and revenue for the Social Lab team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  return (
    <>
      <PageHeader title="Clients" description="Fees, tenure, hours and price reviews." />
      <PlaceholderCard text="The client list will appear here." />
    </>
  );
}
