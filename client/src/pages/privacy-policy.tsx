import { useTranslation } from 'react-i18next';
import { LegalPageShell, type LegalSection } from '@/components/legal/LegalPageShell';

export default function PrivacyPolicy() {
  const { t } = useTranslation(['privacyPolicy', 'termsOfService']);

  const sections: LegalSection[] = [
    { title: t('section1.title'), body: [t('section1.content')] },
    { title: t('section2.title'), body: [t('section2.content')] },
    { title: t('section3.title'), body: [t('section3.content')] },
    { title: t('section4.title'), body: [t('section4.content')] },
    { title: t('section5.title'), body: [t('section5.content')] },
    { title: t('section6.title'), body: [t('section6.content')] },
    {
      title: t('section7.title'),
      body: [
        t('section7.content'),
        <>
          {t('section7.email')}
          <br />
          {t('section7.address')}
        </>,
      ],
    },
    { title: t('section8.title'), body: [t('section8.content')] },
  ];

  return (
    <LegalPageShell
      eyebrow="Legal"
      title={t('title')}
      lastUpdated={t('lastUpdated')}
      sections={sections}
      sibling={{ href: '/terms-of-service', label: t('termsOfService:title') }}
    />
  );
}
