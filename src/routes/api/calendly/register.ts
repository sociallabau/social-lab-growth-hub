import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/calendly/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { runIntegration } = await import("@/server/api-auth.server");
        return runIntegration(request, async () => {
          const { registerCalendlyWebhook } = await import("@/server/integrations/calendly");
          const origin = new URL(request.url).origin;
          const result = await registerCalendlyWebhook(`${origin}/api/public/calendly/webhook`);
          return {
            items: 1,
            message: result.alreadyRegistered
              ? `Already registered for ${result.calendlyUser} (${result.url})`
              : `Registered for ${result.calendlyUser} (${result.url})`,
          };
        });
      },
    },
  },
});
