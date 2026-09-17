import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/shell/page-header";
import { LogTodayDialog } from "@/components/log-today/log-today-dialog";
import { useDailyCheckins } from "@/hooks/use-data";
import { todayInBrisbane } from "@/lib/format";
import { DailyEntryForm } from "@/components/daily-log/entry-form";
import { DailyEntriesTable } from "@/components/daily-log/entries-table";
import { useTier } from "@/context/tier";

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
  const { tierFilter } = useTier();
  const today = todayInBrisbane();
  const checkins = useDailyCheckins({ from: today, to: today });
  const [logOpen, setLogOpen] = useState(false);
  const [offered, setOffered] = useState(false);

  // Opening the Daily Log is the cue to do the check-in, so offer it once per visit.
  useEffect(() => {
    if (offered || checkins.isLoading) return;
    setOffered(true);
    if (!(checkins.data ?? []).some((c) => c.date === today)) setLogOpen(true);
  }, [offered, checkins.isLoading, checkins.data, today]);

  return (
    <>
      <PageHeader title="Daily Log" description="One row per channel per tier per day." />
      <DailyEntryForm defaultTier={tierFilter} />
      <DailyEntriesTable tier={tierFilter} />
      <LogTodayDialog open={logOpen} onOpenChange={setLogOpen} />
    </>
  );
}
