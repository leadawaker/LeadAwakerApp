import { createContext, useContext, useState } from "react";

type BreadcrumbCtx = {
  crumb: string | null;
  setCrumb: (v: string | null) => void;
};

const BreadcrumbContext = createContext<BreadcrumbCtx>({
  crumb: null,
  setCrumb: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumb, setCrumb] = useState<string | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ crumb, setCrumb }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext);
}
