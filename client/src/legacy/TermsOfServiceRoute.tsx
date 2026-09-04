import LegacyI18nProvider from "./LegacyI18nProvider";
import TermsOfService from "./pages/TermsOfService";

export default function TermsOfServiceRoute() {
  return (
    <LegacyI18nProvider>
      <TermsOfService />
    </LegacyI18nProvider>
  );
}
