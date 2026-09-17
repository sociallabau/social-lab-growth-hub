// Table view with search and filters.
import { useMemo, useState } from "react";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useListItems, useTeamMembers, type Lead } from "@/hooks/use-data";
import { formatDateTime, formatMoney } from "@/lib/format";
import { LEAD_STATUSES, STATUS_LABELS, minutesWaiting } from "@/lib/leads";
import { useLeadActions } from "./lead-actions";

const ANY = "any";

export function LeadsTable({ leads, onOpen }: { leads: Lead[]; onOpen: (lead: Lead) => void }) {
  const lists = useListItems();
  const team = useTeamMembers();
  const { markResponded } = useLeadActions();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ANY);
  const [channel, setChannel] = useState(ANY);
  const [source, setSource] = useState(ANY);
  const [owner, setOwner] = useState(ANY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const sources = useMemo(() => [...new Set(leads.map((l) => l.source))].sort(), [leads]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== ANY && l.status !== status) return false;
      if (channel !== ANY && l.channel !== channel) return false;
      if (source !== ANY && l.source !== source) return false;
      if (owner !== ANY && (l.owner_email ?? "") !== owner) return false;
      const day = l.received_at.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return [l.name, l.company, l.email, l.phone, l.instagram_handle, l.subject, l.message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [leads, search, status, channel, source, owner, from, to]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="t-search">Search</Label>
          <Input id="t-search" placeholder="Name, company, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All channels</SelectItem>
              {(lists.data?.channel ?? []).map((i) => (
                <SelectItem key={i.id} value={i.value}>
                  {i.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Owner</Label>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Anyone</SelectItem>
              {(team.data ?? []).map((m) => (
                <SelectItem key={m.email} value={m.email}>
                  {m.full_name ?? m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-from">From</Label>
          <Input id="t-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-to">To</Label>
          <Input id="t-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Speed to lead</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((lead) => {
              const waiting = lead.first_response_at ? null : minutesWaiting(lead.received_at);
              const late = waiting !== null && waiting > 30;
              return (
                <TableRow key={lead.id} className="cursor-pointer" onClick={() => onOpen(lead)}>
                  <TableCell className="font-medium">{lead.name || lead.company || lead.instagram_handle || "Unnamed"}</TableCell>
                  <TableCell>{STATUS_LABELS[lead.status] ?? lead.status}</TableCell>
                  <TableCell>{lead.channel ?? "—"}</TableCell>
                  <TableCell>{lead.source}</TableCell>
                  <TableCell>{lead.owner_email ?? "Unassigned"}</TableCell>
                  <TableCell>{formatDateTime(lead.received_at)}</TableCell>
                  <TableCell>
                    {waiting === null ? (
                      formatDateTime(lead.first_response_at)
                    ) : (
                      <span className={`flex items-center gap-1 ${late ? "text-alert" : ""}`}>
                        <Clock className="size-3.5" aria-hidden />
                        {Math.round(waiting)} min waiting
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            markResponded(lead);
                          }}
                        >
                          Mark responded
                        </Button>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {lead.won_value ? formatMoney(Number(lead.won_value)) : lead.quoted_value ? formatMoney(Number(lead.quoted_value)) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground text-center">
                  No leads match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
