import { useState, useEffect } from "react";

export interface CountryInfo {
  code: string;
  resolved: boolean;
}

const STORAGE_KEY = "detected_country";

let inFlight: Promise<string> | null = null;

function fetchCountry(): Promise<string> {
  if (!inFlight) {
    inFlight = fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d: { country_code?: string }) => {
        const code = d.country_code ?? "";
        return code;
      })
      .catch(() => "");
  }
  return inFlight;
}

export function useCountry(): CountryInfo {
  const cached = localStorage.getItem(STORAGE_KEY);
  const [code, setCode] = useState<string>(cached ?? "");
  const [resolved, setResolved] = useState(!!cached);

  useEffect(() => {
    if (cached) return;
    fetchCountry().then((c) => {
      if (c) localStorage.setItem(STORAGE_KEY, c);
      setCode(c);
      setResolved(true);
    });
  }, [cached]);

  return { code, resolved };
}
