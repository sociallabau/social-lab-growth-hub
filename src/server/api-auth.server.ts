// Auth + error shaping for the integration routes.
// A request is allowed when it is a scheduled run (cron secret) OR it comes
// from a signed-in, active Social Lab team member.
import { createClient } from "@supabase/supabase-js";

async function isCronRequest(request: Request) {
  const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
  const failure = await authenticateCronRequest(request);
  return failure === null;
}

async function isTeamMember(request: Request) {
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const userClient = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return false;
  const member = await userClient.rpc("is_team_member");
  return !member.error && member.data === true;
}

/** Wraps an integration handler: auth, then a JSON result the UI can show. */
export async function runIntegration(
  request: Request,
  fn: (db: Awaited<ReturnType<typeof adminClient>>) => Promise<{ items: number; message: string }>,
) {
  if (!(await isCronRequest(request)) && !(await isTeamMember(request))) {
    return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });
  }
  try {
    const result = await fn(await adminClient());
    return Response.json({ ok: true, items: result.items, message: result.message });
  } catch (error) {
    const { MissingSecretError } = await import("@/server/integrations/shared");
    const message = error instanceof Error ? error.message : String(error);
    const status = error instanceof MissingSecretError ? 400 : 500;
    return Response.json({ ok: false, error: message }, { status });
  }
}

export async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
