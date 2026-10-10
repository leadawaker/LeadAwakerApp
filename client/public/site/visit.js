// Counts page views of the public site for the owner's Traffic page in the CRM
// (/platform/traffic). The tag that loads this file is added to the built pages
// by script/build-site.ts; the receiving end is server/routes/traffic.ts.
//
// What is sent: the page's path and language, the hostname the visitor came
// from (not the full address), utm tags, the window width and the time zone.
// What is not: no cookie, no visitor id, nothing saved in the browser, and the
// server keeps no IP address. A returning visitor cannot be recognised.
(function () {
  var doc = document, loc = location;

  function send() {
    try {
      var params = new URLSearchParams(loc.search);

      // Our own browsers: open any page once with ?notrack=1 and it stops
      // counting there (?notrack=0 turns it back on).
      try {
        if (params.has('notrack')) {
          if (params.get('notrack') === '0') localStorage.removeItem('la_notrack');
          else localStorage.setItem('la_notrack', '1');
        }
        if (localStorage.getItem('la_notrack')) return;
      } catch (e) { /* storage blocked: count the view */ }
      if (navigator.webdriver) return;

      var site = loc.hostname.replace(/^www\./, '');
      var from = '', internal = false;
      try {
        var ref = new URL(doc.referrer);
        if (ref.hostname.replace(/^www\./, '') === site) internal = true;
        else from = ref.hostname;
      } catch (e) { /* no referrer */ }

      // A visit starts with a view that did not come from another page of the
      // site. Reloads and back/forward steps are views, not new visits.
      var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {};
      var entry = !internal && nav.type !== 'reload' && nav.type !== 'back_forward';

      var zone = '';
      try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }

      fetch('/api/site/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          p: loc.pathname,
          l: doc.documentElement.lang || '',
          e: entry ? 1 : 0,
          r: from,
          s: params.get('utm_source') || '',
          m: params.get('utm_medium') || '',
          c: params.get('utm_campaign') || '',
          w: window.innerWidth || 0,
          z: zone
        })
      }).catch(function () {});
    } catch (e) { /* counting must never break the page */ }
  }

  // A page the browser loads ahead of time is not a view until it is shown.
  if (doc.prerendering) doc.addEventListener('prerenderingchange', send, { once: true });
  else send();
})();
