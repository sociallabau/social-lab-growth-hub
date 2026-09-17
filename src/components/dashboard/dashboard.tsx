import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CircleAlert, Clock3, ExternalLink, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import {
  addDays,
  channelTable,
  checkinCalendar,
  checkinStreak,
  clientSummary,
  conversionFlag,
  filterByService,
  leadTargets,
  metaAdsSummary,
  monthStart,
  monthlyTrend,
  pipelineSummary,
  priceTestResults,
  pricingSignal,
  scorecards,
  targetStatus,
  todayInBrisbane,
  type TargetStatus,
} from "@/lib/metrics";
import {
  useChecklist,
  useClients,
  useDailyCheckins,
  useDailyEntries,
  useIntegrationRuns,
  useLeads,
  useListValues,
  useMetaAds,
  useSettings,
  useToggleChecklistItem,
} from "@/hooks/use-data";
import { useServiceLine } from "@/context/service-line";
import { FunnelChart, Sparkline, TrendCharts } from "./dashboard-charts";

function openLogToday() {
  window.dispatchEvent(new Event("social-lab:open-log-today"));
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>{action}
      </div>
      {children}
    </section>
  );
}

const statusStyle: Record<TargetStatus, { icon: typeof CheckCircle2; className: string }> = {
  "On target": { icon: CheckCircle2, className: "text-good" },
  Close: { icon: AlertTriangle, className: "text-warning" },
  "Off target": { icon: CircleAlert, className: "text-critical" },
};

function MetricTile({ label, value, target, display, targetDisplay }: { label: string; value: number; target: number; display: string; targetDisplay: string }) {
  const status = targetStatus(value, target);
  const Icon = statusStyle[status].icon;
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3"><strong className="text-3xl font-semibold tabular-nums">{display}</strong><span className={cn("flex items-center gap-1 text-xs font-medium", statusStyle[status].className)}><Icon className="size-4" />{status}</span></div>
      <Progress value={Math.min(100, target > 0 ? value / target * 100 : 100)} className="mt-4" />
      <p className="mt-2 text-xs text-muted-foreground">Target {targetDisplay}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}

