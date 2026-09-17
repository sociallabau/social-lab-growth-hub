// Pulls daily spend, clicks, leads and booked calls from Meta Ads Manager.
// Meta revises recent days, so each run re-pulls the last week.
import type { SupabaseClient } from "@supabase/supabase-js";
import { brisbaneDate, env, recordRun, type SyncResult } from "./shared";

const GRAPH = "https://graph.facebook.com/v23.0";
const LEAD_TYPES = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];
const SCHEDULE_TYPES = ["schedule_total", "schedule_website", "offsite_conversion.fb_pixel_schedule"];

export interface MetaAction {
  action_type: string;
  value: string;
}

interface InsightRow {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaAction[];
}

/** Meta reports the same conversion under several action types, so take the first that exists. */
export function firstActionValue(actions: MetaAction[] | undefined, types: string[]): number {
  for (const type of types) {
    const hit = actions?.find((a) => a.action_type === type);
    if (hit) return Number(hit.value) || 0;
  }
  return 0;
}

export async function syncMetaAds(db: SupabaseClient, days = 7): Promise<SyncResult> {
  const token = env("META_ACCESS_TOKEN");
  const accounts = env("META_AD_ACCOUNT_IDS").split(",").map((a) => a.trim().replace(/^act_/, "")).filter(Boolean);

  return recordRun(db, "meta_ads", async () => {
    let items = 0;
    for (const account of accounts) {
      const params = new URLSearchParams({
        level: "account",
        time_increment: "1",
        time_range: JSON.stringify({ since: brisbaneDate(-days), until: brisbaneDate(0) }),
        fields: "spend,impressions,clicks,actions",
        limit: "100",
        access_token: token,
      });
      let next: string | null = `${GRAPH}/act_${account}/insights?${params}`;
      while (next) {
        const page: { data?: InsightRow[]; paging?: { next?: string }; error?: { message: string } } =
          await fetch(next).then((r) => r.json());
        if (page.error) throw new Error(`Meta Ads: ${page.error.message}`);
        const rows = (page.data ?? []).map((d) => ({
          date: d.date_start,
          ad_account_id: account,
          spend: Number(d.spend) || 0,
          impressions: Number(d.impressions) || 0,
          clicks: Number(d.clicks) || 0,
          leads: firstActionValue(d.actions, LEAD_TYPES),
          schedules: firstActionValue(d.actions, SCHEDULE_TYPES),
          actions: d.actions ?? [],
          synced_at: new Date().toISOString(),
        }));
        if (rows.length) {
          const { error } = await db.from("meta_ads_daily").upsert(rows);
          if (error) throw error;
          items += rows.length;
        }
        next = page.paging?.next ?? null;
      }
    }
    return { items, message: `${accounts.length} ad account(s), last ${days} days` };
  });
}
