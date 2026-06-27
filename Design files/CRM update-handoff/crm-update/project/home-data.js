/* Lead Awaker — CRM Home Hub sample data
   Tenant: Peak Roofing Co. (single-location roofer).
   All four services enabled; two future services shown as upsell. */

window.HOME_DATA = {
  user: { name: 'Gabriel', first: 'Gabriel', full: 'Gabriel B. F.', role: 'Owner', init: 'GB' },
  account: { name: 'Peak Roofing Co.', kind: 'Single location · Roofing' },
  date: 'May 15, 2026 · Thursday',

  // Live pulse strip — today's cross-service numbers
  pulse: [
    { key: 'bookings', label: 'Bookings',        value: '18',  icon: 'cal'  },
    { key: 'sent',     label: 'Messages Sent',   value: '426', icon: 'send' },
    { key: 'replies',  label: 'Replies',         value: '112', icon: 'chat' },
    { key: 'reviews',  label: 'Reviews',         value: '32',  icon: 'star' },
  ],

  // Service cards — one per enabled service. spark = 0..1 normalized points.
  services: [
    {
      key: 'reactivation', name: 'Reactivation', icon: 'refresh', mascot: 'assets/mascot-rooster.webp',
      eyebrow: 'AI Reactivation',
      northLabel: 'Calls Booked', northValue: '24', northAmber: true, northIcon: 'cal', northValueIcon: 'calbook',
      delta: '+20% vs last 7d', dir: 'up',
      support: [ { label: 'Response Rate', value: '28%' }, { label: 'Active Campaigns', value: '7' } ],
      color: 'var(--warn)',
      spark: [.30,.36,.32,.44,.40,.52,.48,.58,.66,.60,.72,.78,.74,.85,.92,.88,1],
    },
    {
      key: 'reputation', name: 'Reputation', icon: 'star', mascot: 'assets/mascot-star.webp',
      eyebrow: 'Reputation Mgmt',
      northLabel: 'Avg Rating', northValue: '4.6', northSuffix: '★', northIcon: 'star',
      delta: '+0.3 vs last 30d', dir: 'up',
      support: [ { label: 'Reviews Generated', value: '32' }, { label: 'Requests Sent', value: '118' } ],
      color: 'oklch(55% 0.17 295)',
      spark: [.50,.46,.54,.58,.55,.62,.60,.68,.66,.72,.70,.78,.82,.80,.88,.92,.96],
    },
    {
      key: 'speed', name: 'Speed-to-Lead', icon: 'bolt', mascot: 'assets/mascot-plane.webp',
      eyebrow: 'Speed-to-Lead',
      northLabel: 'Median Response', northValue: '22', northSuffix: 's', northIcon: 'clock',
      delta: '−18s vs last 7d', dir: 'good-down',
      support: [ { label: 'New Leads Today', value: '37' }, { label: 'Booked / Inbound', value: '24%' } ],
      color: 'oklch(50% 0.19 242)',
      spark: [.40,.52,.46,.60,.55,.66,.62,.58,.70,.66,.78,.72,.84,.80,.90,.86,.94],
    },
    {
      key: 'nurture', name: 'Nurture Sequences', icon: 'mail',
      eyebrow: 'Nurture',
      northLabel: 'Active Sequences', northValue: '12',
      delta: '+2 vs last 7d', dir: 'up',
      support: [ { label: 'Contacts Enrolled', value: '1,248' }, { label: 'Reply Rate', value: '21%' } ],
      color: 'var(--stage-new)',
      spark: [.42,.40,.48,.46,.52,.50,.58,.56,.62,.60,.68,.66,.74,.72,.80,.84,.90],
    },
  ],

  // Cross-service action queue — ranked by urgency
  needs: [
    { id: 1, sev: 'red',    icon: 'alert', title: 'Negative feedback intercepted', who: 'Jason Miller', snippet: '“Crew was late and left a mess.”', svc: 'Reputation',    color: 'var(--stage-lost)',      time: '8m ago',  count: 3, action: 'Open Chat' },
    { id: 2, sev: 'orange', icon: 'chat',  title: 'Hot inbound reply waiting',     who: 'Maria Lopez',  snippet: '“Great, what are the next steps?”', svc: 'Speed-to-Lead', color: 'var(--warn)',        time: '5m ago',  count: 5, action: 'Open Chat' },
    { id: 3, sev: 'yellow', icon: 'handoff', title: 'AI handed off to human',      who: 'Tom Reynolds', snippet: 'Lead score 78', svc: 'Reactivation', color: 'var(--stage-qualified)', time: '15m ago', count: 2, action: 'Open Chat' },
    { id: 4, sev: 'yellow', icon: 'clock', title: 'Stalled lead — no reply',       who: 'Alex Johnson', snippet: 'Last seen 2d ago', svc: 'Nurture',  color: 'var(--stage-qualified)', time: '2h ago',  count: 2, action: 'Open Chat' },
    { id: 5, sev: 'red',    icon: 'alert', title: '1-star review risk',            who: 'Sarah Davis',  snippet: 'Unhappy with service', svc: 'Reputation', color: 'var(--stage-lost)',   time: '3h ago',  count: 1, action: 'Open Chat' },
  ],

  // Cross-service activity feed
  activity: [
    { id: 1, icon: 'star', title: 'New 5-star review posted',  meta: 'Mike Anderson · “Great job on the roof!”', svc: 'Reputation',    time: '10m ago' },
    { id: 2, icon: 'cal',  title: 'Booking confirmed',         meta: 'Roof Inspection · May 16, 10:00 AM',       svc: 'Reactivation',  time: '25m ago' },
    { id: 3, icon: 'chat', title: 'Reply received',            meta: 'Maria Lopez · “Sounds good, let’s do it.”', svc: 'Speed-to-Lead', time: '32m ago' },
    { id: 4, icon: 'send', title: 'Campaign sent',             meta: 'Dormant Leads — May Reactivation',         svc: 'Reactivation',  time: '1h ago' },
    { id: 5, icon: 'mail', title: 'Sequence message sent',     meta: 'Nurture Sequence · Day 3',                 svc: 'Nurture',       time: '2h ago' },
  ],

  quickActions: [
    { key: 'campaign', label: 'New Campaign',    icon: 'send' },
    { key: 'import',   label: 'Import Contacts', icon: 'import' },
    { key: 'sequence', label: 'New Sequence',    icon: 'mail' },
  ],

  // Services not yet enabled — the hub doubles as an upsell surface
  upsell: [
    { key: 'voice',    name: 'AI Voice Caller', icon: 'phone',  blurb: 'Let AI place + answer calls to book jobs hands-free.' },
    { key: 'referral', name: 'Referral Engine', icon: 'branch', blurb: 'Turn closed jobs into a steady stream of warm referrals.' },
  ],
};
