import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation("common");
  
  return (
    <footer className="bg-muted/30 pt-20 pb-10 border-t border-border">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
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
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
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
