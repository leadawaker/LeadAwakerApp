import { useState, useEffect, useRef, RefObject } from "react";

export function useCarouselScrollLock(
  sectionRef: RefObject<HTMLElement | null>,
  stepCount: number
) {
  const [isMobile, setIsMobile] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !isMobile) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 30) {
        setCurrentStep((p) => Math.min(p + 1, stepCount - 1));
      } else if (e.deltaY < -30) {
        setCurrentStep((p) => Math.max(p - 1, 0));
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY.current === null) return;
      const delta = touchStartY.current - e.changedTouches[0].clientY;
      if (delta > 40) {
        setCurrentStep((p) => Math.min(p + 1, stepCount - 1));
      } else if (delta < -40) {
        setCurrentStep((p) => Math.max(p - 1, 0));
      }
      touchStartY.current = null;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isMobile, sectionRef, stepCount]);

  return { isMobile, currentStep, setCurrentStep };
}
