import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect } from "react";

function LogoAnimation() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (inView && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log("Audio play failed:", e));
    }
  }, [inView]);

  return (
    <motion.div
      ref={ref}
      className="absolute -bottom-27 left-1/2 -translate-x-1/2 pointer-events-none z-20"
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <audio ref={audioRef} src="/rooster-sound.mp3" preload="auto" />

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
            transition={{ delay: 2.5, duration: 0.8 }}
          />
          <motion.img
            src="/Logo-Rooster.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: 1.2, duration: 0.4 }}
          />
          <motion.img
            src="/Logo-Top.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            initial={{ opacity: 0, y: 15, scale: 1.1 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 15, scale: 1.1 }}
            transition={{ delay: 1.5, duration: 0.35 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function Footer() {
  const { t } = useTranslation("common");

  return (
    <footer className="bg-muted/30 pt-20 pb-10 border-t border-border relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-4 md:mb-16 relative z-10">
          <div>
            <h4 className="font-heading font-bold mb-4">{t("footer.company")}</h4>
            <ul className="space-y-3">
              <li><Link href="/" className="text-muted-foreground hover:text-primary transition-colors">{t("nav.home")}</Link></li>
              <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">{t("nav.about")}</Link></li>
              <li><Link href="/services" className="text-muted-foreground hover:text-primary transition-colors">{t("nav.services")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold mb-4">{t("footer.contact")}</h4>
            <ul className="space-y-3">
              <li><Link href="/book-demo" className="text-muted-foreground hover:text-primary transition-colors">{t("nav.bookDemo")}</Link></li>
              <li className="text-muted-foreground">leadawaker@gmail.com</li>
              <li className="text-muted-foreground text-sm">
                Christiaan Huygensweg 32,<br />
                s'Hertogenbosch, NL
              </li>
            </ul>
          </div>

          {/* Desktop Logo Container - relative positioned for absolute child */}
          <div className="hidden md:block relative">
            <LogoAnimation />
          </div>
        </div>

        {/* Mobile Logo - Static version with minimal top margin */}
        <div className="flex justify-center items-center mt-1 mb-2 md:hidden">
          <div className="relative w-[346px] h-[346px] -ml-2">
            <img src="/Logo-Lead.svg" alt="Lead Awaker Logo" className="absolute inset-0 w-full h-full object-contain" />
            <img src="/Logo-Awaker.svg" alt="" className="absolute inset-0 w-full h-full object-contain" />
            <img src="/Logo-Rooster.svg" alt="" className="absolute inset-0 w-full h-full object-contain" />
            <img src="/Logo-Top.svg" alt="" className="absolute inset-0 w-full h-full object-contain" />
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-1 text-sm text-muted-foreground relative z-10">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-primary transition-colors">{t("footer.privacy")}</Link>
            <Link href="/terms-of-service" className="hover:text-primary transition-colors">{t("footer.terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
