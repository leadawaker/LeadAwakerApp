import { useState, type ReactNode } from "react";
import { useDemoLogoUrl } from "../useDemoLogo";

/**
 * A phone header's business avatar: the Client's logo when it has one switched
 * on (DemoLogoContext), else the caller's own initials circle, unchanged. A
 * logo that fails to load falls back to the initials too.
 */
export function BusinessAvatar({ className, children }: { className: string; children: ReactNode }) {
  const logo = useDemoLogoUrl();
  const [broken, setBroken] = useState(false);
  if (!logo || broken) return <div className={className}>{children}</div>;
  return (
    <div className={className} style={{ background: "#fff", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.1)", overflow: "hidden" }}>
      <img src={logo} alt="" className="h-full w-full rounded-full object-cover" onError={() => setBroken(true)} />
    </div>
  );
}
