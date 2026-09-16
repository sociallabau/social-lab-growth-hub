import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_SERVICE_LINES, useServiceLine } from "@/context/service-line";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ServiceLineFilter() {
  const { serviceLine, setServiceLine } = useServiceLine();

  const { data: options = [] } = useQuery({
    queryKey: ["list_items", "service_line"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("list_items")
        .select("value, sort_order")
        .eq("list", "service_line")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data.map((row) => row.value);
    },
  });

  return (
    <Select value={serviceLine} onValueChange={setServiceLine}>
      <SelectTrigger className="w-36 sm:w-44" aria-label="Service line filter">
        <SelectValue placeholder="Service line" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SERVICE_LINES}>All service lines</SelectItem>
        {options.map((value) => (
          <SelectItem key={value} value={value}>
            {value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
