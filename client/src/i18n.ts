import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enServices from './locales/en/services.json';
import enAbout from './locales/en/about.json';

import ptCommon from './locales/pt/common.json';
import ptHome from './locales/pt/home.json';
import ptServices from './locales/pt/services.json';
import ptAbout from './locales/pt/about.json';

import nlCommon from './locales/nl/common.json';
import nlHome from './locales/nl/home.json';
import nlServices from './locales/nl/services.json';
import nlAbout from './locales/nl/about.json';

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    services: enServices,
    about: enAbout,
  },
  pt: {
    common: ptCommon,
    home: ptHome,
    services: ptServices,
    about: ptAbout,
  },
  nl: {
    common: nlCommon,
    home: nlHome,
    services: nlServices,
    about: nlAbout,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'home', 'services', 'about'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
    },
  });

export default i18n;
