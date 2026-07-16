import { useTranslation } from "react-i18next";
import { LegalPageShell, type LegalSection } from "../components/LegalPageShell";

export default function PrivacyPolicy() {
  const { t } = useTranslation("privacyPolicy");

  const sections: LegalSection[] = [
    { title: t("section1.title"), body: [t("section1.content")] },
    { title: t("section2.title"), body: [t("section2.content")] },
    { title: t("section3.title"), body: [t("section3.content")] },
    { title: t("section4.title"), body: [t("section4.content"), t("section4.aiContent")] },
    {
      title: t("section5.title"),
      body: [
        t("section5.content"),
        t("section5.content2"),
        <>
          {t("section5.pledgePrefix")}{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy#limited-use"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Google API Services User Data Policy
          </a>
          {t("section5.pledgeSuffix")}
        </>,
      ],
    },
    { title: t("section6.title"), body: [t("section6.content")] },
    { title: t("section7.title"), body: [t("section7.content")] },
    {
      title: t("section8.title"),
      body: [
        t("section8.content"),
        <>
          {t("section8.email")}
          <br />
          {t("section8.address")}
        </>,
      ],
    },
    { title: t("section9.title"), body: [t("section9.content")] },
  ];

  return <LegalPageShell title={t("title")} lastUpdated={t("lastUpdated")} sections={sections} />;
}
