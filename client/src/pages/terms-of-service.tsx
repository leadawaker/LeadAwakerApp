import { useTranslation } from 'react-i18next';

export default function TermsOfService() {
  const { t } = useTranslation('termsOfService');

  return (
    <div className="min-h-screen pt-24 pb-20 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-slate-900">{t('title')}</h1>

        <div className="prose prose-slate max-w-none">
          <p className="text-muted-foreground mb-6">{t('lastUpdated')}</p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section1.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section1.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section2.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section2.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section3.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section3.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section4.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section4.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section5.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section5.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section6.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section6.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section7.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section7.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section8.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section8.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section9.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section9.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section10.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section10.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section11.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section11.content')}
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">{t('section12.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('section12.intro')}<br />
            {t('section12.email')}<br />
            {t('section12.address')}
          </p>
        </div>
      </div>
    </div>
  );
}
