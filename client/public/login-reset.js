// "Forgot password?" on /login: a small request form that posts to /api/auth/request-reset,
// plus the "password changed" note shown after /reset-password sends people back here (?reset=1).
// Language follows the login page: it reads <html lang>, which login.html's language switch sets.
(function () {
  var COPY = {
    en: {
      link: 'Forgot password?', eyebrow: '— Reset', title: 'Forgot your password?',
      help: 'Enter your email and we will send you a link to choose a new one.',
      label: 'Email', submit: 'Send reset link', sending: 'Sending…', back: 'Back to sign in',
      sent: 'If an account exists for that email, we sent a password reset link. It is valid for 1 hour.',
      invalid: 'Please enter a valid email address.',
      tooMany: 'Too many requests. Please try again later.',
      network: 'Network error, please try again',
      done: 'Your password has been changed. Sign in with your new password.'
    },
    nl: {
      link: 'Wachtwoord vergeten?', eyebrow: '— Opnieuw instellen', title: 'Wachtwoord vergeten?',
      help: 'Vul je e-mailadres in en we sturen je een link om een nieuw wachtwoord te kiezen.',
      label: 'E-mail', submit: 'Stuur resetlink', sending: 'Versturen…', back: 'Terug naar inloggen',
      sent: 'Als er een account bestaat voor dit e-mailadres, hebben we een link gestuurd om je wachtwoord opnieuw in te stellen. De link is 1 uur geldig.',
      invalid: 'Vul een geldig e-mailadres in.',
      tooMany: 'Te veel verzoeken. Probeer het later opnieuw.',
      network: 'Netwerkfout, probeer het opnieuw',
      done: 'Je wachtwoord is gewijzigd. Log in met je nieuwe wachtwoord.'
    },
    pt: {
      link: 'Esqueceu a senha?', eyebrow: '— Redefinir', title: 'Esqueceu sua senha?',
      help: 'Digite seu e-mail e enviaremos um link para você escolher uma nova senha.',
      label: 'E-mail', submit: 'Enviar link', sending: 'Enviando…', back: 'Voltar ao login',
      sent: 'Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha. Ele vale por 1 hora.',
      invalid: 'Digite um e-mail válido.',
      tooMany: 'Muitas solicitações. Tente novamente mais tarde.',
      network: 'Erro de rede, tente de novo',
      done: 'Sua senha foi alterada. Entre com a nova senha.'
    }
  };
  var $ = function (id) { return document.getElementById(id); };
  var link = $('forgot-link'), panel = $('reset'), form = $('reset-form'), loginForm = $('login-form');
  if (!link || !panel || !form || !loginForm) return;

  var emailEl = $('reset-email'), msg = $('reset-msg'), done = $('reset-done');
  var submitBtn = $('reset-submit'), submitLabel = $('reset-submit-label');
  var eyebrowEl = document.querySelector('.card .eyebrow');
  var titleEl = document.querySelector('.card h1.title');
  var divider = $('login-divider');
  var original = { eyebrow: eyebrowEl.textContent, titleHtml: titleEl.innerHTML };
  var open = false, state = null; // state: 'sent' | 'invalid' | 'tooMany' | 'network' | null

  function T(key) {
    var lang = document.documentElement.lang;
    return (COPY[lang] && COPY[lang][key]) || COPY.en[key];
  }

  function showMsg(kind, key) {
    state = key;
    msg.className = kind; // 'notice' | 'error'
    msg.textContent = T(key);
  }

  function render() {
    link.textContent = T('link');
    $('reset-help').textContent = T('help');
    $('reset-label').textContent = T('label');
    $('reset-back').textContent = T('back');
    submitLabel.textContent = submitBtn.dataset.loading === '1' ? T('sending') : T('submit');
    if (open) { eyebrowEl.textContent = T('eyebrow'); titleEl.textContent = T('title'); }
    if (state) msg.textContent = T(state);
    if (!done.classList.contains('hidden')) done.textContent = T('done');
  }

  function setOpen(on) {
    open = on;
    loginForm.hidden = on;
    if (divider) divider.hidden = on;
    panel.hidden = !on;
    if (on) {
      done.classList.add('hidden');
      var typed = $('email').value.trim();
      if (!emailEl.value && typed) emailEl.value = typed;
      msg.className = 'notice hidden'; state = null; form.hidden = false; $('reset-help').hidden = false;
      eyebrowEl.textContent = T('eyebrow');
      titleEl.textContent = T('title');
      emailEl.focus();
    } else {
      eyebrowEl.textContent = original.eyebrow;
      titleEl.innerHTML = original.titleHtml;
    }
    render();
  }

  link.addEventListener('click', function (e) { e.preventDefault(); setOpen(true); });
  $('reset-back').addEventListener('click', function (e) { e.preventDefault(); setOpen(false); });
  document.querySelectorAll('.nav-lang button').forEach(function (b) {
    // login.html's own handler sets <html lang> first (registered earlier), then we re-render.
    b.addEventListener('click', render);
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = emailEl.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('error', 'invalid'); return; }
    submitBtn.disabled = true; submitBtn.dataset.loading = '1'; render();
    try {
      var res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, lang: document.documentElement.lang })
      });
      if (res.ok) { showMsg('notice', 'sent'); form.hidden = true; $('reset-help').hidden = true; }
      else if (res.status === 429) showMsg('error', 'tooMany');
      else showMsg('error', 'network');
    } catch (_) {
      showMsg('error', 'network');
    } finally {
      submitBtn.disabled = false; submitBtn.dataset.loading = '0'; render();
    }
  });

  // Back from /reset-password with a new password.
  try {
    if (new URLSearchParams(location.search).get('reset') === '1') {
      done.classList.remove('hidden');
      history.replaceState(null, '', location.pathname);
    }
  } catch (_) {}
  render();
})();
