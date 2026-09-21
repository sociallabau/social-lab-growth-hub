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
export type ClientCost = Tables<"client_costs">;

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
  checkins: ["daily_checkins"] as const,
  clientCosts: ["client_costs"] as const,
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

export type ListName = "channel" | "tier" | "tier" | "role";
export type ListItemsByList = Record<ListName, ListItem[]>;

export const listItemsQuery = () =>
  queryOptions({
    queryKey: queryKeys.listItems,
    queryFn: async (): Promise<ListItemsByList> => {
      const rows = unwrap<ListItem[]>(
        await supabase.from("list_items").select("*").eq("active", true).order("sort_order"),
      );
      const grouped: ListItemsByList = { channel: [], tier: [], role: [] };
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

export const dailyCheckinsQuery = (range?: { from: string; to: string }) =>
  queryOptions({
    queryKey: [...queryKeys.checkins, range ?? "all"] as const,
    queryFn: async (): Promise<DailyCheckin[]> => {
      let q = supabase.from("daily_checkins").select("*").order("date", { ascending: false });
      if (range) q = q.gte("date", range.from).lte("date", range.to);
      return unwrap<DailyCheckin[]>(await q);
    },
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

export const clientCostsQuery = () =>
  queryOptions({
    queryKey: queryKeys.clientCosts,
    queryFn: async (): Promise<ClientCost[]> =>
      unwrap<ClientCost[]>(await supabase.from("client_costs").select("*")),
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
export const useDailyCheckins = (range?: { from: string; to: string }) => useQuery(dailyCheckinsQuery(range));
export const useStaff = () => useQuery(staffQuery());
export const usePackages = () => useQuery(packagesQuery());
export const useLocationDefaults = () => useQuery(locationDefaultsQuery());
export const useClientCosts = () => useQuery(clientCostsQuery());

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

/** Upserts a daily entry on its (date, channel, tier) key. */
export function useSaveDailyEntry() {
  const invalidate = useInvalidate([queryKeys.dailyEntries]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"daily_entries">) => {
      const res = await supabase
        .from("daily_entries")
        .upsert(row, { onConflict: "date,channel,tier" })
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
  const invalidate = useInvalidate([queryKeys.dailyEntries, queryKeys.checkins]);
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

export type ClientHour = Tables<"client_hours">;

/** Every client's logged hours over a recent window, for the tier economics table. */
export const recentClientHoursQuery = (days = 28) =>
  queryOptions({
    queryKey: ["client_hours", "recent", days] as const,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      return unwrap<ClientHour[]>(await supabase.from("client_hours").select("*").gte("date", since));
    },
  });

export const useRecentClientHours = (days?: number) => useQuery(recentClientHoursQuery(days));

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
      const user = done ? (await supabase.auth.getUser()).data.user : null;
      const res = await supabase
        .from("checklist_items")
        .update({ done, done_by: done ? (user?.id ?? null) : null, done_at: done ? new Date().toISOString() : null })
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

/** Upserts one client's monthly delivery costs on client_id. */
export function useSaveClientCost() {
  const invalidate = useInvalidate([queryKeys.clientCosts]);
  return useMutation({
    mutationFn: async (row: TablesInsert<"client_costs">) => {
      const res = await supabase.from("client_costs").upsert(row, { onConflict: "client_id" }).select().single();
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

export type DailyCheckin = Tables<"daily_checkins">;

export const dailyCheckinQuery = (date: string) =>
  queryOptions({
    queryKey: [...queryKeys.checkins, date] as const,
    queryFn: async (): Promise<DailyCheckin | null> => {
      const res = await supabase.from("daily_checkins").select("*").eq("date", date).maybeSingle();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

export const useDailyCheckin = (date: string) => useQuery(dailyCheckinQuery(date));

/** Upserts many daily entries at once on (date, channel, tier). */
export function useSaveDailyEntries() {
  const invalidate = useInvalidate([queryKeys.dailyEntries]);
  return useMutation({
    mutationFn: async (rows: TablesInsert<"daily_entries">[]) => {
      if (!rows.length) return [];
      const res = await supabase
        .from("daily_entries")
        .upsert(rows, { onConflict: "date,channel,tier" })
        .select();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Clients page: stats view + hours
// ---------------------------------------------------------------------------

export type ClientWithStats = Tables<"clients_with_stats">;

export const clientsWithStatsQuery = () =>
  queryOptions({
    queryKey: [...queryKeys.clients, "with_stats"] as const,
    queryFn: async (): Promise<ClientWithStats[]> =>
      unwrap<ClientWithStats[]>(await supabase.from("clients_with_stats").select("*").order("name")),
  });

export const useClientsWithStats = () => useQuery(clientsWithStatsQuery());

export const clientHoursQuery = (clientId: string | null) =>
  queryOptions({
    queryKey: ["client_hours", clientId] as const,
    enabled: !!clientId,
    queryFn: async (): Promise<ClientHour[]> =>
      unwrap<ClientHour[]>(
        await supabase.from("client_hours").select("*").eq("client_id", clientId!).order("date", { ascending: false }),
      ),
  });

export const useClientHours = (clientId: string | null) => useQuery(clientHoursQuery(clientId));

export function useLogClientHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: TablesInsert<"client_hours">) => {
      const res = await supabase.from("client_hours").insert(row).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["client_hours", row.client_id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

// ---------------------------------------------------------------------------
// Leads page: activities + team members
// ---------------------------------------------------------------------------

export type LeadActivity = Tables<"lead_activities">;
export type TeamMember = Tables<"team_members">;

export const leadActivitiesQuery = (leadId: string | null) =>
  queryOptions({
    queryKey: ["lead_activities", leadId] as const,
    enabled: !!leadId,
    queryFn: async (): Promise<LeadActivity[]> =>
      unwrap<LeadActivity[]>(
        await supabase.from("lead_activities").select("*").eq("lead_id", leadId!).order("at", { ascending: false }),
      ),
  });

export const useLeadActivities = (leadId: string | null) => useQuery(leadActivitiesQuery(leadId));

export const teamMembersQuery = () =>
  queryOptions({
    queryKey: ["team_members"] as const,
    queryFn: async (): Promise<TeamMember[]> =>
      unwrap<TeamMember[]>(await supabase.from("team_members").select("*").eq("active", true).order("email")),
  });

export const useTeamMembers = () => useQuery(teamMembersQuery());

/** Updates a lead and always records a lead_activities row for the change. */
export function useLeadChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      activity,
    }: {
      id: string;
      patch: TablesUpdate<"leads">;
      activity?: { kind: string; body: string };
    }) => {
      const res = await supabase.from("leads").update(patch).eq("id", id).select().single();
      if (res.error) throw new Error(res.error.message);
      if (activity) {
        const act = await supabase
          .from("lead_activities")
          .insert({ lead_id: id, kind: activity.kind, body: activity.body });
        if (act.error) throw new Error(act.error.message);
      }
      return res.data;
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads });
      queryClient.invalidateQueries({ queryKey: ["lead_activities", row.id] });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    },
  });
}

// ---------------------------------------------------------------------------
// Settings page: full lists (including inactive), team members, admin check
// ---------------------------------------------------------------------------

export const allListItemsQuery = () =>
  queryOptions({
    queryKey: [...queryKeys.listItems, "all"] as const,
    queryFn: async (): Promise<ListItem[]> =>
      unwrap<ListItem[]>(await supabase.from("list_items").select("*").order("list").order("sort_order")),
  });

export const useAllListItems = () => useQuery(allListItemsQuery());

function useInvalidateLists() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.listItems });
}

export function useCreateListItem() {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: async (row: TablesInsert<"list_items">) => {
      const res = await supabase.from("list_items").insert(row).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateListItem() {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TablesUpdate<"list_items"> }) => {
      const res = await supabase.from("list_items").update(patch).eq("id", id).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/** Writes new sort_order values for a whole list after a drag. */
export function useReorderListItems() {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      for (const item of items) {
        const res = await supabase.from("list_items").update({ sort_order: item.sort_order }).eq("id", item.id);
        if (res.error) throw new Error(res.error.message);
      }
      return items;
    },
    onSuccess: invalidate,
  });
}

export const allTeamMembersQuery = () =>
  queryOptions({
    queryKey: ["team_members", "all"] as const,
    queryFn: async (): Promise<TeamMember[]> =>
      unwrap<TeamMember[]>(await supabase.from("team_members").select("*").order("email")),
  });

export const useAllTeamMembers = () => useQuery(allTeamMembersQuery());

export const useIsTeamAdmin = () =>
  useQuery({
    queryKey: ["is_team_admin"] as const,
    queryFn: async (): Promise<boolean> => {
      const res = await supabase.rpc("is_team_admin");
      if (res.error) throw new Error(res.error.message);
      return res.data === true;
    },
  });

function useInvalidateTeam() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["team_members"] });
}

export function useSaveTeamMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: async (row: TablesInsert<"team_members">) => {
      const res = await supabase
        .from("team_members")
        .upsert({ ...row, email: row.email.toLowerCase().trim() }, { onConflict: "email" })
        .select()
        .single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTeamMember() {
  const invalidate = useInvalidateTeam();
  return useMutation({
    mutationFn: async ({ email, patch }: { email: string; patch: TablesUpdate<"team_members"> }) => {
      const res = await supabase.from("team_members").update(patch).eq("email", email).select().single();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/** POSTs to an integration route with the signed-in user's token attached. */
export function useRunIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (path: string): Promise<{ ok: boolean; message: string; items?: number | undefined }> => {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(path, {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      const text = await res.text();
      let body: { ok?: boolean; message?: string; error?: string; items?: number | undefined } = {};
      try {
        body = JSON.parse(text) as typeof body;
      } catch {
        body = { error: text };
      }
      if (!res.ok || body.ok === false) throw new Error(body.error || body.message || `Failed (${res.status})`);
      return { ok: true, message: body.message ?? "Done", items: body.items };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrationRuns });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads });
      queryClient.invalidateQueries({ queryKey: queryKeys.metaAds });
    },
  });
}
