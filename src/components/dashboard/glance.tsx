// "This week at a glance": the five-minute read for a director. One verdict,
// four numbers, and the short list of things that need a person.
import { AlertTriangle, CheckCircle2, CircleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { targetStatus, type RevenueSummary, type TargetStatus, type Totals } from "@/lib/metrics";

export interface GlanceProps {
  week: Totals;
  monthToDate: Totals;
  revenue: RevenueSummary;
  leadTargetPerWeek: number;
  speedTarget: number;
  conversionTarget: number;
  attention: string[];
}

const STATUS: Record<TargetStatus, { icon: LucideIcon; label: string; className: string }> = {
  "On target": { icon: CheckCircle2, label: "On target", className: "text-foreground" },
  Close: { icon: AlertTriangle, label: "Watch", className: "text-alert" },
  "Off target": { icon: CircleAlert, label: "Off target", className: "text-alert" },
};

function GlanceTile({
  label, value, targetLabel, status, progress, note,
}: {
  label: string; value: string; targetLabel: string; status: TargetStatus; progress: number; note?: string | undefined;
}) {
  const { icon: Icon, label: statusLabel, className } = STATUS[status];
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-label">{label}</p>
      <strong className="mt-2 block text-4xl font-bold tracking-tight tabular-nums">{value}</strong>
      <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide", className)}>
        <Icon className="size-4" aria-hidden="true" />
        {statusLabel}
      </div>
      <Progress value={Math.max(0, Math.min(100, progress * 100))} className="mt-4" />
      <p className="mt-2 text-xs text-muted-foreground">{targetLabel}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** One sentence a director can read without looking at anything else. */
export function weekVerdict(counts: { onTarget: number; attention: number }): string {
  if (counts.attention === 0 && counts.onTarget >= 3) return "A good week. Everything is on target and nothing needs you.";
  if (counts.attention === 0) return "Steady week. Nothing needs you right now.";
  if (counts.onTarget >= 2) return `Mostly on track, with ${counts.attention} thing${counts.attention === 1 ? "" : "s"} to sort out.`;
  return `Off the pace this week, with ${counts.attention} thing${counts.attention === 1 ? "" : "s"} needing attention.`;
}

export function Glance({ week, monthToDate, revenue, leadTargetPerWeek, speedTarget, conversionTarget, attention }: GlanceProps) {
  const leadStatus = targetStatus(week.leads, leadTargetPerWeek);
  const speedStatus = week.leads ? targetStatus(week.speedToLead, speedTarget) : "Off target";
  // Above 40% is a signal to raise prices, not a win, so it reads as "watch"
  const conversionStatus: TargetStatus =
    monthToDate.conversion > 0.4 ? "Close" : monthToDate.leads ? targetStatus(monthToDate.conversion, conversionTarget) : "Off target";
  const revenueStatus = targetStatus(revenue.mrr, revenue.target);

  const onTarget = [leadStatus, speedStatus, conversionStatus, revenueStatus].filter((s) => s === "On target").length;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <p className="text-label">This week at a glance</p>
        <p className="mt-2 text-xl font-semibold">{weekVerdict({ onTarget, attention: attention.length })}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GlanceTile
          label="Leads · last 7 days"
          value={String(week.leads)}
          targetLabel={`Target ${leadTargetPerWeek} a week`}
          status={leadStatus}
          progress={leadTargetPerWeek ? week.leads / leadTargetPerWeek : 0}
        />
        <GlanceTile
          label="Answered in 30 min · last 7 days"
          value={week.leads ? formatPercent(week.speedToLead) : "—"}
          targetLabel={`Target ${formatPercent(speedTarget)}`}
          status={speedStatus}
          progress={speedTarget ? week.speedToLead / speedTarget : 0}
          note={week.leads ? undefined : "No leads logged this week"}
        />
        <GlanceTile
          label="Conversion · month to date"
          value={monthToDate.leads ? formatPercent(monthToDate.conversion) : "—"}
          targetLabel={`Sweet spot ${formatPercent(conversionTarget)}`}
          status={conversionStatus}
          progress={conversionTarget ? monthToDate.conversion / conversionTarget : 0}
          note={monthToDate.conversion > 0.4 ? "Above 40%: test a price increase" : undefined}
        />
        <GlanceTile
          label="Monthly recurring revenue"
          value={formatMoney(revenue.mrr)}
          targetLabel={`Target ${formatMoney(revenue.target)}`}
          status={revenueStatus}
          progress={revenue.progress}
          note={
            revenue.gap > 0
              ? `${formatMoney(revenue.gap)} to go · about ${revenue.clientsToTarget} more clients`
              : "Target reached"
          }
        />
      </div>

      <div className="rounded-lg border bg-card p-5">
        <p className="text-label">What needs a person</p>
        {attention.length ? (
          <ul className="mt-3 space-y-2">
            {attention.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-alert" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Nothing outstanding.
          </p>
        )}
      </div>
    </section>
  );
}
