import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PlaceholderCard } from "@/components/shell/page-header";

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
  component: LeadsPage,
});

function LeadsPage() {
  return (
    <>
      <PageHeader title="Leads" description="Enquiries, inbox approvals and the pipeline." />
      <PlaceholderCard text="The leads pipeline will appear here." />
    </>
  );
}
