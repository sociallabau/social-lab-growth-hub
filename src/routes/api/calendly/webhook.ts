import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/calendly/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const { verifyCalendlySignature, handleCalendlyEvent } = await import("@/server/integrations/calendly");

        try {
          await verifyCalendlySignature(
            request.headers.get("Calendly-Webhook-Signature"),
            rawBody,
            process.env["CALENDLY_WEBHOOK_SIGNING_KEY"] ?? "",
          );
        } catch {
          return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 });
        }

        try {
          const parsed = JSON.parse(rawBody) as { event: string; payload: unknown };
          const { adminClient } = await import("@/server/api-auth.server");
          const result = await handleCalendlyEvent(await adminClient(), parsed.event, parsed.payload as never);
          return Response.json({ ok: true, items: result.items, message: result.message });
        } catch (error) {
          const { MissingSecretError } = await import("@/server/integrations/shared");
          const message = error instanceof Error ? error.message : String(error);
          const status = error instanceof MissingSecretError ? 400 : 500;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
