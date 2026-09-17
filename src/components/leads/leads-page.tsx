// Leads: a light CRM. Pending and rejected enquiries live in the Log today
// inbox, not here.
import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeads, type Lead } from "@/hooks/use-data";
import { HIDDEN_STATUSES } from "@/lib/leads";
import { filterByTier } from "@/lib/metrics";
import { useTier } from "@/context/tier";
import { AddLeadDialog } from "./add-lead-dialog";
import { LeadActionsProvider } from "./lead-actions";
import { LeadSheet } from "./lead-sheet";
import { LeadsBoard } from "./leads-board";
import { LeadsTable } from "./leads-table";

export function LeadsPage() {
  const { tier } = useTier();
  const leads = useLeads();
  const [view, setView] = useState<"board" | "table">("board");
  const [openId, setOpenId] = useState<string | null>(null);

  const all = leads.data ?? [];
  const pendingCount = all.filter((l) => l.status === "pending").length;
  const visible = useMemo(() => filterByTier(all.filter((l) => !HIDDEN_STATUSES.includes(l.status)), tier), [all, tier]);
  const openLead = visible.find((l) => l.id === openId) ?? null;

  function openInbox() {
    window.dispatchEvent(new CustomEvent("social-lab:open-log-today"));
  }

  return (
    <LeadActionsProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as "board" | "table")}>
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            {pendingCount > 0 ? (
              <Button variant="outline" size="sm" onClick={openInbox}>
                <Inbox className="mr-1.5 size-4" aria-hidden />
                {pendingCount} waiting for review
              </Button>
            ) : null}
            <AddLeadDialog />
          </div>
        </div>

        {leads.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading leads…</p>
        ) : view === "board" ? (
          <LeadsBoard leads={visible} onOpen={(l: Lead) => setOpenId(l.id)} />
        ) : (
          <LeadsTable leads={visible} onOpen={(l: Lead) => setOpenId(l.id)} />
        )}

        <LeadSheet lead={openLead} onOpenChange={(open) => !open && setOpenId(null)} />
      </div>
    </LeadActionsProvider>
  );
}
