import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDeleteStaff, useSaveStaff, type LocationDefault, type Staff } from "@/hooks/use-data";

const OVERRIDES: { key: keyof Staff; label: string; percent?: boolean }[] = [
  { key: "hours_per_week", label: "Hours per week" },
  { key: "annual_leave_weeks", label: "Annual leave (weeks)" },
  { key: "public_holidays_days", label: "Public holidays (days)" },
  { key: "sick_days", label: "Sick days" },
  { key: "training_days", label: "Training days" },
  { key: "utilisation", label: "Utilisation", percent: true },
];

const blank = { name: "", role: "", location: "Australia", annual_cost: "", pay_rise_per_year: "" };

export function StaffSheet({
  staff,
  open,
  onOpenChange,
  roles,
  locations,
}: {
  staff: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: string[];
  locations: LocationDefault[];
}) {
  const save = useSaveStaff();
  const remove = useDeleteStaff();
  const [form, setForm] = useState<Record<string, string>>({ ...blank });

  useEffect(() => {
    if (!open) return;
    if (!staff) {
      setForm({ ...blank, location: locations[0]?.location ?? "Australia" });
      return;
    }
    const next: Record<string, string> = {
      name: staff.name,
      role: staff.role ?? "",
      location: staff.location,
      annual_cost: staff.annual_cost === null ? "" : String(staff.annual_cost),
      pay_rise_per_year: staff.pay_rise_per_year === null ? "" : String(staff.pay_rise_per_year),
    };
    for (const o of OVERRIDES) {
      const value = staff[o.key];
      next[o.key as string] = value === null || value === undefined ? "" : String(o.percent ? Number(value) * 100 : value);
    }
    setForm(next);
  }, [open, staff, locations]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const num = (key: string, percent = false): number | null => {
    const raw = (form[key] ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0) return null;
    return percent ? value / 100 : value;
  };

  const submit = () => {
    if (!form["name"]?.trim()) {
      toast.error("Name is required");
      return;
    }
    const row = {
      ...(staff ? { id: staff.id } : {}),
      name: form["name"].trim(),
      role: form["role"]?.trim() || null,
      location: form["location"] ?? "Australia",
      annual_cost: num("annual_cost"),
      pay_rise_per_year: num("pay_rise_per_year"),
      hours_per_week: num("hours_per_week"),
      annual_leave_weeks: num("annual_leave_weeks"),
      public_holidays_days: num("public_holidays_days"),
      sick_days: num("sick_days"),
      training_days: num("training_days"),
      utilisation: num("utilisation", true),
    };
    save.mutate(row, {
      onSuccess: () => {
        toast.success(staff ? "Saved" : `${row.name} added`);
        onOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{staff ? staff.name : "Add someone"}</SheetTitle>
          <SheetDescription>Leave an override blank to use the location defaults.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">Name</Label>
            <Input id="staff-name" value={form["name"] ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form["role"] || "none"} onValueChange={(v) => set("role", v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={form["location"] ?? "Australia"} onValueChange={(v) => set("location", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.location} value={l.location}>
                      {l.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {OVERRIDES.map((o) => (
              <div key={o.key as string} className="space-y-1.5">
                <Label htmlFor={`staff-${String(o.key)}`}>
                  {o.label}
                  {o.percent ? " (%)" : ""}
                </Label>
                <Input
                  id={`staff-${String(o.key)}`}
                  inputMode="decimal"
                  placeholder="Location default"
                  value={form[o.key as string] ?? ""}
                  onChange={(e) => set(o.key as string, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-cost">Annual cost ($)</Label>
              <Input
                id="staff-cost"
                inputMode="decimal"
                value={form["annual_cost"] ?? ""}
                onChange={(e) => set("annual_cost", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-rise">Pay rise per year ($)</Label>
              <Input
                id="staff-rise"
                inputMode="decimal"
                value={form["pay_rise_per_year"] ?? ""}
                onChange={(e) => set("pay_rise_per_year", e.target.value)}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row justify-between gap-2">
          {staff ? (
            <Button
              variant="outline"
              className="text-critical"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(staff.id, {
                  onSuccess: () => {
                    toast.success(`${staff.name} removed`);
                    onOpenChange(false);
                  },
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
