// Micro-animation utilities for scroll-triggered entrance animations.
// Exposes window.useInView, window.revealStyle, window.stagger.
// Loaded before all section files; works in Babel standalone global scope.

const _MOTION_REDUCED =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

// useInView([options]) → [ref, inView]
// Attaches an IntersectionObserver to ref; inView flips true once and stays.
// options.immediate = true → fires after one rAF on mount (for above-the-fold).
// options.threshold  (default 0.15)
// options.rootMargin (default '0px 0px -10% 0px')
window.useInView = function useInView(options) {
  const { immediate = false, threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = options || {};
  const ref = React.useRef(null);
  const [inView, setInView] = React.useState(_MOTION_REDUCED);

  React.useEffect(() => {
    if (_MOTION_REDUCED) { setInView(true); return; }

    if (immediate) {
      const raf = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(raf);
    }

    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold, rootMargin });

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, inView];
};

// revealStyle(inView, opts) → inline style object
// Hidden: opacity 0 + translateY/X(distance). Visible: opacity 1 + translate(0).
// opts.delay    ms before transition starts (default 0)
// opts.distance px to translate from (default 12). Negative = opposite direction.
// opts.axis     'y' | 'x' (default 'y')
window.revealStyle = function revealStyle(inView, opts) {
  if (_MOTION_REDUCED) return {};
  const { delay = 0, distance = 12, axis = 'y' } = opts || {};
  const val = inView ? 0 : distance;
  const translate = axis === 'x' ? `translateX(${val}px)` : `translateY(${val}px)`;
  return {
    opacity: inView ? 1 : 0,
    transform: translate,
    transition: inView
      ? `opacity 400ms ease-out ${delay}ms, transform 500ms cubic-bezier(.2,.7,.2,1) ${delay}ms`
      : 'none',
    willChange: inView ? 'auto' : 'opacity, transform',
  };
};

// stagger(i, step) → delay in ms. step defaults to 70ms.
window.stagger = function stagger(i, step) {
  return i * (step != null ? step : 70);
};
