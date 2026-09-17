// Board view: drag a card between columns to change the lead's status.
import { useState } from "react";
import { Clock, Instagram, Mail, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/format";
import { LEAD_STATUSES, STATUS_LABELS, minutesWaiting, type LeadStatus } from "@/lib/leads";
import type { Lead } from "@/hooks/use-data";
import { useLeadActions } from "./lead-actions";

function SourceIcon({ source }: { source: string }) {
  if (source === "instagram") return <Instagram className="size-3.5" aria-hidden />;
  if (source === "manual") return <Phone className="size-3.5" aria-hidden />;
  return <Mail className="size-3.5" aria-hidden />;
}

export function LeadsBoard({ leads, onOpen }: { leads: Lead[]; onOpen: (lead: Lead) => void }) {
  const { requestStatus, markResponded } = useLeadActions();
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [over, setOver] = useState<LeadStatus | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {LEAD_STATUSES.map((status) => {
        const column = leads.filter((l) => l.status === status);
        return (
          <section
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((s) => (s === status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              if (dragging) requestStatus(dragging, status);
              setDragging(null);
            }}
            className={`min-w-[15rem] flex-1 rounded-lg border p-2 ${over === status ? "border-accent bg-accent/5" : "bg-card"}`}
          >
            <header className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-medium">{STATUS_LABELS[status]}</h3>
              <Badge variant="secondary">{column.length}</Badge>
            </header>
            <ul className="space-y-2">
              {column.map((lead) => {
                const waiting = !lead.first_response_at ? minutesWaiting(lead.received_at) : null;
                const late = waiting !== null && waiting > 30;
                return (
                  <li key={lead.id}>
                    <article
                      draggable
                      onDragStart={() => setDragging(lead)}
                      onDragEnd={() => setDragging(null)}
                      className="cursor-grab rounded-md border bg-background p-2 text-sm shadow-sm active:cursor-grabbing"
                    >
                      <button type="button" onClick={() => onOpen(lead)} className="w-full text-left">
                        <p className="flex items-center gap-1.5 font-medium">
                          <SourceIcon source={lead.source} />
                          {lead.name || lead.company || lead.instagram_handle || "Unnamed"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {lead.channel ?? "No channel"} · {formatDateTime(lead.received_at)}
                        </p>
                        {lead.quoted_value ? <p className="text-xs">Quoted {formatMoney(Number(lead.quoted_value))}</p> : null}
                        {lead.won_value ? <p className="text-xs">Won {formatMoney(Number(lead.won_value))}</p> : null}
                      </button>
                      {status === "new" && waiting !== null ? (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`flex items-center gap-1 text-xs ${late ? "text-alert" : "text-muted-foreground"}`}>
                            <Clock className="size-3.5" aria-hidden />
                            {Math.round(waiting)} min waiting
                          </span>
                          <Button size="sm" variant="outline" onClick={() => markResponded(lead)}>
                            Mark responded
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  </li>
                );
              })}
              {column.length === 0 ? <li className="text-muted-foreground px-1 py-4 text-xs">Nothing here.</li> : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
