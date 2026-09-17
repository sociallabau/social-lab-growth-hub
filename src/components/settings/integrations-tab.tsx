import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, CheckCircle2, Eye, Instagram, Mail, Megaphone, RefreshCw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrationRuns, useRunIntegration, type IntegrationRun } from "@/hooks/use-data";
import { formatDateTime } from "@/lib/format";

interface IntegrationCardDef {
  key: string;
  title: string;
  description: string;
  icon: typeof Mail;
  syncPath: string;
}

const CARDS: IntegrationCardDef[] = [
  { key: "email", title: "Email", description: "Reads the enquiries mailbox and creates pending leads.", icon: Mail, syncPath: "/api/sync/email" },
  { key: "instagram", title: "Instagram DMs", description: "Pulls new DM enquiries and response times.", icon: Instagram, syncPath: "/api/sync/instagram" },
  { key: "meta_ads", title: "Meta Ads", description: "Daily spend, leads and booked calls.", icon: Megaphone, syncPath: "/api/sync/meta-ads" },
  { key: "calendly", title: "Calendly", description: "Meeting bookings arrive by webhook.", icon: CalendarClock, syncPath: "" },
];

export function IntegrationsTab() {
  const { data: runs = [], isLoading } = useIntegrationRuns(200);

  return (
    <div className="space-y-4">
      <WeeklyEmailCard runs={runs.filter((r) => r.integration === "weekly_report").slice(0, 5)} loading={isLoading} />
      <div className="grid gap-4 lg:grid-cols-2">
        {CARDS.map((card) => (
          <IntegrationCard
            key={card.key}
            def={card}
            runs={runs.filter((r) => r.integration === card.key).slice(0, 5)}
            loading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}

/** The Monday summary: preview it in a new tab, or send it to the team now. */
function WeeklyEmailCard({ runs, loading }: { runs: IntegrationRun[]; loading: boolean }) {
  const send = useRunIntegration();
  const sendToMe = useRunIntegration();
  const [previewing, setPreviewing] = useState(false);
  const [myEmail, setMyEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyEmail(data.user?.email ?? null));
  }, []);

  const preview = async () => {
    setPreviewing(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/reports/weekly?preview=1", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const html = await res.text();
      if (!res.ok) throw new Error(html.slice(0, 200));
      const tab = window.open("", "_blank");
      if (!tab) {
        toast.error("Allow pop-ups to see the preview");
        return;
      }
      tab.document.write(html);
      tab.document.close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build the preview");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="size-4" aria-hidden="true" />
          Monday summary email
        </CardTitle>
        <CardDescription>
          Sent to every active team member at 7am Monday: the week's three numbers, the money, and what needs a person.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={preview} disabled={previewing} className="gap-1.5">
            <Eye className="size-4" aria-hidden="true" />
            {previewing ? "Building…" : "Preview this week"}
          </Button>
          <Button
            variant="outline"
            disabled={!myEmail || sendToMe.isPending}
            className="gap-1.5"
            onClick={() =>
              sendToMe.mutate(`/api/reports/weekly?to=${encodeURIComponent(myEmail ?? "")}`, {
                onSuccess: (data) => toast.success(data.message),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            <Send className="size-4" aria-hidden="true" />
            {sendToMe.isPending ? "Sending…" : "Send a test to me"}
          </Button>
          <Button
            onClick={() =>
              send.mutate("/api/reports/weekly", {
                onSuccess: (data) => toast.success(data.message),
                onError: (error) => toast.error(error.message),
              })
            }
            disabled={send.isPending}
            className="gap-1.5"
          >
            <Send className="size-4" aria-hidden="true" />
            {send.isPending ? "Sending…" : "Send to the team"}
          </Button>
        </div>
        <RunList runs={runs} loading={loading} />
      </CardContent>
    </Card>
  );
}

function IntegrationCard({ def, runs, loading }: { def: IntegrationCardDef; runs: IntegrationRun[]; loading: boolean }) {
  const run = useRunIntegration();
  const register = useRunIntegration();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const Icon = def.icon;

  const fire = (mutation: typeof run, path: string) => {
    setResult(null);
    mutation.mutate(path, {
      onSuccess: (data) => {
        setResult({ ok: true, message: data.message });
        toast.success(`${def.title}: ${data.message}`);
      },
      onError: (error) => {
        setResult({ ok: false, message: error.message });
        toast.error(error.message);
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" aria-hidden /> {def.title}
        </CardTitle>
        <CardDescription>{def.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {def.syncPath ? (
            <Button size="sm" onClick={() => fire(run, def.syncPath)} disabled={run.isPending}>
              <RefreshCw className={`size-4 ${run.isPending ? "animate-spin" : ""}`} aria-hidden />
              {run.isPending ? "Syncing…" : "Sync now"}
            </Button>
          ) : null}
          {def.key === "calendly" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => fire(register, "/api/calendly/register")}
              disabled={register.isPending}
            >
              {register.isPending ? "Registering…" : "Register webhook"}
            </Button>
          ) : null}
        </div>

        {result ? (
          <p className={`flex items-start gap-2 text-sm ${result.ok ? "text-good" : "text-critical"}`}>
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{result.message}</span>
          </p>
        ) : null}

        <RunList runs={runs} loading={loading} />
      </CardContent>
    </Card>
  );
}

/** The last few runs of an integration, newest first. */
function RunList({ runs, loading }: { runs: IntegrationRun[]; loading: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last 5 runs</p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : runs.length ? (
        <ul className="space-y-1">
          {runs.map((r) => (
            <li key={r.id} className="flex items-start gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
              {r.ok === true ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
              ) : r.ok === false ? (
                <XCircle className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
              ) : (
                <RefreshCw className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0">
                <span className="font-medium">{formatDateTime(r.started_at)}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {r.ok === true ? "OK" : r.ok === false ? "Failed" : "Running"} · {r.items ?? 0} items
                </span>
                {r.message ? <span className="block break-words text-muted-foreground">{r.message}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No runs yet.</p>
      )}
    </div>
  );
}
