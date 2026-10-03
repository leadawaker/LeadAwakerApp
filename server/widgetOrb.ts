// Sara's face: a soft liquid-metal orb with two pill eyes that blink and glance
// around. One stylesheet and one snippet of markup, used by the launcher (inside
// the loader's shadow root), the greeting teaser, and the chat frame (welcome
// screen, header, every AI message), so the character is the same object
// wherever the visitor meets it.
//
// Pure CSS, like the launcher ring: it runs on a client's page, where a canvas
// or WebGL loop for a 60px button would be a cost they never agreed to.
//
// Size comes from `--lo-s` (eyes and blur scale with it). A brand-coloured orb is
// the side option: any ancestor that sets `--lo-c` (and `--lo-eye-c` for eyes
// that read on it) and carries `.lo-brand` turns the silver into that colour.

export const ORB_CSS = `
.lo{--lo-s:40px;position:relative;display:inline-block;width:var(--lo-s);height:var(--lo-s);border-radius:50%;flex:0 0 auto;
  overflow:hidden;isolation:isolate;background:#d4d4d8;vertical-align:middle;
  box-shadow:inset 0 calc(var(--lo-s)*-.07) calc(var(--lo-s)*.16) rgba(0,0,0,.2),inset 0 calc(var(--lo-s)*.05) calc(var(--lo-s)*.1) rgba(255,255,255,.75)}
.lo::before{content:"";position:absolute;inset:-28%;z-index:-1;
  background:conic-gradient(from 0deg,#fafafa,#9a9aa2 12%,#f4f4f5 24%,#5a5a62 36%,#e4e4e7 48%,#d9c2a3 56%,#fff 64%,#7a7a82 76%,#b9c4cf 86%,#fafafa);
  filter:blur(calc(var(--lo-s)*.1));animation:lo-swirl 10s linear infinite}
.lo::after{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;
  background:radial-gradient(55% 42% at 34% 20%,rgba(255,255,255,.8),transparent 72%)}
.lo-eyes{position:absolute;left:50%;top:47%;z-index:1;display:flex;gap:calc(var(--lo-s)*.15);
  transform:translate(-50%,-50%);animation:lo-look 12s ease-in-out infinite;transition:opacity .2s ease}
.lo-eyes i{display:block;width:calc(var(--lo-s)*.095);height:calc(var(--lo-s)*.23);border-radius:999px;
  background:var(--lo-eye,#111114);animation:lo-blink 5.4s ease-in-out infinite}
.lo-brand .lo{background:var(--lo-c)}
.lo-brand .lo::before{background:conic-gradient(from 0deg,color-mix(in srgb,var(--lo-c) 35%,#fff),var(--lo-c) 20%,color-mix(in srgb,var(--lo-c) 55%,#000) 38%,
  color-mix(in srgb,var(--lo-c) 50%,#fff) 58%,var(--lo-c) 78%,color-mix(in srgb,var(--lo-c) 35%,#fff))}
.lo-brand .lo::after{background:radial-gradient(55% 42% at 34% 20%,rgba(255,255,255,.45),transparent 72%)}
.lo-brand .lo-eyes i{background:var(--lo-eye-c,#fff)}
@keyframes lo-swirl{to{transform:rotate(360deg)}}
@keyframes lo-blink{0%,92%,100%{transform:scaleY(1)}94.5%{transform:scaleY(.1)}97%{transform:scaleY(1)}}
@keyframes lo-look{0%,16%{transform:translate(-50%,-50%)}22%,36%{transform:translate(-80%,-52%)}42%,54%{transform:translate(-50%,-50%)}
  60%,72%{transform:translate(-22%,-62%)}78%,100%{transform:translate(-50%,-50%)}}
@media (prefers-reduced-motion:reduce){.lo::before,.lo-eyes,.lo-eyes i{animation:none}}
`;

/** The orb's markup. `cls` adds a sizing/placement class. */
export function orbHtml(cls = ""): string {
  return `<span class="lo${cls ? " " + cls : ""}" aria-hidden="true"><span class="lo-eyes"><i></i><i></i></span></span>`;
}
