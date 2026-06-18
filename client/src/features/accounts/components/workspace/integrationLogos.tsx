import { BrandTile } from "./atoms";

export function TwilioLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="8" fill="#F22F46" />
      <circle cx="18" cy="18" r="9" stroke="white" strokeWidth="2.5" fill="none" />
      <circle cx="18" cy="11" r="2.5" fill="white" />
      <circle cx="18" cy="25" r="2.5" fill="white" />
      <circle cx="11" cy="18" r="2.5" fill="white" />
      <circle cx="25" cy="18" r="2.5" fill="white" />
    </svg>
  );
}

export function GoogleCalLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="7" fill="white" />
      <rect x="6" y="8" width="24" height="21" rx="2.5" fill="white" stroke="#e0e0e0" strokeWidth="1" />
      <rect x="6" y="8" width="24" height="8" rx="2.5" fill="#4285F4" />
      <rect x="6" y="13" width="24" height="3" fill="#4285F4" />
      <circle cx="12.5" cy="8.5" r="2" fill="#EA4335" />
      <circle cx="23.5" cy="8.5" r="2" fill="#EA4335" />
      <text x="18" y="26" textAnchor="middle" fontFamily="sans-serif" fontSize="9.5" fontWeight="700" fill="#1a73e8">26</text>
    </svg>
  );
}

export function OutlookLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="7" fill="#0072C6" />
      <rect x="19" y="10" width="11" height="15" rx="1.5" fill="white" fillOpacity="0.92" />
      <line x1="21" y1="14" x2="28" y2="14" stroke="#0072C6" strokeWidth="1.4" strokeOpacity="0.6" />
      <line x1="21" y1="17" x2="28" y2="17" stroke="#0072C6" strokeWidth="1.4" strokeOpacity="0.6" />
      <line x1="21" y1="20" x2="26" y2="20" stroke="#0072C6" strokeWidth="1.4" strokeOpacity="0.6" />
      <rect x="6" y="12" width="16" height="12" rx="2" fill="#0078D4" />
      <ellipse cx="14" cy="18" rx="3.8" ry="4" fill="white" fillOpacity="0.95" />
      <ellipse cx="14" cy="18" rx="1.8" ry="2.2" fill="#0072C6" />
    </svg>
  );
}

export function CalcomLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="7" fill="#111827" />
      <rect x="8" y="10" width="20" height="17" rx="2.5" fill="none" stroke="white" strokeWidth="1.5" />
      <line x1="8" y1="15.5" x2="28" y2="15.5" stroke="white" strokeWidth="1.5" />
      <circle cx="13" cy="10" r="1.8" fill="white" />
      <circle cx="23" cy="10" r="1.8" fill="white" />
      <rect x="12" y="19" width="5" height="1.5" rx="0.75" fill="white" />
      <rect x="12" y="22" width="8" height="1.5" rx="0.75" fill="white" />
    </svg>
  );
}

export function IcalLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="7" fill="#f5f5f7" />
      <rect x="5" y="8" width="26" height="21" rx="2.5" fill="white" stroke="#d1d1d6" strokeWidth="0.8" />
      <rect x="5" y="8" width="26" height="8" rx="2.5" fill="#FF3B30" />
      <rect x="5" y="13" width="26" height="3" fill="#FF3B30" />
      <text x="18" y="26" textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#1d1d1f">31</text>
    </svg>
  );
}

export function CalendlyLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="7" fill="#006BFF" />
      <circle cx="18" cy="18" r="9.5" stroke="white" strokeWidth="2" fill="none" />
      <path d="M23 14.5C21.7 12.9 20 12 18 12C14.1 12 11 15.1 11 19C11 22.9 14.1 26 18 26C20 26 21.7 25.1 23 23.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function InstagramLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id="ig-bg" x1="0" y1="36" x2="36" y2="0">
          <stop offset="0%" stopColor="#FED373" />
          <stop offset="30%" stopColor="#F15245" />
          <stop offset="60%" stopColor="#D92E7F" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="8" fill="url(#ig-bg)" />
      <rect x="9" y="9" width="18" height="18" rx="5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="18" cy="18" r="5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="24.5" cy="11.5" r="1.5" fill="white" />
    </svg>
  );
}

export function SlackLogo({ size = 36 }: { size?: number }) {
  const r = 1.8;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="8" fill="white" />
      {/* cyan — left horizontal */}
      <rect x="8" y="14.5" width="9" height="3.2" rx={r} fill="#36C5F0" />
      <circle cx="8" cy="16.1" r={r} fill="#36C5F0" />
      {/* yellow — right horizontal */}
      <rect x="19" y="14.5" width="9" height="3.2" rx={r} fill="#ECB22E" />
      <circle cx="28" cy="16.1" r={r} fill="#ECB22E" />
      {/* green — top vertical */}
      <rect x="14.5" y="8" width="3.2" height="9" rx={r} fill="#2EB67D" />
      <circle cx="16.1" cy="8" r={r} fill="#2EB67D" />
      {/* red — bottom vertical */}
      <rect x="14.5" y="19" width="3.2" height="9" rx={r} fill="#E01E5A" />
      <circle cx="16.1" cy="28" r={r} fill="#E01E5A" />
      {/* intersection squares */}
      <rect x="14.5" y="14.5" width="3.2" height="3.2" fill="#ECB22E" />
      <rect x="18.3" y="14.5" width="3.2" height="3.2" fill="#36C5F0" />
      <rect x="14.5" y="18.3" width="3.2" height="3.2" fill="#2EB67D" />
      <rect x="18.3" y="18.3" width="3.2" height="3.2" fill="#E01E5A" />
    </svg>
  );
}

export function HubspotLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="8" fill="#FF7A59" />
      <circle cx="18" cy="19" r="5.5" fill="white" fillOpacity="0.95" />
      <circle cx="18" cy="19" r="2" fill="#FF7A59" />
      <rect x="16.8" y="9" width="2.4" height="6" rx="1.2" fill="white" />
      <circle cx="18" cy="9.5" r="2.4" fill="white" />
      <circle cx="18" cy="8.5" r="1.5" fill="#FF7A59" />
      <line x1="18" y1="15" x2="18" y2="13.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmailLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect width="36" height="36" rx="8" fill="#4F6CF7" />
      <rect x="7" y="11" width="22" height="15" rx="2.5" fill="white" fillOpacity="0.9" />
      <path d="M7 13l11 8 11-8" stroke="#4F6CF7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function CalendarProviderLogo({ provider, size = 30 }: { provider: string; size?: number }) {
  switch (provider) {
    case "google": return <GoogleCalLogo size={size} />;
    case "outlook": return <OutlookLogo size={size} />;
    case "calcom": return <CalcomLogo size={size} />;
    case "calendly": return <CalendlyLogo size={size} />;
    case "ical": return <IcalLogo size={size} />;
    default: return <BrandTile init={provider.slice(0, 2).toUpperCase()} size={size} />;
  }
}
