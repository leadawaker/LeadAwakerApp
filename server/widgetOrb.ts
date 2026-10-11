// The assistant's face: a soft orb with two pill eyes that has a life of its
// own. One stylesheet and one snippet of markup, used by the launcher (inside
// the loader's shadow root), the greeting teaser, and the chat frame (welcome
// screen, header, every AI message), so the character is the same object
// wherever the visitor meets it.
//
// Pure CSS, like the launcher ring: it runs on a client's page, where a canvas
// or WebGL loop for a 60px button would be a cost they never agreed to.
//
// What makes her look alive rather than wound up: every motion is its own
// animation on its own property (gaze as a 3D head turn on `transform`, darts
// on `scale`, head tilt on `rotate`, blinks and smiles on the eyes, breathing
// on the orb), each
// on a cycle length that shares no rhythm with the others, so the combination
// never visibly repeats. Eye moves are quick darts with a small overshoot, the
// way eyes actually move, and blinks come at uneven gaps, sometimes doubled.
//
// Size comes from `--lo-s` (eyes and blur scale with it). The look is set on any
// ancestor: `.lo-tinted` / `.lo-solid` with `--lo-c` for a colour orb (the
// default is liquid metal), `.lo-tint` with `--lo-tint` for metal in another
// shade (gold, copper), `.lo-grad` plus `.lo-sunset` / `.lo-aurora` for a
// gradient palette, `--lo-eye` for the eyes, and `.lo-face-icon` /
// `.lo-face-photo` (with `--lo-photo`) for a chat icon or a photo instead of
// eyes. `orbLook()` below turns a widget's settings into exactly that.
//
// `--lo-e` (milliseconds, set by the frame on every repaint) shifts every
// animation by the time already elapsed, so an orb rebuilt by a repaint picks
// up where the old one was instead of snapping back to its first frame.
// States, all set on an ancestor (or the orb itself):
// `.lo-fast` she is thinking: metal spins quicker, eyes look up and aside.
// `.lo-happy` (and hovering the launcher) her eyes smile.
// `.lo-watch` with `--lo-gx` / `--lo-gy` (-1..1): she looks that way (the
// launcher and the chat frame set it while the cursor is near).
// `.lo-hop` on the orb: one small hop, offset by `--lo-hd` ms like `--lo-e`.
// `.lo-calm` on the orb: she only blinks (and still looks at a near cursor).
// `.lo-still` freezes an orb facing forward.

