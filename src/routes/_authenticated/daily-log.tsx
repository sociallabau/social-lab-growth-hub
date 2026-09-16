import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/page-header";
import { DailyEntryForm } from "@/components/daily-log/entry-form";
import { DailyEntriesTable } from "@/components/daily-log/entries-table";
import { useServiceLine } from "@/context/service-line";

export const Route = createFileRoute("/_authenticated/daily-log")({
  head: () => ({
    meta: [
      { title: "Daily Log — Social Lab Growth Hub" },
      { name: "description", content: "Daily leads, meetings, wins and spend by channel." },
      { property: "og:title", content: "Daily Log — Social Lab Growth Hub" },
      { property: "og:description", content: "Daily activity tracking for the Social Lab team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DailyLogPage,
});

function DailyLogPage() {
  const { serviceLineFilter } = useServiceLine();
  return (
    <>
      <PageHeader title="Daily Log" description="One row per channel per service line per day." />
      <DailyEntryForm defaultServiceLine={serviceLineFilter} />
      <DailyEntriesTable serviceLine={serviceLineFilter} />
    </>
  );
}
