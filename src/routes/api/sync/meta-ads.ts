import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/sync/meta-ads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { runIntegration } = await import("@/server/api-auth.server");
        const daysParam = new URL(request.url).searchParams.get("days");
        const parsed = Number(daysParam);
        const days = daysParam && Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 7;
        return runIntegration(request, async (db) => {
          const { syncMetaAds } = await import("@/server/integrations/meta-ads");
          return syncMetaAds(db, days);
        });
      },
    },
  },
});
