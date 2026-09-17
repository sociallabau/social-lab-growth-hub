import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatMoney, formatPercent } from "@/lib/format";
import type { MonthRow } from "@/lib/metrics";

const chartConfig = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig;

type MetricKey = keyof Pick<
  MonthRow,
  "leads" | "conversion" | "aov" | "cac" | "activeClients" | "mrr" | "churn" | "ltv" | "ltvToCac"
>;

const definitions: Array<{
  key: MetricKey;
  title: string;
  kind: "bar" | "line" | "area";
  format: "number" | "money" | "percent" | "ratio";
  target?: number;
  sweetSpot?: boolean;
}> = [
  { key: "leads", title: "Leads", kind: "bar", format: "number" },
  { key: "conversion", title: "Conversion", kind: "line", format: "percent", target: 0.3, sweetSpot: true },
  { key: "aov", title: "Average order value", kind: "line", format: "money" },
  { key: "cac", title: "CAC", kind: "bar", format: "money" },
  { key: "activeClients", title: "Active clients", kind: "line", format: "number" },
  { key: "mrr", title: "MRR", kind: "area", format: "money" },
  { key: "churn", title: "Churn", kind: "line", format: "percent" },
  { key: "ltv", title: "LTV", kind: "line", format: "money" },
  { key: "ltvToCac", title: "LTV:CAC", kind: "line", format: "ratio" },
];

function valueFormatter(format: string, value: number) {
  if (format === "money") return formatMoney(value);
  if (format === "percent") return formatPercent(value, 0);
  if (format === "ratio") return `${value.toFixed(1)}x`;
  return value.toLocaleString("en-AU");
}

export function TrendCharts({ rows, targetAov, targetLtvCac }: { rows: MonthRow[]; targetAov: number; targetLtvCac: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {definitions.map((definition) => {
        const target = definition.key === "aov" ? targetAov : definition.key === "ltvToCac" ? targetLtvCac : definition.target;
        const data = rows.map((row) => ({ label: row.label, value: row.isFuture ? null : row[definition.key] }));
        const common = (
          <>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={2} />
            <YAxis hide domain={[0, "auto"]} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              content={<ChartTooltipContent hideIndicator formatter={(value) => <span className="font-medium">{valueFormatter(definition.format, Number(value))}</span>} />}
            />
            {definition.sweetSpot ? <ReferenceArea y1={0.2} y2={0.4} fill="var(--warning)" fillOpacity={0.12} /> : null}
            {target !== undefined ? <ReferenceLine y={target} stroke="var(--chart-5)" strokeDasharray="4 4" /> : null}
          </>
        );
        return (
          <section key={definition.key} className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-medium">{definition.title}</h3>
            <ChartContainer config={chartConfig} className="h-44 w-full aspect-auto">
              {definition.kind === "bar" ? (
                <BarChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                  {common}<Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : definition.kind === "area" ? (
                <AreaChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                  {common}<Area dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} fill="var(--color-value)" fillOpacity={0.14} connectNulls={false} />
                </AreaChart>
              ) : (
                <LineChart data={data} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                  {common}<Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={false} connectNulls={false} />
                </LineChart>
              )}
            </ChartContainer>
          </section>
        );
      })}
    </div>
  );
}

export function Sparkline({ data }: { data: Array<{ date: string; spend: number }> }) {
  return (
    <ChartContainer config={chartConfig} className="h-24 w-full aspect-auto">
      <AreaChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <XAxis dataKey="date" hide />
        <YAxis hide domain={[0, "auto"]} />
        <ChartTooltip content={<ChartTooltipContent hideLabel hideIndicator formatter={(value) => formatMoney(Number(value))} />} />
        <Area dataKey="spend" type="monotone" stroke="var(--color-value)" strokeWidth={2} fill="var(--color-value)" fillOpacity={0.12} />
      </AreaChart>
    </ChartContainer>
  );
}

export function FunnelChart({ data }: { data: Array<{ stage: string; count: number }> }) {
  return (
    <ChartContainer config={chartConfig} className="h-56 w-full aspect-auto">
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 8, top: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" hide />
        <YAxis dataKey="stage" type="category" tickLine={false} axisLine={false} width={96} tickFormatter={(value) => String(value).replace("_", " ")} />
        <ChartTooltip content={<ChartTooltipContent hideLabel hideIndicator />} />
        <Bar dataKey="count" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}