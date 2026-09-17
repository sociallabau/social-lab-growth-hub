import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { PageHeader } from "@/components/shell/page-header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { todayInBrisbane } from "@/lib/metrics";

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: zodValidator(z.object({
    service: z.string().optional(),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    allChannels: z.boolean().optional(),
  })),
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
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const month = search.month ?? todayInBrisbane().slice(0, 7);
  return (
    <>
      <PageHeader title="Dashboard" description="The numbers that matter, from first response to profitable growth." />
      <Dashboard
        month={month}
        showAllChannels={search.allChannels ?? false}
        onMonthChange={(nextMonth) => navigate({ to: ".", search: (prev) => ({ ...prev, month: nextMonth }) })}
        onShowAllChannels={(show) => navigate({ to: ".", search: (prev) => ({ ...prev, allChannels: show || undefined }) })}
      />
    </>
  );
}
