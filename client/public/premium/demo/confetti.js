// Part of the browser demo page. Split out of demo.html (which had grown
// past 1600 lines) so each concern can be read, and tested, on its own.
// Plain ES modules, same-origin: the page still ships no bundler and no
// third-party script.

export function confetti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var cv = document.createElement("canvas");
  cv.id = "confetti";
  cv.setAttribute("aria-hidden", "true");
  document.body.appendChild(cv);
  var ctx = cv.getContext("2d");
  if (!ctx) { cv.parentNode.removeChild(cv); return; }

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  function size() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener("resize", size);

  // The site's own palette, not party colours: wine, its soft tint, a warm
  // gold picked from the directional light, and paper.
  var COLORS = ["#5E2230", "#7A2E3E", "#C9A227", "#F4EFE3", "#D8C9A3"];
  var bits = [];
  for (var i = 0; i < 110; i++) {
    bits.push({
      x: W * (0.15 + Math.random() * 0.7),
      y: H + 20 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 5.2,
      vy: -(11 + Math.random() * 9),      // launched upward, then gravity takes it
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.32,
      c: COLORS[(Math.random() * COLORS.length) | 0]
    });
  }

  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  var LIFE = 2900;
  var FADE = 700;

  function frame(now) {
    var age = now - t0;
    if (age >= LIFE) {
      window.removeEventListener("resize", size);
      if (cv.parentNode) cv.parentNode.removeChild(cv);
      return;
    }
    ctx.clearRect(0, 0, W, H);
    var fade = age > LIFE - FADE ? (LIFE - age) / FADE : 1;
    for (var j = 0; j < bits.length; j++) {
      var b = bits[j];
      b.vy += 0.34;          // gravity
      b.vx *= 0.995;         // air drag
      b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      if (b.y > H + 60) continue;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
