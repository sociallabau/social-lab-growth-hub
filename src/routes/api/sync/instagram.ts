import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/sync/instagram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { runIntegration } = await import("@/server/api-auth.server");
        return runIntegration(request, async (db) => {
          const { syncInstagram } = await import("@/server/integrations/instagram");
          return syncInstagram(db);
        });
      },
    },
  },
});
