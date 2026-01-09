import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

function LogoAnimation() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <motion.div
      ref={ref}
      className="pointer-events-none z-20"
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute bottom-16 right-8 md:right-16 lg:right-24 w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
        <div className="relative w-full h-full">
          <motion.img
            src="/Logo-Lead.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            style={{ mixBlendMode: 'multiply' }}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
          <motion.img
            src="/Logo-Awaker.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            style={{ mixBlendMode: 'multiply' }}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          />
          <motion.img
            src="/Logo-Rooster.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            style={{ mixBlendMode: 'multiply' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: 1.0, duration: 0.8 }}
          />
          <motion.img
            src="/Logo-Top.svg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            style={{ mixBlendMode: 'multiply' }}
            initial={{ opacity: 0, scale: 1.2 }}
            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.2 }}
            transition={{ delay: 1.3, duration: 0.8 }}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16 relative z-10">
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

          <div></div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground relative z-10">
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-primary transition-colors">{t("footer.privacy")}</Link>
            <Link href="/terms-of-service" className="hover:text-primary transition-colors">{t("footer.terms")}</Link>
          </div>
        </div>

        <LogoAnimation />
      </div>
    </footer>
  );
}
