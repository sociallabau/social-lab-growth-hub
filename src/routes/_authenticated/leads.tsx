import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/page-header";
import { LeadsPage as LeadsCrm } from "@/components/leads/leads-page";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Social Lab Growth Hub" },
      { name: "description", content: "Every enquiry from every channel, with an approval inbox." },
      { property: "og:title", content: "Leads — Social Lab Growth Hub" },
      { property: "og:description", content: "Enquiry pipeline for the Social Lab team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadsRoute,
});

function LeadsRoute() {
  return (
    <>
      <PageHeader title="Leads" description="Board and table views of the pipeline. New enquiries are reviewed in Log today." />
      <LeadsCrm />
    </>
  );
}
