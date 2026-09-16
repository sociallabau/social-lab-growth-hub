import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

export const ALL_SERVICE_LINES = "All";

type ServiceLineContextValue = {
  /** "All" or a service_line value from list_items */
  serviceLine: string;
  setServiceLine: (value: string) => void;
  /** undefined when "All" — handy for query filters */
  serviceLineFilter: string | undefined;
};

const ServiceLineContext = createContext<ServiceLineContextValue | null>(null);

export function ServiceLineProvider({
  value,
  children,
}: {
  value: string | undefined;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const serviceLine = value ?? ALL_SERVICE_LINES;

  const setServiceLine = useCallback(
    (next: string) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          service: next === ALL_SERVICE_LINES ? undefined : next,
        }),
        replace: true,
      });
    },
    [navigate],
  );

  const ctx = useMemo(
    () => ({
      serviceLine,
      setServiceLine,
      serviceLineFilter: serviceLine === ALL_SERVICE_LINES ? undefined : serviceLine,
    }),
    [serviceLine, setServiceLine],
  );

  return <ServiceLineContext.Provider value={ctx}>{children}</ServiceLineContext.Provider>;
}

export function useServiceLine() {
  const ctx = useContext(ServiceLineContext);
  if (!ctx) throw new Error("useServiceLine must be used inside ServiceLineProvider");
  return ctx;
}