export const ORB_CSS = `
.lo{--lo-s:40px;--lo-ba:1;--lo-gd:24s;--lo-td:27s;--lo-jd:41s;--lo-bd:8.3s;position:relative;display:inline-block;width:var(--lo-s);height:var(--lo-s);border-radius:50%;flex:0 0 auto;
  overflow:hidden;isolation:isolate;background:#d4d4d8;vertical-align:middle;
  -webkit-mask:radial-gradient(circle closest-side,#000 84%,transparent 100%);mask:radial-gradient(circle closest-side,#000 84%,transparent 100%);
  box-shadow:inset 0 calc(var(--lo-s)*-.07) calc(var(--lo-s)*.16) rgba(0,0,0,.2),inset 0 calc(var(--lo-s)*.05) calc(var(--lo-s)*.1) rgba(255,255,255,.75);
  animation:lo-breathe 5.3s ease-in-out infinite;animation-delay:calc(var(--lo-e,0) * -1ms)}
.lo::before{content:"";position:absolute;inset:-28%;z-index:-1;
  background:conic-gradient(from 0deg,#fafafa,#9a9aa2 12%,#f4f4f5 24%,#5a5a62 36%,#e4e4e7 48%,#d9c2a3 56%,#fff 64%,#7a7a82 76%,#b9c4cf 86%,#fafafa);
  filter:blur(calc(var(--lo-s)*.12));animation:lo-swirl 48s linear infinite;animation-delay:calc(var(--lo-e,0) * -1ms)}
.lo::after{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;
  background:radial-gradient(55% 42% at 34% 20%,rgba(255,255,255,.8),transparent 72%)}
/* The eyes' box is the whole orb, so a tilt or a squash turns about her face's
   centre (47% down), not about the pair of eyes. Looking somewhere is a real
   turn of her head: the eyes sit in front of a pivot (--lo-in / --lo-out push
   it back and out again) and turn about it, seen through a near camera
   (--lo-p). So both eyes slide round towards the edge, and the one further
   round comes out narrower and smaller. The pivot is deeper than her real
   centre on purpose: a small angle then carries the eyes a long way, and they
   stay full ovals instead of thinning to slivers at the edge. Resting, the turn
   follows --lo-gx / --lo-gy; the idle gaze animates the same two angles. */
.lo-eyes{position:absolute;inset:-3% 0 3%;z-index:1;display:flex;align-items:center;justify-content:center;gap:calc(var(--lo-s)*.1);
  --lo-p:perspective(calc(var(--lo-s)*.8));--lo-in:translateZ(calc(var(--lo-s)*-.55));--lo-out:translateZ(calc(var(--lo-s)*.55));
  transform:var(--lo-p) var(--lo-in) rotateY(calc(var(--lo-gx,0)*30deg)) rotateX(calc(var(--lo-gy,0)*-17deg)) var(--lo-out);
  animation:lo-gaze var(--lo-gd) ease-in-out infinite,lo-dart var(--lo-gd) ease-in-out infinite,lo-tilt var(--lo-td) ease-in-out infinite;
  animation-delay:calc(var(--lo-e,0) * -1ms);transition:opacity .2s ease,transform .22s cubic-bezier(.2,.8,.2,1)}
/* Oval eyes. The smile is a mask: an arc rising from below eats each eye's
   lower half. Resting, the arc sits under the eye; smiling moves it up
   (mask-position), which animates on its own, no registered property needed. */
.lo-eyes i{display:block;width:calc(var(--lo-s)*.135);height:calc(var(--lo-s)*.235);border-radius:50%;background:var(--lo-eye,#111114);
  -webkit-mask:radial-gradient(ellipse 58% 24% at 50% 100%,transparent 96%,#000 100%) 50% 0/100% 300% no-repeat;
  mask:radial-gradient(ellipse 58% 24% at 50% 100%,transparent 96%,#000 100%) 50% 0/100% 300% no-repeat;
  animation:lo-blink var(--lo-bd) ease-in-out infinite,lo-joy var(--lo-jd) ease-in-out infinite;animation-delay:calc(var(--lo-e,0) * -1ms)}
.lo-fast .lo-eyes{animation:lo-ponder 3.4s ease-in-out infinite;animation-delay:calc(var(--lo-e,0) * -1ms)}
.lo-watch .lo-eyes{animation:none}
.lo-happy .lo-eyes i,.la-btn:hover .lo-eyes i{animation-name:lo-blink,lo-joy,lo-glee;animation-duration:var(--lo-bd),var(--lo-jd),.4s;
  animation-timing-function:ease-in-out,ease-in-out,cubic-bezier(.3,1.5,.5,1);animation-iteration-count:infinite,infinite,1;
  animation-fill-mode:none,none,forwards;animation-delay:calc(var(--lo-e,0) * -1ms),calc(var(--lo-e,0) * -1ms),0s}
.lo.lo-hop{transform-origin:50% 85%;animation:lo-breathe 5.3s ease-in-out infinite,lo-hop .8s linear;
  animation-delay:calc(var(--lo-e,0) * -1ms),calc(var(--lo-hd,0) * -1ms)}
/* Calm: no wandering, tilting or breathing, just blinks (and a look at the
   cursor when it comes close). For a face that sits beside text being read. */
.lo.lo-calm,.lo.lo-calm .lo-eyes{animation:none}
.lo.lo-calm .lo-eyes i{animation:lo-blink var(--lo-bd) ease-in-out infinite;animation-delay:calc(var(--lo-e,0) * -1ms)}
.lo.lo-calm.lo-hop{animation:lo-hop .8s linear;animation-delay:calc(var(--lo-hd,0) * -1ms)}
.lo-fast .lo::before{animation-duration:7s}
.lo-tint{--lo-metal:conic-gradient(from 0deg,color-mix(in srgb,var(--lo-tint) 22%,#fff),color-mix(in srgb,var(--lo-tint) 72%,#4a4a4a) 12%,
  color-mix(in srgb,var(--lo-tint) 30%,#fff) 24%,color-mix(in srgb,var(--lo-tint) 70%,#1c1c1c) 36%,color-mix(in srgb,var(--lo-tint) 45%,#eee) 48%,
  var(--lo-tint) 56%,color-mix(in srgb,var(--lo-tint) 12%,#fff) 64%,color-mix(in srgb,var(--lo-tint) 72%,#333) 76%,color-mix(in srgb,var(--lo-tint) 48%,#ddd) 86%,
  color-mix(in srgb,var(--lo-tint) 22%,#fff))}
.lo-tint .lo{background:color-mix(in srgb,var(--lo-tint) 55%,#d4d4d8)}
.lo-tint .lo::before{background:var(--lo-metal)}
.lo-tinted .lo{background:var(--lo-c)}
.lo-tinted .lo::before{background:conic-gradient(from 0deg,color-mix(in srgb,var(--lo-c) 35%,#fff),var(--lo-c) 20%,color-mix(in srgb,var(--lo-c) 55%,#000) 38%,
  color-mix(in srgb,var(--lo-c) 50%,#fff) 58%,var(--lo-c) 78%,color-mix(in srgb,var(--lo-c) 35%,#fff))}
.lo-tinted .lo::after{background:radial-gradient(55% 42% at 34% 20%,rgba(255,255,255,.4),transparent 72%)}
/* Solid: the top-left light, plus a smaller, fainter one bouncing back from the bottom right. */
.lo-solid .lo::after{background:radial-gradient(55% 42% at 34% 20%,rgba(255,255,255,.4),transparent 72%),radial-gradient(34% 24% at 70% 84%,rgba(255,255,255,.22),transparent 72%)}
.lo-solid .lo{background:radial-gradient(circle at 50% 30%,color-mix(in srgb,var(--lo-c) 82%,#fff),var(--lo-c) 60%,color-mix(in srgb,var(--lo-c) 85%,#000))}
.lo-solid .lo::before{display:none}
/* Gradient looks: a fixed palette instead of one colour. The moving layer is
   two soft blobs that drift, not the metal's turning swirl, so the palette
   keeps its top-to-bottom order. */
.lo-grad .lo::before{inset:-12%;filter:blur(calc(var(--lo-s)*.09));animation:lo-drift 11s ease-in-out infinite alternate;animation-delay:calc(var(--lo-e,0) * -1ms)}
.lo-grad .lo-fast .lo::before{animation-duration:3.5s}
.lo-grad .lo::after{background:radial-gradient(55% 42% at 34% 20%,rgba(255,255,255,.45),transparent 72%)}
.lo-grad .lo{box-shadow:inset 0 calc(var(--lo-s)*-.05) calc(var(--lo-s)*.14) rgba(40,10,90,.14),inset 0 calc(var(--lo-s)*.05) calc(var(--lo-s)*.1) rgba(255,255,255,.6)}
/* Sunset: yellow at the top, through orange and pink, to a cool blue foot. */
.lo-sunset .lo{background:linear-gradient(180deg,#ffd84a 0%,#ffb03a 26%,#ff8f5e 50%,#f78fc4 70%,#c9a3ff 86%,#9bdcff 100%)}
.lo-sunset .lo::before{background:radial-gradient(42% 38% at 32% 26%,rgba(255,226,120,.85),transparent 72%),radial-gradient(46% 40% at 66% 78%,rgba(196,160,255,.8),transparent 72%)}
/* Aurora: a pearl with violet, blue and cyan pooling in its lower half. */
.lo-aurora .lo{background:radial-gradient(70% 26% at 50% 102%,rgba(255,255,255,.95),transparent 100%),radial-gradient(40% 34% at 22% 68%,#c24dff,transparent 100%),
  radial-gradient(48% 34% at 54% 74%,#4c58ff,transparent 100%),radial-gradient(38% 36% at 86% 54%,#63e2ff,transparent 100%),linear-gradient(180deg,#fff 0%,#f1f3ff 45%,#dfe5ff 100%)}
.lo-aurora .lo::before{background:radial-gradient(36% 30% at 30% 66%,rgba(214,90,255,.7),transparent 72%),radial-gradient(34% 30% at 74% 62%,rgba(90,220,255,.7),transparent 72%)}
.lo-ico{position:absolute;inset:0;z-index:1;display:none;align-items:center;justify-content:center;color:var(--lo-eye,#111114);transition:opacity .2s ease}
.lo-ico svg{width:46%;height:46%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.lo-face-icon .lo-eyes{display:none}
.lo-face-icon .lo-ico{display:flex}
.lo-face-photo .lo{--lo-ba:0;background:var(--lo-photo) center/cover no-repeat,#d4d4d8;box-shadow:none;-webkit-mask:none;mask:none}
.lo-face-photo .lo::before,.lo-face-photo .lo::after,.lo-face-photo .lo-eyes{display:none}
.lo.lo-still,.lo.lo-still::before,.lo.lo-still .lo-eyes,.lo.lo-still .lo-eyes i{animation:none}
@keyframes lo-swirl{to{transform:rotate(360deg)}}
@keyframes lo-drift{0%{transform:translate(-4%,-3%) rotate(-9deg)}100%{transform:translate(4%,3%) rotate(9deg)}}
@keyframes lo-breathe{0%,100%{scale:1}50%{scale:calc(1 + .012*var(--lo-ba)) calc(1 + .026*var(--lo-ba))}}
/* Where she looks, as a turn right and a tip up in degrees: darts with a small
   overshoot, then a hold with a slow drift, like real fixations. Mostly near
   the middle, now and then far round to a side or up/down a diagonal. */
@keyframes lo-gaze{0%,9%{transform:var(--lo-p) var(--lo-in) rotateY(0deg) rotateX(0deg) var(--lo-out)}
  9.7%{transform:var(--lo-p) var(--lo-in) rotateY(-19.5deg) rotateX(1.5deg) var(--lo-out)}
  10.4%,18%{transform:var(--lo-p) var(--lo-in) rotateY(-16.5deg) rotateX(1.5deg) var(--lo-out)}
  19.5%{transform:var(--lo-p) var(--lo-in) rotateY(-15deg) rotateX(0deg) var(--lo-out)}
  20.2%,28%{transform:var(--lo-p) var(--lo-in) rotateY(1.5deg) rotateX(-1.5deg) var(--lo-out)}
  28.7%{transform:var(--lo-p) var(--lo-in) rotateY(29deg) rotateX(11deg) var(--lo-out)}
  29.4%,36%{transform:var(--lo-p) var(--lo-in) rotateY(25deg) rotateX(9.5deg) var(--lo-out)}
  36.7%,38.2%{transform:var(--lo-p) var(--lo-in) rotateY(6deg) rotateX(-3.5deg) var(--lo-out)}
  38.9%,46%{transform:var(--lo-p) var(--lo-in) rotateY(-11.5deg) rotateX(-3.5deg) var(--lo-out)}
  46.7%,55%{transform:var(--lo-p) var(--lo-in) rotateY(0deg) rotateX(0deg) var(--lo-out)}
  55.7%{transform:var(--lo-p) var(--lo-in) rotateY(-29deg) rotateX(-8deg) var(--lo-out)}
  56.4%,62%{transform:var(--lo-p) var(--lo-in) rotateY(-25deg) rotateX(-6.5deg) var(--lo-out)}
  62.7%,70%{transform:var(--lo-p) var(--lo-in) rotateY(3deg) rotateX(1.5deg) var(--lo-out)}
  70.7%{transform:var(--lo-p) var(--lo-in) rotateY(13.5deg) rotateX(13.5deg) var(--lo-out)}
  71.4%,78%{transform:var(--lo-p) var(--lo-in) rotateY(12deg) rotateX(12deg) var(--lo-out)}
  78.7%,83%{transform:var(--lo-p) var(--lo-in) rotateY(-4.5deg) rotateX(0deg) var(--lo-out)}
  83.7%{transform:var(--lo-p) var(--lo-in) rotateY(28deg) rotateX(-2deg) var(--lo-out)}
  84.4%,90%{transform:var(--lo-p) var(--lo-in) rotateY(24.5deg) rotateX(-1.5deg) var(--lo-out)}
  90.7%,100%{transform:var(--lo-p) var(--lo-in) rotateY(0deg) rotateX(0deg) var(--lo-out)}}
/* The eyes squash a little mid-dart, in step with lo-gaze. */
@keyframes lo-dart{0%,9%,9.7%,19.5%,20.2%,28%,28.7%,36%,36.7%,38.2%,38.9%,46%,46.7%,55%,55.7%,62%,62.7%,70%,70.7%,78%,78.7%,83%,83.7%,90%,90.7%,100%{scale:1}
  9.35%,19.85%,28.35%,36.35%,38.55%,46.35%,55.35%,62.35%,70.35%,78.35%,83.35%,90.35%{scale:1.09 .91}}
/* Now and then a curious tilt of the head. */
@keyframes lo-tilt{0%,52%,63%,84%,91%,100%{rotate:0deg}55%,60%{rotate:7deg}86.5%,89%{rotate:-4deg}}
/* Uneven blinks: close fast, open a touch slower, one of them doubled. */
@keyframes lo-blink{0%,21%,23.8%,57%,59.8%,62%,64.8%,88%,90.8%,100%{scale:1}22.2%,58.2%,63.2%,89.2%{scale:1.12 .08}}
@keyframes lo-joy{0%,63%,71.5%,100%{width:calc(var(--lo-s)*.135);height:calc(var(--lo-s)*.235);-webkit-mask-position:50% 0;mask-position:50% 0}
  64.5%,70%{width:calc(var(--lo-s)*.185);height:calc(var(--lo-s)*.14);-webkit-mask-position:50% 100%;mask-position:50% 100%}}
@keyframes lo-glee{to{width:calc(var(--lo-s)*.185);height:calc(var(--lo-s)*.14);-webkit-mask-position:50% 100%;mask-position:50% 100%}}
/* Thinking: up and far round to one side, then the other, head tilted with it. */
@keyframes lo-ponder{0%,100%{rotate:-4deg;transform:var(--lo-p) var(--lo-in) rotateY(21deg) rotateX(12deg) var(--lo-out)}
  40%{rotate:-4deg;transform:var(--lo-p) var(--lo-in) rotateY(18deg) rotateX(13.5deg) var(--lo-out)}
  48%,88%{rotate:4deg;transform:var(--lo-p) var(--lo-in) rotateY(-19.5deg) rotateX(12deg) var(--lo-out)}}
/* A hop: crouch, spring up stretched, land squashed, settle. */
@keyframes lo-hop{0%{translate:0 0;scale:1;animation-timing-function:ease-in}
  15%{translate:0 0;scale:1.12 .86;animation-timing-function:cubic-bezier(.2,.7,.4,1)}
  42%{translate:0 calc(var(--lo-s)*-.3);scale:.92 1.1;animation-timing-function:cubic-bezier(.6,0,.8,.4)}
  64%{translate:0 0;scale:1.12 .88;animation-timing-function:ease-out}
  82%{translate:0 0;scale:.97 1.03;animation-timing-function:ease-in-out}
  100%{translate:0 0;scale:1}}
@media (prefers-reduced-motion:reduce){.lo,.lo::before,.lo-eyes,.lo-eyes i,.lo-fast .lo-eyes,.lo.lo-hop,.lo.lo-calm .lo-eyes i,.lo.lo-calm.lo-hop,.lo-happy .lo-eyes i,.la-btn:hover .lo-eyes i{animation:none;transition:none}}
`;

