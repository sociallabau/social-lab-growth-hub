import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell/app-shell";
import { TierProvider } from "@/context/tier";

type AuthSearch = { service?: string | undefined };

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    service: typeof search["service"] === "string" ? search["service"] : undefined,
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });

    const email = (data.user.email ?? "").toLowerCase();
    const { data: member } = await supabase
      .from("team_members")
      .select("email, full_name, role, active")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();

    if (!member) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login", search: { notOnTeam: true } });
    }

    return { user: data.user, member };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { service } = Route.useSearch();
  const { member, user } = Route.useRouteContext();

  return (
    <TierProvider value={service}>
      <AppShell displayName={member.full_name ?? user.email ?? "Team"} email={user.email ?? ""}>
        <Outlet />
      </AppShell>
    </TierProvider>
  );
}
