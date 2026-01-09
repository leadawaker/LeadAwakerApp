import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files
import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enServices from "./locales/en/services.json";
import enAbout from "./locales/en/about.json";
import enBookDemo from "./locales/en/bookDemo.json";
import enChat3d from "./locales/en/chat3d.json";
import enSalesRepSteps from "./locales/en/salesRepSteps.json";

import ptCommon from "./locales/pt/common.json";
import ptHome from "./locales/pt/home.json";
import ptServices from "./locales/pt/services.json";
import ptAbout from "./locales/pt/about.json";
import ptBookDemo from "./locales/pt/bookDemo.json";
import ptChat3d from "./locales/pt/chat3d.json";
import ptSalesRepSteps from "./locales/pt/salesRepSteps.json";

import nlCommon from "./locales/nl/common.json";
import nlHome from "./locales/nl/home.json";
import nlServices from "./locales/nl/services.json";
import nlAbout from "./locales/nl/about.json";
import nlBookDemo from "./locales/nl/bookDemo.json";
import nlChat3d from "./locales/nl/chat3d.json";
import nlSalesRepSteps from "./locales/nl/salesRepSteps.json";

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    services: enServices,
    about: enAbout,
    bookDemo: enBookDemo,
    chat3d: enChat3d,
    salesRepSteps: enSalesRepSteps,
  },
  pt: {
    common: ptCommon,
    home: ptHome,
    services: ptServices,
    about: ptAbout,
    bookDemo: ptBookDemo,
    chat3d: ptChat3d,
    salesRepSteps: ptSalesRepSteps,
  },
  nl: {
    common: nlCommon,
    home: nlHome,
    services: nlServices,
    about: nlAbout,
    bookDemo: nlBookDemo,
    chat3d: nlChat3d,
    salesRepSteps: nlSalesRepSteps,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    defaultNS: "common",
    ns: ["common", "home", "services", "about", "bookDemo", "chat3d","salesRepSteps"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["path", "localStorage", "navigator"],
      lookupFromPathIndex: 0,
      caches: ["localStorage"],
    },
  });

export default i18n;
