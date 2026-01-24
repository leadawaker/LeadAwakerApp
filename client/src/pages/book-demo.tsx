import { motion } from "framer-motion";
import { Calendar, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

export default function BookDemo() {
  const { t, i18n } = useTranslation("bookDemo");

  // Get current language and create calendar URL with language parameter
  const currentLanguage = i18n.language.split('-')[0]; // Gets 'pt' from 'pt-BR'
  const calendarUrl = `https://calendar.app.google/uvWx5JWm7SLZSCqz7?hl=${currentLanguage}`;

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {t("hero.title")}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              {t("hero.subtitle")}
            </p>

            <div className="space-y-8 mb-10">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{t("benefits.opportunity.title")}</h3>
                  <p className="text-muted-foreground">{t("benefits.opportunity.description")}</p>
                </div>
              </div>

              <div className="flex gap-4">
                 <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{t("benefits.demo.title")}</h3>
                  <p className="text-muted-foreground">{t("benefits.demo.description")}</p>
                </div>
              </div>
            </div>

            <Card className="bg-muted/50 border-border">
              <CardContent className="p-6">
                 <h4 className="font-bold mb-4">{t("quickCheck.title")}</h4>
                 <p className="mb-4">{t("quickCheck.question")}</p>
                 <a 
                   href={calendarUrl}
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="inline-block"
                 >
                   <Button variant="outline" className="gap-2">
                     {t("quickCheck.buttonText")}
                     <ArrowRight className="w-4 h-4" />
                   </Button>
                 </a>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl shadow-xl overflow-hidden border border-border"
          >
            <div className="relative w-full h-[600px] bg-white rounded-2xl overflow-hidden">
              <iframe 
                src={calendarUrl}
                style={{border: 0}} 
                width="100%" 
                height="100%" 
                frameBorder="0"
                allow="calendar"
              ></iframe>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}