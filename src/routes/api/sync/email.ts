import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/sync/email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { runIntegration } = await import("@/server/api-auth.server");
        return runIntegration(request, async (db) => {
          const { syncEmail } = await import("@/server/integrations/email");
          return syncEmail(db);
        });
      },
    },
  },
});