// The chat-bubble face, for a widget that would rather not have eyes.
const ICON = '<svg viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

/** The orb's markup. `cls` adds a sizing/placement class. */
export function orbHtml(cls = ""): string {
  return `<span class="lo${cls ? " " + cls : ""}" aria-hidden="true"><span class="lo-eyes"><i></i><i></i></span><span class="lo-ico">${ICON}</span></span>`;
}

const EYE = { black: "#111114", white: "#fafafa", indigo: "#241046" } as const;

/** The gradient palettes an orb can wear (`orb_style` holds the name). */
export const ORB_GRADIENTS = ["sunset", "aurora"] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

// Black eyes are the character; white ones are the exception, for a colour so
// dark that black would vanish into it (near-black, deep navy, oxblood). This
// is far below the usual "light text or dark text" midpoint on purpose: on a
// mid-dark wine or royal blue she still wears black eyes.
const DARK_ORB = 0.035;
function luminance(hex: string): number {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}

/**
 * A widget's orb settings as the classes and CSS variables an ancestor carries.
 * "Auto" eyes are black on metal (any shade) and on a colour orb unless the
 * colour is truly dark, and deep indigo on a gradient. `photo` is the
 * face image's URL for the caller to put in `--lo-photo`, resolved against
 * whatever origin the caller is on.
 */
