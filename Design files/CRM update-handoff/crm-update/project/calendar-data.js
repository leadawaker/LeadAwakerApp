// calendar-data.js — AI-booked meetings for the Calendar page.
// Events reference real leads by name so the right-hand detail panel can reuse
// LEADS_DATA.getDetail() (contact, score, AI summary, conversation).
// Depends on: leads-data.js

(function () {
  if (!window.LEADS_DATA) return;
  const byName = {};
  window.LEADS_DATA.leads.forEach(l => { byName[l.name] = l; });

  function ev(name, iso, start, end, type, likelihood, opts) {
    opts = opts || {};
    const lead = byName[name] || { ini: '??', stage: 'booked', campaign: '' };
    return {
      id: (iso + '_' + start + '_' + name).replace(/\W+/g, '_'),
      leadName: name, leadId: lead.id, ini: lead.ini, stage: lead.stage,
      campaign: lead.campaign || '—', type, iso, start, end, likelihood,
      via: opts.via || 'Google Meet', bookedByAI: true,
      status: opts.status || 'booked',   // booked | noshow | rescheduled
    };
  }

  const events = [
    // ── Week of Mon Jun 1 – Sun Jun 7, 2026 ──
    ev('Thijs Peters',       '2026-06-01', '10:00', '11:00', 'Intro call',       82),
    ev('Emma de Boer',       '2026-06-01', '14:00', '15:00', 'Treatment plan',   88),
    ev('Ken Petit',          '2026-06-01', '16:00', '16:30', 'Check-in',         38, { via: 'Phone', status: 'noshow' }),
    ev('Femke Vos',          '2026-06-02', '09:30', '10:30', 'Strategy call',    72),
    ev('Sara Postma',        '2026-06-02', '14:00', '15:00', 'Demo call',        78),
    ev('Lotte Koster',       '2026-06-03', '09:00', '10:00', 'Intro call',       58, { status: 'rescheduled' }),
    ev('Michael Stalone',    '2026-06-03', '11:00', '12:00', 'Consultation',     75),
    ev('Maria Jansen',       '2026-06-03', '15:00', '16:00', 'Discovery call',   64),
    ev('Niels van Leeuwen',  '2026-06-04', '09:00', '09:30', 'Discovery call',   60, { via: 'Phone' }),
    ev('Lisa van den Berg',  '2026-06-04', '13:00', '14:00', 'Follow-up',        55, { status: 'rescheduled' }),
    ev('Fleur Dekker',       '2026-06-05', '10:00', '11:00', 'Proposal',         70),
    ev('Roos Dijkstra',      '2026-06-05', '15:00', '16:00', 'Proposal review',  68),
    // ── Spread across June (month view density) ──
    ev('Danique Smit',       '2026-06-09', '11:00', '12:00', 'Intro call',       52),
    ev('Sander Prins',       '2026-06-11', '14:00', '15:00', 'Follow-up',        57, { status: 'noshow' }),
    ev('Eva Willems',        '2026-06-16', '10:00', '11:00', 'Discovery call',   45),
    ev('Sophie Meijer',      '2026-06-18', '13:00', '14:00', 'Demo call',        61),
  ];

  window.LA_CAL = {
    events,
    weekStart: '2026-06-01',   // Monday
    monthAnchor: '2026-06-01',
    today: '2026-06-03',       // demo "today" inside the active week
    nowTime: '11:25',          // demo "now" for the current-time line
    stats: [
      { value: '12',  label: 'Meetings this week', delta: '+3' },
      { value: '67%', label: 'Avg. attendance',    delta: '+8%' },
      { value: '6',   label: 'High intent · 70%+',  delta: '+2' },
    ],
  };
})();
