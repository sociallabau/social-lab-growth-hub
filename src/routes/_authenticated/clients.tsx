import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/page-header";
import { ClientsTable } from "@/components/clients/clients-table";
import { useTier } from "@/context/tier";

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
  const { tierFilter } = useTier();
  return (
    <>
      <PageHeader title="Clients" description="Fees, tenure, hours and price reviews." />
      <ClientsTable tier={tierFilter} />
    </>
  );
}
