// tasks-data.js — internal task tracker for the Lead Awaker agency.
// Two assignees only: Gabriel Barbosa Fronza (me) + Finn Zijlstra (partner).
// Tasks carry status / priority / category / due date + optional scheduled
// time-block (for the calendar view). Dates anchor to the week of May 25–31 2026.

(function () {
  // ── People ──────────────────────────────────────────────────────
  const PEOPLE = {
    gabriel: { id: 'gabriel', name: 'Gabriel Barbosa Fronza', short: 'Gabriel', ini: 'GF', me: true,  color: '#5E2230' },
    finn:    { id: 'finn',    name: 'Finn Zijlstra',          short: 'Finn',    ini: 'FZ', me: false, color: '#3A6B8A' },
  };

  // ── Status + priority + category lookups ────────────────────────
  const STATUS = {
    todo:       { key: 'todo',       label: 'To Do',       color: 'var(--mute)',         tint: 'var(--bg-2)' },
    inprogress: { key: 'inprogress', label: 'In Progress', color: 'var(--wine)',         tint: 'var(--wine-tint)' },
    waiting:    { key: 'waiting',    label: 'Waiting',     color: 'var(--warn)',         tint: 'var(--warn-tint)' },
    done:       { key: 'done',       label: 'Done',        color: 'var(--good)',         tint: 'var(--good-tint)' },
  };
  const PRIORITY = {
    high:   { key: 'high',   label: 'High',   color: 'var(--stage-lost)' },
    medium: { key: 'medium', label: 'Medium', color: 'var(--warn)' },
    low:    { key: 'low',    label: 'Low',    color: 'var(--good)' },
  };
  const CATEGORY = {
    engineering: { key: 'engineering', label: 'Engineering', color: '#3A6B8A' },
    product:     { key: 'product',     label: 'Product',     color: '#7A4F9E' },
    marketing:   { key: 'marketing',   label: 'Marketing',   color: '#C48A2F' },
    analytics:   { key: 'analytics',   label: 'Analytics',   color: '#2F9461' },
    clients:     { key: 'clients',     label: 'Clients',     color: '#5E2230' },
    ops:         { key: 'ops',         label: 'Ops',         color: '#6E7A5E' },
  };

  let _id = 0;
  // t(title, sub, who, status, priority, category, dueISO, sched?)
  // sched = { day:'2026-05-28', start:'09:00', end:'10:30' }
  function t(title, sub, who, status, priority, category, due, sched) {
    return { id: 'tk' + (++_id), title, sub, who, status, priority, category, due, sched: sched || null };
  }

  const tasks = [
    // ── Overdue ──
    t('Fix WhatsApp webhook retries', 'Error on 429 rate limit from Meta API', 'gabriel', 'inprogress', 'high',   'engineering', '2026-05-26'),
    t('Review onboarding flow copy',  'Update wording from last client feedback', 'finn',  'waiting',    'medium', 'product',     '2026-05-27'),

    // ── Today (Thu May 28) ──
    t('Design campaign templates',    'Create 3 reusable outreach templates',  'gabriel', 'inprogress', 'high',   'marketing',   '2026-05-28', { day: '2026-05-28', start: '09:00', end: '11:00' }),
    t('Team sync & weekly planning',  'Align on priorities and blockers',      'finn',    'todo',       'medium', 'ops',         '2026-05-28', { day: '2026-05-28', start: '11:00', end: '12:00' }),
    t('Analyze lead-quality drop',    'Investigate dip in response rate',      'gabriel', 'todo',       'medium', 'analytics',   '2026-05-28', { day: '2026-05-28', start: '13:00', end: '14:30' }),

    // ── This week ──
    t('CRM CSV import flow',          'Allow bulk import of leads from CSV',   'finn',    'todo',       'high',   'engineering', '2026-05-29', { day: '2026-05-26', start: '09:30', end: '12:30' }),
    t('Improve qualification prompt', 'Raise booking-intent accuracy',         'gabriel', 'todo',       'medium', 'product',     '2026-05-29', { day: '2026-05-27', start: '10:00', end: '12:00' }),
    t('Set up Slack notifications',   'Ping on every booked meeting',          'finn',    'todo',       'low',    'ops',         '2026-05-29', { day: '2026-05-29', start: '14:00', end: '15:00' }),
    t('Record onboarding walkthrough','Loom for new agency clients',           'gabriel', 'todo',       'low',    'marketing',   '2026-05-31', { day: '2026-05-29', start: '13:00', end: '14:00' }),
    t('Energia Solar — campaign QA',  'Review sequence before go-live',        'finn',    'waiting',    'high',   'clients',     '2026-05-30', { day: '2026-05-28', start: '15:00', end: '16:00' }),
    t('Tune bump cadence timing',     'Test 48h vs 72h follow-up window',      'gabriel', 'todo',       'medium', 'analytics',   '2026-05-31', { day: '2026-05-27', start: '14:00', end: '15:30' }),

    // ── Next week ──
    t('Migrate to new scoring model', 'Roll out v2 lead score across accounts','gabriel', 'todo',       'high',   'engineering', '2026-06-02'),
    t('Draft June client report',     'Monthly performance summary deck',      'finn',    'todo',       'medium', 'clients',     '2026-06-03'),
    t('A/B test landing headline',    'Two variants for the demo page',        'gabriel', 'todo',       'low',    'marketing',   '2026-06-04'),

    // ── Completed ──
    t('Fix duplicate-leads issue',    'Resolved merge conflict in dedupe',     'gabriel', 'done',       'medium', 'engineering', '2026-05-24'),
    t('Update billing page',          'Added yearly discount toggle',          'finn',    'done',       'low',    'product',     '2026-05-23'),
    t('Ship pipeline DND column',     'Opt-outs now route to DND stage',       'gabriel', 'done',       'medium', 'engineering', '2026-05-22'),
    t('Onboard Dental Care client',   'Kickoff call + workspace setup',        'finn',    'done',       'high',   'clients',     '2026-05-21'),
  ];

  window.LA_TASKS = {
    people: PEOPLE, STATUS, PRIORITY, CATEGORY, tasks,
    weekStart: '2026-05-25',  // Monday
    today: '2026-05-28',      // Thursday
    nowTime: '13:40',
  };
})();
