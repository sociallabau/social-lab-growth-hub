import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_TIERS, useTier } from "@/context/tier";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TierFilter() {
  const { tier, setTier } = useTier();

  const { data: options = [] } = useQuery({
    queryKey: ["list_items", "tier"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_items")
        .select("value, sort_order")
        .eq("list", "tier")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data.map((row) => row.value);
    },
  });

  return (
    <Select value={tier} onValueChange={setTier}>
      <SelectTrigger className="w-36 sm:w-44" aria-label="Tier filter">
        <SelectValue placeholder="Tier" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_TIERS}>All tiers</SelectItem>
        {options.map((value) => (
          <SelectItem key={value} value={value}>
            {value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
