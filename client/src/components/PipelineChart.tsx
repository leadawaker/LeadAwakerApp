import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const STAGES: Stage[] = [
  {
    id: "engaged",
    title: "Lead Engaged",
    icon: <User className="w-5 h-5" />,
    colorClass: "border-slate-300 text-slate-50",
    headerClass: "text-slate-100",
    textColorClass: "text-slate-100",
    customStyle: { backgroundColor: "#1E3A8A" },
    customTextStyle: { color: "#1E3A8A" },
  },
  {
    id: "replied",
    title: "Lead Replied",
    icon: <MessageSquare className="w-5 h-5" />,
    colorClass: "border-slate-300 text-slate-50",
    headerClass: "text-slate-100",
    textColorClass: "text-slate-100",
    customStyle: { backgroundColor: "#2563EB" },
    customTextStyle: { color: "#2563EB" },
  },
  {
    id: "qualified",
    title: "Lead Qualified",
    icon: <CheckCircle className="w-5 h-5" />,
    colorClass: "border-slate-300 text-slate-50",
    headerClass: "text-black",
    textColorClass: "text-slate-100",
    customStyle: { backgroundColor: "#5170FF" },
    customTextStyle: { color: "#5170FF" },
  },
  {
    id: "booked",
    title: "Lead Booked",
    icon: <CalendarCheck className="w-5 h-5" />,
    colorClass: "bg-yellow-400 border-yellow-300 text-yellow-900",
    headerClass: "bg-yellow-500/40 text-yellow-800 dark:text-yellow-200",
    textColorClass: "text-yellow-600 dark:text-yellow-500",
  },
];

const INITIAL_LEADS: Record<StageId, Lead[]> = {
  engaged: [
    { id: "l1", name: "Alice Chen", lastContacted: Date.now() - 300000, phone: "+1 123-4567" },
    { id: "l2", name: "Bob Smith", lastContacted: Date.now() - 600000, phone: "+1 234-5678" },
    { id: "l3", name: "Carol Wu", lastContacted: Date.now() - 900000, phone: "+1 345-6789" },
  ],
  replied: [
    { id: "l4", name: "David Miller", lastContacted: Date.now() - 1200000, phone: "+1 456-7890" },
  ],
  qualified: [
    { id: "l5", name: "Eva Green", lastContacted: Date.now() - 1500000, phone: "+1 567-8901" },
  ],
  booked: [
    { id: "l6", name: "Frank Wright", lastContacted: Date.now() - 1800000, phone: "+1 678-9012" },
  ],
};

export function PipelineChart() {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      moveRandomLead();
    }, 3000);
    return () => clearInterval(interval);
  }, [leads]);

  useEffect(() => {
    const ticker = setInterval(() => {
      setTick(t => t + 1);
    }, 100);
    return () => clearInterval(ticker);
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    const elapsedMs = (Date.now() - timestamp) * 1200;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const hours = Math.floor(elapsedSeconds / 3600);
    
    if (hours > 3) return "3h ago";
    if (hours === 0) return "0h ago";
    return `${hours}h ago`;
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
    <div className="w-full space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white">
          Your Conversion Pipeline in Action
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          Real-time view of leads becoming customers
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        {STAGES.map((stage) => (
          <div key={stage.id} className="flex flex-col">
            <div className="flex flex-col bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-2 border border-slate-200 dark:border-slate-800 w-full">
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
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {leads[stage.id].map((lead) => (
                  <motion.div
                    key={lead.id}
                    layoutId={lead.id}
                    initial={{ opacity: 0, scale: 0.8, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    data-testid={`lead-card-${lead.id}`}
                  >
                    <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <div 
                            className={`font-semibold text-sm ${stage.textColorClass}`}
                            style={stage.customTextStyle}
                            data-testid={`lead-name-${lead.id}`}
                          >
                            {lead.name}
                          </div>
                          <MoreHorizontal className="w-4 h-4 text-slate-400" />
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
              </AnimatePresence>
              
              {leads[stage.id].length === 0 && (
                <div className="flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-900 p-3" data-testid={`empty-stage-${stage.id}`}>
                  No leads in this stage
                </div>
              )}
            </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
