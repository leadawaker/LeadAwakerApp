import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState, useMemo } from "react";

/* -------------------- Logo Animation (unchanged) -------------------- */

function LogoAnimation() {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  const [topWaveKey, setTopWaveKey] = useState(0);
  const [showTopWave, setShowTopWave] = useState(false);

  const replayTopWave = () => {
    setTopWaveKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!inView) return;

    const timeout = setTimeout(() => {
      setShowTopWave(true);
      replayTopWave();
    }, 2600);

    return () => clearTimeout(timeout);
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      className="absolute -bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-auto cursor-pointer"
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5 }}
      onMouseEnter={replayTopWave}
      onClick={replayTopWave}
    >
      <div className="w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
        <div className="relative w-full h-full">
          <motion.img
            src="/Logo-Lead.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />

          <motion.img
            src="/Logo-Awaker.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          />

          <motion.img
            src="/Logo-Rooster.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: 2.2, duration: 0.4 }}
          />

          {showTopWave && (
            <motion.img
              key={topWaveKey}
              src="/Logo-Top.svg"
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              initial={{ opacity: 0, scale: 0.25, x: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0, 1, 0, 0, 1, 1],
                scale: [0.6, 0.6, 0.6, 0.6, 0.6, 1, 1.07, 1],
                x: [15, 15, 15, 15, 15, 0, 0, 0],
                y: [-25, -25, -25, -25, -25, 0, 0, 0],
              }}
              transition={{
                duration: 2.0,
                times: [0, 0.15, 0.25, 0.4, 0.5, 0.75, 0.85, 1],
                ease: "linear",
              }}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------- Footer -------------------- */

const SUPPORTED_LANGS = ["en", "pt", "nl"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

export function Footer() {
  const { t } = useTranslation("common");
  const [location] = useLocation();

  /**
   * Detect language from URL
   */
  const currentLang = useMemo<Lang>(() => {
    const firstSegment = location.split("/").filter(Boolean)[0];
    return SUPPORTED_LANGS.includes(firstSegment as Lang)
      ? (firstSegment as Lang)
      : "en";
  }, [location]);

  /**
   * Build language-aware links
   */
  const withLang = (path: string) => {
    if (currentLang === "en") return path;
    return `/${currentLang}${path === "/" ? "" : path}`;
  };

  return (
    <footer className="bg-muted/30 pt-20 pb-10 border-t border-border relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-4 md:mb-16 relative z-10">
          <div>
            <h4 className="font-heading font-bold mb-4">
              {t("footer.company")}
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href={withLang("/")}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("nav.home")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/about")}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link
                  href={withLang("/services")}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("nav.services")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold mb-4">
              {t("footer.contact")}
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href={withLang("/book-demo")}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("nav.bookDemo")}
                </Link>
              </li>
              <li>
                <a
                  href="https://wa.me/5547974002162"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="mailto:leadawaker@gmail.com"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  leadawaker@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.google.com/maps/place/Christiaan+Huygensweg+32,+5223+BH+'s-Hertogenbosch,+Netherlands/@51.691872,5.2869323,17z/data=!3m1!4b1!4m6!3m5!1s0x47c6ee626d6e2827:0xc7dfbebc0d865c02!8m2!3d51.691872!4d5.2895072!16s%2Fg%2F11c2fk8jcj?entry=ttu&g_ep=EgoyMDI2MDEyMS4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  Christiaan Huygensweg 32,
                  <br />
                  s&apos;Hertogenbosch, NL
                </a>
              </li>
            </ul>
          </div>

          <div className="hidden md:block relative">
            <LogoAnimation />
          </div>
        </div>

        {/* Mobile Logo */}
        <div className="flex justify-center items-center mt-1 mb-2 md:hidden">
          <div className="relative w-[346px] h-[346px] -ml-2">
            <img src="/Logo-Lead.svg" className="absolute inset-0 w-full h-full object-contain" />
            <img src="/Logo-Awaker.svg" className="absolute inset-0 w-full h-full object-contain" />
            <img src="/Logo-Rooster.svg" className="absolute inset-0 w-full h-full object-contain" />
            <img src="/Logo-Top.svg" className="absolute inset-0 w-full h-full object-contain" />
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-1 text-sm text-muted-foreground relative z-10">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex gap-6">
            <Link
              href={withLang("/privacy-policy")}
              className="hover:text-primary transition-colors"
            >
              {t("footer.privacy")}
            </Link>
            <Link
              href={withLang("/terms-of-service")}
              className="hover:text-primary transition-colors"
            >
              {t("footer.terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}