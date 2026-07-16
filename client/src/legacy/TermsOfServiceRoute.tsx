import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import TermsOfService from "./pages/TermsOfService";

export default function TermsOfServiceRoute() {
  return (
    <I18nextProvider i18n={i18n}>
      <TermsOfService />
    </I18nextProvider>
  );
}
