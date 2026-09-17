import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/reports/weekly")({
  server: {
    handlers: {
      // POST sends the Monday email (scheduled job or a team member pressing send).
      // ?preview=1 returns the email as HTML instead, so it can be checked first.
      POST: async ({ request }) => {
        const { runIntegration, adminClient } = await import("@/server/api-auth.server");
        const url = new URL(request.url);
        const preview = url.searchParams.get("preview") === "1";
        const week = url.searchParams.get("week");
        const weekOption = week ? { weekStart: week } : {};

        if (preview) {
          const { authorizeReport } = await import("@/server/api-auth.server");
          const denied = await authorizeReport(request);
          if (denied) return denied;
          const { sendWeeklyReport } = await import("@/server/reports/send-weekly");
          const result = await sendWeeklyReport(await adminClient(), { preview: true, ...weekOption });
          return new Response(result.html ?? "", { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }

        return runIntegration(request, async (db) => {
          const { sendWeeklyReport } = await import("@/server/reports/send-weekly");
          return sendWeeklyReport(db, weekOption);
        });
      },
    },
  },
});
