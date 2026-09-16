// Typed data hooks. All calculations live in src/lib/metrics.ts and
// src/lib/capacity.ts — these hooks only read and write rows.
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Settings = Tables<"settings">;
export type ListItem = Tables<"list_items">;
export type DailyEntry = Tables<"daily_entries">;
export type Client = Tables<"clients">;
export type Lead = Tables<"leads">;
export type MetaAdsDaily = Tables<"meta_ads_daily">;
export type IntegrationRun = Tables<"integration_runs">;
export type ChecklistItem = Tables<"checklist_items">;
export type Staff = Tables<"staff">;
export type Package = Tables<"packages">;
export type LocationDefault = Tables<"location_defaults">;

export const queryKeys = {
  settings: ["settings"] as const,
  listItems: ["list_items"] as const,
  dailyEntries: ["daily_entries"] as const,
  clients: ["clients"] as const,
  leads: ["leads"] as const,
  metaAds: ["meta_ads_daily"] as const,
  integrationRuns: ["integration_runs"] as const,
  checklist: ["checklist_items"] as const,
  staff: ["staff"] as const,
  packages: ["packages"] as const,
  locationDefaults: ["location_defaults"] as const,
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

// ---------------------------------------------------------------------------
// Query options (usable from route loaders via ensureQueryData)
// ---------------------------------------------------------------------------

export const settingsQuery = () =>
  queryOptions({
    queryKey: queryKeys.settings,
    queryFn: async (): Promise<Settings> => {
      const res = await supabase.from("settings").select("*").eq("id", 1).single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

export type ListName = "channel" | "service_line" | "tier" | "role";
export type ListItemsByList = Record<ListName, ListItem[]>;

export const listItemsQuery = () =>
  queryOptions({
    queryKey: queryKeys.listItems,
    queryFn: async (): Promise<ListItemsByList> => {
      const rows = unwrap<ListItem[]>(
        await supabase.from("list_items").select("*").eq("active", true).order("sort_order"),
      );
      const grouped: ListItemsByList = { channel: [], service_line: [], tier: [], role: [] };
      for (const row of rows) {
        const list = row.list as ListName;
        if (grouped[list]) grouped[list].push(row);
      }
      return grouped;
    },
  });

export const dailyEntriesQuery = (range?: { from: string; to: string }) =>
  queryOptions({
    queryKey: [...queryKeys.dailyEntries, range ?? "all"] as const,
    queryFn: async (): Promise<DailyEntry[]> => {
      let q = supabase.from("daily_entries").select("*").order("date", { ascending: false });
      if (range) q = q.gte("date", range.from).lte("date", range.to);
      return unwrap<DailyEntry[]>(await q);
    },
  });

export const clientsQuery = () =>
  queryOptions({
    queryKey: queryKeys.clients,
    queryFn: async (): Promise<Client[]> =>
      unwrap<Client[]>(await supabase.from("clients").select("*").order("name")),
  });

export const leadsQuery = () =>
  queryOptions({
    queryKey: queryKeys.leads,
    queryFn: async (): Promise<Lead[]> =>
      unwrap<Lead[]>(await supabase.from("leads").select("*").order("received_at", { ascending: false })),
  });

export const metaAdsQuery = (range?: { from: string; to: string }) =>
  queryOptions({
    queryKey: [...queryKeys.metaAds, range ?? "all"] as const,
    queryFn: async (): Promise<MetaAdsDaily[]> => {
      let q = supabase.from("meta_ads_daily").select("*").order("date", { ascending: false });
      if (range) q = q.gte("date", range.from).lte("date", range.to);
      return unwrap<MetaAdsDaily[]>(await q);
    },
  });

export const integrationRunsQuery = (limit = 20) =>
  queryOptions({
    queryKey: [...queryKeys.integrationRuns, limit] as const,
    queryFn: async (): Promise<IntegrationRun[]> =>
      unwrap<IntegrationRun[]>(
        await supabase.from("integration_runs").select("*").order("started_at", { ascending: false }).limit(limit),
      ),
  });

export const checklistQuery = () =>
  queryOptions({
    queryKey: queryKeys.checklist,
    queryFn: async (): Promise<ChecklistItem[]> =>
      unwrap<ChecklistItem[]>(await supabase.from("checklist_items").select("*").order("sort_order")),
  });

export const staffQuery = () =>
  queryOptions({
    queryKey: queryKeys.staff,
    queryFn: async (): Promise<Staff[]> =>
      unwrap<Staff[]>(await supabase.from("staff").select("*").order("name")),
  });

export const packagesQuery = () =>
  queryOptions({
    queryKey: queryKeys.packages,
    queryFn: async (): Promise<Package[]> =>
      unwrap<Package[]>(await supabase.from("packages").select("*").order("tier")),
  });

export const locationDefaultsQuery = () =>
  queryOptions({
    queryKey: queryKeys.locationDefaults,
    queryFn: async (): Promise<LocationDefault[]> =>
      unwrap<LocationDefault[]>(await supabase.from("location_defaults").select("*").order("location")),
  });

// ---------------------------------------------------------------------------
// Read hooks
// ---------------------------------------------------------------------------

export const useSettings = () => useQuery(settingsQuery());
export const useListItems = () => useQuery(listItemsQuery());
export const useDailyEntries = (range?: { from: string; to: string }) => useQuery(dailyEntriesQuery(range));
export const useClients = () => useQuery(clientsQuery());
export const useLeads = () => useQuery(leadsQuery());
export const useMetaAds = (range?: { from: string; to: string }) => useQuery(metaAdsQuery(range));
export const useIntegrationRuns = (limit?: number) => useQuery(integrationRunsQuery(limit));
export const useChecklist = () => useQuery(checklistQuery());
export const useStaff = () => useQuery(staffQuery());
export const usePackages = () => useQuery(packagesQuery());
export const useLocationDefaults = () => useQuery(locationDefaultsQuery());

/** Active option values for a dropdown list, e.g. useListValues("channel"). */
export function useListValues(list: ListName) {
  return useQuery({
    ...listItemsQuery(),
    select: (grouped: ListItemsByList) => grouped[list].map((i) => i.value),
  });
}

// ---------------------------------------------------------------------------
// Mutations — each invalidates the queries it affects
// ---------------------------------------------------------------------------

function useInvalidate(keys: readonly (readonly unknown[])[]) {
  const queryClient = useQueryClient();
  return () => keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
}

export function useUpdateSettings() {
  const invalidate = useInvalidate([queryKeys.settings]);
  return useMutation({
    mutationFn: async (patch: TablesUpdate<"settings">) => {
      const res = await supabase.from("settings").update(patch).eq("id", 1).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useSaveListItem() {
  const invalidate = useInvalidate([queryKeys.listItems]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"list_items">) => {
      const res = await supabase.from("list_items").upsert(row, { onConflict: "list,value" }).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/** Upserts a daily entry on its (date, channel, service line) key. */
export function useSaveDailyEntry() {
  const invalidate = useInvalidate([queryKeys.dailyEntries]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"daily_entries">) => {
      const res = await supabase
        .from("daily_entries")
        .upsert(row, { onConflict: "date,channel,service_line" })
        .select()
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteDailyEntry() {
  const invalidate = useInvalidate([queryKeys.dailyEntries]);
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from("daily_entries").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
      return id;
    },
    onSuccess: invalidate,
  });
}

export function useSaveDailyCheckin() {
  const invalidate = useInvalidate([queryKeys.dailyEntries]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"daily_checkins">) => {
      const res = await supabase.from("daily_checkins").upsert(row, { onConflict: "date" }).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCreateClient() {
  const invalidate = useInvalidate([queryKeys.clients]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"clients">) => {
      const res = await supabase.from("clients").insert(row).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateClient() {
  const invalidate = useInvalidate([queryKeys.clients, queryKeys.leads]);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"clients"> }) => {
      const res = await supabase.from("clients").update(patch).eq("id", id).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteClient() {
  const invalidate = useInvalidate([queryKeys.clients, queryKeys.leads]);
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from("clients").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
      return id;
    },
    onSuccess: invalidate,
  });
}

export function useCreateLead() {
  const invalidate = useInvalidate([queryKeys.leads]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"leads">) => {
      const res = await supabase.from("leads").insert(row).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateLead() {
  const invalidate = useInvalidate([queryKeys.leads, queryKeys.clients]);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"leads"> }) => {
      const res = await supabase.from("leads").update(patch).eq("id", id).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useAddLeadActivity() {
  const invalidate = useInvalidate([queryKeys.leads]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"lead_activities">) => {
      const res = await supabase.from("lead_activities").insert(row).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useSaveClientHours() {
  const invalidate = useInvalidate([queryKeys.clients]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"client_hours">) => {
      const res = await supabase.from("client_hours").insert(row).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useToggleChecklistItem() {
  const invalidate = useInvalidate([queryKeys.checklist]);
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const res = await supabase
        .from("checklist_items")
        .update({ done, done_at: done ? new Date().toISOString() : null })
        .eq("id", id)
        .select()
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useSaveStaff() {
  const invalidate = useInvalidate([queryKeys.staff]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"staff">) => {
      const res = await supabase.from("staff").upsert(row).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteStaff() {
  const invalidate = useInvalidate([queryKeys.staff]);
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await supabase.from("staff").delete().eq("id", id);
      if (res.error) throw new Error(res.error.message);
      return id;
    },
    onSuccess: invalidate,
  });
}

export function useSavePackage() {
  const invalidate = useInvalidate([queryKeys.packages]);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"packages"> }) => {
      const res = await supabase.from("packages").update(patch).eq("id", id).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useSaveLocationDefaults() {
  const invalidate = useInvalidate([queryKeys.locationDefaults, queryKeys.staff]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"location_defaults">) => {
      const res = await supabase.from("location_defaults").upsert(row, { onConflict: "location" }).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}
