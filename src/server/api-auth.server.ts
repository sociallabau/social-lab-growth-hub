// Verifies that the caller of an /api/sync route is an active Social Lab team
// member, then hands back the admin client the integrations write with.
import { createClient } from "@supabase/supabase-js";

export async function requireTeamMember(request: Request) {
  const auth = request.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    throw new Response("Sign in first", { status: 401 });
  }
  const userClient = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Response("Sign in first", { status: 401 });
  const member = await userClient.rpc("is_team_member");
  if (member.error || member.data !== true) {
    throw new Response("Not on the Social Lab team list", { status: 403 });
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Wraps an integration handler so missing secrets come back as a readable message. */
export async function runIntegration(request: Request, fn: (db: Awaited<ReturnType<typeof requireTeamMember>>) => Promise<{ items: number; message: string }>) {
  try {
    const db = await requireTeamMember(request);
    const result = await fn(db);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, message }, { status: 400 });
  }
}
