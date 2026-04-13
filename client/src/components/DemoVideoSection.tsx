import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const YOUTUBE_ID = "nN_Eq3lWouo";

export default function DemoVideoSection() {
  const { t } = useTranslation("home");

  return (
    <section className="py-24 bg-[#F4F5F9] dark:bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <span className="inline-block mb-4 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground border border-border/60 rounded-full">
            {t("demo.badge")}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            {t("demo.title")}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t("demo.subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="w-full"
        >
          <div
            className="rounded-2xl overflow-hidden border border-border w-full aspect-video"
            style={{
              transform: "perspective(1200px) rotateX(3deg)",
              boxShadow:
                "0 4px 6px -1px rgba(0,0,0,0.05), 0 20px 40px -8px rgba(0,0,0,0.12), 0 40px 80px -16px rgba(0,0,0,0.08)",
            }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_ID}&controls=0&modestbranding=1&rel=0`}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
