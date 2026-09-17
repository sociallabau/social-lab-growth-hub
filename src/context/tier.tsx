import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

export const ALL_TIERS = "All";

type TierContextValue = {
  /** "All" or a tier value from list_items */
  tier: string;
  setTier: (value: string) => void;
  /** undefined when "All" — handy for query filters */
  tierFilter: string | undefined;
};

const TierContext = createContext<TierContextValue | null>(null);

export function TierProvider({
  value,
  children,
}: {
  value: string | undefined;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const tier = value ?? ALL_TIERS;

  const setTier = useCallback(
    (next: string) => {
      const updater = (prev: Record<string, unknown>) => {
        const search = { ...prev };
        if (next === ALL_TIERS) delete search["service"];
        else search["service"] = next;
        return search;
      };
      // The filter lives on any route's search params, so the generic
      // route-aware typing of navigate() is intentionally bypassed here.
      navigate({ to: ".", replace: true, search: updater } as never);
    },
    [navigate],
  );

  const ctx = useMemo(
    () => ({
      tier,
      setTier,
      tierFilter: tier === ALL_TIERS ? undefined : tier,
    }),
    [tier, setTier],
  );

  return <TierContext.Provider value={ctx}>{children}</TierContext.Provider>;
}

export function useTier() {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error("useTier must be used inside TierProvider");
  return ctx;
}
