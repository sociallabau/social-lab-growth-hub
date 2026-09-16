import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, PlaceholderCard } from "@/components/shell/page-header";

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
  return (
    <>
      <PageHeader title="Daily Log" description="One row per channel per service line per day." />
      <PlaceholderCard text="The daily log will appear here." />
    </>
  );
}
