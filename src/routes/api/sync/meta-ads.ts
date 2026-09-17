import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/sync/meta-ads")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { runIntegration } = await import("@/server/api-auth.server");
        return runIntegration(request, async (db) => {
          const { syncMetaAds } = await import("@/server/integrations/meta-ads");
          return syncMetaAds(db);
        });
      },
    },
  },
});
