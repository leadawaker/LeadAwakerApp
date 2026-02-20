import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import { User, MessageSquare, CheckCircle, CalendarCheck, MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StageId = "engaged" | "replied" | "qualified" | "booked";

interface Lead {
  id: string;
  name: string;
  lastContacted: number;
  phone: string;
}

interface Stage {
  id: StageId;
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  headerClass: string;
  textColorClass: string;
  customStyle?: React.CSSProperties;
  customTextStyle?: React.CSSProperties;
}

const getInitialLeads = (t: (key: string) => string): Record<StageId, Lead[]> => ({
  engaged: [
    { id: "l1", name: t("leads.l1"), lastContacted: Date.now() - 300000, phone: t("phones.l1") },
    { id: "l2", name: t("leads.l2"), lastContacted: Date.now() - 600000, phone: t("phones.l2") },
    { id: "l3", name: t("leads.l3"), lastContacted: Date.now() - 900000, phone: t("phones.l3") },
  ],
  replied: [
    { id: "l4", name: t("leads.l4"), lastContacted: Date.now() - 1200000, phone: t("phones.l4") },
  ],
  qualified: [
    { id: "l5", name: t("leads.l5"), lastContacted: Date.now() - 1500000, phone: t("phones.l5") },
  ],
  booked: [
    { id: "l6", name: t("leads.l6"), lastContacted: Date.now() - 1800000, phone: t("phones.l6") },
  ],
});

export default function PipelineChart() {
  const { t, i18n } = useTranslation("pipelineChart");
  const [leads, setLeads] = useState(() => getInitialLeads(t));
  const [, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.1 });

  const STAGES: Stage[] = [
    {
      id: "engaged",
      title: t("stages.engaged"),
      icon: <User className="w-5 h-5" />,
      colorClass: "border-slate-300 text-slate-50",
      headerClass: "text-slate-100",
      textColorClass: "text-slate-100",
      customStyle: { backgroundColor: "#1a3a6f" },
      customTextStyle: { color: "#1a3a6f" },
    },
    {
      id: "replied",
      title: t("stages.replied"),
      icon: <MessageSquare className="w-5 h-5" />,
      colorClass: "border-slate-300 text-slate-50",
      headerClass: "text-slate-100",
      textColorClass: "text-slate-100",
      customStyle: { backgroundColor: "#2d5aa8" },
      customTextStyle: { color: "#2d5aa8" },
    },
    {
      id: "qualified",
      title: t("stages.qualified"),
      icon: <CheckCircle className="w-5 h-5" />,
      colorClass: "border-slate-300 text-slate-50",
      headerClass: "text-black",
      textColorClass: "text-slate-100",
      customStyle: { backgroundColor: "#1E90FF" },
      customTextStyle: { color: "#1E90FF" },
    },
    {
      id: "booked",
      title: t("stages.booked"),
      icon: <CalendarCheck className="w-5 h-5" />,
      colorClass: "bg-brand-yellow border-brand-yellow/30 text-brand-yellow-foreground",
      headerClass: "bg-brand-yellow/40 text-brand-yellow-foreground dark:text-brand-yellow",
      textColorClass: "text-brand-yellow dark:text-brand-soft-yellow",
    },
  ];

  useEffect(() => {
    setLeads(getInitialLeads(t));
  }, [i18n.language, t]);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      moveRandomLead();
    }, 1500);
    return () => clearInterval(interval);
  }, [leads, isInView]);

  useEffect(() => {
    if (!isInView) return;
    const ticker = setInterval(() => {
      setTick(t => t + 1);
    }, 100);
    return () => clearInterval(ticker);
  }, [isInView]);

  const formatTimeAgo = (timestamp: number) => {
    const elapsedMs = (Date.now() - timestamp) * 1200;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(elapsedSeconds / 3600);

    if (hours > 3) return t("timeAgo.hoursAgo", { hours: 3 });
    if (hours === 0) return t("timeAgo.hoursAgo", { hours: 0 });
    return t("timeAgo.hoursAgo", { hours });
  };

  const moveRandomLead = () => {
    const moves: { from: StageId; to: StageId }[] = [
      { from: "qualified", to: "booked" },
      { from: "replied", to: "qualified" },
      { from: "engaged", to: "replied" },
    ];
    const possibleMoves = moves.filter(m => leads[m.from].length > 0);

    if (possibleMoves.length === 0) return;
    const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

    setLeads(prev => {
      const fromLeads = [...prev[move.from]];
      const leadToMove = fromLeads.shift();

      if (!leadToMove) return prev;
      return {
        ...prev,
        [move.from]: fromLeads,
        [move.to]: [...prev[move.to], { ...leadToMove, lastContacted: Date.now() }]
      };
    });
  };

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -100px 0px" }}
      transition={{ duration: 0.6 }}
      className="w-full space-y-8"
    >
      <div className="text-center space-y-2">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t("header.title")}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg py-5">
          {t("header.subtitle")}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full items-start">
        {STAGES.map((stage) => (
          <div key={stage.id} className="flex flex-col">
            <div className={`flex flex-col bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-2 border border-slate-200 dark:border-slate-800 w-full transition-all duration-300 ${stage.id === 'booked' ? 'min-h-[200px] md:min-h-[600px]' : 'h-auto md:min-h-[600px]'}`}>
            {/* Header */}
            <div 
              className={`sticky top-2 p-3 rounded-lg mb-3 flex items-center justify-between shadow-sm backdrop-blur-sm ${stage.colorClass} z-10`}
              style={stage.customStyle ? { ...stage.customStyle, backgroundColor: stage.customStyle.backgroundColor } : undefined}
              data-testid={`pipeline-stage-${stage.id}`}
            >
              <div className="flex items-center gap-2 font-medium">
                {stage.icon}
                <span className="text-sm">{stage.title}</span>
              </div>
              <Badge variant="secondary" className="bg-white/40 text-current hover:bg-white/50 border-0" data-testid={`stage-count-${stage.id}`}>
                {leads[stage.id].length}
              </Badge>
            </div>
            {/* Drop Zone / List */}
            <div className="space-y-2 flex-1 relative">
              {leads[stage.id].map((lead) => (
                <motion.div
                  key={lead.id}
                  layoutId={lead.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ 
                    layout: { type: "spring", stiffness: 250, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                  data-testid={`lead-card-${lead.id}`}
                >
                  <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-card border-border">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <div 
                          className={`font-semibold text-sm ${stage.textColorClass}`}
                          style={stage.customTextStyle}
                          data-testid={`lead-name-${lead.id}`}
                        >
                          {lead.name}
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                        <span data-testid={`lead-time-${lead.id}`}>{formatTimeAgo(lead.lastContacted)}</span>
                        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded text-[0.65rem]" data-testid={`lead-phone-${lead.id}`}>
                          {lead.phone}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {leads[stage.id].length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-900 p-3" 
                  data-testid={`empty-stage-${stage.id}`}
                >
                  {t("emptyStage")}
                </motion.div>
              )}
            </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
