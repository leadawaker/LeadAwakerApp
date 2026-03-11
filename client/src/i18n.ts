import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files — marketing pages
import enCommon from "./locales/en/common.json";
import enHome from "./locales/en/home.json";
import enServices from "./locales/en/services.json";
import enAbout from "./locales/en/about.json";
import enBookDemo from "./locales/en/bookDemo.json";
import enChat3d from "./locales/en/chat3d.json";
import enSalesRepSteps from "./locales/en/salesRepSteps.json";
import enPipelineChart from "./locales/en/pipelineChart.json";
import enWorkflowVisualization from "./locales/en/workflowVisualization.json";
import enLogin from "./locales/en/login.json";
import enTermsOfService from "./locales/en/termsOfService.json";
import enPrivacyPolicy from "./locales/en/privacyPolicy.json";
import enOnboarding from "./locales/en/onboarding.json";

import enDocs from "./locales/en/docs.json";

// Import translation files — CRM pages
import enCrm from "./locales/en/crm.json";
import enSettings from "./locales/en/settings.json";
import enLeads from "./locales/en/leads.json";
import enCampaigns from "./locales/en/campaigns.json";
import enConversations from "./locales/en/conversations.json";
import enBilling from "./locales/en/billing.json";
import enAccounts from "./locales/en/accounts.json";
import enTasks from "./locales/en/tasks.json";
import enAutomation from "./locales/en/automation.json";
import enPrompts from "./locales/en/prompts.json";
import enUsers from "./locales/en/users.json";
import enCalendar from "./locales/en/calendar.json";
import enTags from "./locales/en/tags.json";

import ptDocs from "./locales/pt/docs.json";
import ptCommon from "./locales/pt/common.json";
import ptHome from "./locales/pt/home.json";
import ptServices from "./locales/pt/services.json";
import ptAbout from "./locales/pt/about.json";
import ptBookDemo from "./locales/pt/bookDemo.json";
import ptChat3d from "./locales/pt/chat3d.json";
import ptSalesRepSteps from "./locales/pt/salesRepSteps.json";
import ptPipelineChart from "./locales/pt/pipelineChart.json";
import ptWorkflowVisualization from "./locales/pt/workflowVisualization.json";
import ptLogin from "./locales/pt/login.json";
import ptTermsOfService from "./locales/pt/termsOfService.json";
import ptPrivacyPolicy from "./locales/pt/privacyPolicy.json";
import ptOnboarding from "./locales/pt/onboarding.json";

import ptCrm from "./locales/pt/crm.json";
import ptSettings from "./locales/pt/settings.json";
import ptLeads from "./locales/pt/leads.json";
import ptCampaigns from "./locales/pt/campaigns.json";
import ptConversations from "./locales/pt/conversations.json";
import ptBilling from "./locales/pt/billing.json";
import ptAccounts from "./locales/pt/accounts.json";
import ptTasks from "./locales/pt/tasks.json";
import ptAutomation from "./locales/pt/automation.json";
import ptPrompts from "./locales/pt/prompts.json";
import ptUsers from "./locales/pt/users.json";
import ptCalendar from "./locales/pt/calendar.json";
import ptTags from "./locales/pt/tags.json";

import nlDocs from "./locales/nl/docs.json";
import nlCommon from "./locales/nl/common.json";
import nlHome from "./locales/nl/home.json";
import nlServices from "./locales/nl/services.json";
import nlAbout from "./locales/nl/about.json";
import nlBookDemo from "./locales/nl/bookDemo.json";
import nlChat3d from "./locales/nl/chat3d.json";
import nlSalesRepSteps from "./locales/nl/salesRepSteps.json";
import nlPipelineChart from "./locales/nl/pipelineChart.json";
import nlWorkflowVisualization from "./locales/nl/workflowVisualization.json";
import nlLogin from "./locales/nl/login.json";
import nlTermsOfService from "./locales/nl/termsOfService.json";
import nlPrivacyPolicy from "./locales/nl/privacyPolicy.json";
import nlOnboarding from "./locales/nl/onboarding.json";