export function Dashboard({ month, showAllChannels, onMonthChange, onShowAllChannels }: { month: string; showAllChannels: boolean; onMonthChange: (month: string) => void; onShowAllChannels: (show: boolean) => void }) {
  const today = todayInBrisbane();
  const { serviceLine } = useServiceLine();
  const settings = useSettings();
  const entries = useDailyEntries();
  const clients = useClients();
  const leads = useLeads();
  const metaAds = useMetaAds({ from: addDays(today, -29), to: today });
  const runs = useIntegrationRuns(20);
  const checklist = useChecklist();
  const channels = useListValues("channel");
  const checkins = useDailyCheckins({ from: addDays(today, -13), to: today });
  const toggleChecklist = useToggleChecklistItem();
  const loading = [settings, entries, clients, leads, metaAds, runs, checklist, channels, checkins].some((query) => query.isLoading);
  const failed = [settings, entries, clients, leads, metaAds, runs, checklist, channels, checkins].find((query) => query.error);

  const dashboard = useMemo(() => {
    if (!settings.data) return null;
    const filteredEntries = filterByService(entries.data ?? [], serviceLine);
    const filteredClients = filterByService(clients.data ?? [], serviceLine);
    const filteredLeads = filterByService(leads.data ?? [], serviceLine);
    const cards = scorecards(filteredEntries, settings.data, today);
    const targets = leadTargets(settings.data, today);
    const trend = monthlyTrend(filteredEntries, filteredClients, settings.data, today);
    const channelRows = channelTable(filteredEntries, channels.data ?? [], `${month}-01`);
    const pipeline = pipelineSummary(filteredLeads, new Date(), today);
    return {
      filteredEntries, filteredClients, filteredLeads, cards, targets, trend, channelRows, pipeline,
      clients: clientSummary(filteredClients, today),
      checkinDays: checkinCalendar((checkins.data ?? []).map((row) => row.date), today),
      streak: checkinStreak((checkins.data ?? []).map((row) => row.date), today),
      prices: priceTestResults(filteredLeads),
      meta: metaAdsSummary(metaAds.data ?? [], today),
    };
  }, [settings.data, entries.data, clients.data, leads.data, channels.data, checkins.data, metaAds.data, serviceLine, today, month]);

  if (loading) return <div className="py-20 text-center text-sm text-muted-foreground">Loading dashboard…</div>;
  if (failed || !settings.data || !dashboard) return <div role="alert" className="rounded-lg border border-critical bg-critical-soft p-4 text-sm">The dashboard could not load. {failed?.error?.message}</div>;

  const metricRows = [
    ["New leads", "leads", (v: number) => v.toLocaleString("en-AU"), dashboard.targets.mtd],
    ["Speed to lead %", "speedToLead", (v: number) => formatPercent(v), settings.data.target_responded_30],
    ["Meetings held", "meetings", (v: number) => v.toLocaleString("en-AU"), null],
    ["Clients won", "wins", (v: number) => v.toLocaleString("en-AU"), null],
    ["Conversion %", "conversion", (v: number) => formatPercent(v), settings.data.target_conversion],
    ["Value won ($/mo)", "value", formatMoney, null],
    ["Average order value", "aov", formatMoney, settings.data.target_aov],
    ["Marketing spend", "spend", formatMoney, null],
    ["CAC", "cac", formatMoney, null],
  ] as const;
  const conversionNote = conversionFlag(dashboard.cards.mtd.conversion, dashboard.cards.mtd.leads);
  const pricing = pricingSignal(dashboard.cards.mtd);
  const visibleChannels = showAllChannels ? dashboard.channelRows : dashboard.channelRows.filter((row) => row.leads || row.meetings || row.wins || row.spend || row.value);
  const latestMetaRun = (runs.data ?? []).find((run) => run.integration.toLowerCase().includes("meta"));

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
          {dashboard.checkinDays.map((day) => <div key={day.date} title={`${formatDate(day.date)} · ${day.state}`} aria-label={`${formatDate(day.date)} ${day.state}`} className={cn("size-7 shrink-0 rounded-sm border", day.state === "logged" ? "border-good bg-good" : day.state === "weekend" ? "border-muted bg-muted" : "border-critical/40 bg-critical-soft")} />)}
        </div>
        <div className="flex items-center justify-between gap-4 lg:justify-end"><div><p className="text-xs text-muted-foreground">Current streak</p><p className="font-semibold">{dashboard.streak} working day{dashboard.streak === 1 ? "" : "s"}</p></div><Button onClick={openLogToday}>Log today</Button></div>
      </section>

      <Section title="The three numbers for Monday">
        <div className="grid gap-4 lg:grid-cols-3">
          <MetricTile label="Leads · last 7 days" value={dashboard.cards.last7.leads} target={settings.data.target_leads_per_week} display={String(dashboard.cards.last7.leads)} targetDisplay={String(settings.data.target_leads_per_week)} />
          <MetricTile label="Speed to lead · last 7 days" value={dashboard.cards.last7.speedToLead} target={settings.data.target_responded_30} display={formatPercent(dashboard.cards.last7.speedToLead)} targetDisplay={formatPercent(settings.data.target_responded_30)} />
          <MetricTile label="Conversion · month to date" value={dashboard.cards.mtd.conversion} target={settings.data.target_conversion} display={formatPercent(dashboard.cards.mtd.conversion)} targetDisplay={formatPercent(settings.data.target_conversion)} />
        </div>
      </Section>

      <Section title="Scorecard">
        <div className="overflow-hidden rounded-lg border bg-card"><Table><TableHeader><TableRow><TableHead>Measure</TableHead><TableHead className="text-right">Today</TableHead><TableHead className="text-right">Last 7 Days</TableHead><TableHead className="text-right">Month to Date</TableHead><TableHead className="text-right">Target</TableHead></TableRow></TableHeader><TableBody>
          {metricRows.map(([label, key, formatter, target]) => <TableRow key={key}><TableCell className="font-medium">{label}</TableCell>{(["today", "last7", "mtd"] as const).map((period) => { const flagged = key === "conversion" && period === "mtd" && conversionNote; return <TableCell key={period} className={cn("text-right tabular-nums", flagged && "bg-warning-soft text-warning-foreground")}><span>{formatter(dashboard.cards[period][key])}</span>{flagged ? <span className="ml-2 inline-flex items-center gap-1 text-xs"><AlertTriangle className="size-3" />Test a price increase</span> : null}</TableCell>; })}<TableCell className="text-right text-muted-foreground">{target === null ? "—" : formatter(target)}</TableCell></TableRow>)}
        </TableBody></Table></div>
        <div className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", pricing.level === "good" ? "border-good/30 bg-good-soft" : pricing.level === "warning" ? "border-warning/40 bg-warning-soft" : pricing.level === "critical" ? "border-critical/30 bg-critical-soft" : "bg-muted")}><Target className="mt-0.5 size-4 shrink-0" /><span><strong>Pricing signal:</strong> {pricing.text}</span></div>
      </Section>

      <Section title="12-month trends"><TrendCharts rows={dashboard.trend} targetAov={settings.data.target_aov} targetLtvCac={settings.data.target_ltv_cac} /></Section>

      <Section title="Lead channels" action={<div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm"><Switch checked={showAllChannels} onCheckedChange={onShowAllChannels} />Show all channels</label><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" aria-label="Channel month" /></div>}>
        <div className="overflow-hidden rounded-lg border bg-card"><Table><TableHeader><TableRow>{["Channel","Leads","Meetings","Clients won","Conversion","Value won","Spend","CAC (direct)","Share of leads"].map((heading) => <TableHead key={heading} className={heading === "Channel" ? "" : "text-right"}>{heading}</TableHead>)}</TableRow></TableHeader><TableBody>{visibleChannels.map((row) => <TableRow key={row.channel}><TableCell className="font-medium">{row.channel}</TableCell><TableCell className="text-right">{row.leads}</TableCell><TableCell className="text-right">{row.meetings}</TableCell><TableCell className="text-right">{row.wins}</TableCell><TableCell className="text-right">{formatPercent(row.conversion)}</TableCell><TableCell className="text-right">{formatMoney(row.value)}</TableCell><TableCell className="text-right">{formatMoney(row.spend)}</TableCell><TableCell className="text-right">{formatMoney(row.cacDirect)}</TableCell><TableCell><div className="ml-auto w-28"><div className="mb-1 text-right text-xs">{formatPercent(row.shareOfLeads)}</div><Progress value={row.shareOfLeads * 100} /></div></TableCell></TableRow>)}</TableBody></Table></div>
      </Section>

      <Section title="Pipeline and speed">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-lg border bg-card p-4"><h3 className="font-medium">Needs attention</h3><Button variant="outline" className="w-full justify-between" onClick={openLogToday}><span>Pending inbox</span><strong>{dashboard.pipeline.pending}</strong></Button><div><p className="mb-2 text-sm text-critical"><CircleAlert className="mr-1 inline size-4" />No response after 30 minutes</p>{dashboard.pipeline.waiting.length ? <div className="space-y-1">{dashboard.pipeline.waiting.slice(0,5).map((lead, index) => <div key={`${lead.received_at}-${index}`} className="flex justify-between text-sm"><span>{"name" in lead && lead.name ? String(lead.name) : "Lead"}</span><span className="font-medium text-critical">{lead.minutes} min</span></div>)}</div> : <p className="text-sm text-muted-foreground">Nobody waiting.</p>}</div></div>
          <div className="space-y-3 rounded-lg border bg-card p-4"><h3 className="font-medium">Upcoming Calendly meetings</h3>{dashboard.pipeline.upcoming.length ? dashboard.pipeline.upcoming.slice(0,6).map((lead, index) => <div key={`${lead.meeting_at}-${index}`} className="flex items-start gap-2 text-sm"><Clock3 className="mt-0.5 size-4 text-primary" /><div><p>{"name" in lead && lead.name ? String(lead.name) : "Lead"}</p><p className="text-xs text-muted-foreground">{formatDateTime(lead.meeting_at)}</p></div></div>) : <p className="text-sm text-muted-foreground">No upcoming meetings.</p>}<div className="border-t pt-3"><Stat label="Median response · last 30 days" value={dashboard.pipeline.medianResponseMinutes === null ? "—" : `${Math.round(dashboard.pipeline.medianResponseMinutes)} min`} /></div></div>
          <div className="rounded-lg border bg-card p-4"><h3 className="mb-2 font-medium">Pipeline funnel</h3><FunnelChart data={dashboard.pipeline.stages} /></div>
        </div>
      </Section>

      <Section title="Price test in thirds"><div className="grid gap-4 md:grid-cols-3">{dashboard.prices.map((price) => { const amount = price.band === "current" ? settings.data.price_point_current : price.band === "mid" ? settings.data.price_point_mid : settings.data.price_point_high; return <div key={price.band} className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between"><h3 className="font-medium capitalize">{price.band}</h3><span className="text-sm text-muted-foreground">{formatMoney(amount)}</span></div><div className="mt-4 grid grid-cols-2 gap-4"><Stat label="Quoted" value={String(price.quoted)} /><Stat label="Won / lost" value={`${price.won} / ${price.lost}`} /><Stat label="Win rate" value={formatPercent(price.winRate)} /><Stat label="Avg won value" value={formatMoney(price.avgWonValue)} /></div></div>; })}</div></Section>

      <Section title="Clients"><div className="grid gap-4 lg:grid-cols-[1fr_1.25fr_1.25fr]"><div className="grid grid-cols-3 gap-4 rounded-lg border bg-card p-4 lg:grid-cols-1"><Stat label="Active clients" value={String(dashboard.clients.count)} /><Stat label="MRR" value={formatMoney(dashboard.clients.mrr)} /><Stat label="Average fee" value={formatMoney(dashboard.clients.averageFee)} /></div><div className="rounded-lg border bg-card p-4"><h3 className="mb-3 font-medium">Bottom 30% by fee</h3><div className="space-y-2">{dashboard.clients.bottomThirty.map((client) => <div key={client.name} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{client.name}</span><span className="shrink-0 text-muted-foreground">{formatMoney(client.monthly_fee)} · {"price_review_status" in client ? String(client.price_review_status).replaceAll("_", " ") : "none"}</span></div>)}</div></div><div className="rounded-lg border bg-card p-4"><h3 className="mb-3 font-medium">Scope review overdue</h3><div className="space-y-2">{dashboard.clients.overdueScopeReviews.map((client) => <div key={client.name} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{client.name}</span><span className="shrink-0 text-critical">{"last_scope_review" in client && client.last_scope_review ? formatDate(String(client.last_scope_review)) : "Never"}</span></div>)}</div></div></div></Section>

      <Section title="Meta Ads this month"><div className="rounded-lg border bg-card p-4"><div className="grid grid-cols-2 gap-5 lg:grid-cols-4"><Stat label="Spend" value={formatMoney(dashboard.meta.spend)} /><Stat label="Leads" value={String(dashboard.meta.leads)} /><Stat label="Cost per lead" value={formatMoney(dashboard.meta.costPerLead)} /><Stat label="Booked calls" value={String(dashboard.meta.schedules)} /></div><div className="mt-4 border-t pt-3"><Sparkline data={dashboard.meta.sparkline} /><p className="text-xs text-muted-foreground">Last sync: {latestMetaRun ? formatDateTime(latestMetaRun.finished_at ?? latestMetaRun.started_at) : "No sync recorded"}</p></div></div></Section>

      <Section title="30-day plan"><div className="divide-y overflow-hidden rounded-lg border bg-card">{(checklist.data ?? []).map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 p-4"><Checkbox checked={item.done} disabled={toggleChecklist.isPending} onCheckedChange={(checked) => toggleChecklist.mutate({ id: item.id, done: checked === true }, { onError: (error) => toast.error(error.message) })} /><span className={cn("flex-1 text-sm", item.done && "text-muted-foreground line-through")}>{item.title}</span>{item.done && item.done_at ? <span className="text-xs text-muted-foreground">Done {formatDate(item.done_at)}</span> : null}</label>)}</div></Section>
      <div className="flex justify-end"><Link to="/daily-log" search={serviceLine === "All" ? {} : { service: serviceLine }} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View daily log <ExternalLink className="size-3" /></Link></div>
    </div>
  );
}