import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/calendly/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        try {
          const { verifyCalendlySignature, handleCalendlyEvent } = await import("@/server/integrations/calendly");
          const { env } = await import("@/server/integrations/shared");
          await verifyCalendlySignature(
            request.headers.get("calendly-webhook-signature"),
            body,
            env("CALENDLY_WEBHOOK_SIGNING_KEY"),
          );
          const parsed = JSON.parse(body) as { event: string; payload: unknown };
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await handleCalendlyEvent(supabaseAdmin, parsed.event, parsed.payload as never);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return Response.json({ ok: false, message }, { status: 400 });
        }
      },
    },
  },
});
