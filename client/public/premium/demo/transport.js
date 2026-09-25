// client/public/premium/demo/transport.js
// The web-demo conversation transport, without any DOM. main.js and widget.js
// still carry their own copies; new surfaces use this one.

export function createTransport(opts) {
  const base = "/api/web-demo/" + encodeURIComponent(opts.token);
  const doFetch = opts.fetchImpl || ((u, o) => fetch(u, o));
  const setTimer = opts.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer || ((t) => clearTimeout(t));

  let state = null;
  let pending = false;
  let busy = false;
  let epoch = 0;
  let timer = null;
  let loading = null;
  let recapLoaded = false;
  let stopped = false;

  function api(path, init) {
    return doFetch(base + (path || ""), init).then((r) =>
      r.json().catch(() => ({})).then((body) => {
        if (!r.ok) {
          const e = new Error(body.message || "Request failed");
          e.code = body.code; e.status = r.status;
          throw e;
        }
        return body;
      }));
  }

  function emit() { opts.onState(state, { pending }); }

  function schedule(ms) {
    if (stopped) return;
    if (timer) clearTimer(timer);
    timer = setTimer(poll, ms);
  }

  function nextDelay() { return state && state.done ? 15000 : pending ? 1600 : 6000; }

  function maybeRecap() {
    if (!state || !state.done || recapLoaded) return;
    recapLoaded = true;
    api("/recap").then((r) => opts.onRecap(r || { summary: "", brief: [] }))
      .catch(() => opts.onRecap({ summary: "", brief: [] }));
  }

  function accept(next) {
    const grew = state && next.messages && state.messages && next.messages.length > state.messages.length;
    state = next;
    if (grew) pending = false;
    emit();
    maybeRecap();
  }

  function poll() {
    if (busy) { schedule(1500); return Promise.resolve(); }
    const mine = epoch;
    return api("").then((next) => {
      if (mine !== epoch) { schedule(nextDelay()); return; }
      accept(next);
      schedule(nextDelay());
    }).catch((err) => {
      if (mine === epoch && err && err.status === 404) { opts.onError(err); return; }
      schedule(6000);
    });
  }

  function load() {
    if (loading) return loading;
    loading = api("").then((s) => { accept(s); schedule(nextDelay()); return s; })
      .catch((err) => { loading = null; opts.onError(err); throw err; });
    return loading;
  }

  function send(raw) {
    const text = String(raw || "").trim();
    if (!text || busy || pending || !state || state.done) return Promise.resolve();
    epoch++;
    state = { ...state, messages: [...state.messages, { role: "visitor", text, at: new Date().toISOString() }] };
    pending = true;
    busy = true;
    emit();
    return api("/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    }).then(() => { busy = false; schedule(1200); })
      .catch((err) => { busy = false; pending = false; emit(); opts.onError(err); });
  }

  // The engine's /restart response body is not guaranteed to carry the fresh
  // conversation state (it can be as bare as {}), so a follow-up GET fetches
  // the real thing. main.js's own doRestart trusts the /restart response
  // directly, but that is not a contract this module can rely on generically,
  // so the extra GET stays: cheap, and correct either way.
  // Resolves true only once a fresh conversation is really on screen, false
  // on a skip (already busy, or no state to restart from) or a failure. A
  // caller that flips its own view to "feed" on any resolution, success or
  // not, would show a blank feed on a restart that never happened.
  function restart(scenario) {
    if (busy || !state) return Promise.resolve(false);
    busy = true;
    pending = false;
    recapLoaded = false;
    epoch++;
    return api("/restart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: scenario || null }),
    }).then(() => api("")).then((s) => { busy = false; accept(s); schedule(nextDelay()); return true; })
      .catch((err) => { busy = false; opts.onError(err); return false; });
  }

  return {
    load, send, restart,
    pollSoon(ms) { schedule(ms == null ? 150 : ms); },
    stop() { stopped = true; if (timer) clearTimer(timer); },
    getState: () => state,
    isPending: () => pending,
  };
}
