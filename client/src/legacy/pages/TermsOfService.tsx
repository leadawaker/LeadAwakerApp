import { useTranslation } from "react-i18next";
import { LegalPageShell, type LegalSection } from "../components/LegalPageShell";

export default function TermsOfService() {
  const { t } = useTranslation("termsOfService");

  const sections: LegalSection[] = [
    { title: t("section1.title"), body: [t("section1.content")] },
    { title: t("section2.title"), body: [t("section2.content")] },
    { title: t("section3.title"), body: [t("section3.content")] },
    { title: t("section4.title"), body: [t("section4.content")] },
    { title: t("section5.title"), body: [t("section5.content")] },
    { title: t("section6.title"), body: [t("section6.content")] },
    { title: t("section7.title"), body: [t("section7.content")] },
    { title: t("section8.title"), body: [t("section8.content")] },
    { title: t("section9.title"), body: [t("section9.content")] },
    { title: t("section10.title"), body: [t("section10.content")] },
    { title: t("section11.title"), body: [t("section11.content")] },
    {
      title: t("section12.title"),
      body: [
        t("section12.intro"),
        <>
          {t("section12.email")}
          <br />
          {t("section12.address")}
        </>,
      ],
    },
  ];

  return <LegalPageShell title={t("title")} lastUpdated={t("lastUpdated")} sections={sections} />;
}
