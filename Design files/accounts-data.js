/* accounts-data.js — Accounts page seed data (window.ACCOUNTS_DATA)
   Seeded from the live Lead Awaker account + the accounts rail. */

window.ACCOUNTS_DATA = (function () {
  // ── Accounts rail (grouped) ──────────────────────────────────────
  const accountsList = [
    {
      group: 'Agency',
      items: [
        { id: 1, name: 'Lead Awaker', mono: 'LA', type: 'AGENCY', status: 'active',
          members: 2, ago: '3m ago', active: true },
      ],
    },
    {
      group: 'Unknown',
      items: [
        { id: 12, name: 'Energia Solar Catarinense', mono: 'ES', type: null, status: 'active', members: 40, ago: '2d ago' },
        { id: 8,  name: 'ZonPower B.V.', mono: 'ZB', type: null, status: 'active', members: 32, ago: '5d ago' },
      ],
    },
    {
      group: 'Sandbox',
      items: [
        { id: 99, name: 'Sandbox Client', mono: 'SC', type: 'SANDBOX', status: 'active', members: 0, ago: '3w ago' },
      ],
    },
  ];

  // ── Selected account detail — Lead Awaker ────────────────────────
  const detail = {
    id: 1,
    name: 'Lead Awaker',
    mono: 'LA',
    type: 'Agency',
    niche: 'Lead Reactivation',
    status: 'active',

    overview: {
      status: 'Active',
      type: 'Agency',
      niche: 'Lead Reactivation',
    },
    contact: {
      email: 'leadawaker@gmail.com',
      phone: '+31 6 12345678',
      website: 'https://leadawaker.com',
      address: 'Keizersgracht 123, 1015 CJ Amsterdam, NL',
    },
    schedule: {
      timezone: 'Europe/Amsterdam',
      language: 'English',
      hoursOpen: '09:00 AM',
      hoursClose: '06:00 PM',
      dailySends: '500',
      optOut: 'STOP',
    },
    meta: {
      taxId: '—',
      description: 'Agency specialising in AI-driven reactivation of dormant leads for service businesses across the EU.',
    },

    // ── Campaigns ──────────────────────────────────────────────────
    campaigns: [
      { id: 61, name: 'Premium Kitchen Demo',           mono: 'PK', channel: 'WhatsApp', status: 'active', leads: 120, resp: 31, contract: 'Lead Reactivation Agreement' },
      { id: 47, name: 'Dental Reactivation',            mono: 'DR', channel: 'WhatsApp', status: 'active', leads: 98,  resp: 28, contract: 'WhatsApp Automation' },
      { id: 52, name: 'Stalled Accident Claim Reactivation', mono: 'AC', channel: 'WhatsApp', status: 'active', leads: 76, resp: 24, contract: null },
      { id: 38, name: 'Mestre da Obra',                 mono: 'MO', channel: 'WhatsApp', status: 'active', leads: 45,  resp: 22, contract: null, ends: 'Apr 2026' },
      { id: 13, name: 'Universal Demo Campaign',        mono: 'UD', channel: 'WhatsApp', status: 'active', leads: 56,  resp: 27, contract: null },
      { id: 29, name: 'Coaching Training',              mono: 'CT', channel: 'WhatsApp', status: 'active', leads: 34,  resp: 19, contract: null, ends: 'Apr 2026' },
    ],

    // ── Contracts ──────────────────────────────────────────────────
    contracts: [
      { id: 'c1', name: 'Lead Reactivation Agreement', status: 'active',  value: '$2,500', start: 'Jan 1, 2024', renewal: 'Jan 1, 2025' },
      { id: 'c2', name: 'WhatsApp Automation',         status: 'pending', value: '$1,200', start: 'Feb 1, 2024', renewal: 'Feb 1, 2025' },
      { id: 'c3', name: 'Google Ads Retainer',         status: 'expired', value: '$800',   start: 'Aug 1, 2023', renewal: 'Aug 1, 2024' },
    ],

    // ── Team ───────────────────────────────────────────────────────
    team: [
      { id: 'u1', name: 'Gabriel Barbosa Fronza', email: 'leadawaker@gmail.com', role: 'Owner', init: 'GB' },
      { id: 'u2', name: 'Finn Zijlstra',          email: 'finn@agent.com',       role: 'Admin', init: 'FZ' },
    ],

    // ── Knowledge base ─────────────────────────────────────────────
    // Entries the AI injects into the lead conversation. `scope` controls
    // which campaigns see an entry; `injectAfter` controls when it enters
    // the prompt ('always', or after N inbound messages).
    knowledge: {
      count: 7,
      injectOptions: ['always', '1', '2', '3', '4', '5'],
      available: [
        { key: 'pricing', label: 'Pricing' },
        { key: 'location', label: 'Location' },
        { key: 'testimonials', label: 'Testimonials' },
      ],
      categories: [
        { key: 'services', label: 'Services', icon: 'services', entries: [
          { id: 'k1', title: 'Lead Reactivation', body: 'We re-engage cold and dormant leads over WhatsApp on your behalf.', scope: 'all', injectAfter: 'always' },
          { id: 'k2', title: 'WhatsApp Automation', body: 'Multi-touch follow-up sequences that keep nudging until a lead replies.', scope: 'all', injectAfter: '4' },
        ]},
        { key: 'faq', label: 'FAQ', icon: 'faq', entries: [
          { id: 'k3', title: 'Pricing', body: 'Plans start at €500/mo, billed monthly with no lock-in.', scope: 'all', injectAfter: '3' },
        ]},
        { key: 'team', label: 'Team', icon: 'team', entries: [
          { id: 'k4', title: 'Gabriel', body: 'Gabriel is our founder and head of growth.', scope: 'all', injectAfter: 'always' },
          { id: 'k5', title: 'Finn', body: 'Finn leads engineering and the integrations team.', scope: 'all', injectAfter: 'always' },
        ]},
        { key: 'hours', label: 'Hours', icon: 'hours', entries: [
          { id: 'k6', title: 'Office hours', body: 'We reply Monday to Friday, 09:00–18:00 CET.', scope: [61, 52], injectAfter: '4' },
        ]},
        { key: 'policies', label: 'Policies', icon: 'policies', entries: [
          { id: 'k7', title: 'Refunds', body: 'Monthly plans can be cancelled at any time, no questions asked.', scope: 'all', injectAfter: '4' },
        ]},
      ],
    },

    // ── Voice clone ────────────────────────────────────────────────
    voices: [
      { lang: 'EN', flag: '🇬🇧', ready: true,  sample: 'Hi, this is a test of my cloned voice.', updated: 'Apr 20, 2024' },
      { lang: 'PT', flag: '🇧🇷', ready: false, sample: null },
      { lang: 'NL', flag: '🇳🇱', ready: false, sample: null },
    ],

    // ── Integrations ───────────────────────────────────────────────
    twilio: {
      connected: true,
      fields: [
        { label: 'Account SID',   value: 'AC_REDACTED', mono: true, copy: true },
        { label: 'Auth Token',    value: '••••••••••••', secret: true, copy: true },
        { label: 'Service SID',   value: '2014', mono: true, copy: true },
        { label: 'From Number',   value: 'whatsapp:+14155238886', mono: true, copy: true },
        { label: 'Webhook URL',   value: 'https://webhooks.leadawaker.com/api/leads/intake', mono: true, copy: true, wrap: true },
        { label: 'API Key (Intake)', value: '••••••••••••', secret: true, copy: true },
        { label: 'Intake URL',    value: 'https://webhooks.leadawaker.com/api/leads/intake', mono: true, copy: true, wrap: true },
      ],
    },
    instagram: {
      connected: true,
      fields: [
        { label: 'User ID',      value: '17841443555235178', mono: true, copy: true },
        { label: 'Access Token', value: '••••••••••••', secret: true, copy: true },
      ],
    },
    comingSoon: [
      { key: 'meta',     label: 'Meta', init: 'M' },
      { key: 'google',   label: 'Google Ads', init: 'G' },
      { key: 'slack',    label: 'Slack', init: 'S' },
      { key: 'hubspot',  label: 'HubSpot', init: 'H' },
      { key: 'calendar', label: 'Google Calendar', init: 'C' },
    ],
  };

  return { accountsList, detail };
})();
