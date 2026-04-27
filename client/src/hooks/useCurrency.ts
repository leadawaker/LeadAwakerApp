import { useState, useEffect } from "react";
import { useCountry } from "./useCountry";

export interface CurrencyConfig {
  symbol: string;
  code: string;
  dealConfig: { default: number; min: number; max: number; step: number };
  costConfig: { default: number; min: number; max: number; step: number };
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  EUR: {
    symbol: "€",
    code: "EUR",
    dealConfig: { default: 3000, min: 50, max: 30000, step: 50 },
    costConfig: { default: 5, min: 0.25, max: 100, step: 0.25 },
  },
  USD: {
    symbol: "$",
    code: "USD",
    dealConfig: { default: 3000, min: 50, max: 30000, step: 50 },
    costConfig: { default: 5, min: 0.25, max: 100, step: 0.25 },
  },
  GBP: {
    symbol: "£",
    code: "GBP",
    dealConfig: { default: 2500, min: 50, max: 25000, step: 50 },
    costConfig: { default: 4, min: 0.25, max: 80, step: 0.25 },
  },
  CAD: {
    symbol: "CA$",
    code: "CAD",
    dealConfig: { default: 4000, min: 50, max: 40000, step: 50 },
    costConfig: { default: 6, min: 0.25, max: 120, step: 0.25 },
  },
  BRL: {
    symbol: "R$",
    code: "BRL",
    dealConfig: { default: 5000, min: 250, max: 150000, step: 50 },
    costConfig: { default: 25, min: 1, max: 500, step: 1 },
  },
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  AU: "USD",
  NZ: "USD",
  GB: "GBP",
  BR: "BRL",
};

const STORAGE_KEY = "calculator_currency";

export function useCurrency(ptLocale: boolean) {
  const { code: countryCode, resolved: countryResolved } = useCountry();

  const getInitial = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CURRENCIES[stored]) return stored;
    if (ptLocale) return "BRL";
    return "EUR";
  };

  const [currencyCode, setCurrencyCode] = useState<string>(getInitial);
  const [resolved, setResolved] = useState(() => !!localStorage.getItem(STORAGE_KEY) || ptLocale);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (ptLocale) { setResolved(true); return; }
    if (!countryResolved) return;
    const detected = COUNTRY_TO_CURRENCY[countryCode] ?? "EUR";
    setCurrencyCode(detected);
    setResolved(true);
  }, [ptLocale, countryCode, countryResolved]);

  const override = (code: string) => {
    if (!CURRENCIES[code]) return;
    setCurrencyCode(code);
    localStorage.setItem(STORAGE_KEY, code);
  };

  const config = CURRENCIES[currencyCode] ?? CURRENCIES.EUR;

  return {
    ...config,
    resolved,
    override,
    currencyCode,
    availableCurrencies: Object.values(CURRENCIES),
  };
}
