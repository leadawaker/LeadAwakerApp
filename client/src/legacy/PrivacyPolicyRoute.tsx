import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import PrivacyPolicy from "./pages/PrivacyPolicy";

export default function PrivacyPolicyRoute() {
  return (
    <I18nextProvider i18n={i18n}>
      <PrivacyPolicy />
    </I18nextProvider>
  );
}
