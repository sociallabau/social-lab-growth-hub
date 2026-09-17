import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings, useUpdateSettings, type Settings } from "@/hooks/use-data";
import { parseAUDate } from "@/lib/format";

type FieldKind = "money" | "number" | "percent" | "month" | "text" | "email";

interface Field {
  key: keyof Settings;
  label: string;
  kind: FieldKind;
  hint?: string;
}

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "Assumptions",
    fields: [
      { key: "tracking_start_month", label: "Tracking start month", kind: "month", hint: "The first month on the 12-month trends." },
      { key: "gross_margin", label: "Gross margin", kind: "percent" },
      { key: "avg_client_lifetime_months", label: "Average client lifetime (months)", kind: "number" },
      { key: "fixed_monthly_acquisition_cost", label: "Fixed monthly acquisition cost", kind: "money" },
      { key: "plan_ceiling", label: "Planning ceiling", kind: "percent", hint: "How full the team's hours can be planned." },
      { key: "target_labour_pct", label: "Target labour %", kind: "percent" },
    ],
  },
  {
    title: "Targets",
    fields: [
      { key: "target_leads_per_week", label: "Leads per week", kind: "number" },
      { key: "target_conversion", label: "Conversion", kind: "percent" },
      { key: "target_aov", label: "Average order value", kind: "money" },
      { key: "target_responded_30", label: "Responded within 30 min", kind: "percent" },
      { key: "target_ltv_cac", label: "LTV:CAC ratio", kind: "number" },
    ],
  },
  {
    title: "Price points",
    fields: [
      { key: "price_point_current", label: "Current", kind: "money" },
      { key: "price_point_mid", label: "Mid", kind: "money" },
      { key: "price_point_high", label: "High", kind: "money" },
    ],
  },
  {
    title: "Enquiries",
    fields: [
      { key: "not_fit_resource_url", label: "Not-a-fit resource URL", kind: "text" },
      { key: "enquiry_owner_email", label: "Enquiry owner email", kind: "email" },
    ],
  },
];

function toInput(value: unknown, kind: FieldKind): string {
  if (value === null || value === undefined) return "";
  if (kind === "percent") return String(Math.round(Number(value) * 1000) / 10);
  return String(value);
}

export function AssumptionsTab() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!settings) return;
    const next: Record<string, string> = {};
    for (const group of GROUPS) {
      for (const field of group.fields) next[field.key as string] = toInput(settings[field.key], field.kind);
    }
    setForm(next);
  }, [settings]);

  if (isLoading || !settings) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    const patch: Record<string, unknown> = {};
    for (const group of GROUPS) {
      for (const field of group.fields) {
        const raw = (form[field.key as string] ?? "").trim();
        if (field.kind === "text" || field.kind === "email") {
          patch[field.key as string] = raw || null;
          continue;
        }
        if (field.kind === "month") {
          const iso = raw.length === 7 ? `${raw}-01` : parseAUDate(raw) ?? raw;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
            toast.error("Tracking start month needs a month, e.g. 09/2026");
            throw new Error("invalid");
          }
          patch[field.key as string] = iso;
          continue;
        }
        const num = Number(raw);
        if (raw === "" || Number.isNaN(num) || num < 0) {
          toast.error(`${field.label} needs a number of 0 or more`);
          return;
        }
        patch[field.key as string] = field.kind === "percent" ? num / 100 : num;
      }
    }
    update.mutate(patch, {
      onSuccess: () => toast.success("Settings saved"),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => (
                <div key={field.key as string} className="space-y-1.5">
                  <Label htmlFor={field.key as string}>
                    {field.label}
                    {field.kind === "percent" ? " (%)" : field.kind === "money" ? " ($)" : ""}
                  </Label>
                  <Input
                    id={field.key as string}
                    value={form[field.key as string] ?? ""}
                    inputMode={field.kind === "text" || field.kind === "email" || field.kind === "month" ? "text" : "decimal"}
                    placeholder={field.kind === "month" ? "mm/yyyy" : undefined}
                    onChange={(e) => set(field.key as string, e.target.value)}
                  />
                  {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
        <p className="text-xs text-muted-foreground">Percentages are entered as %, stored as decimals.</p>
      </div>
    </div>
  );
}
