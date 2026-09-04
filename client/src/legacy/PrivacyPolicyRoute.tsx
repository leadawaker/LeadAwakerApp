import LegacyI18nProvider from "./LegacyI18nProvider";
import PrivacyPolicy from "./pages/PrivacyPolicy";

export default function PrivacyPolicyRoute() {
  return (
    <LegacyI18nProvider>
      <PrivacyPolicy />
    </LegacyI18nProvider>
  );
}
