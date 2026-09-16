import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Loader2, Mail } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type LoginSearch = { notOnTeam?: boolean | undefined };

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    notOnTeam: search["notOnTeam"] === true || search["notOnTeam"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Social Lab Growth Hub" },
      {
        name: "description",
        content: "Sign in to the Social Lab growth hub to track leads, clients and capacity.",
      },
      { property: "og:title", content: "Sign in — Social Lab Growth Hub" },
      {
        property: "og:description",
        content: "Internal growth dashboard for the Social Lab team.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { notOnTeam } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (notOnTeam) setError("This account isn't on the Social Lab team list.");
  }, [notOnTeam]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError("That email and password combination didn't work.");
      return;
    }
    navigate({ to: "/", replace: true });
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) {
      setError("We couldn't send the reset email. Please try again.");
      return;
    }
    setNotice("Check your inbox for a link to set a new password.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xl font-semibold tracking-tight">
            Social <span className="text-primary">Lab</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Growth hub · team access only</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {notice ? (
            <Alert className="mb-4">
              <Mail className="size-4" aria-hidden="true" />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={mode === "signin" ? handleSignIn : handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sociallab.com.au"
              />
            </div>

            {mode === "signin" ? (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "reset" : "signin");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "signin" ? "Forgot password?" : "Back to sign in"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Accounts are created by an admin. There is no public sign-up.
        </p>
      </div>
    </div>
  );
}
