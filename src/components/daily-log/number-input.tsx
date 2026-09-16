import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function NumberInput({
  value,
  onChange,
  className,
  label,
  auto,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  label: string;
  auto?: boolean;
  step?: number;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        aria-label={label}
        value={String(value)}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={cn("h-9", auto && "pr-12", className)}
      />
      {auto ? (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          auto
        </span>
      ) : null}
    </div>
  );
}