import nlCrm from "./locales/nl/crm.json";
import nlSettings from "./locales/nl/settings.json";
import nlLeads from "./locales/nl/leads.json";
import nlCampaigns from "./locales/nl/campaigns.json";
import nlConversations from "./locales/nl/conversations.json";
import nlBilling from "./locales/nl/billing.json";
import nlAccounts from "./locales/nl/accounts.json";
import nlTasks from "./locales/nl/tasks.json";
import nlAutomation from "./locales/nl/automation.json";
import nlPrompts from "./locales/nl/prompts.json";
import nlUsers from "./locales/nl/users.json";
import nlCalendar from "./locales/nl/calendar.json";
import nlTags from "./locales/nl/tags.json";

const resources = {
  en: {
    common: enCommon,
    docs: enDocs,
    home: enHome,
    services: enServices,
    about: enAbout,
    bookDemo: enBookDemo,
    chat3d: enChat3d,
    salesRepSteps: enSalesRepSteps,
    pipelineChart: enPipelineChart,
    workflowVisualization: enWorkflowVisualization,
    login: enLogin,
    termsOfService: enTermsOfService,
    privacyPolicy: enPrivacyPolicy,
    onboarding: enOnboarding,
    crm: enCrm,
    settings: enSettings,
    leads: enLeads,
    campaigns: enCampaigns,
    conversations: enConversations,
    billing: enBilling,
    accounts: enAccounts,
    tasks: enTasks,
    automation: enAutomation,
    prompts: enPrompts,
    users: enUsers,
    calendar: enCalendar,
    tags: enTags,
  },
  pt: {
    common: ptCommon,
    docs: ptDocs,
    home: ptHome,
    services: ptServices,
    about: ptAbout,
    bookDemo: ptBookDemo,
    chat3d: ptChat3d,
    salesRepSteps: ptSalesRepSteps,
    pipelineChart: ptPipelineChart,
    workflowVisualization: ptWorkflowVisualization,
    login: ptLogin,
    termsOfService: ptTermsOfService,
    privacyPolicy: ptPrivacyPolicy,
    onboarding: ptOnboarding,
    crm: ptCrm,
    settings: ptSettings,
    leads: ptLeads,
    campaigns: ptCampaigns,
    conversations: ptConversations,
    billing: ptBilling,
    accounts: ptAccounts,
    tasks: ptTasks,
    automation: ptAutomation,
    prompts: ptPrompts,
    users: ptUsers,
    calendar: ptCalendar,
    tags: ptTags,
  },
  nl: {
    common: nlCommon,
    docs: nlDocs,
    home: nlHome,
    services: nlServices,
    about: nlAbout,
    bookDemo: nlBookDemo,
    chat3d: nlChat3d,
    salesRepSteps: nlSalesRepSteps,
    pipelineChart: nlPipelineChart,
    workflowVisualization: nlWorkflowVisualization,
    login: nlLogin,
    termsOfService: nlTermsOfService,
    privacyPolicy: nlPrivacyPolicy,
    onboarding: nlOnboarding,
    crm: nlCrm,
    settings: nlSettings,
    leads: nlLeads,
    campaigns: nlCampaigns,
    conversations: nlConversations,
    billing: nlBilling,
    accounts: nlAccounts,
    tasks: nlTasks,
    automation: nlAutomation,
    prompts: nlPrompts,
    users: nlUsers,
    calendar: nlCalendar,
    tags: nlTags,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,

    fallbackLng: "en",

    defaultNS: "common",
    ns: [
      "common",
      "docs",
      "home",
      "services",
      "about",
      "bookDemo",
      "chat3d",
      "salesRepSteps",
      "pipelineChart",
      "workflowVisualization",
      "login",
      "termsOfService",
      "privacyPolicy",
      "onboarding",
      "crm",
      "settings",
      "leads",
      "campaigns",
      "conversations",
      "billing",
      "accounts",
      "tasks",
      "automation",
      "prompts",
      "users",
      "calendar",
      "tags",
    ],

    interpolation: {
      escapeValue: false,
    },

    /**
     * Language detection strategy:
     * 1. localStorage (leadawaker_lang) — set by CRM language toggle
     * 2. path — for marketing pages with /pt and /nl URL prefixes
     * localStorage is checked first so CRM users keep their preference.
     */
    detection: {
      order: ["localStorage", "path"],
      lookupLocalStorage: "leadawaker_lang",
      lookupFromPathIndex: 0,
      caches: ["localStorage"],
      lookupFromSubdomainIndex: undefined,
    },
  });

export default i18n;