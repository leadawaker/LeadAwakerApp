import { useRef, useState, useEffect, RefObject } from "react";

export function useCarouselScrollLock(
  sectionRef: RefObject<HTMLDivElement>,
  stepsLength: number
) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );

  const isLockedRef = useRef(false);
  const stepRef = useRef(0);
  const touchStartYRef = useRef(0);
  const lastSwipeTimeRef = useRef(0);
  const lastUnlockTimeRef = useRef(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    stepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    if (!isMobile) return;

    const checkAndLock = (): boolean => {
      if (isLockedRef.current || !sectionRef.current) return false;
      if (Date.now() - lastUnlockTimeRef.current < 1200) return false;

      const rect = sectionRef.current.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      // Lock when the viewport center line is inside the section's bounds
      const hasCrossedCenter =
        rect.top <= viewportCenter && rect.bottom >= viewportCenter;

      if (hasCrossedCenter) {
        isLockedRef.current = true;
        setIsLocked(true);
        return true;
      }
      return false;
    };

    const unlock = (direction: "up" | "down") => {
      isLockedRef.current = false;
      setIsLocked(false);
      lastUnlockTimeRef.current = Date.now();
      window.scrollBy({
        top: direction === "down" ? window.innerHeight * 0.4 : -window.innerHeight * 0.4,
        behavior: "smooth",
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0].clientY;
      // Try to lock immediately on touch — catches fast swipes before scroll fires
      checkAndLock();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isLockedRef.current) e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isLockedRef.current) return;

      const now = Date.now();
      if (now - lastSwipeTimeRef.current < 600) return;

      const delta = touchStartYRef.current - e.changedTouches[0].clientY;
      if (Math.abs(delta) < 40) return;

      lastSwipeTimeRef.current = now;

      if (delta > 0) {
        if (stepRef.current < stepsLength - 1) {
          const next = stepRef.current + 1;
          stepRef.current = next;
          setCurrentStep(next);
        } else {
          unlock("down");
        }
      } else {
        if (stepRef.current > 0) {
          const prev = stepRef.current - 1;
          stepRef.current = prev;
          setCurrentStep(prev);
        } else {
          unlock("up");
        }
      }
    };

    window.addEventListener("scroll", checkAndLock, { passive: true });
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      isLockedRef.current = false;
      setIsLocked(false);
      window.removeEventListener("scroll", checkAndLock);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, stepsLength, sectionRef]);

  return { isMobile, currentStep, setCurrentStep, isLocked };
}
