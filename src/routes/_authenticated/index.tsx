import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/page-header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { todayInBrisbane } from "@/lib/metrics";

type DashboardSearch = { service?: string | undefined; month?: string | undefined; allChannels?: boolean | undefined };

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    service: typeof search["service"] === "string" ? search["service"] : undefined,
    month: typeof search["month"] === "string" && /^\d{4}-\d{2}$/.test(search["month"]) ? search["month"] : undefined,
    allChannels: search["allChannels"] === true ? true : undefined,
  }),
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
        onShowAllChannels={(show) => navigate({ to: ".", search: (prev) => ({ ...prev, allChannels: show ? true : undefined }) })}
      />
    </>
  );
}
