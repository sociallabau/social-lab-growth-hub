import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CircleCheck, CircleMinus, Clock, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientSheet } from "@/components/clients/client-sheet";
import { useClientsWithStats, type ClientWithStats } from "@/hooks/use-data";
import { bottomThirtyPercent, filterByService, scopeReviewDue } from "@/lib/metrics";
import { formatDate, formatMoney, todayInBrisbane } from "@/lib/format";

type SortKey =
  | "name"
  | "service_line"
  | "tier"
  | "lead_channel"
  | "start_date"
  | "monthly_fee"
  | "end_date"
  | "status"
  | "months_active"
  | "revenue_to_date"
  | "price_review_status";

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Client" },
  { key: "service_line", label: "Service line" },
  { key: "tier", label: "Tier" },
  { key: "lead_channel", label: "Lead channel" },
  { key: "start_date", label: "Start date" },
  { key: "monthly_fee", label: "Monthly fee", numeric: true },
  { key: "end_date", label: "End date" },
  { key: "status", label: "Status" },
  { key: "months_active", label: "Months active", numeric: true },
  { key: "revenue_to_date", label: "Revenue to date", numeric: true },
  { key: "price_review_status", label: "Price review" },
];

export function ClientsTable({ serviceLine }: { serviceLine: string | undefined }) {
  const clients = useClientsWithStats();
  const today = todayInBrisbane();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "monthly_fee", dir: "asc" });
  const [status, setStatus] = useState<"active" | "lost" | "all">("active");
  const [sheet, setSheet] = useState<{ open: boolean; client: ClientWithStats | null }>({ open: false, client: null });

  const rows = useMemo(() => {
    let list = clients.data ?? [];
    if (serviceLine) list = filterByService(list, serviceLine);
    if (status !== "all") list = list.filter((c) => (c.end_date ? "lost" : "active") === status);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [clients.data, serviceLine, status, sort]);

  const bottomIds = useMemo(() => {
    const active = (clients.data ?? []).filter((c) => c.start_date && !c.end_date);
    return new Set(
      bottomThirtyPercent(
        active.map((c) => ({ id: c.id ?? "", start_date: c.start_date, end_date: c.end_date, monthly_fee: c.monthly_fee })),
        today,
      ).map((c) => c.id),
    );
  }, [clients.data, today]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-36" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setSheet({ open: true, client: null })}>Add client</Button>
        <p className="text-xs text-muted-foreground">
          Never delete a lost client, add an end date. Churn and LTV need them.
        </p>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.numeric ? "text-right" : undefined}>
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {column.label}
                      {sort.key === column.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp aria-label="ascending" className="size-3.5" />
                        ) : (
                          <ArrowDown aria-label="descending" className="size-3.5" />
                        )
                      ) : null}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((client) => {
                const lost = !!client.end_date;
                return (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => setSheet({ open: true, client })}
                  >
                    <TableCell className="font-medium">
                      <span className="flex flex-wrap items-center gap-1.5">
                        {client.name}
                        {bottomIds.has(client.id) ? (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <TrendingDown aria-hidden className="size-3" /> Bottom 30%
                          </Badge>
                        ) : null}
                        {!lost && scopeReviewDue(client.last_scope_review ?? undefined, today) ? (
                          <Badge variant="outline" className="gap-1 border-warning/50 bg-warning-soft text-xs text-warning-foreground">
                            <Clock aria-hidden className="size-3" /> Review due
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>{client.service_line ?? "—"}</TableCell>
                    <TableCell>{client.tier ?? "—"}</TableCell>
                    <TableCell>{client.lead_channel ?? "—"}</TableCell>
                    <TableCell>{formatDate(client.start_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(client.monthly_fee)}</TableCell>
                    <TableCell>{client.end_date ? formatDate(client.end_date) : "—"}</TableCell>
                    <TableCell>
                      {lost ? (
                        <Badge variant="secondary" className="gap-1">
                          <CircleMinus aria-hidden className="size-3" /> Lost
                        </Badge>
                      ) : (
                        <Badge className="gap-1 bg-good text-good-foreground">
                          <CircleCheck aria-hidden className="size-3" /> Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{client.months_active ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(client.revenue_to_date)}</TableCell>
                    <TableCell>{client.price_review_status ?? "none"}</TableCell>
                  </TableRow>
                );
              })}
              {!rows.length ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground">
                    No clients match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClientSheet
        open={sheet.open}
        client={sheet.client}
        onOpenChange={(open) => setSheet((s) => ({ open, client: open ? s.client : null }))}
      />
    </>
  );
}