export function orbLook(
  o: {
    style?: string | null; color?: string | null; eyes?: string | null; tint?: string | null;
    face?: string | null; photo?: string | null; rim?: string | null; rimColor?: string | null;
    shadow?: string | null; shadowColor?: string | null;
  },
): { cls: string; vars: string; photo: string | null } {
  const color = o.color && HEX.test(o.color) ? o.color.toLowerCase() : "";
  const grad = (ORB_GRADIENTS as readonly string[]).includes(o.style || "") ? (o.style as string) : "";
  const style = grad ? "grad" : (o.style === "tinted" || o.style === "solid") && color ? o.style : "metal";
  const tint = style === "metal" && o.tint && HEX.test(o.tint) ? o.tint.toLowerCase() : "";
  const photo = o.face === "photo" && o.photo ? o.photo : null;
  const face = photo ? "photo" : o.face === "icon" ? "icon" : "eyes";
  // The launcher's rim (the ring around the button). Unset means the white
  // band (the default since 2026-10-10): the orb a size smaller, sitting in a
  // white disk the size of the button. The others: the turning metal, a soft
  // outline with rings pulsing out of it, or nothing. Pulse and band share one
  // colour.
  const rim = o.rim === "metal" || o.rim === "pulse" || o.rim === "none" ? o.rim : "band";
  const rimColor = o.rimColor && HEX.test(o.rimColor) ? o.rimColor.toLowerCase() : "";
  // What the button casts on the page: a drop shadow, nothing, or a glow.
  const shadow = o.shadow === "none" || o.shadow === "glow" ? o.shadow : "shadow";
  const shadowColor = o.shadowColor && HEX.test(o.shadowColor) ? o.shadowColor.toLowerCase() : "";
  const eyes = o.eyes === "black" || o.eyes === "white"
    ? EYE[o.eyes]
    : style === "grad" ? EYE.indigo : style !== "metal" && luminance(color) < DARK_ORB ? EYE.white : EYE.black;
  const cls = [
    style === "metal" ? (tint ? "lo-tint" : "") : style === "grad" ? `lo-grad lo-${grad}` : `lo-${style}`,
    face === "eyes" ? "" : `lo-face-${face}`,
    rim === "metal" ? "" : `lo-rim-${rim}`,
    shadow === "shadow" ? "" : `lo-sh-${shadow}`,
  ].filter(Boolean).join(" ");
  const vars = [`--lo-eye:${eyes}`];
  if (style === "tinted" || style === "solid") vars.push(`--lo-c:${color}`);
  if (tint) vars.push(`--lo-tint:${tint}`);
  if (rimColor && (rim === "pulse" || rim === "band")) vars.push(`--lo-rim:${rimColor}`);
  if (shadowColor && shadow !== "none") vars.push(`--lo-sh:${shadowColor}`);
  return { cls, vars: vars.join(";"), photo };
}

/** The CSS variable for a face photo, for a style attribute. */
export function photoVar(url: string | null): string {
  return url ? `;--lo-photo:url('${url.replace(/['"\\()\s<>]/g, "")}')` : "";
}
